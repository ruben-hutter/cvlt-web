import { beforeEach, describe, expect, it, vi } from 'vitest'

// The sitemap module imports the payload config only to pass it to
// getPayload; mocking both keeps the test off the real database.
vi.mock('@payload-config', () => ({ default: {} }))

const find = vi.fn()

vi.mock('payload', () => ({
  getPayload: vi.fn(async () => ({ find })),
}))

const { default: sitemap } = await import('../src/app/sitemap')

const PUBLISHED_NEWS = [
  { slug: 'published-article', updatedAt: '2026-01-15T10:00:00.000Z' },
]
const DRAFT_NEWS = [{ slug: 'draft-article', updatedAt: '2026-01-16T10:00:00.000Z' }]
const EVENTS = [{ slug: 'autunno-blitz-2026', updatedAt: '2026-01-10T10:00:00.000Z' }]

function fakeDocs() {
  find.mockImplementation(async ({ collection }: { collection: string }) => {
    switch (collection) {
      // The mock returns only the docs the DB would return for the query the
      // sitemap passes — the where-clause itself is asserted separately.
      case 'news': return { docs: PUBLISHED_NEWS }
      case 'events': return { docs: EVENTS }
      default: return { docs: [] }
    }
  })
}

describe('sitemap', () => {
  beforeEach(() => {
    find.mockReset()
    fakeDocs()
  })

  it('filters news to published articles released today or earlier', async () => {
    await sitemap()

    const newsCall = find.mock.calls
      .map(([args]) => args)
      .find(args => args.collection === 'news')
    expect(newsCall).toBeDefined()
    expect(newsCall!.where.status.equals).toBe('published')
    const cutoff = new Date(newsCall!.where.publishDate.less_than_equal)
    expect(cutoff.getTime()).not.toBeNaN()
    expect(cutoff.getTime()).toBeLessThanOrEqual(Date.now() + 1000)
  })

  it('lists only the published news the query returns (drafts never enter the sitemap)', async () => {
    const entries = await sitemap()
    const urls = entries.map(e => e.url)

    expect(urls).toContain('https://cvlt.ch/notizie/published-article')
    expect(urls).not.toContain('https://cvlt.ch/notizie/draft-article')
  })

  it('still includes events and the static pages', async () => {
    const entries = await sitemap()
    const urls = entries.map(e => e.url)

    expect(urls).toContain('https://cvlt.ch/calendario/autunno-blitz-2026')
    expect(urls).toContain('https://cvlt.ch/notizie')
    expect(urls).toContain('https://cvlt.ch/galleria')
  })

  it('falls back to static pages only when the database fails', async () => {
    find.mockRejectedValue(new Error('db down'))

    const entries = await sitemap()
    const urls = entries.map(e => e.url)

    expect(urls).toContain('https://cvlt.ch/notizie')
    expect(urls.every(u => !u.includes('/notizie/'))).toBe(true)
    expect(urls.every(u => !u.includes('/galleria/'))).toBe(true)
  })
})
