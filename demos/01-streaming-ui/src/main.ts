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

const DEFAULT_PROMPT =
  'Explique, em poucas frases, por que uma interface não deve esperar o modelo terminar.';

const promptInput = required<HTMLTextAreaElement>('#prompt');
const latencyInput = required<HTMLInputElement>('#latency');
const stallChanceInput = required<HTMLInputElement>('#stall-chance');
const stallMsInput = required<HTMLInputElement>('#stall-ms');
const disconnectInput = required<HTMLInputElement>('#disconnect-at');
const burstInput = required<HTMLInputElement>('#burst');
const sendButton = required<HTMLButtonElement>('#send');
const resetButton = required<HTMLButtonElement>('#reset');
const cancelButton = required<HTMLButtonElement>('#cancel');
const output = required<HTMLElement>('#output');
const statusEl = required<HTMLElement>('#status');
const attemptEl = required<HTMLElement>('#attempt');
const receivedEl = required<HTMLElement>('#received');
const writesEl = required<HTMLElement>('#writes');
const naiveWrites = required<HTMLElement>('#naive-writes');
const batchedWrites = required<HTMLElement>('#batched-writes');
const naiveVerdict = required<HTMLElement>('#naive-verdict');
const batchedVerdict = required<HTMLElement>('#batched-verdict');
const errorEl = required<HTMLElement>('#error');
const modeEl = required<HTMLElement>('#mode');
const providerNote = required<HTMLElement>('#provider-note');
const runLine = required<HTMLElement>('#run-line');
const runFlag = required<HTMLElement>('#run-flag');
const runState = required<HTMLElement>('#run-state');
const takeaway = required<HTMLElement>('#takeaway');

const mode = streamMode();
modeEl.textContent = modeLabel(mode);
modeEl.dataset.mode = mode;
providerNote.hidden = mode !== 'provider';

let active: { cancel: () => void } | null = null;

applyQuery();

sendButton.addEventListener('click', send);
resetButton.addEventListener('click', reset);
cancelButton.addEventListener('click', () => active?.cancel());
for (const input of [latencyInput, stallChanceInput, stallMsInput, disconnectInput, burstInput]) {
  input.addEventListener('input', syncQuery);
}
promptInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    send();
  }
});

render(idleView());

function send(): void {
  active?.cancel();
  output.textContent = '';
  syncQuery();
  active = startStream(readSettings(), mode, {
    onReset: () => {
      output.textContent = '';
    },
    onChunk: (chunk) => {
      if (!active) return;
      output.append(chunk);
    },
    onView: render,
  });
}

function reset(): void {
  active?.cancel();
  active = null;
  promptInput.value = DEFAULT_PROMPT;
  latencyInput.value = '15';
  burstInput.value = '8';
  stallChanceInput.value = '0';
  stallMsInput.value = '500';
  disconnectInput.value = '';
  output.textContent = '';
  history.replaceState(null, '', location.pathname);
  render(idleView());
}

function render(view: StreamView): void {
  statusEl.textContent = STATUS_LABEL[view.status];
  statusEl.dataset.phase = view.status;
  attemptEl.textContent = String(view.attempt);
  receivedEl.textContent = String(view.received);
  writesEl.textContent = String(view.domWrites);
  naiveWrites.textContent = String(view.received);
  batchedWrites.textContent = String(view.domWrites);
  errorEl.textContent = view.error ?? '';
  const running =
    view.status === 'connecting' ||
    view.status === 'streaming' ||
    view.status === 'stalled' ||
    view.status === 'retrying';
  output.classList.toggle('is-streaming', running);
  output.setAttribute('aria-busy', running ? 'true' : 'false');
  sendButton.disabled = running;
  cancelButton.disabled = !running;
  paintVerdict(view);
  paintLive(view);
}

function paintVerdict(view: StreamView): void {
  const finished = view.status === 'done' || view.status === 'cancelled' || view.status === 'error';
  if (!finished) {
    setVerdict(naiveVerdict, 'Uma pintura por pedaço', '');
    setVerdict(batchedVerdict, 'Uma pintura por frame', '');
    return;
  }
  if (view.received > view.domWrites) {
    setVerdict(naiveVerdict, 'Pior, mais escritas', 'verdict--bad');
    setVerdict(batchedVerdict, 'Melhor, menos escritas', 'verdict--good');
    return;
  }
  setVerdict(naiveVerdict, 'Igual neste caso', '');
  setVerdict(batchedVerdict, 'Igual neste caso', '');
}

function paintLive(view: StreamView): void {
  if (view.status === 'idle') {
    setRun('idle', 'Parado', 'Pronto');
    setText(takeaway, '');
    return;
  }
  if (view.status === 'done') {
    setRun('done', 'Feito', 'Concluído');
    setText(
      takeaway,
      `Pintar a cada token escreveria ${view.received} vezes. No frame, escrevi ${view.domWrites}.`,
    );
    return;
  }
  if (view.status === 'cancelled') {
    setRun('idle', 'Parado', 'Cancelado');
    setText(
      takeaway,
      `Você cancelou. Até aqui, ${view.received} tokens viraram ${view.domWrites} escritas.`,
    );
    return;
  }
  if (view.status === 'error') {
    setRun('error', 'Erro', 'Falhou');
    setText(takeaway, 'O fluxo falhou antes de terminar.');
    return;
  }
  setRun('running', 'Rodando', 'Em andamento');
  setText(takeaway, '');
}

function setVerdict(element: HTMLElement, text: string, tone: string): void {
  setText(element, text);
  element.className = tone ? `verdict ${tone}` : 'verdict';
}

function setRun(state: 'idle' | 'running' | 'done' | 'error', flag: string, label: string): void {
  if (runLine.dataset.state !== state) runLine.dataset.state = state;
  setText(runFlag, flag);
  setText(runState, label);
}

function applyQuery(): void {
  const query = new URLSearchParams(location.search);
  const latencia = query.get('latencia');
  const rajada = query.get('rajada');
  const chance = query.get('chance');
  const pausa = query.get('pausa');
  const corte = query.get('corte');
  if (latencia !== null) latencyInput.value = latencia;
  if (rajada !== null) burstInput.value = rajada;
  if (chance !== null) stallChanceInput.value = chance;
  if (pausa !== null) stallMsInput.value = pausa;
  if (corte !== null) disconnectInput.value = corte;
}

function syncQuery(): void {
  const params = new URLSearchParams();
  params.set('latencia', latencyInput.value);
  params.set('rajada', burstInput.value);
  params.set('chance', stallChanceInput.value);
  params.set('pausa', stallMsInput.value);
  if (disconnectInput.value.trim() !== '') params.set('corte', disconnectInput.value.trim());
  const next = `${location.pathname}?${params.toString()}`;
  if (`${location.pathname}${location.search}` !== next) history.replaceState(null, '', next);
}

function idleView(): StreamView {
  return {
    status: 'idle',
    error: null,
    attempt: 0,
    maxAttempts: 4,
    received: 0,
    domWrites: 0,
    retryInMs: null,
  };
}

function readSettings() {
  return {
    prompt: promptInput.value,
    latencyMs: clamp(Number(latencyInput.value), 0, 2_000, 15),
    stallChance: clamp(Number(stallChanceInput.value), 0, 100, 0) / 100,
    stallMs: clamp(Number(stallMsInput.value), 0, 10_000, 500),
    disconnectAt: optionalIndex(disconnectInput.value),
    burst: clamp(Number(burstInput.value), 1, 40, 8),
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

function setText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element as T;
}
