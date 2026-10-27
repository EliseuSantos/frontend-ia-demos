# @demos/mock-stream

Eu coloquei aqui o gerador de fluxo que os demos 01 e 04 usam.

Ele não chama modelo nenhum. A partir do prompt eu monto um texto fixo, corto em tokens e devolvo eventos SSE. Dá para configurar latência, pausa, queda no meio e atraso de conexão. O navegador e o servidor de desenvolvimento consomem o mesmo gerador, então o Pages (sem Node) se comporta como o `pnpm dev`.
