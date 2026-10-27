# Contributing to frontend-ia-demos

Thanks for your interest. These demos are small on purpose, so focused changes are the easiest to review.

## Setup

You need Node 22 (see `.nvmrc`) and pnpm 10 (the version is pinned in `packageManager`; `corepack enable` picks it up).

```bash
git clone https://github.com/EliseuSantos/frontend-ia-demos.git
cd frontend-ia-demos
pnpm install
```

Run a demo:

```bash
pnpm dev:streaming     # 01: LLM token streaming
pnpm dev:main-thread   # 02: main thread vs Web Worker
pnpm dev:on-device     # 03: in-browser AI with WebGPU
pnpm dev:resilient     # 04: resilient UI
```

No API key is needed. Demo 01 uses a local token generator unless you set `demos/01-streaming-ui/.env.local` (see the README). Never commit that file or any key.

## Checks

These are the same steps CI runs on every push and pull request:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

If you touch the GitHub Pages build, also run `GITHUB_PAGES=true pnpm build:pages`.

Keep TypeScript strict, add unit tests for logic changes and keep the e2e accessibility checks passing.

## Workflow

1. Open an issue first for anything beyond a small fix. Use the bug or feature template.
2. Fork the repository and create a branch from `main`.
3. Keep the pull request focused on one change and fill in the pull request template.
4. Make sure all the checks above pass.

The README is in Portuguese; issues and pull requests can be in English or Portuguese.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) in English, for example:

```text
feat(streaming-ui): add a cancel button
fix(resilient-ui): retry after a network timeout
docs: explain the WebGPU fallback
```

## Security

Do not open a public issue for a vulnerability. Use [private vulnerability reporting](https://github.com/EliseuSantos/frontend-ia-demos/security/advisories/new) instead.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
