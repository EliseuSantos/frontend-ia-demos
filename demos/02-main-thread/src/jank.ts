export interface FrameSample {
  latestMs: number;
  maxWindowMs: number;
  longTasks: number;
  lastLongTaskMs: number;
  samples: readonly number[];
}

export class JankMeter {
  readonly supportsLongTask: boolean;
  private samples: number[] = [];
  private last = 0;
  private warmed = false;
  private running = true;
  private marking = false;
  private maxDuring = 0;
  private markStart = 0;
  private longTasks = 0;
  private longTasksAtMark = 0;
  private lastLongTaskMs = 0;
  private observer: PerformanceObserver | null = null;

  constructor(private readonly onFrame: (sample: FrameSample) => void) {
    this.supportsLongTask = this.watchLongTasks();
    requestAnimationFrame((now) => this.tick(now));
  }

  startMark(): void {
    this.marking = true;
    this.maxDuring = 0;
    this.markStart = performance.now();
    this.longTasksAtMark = this.longTasks;
  }

  endMark(): { maxFrameMs: number; longTasks: number } {
    this.marking = false;
    const fromTimeline = performance
      .getEntriesByType('longtask')
      .filter((entry) => entry.startTime >= this.markStart - 5).length;
    return {
      maxFrameMs: this.maxDuring,
      longTasks: Math.max(fromTimeline, this.longTasks - this.longTasksAtMark),
    };
  }

  private watchLongTasks(): boolean {
    if (typeof PerformanceObserver === 'undefined') return false;
    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.longTasks += 1;
          this.lastLongTaskMs = entry.duration;
        }
      });
      this.observer.observe({ type: 'longtask', buffered: true });
      return true;
    } catch {
      this.observer = null;
      return false;
    }
  }

  private tick(now: number): void {
    if (!this.running) return;
    if (!this.warmed) {
      this.warmed = true;
      this.last = now;
      requestAnimationFrame((next) => this.tick(next));
      return;
    }

    const dt = now - this.last;
    this.last = now;
    this.samples.push(dt);
    if (this.samples.length > 60) this.samples.shift();
    if (this.marking) this.maxDuring = Math.max(this.maxDuring, dt);

    let maxWindowMs = 0;
    for (const sample of this.samples) maxWindowMs = Math.max(maxWindowMs, sample);

    this.onFrame({
      latestMs: dt,
      maxWindowMs,
      longTasks: this.longTasks,
      lastLongTaskMs: this.lastLongTaskMs,
      samples: this.samples,
    });
    requestAnimationFrame((next) => this.tick(next));
  }
}
