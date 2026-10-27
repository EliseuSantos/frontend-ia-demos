import { expect, test } from '@playwright/test';

test('o worker devolve o mesmo checksum sem copiar o buffer', async ({ page }) => {
  await page.goto('http://127.0.0.1:4175');
  await page.getByTestId('run-main').click();
  await expect(page.getByTestId('main-checksum')).not.toHaveText('ainda não', { timeout: 20_000 });

  await page.getByTestId('run-worker').click();
  await expect(page.getByTestId('worker-checksum')).toContainText('sim', { timeout: 20_000 });
  await expect(page.getByTestId('transfer-after')).toHaveText('0 bytes');
  await expect(page.getByTestId('transfer-before')).not.toHaveText('0 bytes');

  const mainFrame = (await page.getByTestId('main-frame').textContent()) ?? '';
  const workerFrame = (await page.getByTestId('worker-frame').textContent()) ?? '';
  const mainCpu = (await page.getByTestId('main-cpu').textContent()) ?? '';
  const workerCpu = (await page.getByTestId('worker-cpu').textContent()) ?? '';
  console.log(`main cpu ${mainCpu}, frame ${mainFrame}; worker cpu ${workerCpu}, frame ${workerFrame}`);

  const mainMs = Number.parseFloat(mainFrame);
  const workerMs = Number.parseFloat(workerFrame);
  expect(mainMs).toBeGreaterThan(workerMs);
});
