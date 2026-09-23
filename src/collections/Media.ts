import type { CollectionConfig } from 'payload'
import { stat } from 'fs/promises'
import path from 'path'
import { isAdmin, isLoggedIn } from './Users'
import { DOCUMENT_MIME_TYPES } from '../lib/constants'

export function sanitizeFilename(name: string): string {
  const ext = name.match(/\.[^.]+$/)?.[0] || ''
  const base = name.replace(/\.[^.]+$/, '')
  const sanitized = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return sanitized + ext.toLowerCase()
}

/**
 * Given a filename that is missing from disk, return its sanitized variant
 * if that exists, else null. Covers URLs indexed before the September 2026
 * filename migration (underscores, mixed case).
 */
export function resolveStaleMediaRedirect(
  filename: string,
  diskHas: (name: string) => boolean,
): string | null {
  for (const candidate of staleMediaRedirectCandidates(filename)) {
    if (diskHas(candidate)) return candidate
  }
  return null
}

function staleMediaRedirectCandidates(filename: string): string[] {
  if (!filename) return []
  const sanitized = sanitizeFilename(filename)
  return sanitized !== filename ? [sanitized] : []
}

type MediaUploadConfig = Extract<NonNullable<CollectionConfig['upload']>, object>
type MediaUploadHandler = NonNullable<MediaUploadConfig['handlers']>[number]

/**
 * Runs before Payload's local-disk fallback on every /api/media/file request.
 * Without it, a missing file falls through to a 500 + "missing on the disk"
 * error log for every stale URL still circulating in search indexes.
 */
export function staleMediaHandler(
  getMediaDir: () => string = () => path.resolve(process.cwd(), 'media'),
): MediaUploadHandler {
  const handler = async (
    _req: unknown,
    args: { params: { filename?: string } },
  ): Promise<Response | void> => {
    const filename = args.params?.filename
    if (!filename || filename.includes('/') || filename.includes('\\')) return

    const mediaDir = getMediaDir()
    const requested = path.resolve(mediaDir, filename)
    if (!requested.startsWith(mediaDir + path.sep)) return
    const diskHas = async (name: string) => {
      try {
        await stat(path.join(mediaDir, name))
        return true
      } catch {
        return false
      }
    }

    if (await diskHas(filename)) return

    let target: string | null = null
    for (const candidate of staleMediaRedirectCandidates(filename)) {
      if (await diskHas(candidate)) {
        target = candidate
        break
      }
    }
    if (!target) {
      return Response.json({ errors: [{ message: 'File not found.' }] }, { status: 404 })
    }
    return new Response(null, {
      status: 301,
      headers: {
        Location: `/api/media/file/${encodeURIComponent(target)}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }
  return handler as MediaUploadHandler
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Media', plural: 'Media' },
  lockDocuments: false,
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'mimeType', 'updatedAt'],
    listSearchableFields: ['alt', 'filename', 'mimeType'],
    description:
      'Immagini, video e documenti (PDF, Word, Excel, ZIP, ...). Usa la ricerca per trovare i file per nome, descrizione o tipo (es. «pdf», «docx»).',
  },
  upload: {
    mimeTypes: [
      'image/*',
      'video/mp4',
      'video/x-m4v',
      'video/webm',
      'video/quicktime',
      ...DOCUMENT_MIME_TYPES,
    ],
    imageSizes: [
      { name: 'thumbnail', width: 400, formatOptions: { format: 'webp' } },
      { name: 'medium', width: 1024, formatOptions: { format: 'webp' } },
    ],
    adminThumbnail: 'thumbnail',
    handlers: [staleMediaHandler()],
  },
  access: {
    read: () => true,
    create: isLoggedIn,
    update: isLoggedIn,
    delete: isAdmin,
  },
  custom: {
    totp: { disableAccessWrapper: { read: true } },
  },
  hooks: {
    beforeOperation: [
      ({ req, operation }) => {
        if ((operation === 'create' || operation === 'update') && req.file?.name) {
          req.file.name = sanitizeFilename(req.file.name)
        }
      },
    ],
    beforeValidate: [
      ({ data, req }) => {
        if (data && !data.alt) {
          const filename = data.filename || req?.file?.name || ''
          if (filename) {
            data.alt = filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      // Payload adds `mimeType` as an admin-hidden base upload field; unhiding
      // it makes it usable as a list column and in the admin filter dropdown,
      // so non-image files can actually be found and filtered in the admin.
      name: 'mimeType',
      type: 'text',
      label: 'Tipo file',
      admin: { hidden: false },
    },
    {
      name: 'alt',
      type: 'text',
      label: 'Testo alternativo',
      admin: {
        description: 'Se lasciato vuoto, verrà usato il nome del file.',
      },
    },
  ],
}
