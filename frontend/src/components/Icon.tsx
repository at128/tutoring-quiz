// Icon set from the approved prototype (docs/design): 24×24, stroke = currentColor. Decorative unless labelled.

const paths = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />,
  halfCircle: (
    <>
      <circle cx="12" cy="12" r="8" strokeWidth={2.2} />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="8" />,
  hourglass: (
    <>
      <path d="M7 3h10" />
      <path d="M7 21h10" />
      <path d="M8 3v3l4 6-4 6v3" />
      <path d="M16 3v3l-4 6 4 6v3" />
    </>
  ),
  minusCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5v.3" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16 5a3 3 0 0 1 0 6" />
      <path d="M17.5 14.2c2.2.7 3.5 3 3.5 5.8" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h5v16h-5" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h10" />
    </>
  ),
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  arrowRight: (
    <>
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
      <path d="M5 17a3 3 0 0 1 3-3h10" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M3 3l18 18" />
      <path d="M8.5 16.2a5 5 0 0 1 7 0" />
      <path d="M5 12.6a10 10 0 0 1 4.6-2.5" />
      <path d="M19 12.6a10 10 0 0 0-2.6-1.8" />
      <path d="M2 8.9A15 15 0 0 1 6.3 6.3" />
      <path d="M22 8.9A15 15 0 0 0 10.8 5" />
      <path d="M12 20h.01" />
    </>
  ),
  // Teacher screens
  pencil: <path d="M5 19l1-4L16 5l3 3L9 18zM14 7l3 3" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v6M13.5 10.5v6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  chart: <path d="M5 19V5M5 19h14M9 15v-4M13 15V8M17 15v-6" />,
} as const

export type IconName = keyof typeof paths

export function Icon({
  name,
  label,
  className = 'size-5',
  strokeWidth = 1.8,
}: {
  name: IconName
  label?: string
  className?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block shrink-0 ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths[name]}
    </svg>
  )
}

/** The Weekly Quizzes mark: three answer bubbles, the middle one filled. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 28 28" className="block flex-none">
      <rect x="0.5" y="0.5" width="27" height="27" rx="6" fill="#1D2B4F" />
      <circle cx="8" cy="14" r="3.4" fill="none" stroke="#fff" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="3.4" fill="#fff" />
      <circle cx="20" cy="14" r="3.4" fill="none" stroke="#fff" strokeWidth="1.5" />
    </svg>
  )
}
