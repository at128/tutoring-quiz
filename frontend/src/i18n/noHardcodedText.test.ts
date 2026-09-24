import { describe, expect, it } from 'vitest'

// Every word the interface shows must come from the dictionaries, or the Arabic screen would show English.
// This scans the component sources for the three ways English slips in: JSX text, text attributes, and
// sentence-like string literals.
const sources = import.meta.glob(['../**/*.tsx', '!../**/*.test.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const JSX_TEXT = />\s*([^<>{}\n]*[A-Za-z]{2,}[^<>{}\n]*)</g
const TEXT_ATTRIBUTE = /\b(aria-label|title|label|placeholder|alt|backLabel)="([^"]*[A-Za-z][^"]*)"/g
const SENTENCE_LITERAL = /['`]([A-Z][a-z]+(?: [A-Za-z’']+)+[.…!?]?)['`]/g

function findings(path: string, text: string): string[] {
  const code = text
    .split('\n')
    .filter((line) => !/^\s*(import|\/\/|\*|\/\*\*)/.test(line))
    .join('\n')
  const found: string[] = []
  for (const match of code.matchAll(JSX_TEXT)) {
    const words = match[1].trim()
    // Generic type arguments, comparisons and arrow functions can look like ">text<" to a regex: code, not copy.
    const code = /[=;()]|=>|\bextends\b|\bkeyof\b/.test(words) || /^(return|else|null|true|false|await|typeof)$/.test(words)
    const identifier = /^[a-z]+[A-Z]\w*$/.test(words)
    if (words && !code && !identifier) found.push(`${path}: text "${words}"`)
  }
  for (const match of code.matchAll(TEXT_ATTRIBUTE)) found.push(`${path}: ${match[1]}="${match[2]}"`)
  for (const match of code.matchAll(SENTENCE_LITERAL)) found.push(`${path}: literal "${match[1]}"`)
  return found
}

describe('interface text', () => {
  it('scans every component file', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(30)
  })

  it('has no hardcoded English in components (it all comes from i18n/en.ts and i18n/ar.ts)', () => {
    const all = Object.entries(sources).flatMap(([path, text]) => findings(path, text))
    expect(all).toEqual([])
  })

  it('would catch hardcoded text (the scanner itself works)', () => {
    expect(findings('x.tsx', '<span>Sign in</span>')).toHaveLength(1)
    expect(findings('x.tsx', '<strong>3</strong> answered</span>')).toHaveLength(1)
    expect(findings('x.tsx', '<button aria-label="Close" />')).toHaveLength(1)
    expect(findings('x.tsx', "const label = 'Mark as correct'")).toHaveLength(1)
    expect(findings('x.tsx', '<span>{t.login.title}</span>')).toHaveLength(0)
  })
})
