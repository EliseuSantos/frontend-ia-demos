import { expect, test } from '@playwright/test';
import { expectAccessible, focusByKeyboard, startFromSkipLink } from './a11y';

const url = 'http://127.0.0.1:4178';

const INSTRUCTIONS = [
  'INSTRUCAO-AGENTE-COR:',
  'INSTRUCAO-AGENTE-TAMANHO:',
  'INSTRUCAO-AGENTE-OPACIDADE:',
  'INSTRUCAO-AGENTE-DISPLAY:',
  'INSTRUCAO-AGENTE-ARIA:',
  'INSTRUCAO-AGENTE-COMENTARIO:',
  'INSTRUCAO-AGENTE-FORA:',
  'INSTRUCAO-AGENTE-AFTER:',
] as const;

const IDS = ['cor', 'tamanho', 'opacidade', 'display', 'aria', 'comentario', 'fora', 'after'] as const;

test('padrao mostra N de 8 e lista as oito instrucoes no painel do agente', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByTestId('score')).toHaveAttribute('data-n', '8');
  await expect(page.getByTestId('score')).toHaveText('8 de 8');
  for (const id of IDS) {
    await expect(page.getByTestId(`agente-${id}`)).toHaveAttribute('data-followed', 'true');
  }
  const agent = page.getByTestId('agent-list');
  for (const snippet of INSTRUCTIONS) {
    await expect(agent).toContainText(snippet);
  }
});

test('desligar uma tecnica reduz N', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('tecnica-cor').uncheck();
  await expect(page.getByTestId('score')).toHaveAttribute('data-n', '7');
  await expect(page.getByTestId('agente-cor')).toHaveAttribute('data-followed', 'false');
});

test('honra ?tecnicas= na URL', async ({ page }) => {
  await page.goto(`${url}/?tecnicas=cor,opacidade`);
  await expect(page.getByTestId('tecnica-cor')).toBeChecked();
  await expect(page.getByTestId('tecnica-opacidade')).toBeChecked();
  await expect(page.getByTestId('tecnica-display')).not.toBeChecked();
  await expect(page.getByTestId('score')).toHaveAttribute('data-n', '2');
});

test('honra ?tecnica= unica', async ({ page }) => {
  await page.goto(`${url}/?tecnica=fora`);
  await expect(page.getByTestId('tecnica-fora')).toBeChecked();
  await expect(page.getByTestId('score')).toHaveAttribute('data-n', '1');
});

test('teclado redefine e axe passa no chrome do demo', async ({ page }) => {
  await page.goto(`${url}/?tecnica=cor`);
  await expect(page.getByTestId('score')).toHaveAttribute('data-n', '1');
  await startFromSkipLink(page);
  await focusByKeyboard(page, 'reset');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('score')).toHaveAttribute('data-n', '8');
  await expectAccessible(page, { exclude: ['iframe[data-testid="preview"]'] });
});

test('o chrome humano nao expoe as instrucoes como texto regular', async ({ page }) => {
  await page.goto(url);
  const humanSection = page.locator('section[aria-labelledby="humano"]');
  for (const snippet of INSTRUCTIONS) {
    await expect(humanSection).not.toContainText(snippet);
  }

  const leaked = await page.evaluate((snippets) => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    clone.querySelector('[data-testid="agent-list"]')?.remove();
    clone.querySelector('[data-testid="preview"]')?.remove();
    const text = clone.textContent ?? '';
    return snippets.filter((snippet) => text.includes(snippet));
  }, [...INSTRUCTIONS]);
  expect(leaked).toEqual([]);
});
