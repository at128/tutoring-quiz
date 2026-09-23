import { useEffect, useRef, type ReactNode } from 'react'

type DialogProps = {
  open: boolean
  onClose: () => void
  /** id of the element that names the dialog */
  labelledBy?: string
  label?: string
  /** alertdialog for confirmations that need a decision */
  role?: 'dialog' | 'alertdialog'
  /** centre card or bottom sheet */
  variant?: 'center' | 'sheet'
  /** false while an action is running, so Esc / scrim can't dismiss it */
  dismissible?: boolean
  children: ReactNode
}

const variants = {
  center: 'm-auto w-[calc(100%-2rem)] max-w-[440px] rounded-dialog p-5',
  sheet:
    'mx-auto mt-auto mb-0 w-full max-w-[640px] rounded-t-[16px] px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]',
}

/**
 * Native modal <dialog>: the browser traps focus, makes the page behind inert and returns focus on close.
 * Esc and a tap on the scrim close it (unless `dismissible` is false).
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  label,
  role = 'dialog',
  variant = 'center',
  dismissible = true,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      role={role}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
      className={`max-h-[90dvh] overflow-y-auto border-0 bg-paper text-ink backdrop:bg-[rgb(29_43_79/0.48)] ${variants[variant]}`}
    >
      {open && children}
    </dialog>
  )
}
