import { test, expect } from '@playwright/test';
import { demoCurriculum } from '../../shared/src/index.js';
test('administrator imports, edits, publishes and manages term-specific directory data', async ({
  page,
}, info) => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL,
    'Run pnpm test:e2e to create isolated synthetic admin fixtures.',
  );
  const runId = process.env.E2E_RUN_ID!;
  const sourceUrl = `https://example.com/unipath-e2e/${runId}`;
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Academic data, with care.' })).toBeVisible();
  await page.goto('/app/admin');
  await expect(page.getByRole('heading', { name: 'Academic data, with care.' })).toBeVisible();
  await page.getByRole('button', { name: 'Import curriculum', exact: true }).click();
  const doc = {
    ...demoCurriculum,
    slug: `e2e-${runId}-${info.project.name}`,
    version: `Synthetic admin browser ${info.project.name}`,
  };
  await page.getByLabel('Import content', { exact: true }).fill(JSON.stringify(doc));
  await page.getByRole('button', { name: 'Validate & import draft', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Validated curriculum imported');
  const editor = page.getByLabel('Curriculum JSON editor', { exact: true });
  for (const malformed of ['{"courses":{}}', '{"courses":null}', '{broken']) {
    await editor.fill(malformed);
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(editor).toHaveValue(malformed);
    await expect(page.getByRole('heading', { name: 'Academic data, with care.' })).toBeVisible();
    await expect(page.locator('.admin-course-list button')).toHaveCount(0);
  }
  await editor.fill(JSON.stringify(doc));
  await page.locator('.admin-course-list button').filter({ hasText: 'CS101' }).click();
  await page
    .getByLabel('Course JSON editor', { exact: true })
    .fill(JSON.stringify({ ...doc.courses[0], title: 'Synthetic reviewed foundation' }));
  await page.getByRole('button', { name: 'Apply to draft', exact: true }).click();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Draft saved');
  await page.getByRole('button', { name: 'Validate & publish', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Curriculum published');
  await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeDisabled();
  const publishedRecords = await (await page.request.get('/api/admin/curricula')).json();
  const publishedId = publishedRecords.find(
    (r: { document: { slug: string } }) => r.document.slug === doc.slug,
  ).id;
  await page.getByRole('button', { name: 'Instructors & offerings', exact: true }).click();
  await page.getByRole('button', { name: 'Add instructor', exact: true }).click();
  const name = `Synthetic instructor ${runId} ${info.project.name}`;
  await page.getByLabel('Directory record JSON', { exact: true }).fill(
    JSON.stringify({
      name,
      department: 'Synthetic browser tests',
      sourceUrl,
      verifiedAt: '2026-10-22',
    }),
  );
  await page.getByRole('button', { name: 'Save verified record', exact: true }).click();
  await expect(page.locator('.directory-row').filter({ hasText: name })).toBeVisible();
  const response = await page.request.get('/api/admin/directory');
  const directory = await response.json();
  const instructor = directory.instructors.find((i: { name: string }) => i.name === name);
  await page.getByRole('button', { name: 'Add offering', exact: true }).click();
  await page.getByLabel('Directory record JSON', { exact: true }).fill(
    JSON.stringify({
      curriculumId: publishedId,
      code: 'CS101',
      term: `Synthetic ${info.project.name}`,
      campus: 'Abu Dhabi',
      section: 'E2E',
      schedule: null,
      sourceUrl,
      verifiedAt: '2026-10-22',
      instructorId: instructor.id,
    }),
  );
  await page.getByRole('button', { name: 'Save verified record', exact: true }).click();
  await expect(
    page.locator('.directory-row').filter({ hasText: `Synthetic ${info.project.name}` }),
  ).toBeVisible();
});
