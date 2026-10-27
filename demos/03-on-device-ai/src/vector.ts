export interface Ranked<T> {
  item: T;
  score: number;
}

export function cosine(left: Float32Array, right: Float32Array): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  const denom = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denom === 0 ? 0 : dot / denom;
}

export function searchTop<T extends { vector: Float32Array }>(
  items: readonly T[],
  query: Float32Array,
  limit: number,
): Ranked<T>[] {
  return items
    .map((item) => ({ item, score: cosine(item.vector, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
}
