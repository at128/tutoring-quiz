import { expect, test, type Page } from '@playwright/test'
import { ar } from '../src/i18n/ar'

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:18081'

async function signIn(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: ar.login.submit, exact: true }).click()
}

/** The browser context uses Asia/Amman, so these are the values a teacher types into datetime-local. */
async function openWindowAroundNow(page: Page) {
  return page.evaluate(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const local = (offsetMs: number) => {
      const date = new Date(Date.now() + offsetMs)
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    return { opensAt: local(-5 * 60_000), closesAt: local(60 * 60_000) }
  })
}

test.describe('Arabic editor', () => {
  test.use({ viewport: { width: 360, height: 780 }, locale: 'ar-JO' })

  test('text that shows nothing (tatweel, diacritics, invisible marks) is refused in Arabic, and nothing is saved', async ({ page }) => {
    await signIn(page, 'teacher.lina', 'Teacher@2026')
    await expect(page).toHaveURL(/\/teacher$/)
    await page.getByRole('link', { name: ar.teacher.newQuiz }).click()
    await page.locator('#title').fill('ـــ')
    await page.locator('#q0-text').fill('ـَـِ')
    await page.locator('input[name="questions.0.options.0.text"]').fill('\u200c\u00a0')
    await page.getByRole('button', { name: ar.editor.saveDraft, exact: true }).click()

    await expect(page.getByText(ar.editor.titleLength(3, 200)).first()).toBeVisible()
    await expect(page.getByText(ar.editor.writeQuestion).first()).toBeVisible()
    await expect(page.getByText(ar.editor.writeOption).first()).toBeVisible()
    await expect(page).toHaveURL(/\/teacher\/quizzes\/new$/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})

test.describe('Arabic teacher-to-student journey', () => {
  test.use({ viewport: { width: 360, height: 780 }, locale: 'ar-JO' })

  test('creates and publishes an Arabic quiz, student takes it, teacher sees the result', async ({ page, browser }) => {
    await signIn(page, 'teacher.khaled', 'Teacher@2026')
    await expect(page).toHaveURL(/\/teacher$/)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

    await page.getByRole('link', { name: ar.teacher.newQuiz }).click()
    await expect(page.getByRole('heading', { name: ar.editor.newTitle })).toBeVisible()
    const title = `اختبار جمع آلي ${Date.now()}`
    await page.locator('#title').fill(title)
    await page.locator('label').filter({ hasText: '10A' }).locator('input[type="checkbox"]').check()
    const quizTimes = await openWindowAroundNow(page)
    await page.locator('#opensAt').fill(quizTimes.opensAt)
    await page.locator('#closesAt').fill(quizTimes.closesAt)
    await page.locator('#q0-text').fill('كم يساوي اثنان زائد ثلاثة؟')
    for (const [index, answer] of ['أربعة', 'خمسة', 'ستة', 'سبعة'].entries())
      await page.locator(`input[name="questions.0.options.${index}.text"]`).fill(answer)
    await page.locator('input[type="radio"][value="1"]').first().check()
    await page.getByRole('button', { name: ar.editor.publish, exact: true }).click()
    await expect(page).toHaveURL(/\/teacher\/quizzes\/[^/]+\/edit$/)
    await expect(page.getByText(ar.editor.published)).toBeVisible()
    const quizId = new URL(page.url()).pathname.split('/')[3]
    expect(quizId).toBeTruthy()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    const studentContext = await browser.newContext({
      baseURL,
      viewport: { width: 360, height: 780 },
      locale: 'ar-JO',
      timezoneId: 'Asia/Amman',
    })
    try {
      const student = await studentContext.newPage()
      await signIn(student, '10a-05', 'Student@2026')
      await expect(student).toHaveURL(/\/student$/)
      const card = student.locator('article').filter({ hasText: title })
      await expect(card).toBeVisible()
      await card.getByRole('link', { name: ar.student.viewQuiz }).click()
      await student.getByRole('button', { name: ar.start.start, exact: true }).click()
      await expect(student).toHaveURL(/\/student\/attempts\/[^/]+$/)
      await student.getByRole('radio').nth(1).click()
      await expect(student.getByText(ar.take.saved, { exact: true })).toBeVisible()
      await student.getByRole('button', { name: ar.take.questionsButton, exact: true }).click()
      await student.locator('dialog[open]').getByRole('button', { name: ar.take.submit, exact: true }).click()
      await student.locator('dialog[open]').getByRole('button', { name: ar.take.submit, exact: true }).click()
      await expect(student).toHaveURL(/\/result$/)
      await expect(student.getByText(ar.result.yourScore, { exact: true })).toBeVisible()
    } finally {
      await studentContext.close()
    }

    await page.goto(`/teacher/quizzes/${quizId}/results`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    const response = await page.request.get(`/api/teacher/quizzes/${quizId}/results`)
    expect(response.ok()).toBe(true)
    const results = await response.json() as { summary: { finalizedCount: number }; rows: { username: string; status: string }[] }
    expect(results.summary.finalizedCount).toBe(1)
    expect(results.rows).toContainEqual(expect.objectContaining({ username: '10a-05', status: 'Submitted' }))
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
