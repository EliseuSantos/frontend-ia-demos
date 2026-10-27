import { expect, test } from '@playwright/test';

test('a página abre sem baixar o modelo', async ({ page }) => {
  await page.goto('http://127.0.0.1:4177');
  await expect(page.getByRole('heading', { name: 'IA no navegador' })).toBeVisible();
  await expect(page.getByTestId('load-model')).toBeEnabled();
  await expect(page.getByTestId('search')).toBeDisabled();
  await expect(page.getByTestId('progress')).toContainText('Ainda não carreguei');
  await expect(page.getByTestId('backend')).toHaveText('...');
});
