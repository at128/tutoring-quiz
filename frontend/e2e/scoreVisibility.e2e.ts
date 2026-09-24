import { expect, test, type Page } from '@playwright/test'
import { en } from '../src/i18n/en'

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:18081'

async function signIn(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: en.login.submit, exact: true }).click()
}

async function quizWindow(page: Page) {
  return page.evaluate(() => {
    const pad = (number: number) => String(number).padStart(2, '0')
    const local = (offset: number) => {
      const date = new Date(Date.now() + offset)
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
    return { opensAt: local(-5 * 60_000), closesAt: local(60 * 60_000) }
  })
}

test.describe('score visibility journey', () => {
  test.use({ viewport: { width: 1280, height: 900 }, locale: 'en-GB' })

  test('teacher hides scores, sees answers, then reveals the same stored score to the student', async ({ page, browser }) => {
    await signIn(page, 'teacher.sami', 'Teacher@2026')
    await expect(page).toHaveURL(/\/teacher$/)
    await page.getByRole('link', { name: en.teacher.newQuiz }).click()
    const title = `Score visibility ${Date.now()}`
    await page.locator('#title').fill(title)
    await page.locator('label').filter({ hasText: '11A' }).locator('input[type="checkbox"]').check()
    const window = await quizWindow(page)
    await page.locator('#opensAt').fill(window.opensAt)
    await page.locator('#closesAt').fill(window.closesAt)
    await page.locator('#q0-text').fill('Which answer is correct?')
    for (const [index, answer] of ['Wrong A', 'Correct', 'Wrong B', 'Wrong C'].entries())
      await page.locator(`input[name="questions.0.options.${index}.text"]`).fill(answer)
    await page.locator('input[type="radio"][value="1"]').first().check()
    await page.getByLabel(en.editor.showScores).uncheck()
    await page.getByRole('button', { name: en.editor.publish, exact: true }).click()
    await expect(page).toHaveURL(/\/teacher\/quizzes\/[^/]+\/edit$/)
    const quizId = new URL(page.url()).pathname.split('/')[3]

    const studentContext = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 900 },
      locale: 'en-GB',
      timezoneId: 'Asia/Amman',
    })
    try {
      const student = await studentContext.newPage()
      await signIn(student, '11a-02', 'Student@2026')
      await expect(student).toHaveURL(/\/student$/)
      const card = student.locator('article').filter({ hasText: title })
      await card.getByRole('link', { name: en.student.viewQuiz }).click()
      await student.getByRole('button', { name: en.start.start, exact: true }).click()
      await expect(student).toHaveURL(/\/student\/attempts\/[^/]+$/)
      await student.getByRole('radio').nth(1).click()
      await expect(student.getByText(en.take.saved, { exact: true })).toBeVisible()
      await student.getByRole('button', { name: en.take.questionsButton, exact: true }).click()
      await student.locator('dialog[open]').getByRole('button', { name: en.take.submit, exact: true }).click()
      await student.locator('dialog[open]').getByRole('button', { name: en.take.submit, exact: true }).click()
      await expect(student).toHaveURL(/\/result$/)
      await expect(student.getByText(en.result.scoreHiddenTitle)).toBeVisible()
      await expect(student.getByText(en.result.yourScore, { exact: true })).toHaveCount(0)
      const resultPath = new URL(student.url()).pathname

      await page.goto(`/teacher/quizzes/${quizId}/results`)
      await expect(page.getByRole('heading', { name: title })).toBeVisible()
      await page.getByRole('link', { name: en.results.viewAnswers }).first().click()
      await expect(page.getByText(en.answers.studentAnswer, { exact: true })).toBeVisible()
      await expect(page.getByText(en.answers.correctAnswer, { exact: true })).toBeVisible()
      await page.goto(`/teacher/quizzes/${quizId}/results`)
      await page.getByRole('button', { name: en.editor.revealScores }).click()
      await expect(page.getByRole('button', { name: en.editor.hideScores })).toBeVisible()

      await student.goto(resultPath)
      await expect(student.getByText(en.result.yourScore, { exact: true })).toBeVisible()
      await expect(student.getByText(en.result.scoreHiddenTitle)).toHaveCount(0)
    } finally {
      await studentContext.close()
    }
  })
})
