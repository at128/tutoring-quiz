import { useLanguage } from '../i18n/LanguageContext'
import type { Lang } from '../i18n/lang'

/**
 * Switches the interface between Arabic and English. The button is written in the language it switches to
 * ("العربية" / "English"), with that `lang`, so screen readers pronounce it correctly.
 */
export function LanguageToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { t, setLang } = useLanguage()
  const target = t.language.switchToLang as Lang

  return (
    <button
      type="button"
      lang={target}
      aria-label={t.language.switchToLabel}
      title={t.language.switchToLabel}
      onClick={() => setLang(target)}
      className={`inline-flex min-h-11 min-w-11 flex-none items-center justify-center rounded-control px-2.5 text-small font-semibold text-ink hover:bg-tint ${className}`}
    >
      {compact ? (
        <>
          <span className="md:hidden">{t.language.switchToShort}</span>
          <span className="hidden md:inline">{t.language.switchTo}</span>
        </>
      ) : (
        t.language.switchTo
      )}
    </button>
  )
}
