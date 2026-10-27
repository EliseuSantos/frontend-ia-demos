import { analyzeCorpus, type WorkerRequest, type WorkerResponse } from './workload';

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void;
  postMessage(message: WorkerResponse): void;
}

const scope = self as unknown as WorkerScope;

scope.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const text = new TextDecoder().decode(event.data.buffer);
  const started = performance.now();
  const result = analyzeCorpus(text, event.data.rounds);
  scope.postMessage({ ...result, elapsedMs: performance.now() - started });
});
