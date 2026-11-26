import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '../src/proxy'

function request(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers })
}

describe('proxy www redirect', () => {
  it('301-redirects www.cvlt.ch to the apex, preserving path and query', () => {
    const res = proxy(request('https://www.cvlt.ch/notizie?foo=bar', { host: 'www.cvlt.ch' }))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://cvlt.ch/notizie?foo=bar')
  })

  it('redirects the root path', () => {
    const res = proxy(request('https://www.cvlt.ch/', { host: 'www.cvlt.ch' }))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://cvlt.ch/')
  })

  it('uses the first entry of a comma-separated x-forwarded-host', () => {
    const res = proxy(request('https://www.cvlt.ch/galleria', {
      'x-forwarded-host': 'www.cvlt.ch, cvlt.ch',
    }))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://cvlt.ch/galleria')
  })

  it('falls back to the host header when x-forwarded-host is absent', () => {
    const res = proxy(request('https://www.cvlt.ch/vento', { host: 'www.cvlt.ch' }))
    expect(res.status).toBe(301)
  })

  it('leaves apex requests untouched', () => {
    const res = proxy(request('https://cvlt.ch/notizie', { host: 'cvlt.ch' }))
    expect(res.status).toBe(200)
  })

  it('leaves requests with no host headers untouched (localhost dev)', () => {
    const res = proxy(request('https://localhost:3000/notizie'))
    expect(res.status).toBe(200)
  })

  it('runs before the WP-410 logic, so old WP URLs on www redirect instead of 410', () => {
    const res = proxy(request('https://www.cvlt.ch/old-wp-post', { host: 'www.cvlt.ch' }))
    expect(res.status).toBe(301)
    expect(res.headers.get('location')).toBe('https://cvlt.ch/old-wp-post')
  })
})

describe('proxy WP query param handling', () => {
  it('no longer 410s ?year= (legitimate gallery filter)', () => {
    const res = proxy(request('https://cvlt.ch/galleria?year=2025', { host: 'cvlt.ch' }))
    expect(res.status).toBe(200)
  })

  it('still 410s legacy WordPress params like ?p=', () => {
    const res = proxy(request('https://cvlt.ch/?p=123', { host: 'cvlt.ch' }))
    expect(res.status).toBe(410)
  })

  it('still 410s other legacy params like ?cat=', () => {
    const res = proxy(request('https://cvlt.ch/?cat=4', { host: 'cvlt.ch' }))
    expect(res.status).toBe(410)
  })
})

describe('proxy WP legacy path 410s', () => {
  it('410s old BGMP placemark posts', () => {
    const res = proxy(request('https://cvlt.ch/placemarks/aeroporto-ascona', { host: 'cvlt.ch' }))
    expect(res.status).toBe(410)
  })

  it('410s /events/ slugs that have no recurring-event successor', () => {
    // The 51 mapped event editions are redirected by next.config before the
    // proxy runs; everything else under /events/ is gone.
    const res = proxy(request('https://cvlt.ch/events/nome-che-non-esiste', { host: 'cvlt.ch' }))
    expect(res.status).toBe(410)
  })
})
