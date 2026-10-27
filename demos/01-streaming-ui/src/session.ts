import {
  browserMockResponse,
  isAbort,
  parseOpenAIDelta,
  parseTokenPayload,
  readSse,
  sleep,
  type MockRequest,
} from '@demos/mock-stream';
import { FrameBatcher, backoffMs } from './frame-batcher';

export type StreamMode = 'server' | 'browser' | 'provider';

export type StreamStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'stalled'
  | 'retrying'
  | 'done'
  | 'cancelled'
  | 'error';

export interface StreamSettings {
  prompt: string;
  latencyMs: number;
  stallChance: number;
  stallMs: number;
  disconnectAt: number | null;
  burst: number;
  connectDelayMs: number;
}

export interface StreamView {
  status: StreamStatus;
  error: string | null;
  attempt: number;
  maxAttempts: number;
  received: number;
  domWrites: number;
  retryInMs: number | null;
}

const MAX_ATTEMPTS = 4;

export function streamMode(): StreamMode {
  const base = import.meta.env.VITE_LLM_BASE_URL ?? '';
  const key = import.meta.env.VITE_LLM_API_KEY ?? '';
  const model = import.meta.env.VITE_LLM_MODEL ?? '';
  if (base && key && model) return 'provider';
  return import.meta.env.DEV ? 'server' : 'browser';
}

export function modeLabel(mode: StreamMode): string {
  if (mode === 'provider') return 'provedor externo';
  if (mode === 'server') return 'servidor local';
  return 'simulação no navegador';
}

export function startStream(
  settings: StreamSettings,
  mode: StreamMode,
  hooks: {
    onView: (view: StreamView) => void;
    onChunk: (chunk: string) => void;
    onReset: () => void;
  },
): { cancel: () => void } {
  const parent = new AbortController();
  const view: StreamView = {
    status: 'idle',
    error: null,
    attempt: 0,
    maxAttempts: MAX_ATTEMPTS,
    received: 0,
    domWrites: 0,
    retryInMs: null,
  };

  const batcher = new FrameBatcher((chunk) => {
    hooks.onChunk(chunk);
    publish();
  });

  const publish = () => {
    view.received = batcher.received;
    view.domWrites = batcher.commits;
    hooks.onView({ ...view });
  };

  const setStatus = (status: StreamStatus, error: string | null) => {
    view.status = status;
    view.error = error;
    view.retryInMs = status === 'retrying' ? view.retryInMs : null;
    publish();
  };

  void run();

  return {
    cancel() {
      if (
        view.status === 'idle' ||
        view.status === 'done' ||
        view.status === 'error' ||
        view.status === 'cancelled'
      ) {
        return;
      }
      parent.abort();
      batcher.flush();
      setStatus('cancelled', null);
    },
  };

  async function run(): Promise<void> {
    hooks.onReset();
    batcher.reset();
    let fromToken = 0;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      if (parent.signal.aborted) {
        setStatus('cancelled', null);
        return;
      }

      view.attempt = attempt;
      if (attempt > 1) {
        const delay = backoffMs(attempt - 1);
        view.retryInMs = delay;
        setStatus(
          'retrying',
          `A conexão caiu no token ${fromToken}. Nova tentativa em ${delay} ms.`,
        );
        try {
          await sleep(delay, parent.signal);
        } catch {
          batcher.flush();
          setStatus('cancelled', null);
          return;
        }
        if (mode === 'provider') {
          fromToken = 0;
          hooks.onReset();
          batcher.reset();
        }
      } else {
        setStatus('connecting', null);
      }

      const local = new AbortController();
      const onParentAbort = () => local.abort();
      parent.signal.addEventListener('abort', onParentAbort, { once: true });

      let completed = false;
      try {
        const response = await openResponse(settings, mode, fromToken, local.signal);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setStatus('streaming', null);

        await readSse(
          response,
          (message) => {
            if (mode === 'provider') {
              const delta = parseOpenAIDelta(message.data);
              if (delta === 'done') {
                completed = true;
                return;
              }
              if (!delta) return;
              batcher.push(delta);
              return;
            }

            if (message.event === 'stall') {
              setStatus('stalled', null);
              return;
            }
            if (message.event === 'done') {
              completed = true;
              return;
            }
            const payload = parseTokenPayload(message.data);
            if (!payload) return;
            fromToken = payload.index + 1;
            batcher.push(payload.token);
            if (view.status !== 'streaming') setStatus('streaming', null);
          },
          local.signal,
        );
      } catch (error) {
        parent.signal.removeEventListener('abort', onParentAbort);
        batcher.flush();
        if (parent.signal.aborted || isAbort(error)) {
          setStatus('cancelled', null);
          return;
        }
        if (attempt === MAX_ATTEMPTS) {
          setStatus('error', error instanceof Error ? error.message : 'Falha ao ler o fluxo.');
          return;
        }
        continue;
      }

      parent.signal.removeEventListener('abort', onParentAbort);
      batcher.flush();
      if (parent.signal.aborted) {
        setStatus('cancelled', null);
        return;
      }
      if (completed) {
        setStatus('done', null);
        return;
      }
      if (attempt === MAX_ATTEMPTS) {
        setStatus(
          'error',
          `A conexão caiu no token ${fromToken} e as tentativas acabaram.`,
        );
        return;
      }
    }
  }
}

async function openResponse(
  settings: StreamSettings,
  mode: StreamMode,
  fromToken: number,
  signal: AbortSignal,
): Promise<Response> {
  if (mode === 'provider') {
    const base = (import.meta.env.VITE_LLM_BASE_URL ?? '').replace(/\/$/, '');
    const key = import.meta.env.VITE_LLM_API_KEY ?? '';
    const model = import.meta.env.VITE_LLM_MODEL ?? '';
    return fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: 'Responda em português, em um parágrafo curto.' },
          { role: 'user', content: settings.prompt },
        ],
      }),
    });
  }

  const mock: MockRequest = {
    prompt: settings.prompt,
    latencyMs: settings.latencyMs,
    stallChance: settings.stallChance,
    stallMs: settings.stallMs,
    stallAt: null,
    disconnectAt: settings.disconnectAt,
    fromToken,
    burst: settings.burst,
    seed: 1,
    connectDelayMs: settings.connectDelayMs,
  };

  if (mode === 'browser') {
    await sleep(mock.connectDelayMs, signal);
    return browserMockResponse(mock, signal);
  }

  return fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mock),
    signal,
  });
}
