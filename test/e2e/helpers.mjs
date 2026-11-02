import { test as base, expect } from '@playwright/test';
export { expect };
// Router catches render errors; capture console.error as well as uncaught errors.
export const test = base.extend({
  errors: [
    async ({ page }, use) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await use(errors);
      expect(errors, 'browser errors').toEqual([]);
    },
    { auto: true },
  ],
});
export async function openApp(page, url = '/', options = {}) {
  await page.context().addInitScript((options) => {
    window.testOptions = options;
  }, options);
  await page.goto(url);
  await page.waitForFunction(() => window.ready === true);
}
export async function navigate(page, to, options) {
  await page.evaluate(
    ({ to, options }) => window.fixture.navigateRouter(window.app.core, to, options),
    { to, options },
  );
}
