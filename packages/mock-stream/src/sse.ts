import type { SseMessage, TokenPayload } from './types.ts';

export function parseSseBlock(block: string): SseMessage | null {
  let event = 'message';
  const data: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart());
    }
  }
  if (data.length === 0) return null;
  return { event, data: data.join('\n') };
}

export function drainSse(buffer: string): { messages: SseMessage[]; rest: string } {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  const messages: SseMessage[] = [];
  for (const part of parts) {
    const message = parseSseBlock(part);
    if (message) messages.push(message);
  }
  return { messages, rest };
}

export function encodeSse(event: string, data: string): string {
  if (event === 'message') return `data: ${data}\n\n`;
  return `event: ${event}\ndata: ${data}\n\n`;
}

export function parseTokenPayload(data: string): TokenPayload | null {
  try {
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    if (typeof record.token !== 'string' || typeof record.index !== 'number') return null;
    return { token: record.token, index: record.index };
  } catch {
    return null;
  }
}

export function parseOpenAIDelta(data: string): string | 'done' | null {
  const trimmed = data.trim();
  if (trimmed === '[DONE]') return 'done';
  try {
    const value: unknown = JSON.parse(trimmed);
    if (!value || typeof value !== 'object') return null;
    const choices = (value as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) return null;
    const first: unknown = choices[0];
    if (!first || typeof first !== 'object') return null;
    const delta = (first as { delta?: unknown }).delta;
    if (!delta || typeof delta !== 'object') return null;
    const content = (delta as { content?: unknown }).content;
    return typeof content === 'string' ? content : null;
  } catch {
    return null;
  }
}
