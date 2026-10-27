import { describe, expect, it } from 'vitest';
import { FrameBatcher, backoffMs } from './frame-batcher';

describe('FrameBatcher', () => {
  it('junta vários tokens numa escrita só por frame', () => {
    let queued: (() => void) | undefined;
    const chunks: string[] = [];
    const batcher = new FrameBatcher(
      (chunk) => chunks.push(chunk),
      (run) => {
        queued = run;
      },
    );

    batcher.push('Olá');
    batcher.push(' ');
    batcher.push('mundo');

    expect(chunks).toEqual([]);
    expect(batcher.received).toBe(3);
    expect(batcher.commits).toBe(0);

    queued?.();

    expect(chunks).toEqual(['Olá mundo']);
    expect(batcher.commits).toBe(1);
  });

  it('esvazia o que sobrou quando o fluxo termina', () => {
    const chunks: string[] = [];
    const batcher = new FrameBatcher(
      (chunk) => chunks.push(chunk),
      () => undefined,
    );
    batcher.push('fim');
    batcher.flush();
    expect(chunks).toEqual(['fim']);
  });
});

describe('backoff', () => {
  it('dobra a espera até o teto', () => {
    expect(backoffMs(1, 200, 1_000)).toBe(200);
    expect(backoffMs(2, 200, 1_000)).toBe(400);
    expect(backoffMs(3, 200, 1_000)).toBe(800);
    expect(backoffMs(4, 200, 1_000)).toBe(1_000);
  });
});
