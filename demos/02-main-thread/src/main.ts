import '@demos/theme/theme.css';
import './style.css';
import { JankMeter } from './jank';
import {
  analyzeCorpus,
  buildCorpus,
  type Analysis,
  type WorkerResponse,
} from './workload';

const copiesInput = required<HTMLInputElement>('#copies');
const roundsInput = required<HTMLInputElement>('#rounds');
const corpusNote = required<HTMLElement>('#corpus');
const shuttle = required<HTMLElement>('#shuttle');
const track = required<HTMLElement>('#track');
const canvas = required<HTMLCanvasElement>('#frames');
const framesSummary = required<HTMLElement>('#frames-summary');
const frameNow = required<HTMLElement>('#frame-now');
const frameMax = required<HTMLElement>('#frame-max');
const longTasks = required<HTMLElement>('#long-tasks');
const runMainButton = required<HTMLButtonElement>('#run-main');
const runWorkerButton = required<HTMLButtonElement>('#run-worker');
const compareButton = required<HTMLButtonElement>('#compare');
const resetButton = required<HTMLButtonElement>('#reset');
const showMotion = required<HTMLInputElement>('#show-motion');
const motionNote = required<HTMLElement>('#motion-note');
const transferBefore = required<HTMLElement>('#transfer-before');
const transferAfter = required<HTMLElement>('#transfer-after');
const comparison = required<HTMLElement>('#comparison');
const runLine = required<HTMLElement>('#run-line');
const runFlag = required<HTMLElement>('#run-flag');
const runState = required<HTMLElement>('#run-state');
const takeaway = required<HTMLElement>('#takeaway');
const mainVerdict = required<HTMLElement>('#main-verdict');
const workerVerdict = required<HTMLElement>('#worker-verdict');

const context = canvas.getContext('2d');
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

let busy = false;
let runId = 0;
let trackWidth = 0;
let mainChecksum: number | null = null;
let workerChecksum: number | null = null;
let mainFrameMs: number | null = null;
let workerFrameMs: number | null = null;
let cachedCopies = -1;
let cachedText = '';
let summaryAt = 0;

if (motionQuery.matches) {
  showMotion.checked = false;
  motionNote.hidden = false;
}

const meter = new JankMeter((sample) => {
  frameNow.textContent = `${sample.latestMs.toFixed(1)} ms`;
  frameMax.textContent = `${sample.maxWindowMs.toFixed(1)} ms`;
  longTasks.textContent = meter.supportsLongTask ? String(sample.longTasks) : 'indisponível';
  moveShuttle(performance.now());
  drawFrames(sample.samples);
  const now = performance.now();
  if (now - summaryAt > 250) {
    summaryAt = now;
    describeFrames(sample.latestMs, sample.maxWindowMs, sample.longTasks);
  }
});

applyQuery();
copiesInput.addEventListener('input', () => {
  refreshCorpus();
  syncQuery(currentMode());
});
roundsInput.addEventListener('input', () => {
  refreshCorpus();
  syncQuery(currentMode());
});
showMotion.addEventListener('change', () => {
  if (!showMotion.checked) shuttle.style.transform = 'translateX(0px)';
});
runMainButton.addEventListener('click', () => {
  syncQuery('principal');
  runOnMain();
});
runWorkerButton.addEventListener('click', () => {
  syncQuery('worker');
  runOnWorker();
});
compareButton.addEventListener('click', () => {
  syncQuery('comparar');
  runOnMain(() => runOnWorker());
});
resetButton.addEventListener('click', reset);
window.addEventListener('resize', () => {
  trackWidth = track.clientWidth;
});

refreshCorpus();
trackWidth = track.clientWidth;

const initialMode = new URLSearchParams(location.search).get('modo');
if (initialMode === 'principal') runOnMain();
else if (initialMode === 'worker') runOnWorker();
else if (initialMode === 'comparar') runOnMain(() => runOnWorker());

function runOnMain(onDone?: () => void): void {
  if (busy) return;
  const id = ++runId;
  setBusy(true);
  const text = currentCorpus();
  const rounds = readRounds();
  meter.startMark();
  const started = performance.now();
  const result = analyzeCorpus(text, rounds);
  const cpuMs = performance.now() - started;
  // The frame that was already queued keeps a timestamp from before the block.
  // The spike shows up on the frame after that, so I read the mark one frame later.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (id !== runId) return;
      const mark = meter.endMark();
      mainChecksum = result.checksum;
      mainFrameMs = mark.maxFrameMs;
      paintResult('main', result, cpuMs, mark.maxFrameMs, mark.longTasks);
      setBusy(false);
      onDone?.();
    });
  });
}

function runOnWorker(): void {
  if (busy) return;
  const id = ++runId;
  setBusy(true);
  const text = currentCorpus();
  const rounds = readRounds();
  const encoded = new TextEncoder().encode(text);
  transferBefore.textContent = `${encoded.byteLength} bytes`;
  meter.startMark();
  const started = performance.now();
  const buffer = encoded.buffer;
  worker.postMessage({ buffer, rounds }, [buffer]);
  transferAfter.textContent = `${encoded.byteLength} bytes`;

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    if (id !== runId) return;
    const cpuMs = event.data.elapsedMs;
    const wallMs = performance.now() - started;
    workerChecksum = event.data.checksum;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (id !== runId) return;
        const mark = meter.endMark();
        workerFrameMs = mark.maxFrameMs;
        paintResult('worker', event.data, cpuMs, mark.maxFrameMs, mark.longTasks, wallMs);
        setBusy(false);
      });
    });
  };
  worker.onerror = () => {
    if (id !== runId) return;
    meter.endMark();
    required<HTMLElement>('#worker-cpu').textContent = 'falhou';
    setRun('error', 'Erro', 'Falhou');
    setText(takeaway, 'O Worker falhou. Tente de novo.');
    setBusy(false);
  };
}

function reset(): void {
  runId += 1;
  meter.endMark();
  busy = false;
  mainChecksum = null;
  workerChecksum = null;
  mainFrameMs = null;
  workerFrameMs = null;
  copiesInput.value = '280';
  roundsInput.value = '8000';
  refreshCorpus();
  for (const id of ['main-cpu', 'main-frame', 'main-long', 'main-words', 'main-checksum', 'worker-cpu', 'worker-frame', 'worker-long', 'worker-words', 'worker-checksum', 'transfer-before', 'transfer-after']) {
    required<HTMLElement>(`#${id}`).textContent = 'ainda não';
  }
  setText(mainVerdict, 'Aguardando');
  mainVerdict.className = 'verdict';
  setText(workerVerdict, 'Aguardando');
  workerVerdict.className = 'verdict';
  setText(takeaway, '');
  setRun('idle', 'Parado', 'Pronto');
  setBusy(false);
  history.replaceState(null, '', location.pathname);
}

function paintResult(
  side: 'main' | 'worker',
  result: Analysis,
  cpuMs: number,
  frameMs: number,
  longTaskCount: number,
  wallMs?: number,
): void {
  required<HTMLElement>(`#${side}-cpu`).textContent =
    side === 'worker' && wallMs !== undefined
      ? `${cpuMs.toFixed(0)} ms no worker, ${wallMs.toFixed(0)} ms até voltar`
      : `${cpuMs.toFixed(0)} ms`;
  required<HTMLElement>(`#${side}-frame`).textContent = `${frameMs.toFixed(1)} ms`;
  required<HTMLElement>(`#${side}-long`).textContent = meter.supportsLongTask
    ? String(longTaskCount)
    : 'indisponível';
  required<HTMLElement>(`#${side}-words`).textContent = `${result.words} palavras, ${result.unique} únicas`;
  const checksum = required<HTMLElement>(`#${side}-checksum`);
  checksum.textContent = String(result.checksum);
  if (mainChecksum !== null && workerChecksum !== null && side === 'worker') {
    checksum.textContent = `${result.checksum} (igual ao thread principal: ${mainChecksum === workerChecksum ? 'sim' : 'não'})`;
  }
  if (mainChecksum !== null && workerChecksum !== null && side === 'main') {
    checksum.textContent = `${result.checksum} (igual ao worker: ${mainChecksum === workerChecksum ? 'sim' : 'não'})`;
  }
  paintTakeaway();
}

function paintTakeaway(): void {
  if (mainFrameMs === null && workerFrameMs === null) {
    setText(takeaway, '');
    return;
  }
  if (mainFrameMs !== null && workerFrameMs !== null) {
    setRun('done', 'Feito', 'Concluído');
    setText(
      takeaway,
      `No thread principal o pior frame levou ${mainFrameMs.toFixed(1)} ms; no Worker, ${workerFrameMs.toFixed(1)} ms.`,
    );
    if (mainFrameMs > workerFrameMs) {
      setVerdict(mainVerdict, 'Pior para a tela', 'verdict--bad');
      setVerdict(workerVerdict, 'Melhor para a tela', 'verdict--good');
    } else if (workerFrameMs > mainFrameMs) {
      setVerdict(mainVerdict, 'Melhor para a tela', 'verdict--good');
      setVerdict(workerVerdict, 'Pior para a tela', 'verdict--bad');
    } else {
      setVerdict(mainVerdict, 'Igual', '');
      setVerdict(workerVerdict, 'Igual', '');
    }
    return;
  }
  setRun('done', 'Feito', 'Concluído');
  if (mainFrameMs !== null) {
    setText(takeaway, `No thread principal o pior frame levou ${mainFrameMs.toFixed(1)} ms. Falta o Worker para comparar.`);
    setVerdict(mainVerdict, 'Medido', '');
    return;
  }
  setText(takeaway, `No Worker o pior frame levou ${workerFrameMs?.toFixed(1) ?? '0'} ms. Falta o thread principal para comparar.`);
  setVerdict(workerVerdict, 'Medido', '');
}

function moveShuttle(now: number): void {
  if (!showMotion.checked) {
    shuttle.style.transform = 'translateX(0px)';
    return;
  }
  const width = trackWidth || track.clientWidth;
  const travel = Math.max(0, width - 64);
  const x = (now / 8) % (travel + 1);
  shuttle.style.transform = `translateX(${x}px)`;
}

let framePalette: { ok: string; mid: string; bad: string } | null = null;

function frameColor(ms: number): string {
  if (!framePalette) {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string): string =>
      styles.getPropertyValue(name).trim() || fallback;
    framePalette = {
      ok: read('--signal', '#3fd4e6'),
      mid: read('--warning', '#ffb547'),
      bad: read('--danger', '#ff6b5a'),
    };
  }
  if (ms > 32) return framePalette.bad;
  if (ms > 20) return framePalette.mid;
  return framePalette.ok;
}

function describeFrames(latestMs: number, maxWindowMs: number, longTaskCount: number): void {
  const band =
    maxWindowMs > 32 ? 'acima de 32 ms, travado' : maxWindowMs > 20 ? 'até 32 ms, apertado' : 'até 20 ms, fluido';
  const tasks = meter.supportsLongTask ? `${longTaskCount} long tasks` : 'long tasks indisponíveis';
  setText(
    framesSummary,
    `Frame atual ${latestMs.toFixed(1)} ms. Pior recente ${maxWindowMs.toFixed(1)} ms, ${band}. ${tasks}.`,
  );
}

function drawFrames(samples: readonly number[]): void {
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  const barWidth = width / 60;
  const offset = 60 - samples.length;
  for (let index = 0; index < samples.length; index += 1) {
    const ms = samples[index] ?? 0;
    const barHeight = Math.min(height, (ms / 48) * height);
    context.fillStyle = frameColor(ms);
    context.fillRect((offset + index) * barWidth, height - barHeight, Math.max(1, barWidth - 2), barHeight);
  }
}

function refreshCorpus(): void {
  const text = currentCorpus();
  corpusNote.textContent = `${text.length} caracteres, ${readRounds()} rodadas. Eu gero o texto antes da medição. O tempo mostrado é só tokenizar e hashear.`;
}

function currentCorpus(): string {
  const copies = readCopies();
  if (copies !== cachedCopies) {
    cachedText = buildCorpus(copies);
    cachedCopies = copies;
  }
  return cachedText;
}

function readCopies(): number {
  return clamp(Number(copiesInput.value), 20, 4_000, 280);
}

function readRounds(): number {
  return clamp(Number(roundsInput.value), 1, 20_000, 8_000);
}

function setBusy(value: boolean): void {
  busy = value;
  runMainButton.disabled = value;
  runWorkerButton.disabled = value;
  compareButton.disabled = value;
  comparison.setAttribute('aria-busy', value ? 'true' : 'false');
  if (value) setRun('running', 'Rodando', 'Em andamento');
}

function applyQuery(): void {
  const query = new URLSearchParams(location.search);
  const copies = query.get('copias');
  const rounds = query.get('rodadas');
  if (copies !== null) copiesInput.value = copies;
  if (rounds !== null) roundsInput.value = rounds;
}

function currentMode(): string | null {
  return new URLSearchParams(location.search).get('modo');
}

function syncQuery(modo: string | null): void {
  const params = new URLSearchParams();
  if (modo) params.set('modo', modo);
  if (copiesInput.value !== '280') params.set('copias', copiesInput.value);
  if (roundsInput.value !== '8000') params.set('rodadas', roundsInput.value);
  const search = params.toString();
  const next = search ? `${location.pathname}?${search}` : location.pathname;
  if (`${location.pathname}${location.search}` !== next) history.replaceState(null, '', next);
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

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function required<T extends Element>(selector: string): T {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Elemento ausente: ${selector}`);
  return element as T;
}
