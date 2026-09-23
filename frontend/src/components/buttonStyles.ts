export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost'
export type ButtonSize = 'lg' | 'md' | 'sm'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-150 ' +
  'disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 select-none'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-paper hover:bg-ink-2 border border-ink',
  secondary: 'bg-paper text-ink border border-strong hover:bg-tint',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-tint',
  danger: 'bg-red text-paper border border-red hover:opacity-90',
  dangerGhost: 'bg-transparent text-red border border-transparent hover:bg-red-bg',
}

const sizes: Record<ButtonSize, string> = {
  lg: 'min-h-12 px-[18px] text-body leading-[1.2]',
  md: 'min-h-11 px-4 text-body',
  sm: 'min-h-9 px-3 text-small',
}

export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') =>
  `${base} ${variants[variant]} ${sizes[size]} ${className}`
