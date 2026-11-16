import { expect, test } from '@playwright/test';
import { expectAccessible, focusByKeyboard, startFromSkipLink } from './a11y';

const url = 'http://127.0.0.1:4179';

test('padrao na hora trava o placar do cenario DEFAULT', async ({ page }) => {
  await page.goto(url);
  await page.getByTestId('instant').click();
  await expect(page.getByTestId('score')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('score-polling-requests')).toHaveText('93');
  await expect(page.getByTestId('score-events-requests')).toHaveText('3');
  await expect(page.getByTestId('score-avoided')).toHaveText('90 (96.77%)');
  await expect(page.getByTestId('score-polling-wasted')).toHaveText('90');
  await expect(page.getByTestId('score-polling-mean')).toHaveText('540 ms');
  await expect(page.getByTestId('score-events-mean')).toHaveText('200 ms');
  await expect(page.getByTestId('polling-log')).not.toHaveAttribute('data-empty', 'true');
  await expect(page.getByTestId('events-log')).not.toHaveAttribute('data-empty', 'true');
});

test('honra seed, interval e n na URL', async ({ page }) => {
  await page.goto(`${url}/?seed=7&interval=5000&n=2`);
  await expect(page.getByTestId('seed')).toHaveValue('7');
  await expect(page.getByTestId('interval')).toHaveValue('5000');
  await expect(page.getByTestId('resources')).toHaveValue('2');
  await page.getByTestId('instant').click();
  await expect(page.getByTestId('score-events-requests')).toHaveText('2');
});

test('redefinir volta ao padrao e limpa o placar', async ({ page }) => {
  await page.goto(`${url}/?seed=9&interval=1000&n=4`);
  await page.getByTestId('instant').click();
  await expect(page.getByTestId('score')).toHaveAttribute('data-ready', 'true');
  await page.getByTestId('reset').click();
  await expect(page.getByTestId('seed')).toHaveValue('42');
  await expect(page.getByTestId('interval')).toHaveValue('2000');
  await expect(page.getByTestId('resources')).toHaveValue('3');
  await expect(page.getByTestId('score')).toHaveAttribute('data-ready', 'false');
  await expect(page.getByTestId('polling-log')).toHaveAttribute('data-empty', 'true');
});

test('teclado dispara executar na hora e axe passa no chrome', async ({ page }) => {
  await page.goto(url);
  await startFromSkipLink(page);
  await focusByKeyboard(page, 'instant');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('score')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('panel-polling')).toBeVisible();
  await expect(page.getByTestId('panel-events')).toBeVisible();
  await expectAccessible(page);
});
