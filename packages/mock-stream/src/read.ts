import { drainSse } from './sse.ts';
import type { SseMessage } from './types.ts';
import { abortError, sleep } from './timing.ts';

export async function readSse(
  response: Response,
  onMessage: (message: SseMessage) => void | Promise<void>,
  signal: AbortSignal,
  shouldPause: () => boolean = () => false,
): Promise<void> {
  const body = response.body;
  if (!body) throw new Error('Resposta sem corpo.');

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      while (shouldPause()) {
        await sleep(16, signal);
      }
      if (signal.aborted) throw abortError();

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parsed = drainSse(buffer);
      buffer = parsed.rest;
      for (const message of parsed.messages) {
        await onMessage(message);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const parsed = drainSse(`${buffer}\n\n`);
      for (const message of parsed.messages) {
        await onMessage(message);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
