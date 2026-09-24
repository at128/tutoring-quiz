import type { Messages } from '../../i18n/en'
import type { Marking } from '../../lib/marking'

// The teacher screens' words for a quiz's negative marking: a percentage of the question's points, or a fixed mark.

/** "25% of the question’s points per wrong answer" / "0.5 points per wrong answer (at most the question’s points)". */
export const markingText = (marking: Marking, t: Messages) =>
  marking.kind === 'points'
    ? t.teacher.markingLongPoints(marking.points)
    : t.teacher.markingLong(marking.kind === 'percent' ? marking.percent : 0)

/** "−25% per wrong" / "−0.5 pt per wrong" / "No negative marking". */
export const markingShortText = (marking: Marking, t: Messages) =>
  marking.kind === 'points'
    ? t.teacher.markingShortPoints(marking.points)
    : t.teacher.markingShort(marking.kind === 'percent' ? marking.percent : 0)

/** The same, inside a sentence ("no negative marking" in lower case). */
export const markingInlineText = (marking: Marking, t: Messages) =>
  marking.kind === 'points'
    ? t.teacher.markingShortPoints(marking.points)
    : t.teacher.markingInline(marking.kind === 'percent' ? marking.percent : 0)
