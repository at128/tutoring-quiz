import { expect, test, type Page } from '@playwright/test'
import { en } from '../src/i18n/en'

// The M4 review's editor findings, in a real browser (English desktop).
test.use({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' })

async function openNewQuiz(page: Page) {
  await page.goto('/login')
  await page.locator('#username').fill('teacher.lina')
  await page.locator('#password').fill('Teacher@2026')
  await page.getByRole('button', { name: en.login.submit, exact: true }).click()
  await expect(page).toHaveURL(/\/teacher$/)
  await page.getByRole('link', { name: en.teacher.newQuiz }).click()
}

/** datetime-local values in the browser's zone, `offsetMs` from the page's (possibly fake) clock. */
const localInput = (page: Page, offsetMs: number) =>
  page.evaluate((offset) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const date = new Date(Date.now() + offset)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }, offsetMs)

test('M4-03: a class list that fails to load says so, and Try again recovers it', async ({ page }) => {
  let failing = true
  await page.route('**/api/teacher/classrooms', (route) =>
    failing
      ? route.fulfill({ status: 503, contentType: 'application/problem+json', body: '{"status":503,"code":"unavailable"}' })
      : route.continue(),
  )
  await openNewQuiz(page)

  const alert = page.getByRole('alert').filter({ hasText: en.errors.didNotLoad })
  await expect(alert).toBeVisible({ timeout: 20_000 }) // after the query's own retries
  failing = false
  await alert.getByRole('button', { name: en.errors.tryAgain }).click()
  await expect(page.locator('label').filter({ hasText: '10A' }).locator('input[type="checkbox"]')).toBeVisible()
  await expect(alert).toBeHidden()
})

test('M4-02: publishing after the closing time has passed shows why, instead of doing nothing', async ({ page }) => {
  await page.clock.install()
  await openNewQuiz(page)
  await page.locator('#title').fill('Closes in two minutes')
  await page.locator('label').filter({ hasText: '10A' }).locator('input[type="checkbox"]').check()
  await page.locator('#opensAt').fill(await localInput(page, -5 * 60_000))
  await page.locator('#closesAt').fill(await localInput(page, 2 * 60_000))
  await page.locator('#q0-text').fill('2 + 3 = ?')
  for (const [index, answer] of ['4', '5', '6', '7'].entries())
    await page.locator(`input[name="questions.0.options.${index}.text"]`).fill(answer)
  await page.locator('input[type="radio"][value="1"]').first().check()

  // The teacher leaves the editor open past the closing time, then presses Publish.
  await page.clock.fastForward('05:00')
  await page.getByRole('button', { name: en.editor.publish, exact: true }).click()

  await expect(page.getByText(en.editor.closesFuture).filter({ visible: true }).first()).toBeVisible()
  await expect(page).toHaveURL(/\/teacher\/quizzes\/new$/)
})
