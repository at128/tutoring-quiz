import type { AttemptResult } from '../../api/types'
import type { Messages } from '../../i18n/en'
import { markingOf } from '../../lib/marking'

/** Plain words for how negative marking affected this score (the server already applied it). */
export function scoringExplanation(result: AttemptResult, t: Messages): string {
  const marking = markingOf(result)
  if (marking.kind === 'none') return t.result.noMarking
  const rule = marking.kind === 'points' ? t.result.markingRulePoints(marking.points) : t.result.markingRule(marking.percent)
  const wrong = result.wrongCount ?? 0
  // The server never scores below 0: a 0 with wrong answers means the deductions used up what was earned.
  if ((result.score ?? 0) <= 0 && wrong > 0) return `${rule} ${t.result.stoppedAtZero}`
  if (wrong === 0) return `${rule} ${t.result.noWrong}`
  return `${rule} ${t.result.wrongLowered(wrong)}`
}
