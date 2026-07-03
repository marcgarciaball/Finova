import { describe, expect, it } from 'vitest'
import { resolveAuthRedirect } from '@/lib/auth/route-guard'

describe('resolveAuthRedirect', () => {
  describe('logged-in user', () => {
    it('redirects away from home', () => {
      expect(resolveAuthRedirect('/', true)).toEqual({
        type: 'redirect',
        path: '/protected',
      })
    })

    it('redirects away from the login page', () => {
      expect(resolveAuthRedirect('/auth/login', true)).toEqual({
        type: 'redirect',
        path: '/protected',
      })
    })

    it('allows other auth routes (e.g. sign-up, confirm)', () => {
      expect(resolveAuthRedirect('/auth/sign-up', true)).toEqual({
        type: 'allow',
      })
    })

    it('allows protected routes', () => {
      expect(resolveAuthRedirect('/protected', true)).toEqual({
        type: 'allow',
      })
      expect(resolveAuthRedirect('/protected/accounts', true)).toEqual({
        type: 'allow',
      })
    })
  })

  describe('logged-out user', () => {
    it('allows home', () => {
      expect(resolveAuthRedirect('/', false)).toEqual({ type: 'allow' })
    })

    it('allows any auth route', () => {
      expect(resolveAuthRedirect('/auth/login', false)).toEqual({
        type: 'allow',
      })
      expect(resolveAuthRedirect('/auth/sign-up', false)).toEqual({
        type: 'allow',
      })
    })

    it('redirects protected routes to login', () => {
      expect(resolveAuthRedirect('/protected', false)).toEqual({
        type: 'redirect',
        path: '/auth/login',
      })
      expect(resolveAuthRedirect('/protected/accounts', false)).toEqual({
        type: 'redirect',
        path: '/auth/login',
      })
    })
  })
})
