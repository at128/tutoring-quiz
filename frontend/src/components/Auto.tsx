import type { ElementType, ReactNode } from 'react'

type AutoProps = { children: ReactNode; as?: ElementType; className?: string }

/**
 * User-written text (names, titles, questions, options): direction follows the text itself, so Arabic reads
 * right-to-left inside the English UI. Isolated like <bdi> so it never reorders its neighbours.
 */
export function Auto({ children, as: Tag = 'span', className = '' }: AutoProps) {
  return (
    <Tag dir="auto" className={`auto-text [unicode-bidi:isolate] ${className}`}>
      {children}
    </Tag>
  )
}

/** Numbers next to Arabic text: always LTR so "−1.5" never shows as "1.5−". */
export function Num({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span dir="ltr" className={`tabular-nums [unicode-bidi:isolate] ${className}`}>
      {children}
    </span>
  )
}
