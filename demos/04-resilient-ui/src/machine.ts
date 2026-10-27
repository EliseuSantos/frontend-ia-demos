export const PHASES = [
  'idle',
  'connecting',
  'streaming',
  'stalled',
  'retrying',
  'failed',
  'done',
] as const;

export type Phase = (typeof PHASES)[number];

export interface SessionState {
  phase: Phase;
  text: string;
  tokens: string[];
  received: number;
  attempt: number;
  maxAttempts: number;
  error: string | null;
  pending: number;
  paused: boolean;
  offline: boolean;
  highWatermark: number;
  lowWatermark: number;
}

export type SessionEvent =
  | { type: 'start' }
  | { type: 'connected' }
  | { type: 'token'; text: string }
  | { type: 'stall' }
  | { type: 'disconnect' }
  | { type: 'timeout' }
  | { type: 'offline' }
  | { type: 'online' }
  | { type: 'retry' }
  | { type: 'cancel' }
  | { type: 'complete' }
  | { type: 'flush'; count: number }
  | { type: 'fail'; reason: string };

export function createSession(options?: {
  maxAttempts?: number;
  highWatermark?: number;
  lowWatermark?: number;
}): SessionState {
  const high = options?.highWatermark ?? 16;
  const requestedLow = options?.lowWatermark ?? 6;
  return {
    phase: 'idle',
    text: '',
    tokens: [],
    received: 0,
    attempt: 0,
    maxAttempts: options?.maxAttempts ?? 3,
    error: null,
    pending: 0,
    paused: false,
    offline: false,
    highWatermark: high,
    lowWatermark: Math.min(requestedLow, high - 1),
  };
}

export function reduce(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case 'online':
      return { ...state, offline: false };
    case 'offline':
      if (isLive(state.phase)) {
        return { ...state, offline: true, phase: 'failed', error: 'Sem rede.', paused: false };
      }
      return { ...state, offline: true };
    case 'start':
      if (state.phase === 'retrying') return state;
      return begin(state, false);
    case 'retry':
      if (state.phase !== 'retrying' && state.phase !== 'failed') return state;
      return begin(state, state.phase === 'retrying');
    case 'connected':
      if (state.phase !== 'connecting') return state;
      return { ...state, phase: 'streaming', error: null };
    case 'token':
      return pushToken(state, event.text);
    case 'flush':
      return flushTokens(state, event.count);
    case 'stall':
      if (state.phase !== 'streaming') return state;
      return { ...state, phase: 'stalled' };
    case 'disconnect':
    case 'timeout':
      if (!isTransfer(state.phase)) return state;
      return failOrRetry(state, event.type === 'timeout' ? 'Tempo esgotado.' : 'Conexão caiu.');
    case 'complete':
      if (state.phase !== 'streaming' && state.phase !== 'stalled') return state;
      return { ...state, phase: 'done', error: null, paused: false };
    case 'cancel':
      if (!isLive(state.phase)) return state;
      return { ...state, phase: 'idle', error: null, paused: false };
    case 'fail':
      if (state.phase === 'done' || state.phase === 'idle') return state;
      return { ...state, phase: 'failed', error: event.reason, paused: false };
    default:
      return state;
  }
}

export function backoffMs(attempt: number, base = 300, cap = 2_000): number {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  return Math.min(cap, base * 2 ** (safeAttempt - 1));
}

function isLive(phase: Phase): boolean {
  return phase === 'connecting' || phase === 'streaming' || phase === 'stalled' || phase === 'retrying';
}

function isTransfer(phase: Phase): boolean {
  return phase === 'connecting' || phase === 'streaming' || phase === 'stalled';
}

function begin(state: SessionState, keepPartial: boolean): SessionState {
  if (state.offline) {
    return { ...state, phase: 'failed', error: 'Sem rede.', paused: false };
  }
  if (state.phase === 'connecting' || state.phase === 'streaming' || state.phase === 'stalled') {
    return state;
  }
  const tokens = keepPartial ? state.tokens : [];
  return {
    ...state,
    phase: 'connecting',
    attempt: keepPartial ? state.attempt + 1 : 1,
    error: null,
    text: keepPartial ? state.text : '',
    tokens,
    pending: tokens.length,
    received: keepPartial ? state.received : 0,
    paused: keepPartial ? pausedFor(state, tokens.length) : false,
  };
}

function pushToken(state: SessionState, text: string): SessionState {
  if (state.phase !== 'streaming' && state.phase !== 'stalled' && state.phase !== 'connecting') {
    return state;
  }
  const tokens = [...state.tokens, text];
  return {
    ...state,
    phase: 'streaming',
    tokens,
    pending: tokens.length,
    received: state.received + 1,
    paused: pausedFor(state, tokens.length),
    error: null,
  };
}

function flushTokens(state: SessionState, count: number): SessionState {
  if (state.tokens.length === 0 || count <= 0) return state;
  const take = Math.min(count, state.tokens.length);
  const tokens = state.tokens.slice(take);
  return {
    ...state,
    text: state.text + state.tokens.slice(0, take).join(''),
    tokens,
    pending: tokens.length,
    paused: pausedFor(state, tokens.length),
  };
}

function pausedFor(state: SessionState, pending: number): boolean {
  if (pending >= state.highWatermark) return true;
  if (pending <= state.lowWatermark) return false;
  return state.paused;
}

function failOrRetry(state: SessionState, reason: string): SessionState {
  if (state.attempt < state.maxAttempts) {
    return { ...state, phase: 'retrying', error: reason, paused: false };
  }
  return { ...state, phase: 'failed', error: reason, paused: false };
}
