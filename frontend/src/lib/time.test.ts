import { describe, expect, it } from 'vitest'
import { formatCountdown, formatMinutes, remainingMs, serverNowMs, serverOffset } from './time'

describe('server clock', () => {
  it('uses the offset between the server and this device, not the device clock', () => {
    // The phone is 90 seconds fast.
    const clientNow = Date.parse('2026-09-24T10:01:30Z')
    const offset = serverOffset('2026-09-24T10:00:00Z', clientNow)
    expect(offset).toBe(-90_000)
    expect(serverNowMs(offset, clientNow)).toBe(Date.parse('2026-09-24T10:00:00Z'))

    // Deadline 10:20 by the server → 20 minutes left, whatever the phone says.
    expect(remainingMs('2026-09-24T10:20:00Z', offset, clientNow)).toBe(20 * 60_000)
  })

  it('never reports negative time', () => {
    expect(remainingMs('2026-09-24T10:00:00Z', 0, Date.parse('2026-09-24T10:05:00Z'))).toBe(0)
  })
})

describe('formatCountdown', () => {
  it('shows m:ss, and h:mm:ss from an hour up, rounding partial seconds up', () => {
    expect(formatCountdown(20 * 60_000)).toBe('20:00')
    expect(formatCountdown(61_000)).toBe('1:01')
    expect(formatCountdown(59_001)).toBe('1:00')
    expect(formatCountdown(999)).toBe('0:01')
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(3 * 3600_000 + 5_000)).toBe('3:00:05')
  })
})

describe('formatMinutes', () => {
  it('reads naturally', () => {
    expect(formatMinutes(1, 'en')).toBe('1 minute')
    expect(formatMinutes(20, 'en')).toBe('20 minutes')
    expect(formatMinutes(90, 'en')).toBe('1 h 30 min')
    expect(formatMinutes(120, 'en')).toBe('2 h')
  })
})
