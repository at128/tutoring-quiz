import { Logo } from '../components/Icon'
import { LanguageToggle } from '../components/LanguageToggle'
import { NotAvailableState } from '../components/States'
import { useT } from '../i18n/LanguageContext'

export function NotFoundPage() {
  const t = useT()
  return (
    <div className="min-h-dvh bg-desk">
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pt-12 pb-8">
        <div className="flex items-center gap-2.5 font-bold">
          <Logo />
          <span className="flex-1">{t.app.name}</span>
          <LanguageToggle />
        </div>
        <NotAvailableState title={t.notFound.title} backTo="/" backLabel={t.notFound.back}>
          {t.notFound.body}
        </NotAvailableState>
      </main>
    </div>
  )
}
