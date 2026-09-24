import { useT } from '../i18n/LanguageContext'

export function Spinner({ className = 'size-5', label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`animate-spin ${className}`}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Centred spinner for a whole page or section while it loads. */
export function PageSpinner({ label }: { label?: string }) {
  const t = useT()
  return (
    <div className="flex justify-center py-16 text-muted">
      <Spinner className="size-7" label={label ?? t.app.loading} />
    </div>
  )
}
