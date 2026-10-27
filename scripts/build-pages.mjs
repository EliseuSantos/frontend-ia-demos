import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const demos = [
  {
    dir: 'demos/01-streaming-ui',
    out: '01-streaming-ui',
    index: '01',
    title: 'Streaming de tokens',
    lesson:
      'A resposta chega em pedaços. Eu pinto o DOM uma vez por frame e retomo se a conexão cair.',
  },
  {
    dir: 'demos/02-main-thread',
    out: '02-main-thread',
    index: '02',
    title: 'Thread principal e Worker',
    lesson:
      'O mesmo trabalho pesado trava a animação no thread principal e deixa o frame estável dentro de um Worker.',
  },
  {
    dir: 'demos/03-on-device-ai',
    out: '03-on-device-ai',
    index: '03',
    title: 'IA no navegador',
    lesson:
      'Embedding e busca por cosseno rodam no browser, com WebGPU quando existe e WASM no restante.',
  },
  {
    dir: 'demos/04-resilient-ui',
    out: '04-resilient-ui',
    index: '04',
    title: 'UI resiliente',
    lesson:
      'O chat é uma máquina de estados. Timeout, queda, offline e backpressure são transições testáveis.',
  },
];

const repo = 'https://github.com/EliseuSantos/frontend-ia-demos';

rmSync('site', { recursive: true, force: true });
mkdirSync('site/theme', { recursive: true });

for (const file of ['theme.css', 'fonts.css', 'tokens.css', 'base.css']) {
  cpSync(`packages/theme/${file}`, `site/theme/${file}`);
}
cpSync('packages/theme/fonts', 'site/theme/fonts', { recursive: true });
cpSync('packages/theme/assets', 'site/theme/assets', { recursive: true });
cpSync('packages/theme/public/favicon-v3.png', 'site/favicon-v3.png');

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
    (demo, position) => `<a class="ed-card${position === 0 ? ' ed-card--featured' : ''}" href="./${demo.out}/">
      <p class="ed-card__meta">${demo.index} / ${demo.out}</p>
      <h2 class="ed-card__title">${demo.title}</h2>
      <p class="ed-card__body">${demo.lesson}</p>
    </a>`,
  )
  .join('\n');

const footerLinks = demos
  .map((demo) => `<li><a href="./${demo.out}/">${demo.title}</a></li>`)
  .join('\n');

const html = `<!doctype html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#07090a" />
  <link rel="icon" type="image/png" href="./favicon-v3.png" />
  <link rel="preload" as="font" type="font/woff2" href="./theme/fonts/space-grotesk-latin.woff2" crossorigin />
  <link rel="preload" as="font" type="font/woff2" href="./theme/fonts/inter-latin.woff2" crossorigin />
  <link rel="stylesheet" href="./theme/theme.css" />
  <title>Demos de frontend com IA</title>
</head>
<body id="top">
  <a class="skip label" href="#conteudo">Pular para o conteúdo</a>
  <header class="site-header">
    <div class="container-content site-header__inner">
      <a class="brand" href="https://eliseu.dev/projects">
        <span class="brand__mark" aria-hidden="true"></span>
        eliseu.dev
      </a>
      <a class="ed-btn ed-btn--outline ed-btn--mono ed-btn--sm site-header__code" href="${repo}" target="_blank" rel="noopener noreferrer">GitHub</a>
    </div>
  </header>
  <main id="conteudo" class="page">
    <p class="kicker"><b>01</b><span aria-hidden="true">/</span> Projetos<i aria-hidden="true"></i></p>
    <h1>Demos de frontend com <span class="ed-accent-signal">IA</span></h1>
    <p class="lede">Quatro páginas curtas. Cada uma mostra uma ideia: streaming de tokens, thread principal, modelo local e uma máquina de estados para quando a rede falha.</p>
    <div class="demo-grid">
      ${cards}
    </div>
  </main>
  <footer class="site-footer">
    <div class="container-content">
      <div class="site-footer__top">
        <div class="site-footer__intro">
          <a class="brand" href="https://eliseu.dev/projects">
            <span class="brand__mark" aria-hidden="true"></span>
            eliseu.dev
          </a>
          <p>Demos de interface no navegador. Cada página mostra uma ideia, com o código no GitHub.</p>
        </div>
        <nav aria-label="Rodapé">
          <p class="label">Páginas</p>
          <ul>
            ${footerLinks}
            <li><a href="${repo}" target="_blank" rel="noopener noreferrer">Código</a></li>
            <li><a href="https://eliseu.dev/projects">eliseu.dev/projects</a></li>
          </ul>
        </nav>
      </div>
      <div class="site-footer__bottom meta">
        <span>© 2026 Eliseu Santos</span>
        <a class="site-footer__up" href="#top">Topo</a>
      </div>
    </div>
  </footer>
</body>
</html>
`;

writeFileSync('site/index.html', html);
console.log('site/ pronto');
