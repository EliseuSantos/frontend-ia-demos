import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { encodeSse, isAbort, mockEvents, parseMockRequest, sleep } from '@demos/mock-stream';

export function mockStreamPlugin(): Plugin {
  return {
    name: 'mock-stream',
    configureServer(server) {
      server.middlewares.use('/api/stream', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        void handle(req, res);
      });
    },
  };
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const abort = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });

  try {
    const request = parseMockRequest(await readBody(req));
    if (request.connectDelayMs > 0) await sleep(request.connectDelayMs, abort.signal);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    for await (const event of mockEvents(request, abort.signal)) {
      if (abort.signal.aborted) break;
      res.write(encodeSse(event.event, event.data));
    }
    res.end();
  } catch (error) {
    if (isAbort(error) || res.writableEnded) {
      if (!res.writableEnded) res.end();
      return;
    }
    if (!res.headersSent) {
      res.statusCode = 400;
      res.end(error instanceof Error ? error.message : 'pedido inválido');
      return;
    }
    res.end();
  }
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  return JSON.parse(text) as unknown;
}
