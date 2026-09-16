#!/usr/bin/env node
//
// fix-media-urls.mjs
//
// Rebuilds the `url`, `sizes_thumbnail_url` and `sizes_medium_url` columns
// from the corresponding filename columns. Needed once on production: the
// September 2026 filename migration renamed files on disk and updated the
// filename columns, but left the url columns pointing at the old underscore
// names. Payload recomputes urls from `filename` on read, so the stale
// columns are invisible to the site — this fixes them for any consumer
// reading the database directly.
//
//   node scripts/fix-media-urls.mjs            # dry-run report
//   node scripts/fix-media-urls.mjs --apply    # apply (backs up DB first)
//
// Env:
//   DATABASE_URI  (default: file:./db/payload.db)

import { createClient } from '@libsql/client'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const args = process.argv.slice(2)
const apply = args.includes('--apply')

const dbPath = process.env.DATABASE_URI || 'file:./db/payload.db'

if (apply) {
  const dbFile = dbPath.replace(/^file:/, '')
  if (existsSync(dbFile)) {
    mkdirSync('.backups', { recursive: true })
    const backup = `.backups/payload.db.${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}`
    copyFileSync(dbFile, backup)
    console.log(`[URLS] DB backed up to ${backup}`)
  }
}

const db = createClient({ url: dbPath })
const fileUrl = (name) => (name ? `/api/media/file/${name}` : null)

const updates = []

const { rows: mains } = await db.execute(
  'SELECT id, filename, url FROM media WHERE filename IS NOT NULL',
)
for (const row of mains) {
  if (row.url !== fileUrl(row.filename)) {
    updates.push({ id: row.id, column: 'url', value: fileUrl(row.filename) })
  }
}

const { rows: thumbs } = await db.execute(
  'SELECT id, sizes_thumbnail_filename AS f, sizes_thumbnail_url AS u FROM media WHERE sizes_thumbnail_filename IS NOT NULL',
)
for (const row of thumbs) {
  if (row.u !== fileUrl(row.f)) {
    updates.push({ id: row.id, column: 'sizes_thumbnail_url', value: fileUrl(row.f) })
  }
}

const { rows: mediums } = await db.execute(
  'SELECT id, sizes_medium_filename AS f, sizes_medium_url AS u FROM media WHERE sizes_medium_filename IS NOT NULL',
)
for (const row of mediums) {
  if (row.u !== fileUrl(row.f)) {
    updates.push({ id: row.id, column: 'sizes_medium_url', value: fileUrl(row.f) })
  }
}

console.log(`[URLS] Mode: ${apply ? 'APPLY' : 'DRY RUN'}`)
console.log(`[URLS] ${updates.length} stale url values found\n`)

if (updates.length === 0) {
  console.log('[URLS] Nothing to fix!')
  db.close()
  process.exit(0)
}

if (!apply) {
  for (const u of updates.slice(0, 10)) {
    console.log(`  id=${u.id} ${u.column} → ${u.value}`)
  }
  if (updates.length > 10) console.log(`  ... and ${updates.length - 10} more`)
  console.log('\n[URLS] Dry run — no changes made. Re-run with --apply to fix.')
  db.close()
  process.exit(0)
}

let done = 0
for (const u of updates) {
  await db.execute(`UPDATE media SET ${u.column} = ? WHERE id = ?`, [u.value, u.id])
  done++
  if (done % 500 === 0) console.log(`[URLS] Updated ${done}/${updates.length}...`)
}

console.log(`\n[URLS] Done! Updated ${done} url values`)
db.close()
