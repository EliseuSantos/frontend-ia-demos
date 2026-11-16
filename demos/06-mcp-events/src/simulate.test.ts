import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENARIO,
  DEFAULT_SCENARIO_SCORE,
  planChanges,
  pollTimes,
  simulate,
  simulateWithChanges,
  type ResourceChange,
  type SimulateInput,
} from './simulate';

function change(
  resourceId: number,
  changeTimeMs: number,
  deliveryDelayMs = 100,
  type: ResourceChange['type'] = 'deployment.succeeded',
): ResourceChange {
  return { resourceId, changeTimeMs, type, deliveryDelayMs };
}

describe('simulate', () => {
  it('locks DEFAULT_SCENARIO scoreboard numbers', () => {
    const result = simulate(DEFAULT_SCENARIO);
    expect(result.polling.requests).toBe(DEFAULT_SCENARIO_SCORE.pollingRequests);
    expect(result.polling.wasted).toBe(DEFAULT_SCENARIO_SCORE.pollingWasted);
    expect(result.polling.meanLatencyMs).toBe(DEFAULT_SCENARIO_SCORE.pollingMeanLatencyMs);
    expect(result.polling.maxLatencyMs).toBe(DEFAULT_SCENARIO_SCORE.pollingMaxLatencyMs);
    expect(result.events.requests).toBe(DEFAULT_SCENARIO_SCORE.eventsRequests);
    expect(result.events.wasted).toBe(DEFAULT_SCENARIO_SCORE.eventsWasted);
    expect(result.events.meanLatencyMs).toBe(DEFAULT_SCENARIO_SCORE.eventsMeanLatencyMs);
    expect(result.events.maxLatencyMs).toBe(DEFAULT_SCENARIO_SCORE.eventsMaxLatencyMs);
    expect(result.requestsAvoided).toBe(DEFAULT_SCENARIO_SCORE.requestsAvoided);
    expect(result.requestsAvoidedPct).toBe(DEFAULT_SCENARIO_SCORE.requestsAvoidedPct);
  });

  it('is deterministic for the same seed', () => {
    const a = simulate(DEFAULT_SCENARIO);
    const b = simulate({ ...DEFAULT_SCENARIO });
    expect(a).toEqual(b);
    expect(planChanges(DEFAULT_SCENARIO)).toEqual(planChanges(DEFAULT_SCENARIO));
  });

  it('detects a change at t=0 with zero polling latency', () => {
    const input: SimulateInput = {
      seed: 1,
      intervalMs: 1000,
      resources: 1,
      windowMs: 5000,
    };
    const result = simulateWithChanges(input, [change(0, 0, 80)]);
    expect(result.polling.latenciesMs).toEqual([0]);
    expect(result.polling.meanLatencyMs).toBe(0);
    expect(result.events.latenciesMs).toEqual([80]);
    expect(result.polling.requests).toBe(6);
    expect(result.polling.wasted).toBe(5);
  });

  it('ignores a change after the window for latency samples', () => {
    const input: SimulateInput = {
      seed: 1,
      intervalMs: 1000,
      resources: 1,
      windowMs: 5000,
    };
    const result = simulateWithChanges(input, [change(0, 5001, 90)]);
    expect(result.polling.latenciesMs).toEqual([]);
    expect(result.polling.meanLatencyMs).toBeNull();
    expect(result.events.latenciesMs).toEqual([]);
    expect(result.polling.wasted).toBe(result.polling.requests);
    expect(result.events.requests).toBe(1);
  });

  it('treats a resource that never changes like an out-of-window change', () => {
    const input: SimulateInput = {
      seed: 1,
      intervalMs: 2000,
      resources: 1,
      windowMs: 10_000,
    };
    const result = simulateWithChanges(input, [change(0, Number.POSITIVE_INFINITY, 100)]);
    expect(result.polling.latenciesMs).toEqual([]);
    expect(result.events.latenciesMs).toEqual([]);
    expect(result.polling.requests).toBe(6);
    expect(result.events.requests).toBe(1);
  });

  it('still polls once when interval is bigger than the window', () => {
    const input: SimulateInput = {
      seed: 1,
      intervalMs: 10_000,
      resources: 2,
      windowMs: 3000,
    };
    expect(pollTimes(input.intervalMs, input.windowMs)).toEqual([0]);
    const result = simulateWithChanges(input, [change(0, 100, 60), change(1, 200, 70)]);
    expect(result.polling.requests).toBe(2);
    expect(result.polling.latenciesMs).toEqual([]);
    expect(result.events.latenciesMs).toEqual([60, 70]);
    expect(result.events.requests).toBe(2);
  });

  it('changes polling request count when the interval changes', () => {
    const base: SimulateInput = {
      seed: 7,
      intervalMs: 1000,
      resources: 2,
      windowMs: 10_000,
    };
    const changes = planChanges(base);
    const fast = simulateWithChanges(base, changes);
    const slow = simulateWithChanges({ ...base, intervalMs: 5000 }, changes);
    expect(fast.polling.requests).toBeGreaterThan(slow.polling.requests);
    expect(fast.events.requests).toBe(slow.events.requests);
  });

  it('counts event delivery delay even if push lands after the window', () => {
    const input: SimulateInput = {
      seed: 1,
      intervalMs: 1000,
      resources: 1,
      windowMs: 1000,
    };
    const result = simulateWithChanges(input, [change(0, 1000, 250)]);
    expect(result.events.latenciesMs).toEqual([250]);
    expect(result.events.timeline.some((entry) => entry.kind === 'push' && entry.timeMs === 1250)).toBe(
      true,
    );
  });
});
