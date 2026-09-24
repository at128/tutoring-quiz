// How a quiz charges for a wrong answer, as the server sends it: a percentage of the question's points (0 = no negative
// marking), or a fixed number of points that is never more than the question is worth. The server does the scoring;
// the interface only describes the rule.

export type Marking = { kind: 'none' } | { kind: 'percent'; percent: number } | { kind: 'points'; points: number }

export type MarkingFields = { wrongAnswerPenaltyPercent: number; wrongAnswerPenaltyPoints: number | null }

export function markingOf(quiz: MarkingFields): Marking {
  if (quiz.wrongAnswerPenaltyPoints != null) return { kind: 'points', points: quiz.wrongAnswerPenaltyPoints }
  return quiz.wrongAnswerPenaltyPercent === 0 ? { kind: 'none' } : { kind: 'percent', percent: quiz.wrongAnswerPenaltyPercent }
}

/** Points a wrong answer costs on a question worth `questionPoints` (the server's rule, for examples in the interface). */
export const deductionFor = (marking: Marking, questionPoints: number): number =>
  marking.kind === 'none'
    ? 0
    : marking.kind === 'percent'
      ? (questionPoints * marking.percent) / 100
      : Math.min(marking.points, questionPoints)
