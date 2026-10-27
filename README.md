# Demos de frontend com IA

Eu juntei aqui quatro demos curtos para uma série de textos sobre interface e modelo no navegador. Cada pasta mostra uma ideia só. Dá para abrir, rodar e ver o ponto em cerca de um minuto.

Não tem framework de UI. O código é TypeScript estrito, com Vite e pouca dependência. O visual fica em `packages/theme`: os tokens, as fontes e o cabeçalho do eliseu.dev. Os testes rodam no GitHub Actions em todo push.

## Os quatro demos

### 1. Streaming de tokens

Pasta: `demos/01-streaming-ui`

Comando: `pnpm dev:streaming`

URL: https://eliseusantos.github.io/frontend-ia-demos/01-streaming-ui/

A resposta aparece pedaço por pedaço. Dá para aumentar a latência, sortear pausas, cortar a conexão, cancelar e deixar o cliente retomar sozinho.

Lição: eu não pinto o DOM a cada token. Eu acumulo os pedaços e escrevo uma vez por frame. Se o fluxo cair, eu continuo do último índice, com uma espera que dobra.

### 2. Thread principal e Worker

Pasta: `demos/02-main-thread`

Comando: `pnpm dev:main-thread`

URL: https://eliseusantos.github.io/frontend-ia-demos/02-main-thread/

O mesmo tokenizador roda na tela e num Worker. Uma barrinha e um gráfico de frame time mostram quem travou.

Lição: trabalho pesado no thread principal atrasa o próximo frame. No Worker a animação segue. Transferir o `ArrayBuffer` muda o dono da memória: depois da transferência o `byteLength` no thread principal fica 0.

### 3. IA no navegador

Pasta: `demos/03-on-device-ai`

Comando: `pnpm dev:on-device`

URL: https://eliseusantos.github.io/frontend-ia-demos/03-on-device-ai/

Eu carrego um modelo pequeno de embeddings na hora do clique, com WebGPU se existir e WASM se não existir, e busco doze textos pelo cosseno. Sem backend.

Lição: embedding e busca vetorial cabem no browser. O modelo entra tarde, o backend usado fica visível, e o tempo também.

### 4. UI resiliente

Pasta: `demos/04-resilient-ui`

Comando: `pnpm dev:resilient`

URL: https://eliseusantos.github.io/frontend-ia-demos/04-resilient-ui/

Um chat em streaming com as fases idle, connecting, streaming, stalled, retrying, failed e done. Tem fila, timeout e offline. A unidade testa as transições. O Playwright fala com o servidor de mentira.

Lição: eu trato falha como transição de estado, não como um if perdido na interface.

## Como rodar

Eu uso Node 22 e pnpm 10.

```bash
pnpm install
pnpm dev:streaming
pnpm dev:main-thread
pnpm dev:on-device
pnpm dev:resilient
```

Cada comando sobe um Vite. Os demos 01 e 04 expõem `/api/stream` no dev server. Não precisa de chave.

Para checar o repositório:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

## Provedor real, se você quiser

No demo 01 existe um caminho opcional para um endpoint compatível com a API de chat da OpenAI. Ele só liga com `demos/01-streaming-ui/.env.local`:

```bash
VITE_LLM_BASE_URL=https://api.openai.com/v1
VITE_LLM_API_KEY=
VITE_LLM_MODEL=gpt-4o-mini
```

Sem essas variáveis, o demo usa o gerador local. A chave fica no bundle do navegador, então eu uso isso só na minha máquina, nunca num build público.

## GitHub Pages

O workflow `.github/workflows/pages.yml` publica cada demo como página estática. No Pages não tem o servidor Node, então os demos de streaming usam o mesmo gerador dentro do navegador.

- https://eliseusantos.github.io/frontend-ia-demos/
- https://eliseusantos.github.io/frontend-ia-demos/01-streaming-ui/
- https://eliseusantos.github.io/frontend-ia-demos/02-main-thread/
- https://eliseusantos.github.io/frontend-ia-demos/03-on-device-ai/
- https://eliseusantos.github.io/frontend-ia-demos/04-resilient-ui/

O workflow não consegue ligar o Pages sozinho se a opção ainda estiver desligada no repositório. Se o deploy não rodar, eu ativo em Settings, Pages, Source: GitHub Actions.

## Licença

MIT. O texto está em `LICENSE`.
