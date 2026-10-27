import { describe, expect, it } from 'vitest';
import { cosine, searchTop } from './vector';

describe('cosseno', () => {
  it('reconhece vetores iguais, ortogonais e opostos', () => {
    expect(cosine(new Float32Array([1, 0]), new Float32Array([1, 0]))).toBeCloseTo(1);
    expect(cosine(new Float32Array([1, 0]), new Float32Array([0, 1]))).toBeCloseTo(0);
    expect(cosine(new Float32Array([1, 0]), new Float32Array([-1, 0]))).toBeCloseTo(-1);
    expect(cosine(new Float32Array([0, 0]), new Float32Array([1, 0]))).toBe(0);
  });

  it('ranqueia o documento mais próximo primeiro', () => {
    const docs = [
      { id: 'ortogonal', vector: new Float32Array([0, 1, 0]) },
      { id: 'proximo', vector: new Float32Array([0.9, 0.1, 0]) },
      { id: 'oposto', vector: new Float32Array([-1, 0, 0]) },
    ];
    const ranked = searchTop(docs, new Float32Array([1, 0, 0]), 2);
    expect(ranked.map((hit) => hit.item.id)).toEqual(['proximo', 'ortogonal']);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
});
