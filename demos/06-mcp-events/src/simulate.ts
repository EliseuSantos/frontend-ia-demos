export type SimulateInput = {
  seed: number;
  intervalMs: number;
  resources: number;
  windowMs: number;
};

export type ChangeType = 'deployment.succeeded' | 'deployment.error';

export type ResourceChange = {
  resourceId: number;
  changeTimeMs: number;
  type: ChangeType;
  deliveryDelayMs: number;
};

export type TimelineEntry = {
  timeMs: number;
  mode: 'polling' | 'events';
  resourceId: number;
  kind: 'poll' | 'subscribe' | 'change' | 'push';
  detail: string;
  wasted?: boolean;
};

export type ModeMetrics = {
  requests: number;
  wasted: number;
  latenciesMs: number[];
  meanLatencyMs: number | null;
  maxLatencyMs: number | null;
  timeline: TimelineEntry[];
};

export type SimulateResult = {
  changes: ResourceChange[];
  polling: ModeMetrics;
  events: ModeMetrics;
  requestsAvoided: number;
  requestsAvoidedPct: number;
};

export const DEFAULT_SCENARIO: Readonly<SimulateInput> = {
  seed: 42,
  intervalMs: 2000,
  resources: 3,
  windowMs: 60_000,
};

/** Locked DEFAULT_SCENARIO scoreboard (seed 42, 2s, 3 resources, 60s). */
export const DEFAULT_SCENARIO_SCORE = {
  pollingRequests: 93,
  pollingWasted: 92,
  pollingMeanLatencyMs: 1213,
  pollingMaxLatencyMs: 1213,
  eventsRequests: 3,
  eventsWasted: 0,
  eventsMeanLatencyMs: 223,
  eventsMaxLatencyMs: 223,
  requestsAvoided: 90,
  requestsAvoidedPct: 96.77,
} as const;

/** Mulberry32: deterministic PRNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.max(...values);
}

function roundPct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10_000) / 100;
}

/**
 * Draw one change plan per resource. changeTimeMs is drawn from
 * [0, 2 * windowMs] so some land after the window (treated as never).
 * Delivery delay is always in [50, 250] inclusive.
 */
export function planChanges(input: SimulateInput): ResourceChange[] {
  const rng = mulberry32(input.seed);
  const changes: ResourceChange[] = [];
  const span = input.windowMs * 2 + 1;
  for (let resourceId = 0; resourceId < input.resources; resourceId += 1) {
    const changeTimeMs = Math.floor(rng() * span);
    const type: ChangeType = rng() < 0.75 ? 'deployment.succeeded' : 'deployment.error';
    const deliveryDelayMs = 50 + Math.floor(rng() * 201);
    changes.push({ resourceId, changeTimeMs, type, deliveryDelayMs });
  }
  return changes;
}

export function pollTimes(intervalMs: number, windowMs: number): number[] {
  if (intervalMs <= 0) return [0];
  const times: number[] = [];
  for (let t = 0; t <= windowMs; t += intervalMs) {
    times.push(t);
  }
  return times;
}

function simulatePolling(input: SimulateInput, changes: ResourceChange[]): ModeMetrics {
  const times = pollTimes(input.intervalMs, input.windowMs);
  const timeline: TimelineEntry[] = [];
  const latenciesMs: number[] = [];
  let requests = 0;
  let wasted = 0;

  for (let resourceId = 0; resourceId < input.resources; resourceId += 1) {
    const change = changes[resourceId]!;
    const inWindow = change.changeTimeMs >= 0 && change.changeTimeMs <= input.windowMs;
    let lastKnown: 'pending' | ChangeType = 'pending';
    let detected = false;

    for (const timeMs of times) {
      requests += 1;
      const observed: 'pending' | ChangeType =
        inWindow && timeMs >= change.changeTimeMs ? change.type : 'pending';
      const changed = observed !== lastKnown;
      const isWasted = !changed;
      if (isWasted) wasted += 1;

      timeline.push({
        timeMs,
        mode: 'polling',
        resourceId,
        kind: 'poll',
        detail: observed,
        wasted: isWasted,
      });

      if (changed) {
        lastKnown = observed;
        if (observed !== 'pending' && !detected) {
          detected = true;
          latenciesMs.push(timeMs - change.changeTimeMs);
          timeline.push({
            timeMs,
            mode: 'polling',
            resourceId,
            kind: 'change',
            detail: `detected ${observed}`,
          });
        }
      }
    }
  }

  timeline.sort((a, b) => a.timeMs - b.timeMs || a.resourceId - b.resourceId);

  return {
    requests,
    wasted,
    latenciesMs,
    meanLatencyMs: mean(latenciesMs),
    maxLatencyMs: maxOf(latenciesMs),
    timeline,
  };
}

function simulateEvents(input: SimulateInput, changes: ResourceChange[]): ModeMetrics {
  const timeline: TimelineEntry[] = [];
  const latenciesMs: number[] = [];
  let requests = 0;

  for (let resourceId = 0; resourceId < input.resources; resourceId += 1) {
    requests += 1;
    timeline.push({
      timeMs: 0,
      mode: 'events',
      resourceId,
      kind: 'subscribe',
      detail: 'subscribe',
    });

    const change = changes[resourceId]!;
    const inWindow = change.changeTimeMs >= 0 && change.changeTimeMs <= input.windowMs;
    if (!inWindow) continue;

    const deliveryAt = change.changeTimeMs + change.deliveryDelayMs;
    latenciesMs.push(change.deliveryDelayMs);
    timeline.push({
      timeMs: change.changeTimeMs,
      mode: 'events',
      resourceId,
      kind: 'change',
      detail: change.type,
    });
    timeline.push({
      timeMs: deliveryAt,
      mode: 'events',
      resourceId,
      kind: 'push',
      detail: `${change.type} +${change.deliveryDelayMs}ms`,
    });
  }

  timeline.sort((a, b) => a.timeMs - b.timeMs || a.resourceId - b.resourceId);

  return {
    requests,
    wasted: 0,
    latenciesMs,
    meanLatencyMs: mean(latenciesMs),
    maxLatencyMs: maxOf(latenciesMs),
    timeline,
  };
}

/** Run both modes from an explicit change plan (used by edge-case tests). */
export function simulateWithChanges(
  input: SimulateInput,
  changes: ResourceChange[],
): SimulateResult {
  const polling = simulatePolling(input, changes);
  const events = simulateEvents(input, changes);
  const requestsAvoided = Math.max(0, polling.requests - events.requests);
  const requestsAvoidedPct = roundPct(requestsAvoided, polling.requests);

  return {
    changes,
    polling,
    events,
    requestsAvoided,
    requestsAvoidedPct,
  };
}

export function simulate(input: SimulateInput): SimulateResult {
  return simulateWithChanges(input, planChanges(input));
}
