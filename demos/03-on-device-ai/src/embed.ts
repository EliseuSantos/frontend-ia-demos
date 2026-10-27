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

export async function loadEmbedder(onProgress: (line: string) => void): Promise<LoadedEmbedder> {
  onProgress('Carregando a biblioteca...');
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  const wasm = env.backends.onnx.wasm;
  if (wasm && !globalThis.crossOriginIsolated) {
    wasm.numThreads = 1;
  }

  if (await hasWebGPU()) {
    try {
      onProgress('Tentando WebGPU...');
      return await create(pipeline, 'webgpu', 'fp16', onProgress);
    } catch (error) {
      console.warn('WebGPU falhou, vou para WASM.', error);
      onProgress('WebGPU não ficou pronto. Indo para WASM...');
    }
  } else {
    onProgress('Este navegador não ofereceu WebGPU. Usando WASM...');
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
  onProgress: (line: string) => void,
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

function formatProgress(report: unknown): string {
  if (!report || typeof report !== 'object') return 'Carregando o modelo...';
  const record = report as { status?: unknown; file?: unknown; progress?: unknown };
  const file = typeof record.file === 'string' ? record.file : 'modelo';
  const status = typeof record.status === 'string' ? record.status : 'carregando';
  if (typeof record.progress === 'number') {
    return `${status}: ${file} (${Math.round(record.progress)}%)`;
  }
  return `${status}: ${file}`;
}
