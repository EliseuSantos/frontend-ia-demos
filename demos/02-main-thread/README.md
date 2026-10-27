# Thread principal e Worker

Eu coloquei o mesmo trabalho pesado dos dois lados de uma tela, com uma animação em cima para eu ver quem trava.

## Como rodar

```bash
pnpm install
pnpm dev:main-thread
```

Abre em `http://127.0.0.1:5174`.

No Pages: `https://eliseusantos.github.io/frontend-ia-demos/02-main-thread/`.

## Como usar

A página compara o mesmo trabalho no thread principal e num Worker.

1. Deixe 280 cópias e 8000 rodadas.
2. Aperte Comparar os dois.
3. Olhe a barrinha, o gráfico de frames e a linha que diz quanto levou o pior frame de cada lado.

Rodar aqui e Rodar no worker continuam disponíveis, se você quiser um lado só.

A URL `?modo=comparar` dispara a comparação ao abrir. Também vale `?modo=principal` e `?modo=worker`.

Se o sistema pede menos movimento, a barrinha fica parada. A caixa Mostrar o movimento liga ela de novo. A medição de frame continua nos dois casos.

O link Ver o código abre `src/worker.ts`.

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
