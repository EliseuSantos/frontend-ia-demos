import '@demos/theme/theme.css';
import './style.css';
import {
  DEFAULT_SCENARIO,
  simulate,
  type SimulateInput,
  type SimulateResult,
  type TimelineEntry,
} from './simulate';

const INTERVAL_OPTIONS = new Set([1000, 2000, 5000, 10_000]);
const WINDOW_MS = DEFAULT_SCENARIO.windowMs;

const seedInput = required<HTMLInputElement>('#seed');
const intervalSelect = required<HTMLSelectElement>('#interval');
const resourcesInput = required<HTMLInputElement>('#resources');
const runButton = required<HTMLButtonElement>('#run');
const instantButton = required<HTMLButtonElement>('#instant');
const resetButton = required<HTMLButtonElement>('#reset');
const clockEl = required<HTMLElement>('[data-testid="clock"]');
const scoreEl = required<HTMLElement>('[data-testid="score"]');
const pollingLog = required<HTMLOListElement>('#polling-log');
const eventsLog = required<HTMLOListElement>('#events-log');

let raf = 0;
let animating = false;

applyControls(readControlsFromUrl());
clearResults();

runButton.addEventListener('click', () => {
  void startAnimated(readControlsFromForm());
});
instantButton.addEventListener('click', () => {
  stopAnimation();
  const input = readControlsFromForm();
  shareState(input);
  renderResult(simulate(input), input.windowMs);
});
resetButton.addEventListener('click', () => {
  stopAnimation();
  applyControls({ ...DEFAULT_SCENARIO });
  shareState(DEFAULT_SCENARIO);
  clearResults();
});

for (const el of [seedInput, intervalSelect, resourcesInput]) {
  el.addEventListener('change', () => {
    shareState(readControlsFromForm());
  });
}

function startAnimated(input: SimulateInput): void {
  stopAnimation();
  shareState(input);
  const result = simulate(input);
  animating = true;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    renderResult(result, input.windowMs);
    animating = false;
    return;
  }

  clearResults();
  scoreEl.dataset.ready = 'false';
  const durationRealMs = 2400;
  const started = performance.now();

  const tick = (now: number): void => {
    if (!animating) return;
    const progress = Math.min(1, (now - started) / durationRealMs);
    const simTime = Math.floor(progress * input.windowMs);
    clockEl.textContent = `Relógio: ${simTime} ms`;
    renderLogsUntil(result, simTime);
    if (progress >= 1) {
      renderResult(result, input.windowMs);
      animating = false;
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function stopAnimation(): void {
  animating = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function renderResult(result: SimulateResult, windowMs: number): void {
  clockEl.textContent = `Relógio: ${windowMs} ms`;
  renderLogsUntil(result, Number.POSITIVE_INFINITY);
  writeScore(result);
}

function renderLogsUntil(result: SimulateResult, untilMs: number): void {
  fillLog(pollingLog, result.polling.timeline.filter((entry) => entry.timeMs <= untilMs));
  fillLog(eventsLog, result.events.timeline.filter((entry) => entry.timeMs <= untilMs));
}

function fillLog(list: HTMLOListElement, entries: TimelineEntry[]): void {
  list.replaceChildren();
  if (entries.length === 0) {
    list.dataset.empty = 'true';
    return;
  }
  list.dataset.empty = 'false';
  for (const entry of entries) {
    const item = document.createElement('li');
    if (entry.wasted) item.dataset.wasted = 'true';
    item.textContent = formatEntry(entry);
    list.append(item);
  }
}

function formatEntry(entry: TimelineEntry): string {
  const base = `t=${entry.timeMs}ms r${entry.resourceId} ${entry.kind} ${entry.detail}`;
  return entry.wasted ? `${base} (desperdicio)` : base;
}

function writeScore(result: SimulateResult): void {
  scoreEl.dataset.ready = 'true';
  setText('score-polling-requests', String(result.polling.requests));
  setText('score-events-requests', String(result.events.requests));
  setText(
    'score-avoided',
    `${result.requestsAvoided} (${formatPct(result.requestsAvoidedPct)})`,
  );
  setText('score-polling-wasted', String(result.polling.wasted));
  setText('score-polling-mean', formatLatency(result.polling.meanLatencyMs));
  setText('score-polling-max', formatLatency(result.polling.maxLatencyMs));
  setText('score-events-mean', formatLatency(result.events.meanLatencyMs));
  setText('score-events-max', formatLatency(result.events.maxLatencyMs));
}

function clearResults(): void {
  clockEl.textContent = 'Relógio: 0 ms';
  scoreEl.dataset.ready = 'false';
  for (const id of [
    'score-polling-requests',
    'score-events-requests',
    'score-avoided',
    'score-polling-wasted',
    'score-polling-mean',
    'score-polling-max',
    'score-events-mean',
    'score-events-max',
  ]) {
    setText(id, '-');
  }
  pollingLog.replaceChildren();
  eventsLog.replaceChildren();
  pollingLog.dataset.empty = 'true';
  eventsLog.dataset.empty = 'true';
}

function formatLatency(value: number | null): string {
  return value === null ? 'sem dados' : `${Math.round(value)} ms`;
}

function formatPct(value: number): string {
  return `${value}%`;
}

function setText(testId: string, value: string): void {
  required<HTMLElement>(`[data-testid="${testId}"]`).textContent = value;
}

function readControlsFromForm(): SimulateInput {
  return normalizeControls({
    seed: Number(seedInput.value),
    intervalMs: Number(intervalSelect.value),
    resources: Number(resourcesInput.value),
    windowMs: WINDOW_MS,
  });
}

function readControlsFromUrl(): SimulateInput {
  const params = new URLSearchParams(location.search);
  return normalizeControls({
    seed: Number(params.get('seed') ?? DEFAULT_SCENARIO.seed),
    intervalMs: Number(params.get('interval') ?? DEFAULT_SCENARIO.intervalMs),
    resources: Number(params.get('n') ?? DEFAULT_SCENARIO.resources),
    windowMs: WINDOW_MS,
  });
}

function normalizeControls(input: SimulateInput): SimulateInput {
  const seed = Number.isFinite(input.seed) ? Math.trunc(input.seed) : DEFAULT_SCENARIO.seed;
  const intervalMs = INTERVAL_OPTIONS.has(input.intervalMs)
    ? input.intervalMs
    : DEFAULT_SCENARIO.intervalMs;
  const resources = Number.isFinite(input.resources)
    ? Math.min(12, Math.max(1, Math.trunc(input.resources)))
    : DEFAULT_SCENARIO.resources;
  return { seed, intervalMs, resources, windowMs: WINDOW_MS };
}

function applyControls(input: SimulateInput): void {
  seedInput.value = String(input.seed);
  intervalSelect.value = String(input.intervalMs);
  resourcesInput.value = String(input.resources);
}

function shareState(input: SimulateInput): void {
  const params = new URLSearchParams();
  const isDefault =
    input.seed === DEFAULT_SCENARIO.seed &&
    input.intervalMs === DEFAULT_SCENARIO.intervalMs &&
    input.resources === DEFAULT_SCENARIO.resources;
  if (!isDefault) {
    params.set('seed', String(input.seed));
    params.set('interval', String(input.intervalMs));
    params.set('n', String(input.resources));
  }
  const query = params.toString();
  const next = query ? `${location.pathname}?${query}` : location.pathname;
  if (`${location.pathname}${location.search}` !== next) {
    history.replaceState(null, '', next);
  }
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element as T;
}
