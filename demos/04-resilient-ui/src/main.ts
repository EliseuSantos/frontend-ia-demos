import '../../../styles/base.css';
import { launchSession, streamMode, type RunnerParams } from './runner';
import type { Phase, SessionState } from './machine';

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'pronto',
  connecting: 'conectando',
  streaming: 'recebendo',
  stalled: 'pausa',
  retrying: 'tentando de novo',
  failed: 'falhou',
  done: 'concluído',
};

const promptInput = required<HTMLTextAreaElement>('#prompt');
const scenario = required<HTMLSelectElement>('#scenario');
const disconnectInput = required<HTMLInputElement>('#disconnect-at');
const stallAtInput = required<HTMLInputElement>('#stall-at');
const stallMsInput = required<HTMLInputElement>('#stall-ms');
const attemptsInput = required<HTMLInputElement>('#attempts');
const sendButton = required<HTMLButtonElement>('#send');
const cancelButton = required<HTMLButtonElement>('#cancel');
const phaseEl = required<HTMLElement>('#phase');
const phaseLabel = required<HTMLElement>('#phase-label');
const attemptEl = required<HTMLElement>('#attempt');
const pendingEl = required<HTMLElement>('#pending');
const pausesEl = required<HTMLElement>('#pauses');
const offlineEl = required<HTMLElement>('#offline');
const output = required<HTMLElement>('#output');
const errorEl = required<HTMLElement>('#error');
const logEl = required<HTMLElement>('#log');
const modeEl = required<HTMLElement>('#mode');

const mode = streamMode();
modeEl.textContent = mode === 'server' ? 'servidor local' : 'simulação no navegador';

let generation = 0;
let active: { cancel: () => void } | null = null;
let pauses = 0;
let wasPaused = false;

scenario.addEventListener('change', applyScenario);
sendButton.addEventListener('click', send);
cancelButton.addEventListener('click', () => active?.cancel());

render(idleState(), []);

function send(): void {
  const id = ++generation;
  pauses = 0;
  wasPaused = false;
  active?.cancel();
  active = launchSession(readParams(), (state, log) => {
    if (id !== generation) return;
    if (state.paused && !wasPaused) pauses += 1;
    wasPaused = state.paused;
    render(state, log);
  });
}

function render(state: SessionState, log: readonly string[]): void {
  phaseEl.textContent = state.phase;
  phaseEl.dataset.phase = state.phase;
  phaseLabel.textContent = PHASE_LABEL[state.phase];
  attemptEl.textContent = String(state.attempt);
  pendingEl.textContent = String(state.pending);
  pausesEl.textContent = String(pauses);
  offlineEl.textContent = state.offline ? 'offline' : 'online';
  if (output.textContent !== state.text) output.textContent = state.text;
  errorEl.textContent = state.error ?? '';
  logEl.textContent = log.join('\n');
  const running = state.phase === 'connecting' || state.phase === 'streaming' || state.phase === 'stalled' || state.phase === 'retrying';
  output.classList.toggle('is-streaming', running);
  sendButton.disabled = running;
  cancelButton.disabled = !running;
}

function readParams(): RunnerParams {
  return {
    prompt: promptInput.value,
    stallMs: clamp(Number(stallMsInput.value), 0, 10_000, 400),
    stallAt: optionalIndex(stallAtInput.value),
    disconnectAt: optionalIndex(disconnectInput.value),
    maxAttempts: clamp(Number(attemptsInput.value), 1, 6, 3),
    mode,
  };
}

function applyScenario(): void {
  if (scenario.value === 'drop') {
    disconnectInput.value = '10';
    stallAtInput.value = '';
    stallMsInput.value = '400';
    return;
  }
  if (scenario.value === 'stall') {
    disconnectInput.value = '';
    stallAtInput.value = '6';
    stallMsInput.value = '2500';
    return;
  }
  disconnectInput.value = '';
  stallAtInput.value = '';
  stallMsInput.value = '400';
}

function idleState(): SessionState {
  return {
    phase: 'idle',
    text: '',
    tokens: [],
    received: 0,
    attempt: 0,
    maxAttempts: 3,
    error: null,
    pending: 0,
    paused: false,
    offline: false,
    highWatermark: 16,
    lowWatermark: 6,
  };
}

function optionalIndex(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element as T;
}
