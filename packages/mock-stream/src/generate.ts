import { buildTokens } from './script.ts';
import { sleep, mulberry32 } from './timing.ts';
import type { MockEvent, MockRequest } from './types.ts';

export async function* mockEvents(
  request: MockRequest,
  signal?: AbortSignal,
): AsyncGenerator<MockEvent> {
  const tokens = buildTokens(request.prompt);
  const from = Math.min(Math.max(0, request.fromToken), tokens.length);
  const random = mulberry32(request.seed);
  let producedInBurst = 0;

  for (let index = from; index < tokens.length; index += 1) {
    if (signal?.aborted) return;

    const token = tokens[index];
    if (token === undefined) continue;

    if (
      request.disconnectAt !== null &&
      index === request.disconnectAt &&
      from < request.disconnectAt
    ) {
      return;
    }

    const hitFixedStall =
      request.stallAt !== null && index === request.stallAt && from < request.stallAt;
    const hitRandomStall =
      !hitFixedStall &&
      request.stallChance > 0 &&
      index > from &&
      random() < request.stallChance;

    if (hitFixedStall || hitRandomStall) {
      yield { event: 'stall', data: JSON.stringify({ ms: request.stallMs, index }) };
      await sleep(request.stallMs, signal);
    }

    yield { event: 'message', data: JSON.stringify({ token, index }) };
    producedInBurst += 1;
    if (producedInBurst >= request.burst) {
      producedInBurst = 0;
      await sleep(request.latencyMs, signal);
    }
  }

  yield { event: 'done', data: JSON.stringify({ tokens: tokens.length }) };
}
