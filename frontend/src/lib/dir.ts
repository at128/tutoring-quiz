// Direction helpers. UI chrome is English; user text is rendered with dir="auto".

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/

export const hasArabic = (text: string) => ARABIC.test(text)

const ARABIC_LABELS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و']
const LATIN_LABELS = ['A', 'B', 'C', 'D', 'E', 'F']

/** Option letters: أ ب ج د for an Arabic question, A B C D otherwise. */
export const optionLabel = (index: number, questionText: string) =>
  (hasArabic(questionText) ? ARABIC_LABELS : LATIN_LABELS)[index] ?? String(index + 1)
