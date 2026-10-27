import type { MockRequest } from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function numberField(body: Record<string, unknown>, key: string, fallback: number): number {
  const value = body[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value;
}

function optionalIndex(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const index = Math.floor(value);
  return index >= 1 ? index : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseMockRequest(raw: unknown): MockRequest {
  const body = isRecord(raw) ? raw : {};
  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  return {
    prompt,
    latencyMs: clamp(numberField(body, 'latencyMs', 20), 0, 2_000),
    stallChance: clamp(numberField(body, 'stallChance', 0), 0, 1),
    stallMs: clamp(numberField(body, 'stallMs', 400), 0, 10_000),
    stallAt: optionalIndex(body, 'stallAt'),
    disconnectAt: optionalIndex(body, 'disconnectAt'),
    fromToken: Math.max(0, Math.floor(numberField(body, 'fromToken', 0))),
    burst: Math.max(1, Math.floor(numberField(body, 'burst', 2))),
    seed: Math.floor(numberField(body, 'seed', 1)) || 1,
    connectDelayMs: clamp(numberField(body, 'connectDelayMs', 0), 0, 10_000),
  };
}
