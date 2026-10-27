import '@demos/theme/theme.css';
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

const DEFAULT_PROMPT = 'O que acontece se o stream cair no meio?';

const promptInput = required<HTMLTextAreaElement>('#prompt');
const scenario = required<HTMLSelectElement>('#scenario');
const disconnectInput = required<HTMLInputElement>('#disconnect-at');
const stallAtInput = required<HTMLInputElement>('#stall-at');
const stallMsInput = required<HTMLInputElement>('#stall-ms');
const attemptsInput = required<HTMLInputElement>('#attempts');
const sendButton = required<HTMLButtonElement>('#send');
const resetButton = required<HTMLButtonElement>('#reset');
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
const naiveVerdict = required<HTMLElement>('#naive-verdict');
const machineVerdict = required<HTMLElement>('#machine-verdict');
const naiveOutcome = required<HTMLElement>('#naive-outcome');
const machineOutcome = required<HTMLElement>('#machine-outcome');
const runLine = required<HTMLElement>('#run-line');
const runFlag = required<HTMLElement>('#run-flag');
const runState = required<HTMLElement>('#run-state');
const takeaway = required<HTMLElement>('#takeaway');

const mode = streamMode();
modeEl.textContent = mode === 'server' ? 'servidor local' : 'simulação no navegador';

let generation = 0;
let active: { cancel: () => void } | null = null;
let pauses = 0;
let wasPaused = false;

applyQuery();
scenario.addEventListener('change', () => {
  applyScenario();
  shareScenario();
});
sendButton.addEventListener('click', send);
resetButton.addEventListener('click', reset);
cancelButton.addEventListener('click', () => active?.cancel());

render(idleState(), []);

function send(): void {
  const id = ++generation;
  pauses = 0;
  wasPaused = false;
  active?.cancel();
  setText(takeaway, '');
  paintNaive();
  setText(machineOutcome, 'Em andamento.');
  setVerdict(machineVerdict, 'Acompanha a sessão', '');
  active = launchSession(readParams(), (state, log) => {
    if (id !== generation) return;
    if (state.paused && !wasPaused) pauses += 1;
    wasPaused = state.paused;
    render(state, log);
  });
}

function reset(): void {
  generation += 1;
  active?.cancel();
  active = null;
  pauses = 0;
  wasPaused = false;
  scenario.value = 'normal';
  promptInput.value = DEFAULT_PROMPT;
  disconnectInput.value = '';
  stallAtInput.value = '';
  stallMsInput.value = '400';
  attemptsInput.value = '3';
  output.textContent = '';
  history.replaceState(null, '', location.pathname);
  setText(naiveOutcome, 'Ainda não rodei.');
  setText(machineOutcome, 'Ainda não rodei.');
  setVerdict(naiveVerdict, 'Aguardando', '');
  setVerdict(machineVerdict, 'Aguardando', '');
  setText(takeaway, '');
  render(idleState(), []);
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
  const running =
    state.phase === 'connecting' ||
    state.phase === 'streaming' ||
    state.phase === 'stalled' ||
    state.phase === 'retrying';
  output.classList.toggle('is-streaming', running);
  output.setAttribute('aria-busy', running ? 'true' : 'false');
  sendButton.disabled = running;
  cancelButton.disabled = !running;
  paintLive(state);
}

function paintNaive(): void {
  if (navigator.onLine === false) {
    setText(naiveOutcome, 'Nada chegaria, porque não há rede.');
    setVerdict(naiveVerdict, 'Para na hora', 'verdict--bad');
    return;
  }
  if (scenario.value === 'drop') {
    setText(naiveOutcome, `O texto pararia no token ${disconnectInput.value || '10'}, pela metade.`);
    setVerdict(naiveVerdict, 'Para no meio', 'verdict--bad');
    return;
  }
  if (scenario.value === 'stall') {
    setText(naiveOutcome, 'A leitura pararia na pausa longa.');
    setVerdict(naiveVerdict, 'Trava na pausa', 'verdict--bad');
    return;
  }
  setText(naiveOutcome, 'Nada falha. O texto chegaria inteiro mesmo sem retry.');
  setVerdict(naiveVerdict, 'Chegaria inteiro', '');
}

function paintLive(state: SessionState): void {
  if (state.phase === 'idle') {
    setRun('idle', 'Parado', 'Pronto');
    return;
  }
  if (state.phase === 'done') {
    setRun('done', 'Feito', 'Concluído');
    setText(
      machineOutcome,
      state.attempt > 1
        ? `Retomou e terminou na tentativa ${state.attempt}.`
        : 'Terminou na tentativa 1, sem retomar.',
    );
    setVerdict(machineVerdict, state.attempt > 1 ? 'Recuperou' : 'Concluiu', 'verdict--good');
    if (scenario.value === 'drop') {
      setText(
        takeaway,
        `Sem tratar a falha, o corte no token ${disconnectInput.value} deixaria o texto pela metade. Com a máquina, a sessão terminou na tentativa ${state.attempt}.`,
      );
    } else if (scenario.value === 'stall') {
      setText(
        takeaway,
        `Sem tratar a falha, a pausa longa travaria a leitura. Com a máquina, o tempo estourou e a sessão terminou na tentativa ${state.attempt}.`,
      );
    } else {
      setText(takeaway, `O fluxo terminou na tentativa ${state.attempt}. A máquina não precisou retomar.`);
    }
    return;
  }
  if (state.phase === 'failed') {
    setRun('error', 'Erro', 'Falhou');
    setText(machineOutcome, 'Parou em falhou e mostrou o erro.');
    setVerdict(machineVerdict, 'Não finge sucesso', 'verdict--bad');
    setText(
      takeaway,
      state.offline
        ? 'Sem rede, a máquina foi para falhou. Ela não finge que o texto chegou.'
        : 'A máquina parou em falhou e deixou o motivo visível.',
    );
    return;
  }
  setRun('running', 'Rodando', 'Em andamento');
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

function applyQuery(): void {
  const mapped = mapScenario(new URLSearchParams(location.search).get('cenario'));
  if (!mapped) return;
  scenario.value = mapped;
  applyScenario();
  shareScenario();
}

function shareScenario(): void {
  const params = new URLSearchParams();
  params.set('cenario', scenarioParam(scenario.value));
  const next = `${location.pathname}?${params.toString()}`;
  if (`${location.pathname}${location.search}` !== next) history.replaceState(null, '', next);
}

function mapScenario(value: string | null): 'normal' | 'drop' | 'stall' | null {
  if (value === 'normal') return 'normal';
  if (value === 'queda' || value === 'drop') return 'drop';
  if (value === 'pausa' || value === 'stall') return 'stall';
  return null;
}

function scenarioParam(value: string): string {
  if (value === 'drop') return 'queda';
  if (value === 'stall') return 'pausa';
  return 'normal';
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

function setVerdict(element: HTMLElement, text: string, tone: string): void {
  setText(element, text);
  element.className = tone ? `verdict ${tone}` : 'verdict';
}

function setRun(state: 'idle' | 'running' | 'done' | 'error', flag: string, label: string): void {
  if (runLine.dataset.state !== state) runLine.dataset.state = state;
  setText(runFlag, flag);
  setText(runState, label);
}

function setText(element: HTMLElement, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element as T;
}
