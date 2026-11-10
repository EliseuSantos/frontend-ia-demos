# Texto escondido

Uma página de exemplo esconde oito instruções com CSS e HTML. O painel da pessoa mostra a prévia. O painel do agente lista o que um extrator determinístico puxa do mesmo documento. N é quantas técnicas ligadas o agente acha e a extração visível não.

Sem modelo, sem chave e sem rede.

## Como rodar

```bash
pnpm install
pnpm dev:hidden-text
```

Abre em `http://127.0.0.1:5178`.

No Pages: `https://eliseusantos.github.io/frontend-ia-demos/05-hidden-text/`.

## Como usar

1. Deixe as oito técnicas ligadas. O placar deve mostrar 8 de 8.
2. Desligue uma técnica. N cai na hora e a prévia muda.
3. Compare "O que a pessoa vê" com "O que o leitor de agente extrai".

Redefinir liga as oito de novo.

A URL aceita `?tecnicas=cor,opacidade` (lista) ou `?tecnica=fora` (uma só). Ids desconhecidos são ignorados. Sem query, as oito ficam ligadas.

O link Ver o código abre `src/extractor.ts`.

Os testes:

```bash
pnpm test
pnpm test:e2e
```

## O que você vê

Cada técnica injeta uma string falsa e greppável, em português. O extrator lê texto bruto, comentários HTML e `content` de `::after` no CSS. A extração "visível" descarta nós escondidos por estilo, `aria-hidden`, comentários e pseudoelementos.

## A lição

Um leitor de agente que despeja HTML não vê a página como uma pessoa. Texto com a mesma cor do fundo, `display: none`, comentário ou `::after` ainda entra no prompt. N mede essa diferença sem chamar modelo nenhum.

## Onde olhar

- `src/techniques.ts`: catálogo fixo das oito técnicas e o HTML de exemplo
- `src/extractor.ts`: extrator do agente, extração visível e o cálculo de N
- `src/extractor.test.ts`: um teste por técnica, N padrão e desligar uma técnica
- `e2e/hidden-text.spec.ts`: placar, URL, teclado e axe
