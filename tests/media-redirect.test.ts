import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  Media,
  sanitizeFilename,
  resolveStaleMediaRedirect,
  staleMediaHandler,
} from '../src/collections/Media'

const handlerArgs = (filename: string) => ({
  doc: { id: 0 },
  params: { collection: 'media', filename },
})

describe('sanitizeFilename', () => {
  it('replaces underscores with hyphens and lowercases', () => {
    expect(sanitizeFilename('2015ticinoinaction6321jpg_35765975820_o-3-1024x576.JPG')).toBe(
      '2015ticinoinaction6321jpg-35765975820-o-3-1024x576.jpg',
    )
  })

  it('strips accents and collapses repeated hyphens', () => {
    expect(sanitizeFilename('Volo in Montàña--2024.jpeg')).toBe('volo-in-montana-2024.jpeg')
  })
})

describe('resolveStaleMediaRedirect', () => {
  const disk = new Set(['2015ticinoinaction6321jpg-35765975820-o-3-1024x576.jpg'])
  const diskHas = (name: string) => disk.has(name)

  it('returns the sanitized variant when the requested file is missing', () => {
    expect(resolveStaleMediaRedirect('2015ticinoinaction6321jpg_35765975820_o-3-1024x576.jpg', diskHas)).toBe(
      '2015ticinoinaction6321jpg-35765975820-o-3-1024x576.jpg',
    )
  })

  it('returns null when no sanitized variant exists on disk', () => {
    expect(resolveStaleMediaRedirect('totally-gone.jpg', diskHas)).toBeNull()
  })

  it('returns null when the requested name is already sanitized (no candidates)', () => {
    expect(resolveStaleMediaRedirect('some-missing-file.jpg', diskHas)).toBeNull()
  })
})

describe('staleMediaHandler', () => {
  const mediaDir = join(process.cwd(), '.tmp', 'media-redirect-test')
  const handler = staleMediaHandler(() => mediaDir)

  beforeAll(() => {
    mkdirSync(mediaDir, { recursive: true })
    writeFileSync(join(mediaDir, 'photo-2024-06-01-at-10-00-00.jpg'), 'x')
    writeFileSync(join(mediaDir, 'cover-400x225.jpg'), 'x')
  })

  afterAll(() => {
    rmSync(mediaDir, { recursive: true, force: true })
  })

  it('returns nothing when the file exists so Payload serves it normally', async () => {
    const res = await handler({} as never, handlerArgs('photo-2024-06-01-at-10-00-00.jpg') as never)
    expect(res).toBeUndefined()
  })

  it('301-redirects a stale underscore URL to the sanitized filename', async () => {
    const res = await handler({} as never, handlerArgs('Photo_2024-06-01_at_10.00.00.jpg') as never)
    expect(res).toBeInstanceOf(Response)
    expect(res!.status).toBe(301)
    expect(res!.headers.get('Location')).toBe('/api/media/file/photo-2024-06-01-at-10-00-00.jpg')
  })

  it('404s when no sanitized variant exists', async () => {
    const res = await handler({} as never, handlerArgs('no-such-file-anywhere.jpg') as never)
    expect(res).toBeInstanceOf(Response)
    expect(res!.status).toBe(404)
  })

  it('ignores path-like filenames', async () => {
    const res = await handler({} as never, handlerArgs('../db/payload.db') as never)
    expect(res).toBeUndefined()
  })

  it('is registered on the media upload config', () => {
    expect(typeof Media.upload === 'object' && Media.upload.handlers?.length).toBe(1)
  })
})
