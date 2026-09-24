/** A class code such as 10A, in the ruled mono chip the design uses on teacher screens. */
export function ClassChip({ name }: { name: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-[4px] border border-rule px-2 font-mono text-meta font-semibold text-ink-2">
      {name}
    </span>
  )
}

/** Segmented control (aria-pressed buttons), e.g. negative marking or the class filter. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = '',
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={`flex overflow-hidden rounded-control border border-strong bg-paper ${className}`}>
      {options.map((option, index) => {
        const pressed = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`min-h-11 flex-1 px-3 text-[15px] font-semibold whitespace-nowrap disabled:cursor-not-allowed ${
              pressed ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-tint'
            } ${index > 0 ? 'border-s border-strong' : ''}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
