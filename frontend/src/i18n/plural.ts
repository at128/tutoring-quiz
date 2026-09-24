// Arabic has six plural forms. Intl.PluralRules knows which one a number takes; the words come from the dictionary.
//   0 → zero, 1 → one, 2 → two, 3–10 → few, 11–99 → many, 100, 101, 102 … → other.

export type ArabicForms = {
  zero: string
  one: string
  two: string
  few: (n: number) => string
  many: (n: number) => string
  other: (n: number) => string
}

const rules = new Intl.PluralRules('ar')

/** Only whole counts are pluralized in the interface; anything else (e.g. 2.5 points) takes the "other" form. */
export function arabicPlural(count: number, forms: ArabicForms): string {
  if (!Number.isInteger(count)) return forms.other(count)
  switch (rules.select(count)) {
    case 'zero':
      return forms.zero
    case 'one':
      return forms.one
    case 'two':
      return forms.two
    case 'few':
      return forms.few(count)
    case 'many':
      return forms.many(count)
    default:
      return forms.other(count)
  }
}

/** English: "1 question", "2 questions". */
export const englishPlural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
