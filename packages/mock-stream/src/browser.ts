import { mockEvents } from './generate.ts';
import { encodeSse } from './sse.ts';
import type { MockRequest } from './types.ts';

export function browserMockResponse(request: MockRequest, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const generator = mockEvents(request, signal);

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await generator.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(encodeSse(next.value.event, next.value.data)));
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      void generator.return(undefined);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
