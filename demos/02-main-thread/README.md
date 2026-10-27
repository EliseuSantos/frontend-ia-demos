# Thread principal e Worker

Eu coloquei o mesmo trabalho pesado dos dois lados de uma tela, com uma animação em cima para eu ver quem trava.

## Como rodar

```bash
pnpm install
pnpm dev:main-thread
```

Abre em `http://127.0.0.1:5174`.

No Pages: `https://eliseusantos.github.io/frontend-ia-demos/02-main-thread/`.

## O que você vê

A barrinha anda a cada frame. O gráfico mostra o tempo do frame. Eu tokenizo um texto grande várias vezes. No botão da esquerda isso roda no thread principal e a barrinha para. No da direita o mesmo código roda num Worker e a barrinha segue.

Embaixo eu mostro os bytes do `ArrayBuffer` antes e depois da transferência.

Se quiser um travamento mais óbvio, sobe as rodadas.

## A lição

Quem pinta a tela é o thread principal. Uma tarefa longa segura o próximo frame, e isso aparece como pico no gráfico e, acima de 50 ms, como long task. O Worker faz a conta sem segurar o frame. Transferir o buffer muda o dono da memória: depois do `postMessage`, o `byteLength` aqui fica 0. A string original continua na heap. O que foi embora foi a cópia UTF-8.

## Onde olhar

- `src/workload.ts`: o tokenizador, importado pelos dois lados
- `src/worker.ts`: recebe o buffer transferido
- `src/jank.ts`: frame time e long task
- `src/main.ts`: dispara as duas rodadas
