// The interface language. Content (quiz titles, questions, names) keeps its own direction via dir="auto".

export type Lang = 'en' | 'ar'

export const LANGS: readonly Lang[] = ['ar', 'en']

const STORAGE_KEY = 'tq.lang'

export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr')

const isLang = (value: unknown): value is Lang => value === 'en' || value === 'ar'

/** A saved choice wins; otherwise the device's first preferred language decides (Arabic if it's any Arabic). */
export function detectLang(stored: string | null, preferred: readonly string[]): Lang {
  if (isLang(stored)) return stored
  const first = preferred.find((tag) => tag.trim() !== '')
  return first?.toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

// Storage can be unavailable (private mode, blocked site data): the choice then lasts for the page's life.
export function readStoredLang(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeLang(lang: Lang): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Not fatal: the language still applies until the page is closed.
  }
}

export const initialLang = (): Lang =>
  detectLang(readStoredLang(), typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]))

/** The document's lang, dir and title drive the font, logical CSS, screen readers and the browser's own UI. */
export function applyToDocument(lang: Lang, title: string): void {
  document.documentElement.lang = lang
  document.documentElement.dir = dirOf(lang)
  document.title = title
}
