import type { AttemptResult } from '../../api/types'
import type { Messages } from '../../i18n/en'

/** Plain words for how negative marking affected this score (the server already applied it). */
export function scoringExplanation(result: AttemptResult, t: Messages): string {
  const k = result.wrongAnswerPenaltyPercent
  if (k === 0) return t.result.noMarking
  const rule = t.result.markingRule(k)
  // The server never scores below 0: a 0 with wrong answers means the deductions used up what was earned.
  if (result.score <= 0 && result.wrongCount > 0) return `${rule} ${t.result.stoppedAtZero}`
  if (result.wrongCount === 0) return `${rule} ${t.result.noWrong}`
  return `${rule} ${t.result.wrongLowered(result.wrongCount)}`
}
