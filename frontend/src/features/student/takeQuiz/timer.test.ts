import { describe, expect, it } from 'vitest'
import { crossedNotice, retryDelayMs, timerPhase } from './timer'

const MIN = 60_000

describe('timerPhase', () => {
  it('is normal above five minutes, amber at five, red at one, solid at zero', () => {
    expect(timerPhase(5 * MIN + 1)).toBe('normal')
    expect(timerPhase(5 * MIN)).toBe('warn')
    expect(timerPhase(MIN + 1)).toBe('warn')
    expect(timerPhase(MIN)).toBe('final')
    expect(timerPhase(1)).toBe('final')
    expect(timerPhase(0)).toBe('zero')
    expect(timerPhase(-500)).toBe('zero')
  })
})

describe('crossedNotice', () => {
  it('fires once when the countdown crosses 5:00 and 1:00', () => {
    expect(crossedNotice(5 * MIN + 400, 5 * MIN - 600)).toBe('5min')
    expect(crossedNotice(MIN + 200, MIN - 800)).toBe('1min')
    expect(crossedNotice(4 * MIN, 4 * MIN - 1000)).toBeNull()
  })

  it('does not announce five minutes when a resumed attempt jumps straight past one minute', () => {
    expect(crossedNotice(10 * MIN, 30_000)).toBe('1min')
    expect(crossedNotice(10 * MIN, 0)).toBeNull()
  })
})

describe('retryDelayMs', () => {
  it('backs off 1 s, 2 s, 4 s, then stays at 8 s', () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelayMs)).toEqual([1000, 2000, 4000, 8000, 8000, 8000])
  })
})
