import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router'
import { buttonClass, type ButtonSize as Size, type ButtonVariant as Variant } from './buttonStyles'
import { Spinner } from './Spinner'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

export function Button({ variant, size, loading = false, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}

/** A link styled as a button (navigation, not an action). */
export function ButtonLink({
  to,
  variant,
  size,
  className,
  children,
  replace,
}: {
  to: string
  variant?: Variant
  size?: Size
  className?: string
  children: ReactNode
  replace?: boolean
}) {
  return (
    <Link to={to} replace={replace} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  )
}

/** 44×44 icon-only button; the label is required for screen readers. */
export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-tint ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
