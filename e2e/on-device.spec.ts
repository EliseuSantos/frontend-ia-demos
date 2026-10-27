import { expect, test } from '@playwright/test';
import { expectAccessible, focusByKeyboard, startFromSkipLink } from './a11y';

test('a página abre sem baixar o modelo', async ({ page }) => {
  await page.goto('http://127.0.0.1:4177');
  await expect(page.getByRole('heading', { name: 'IA no navegador' })).toBeVisible();
  await expect(page.getByTestId('load-model')).toBeEnabled();
  await expect(page.getByTestId('search')).toBeDisabled();
  await expect(page.getByTestId('progress')).toContainText('Ainda não carreguei');
  await expect(page.getByTestId('backend')).toHaveText('...');
  await expectAccessible(page);
});

test('o teclado mostra erro se o modelo não baixa', async ({ page }) => {
  await page.route(/huggingface\.co|hf\.co/, (route) => route.abort());
  await page.goto('http://127.0.0.1:4177');
  await startFromSkipLink(page);
  await focusByKeyboard(page, 'load-model');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('progress')).toContainText('Não consegui carregar', { timeout: 20_000 });
  await expectAccessible(page);
});
