# ADR-001: One mock stream for the dev server and the browser

## Status

Accepted (2026-10-27). Records a decision already in the code.

## Context

Demos 01 (streaming UI) and 04 (resilient UI) need a token stream that can be slowed down, stalled, cut mid-answer, and resumed from a token index. Without that, the retry, backoff, and state-machine behaviour they show cannot be reproduced on demand.

The demos are published on GitHub Pages (`.github/workflows/pages.yml`, `scripts/build-pages.mjs`). Pages serves static files only. There is no Node process to answer `/api/stream`. Locally, `pnpm dev` runs Vite, which can host middleware.

The README promises that no API key is needed.

## Options

### Option A — call a real model

Realistic output, but it needs a key, and a key in a static bundle is public. Stalls and disconnects cannot be triggered at a chosen token.

### Option B — a mock server only

A Vite middleware serves SSE. Works for `pnpm dev`, but the Pages build would have nothing to talk to.

### Option C — a separate fake for the browser

A second implementation for Pages. Two generators drift, and the published demo would no longer show what the tests check.

### Option D — one generator, two transports

A single async generator produces the events. The dev server writes them to an HTTP response, and the browser wraps them in a `Response` built on a `ReadableStream`. The client code reads both with the same SSE parser.

## Decision

Option D.

- `packages/mock-stream/src/generate.ts` (`mockEvents`) is the only generator. It takes a `MockRequest` (`types.ts`, validated and clamped by `parseMockRequest` in `request.ts`) with latency, burst, stall chance or index, disconnect index, `fromToken`, and a seed for `mulberry32`, so a run is repeatable.
- `demos/01-streaming-ui/server/plugin.ts` and `demos/04-resilient-ui/server/plugin.ts` are Vite plugins that serve `POST /api/stream` from `mockEvents` in dev.
- `packages/mock-stream/src/browser.ts` (`browserMockResponse`) turns the same generator into a `text/event-stream` `Response` in the browser.
- `streamMode()` in `demos/01-streaming-ui/src/session.ts` and `demos/04-resilient-ui/src/runner.ts` picks `server` when `import.meta.env.DEV` is true and `browser` otherwise. Both paths go through `readSse`, so the UI code does not know which one it got.
- Demo 01 keeps an opt-in `provider` mode for an OpenAI-compatible endpoint, enabled only when `VITE_LLM_*` are set in `.env.local`.

## Consequences

- The Pages build and `pnpm dev` show the same behaviour from the same code, with no backend and no key.
- Resume is cheap: the client sends `fromToken` and the generator skips ahead. The `provider` mode cannot resume, so `session.ts` restarts it from token 0.
- The generator is unit-tested in `packages/mock-stream/src/mock-stream.test.ts`. The Playwright suite (`playwright.config.ts`) runs against Vite dev servers, so it covers the `server` path. The `browser` path is built in CI but not driven by e2e tests.
- The two `server/plugin.ts` files are identical copies. A later change could move the handler into `packages/mock-stream`.
- The stream is scripted text, not model output. It shows rendering and failure handling, not answer quality.
