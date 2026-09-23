import type { ElementType, ReactNode } from 'react'

/** The white "paper" surface everything sits on. */
export function Sheet({ children, as: Tag = 'section', className = '' }: { children: ReactNode; as?: ElementType; className?: string }) {
  return <Tag className={`rounded-sheet border border-rule bg-paper ${className}`}>{children}</Tag>
}

/** The double ruled line under a sheet heading, like the top of an answer sheet. */
export function DoubleRule({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`h-1 border-y border-rule ${className}`} />
}

/** Ruled facts list (label / value rows). */
export function FactRows({ facts, className = '' }: { facts: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={`divide-y divide-rule-soft ${className}`}>
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-small text-ink-2">{fact.label}</dt>
          <dd className="text-end text-body font-semibold">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}
