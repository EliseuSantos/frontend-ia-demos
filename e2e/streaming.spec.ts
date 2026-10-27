import { expect, test } from '@playwright/test';
import { expectAccessible, focusByKeyboard, startFromSkipLink } from './a11y';

const url = 'http://127.0.0.1:4173';

test('mostra o stream do servidor e agrupa a pintura por frame', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByTestId('mode')).toHaveText('servidor local');
  await page.getByTestId('latency').fill('0');
  await page.getByTestId('stall-chance').fill('0');
  await page.getByTestId('burst').fill('8');
  await page.getByTestId('disconnect-at').fill('');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('status')).toHaveText('concluído');
  await expect(page.getByTestId('output')).toContainText('chave');
  await expect(page.getByTestId('attempt')).toHaveText('1');

  const received = Number(await page.getByTestId('received').textContent());
  const writes = Number(await page.getByTestId('writes').textContent());
  expect(received).toBeGreaterThan(20);
  expect(writes).toBeGreaterThan(0);
  expect(writes).toBeLessThan(received);
});

test('retoma depois de um corte no meio', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('latency').fill('0');
  await page.getByTestId('stall-chance').fill('0');
  await page.getByTestId('burst').fill('8');
  await page.getByTestId('disconnect-at').fill('8');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('status')).toHaveText('concluído');
  await expect(page.getByTestId('attempt')).toHaveText('2');
  await expect(page.getByTestId('output')).toContainText('chave');
});

test('não tem violação grave de acessibilidade', async ({ page }) => {
  await page.goto(url);
  await expectAccessible(page);
});

test('o teclado envia o pedido', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('latency').fill('0');
  await page.getByTestId('stall-chance').fill('0');
  await page.getByTestId('burst').fill('8');
  await startFromSkipLink(page);
  await focusByKeyboard(page, 'send');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('status')).toHaveText('concluído');
  await expectAccessible(page);
});

test('cancelar aborta o fluxo', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('latency').fill('250');
  await page.getByTestId('stall-chance').fill('0');
  await page.getByTestId('burst').fill('2');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('status')).toHaveText('recebendo');
  await page.getByTestId('cancel').click();
  await expect(page.getByTestId('status')).toHaveText('cancelado');
});
