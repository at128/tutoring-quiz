// Unicode isolation for numbers inside translated sentences. In an Arabic (RTL) sentence, "−4.5" or "−25%" would
// otherwise be reordered to "4.5−"; LRI … PDI keeps the number left-to-right without affecting the words around it.

const LRI = '⁦'
const PDI = '⁩'

export const ltr = (value: string | number) => `${LRI}${value}${PDI}`

/** For tests and plain-text comparisons. */
export const stripIsolates = (text: string) => text.replace(/[⁦-⁩]/g, '')
