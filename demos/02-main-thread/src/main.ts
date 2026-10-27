import '../../../styles/base.css';
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
const frameNow = required<HTMLElement>('#frame-now');
const frameMax = required<HTMLElement>('#frame-max');
const longTasks = required<HTMLElement>('#long-tasks');
const runMainButton = required<HTMLButtonElement>('#run-main');
const runWorkerButton = required<HTMLButtonElement>('#run-worker');
const transferBefore = required<HTMLElement>('#transfer-before');
const transferAfter = required<HTMLElement>('#transfer-after');

const context = canvas.getContext('2d');
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

let busy = false;
let trackWidth = 0;
let mainChecksum: number | null = null;
let workerChecksum: number | null = null;
let cachedCopies = -1;
let cachedText = '';

const meter = new JankMeter((sample) => {
  frameNow.textContent = `${sample.latestMs.toFixed(1)} ms`;
  frameMax.textContent = `${sample.maxWindowMs.toFixed(1)} ms`;
  longTasks.textContent = meter.supportsLongTask
    ? String(sample.longTasks)
    : 'indisponível';
  moveShuttle(performance.now());
  drawFrames(sample.samples);
});

copiesInput.addEventListener('input', refreshCorpus);
roundsInput.addEventListener('input', refreshCorpus);
runMainButton.addEventListener('click', runOnMain);
runWorkerButton.addEventListener('click', runOnWorker);
window.addEventListener('resize', () => {
  trackWidth = track.clientWidth;
});

refreshCorpus();
trackWidth = track.clientWidth;

function runOnMain(): void {
  if (busy) return;
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
      const mark = meter.endMark();
      mainChecksum = result.checksum;
      paintResult('main', result, cpuMs, mark.maxFrameMs, mark.longTasks);
      setBusy(false);
    });
  });
}

function runOnWorker(): void {
  if (busy) return;
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
    const cpuMs = event.data.elapsedMs;
    const wallMs = performance.now() - started;
    workerChecksum = event.data.checksum;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const mark = meter.endMark();
        paintResult('worker', event.data, cpuMs, mark.maxFrameMs, mark.longTasks, wallMs);
        setBusy(false);
      });
    });
  };
  worker.onerror = () => {
    meter.endMark();
    required<HTMLElement>('#worker-cpu').textContent = 'falhou';
    setBusy(false);
  };
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
}

function moveShuttle(now: number): void {
  const width = trackWidth || track.clientWidth;
  const travel = Math.max(0, width - 64);
  const x = (now / 8) % (travel + 1);
  shuttle.style.transform = `translateX(${x}px)`;
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
    context.fillStyle = ms > 32 ? '#c4552a' : ms > 20 ? '#e0b15a' : '#7dcec6';
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
