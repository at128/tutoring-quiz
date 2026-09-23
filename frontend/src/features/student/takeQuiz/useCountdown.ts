import { useEffect, useRef, useState } from 'react'
import { remainingMs } from '../../../lib/time'
import { crossedNotice, type TimeNotice } from './timer'

const TICK_MS = 250
const NOTICE_MS = 8000

/**
 * Remaining time to the server deadline, re-rendered 4× a second, plus the one-off "5 minutes / 1 minute left"
 * notice when a threshold is crossed. The phone's clock is corrected by `offsetMs` (server − device).
 */
export function useCountdown(deadlineIso: string, offsetMs: number) {
  const [notice, setNotice] = useState<TimeNotice | null>(null)
  const [, setTick] = useState(0)
  const previous = useRef<number | null>(null)

  useEffect(() => {
    previous.current = remainingMs(deadlineIso, offsetMs)
    const id = window.setInterval(() => {
      const now = remainingMs(deadlineIso, offsetMs)
      const crossed = previous.current === null ? null : crossedNotice(previous.current, now)
      previous.current = now
      if (crossed) {
        setNotice(crossed)
        window.setTimeout(() => setNotice((current) => (current === crossed ? null : current)), NOTICE_MS)
      }
      setTick((tick) => tick + 1)
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [deadlineIso, offsetMs])

  return { remaining: remainingMs(deadlineIso, offsetMs), notice }
}
