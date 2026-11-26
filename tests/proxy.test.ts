import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '../src/proxy'

function request(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers })
}

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
