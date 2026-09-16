#!/usr/bin/env node

import { createClient } from '@libsql/client'
import { readdirSync, existsSync } from 'fs'
import { resolve, join } from 'path'

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

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

const dbPath = process.env.DATABASE_URI || 'file:./db/payload.db'
const mediaDir = resolve(process.cwd(), 'media')

if (!existsSync(mediaDir)) {
  console.error(`[REPAIR] Media directory not found: ${mediaDir}`)
  process.exit(1)
}

console.log(`[REPAIR] Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`)

const db = createClient({ url: dbPath })
const diskFiles = new Set(readdirSync(mediaDir))
const diskByBase = new Map()
for (const f of diskFiles) {
  const base = f.replace(/\.[^.]+$/, '')
  if (!diskByBase.has(base)) diskByBase.set(base, [])
  diskByBase.get(base).push(f)
}

const { rows } = await db.execute(
  'SELECT id, filename, sizes_thumbnail_filename, sizes_medium_filename FROM media'
)
console.log(`[REPAIR] ${rows.length} media records, ${diskFiles.size} files on disk\n`)

function findOnDisk(filename) {
  if (diskFiles.has(filename)) return filename
  const sanitized = sanitizeFilename(filename)
  if (diskFiles.has(sanitized)) return sanitized
  const sBase = sanitized.replace(/\.[^.]+$/, '')
  const sExt = sanitized.match(/\.[^.]+$/)?.[0] || ''
  for (let i = 2; i <= 20; i++) {
    const candidate = `${sBase}-${i}${sExt}`
    if (diskFiles.has(candidate)) return candidate
  }
  const origBase = filename.replace(/\.[^.]+$/, '')
  const matches = diskByBase.get(origBase)
  if (matches?.length === 1) return matches[0]
  return null
}

let ok = 0
let fixed = 0
let missing = 0
const fixes = []

for (const row of rows) {
  if (!row.filename) continue
  const newMain = findOnDisk(row.filename)
  const newThumb = row.sizes_thumbnail_filename ? findOnDisk(row.sizes_thumbnail_filename) : null
  const newMedium = row.sizes_medium_filename ? findOnDisk(row.sizes_medium_filename) : null

  const mainChanged = newMain && newMain !== row.filename
  const thumbChanged = row.sizes_thumbnail_filename && newThumb && newThumb !== row.sizes_thumbnail_filename
  const mediumChanged = row.sizes_medium_filename && newMedium && newMedium !== row.sizes_medium_filename

  if (mainChanged || thumbChanged || mediumChanged) {
    fixes.push({
      id: row.id,
      oldMain: row.filename,
      newMain: newMain || row.filename,
      newThumb: thumbChanged ? newThumb : row.sizes_thumbnail_filename,
      newMedium: mediumChanged ? newMedium : row.sizes_medium_filename,
      fields: { main: !!mainChanged, thumb: !!thumbChanged, medium: !!mediumChanged },
    })
    fixed++
  } else if (!newMain) {
    console.warn(`[REPAIR] MISSING: id=${row.id} "${row.filename}" — no file found on disk`)
    missing++
  } else {
    ok++
  }
}

console.log(`[REPAIR] OK: ${ok}, Need fix: ${fixed}, Missing: ${missing}\n`)

if (fixes.length === 0) {
  console.log('[REPAIR] Nothing to fix!')
  db.close()
  process.exit(0)
}

if (dryRun) {
  for (const f of fixes.slice(0, 20)) {
    const parts = []
    if (f.fields.main) parts.push(`filename: ${f.oldMain} → ${f.newMain}`)
    if (f.fields.thumb) parts.push(`thumb → ${f.newThumb}`)
    if (f.fields.medium) parts.push(`medium → ${f.newMedium}`)
    console.log(`  id=${f.id}: ${parts.join(', ')}`)
  }
  if (fixes.length > 20) console.log(`  ... and ${fixes.length - 20} more`)
  console.log(`\n[REPAIR] Dry run — no changes made.`)
  db.close()
  process.exit(0)
}

let updated = 0
const fileUrl = (name) => (name ? `/api/media/file/${name}` : null)
for (const f of fixes) {
  try {
    await db.execute({
      sql: `UPDATE media SET filename = ?, url = ?, sizes_thumbnail_filename = ?, sizes_thumbnail_url = ?, sizes_medium_filename = ?, sizes_medium_url = ? WHERE id = ?`,
      args: [
        f.newMain,
        fileUrl(f.newMain),
        f.newThumb || null,
        fileUrl(f.newThumb),
        f.newMedium || null,
        fileUrl(f.newMedium),
        f.id,
      ],
    })
    updated++
    if (updated % 100 === 0) console.log(`[REPAIR] Updated ${updated}/${fixes.length}...`)
  } catch (err) {
    console.error(`[REPAIR] DB error id=${f.id}: ${err.message}`)
  }
}

console.log(`\n[REPAIR] Done! Updated ${updated} records, ${missing} still missing`)
db.close()
