import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Smoke E2E — V8 Quiz a11y
 *
 * Renderiza os 3 quizzes V8 (Inline/TrueFalse/FillBlank) na rota dev-only
 * `/dev/v8-quiz-a11y` (mock data, sem auth/DB/áudio) e roda axe-core
 * WCAG 2.1 AA. Cobre o complemento ao testes unit em
 * src/components/lessons/v8/__tests__/V8Quiz*.a11y.test.tsx
 * (browser real, focus/teclado nativos).
 */

const HARNESS_URL = '/dev/v8-quiz-a11y';

test.describe('V8 Quiz a11y smoke', () => {
  test('harness renderiza os 3 quizzes sem violações axe (WCAG 2.1 AA)', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="v8-quiz-a11y-harness"]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(
      results.violations,
      `Violations:\n${JSON.stringify(results.violations, null, 2)}`
    ).toEqual([]);
  });

  test('cada quiz expõe radiogroup com aria-labelledby resolvendo a label', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="v8-quiz-a11y-harness"]');

    const groups = await page.getByRole('radiogroup').all();
    expect(groups.length).toBe(3);

    for (const group of groups) {
      const labelId = await group.getAttribute('aria-labelledby');
      expect(labelId, 'radiogroup deve ter aria-labelledby').toBeTruthy();
      const label = page.locator(`#${labelId}`);
      await expect(label).toHaveCount(1);
      await expect(label).not.toBeEmpty();
    }
  });

  test('roving tabIndex: exatamente um radio tabbable por grupo', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="v8-quiz-a11y-harness"]');

    const groups = await page.getByRole('radiogroup').all();
    for (const group of groups) {
      const tabbable = await group.locator('[role="radio"][tabindex="0"]').count();
      const total = await group.locator('[role="radio"]').count();
      expect(tabbable, `grupo com ${total} radios deve ter exatamente 1 tabbable`).toBe(1);
    }
  });

  test('keyboard nav: ArrowRight no radiogroup move foco para o próximo', async ({ page }) => {
    await page.goto(HARNESS_URL);
    await page.waitForSelector('[data-testid="v8-quiz-a11y-harness"]');

    const firstGroup = page.getByRole('radiogroup').first();
    const radios = firstGroup.locator('[role="radio"]');

    await radios.nth(0).focus();
    await page.keyboard.press('ArrowRight');

    await expect(radios.nth(1)).toBeFocused();
    await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');
  });
});
