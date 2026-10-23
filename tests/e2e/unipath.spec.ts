import { test, expect } from '@playwright/test';
test('guest can explore, change progress, save a plan and calculate GPA', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your degree./ })).toBeVisible();
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little clearer, Jamie.' })).toBeVisible();
  await expect(page.locator('.metric-card').filter({ hasText: 'Completed credits' })).toContainText(
    '64',
  );
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-dashboard.png`,
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Open degree map', exact: true }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(47);
  await page.getByRole('textbox', { name: 'Search degree map' }).fill('Software Testing');
  await page.getByRole('textbox', { name: 'Search degree map' }).fill('');
  await page.locator('.react-flow__node').filter({ hasText: 'Software Testing' }).click();
  await expect(page.locator('.selected-course-bar')).toContainText('SE303');
  await page.getByRole('button', { name: /View course & update/ }).click();
  await expect(page.getByRole('dialog')).toContainText('SE301');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/app/courses');
  await page.getByRole('textbox', { name: 'Search course explorer' }).fill('Formal Methods');
  await expect(page.locator('.explorer-card')).toHaveCount(1);
  await page.locator('.explorer-card').click();
  await page.getByRole('button', { name: 'Mark completed', exact: true }).click();
  await page.goto('/app');
  await expect(page.locator('.metric-card').filter({ hasText: 'Completed credits' })).toContainText(
    '67',
  );
  await page.goto('/app/planner');
  await page.locator('.planner-option').filter({ hasText: 'Software Project Management' }).click();
  await page.getByRole('button', { name: 'Save semester plan', exact: true }).click();
  await expect(page.locator('.saved-plan')).toContainText('Spring 2027');
  await page.reload();
  await expect(page.locator('.saved-plan')).toContainText('Spring 2027');
  await page.goto('/app/gpa');
  await expect(page.locator('.gpa-value')).toContainText('3.50');
  await page.getByLabel('GPA grade 3', { exact: true }).selectOption('A');
  await expect(page.locator('.gpa-value')).toContainText('3.83');
  await page.getByRole('button', { name: 'Use dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveClass('dark');
  await page.reload();
  await expect(page.locator('html')).toHaveClass('dark');
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.evaluate(() => window.innerWidth),
  );
  expect(errors).toEqual([]);
});
test('a registered student can onboard, save records, log out and return', async ({
  page,
}, testInfo) => {
  const email = `e2e-${process.env.E2E_RUN_ID ?? 'direct'}-${testInfo.project.name}-${Date.now()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Your name', { exact: true }).fill('Browser Test');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('browser-test-password-long');
  await page.getByRole('button', { name: 'Create my workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Let’s make this your path.' })).toBeVisible();
  await page.getByRole('checkbox', { name: /I understand the data limitations/ }).check();
  await page.getByRole('button', { name: 'Continue to my courses', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make your progress yours.' })).toBeVisible();
  await page.getByLabel('Status CS101', { exact: true }).selectOption('COMPLETED');
  await page.getByLabel('Grade CS101', { exact: true }).selectOption('A');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Course records saved');
  await page.reload();
  await expect(page.getByLabel('Status CS101', { exact: true })).toHaveValue('COMPLETED');
  await page.goto('/app/settings');
  await expect(page.getByRole('heading', { name: 'Make yourself at home.' })).toBeVisible();
  if (testInfo.project.name.startsWith('mobile'))
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Your degree./ })).toBeVisible();
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('browser-test-password-long');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A little clearer, Browser.' })).toBeVisible();
  await expect(page.locator('.metric-card').filter({ hasText: 'Completed credits' })).toContainText(
    '3',
  );
  await page.goto('/app/admin');
  await expect(page.getByRole('heading', { name: 'A little clearer, Browser.' })).toBeVisible();
});
