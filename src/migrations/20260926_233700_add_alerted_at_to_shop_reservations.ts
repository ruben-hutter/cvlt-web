import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// The shop_reservations table was originally created via drizzle push (never
// through a migration file), which is why this migration only needs to add the
// watchdog's alert bookkeeping column introduced with the shop watchdog.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Guarded like the other migrations: on drizzle-push era databases (e.g. the
  // production host) the column already exists, and an unconditional ADD COLUMN
  // fails with "duplicate column" and aborts the deploy before the build.
  const result = await db.run(sql`PRAGMA table_info(shop_reservations);`)
  const exists = result.rows?.some((row: any) => row.name === 'alerted_at')
  if (exists) return

  await db.run(sql`ALTER TABLE \`shop_reservations\` ADD COLUMN \`alerted_at\` text;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`shop_reservations\` DROP COLUMN \`alerted_at\`;`)
}
