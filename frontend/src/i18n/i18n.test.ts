import { describe, expect, it } from 'vitest'
import { optionStep } from '../features/student/takeQuiz/keys'
import { ar } from './ar'
import { ltr, stripIsolates } from './bidi'
import { en } from './en'
import { detectLang, dirOf } from './lang'
import { arabicPlural } from './plural'

// Sample arguments for every dictionary function, so each one is exercised with realistic values.
const SAMPLE_ARGS: unknown[][] = [[], [0], [1], [2], [3], [11], [100], [25, 40], ['10A', 3], [3, '10A'], ['Thu 8 Oct, 10:00', 'in 2 days'], [[4, 9, 12]], [1, 'answered'], [2, 'failed'], [undefined], [null]]

type Leaf = { path: string; value: string }

/** Every string a dictionary can produce: plain strings, plus each function called with every sample that it accepts. */
function leaves(node: unknown, path = ''): Leaf[] {
  if (typeof node === 'string') return [{ path, value: node }]
  if (typeof node === 'function') {
    return SAMPLE_ARGS.slice(0, 12).flatMap((args) => {
      if (args.length !== node.length) return []
      try {
        const out = (node as (...a: unknown[]) => unknown)(...args)
        return typeof out === 'string' ? [{ path: `${path}(${args.join(',')})`, value: out }] : []
      } catch {
        return []
      }
    })
  }
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
  return []
}

function shape(node: unknown): unknown {
  if (typeof node === 'function') return `fn/${node.length}`
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, shape(v)]))
  return typeof node
}

const LATIN = /[A-Za-z]/
const ARABIC = /[؀-ۿ]/

describe('dictionaries', () => {
  it('have exactly the same keys and function arities in both languages', () => {
    expect(shape(ar)).toEqual(shape(en))
  })

  it('are checked in full (the scan below really sees the whole dictionary)', () => {
    expect(leaves(ar).length).toBeGreaterThan(400)
    expect(leaves(ar).length).toBe(leaves(en).length)
  })

  it('leave no English words in the Arabic interface (outside isolated codes like 10a-07 and the English switch)', () => {
    const allowed = new Set(['language.switchTo', 'language.switchToShort', 'language.switchToLabel', 'language.switchToLang'])
    const offenders = leaves(ar)
      .filter((leaf) => !allowed.has(leaf.path))
      // Isolated runs are deliberate: usernames, class codes and passed-in values (e.g. an English class name).
      .map((leaf) => ({ ...leaf, value: leaf.value.replace(/⁦[^⁩]*⁩/g, '') }))
      // Sample arguments are English on purpose; they are not the dictionary's own words.
      .map((leaf) => ({ ...leaf, value: leaf.value.replace(/Thu 8 Oct, 10:00|in 2 days|10A|answered|failed/g, '') }))
      .filter((leaf) => LATIN.test(leaf.value))
    expect(offenders).toEqual([])
  })

  it('leave no Arabic in the English interface, except the switch to Arabic', () => {
    const offenders = leaves(en).filter((leaf) => !leaf.path.startsWith('language.') && ARABIC.test(leaf.value))
    expect(offenders).toEqual([])
  })

  it('always close every directional isolate they open', () => {
    for (const leaf of leaves(ar)) {
      const opens = (leaf.value.match(/⁦/g) ?? []).length
      const closes = (leaf.value.match(/⁩/g) ?? []).length
      expect(`${leaf.path}: ${opens}`).toBe(`${leaf.path}: ${closes}`)
    }
  })

  it('keep signed numbers and percentages left-to-right inside Arabic sentences', () => {
    expect(ar.student.markingLine(25)).toContain(ltr('25%'))
    expect(ar.teacher.markingShort(25)).toContain(ltr('−25%'))
    expect(ar.start.penaltyDetail(25, '−0.5')).toContain(ltr('−0.5'))
    expect(ar.results.percentOfMax('84.4%', 27)).toContain(ltr('84.4%'))
  })
})

describe('Arabic plurals', () => {
  const forms = {
    zero: 'لا أسئلة',
    one: 'سؤال واحد',
    two: 'سؤالان',
    few: (n: number) => `${n} أسئلة`,
    many: (n: number) => `${n} سؤالًا`,
    other: (n: number) => `${n} سؤال`,
  }

  it.each([
    [0, 'لا أسئلة'],
    [1, 'سؤال واحد'],
    [2, 'سؤالان'],
    [3, '3 أسئلة'],
    [10, '10 أسئلة'],
    [11, '11 سؤالًا'],
    [99, '99 سؤالًا'],
    [100, '100 سؤال'],
    [101, '101 سؤال'],
    [102, '102 سؤال'],
    [103, '103 أسئلة'],
    [111, '111 سؤالًا'],
    [1000, '1000 سؤال'],
  ])('%i → %s', (n, expected) => {
    expect(arabicPlural(n, forms)).toBe(expected)
  })

  it('uses the general form for a fraction', () => {
    expect(arabicPlural(2.5, forms)).toBe('2.5 سؤال')
  })

  it('reads naturally in real sentences', () => {
    expect(ar.take.unansweredCount(1)).toBe('سؤال واحد بلا إجابة')
    expect(ar.take.unansweredCount(2)).toBe('سؤالان بلا إجابة')
    expect(ar.take.unansweredCount(5)).toBe('5 أسئلة بلا إجابة')
    expect(ar.take.unansweredCount(12)).toBe('12 سؤالًا بلا إجابة')
    expect(ar.take.points(1)).toBe('علامة واحدة')
    expect(ar.take.points(2)).toBe('علامتان')
    expect(ar.start.minutes(20)).toBe('20 دقيقة')
    expect(ar.start.minutes(3)).toBe('3 دقائق')
    expect(ar.teacher.quizCount(2)).toBe('اختباران')
    expect(ar.editor.titleLength(3, 120)).toBe('يجب أن يكون طول العنوان بين 3 و120 حرفًا.')
    expect(ar.take.unansweredList([4, 9, 12])).toBe('(4، 9 و12). ستحصل فيها على صفر.')
    expect(en.take.unansweredList([4, 9, 12])).toBe('(4, 9 and 12). They’ll score 0.')
  })
})

describe('language choice', () => {
  it('prefers a saved choice, then the device language', () => {
    expect(detectLang('ar', ['en-US'])).toBe('ar')
    expect(detectLang('en', ['ar-JO'])).toBe('en')
    expect(detectLang(null, ['ar-JO', 'en'])).toBe('ar')
    expect(detectLang(null, ['AR'])).toBe('ar')
    expect(detectLang(null, ['en-GB', 'ar'])).toBe('en')
    expect(detectLang(null, [])).toBe('en')
    expect(detectLang(null, ['', ' ', 'ar-SA'])).toBe('ar')
  })

  it('ignores a corrupted saved value', () => {
    expect(detectLang('fr', ['ar-JO'])).toBe('ar')
    expect(detectLang('', ['en'])).toBe('en')
    expect(detectLang('arabic', ['en'])).toBe('en')
  })

  it('maps the language to a direction', () => {
    expect(dirOf('ar')).toBe('rtl')
    expect(dirOf('en')).toBe('ltr')
  })
})

describe('option arrows follow the reading direction', () => {
  it.each([
    ['ArrowDown', 'en', 1],
    ['ArrowUp', 'en', -1],
    ['ArrowRight', 'en', 1],
    ['ArrowLeft', 'en', -1],
    ['ArrowDown', 'ar', 1],
    ['ArrowUp', 'ar', -1],
    ['ArrowLeft', 'ar', 1],
    ['ArrowRight', 'ar', -1],
    ['Enter', 'ar', 0],
    ['a', 'en', 0],
  ] as const)('%s in %s → %i', (key, lang, step) => {
    expect(optionStep(key, lang)).toBe(step)
  })
})

describe('bidi helpers', () => {
  it('strip isolates for plain-text comparisons', () => {
    // The example username keeps a non-breaking hyphen so it never splits across lines.
    expect(stripIsolates(ar.login.usernameHint)).toBe('اسم المستخدم المكتوب على بطاقتك من المركز، مثل 10a‑07.')
  })
})
