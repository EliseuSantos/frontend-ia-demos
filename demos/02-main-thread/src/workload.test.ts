import { describe, expect, it } from 'vitest';
import { analyzeCorpus, buildCorpus } from './workload';

describe('analyzeCorpus', () => {
  it('é determinístico e conta as palavras', () => {
    const text = buildCorpus(4);
    const first = analyzeCorpus(text, 3);
    const second = analyzeCorpus(text, 3);
    expect(first).toEqual(second);
    expect(first.words).toBeGreaterThan(10);
    expect(first.unique).toBeGreaterThan(3);
    expect(first.chars).toBe(text.length);
    expect(first.checksum).not.toBe(0);
  });
});
