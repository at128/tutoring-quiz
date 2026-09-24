import { describe, expect, it } from 'vitest'
import { afterLoginPath, loginPath, roleHome, safeReturnTo } from './navigation'

describe('auth navigation', () => {
  it('keeps each role on its own home and restores only role-owned paths', () => {
    expect(roleHome('Student')).toBe('/student')
    expect(roleHome('Teacher')).toBe('/teacher')
    expect(afterLoginPath('Student', '/student/attempts/abc?tab=1')).toBe('/student/attempts/abc?tab=1')
    expect(afterLoginPath('Teacher', '/student/attempts/abc')).toBe('/teacher')
    expect(afterLoginPath('Student', '/teacher')).toBe('/student')
    expect(afterLoginPath('Student', '/student-anything')).toBe('/student')
    expect(afterLoginPath('Teacher', '/teacher-old')).toBe('/teacher')
    expect(afterLoginPath('Teacher', null)).toBe('/teacher')
  })

  it('rejects external or login return paths and encodes a deep-link when sending it to sign-in', () => {
    for (const path of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test', '/login', '/login?returnTo=/teacher']) {
      expect(safeReturnTo(path)).toBeNull()
    }
    expect(loginPath('/')).toBe('/login')
    expect(loginPath('/student/attempts/a?tab=1')).toBe('/login?returnTo=%2Fstudent%2Fattempts%2Fa%3Ftab%3D1')
  })
})
