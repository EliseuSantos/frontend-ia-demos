# MCP: eventos e polling

Simulação determinística de um cliente de agente que espera N recursos MCP no estilo de deploys da Vercel. O mesmo gerador calcula polling periódico e inscrição em eventos lado a lado. Sem rede, sem chave e sem benchmark da Vercel: é uma simulação local para mostrar a diferença de pedidos e latência.

## Como rodar

```bash
pnpm install
pnpm dev:mcp-events
```

Abre em `http://127.0.0.1:5179`.

No Pages: `https://eliseusantos.github.io/frontend-ia-demos/06-mcp-events/`.

## Como contar

Janela fixa de 60 s. O servidor falso gera, por recurso, um instante de mudança (`deployment.succeeded` ou `deployment.error`) com mulberry32. O instante cai uniformemente em `[5% da janela, 95% da janela]` (ms inteiros), então no padrão cada recurso muda exatamente uma vez dentro da janela.

### Polling

- O cliente consulta cada recurso em `t = 0, intervalMs, 2 * intervalMs, ...` enquanto `t <= janela`.
- O agente continua observando a janela inteira; uma consulta sem mudança de estado é desperdício.
- Cada consulta conta como 1 pedido.
- Desperdício: consulta cuja resposta não muda o último estado conhecido daquele recurso.
- Latência de uma mudança: primeiro `t` de consulta com `t >= changeTime` menos `changeTime`, só se a mudança ocorre em `[0, janela]` e é vista por uma consulta com `t <= janela`.

### Eventos

- O cliente assina uma vez por recurso (1 pedido por recurso; sem ack).
- Em cada mudança dentro da janela, o push chega com atraso determinístico em `[50, 250]` ms.
- Desperdício: 0.
- Latência: o próprio atraso de entrega. A mudança precisa estar na janela; a entrega pode passar um pouco da janela e ainda conta.

Recurso sem mudança na janela: gera as consultas ou a assinatura, mas não entra nas amostras de latência. Casos de borda (fora da janela, nunca, `t=0`) ficam nos testes com `simulateWithChanges`.

## Resultado do cenário padrão

Cenário: `seed=42`, `intervalMs=2000`, `resources=3`, `windowMs=60000`.

Mudanças geradas: r0 em 35460 ms (`deployment.succeeded`, atraso 221 ms); r1 em 39166 ms (`deployment.succeeded`, atraso 155 ms); r2 em 17754 ms (`deployment.succeeded`, atraso 223 ms). Latências: média e máxima sobre as 3 mudanças.

Reproduzir:

```bash
pnpm test
```

Números travados:

| Métrica | Valor |
| --- | --- |
| Pedidos polling | 93 |
| Desperdício polling | 90 |
| Latência média polling | 540 ms |
| Latência máxima polling | 834 ms |
| Pedidos eventos | 3 |
| Desperdício eventos | 0 |
| Latência média eventos | 199.67 ms |
| Latência máxima eventos | 223 ms |
| Pedidos evitados | 90 (96.77%) |

## Como usar

1. Deixe o padrão e clique em Executar na hora.
2. Leia o placar e as duas linhas do tempo.
3. Mude o intervalo; o polling muda de volume, os eventos continuam com N assinaturas.

A URL aceita `?seed=42&interval=2000&n=3`. Redefinir volta ao padrão.

## Onde olhar

- `src/simulate.ts`: gerador, polling, eventos e placar
- `src/simulate.test.ts`: cenário padrão, borda e determinismo
- `e2e/mcp-events.spec.ts`: placar, URL, teclado e axe

## Fontes

- https://vercel.com/changelog/vercel-mcp-now-supports-mcp-events
- https://x.com/vercel_dev/status/2119886198395318657
