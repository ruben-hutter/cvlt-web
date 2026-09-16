#!/usr/bin/env node

import { createClient } from '@libsql/client'
import { readdirSync, renameSync, existsSync } from 'fs'
import { resolve, join } from 'path'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const verbose = args.includes('--verbose')

function sanitizeFilename(name) {
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

const dbPath = process.env.DATABASE_URI || 'file:./db/payload.db'
const mediaDir = resolve(process.cwd(), 'media')

if (!existsSync(mediaDir)) {
  console.error(`[MIGRATE] Media directory not found: ${mediaDir}`)
  process.exit(1)
}

console.log(`[MIGRATE] Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`)
console.log(`[MIGRATE] DB: ${dbPath}`)
console.log(`[MIGRATE] Media dir: ${mediaDir}`)

const db = createClient({ url: dbPath })

const { rows } = await db.execute(
  'SELECT id, filename, url, sizes_thumbnail_filename, sizes_medium_filename FROM media'
)
console.log(`[MIGRATE] Found ${rows.length} media records\n`)

const dirtyRecords = []
for (const row of rows) {
  if (!row.filename || typeof row.filename !== 'string') continue
  const sanitized = sanitizeFilename(row.filename)
  if (sanitized !== row.filename) {
    dirtyRecords.push({
      id: row.id,
      filename: row.filename,
      sanitized,
      thumbFilename: row.sizes_thumbnail_filename,
      mediumFilename: row.sizes_medium_filename,
    })
  }
}

console.log(`[MIGRATE] ${dirtyRecords.length} records need filename sanitization\n`)

if (dirtyRecords.length === 0) {
  console.log('[MIGRATE] All filenames are already clean!')
  db.close()
  process.exit(0)
}

const diskFiles = new Set(readdirSync(mediaDir))
const dirtyBases = new Set(dirtyRecords.map(r => r.filename.replace(/\.[^.]+$/, '')))
console.log(`[MIGRATE] ${diskFiles.size} files on disk\n`)

const usedNames = new Set(diskFiles)
const assignedFiles = new Set()

function resolveCollision(desiredName) {
  if (!usedNames.has(desiredName)) return desiredName
  const ext = desiredName.match(/\.[^.]+$/)?.[0] || ''
  const base = desiredName.replace(/\.[^.]+$/, '')
  let i = 2
  while (usedNames.has(`${base}-${i}${ext}`)) i++
  return `${base}-${i}${ext}`
}

const fileRenames = []
const dbUpdates = []

for (const info of dirtyRecords) {
  const oldBase = info.filename.replace(/\.[^.]+$/, '')
  const sanitizedBase = info.sanitized.replace(/\.[^.]+$/, '')
  let newMainFilename = null

  const relatedFiles = [...diskFiles].filter(f => {
    if (assignedFiles.has(f)) return false
    const fb = f.replace(/\.[^.]+$/, '')
    if (fb === oldBase) return true
    if (!fb.startsWith(oldBase + '-')) return false
    const suffix = fb.slice(oldBase.length + 1)
    if (dirtyBases.has(fb)) return false
    return true
  })

  if (verbose && relatedFiles.length > 0) {
    console.log(`  ${info.filename} → ${info.sanitized} (${relatedFiles.length} files)`)
  }

  for (const file of relatedFiles) {
    const fileBase = file.replace(/\.[^.]+$/, '')
    const fileExt = file.match(/\.[^.]+$/)?.[0] || ''

    const suffix = fileBase === oldBase ? '' : fileBase.slice(oldBase.length)
    const desiredName = sanitizedBase + suffix + fileExt
    const newName = resolveCollision(desiredName)

    if (newName !== file) {
      fileRenames.push({ oldName: file, newName, isMain: file === info.filename })
      assignedFiles.add(file)
      usedNames.delete(file)
      usedNames.add(newName)
    }

    if (file === info.filename) {
      newMainFilename = newName
    }
  }

  if (!newMainFilename) {
    if (diskFiles.has(info.sanitized)) {
      newMainFilename = info.sanitized
    }
  }

  if (newMainFilename) {
    const sizeUpdates = {}
    if (info.thumbFilename && typeof info.thumbFilename === 'string') {
      sizeUpdates.thumb = sanitizeFilename(info.thumbFilename)
    }
    if (info.mediumFilename && typeof info.mediumFilename === 'string') {
      sizeUpdates.medium = sanitizeFilename(info.mediumFilename)
    }
    dbUpdates.push({ id: info.id, oldFilename: info.filename, newFilename: newMainFilename, sizeUpdates })
  }
}

console.log(`\n[MIGRATE] Planned ${fileRenames.length} file renames`)
console.log(`[MIGRATE] Planned ${dbUpdates.length} DB updates (${dbUpdates.length - fileRenames.filter(r => r.isMain).length} already on disk)\n`)

if (dryRun) {
  console.log('[MIGRATE] === DRY RUN — showing first 15 renames ===\n')
  const mains = fileRenames.filter(r => r.isMain)
  for (const { oldName, newName } of mains.slice(0, 15)) {
    console.log(`  ${oldName}`)
    console.log(`  → ${newName}\n`)
  }
  if (mains.length > 15) {
    console.log(`  ... and ${mains.length - 15} more\n`)
  }
  const related = fileRenames.filter(r => !r.isMain)
  if (related.length > 0) {
    console.log(`  (+ ${related.length} related size/format variants)`)
  }
  console.log(`\n[MIGRATE] Dry run — no changes made. Run without --dry-run to apply.`)
  db.close()
  process.exit(0)
}

let renamed = 0
let skipped = 0
let errors = 0

for (const { oldName, newName } of fileRenames) {
  const oldPath = join(mediaDir, oldName)
  const newPath = join(mediaDir, newName)
  if (existsSync(newPath)) {
    skipped++
    continue
  }
  try {
    renameSync(oldPath, newPath)
    renamed++
    if ((renamed + skipped) % 100 === 0) {
      console.log(`[MIGRATE] Processed ${renamed + skipped}/${fileRenames.length} files...`)
    }
  } catch (err) {
    console.error(`[MIGRATE] FAILED: ${oldName} → ${newName}: ${err.message}`)
    errors++
  }
}

console.log(`[MIGRATE] Renamed ${renamed} files, skipped ${skipped} already done (${errors} errors)`)

if (errors > 0) {
  console.error(`[MIGRATE] ${errors} file renames failed — skipping DB updates to avoid inconsistency`)
  console.error('[MIGRATE] Fix the errors above and re-run the script')
  db.close()
  process.exit(1)
}

console.log('[MIGRATE] Updating database...')

const fileUrl = (name) => (name ? `/api/media/file/${name}` : null)
const sql = `UPDATE media SET filename = ?, url = ?, sizes_thumbnail_filename = ?, sizes_thumbnail_url = ?, sizes_medium_filename = ?, sizes_medium_url = ? WHERE id = ?`
let dbUpdated = 0

for (const { id, newFilename, sizeUpdates } of dbUpdates) {
  try {
    await db.execute({
      sql,
      args: [
        newFilename,
        fileUrl(newFilename),
        sizeUpdates.thumb || null,
        fileUrl(sizeUpdates.thumb),
        sizeUpdates.medium || null,
        fileUrl(sizeUpdates.medium),
        id,
      ],
    })
    dbUpdated++
    if (dbUpdated % 100 === 0) {
      console.log(`[MIGRATE] Updated ${dbUpdated}/${dbUpdates.length} DB records...`)
    }
  } catch (err) {
    console.error(`[MIGRATE] DB update FAILED for id=${id}: ${err.message}`)
  }
}

console.log(`[MIGRATE] Updated ${dbUpdated} DB records`)
console.log(`\n[MIGRATE] Done! — ${renamed} files renamed, ${skipped} skipped, ${dbUpdated} DB records updated`)

db.close()
