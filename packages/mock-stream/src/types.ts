export interface MockRequest {
  prompt: string;
  latencyMs: number;
  stallChance: number;
  stallMs: number;
  stallAt: number | null;
  disconnectAt: number | null;
  fromToken: number;
  burst: number;
  seed: number;
  connectDelayMs: number;
}

export interface MockEvent {
  event: 'message' | 'stall' | 'done';
  data: string;
}

export interface TokenPayload {
  token: string;
  index: number;
}

export interface SseMessage {
  event: string;
  data: string;
}
