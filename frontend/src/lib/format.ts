// Number formatting for scores. Negative numbers use a real minus sign (U+2212).

const MINUS = '−'

const twoDecimals = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const oneDecimal = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 })

const signed = (value: number, format: Intl.NumberFormat) =>
  value < 0 ? `${MINUS}${format.format(Math.abs(value))}` : format.format(value)

/** 3.25 → "3.25", 4 → "4", −4.5 → "−4.5". */
export const formatScore = (value: number) => signed(value, twoDecimals)

/** 36.1 → "36.1%", −6.25 → "−6.3%". */
export const formatPercent = (value: number) => `${signed(value, oneDecimal)}%`

/** Rounds like the server (MidpointRounding.AwayFromZero): −6.25 → −6.3. */
export function roundAwayFromZero(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor
}

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`
