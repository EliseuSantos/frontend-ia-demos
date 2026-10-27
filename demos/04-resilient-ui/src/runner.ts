import {
  browserMockResponse,
  isAbort,
  parseTokenPayload,
  readSse,
  sleep,
  type MockRequest,
} from '@demos/mock-stream';
import {
  backoffMs,
  createSession,
  reduce,
  type SessionEvent,
  type SessionState,
} from './machine';

export interface RunnerParams {
  prompt: string;
  stallMs: number;
  stallAt: number | null;
  disconnectAt: number | null;
  maxAttempts: number;
  mode: 'server' | 'browser';
}

const CONNECT_TIMEOUT_MS = 4_000;
const STALL_TIMEOUT_MS = 1_200;
const BACKOFF_BASE_MS = 350;
const BACKOFF_CAP_MS = 2_000;
const FLUSH_PER_FRAME = 4;

export function streamMode(): RunnerParams['mode'] {
  return import.meta.env.DEV ? 'server' : 'browser';
}

export function launchSession(
  params: RunnerParams,
  emit: (state: SessionState, log: readonly string[]) => void,
): { cancel: () => void } {
  const parent = new AbortController();
  const log: string[] = [];
  let state = createSession({ maxAttempts: params.maxAttempts, highWatermark: 16, lowWatermark: 6 });
  const phase = (): SessionState['phase'] => state.phase;
  let reading: AbortController | null = null;

  const update = (event: SessionEvent) => {
    const before = phase();
    state = reduce(state, event);
    if (phase() !== before) {
      log.push(`${before} -> ${phase()} (${event.type})`);
      if (log.length > 14) log.shift();
    }
    emit(state, log);
  };

  const onOffline = () => {
    update({ type: 'offline' });
    reading?.abort();
  };
  const onOnline = () => update({ type: 'online' });
  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  let flushScheduled = false;
  const scheduleFlush = () => {
    if (flushScheduled) return;
    flushScheduled = true;
    requestAnimationFrame(() => {
      flushScheduled = false;
      if (state.pending === 0) return;
      update({ type: 'flush', count: Math.min(FLUSH_PER_FRAME, state.pending) });
      if (state.pending > 0) scheduleFlush();
    });
  };

  void (async () => {
    try {
      if (navigator.onLine === false) update({ type: 'offline' });
      update({ type: 'start' });
      await drive();
    } catch (error) {
      if (
        !parent.signal.aborted &&
        !isAbort(error) &&
        phase() !== 'failed' &&
        phase() !== 'done' &&
        phase() !== 'idle'
      ) {
        update({
          type: 'fail',
          reason: error instanceof Error ? error.message : 'Falha desconhecida.',
        });
      }
    } finally {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    }
  })();

  return {
    cancel() {
      parent.abort();
      reading?.abort();
      if (phase() !== 'idle' && phase() !== 'done' && phase() !== 'failed') {
        update({ type: 'cancel' });
      }
    },
  };

  async function drive(): Promise<void> {
    while (!parent.signal.aborted) {
      if (phase() === 'done' || phase() === 'failed' || phase() === 'idle') return;

      if (phase() === 'retrying') {
        await sleep(backoffMs(state.attempt, BACKOFF_BASE_MS, BACKOFF_CAP_MS), parent.signal);
        if (parent.signal.aborted || phase() !== 'retrying') return;
        update({ type: 'retry' });
      }

      if (phase() !== 'connecting') return;
      const outcome = await readOnce();
      if (outcome === 'stop') return;
    }
  }

  async function readOnce(): Promise<'continue' | 'stop'> {
    const local = new AbortController();
    reading = local;
    const onParentAbort = () => local.abort();
    parent.signal.addEventListener('abort', onParentAbort);

    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    const clearTimers = () => {
      if (connectTimer) clearTimeout(connectTimer);
      if (stallTimer) clearTimeout(stallTimer);
    };

    const armStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      const tick = () => {
        if (parent.signal.aborted) return;
        if (state.paused) {
          stallTimer = setTimeout(tick, STALL_TIMEOUT_MS);
          return;
        }
        if (phase() === 'streaming' || phase() === 'stalled') {
          update({ type: 'timeout' });
          local.abort();
        }
      };
      stallTimer = setTimeout(tick, STALL_TIMEOUT_MS);
    };

    try {
      connectTimer = setTimeout(() => {
        if (phase() === 'connecting') {
          update({ type: 'timeout' });
          local.abort();
        }
      }, CONNECT_TIMEOUT_MS);

      const response = await openResponse(params, state.received, local.signal);
      if (connectTimer) clearTimeout(connectTimer);

      if (parent.signal.aborted) {
        update({ type: 'cancel' });
        return 'stop';
      }
      if (phase() !== 'connecting') {
        await response.body?.cancel().catch(() => undefined);
        return phase() === 'failed' || phase() === 'idle' ? 'stop' : 'continue';
      }

      update({ type: 'connected' });
      armStall();

      let completed = false;
      await readSse(
        response,
        async (message) => {
          if (message.event === 'stall') {
            update({ type: 'stall' });
            return;
          }
          if (message.event === 'done') {
            completed = true;
            return;
          }
          const payload = parseTokenPayload(message.data);
          if (!payload) return;
          update({ type: 'token', text: payload.token });
          scheduleFlush();
          armStall();
          while (state.paused && !local.signal.aborted) {
            await sleep(16, local.signal);
          }
        },
        local.signal,
        () => state.paused,
      );

      if (parent.signal.aborted) {
        update({ type: 'cancel' });
        return 'stop';
      }
      if (phase() === 'failed' || phase() === 'idle') return 'stop';
      if (phase() === 'retrying') return 'continue';
      if (completed && (phase() === 'streaming' || phase() === 'stalled')) {
        update({ type: 'complete' });
        scheduleFlush();
        return 'stop';
      }
      if (phase() === 'done') return 'stop';
      update({ type: 'disconnect' });
      return phase() === 'failed' ? 'stop' : 'continue';
    } catch (error) {
      if (parent.signal.aborted) {
        if (phase() !== 'idle' && phase() !== 'failed' && phase() !== 'done') {
          update({ type: 'cancel' });
        }
        return 'stop';
      }
      if (phase() === 'failed' || phase() === 'idle' || phase() === 'done') return 'stop';
      if (phase() === 'retrying') return 'continue';
      update({ type: isAbort(error) ? 'timeout' : 'disconnect' });
      return phase() === 'failed' ? 'stop' : 'continue';
    } finally {
      clearTimers();
      parent.signal.removeEventListener('abort', onParentAbort);
      if (reading === local) reading = null;
    }
  }
}

async function openResponse(
  params: RunnerParams,
  fromToken: number,
  signal: AbortSignal,
): Promise<Response> {
  const mock: MockRequest = {
    prompt: params.prompt,
    latencyMs: 0,
    stallChance: 0,
    stallMs: params.stallMs,
    stallAt: params.stallAt,
    disconnectAt: params.disconnectAt,
    fromToken,
    burst: 20,
    seed: 1,
    connectDelayMs: 0,
  };

  if (params.mode === 'browser') return browserMockResponse(mock, signal);
  return fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mock),
    signal,
  });
}
