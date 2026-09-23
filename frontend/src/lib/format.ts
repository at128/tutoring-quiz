// Number formatting for scores. Negative numbers use a real minus sign (U+2212).

const MINUS = '−'

const twoDecimals = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const oneDecimal = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

const signed = (value: number, format: Intl.NumberFormat) =>
  value < 0 ? `${MINUS}${format.format(Math.abs(value))}` : format.format(value)

/** 3.25 → "3.25", 4 → "4", −4.5 → "−4.5". */
export const formatScore = (value: number) => signed(value, twoDecimals)

/** 36.1 → "36.1 %". */
export const formatPercent = (value: number) => `${signed(value, oneDecimal)} %`

/** How a wrong answer is marked, in plain words. */
export const markingRule = (penaltyPercent: number) =>
  penaltyPercent === 0
    ? 'No negative marking — a wrong answer costs nothing.'
    : `Negative marking: a wrong answer loses ${penaltyPercent} % of that question's points. Unanswered questions cost nothing.`

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
