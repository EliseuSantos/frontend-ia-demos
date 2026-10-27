export const SENTENCE =
  'O thread principal pinta o frame, trata o clique e não pode gastar meio segundo tokenizando texto.';

export interface Analysis {
  rounds: number;
  chars: number;
  words: number;
  unique: number;
  checksum: number;
}

export interface WorkerRequest {
  buffer: ArrayBuffer;
  rounds: number;
}

export interface WorkerResponse extends Analysis {
  elapsedMs: number;
}

export function buildCorpus(copies: number): string {
  const safe = Math.max(1, Math.floor(copies));
  return Array.from({ length: safe }, () => SENTENCE).join('\n');
}

export function analyzeCorpus(text: string, rounds: number): Analysis {
  const words = text.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);
  const safeRounds = Math.max(1, Math.floor(rounds));
  let checksum = 0;
  const freq = new Map<string, number>();

  for (let round = 0; round < safeRounds; round += 1) {
    const salt = round + 1;
    for (let index = 0; index < words.length; index += 1) {
      const word = words[index] ?? '';
      let hash = 2166136261 ^ salt;
      for (let charIndex = 0; charIndex < word.length; charIndex += 1) {
        hash ^= word.charCodeAt(charIndex);
        hash = Math.imul(hash, 16777619);
      }
      checksum = (checksum + hash) | 0;
      if (round === safeRounds - 1) {
        freq.set(word, (freq.get(word) ?? 0) + 1);
      }
    }
  }

  return {
    rounds: safeRounds,
    chars: text.length,
    words: words.length,
    unique: freq.size,
    checksum,
  };
}
