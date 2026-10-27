import { expect, test } from '@playwright/test';
import { expectAccessible, focusByKeyboard, startFromSkipLink } from './a11y';

const url = 'http://127.0.0.1:4176';

test('conclui no servidor de mentira', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByTestId('mode')).toHaveText('servidor local');
  await page.getByTestId('scenario').selectOption('normal');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('output')).toContainText('chave');
  await expect(page.getByTestId('phase')).toHaveText('done');
  await expect(page.getByTestId('pauses')).not.toHaveText('0');
  await expectAccessible(page);
});

test('não tem violação grave de acessibilidade', async ({ page }) => {
  await page.goto(url);
  await expectAccessible(page);
});

test('o teclado envia o cenário normal', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('scenario').selectOption('normal');
  await startFromSkipLink(page);
  await focusByKeyboard(page, 'send');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('phase')).toHaveText('done');
});

test('retoma depois da queda', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('scenario').selectOption('drop');
  await expect(page.getByTestId('disconnect-at')).toHaveValue('10');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('log')).toContainText('retrying');
  await expect(page.getByTestId('output')).toContainText('chave');
  await expect(page.getByTestId('phase')).toHaveText('done');
  await expect(page.getByTestId('attempt')).toHaveText('2');
});

test('pausa longa estoura o timeout e termina na tentativa seguinte', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('scenario').selectOption('stall');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('log')).toContainText('stalled');
  await expect(page.getByTestId('log')).toContainText('retrying');
  await expect(page.getByTestId('output')).toContainText('chave', { timeout: 20_000 });
  await expect(page.getByTestId('phase')).toHaveText('done');
});

test('offline falha sem fingir conexão', async ({ page, context }) => {
  await page.goto(url);
  await context.setOffline(true);
  await page.getByTestId('send').click();
  await expect(page.getByTestId('phase')).toHaveText('failed');
  await expect(page.getByTestId('error')).toContainText('Sem rede');
});
