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
