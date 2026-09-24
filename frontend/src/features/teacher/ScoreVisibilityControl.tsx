import { useMutation, useQueryClient } from '@tanstack/react-query'
import { setScoreVisibility, teacherKeys } from '../../api/teacher'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { useLanguage } from '../../i18n/LanguageContext'

/**
 * Shows or hides scores from students, in any state of the quiz (it never changes a score). The server stops sending
 * scores to students while hidden; the change applies to their next request.
 */
export function ScoreVisibilityControl({ quizId, visible }: { quizId: string; visible: boolean }) {
  const { t } = useLanguage()
  const m = t.editor
  const queryClient = useQueryClient()
  const change = useMutation({
    mutationFn: (next: boolean) => setScoreVisibility(quizId, next),
    onSuccess: (view) => {
      queryClient.setQueryData(teacherKeys.quiz(quizId), view)
      void queryClient.invalidateQueries({ queryKey: teacherKeys.results(quizId) })
      void queryClient.invalidateQueries({ queryKey: teacherKeys.quizzes() })
    },
  })

  return (
    <div className="flex flex-col gap-2 rounded-option border border-rule bg-paper px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Icon name="eye" className="mt-0.5 size-5 text-ink-2" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">{visible ? m.scoresShownState : m.scoresHiddenState}</span>
            <span className="text-small leading-normal text-muted">{visible ? m.showScoresOn : m.showScoresOff}</span>
          </div>
        </div>
        <Button variant="secondary" loading={change.isPending} onClick={() => change.mutate(!visible)}>
          {visible ? m.hideScores : m.revealScores}
        </Button>
      </div>
      {change.isError && (
        <p role="alert" className="text-small text-red">
          {t.errors.tryLater}
        </p>
      )}
    </div>
  )
}
