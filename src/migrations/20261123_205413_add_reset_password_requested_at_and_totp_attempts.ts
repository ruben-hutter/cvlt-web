import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

// Repairs the schema drift that built up on databases created by drizzle push in
// dev mode (e.g. the production host) after the Payload 3.94 / payload-totp 3.0.7
// upgrades. Two additive gaps, both reproduced exactly as the SQLite adapter
// renders them from the config (verified with a drizzle schema diff):
//
// 1. `users.reset_password_requested_at` — Payload 3.94 defaults
//    `auth.forgotPassword.minRequestInterval` to 15000, which adds a date field
//    to every auth collection. Without the column every `users` query fails with
//    "no such column: reset_password_requested_at" (author relations, admin login).
// 2. `totp_attempts` — brute-force protection of payload-totp 3.0.7 counts codes in
//    its own `totp-attempts` collection (text id = user id, no timestamps, no
//    indexes, no foreign keys). First TOTP login fails without the table.
//
// The production database state is unknown, and dev/CI databases may already have
// either object from a drizzle push, so every statement is guarded: adding an
// existing column aborts the deploy with "duplicate column".
async function columnExists(db: any, table: string, column: string): Promise<boolean> {
  const result = await db.run(sql`PRAGMA table_info(${sql.raw(table)});`)
  return Boolean(result.rows?.some((row: any) => row.name === column))
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  if (!(await columnExists(db, 'users', 'reset_password_requested_at'))) {
    await db.run(sql`ALTER TABLE \`users\` ADD \`reset_password_requested_at\` text;`)
  }

  await db.run(sql`CREATE TABLE IF NOT EXISTS \`totp_attempts\` (
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`attempts\` numeric DEFAULT 0 NOT NULL,
  	\`lock_until\` text
  );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`totp_attempts\`;`)
  if (await columnExists(db, 'users', 'reset_password_requested_at')) {
    await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`reset_password_requested_at\`;`)
  }
}
