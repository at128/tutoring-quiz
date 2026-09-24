import type { Lang } from '../../../i18n/lang'

/**
 * Radio-group arrows for the answer options: down moves forward and up moves back. Across the line, "forward"
 * follows the reading direction: → in English, ← in Arabic. Any other key → 0 (not handled).
 */
export function optionStep(key: string, lang: Lang): -1 | 0 | 1 {
  const forward = lang === 'ar' ? 'ArrowLeft' : 'ArrowRight'
  const back = lang === 'ar' ? 'ArrowRight' : 'ArrowLeft'
  if (key === 'ArrowDown' || key === forward) return 1
  if (key === 'ArrowUp' || key === back) return -1
  return 0
}
