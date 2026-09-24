import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { Icon } from '../../../components/Icon'

// Form controls as drawn in the prototype's editor: 48 px inputs, 14 px labels, 13 px hints, red on error.

const control = (invalid: boolean) =>
  `w-full rounded-control bg-paper text-ink placeholder:text-muted disabled:bg-desk ${invalid ? 'border-2 border-red' : 'border border-strong'}`

export function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-small font-semibold text-ink">
      {children}
    </label>
  )
}

export function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <div id={id} className="text-meta leading-[1.45] text-muted">
      {children}
    </div>
  )
}

/** Field-level problems (client or server), announced to screen readers. */
export function FieldProblems({ id, messages }: { id?: string; messages?: string[] }) {
  if (!messages?.length) return null
  return (
    <div id={id} role="alert" className="flex flex-col gap-0.5">
      {messages.map((message) => (
        <span key={message} className="flex items-center gap-1.5 text-small font-medium text-red">
          <Icon name="alert" className="size-4" strokeWidth={2} />
          {message}
        </span>
      ))}
    </div>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; compact?: boolean }

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { invalid = false, compact = false, className = '', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${control(invalid)} ${compact ? 'h-11 px-3' : 'h-12 px-3.5'} text-body ${className}`}
      {...rest}
    />
  )
})

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; large?: boolean }

export const TextArea = forwardRef<HTMLTextAreaElement, AreaProps>(function TextArea(
  { invalid = false, large = false, className = '', ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      dir="auto"
      aria-invalid={invalid || undefined}
      className={`${control(invalid)} resize-y px-3.5 py-3 leading-[1.6] ${large ? 'text-option' : 'text-body'} ${className}`}
      {...rest}
    />
  )
})
