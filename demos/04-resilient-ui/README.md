# UI resiliente

Eu juntei o streaming num lugar só: uma máquina de estados com fila, timeout e offline. Os testes olham as transições sem abrir o navegador. Um teste de ponta a ponta fala com o servidor de mentira.

## Como rodar

```bash
pnpm install
pnpm dev:resilient
```

Abre em `http://127.0.0.1:5176`.

No Pages o servidor some e o fluxo é gerado no navegador: `https://eliseusantos.github.io/frontend-ia-demos/04-resilient-ui/`.

## Como usar

A página mostra uma sessão que aguenta queda, pausa e falta de rede.

1. Escolha o cenário. Normal, Queda no meio ou Pausa longa.
2. Aperte Enviar.
3. Compare "Sem tratar a falha" com "Com a máquina" e leia a linha de conclusão.

A URL aceita `?cenario=normal`, `?cenario=queda` ou `?cenario=pausa`.

Redefinir volta ao cenário normal. Cancelar corta a sessão.

O link Ver o código abre `src/machine.ts`.

Os testes:

```bash
pnpm test
pnpm test:e2e
```

## O que você vê

A fase fica escrita na tela, junto com um log `idle -> connecting -> streaming`. Dá para cortar o fluxo, segurar uma pausa maior que o timeout, ou desligar a rede. A fila mostra o backpressure: eu paro de ler quando passam 16 tokens e volto quando a tela drena até 6.

O cenário "Queda no meio" corta no token 10 e retoma. "Pausa longa" estoura o timeout de 1,2 s e tenta de novo.

## A lição

Interface grande quebra quando cada erro é um if solto. Eu prefiro um estado explícito e eventos pequenos. O reducer é puro, então os casos de falha cabem num teste de unidade. O Playwright só confirma que essa máquina encontra o servidor.

## Onde olhar

- `src/machine.ts`: as fases e o reducer
- `src/machine.test.ts`: queda, timeout, offline, retry esgotado, backpressure
- `src/runner.ts`: liga a máquina no fluxo, nos timers e no `online`/`offline`
- `server/plugin.ts`: o mesmo `/api/stream` do demo 01
