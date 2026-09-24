import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ar } from './ar'
import { en } from './en'
import { LanguageContext } from './LanguageContext'
import { applyToDocument, storeLang, type Lang } from './lang'

const dictionaries = { en, ar }

/**
 * Holds the interface language. Changing it re-renders in place (no remount), so an open form or a running
 * quiz keeps its state; `document` gets the new lang/dir at once.
 */
export function LanguageProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)

  const setLang = useCallback((next: Lang) => {
    applyToDocument(next, dictionaries[next].app.name)
    storeLang(next)
    setLangState(next)
  }, [])

  const value = useMemo(() => ({ lang, t: dictionaries[lang], setLang }), [lang, setLang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
