import { expect, test, type Page } from '@playwright/test'
import { ar } from '../src/i18n/ar'
import { en } from '../src/i18n/en'

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

async function login(page: Page, username: string, language: typeof en) {
  await page.goto('/login')
  await page.locator('#username').fill(username)
  await page.locator('#password').fill('Student@2026')
  await page.getByRole('button', { name: language.login.submit, exact: true }).click()
  await expect(page).toHaveURL(/\/student(?:$|\?)/)
}

async function takeAvailableQuiz(page: Page, language: typeof en, title: RegExp) {
  const card = page.locator('article').filter({ hasText: title })
  await expect(card).toBeVisible()
  await card.getByRole('link', { name: language.student.viewQuiz }).click()
  await expect(page.getByText(language.start.beforeYouStart)).toBeVisible()
  await noHorizontalOverflow(page)
  await page.getByRole('button', { name: new RegExp(`^${language.start.start}`) }).click()
  await expect(page).toHaveURL(/\/student\/attempts\/[^/]+$/)

  const firstOption = page.getByRole('radio').first()
  await firstOption.click()
  await expect(page.getByText(language.take.saved, { exact: true })).toBeVisible()
  await expect(firstOption).toHaveAttribute('aria-checked', 'true')

  // A real browser reload must read the saved selection and the running deadline from the server.
  await page.reload()
  await expect(page.getByRole('radio').first()).toHaveAttribute('aria-checked', 'true')
  await noHorizontalOverflow(page)

  await page.getByRole('button', { name: language.take.questionsButton, exact: true }).click()
  const navigator = page.locator('dialog[open]')
  await navigator.getByRole('button', { name: language.take.submit, exact: true }).click()
  const confirmation = page.locator('dialog[open]')
  await expect(confirmation.getByText(language.take.submitTitle)).toBeVisible()
  await confirmation.getByRole('button', { name: language.take.submit, exact: true }).click()
  await expect(page).toHaveURL(/\/result$/)
  await expect(page.getByText(language.result.yourScore, { exact: true })).toBeVisible()
  await noHorizontalOverflow(page)
}

test.describe('Arabic phone journey', () => {
  test.use({ viewport: { width: 360, height: 780 }, locale: 'ar-JO' })

  test('device language, persistent toggle, login, autosave, reload, submit and result', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await noHorizontalOverflow(page)

    await page.getByRole('button', { name: ar.language.switchToLabel }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.getByRole('button', { name: en.language.switchToLabel }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await login(page, '10a-03', ar)
    await noHorizontalOverflow(page)
    await takeAvailableQuiz(page, ar, /قواعد اللغة العربية/)
  })
})

test.describe('English desktop journey', () => {
  test.use({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' })

  test('login, autosave, reload, submit and result', async ({ page }) => {
    await login(page, '10a-04', en)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
    await noHorizontalOverflow(page)
    await takeAvailableQuiz(page, en, /Algebra/)
  })

  test('submit waits for a delayed save followed by a reverted answer', async ({ page }) => {
    await login(page, '10a-06', en)
    await page.locator('article').filter({ hasText: /Algebra/ })
      .getByRole('link', { name: en.student.viewQuiz }).click()
    await page.getByRole('button', { name: en.start.start, exact: true }).click()
    await expect(page).toHaveURL(/\/student\/attempts\/[^/]+$/)
    const attemptId = new URL(page.url()).pathname.split('/')[3]

    let releaseFirstSave: () => void = () => {}
    let firstSaveReached: () => void = () => {}
    const firstSaveStarted = new Promise<void>((resolve) => { firstSaveReached = resolve })
    const firstSaveGate = new Promise<void>((resolve) => { releaseFirstSave = resolve })
    let held = false
    await page.route('**/api/student/attempts/**/answers/**', async (route) => {
      if (!held && route.request().method() === 'PUT') {
        held = true
        const response = await route.fetch() // server has saved it, but the browser has not heard back
        firstSaveReached()
        await firstSaveGate
        await route.fulfill({ response })
      } else {
        await route.continue()
      }
    })

    await page.getByRole('radio').first().click()
    await firstSaveStarted
    await page.getByRole('button', { name: en.take.clearAnswer }).click()
    await page.getByRole('button', { name: en.take.questionsButton, exact: true }).click()
    await page.locator('dialog[open]').getByRole('button', { name: en.take.submit, exact: true }).click()
    const confirmation = page.locator('dialog[open]')
    await confirmation.getByRole('button', { name: en.take.submit, exact: true }).click()
    await expect(confirmation.getByText(en.take.pendingBeforeSubmit(1))).toBeVisible()

    releaseFirstSave()
    await expect(page).toHaveURL(/\/result$/)
    const response = await page.request.get(`/api/student/attempts/${attemptId}/result`)
    expect(response.ok()).toBe(true)
    const result = await response.json() as { score: number; correctCount: number; wrongCount: number; unansweredCount: number }
    expect(result).toMatchObject({ score: 0, correctCount: 0, wrongCount: 0 })
    expect(result.unansweredCount).toBeGreaterThan(0)
  })
})
