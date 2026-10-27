export interface Article {
  id: string;
  title: string;
  text: string;
}

export const ARTICLES: readonly Article[] = [
  {
    id: 'frame',
    title: 'Rendering loop',
    text: 'The browser paints a frame, runs main-thread tasks, and only then accepts the next frame. A task longer than 50 ms becomes a long task and the animation stutters.',
  },
  {
    id: 'long-task',
    title: 'Long task',
    text: 'A long task is continuous main-thread work above 50 milliseconds. The symptom is a late frame, a click that waits, and a spike on the frame-time graph.',
  },
  {
    id: 'worker',
    title: 'Web Worker',
    text: 'A worker runs JavaScript off the thread that paints the screen. The interface stays responsive while a heavy parse or a large computation happens on the other side.',
  },
  {
    id: 'transfer',
    title: 'Transferable objects',
    text: 'An ArrayBuffer can be transferred to a worker. Ownership of the memory moves. On the main thread byteLength becomes 0, which avoids copying pixels, audio, or large weights.',
  },
  {
    id: 'stream',
    title: 'Token streaming',
    text: 'A model response arrives in pieces over SSE or a ReadableStream. The interface shows the text while it is still being generated instead of waiting for the final block.',
  },
  {
    id: 'abort',
    title: 'Cancel with AbortController',
    text: 'AbortController cancels an in-flight fetch. The stream reader stops, the server notices the disconnect, and the interface returns to a quiet state.',
  },
  {
    id: 'retry',
    title: 'Retry with backoff',
    text: 'If the stream drops halfway, I keep the index of the last token and try again. The wait doubles on each attempt so I do not hammer a server that is already unstable.',
  },
  {
    id: 'backpressure',
    title: 'Backpressure',
    text: 'When tokens arrive faster than the screen can paint them, I stop reading the network until the queue drains. The consumer sets the pace of the producer.',
  },
  {
    id: 'machine',
    title: 'Chat state machine',
    text: 'A streaming chat moves through idle, connecting, streaming, stalled, retrying, failed, and done. Timeout, disconnect, and offline are transitions, not scattered conditionals.',
  },
  {
    id: 'webgpu',
    title: 'WebGPU in the browser',
    text: 'WebGPU runs the model on the machine GPU. When the browser does not offer the API, the same ONNX model falls back to WASM. There is no inference server in between.',
  },
  {
    id: 'embedding',
    title: 'Embeddings and cosine search',
    text: 'An embedding turns a sentence into a vector. In-memory search compares the query with documents using cosine similarity. Close vectors mean the same topic, with no backend.',
  },
  {
    id: 'offline',
    title: 'Offline and timeout',
    text: 'With no network I do not pretend to be connecting. The state goes to failed. A connect timeout or a stall that lasts too long also gives up the current attempt and retries if any attempts remain.',
  },
];
