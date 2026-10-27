# IA no navegador

Eu quis uma busca semântica que não chama servidor. O modelo roda na página, os textos já vêm no repositório e a comparação é um cosseno em memória.

## Como rodar

```bash
pnpm install
pnpm dev:on-device
```

Abre em `http://127.0.0.1:5175`.

No Pages: `https://eliseusantos.github.io/frontend-ia-demos/03-on-device-ai/`.

A primeira carga baixa o `Xenova/all-MiniLM-L6-v2` do Hugging Face e o runtime WASM. O navegador guarda isso em cache. Sem rede nessa hora, o botão falha com uma mensagem clara. Não tem chave.

## O que você vê

Nada pesado roda no carregamento da página. Eu clico em carregar. Se o browser oferece WebGPU, eu tento a GPU em fp16. Se não oferece, ou se a GPU falha, eu caio para WASM em q8. Em seguida eu embedo doze textos curtos e mostro o tempo. A busca devolve os três vizinhos mais próximos e o tempo da consulta. Os textos estão em inglês porque esse modelo foi treinado em inglês. A tela continua em português.

## A lição

Dá para ter embedding e busca vetorial no cliente. O custo de servidor some. O que resta é o download preguiçoso do modelo, o backend que realmente rodou e o tempo. Cosseno em memória, com vetores normalizados, chega para um conjunto pequeno.

## Onde olhar

- `src/embed.ts`: carga preguiçosa, WebGPU e fallback WASM
- `src/vector.ts`: cosseno e ranking
- `src/docs.ts`: os textos que viajam com o demo
