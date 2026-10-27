export class FrameBatcher {
  private buffer = '';
  private scheduled = false;
  received = 0;
  commits = 0;

  constructor(
    private readonly commit: (chunk: string) => void,
    private readonly schedule: (run: () => void) => void = (run) => {
      requestAnimationFrame(() => run());
    },
  ) {}

  push(token: string): void {
    this.received += 1;
    this.buffer += token;
    if (this.scheduled) return;
    this.scheduled = true;
    this.schedule(() => {
      this.scheduled = false;
      this.flush();
    });
  }

  flush(): void {
    if (!this.buffer) return;
    const chunk = this.buffer;
    this.buffer = '';
    this.commits += 1;
    this.commit(chunk);
  }

  reset(): void {
    this.buffer = '';
    this.received = 0;
    this.commits = 0;
  }
}

export function backoffMs(attempt: number, base = 250, cap = 2_000): number {
  return Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
}
