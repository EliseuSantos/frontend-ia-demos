import type { PipelineType } from '@huggingface/transformers';

export const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

export interface LoadedEmbedder {
  backend: 'webgpu' | 'wasm';
  dtype: 'fp16' | 'q8';
  loadMs: number;
  embed: (text: string) => Promise<Float32Array>;
}

type FeaturePipeline = (
  texts: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array | ArrayLike<number> }>;

export interface ProgressUpdate {
  line: string;
  percent: number | null;
}

export async function loadEmbedder(
  onProgress: (update: ProgressUpdate) => void,
): Promise<LoadedEmbedder> {
  onProgress({ line: 'Carregando a biblioteca...', percent: null });
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  const wasm = env.backends.onnx.wasm;
  if (wasm && !globalThis.crossOriginIsolated) {
    wasm.numThreads = 1;
  }

  if (await hasWebGPU()) {
    try {
      onProgress({ line: 'Tentando WebGPU...', percent: null });
      return await create(pipeline, 'webgpu', 'fp16', onProgress);
    } catch (error) {
      console.warn('WebGPU falhou, vou para WASM.', error);
      onProgress({
        line: 'WebGPU não ficou pronto. O modelo segue em WASM, na CPU, com pesos q8. A busca continua neste aparelho. Só fica mais lenta do que na GPU.',
        percent: null,
      });
    }
  } else {
    onProgress({
      line: 'Este navegador não ofereceu WebGPU. O modelo vai rodar em WASM, na CPU, com pesos q8. A busca continua neste aparelho. Só fica mais lenta do que na GPU.',
      percent: null,
    });
  }

  return create(pipeline, 'wasm', 'q8', onProgress);
}

async function create(
  pipeline: (
    task: PipelineType,
    model: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>,
  device: 'webgpu' | 'wasm',
  dtype: 'fp16' | 'q8',
  onProgress: (update: ProgressUpdate) => void,
): Promise<LoadedEmbedder> {
  const started = performance.now();
  const extractor = (await pipeline('feature-extraction', MODEL_ID, {
    device,
    dtype,
    progress_callback: (report: unknown) => onProgress(formatProgress(report)),
  })) as FeaturePipeline;
  const loadMs = performance.now() - started;

  return {
    backend: device,
    dtype,
    loadMs,
    async embed(text: string) {
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const data = output.data;
      if (data instanceof Float32Array) return data;
      return Float32Array.from(data as ArrayLike<number>);
    },
  };
}

interface NavigatorWithGpu {
  gpu?: {
    requestAdapter: () => Promise<unknown>;
  };
}

async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as NavigatorWithGpu).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

function formatProgress(report: unknown): ProgressUpdate {
  if (!report || typeof report !== 'object') {
    return { line: 'Carregando o modelo...', percent: null };
  }
  const record = report as {
    status?: unknown;
    file?: unknown;
    progress?: unknown;
    loaded?: unknown;
    total?: unknown;
  };
  const file = typeof record.file === 'string' ? record.file : 'modelo';
  const status = statusLabel(typeof record.status === 'string' ? record.status : '');
  const percent = typeof record.progress === 'number' ? Math.round(record.progress) : null;
  const loaded = typeof record.loaded === 'number' ? record.loaded : null;
  const total = typeof record.total === 'number' ? record.total : null;
  const size =
    loaded !== null && total !== null && total > 0
      ? `${formatBytes(loaded)} de ${formatBytes(total)}`
      : null;
  let line = `${status}: ${file}`;
  if (percent !== null && size) line = `${status}: ${file}, ${percent}% (${size})`;
  else if (percent !== null) line = `${status}: ${file}, ${percent}%`;
  else if (size) line = `${status}: ${file} (${size})`;
  return { line, percent };
}

function statusLabel(status: string): string {
  if (status === 'initiate') return 'Preparando';
  if (status === 'download' || status === 'progress') return 'Baixando';
  if (status === 'done') return 'Arquivo pronto';
  if (status === 'ready') return 'Pronto';
  return 'Carregando';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
