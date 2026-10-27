import '@demos/theme/theme.css';
import './style.css';
import { modeLabel, startStream, streamMode, type StreamStatus, type StreamView } from './session';

const STATUS_LABEL: Record<StreamStatus, string> = {
  idle: 'pronto',
  connecting: 'conectando',
  streaming: 'recebendo',
  stalled: 'pausa',
  retrying: 'tentando de novo',
  done: 'concluído',
  cancelled: 'cancelado',
  error: 'falhou',
};

const promptInput = required<HTMLTextAreaElement>('#prompt');
const latencyInput = required<HTMLInputElement>('#latency');
const stallChanceInput = required<HTMLInputElement>('#stall-chance');
const stallMsInput = required<HTMLInputElement>('#stall-ms');
const disconnectInput = required<HTMLInputElement>('#disconnect-at');
const burstInput = required<HTMLInputElement>('#burst');
const sendButton = required<HTMLButtonElement>('#send');
const cancelButton = required<HTMLButtonElement>('#cancel');
const output = required<HTMLElement>('#output');
const statusEl = required<HTMLElement>('#status');
const attemptEl = required<HTMLElement>('#attempt');
const receivedEl = required<HTMLElement>('#received');
const writesEl = required<HTMLElement>('#writes');
const errorEl = required<HTMLElement>('#error');
const modeEl = required<HTMLElement>('#mode');
const providerNote = required<HTMLElement>('#provider-note');

const mode = streamMode();
modeEl.textContent = modeLabel(mode);
modeEl.dataset.mode = mode;
providerNote.hidden = mode !== 'provider';

let active: { cancel: () => void } | null = null;

sendButton.addEventListener('click', send);
cancelButton.addEventListener('click', () => active?.cancel());
promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    send();
  }
});

render({
  status: 'idle',
  error: null,
  attempt: 0,
  maxAttempts: 4,
  received: 0,
  domWrites: 0,
  retryInMs: null,
});

function send(): void {
  active?.cancel();
  output.textContent = '';
  active = startStream(readSettings(), mode, {
    onReset: () => {
      output.textContent = '';
    },
    onChunk: (chunk) => {
      output.append(chunk);
    },
    onView: render,
  });
}

function render(view: StreamView): void {
  statusEl.textContent = STATUS_LABEL[view.status];
  statusEl.dataset.phase = view.status;
  attemptEl.textContent = String(view.attempt);
  receivedEl.textContent = String(view.received);
  writesEl.textContent = String(view.domWrites);
  errorEl.textContent = view.error ?? '';
  const running =
    view.status === 'connecting' ||
    view.status === 'streaming' ||
    view.status === 'stalled' ||
    view.status === 'retrying';
  output.classList.toggle('is-streaming', running);
  sendButton.disabled = running;
  cancelButton.disabled = !running;
}

function readSettings() {
  return {
    prompt: promptInput.value,
    latencyMs: clamp(Number(latencyInput.value), 0, 2_000, 20),
    stallChance: clamp(Number(stallChanceInput.value), 0, 100, 0) / 100,
    stallMs: clamp(Number(stallMsInput.value), 0, 10_000, 400),
    disconnectAt: optionalIndex(disconnectInput.value),
    burst: clamp(Number(burstInput.value), 1, 40, 3),
    connectDelayMs: 0,
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
  return Math.min(max, Math.max(min, value));
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element as T;
}
