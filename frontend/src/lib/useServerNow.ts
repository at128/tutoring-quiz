import { useEffect, useState } from 'react'
import { serverNowMs } from './time'

/** The server's current time (ms), re-rendered every `intervalMs`. */
export function useServerNow(offsetMs: number, intervalMs = 30_000): number {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return serverNowMs(offsetMs)
}
