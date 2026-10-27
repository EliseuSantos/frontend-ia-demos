import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const bad = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  const summary = bad
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(' ')).join('\n');
      return `${violation.id} (${violation.impact}): ${violation.help}\n${targets}`;
    })
    .join('\n\n');
  expect(bad, summary).toEqual([]);
}

export async function focusByKeyboard(page: Page, testId: string): Promise<void> {
  for (let step = 0; step < 40; step += 1) {
    const focused = await page.evaluate((id) => {
      const active = document.activeElement;
      return active instanceof HTMLElement && active.dataset.testid === id;
    }, testId);
    if (focused) return;
    await page.keyboard.press('Tab');
  }
  await expect(page.getByTestId(testId)).toBeFocused();
}

export async function startFromSkipLink(page: Page): Promise<void> {
  await page.locator('body').evaluate((body) => {
    body.setAttribute('tabindex', '-1');
    body.focus();
  });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
}
