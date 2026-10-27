# Streaming de tokens

Eu quis ver uma resposta de modelo aparecer aos poucos, sem chave e sem esperar o texto inteiro.

## Como rodar

Na raiz do repositório:

```bash
pnpm install
pnpm dev:streaming
```

Abre em `http://127.0.0.1:5173`.

No GitHub Pages não existe este servidor. A página usa o mesmo gerador dentro do navegador. A URL fica `https://eliseusantos.github.io/frontend-ia-demos/01-streaming-ui/`.

## Como usar

A página mostra a resposta chegando em pedaços e a pintura agrupada por frame.

1. Deixe a rajada em 8 e a chance de pausa em 0, ou mude os campos.
2. Aperte Enviar.
3. Compare "A cada token" com "Uma vez por frame". A linha embaixo resume a diferença.

Redefinir volta aos valores iniciais e limpa a resposta. Cancelar corta o pedido.

Dá para abrir um cenário pela URL: `?latencia=0&rajada=8&chance=0&pausa=500&corte=8`. Sem `corte`, a conexão não cai.

O link Ver o código abre `src/frame-batcher.ts`.

## O que você vê

Eu mando um prompt. Os tokens entram num fluxo (SSE no dev, `ReadableStream` no Pages). Dá para subir a latência, sortear pausas e cortar a conexão num token. O botão cancelar aborta o `fetch`. Se a conexão cair sozinha, eu retomo do último índice, com uma espera de 250 ms, 500 ms, 1 s e 2 s.

Se você quiser um provedor de verdade, copie `.env.example` para `.env.local` e preencha a URL, a chave e o modelo. Sem isso, nada sai da sua máquina. A chave iria parar no bundle, então eu não uso isso num build público.

## A lição

Pintar o DOM a cada token é desperdício. Eu acumulo os pedaços e escrevo uma vez por `requestAnimationFrame`. O contador de tokens sobe mais que o de escritas. Rede instável não é um caso especial escondido: é retry com backoff e um estado de erro visível.

## Onde olhar

- `src/frame-batcher.ts`: junta tokens por frame
- `src/session.ts`: cancelar, retomar, erro
- `server/plugin.ts`: o endpoint `/api/stream` do `pnpm dev`
- `packages/mock-stream`: o gerador compartilhado com o demo 04
