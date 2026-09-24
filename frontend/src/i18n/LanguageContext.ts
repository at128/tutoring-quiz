import { createContext, useContext } from 'react'
import { en, type Messages } from './en'
import type { Lang } from './lang'

export type LanguageState = { lang: Lang; t: Messages; setLang: (lang: Lang) => void }

export const LanguageContext = createContext<LanguageState>({ lang: 'en', t: en, setLang: () => {} })

/** The interface language, its dictionary, and a way to change it. */
export const useLanguage = () => useContext(LanguageContext)

/** Shorthand for the dictionary only. */
export const useT = () => useContext(LanguageContext).t
