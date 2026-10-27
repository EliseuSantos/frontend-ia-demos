import { describe, expect, it } from 'vitest';
import { browserMockResponse } from './browser.ts';
import { mockEvents } from './generate.ts';
import { parseMockRequest } from './request.ts';
import { readSse } from './read.ts';
import { drainSse, parseOpenAIDelta, parseSseBlock, parseTokenPayload } from './sse.ts';
import type { MockRequest } from './types.ts';

function request(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    prompt: 'teste',
    latencyMs: 0,
    stallChance: 0,
    stallMs: 0,
    stallAt: null,
    disconnectAt: null,
    fromToken: 0,
    burst: 4,
    seed: 1,
    connectDelayMs: 0,
    ...overrides,
  };
}

describe('sse', () => {
  it('lê um bloco com evento nomeado', () => {
    expect(parseSseBlock('event: stall\ndata: {"ms":10}')).toEqual({
      event: 'stall',
      data: '{"ms":10}',
    });
  });

  it('guarda o resto incompleto', () => {
    const parsed = drainSse('data: {"token":"Oi","index":0}\n\ndata: {"tok');
    expect(parsed.messages).toHaveLength(1);
    expect(parsed.rest).toBe('data: {"tok');
  });

  it('entende token e delta de provedor', () => {
    expect(parseTokenPayload('{"token":"Oi","index":2}')).toEqual({ token: 'Oi', index: 2 });
    expect(parseTokenPayload('{}')).toBeNull();
    expect(parseOpenAIDelta('[DONE]')).toBe('done');
    expect(
      parseOpenAIDelta('{"choices":[{"delta":{"content":"olá"}}]}'),
    ).toBe('olá');
  });
});

describe('mock events', () => {
  it('corta uma vez e retoma do índice', async () => {
    const first: number[] = [];
    for await (const event of mockEvents(request({ disconnectAt: 4 }))) {
      if (event.event !== 'message') continue;
      const payload = parseTokenPayload(event.data);
      if (payload) first.push(payload.index);
    }
    expect(first).toEqual([0, 1, 2, 3]);

    const second: string[] = [];
    let done = false;
    for await (const event of mockEvents(request({ disconnectAt: 4, fromToken: 4 }))) {
      if (event.event === 'done') done = true;
      if (event.event === 'message') {
        const payload = parseTokenPayload(event.data);
        if (payload) second.push(payload.token);
      }
    }
    expect(done).toBe(true);
    expect(second[0]).toBeTruthy();
    expect(second.length).toBeGreaterThan(4);
  });

  it('emite uma pausa no índice pedido', async () => {
    const names: string[] = [];
    for await (const event of mockEvents(request({ stallAt: 2, stallMs: 0, disconnectAt: 4 }))) {
      names.push(event.event);
    }
    expect(names).toEqual(['message', 'message', 'stall', 'message', 'message']);
  });

  it('normaliza o corpo do pedido', () => {
    const parsed = parseMockRequest({
      prompt: 'oi',
      latencyMs: 9_999,
      stallChance: 2,
      disconnectAt: 3,
      burst: 0,
    });
    expect(parsed.latencyMs).toBe(2_000);
    expect(parsed.stallChance).toBe(1);
    expect(parsed.disconnectAt).toBe(3);
    expect(parsed.burst).toBe(1);
  });
});

describe('resposta no navegador', () => {
  it('entrega os mesmos eventos pelo ReadableStream', async () => {
    const response = browserMockResponse(request({ disconnectAt: 2 }), new AbortController().signal);
    const events: string[] = [];
    await readSse(response, (message) => {
      events.push(message.event);
    }, new AbortController().signal);
    expect(events).toEqual(['message', 'message']);
  });
});
