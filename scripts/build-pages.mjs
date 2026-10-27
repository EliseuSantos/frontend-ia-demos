import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const demos = [
  {
    dir: 'demos/01-streaming-ui',
    out: '01-streaming-ui',
    title: 'Streaming de tokens',
    lesson:
      'A resposta chega em pedaços. Eu pinto o DOM uma vez por frame e retomo se a conexão cair.',
  },
  {
    dir: 'demos/02-main-thread',
    out: '02-main-thread',
    title: 'Thread principal e Worker',
    lesson:
      'O mesmo trabalho pesado trava a animação no thread principal e deixa o frame estável dentro de um Worker.',
  },
  {
    dir: 'demos/03-on-device-ai',
    out: '03-on-device-ai',
    title: 'IA no navegador',
    lesson:
      'Embedding e busca por cosseno rodam no browser, com WebGPU quando existe e WASM no restante.',
  },
  {
    dir: 'demos/04-resilient-ui',
    out: '04-resilient-ui',
    title: 'UI resiliente',
    lesson:
      'O chat é uma máquina de estados. Timeout, queda, offline e backpressure são transições testáveis.',
  },
];

rmSync('site', { recursive: true, force: true });
mkdirSync('site', { recursive: true });

for (const demo of demos) {
  execSync('pnpm build', {
    cwd: demo.dir,
    stdio: 'inherit',
    env: { ...process.env, GITHUB_PAGES: 'true' },
  });
  cpSync(`${demo.dir}/dist`, `site/${demo.out}`, { recursive: true });
}

const cards = demos
  .map(
    (demo) => `<article class="card">
      <p class="kicker">${demo.out}</p>
      <h2><a href="./${demo.out}/">${demo.title}</a></h2>
      <p>${demo.lesson}</p>
    </article>`,
  )
  .join('\n');

const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demos de frontend com IA</title>
  <style>
    :root { color-scheme: light; --ink: #1f1a14; --muted: #5e564c; --line: #ddd4c6; --bg: #f3efe6; --card: #fffdf8; --accent: #0c5c56; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 18px/1.5 "Avenir Next", "Segoe UI", sans-serif; color: var(--ink); background: var(--bg); }
    main { max-width: 880px; margin: 0 auto; padding: 48px 20px 72px; }
    h1 { font-size: 2.2rem; line-height: 1.15; margin: 0 0 12px; }
    .lede { color: var(--muted); max-width: 62ch; }
    .grid { display: grid; gap: 16px; margin-top: 32px; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; }
    .kicker { font: 12px/1 ui-monospace, Menlo, Consolas, monospace; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin: 0 0 8px; }
    h2 { font-size: 1.3rem; margin: 0 0 8px; }
    a { color: inherit; }
    p { margin: 0; }
  </style>
</head>
<body>
  <main>
    <p class="kicker">eliseu santos</p>
    <h1>Demos de frontend com IA</h1>
    <p class="lede">Quatro páginas curtas. Cada uma mostra uma ideia: streaming de tokens, thread principal, modelo local e uma máquina de estados para quando a rede falha.</p>
    <div class="grid">
      ${cards}
    </div>
  </main>
</body>
</html>
`;

writeFileSync('site/index.html', html);
console.log('site/ pronto');
