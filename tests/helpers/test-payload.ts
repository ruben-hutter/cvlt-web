import { mkdirSync, rmSync } from 'fs'
import { buildConfig, getPayload, type CollectionConfig, type Payload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { ShopStock } from '../../src/collections/ShopStock'
import { ShopReservations } from '../../src/collections/ShopReservations'
import { ShopOrders } from '../../src/collections/ShopOrders'
import { shopProducts, catalogKey } from '../../src/lib/shop-catalog'

const TEST_DB_URL = 'file:./.tmp/test-payload.db'
const TEST_DB_FILE = './.tmp/test-payload.db'

const defaultCollections: CollectionConfig[] = [ShopStock, ShopReservations]

/** Full shop schema (stock + reservations + orders) for watchdog/route tests. */
export function shopCollectionsWithOrders(): CollectionConfig[] {
  return [ShopStock, ShopReservations, ShopOrders]
}

type TestPayloadConfig = ReturnType<typeof buildConfig>

function collectionsKey(collections: CollectionConfig[]): string {
  return collections.map((collection) => collection.slug).join(',')
}

function dbFilesFor(key: string): { url: string; file: string } {
  if (key === collectionsKey(defaultCollections)) {
    return { url: TEST_DB_URL, file: TEST_DB_FILE }
  }
  const safe = key.replace(/[^a-z0-9]+/gi, '-')
  return {
    url: `file:./.tmp/test-payload-${safe}.db`,
    file: `./.tmp/test-payload-${safe}.db`,
  }
}

function buildConfigFor(collections: CollectionConfig[], dbUrl: string): TestPayloadConfig {
  return buildConfig({
    secret: 'cvlt-test-secret-not-for-prod',
    graphQL: { disable: true },
    db: sqliteAdapter({ client: { url: dbUrl } }),
    editor: lexicalEditor({ features: [] }),
    collections,
  })
}

// Configs are memoized per collection set. Each collection set gets its own
// SQLite file (see dbFilesFor): booting a config against a file created with a
// different schema deadlocks in schema push, so sharing one file across
// collection sets is never safe.
const configMemo = new Map<string, TestPayloadConfig>()

/**
 * Build (or fetch the memoized) Payload config for the given collections.
 * The returned config lives on the same SQLite file that
 * `getTestPayload({ collections })` boots, so a `vi.mock('@payload-config')`
 * returning this config shares the instance and DB with `getTestPayload`.
 */
export function getTestConfig(collections: CollectionConfig[] = defaultCollections): TestPayloadConfig {
  const key = collectionsKey(collections)
  let config = configMemo.get(key)
  if (!config) {
    config = buildConfigFor(collections, dbFilesFor(key).url)
    configMemo.set(key, config)
  }
  return config
}

export type TestPayloadOptions = {
  /**
   * Collections to register. Defaults to the stock test setup
   * (ShopStock + ShopReservations) so existing consumers are unaffected.
   */
  collections?: CollectionConfig[]
}

let payloadSingleton: Promise<Payload> | null = null
let activeCollectionsKey: string | null = null

/**
 * Boot a minimal Payload instance for tests. The collections list is
 * parameterized (e.g. add ShopOrders when testing order persistence); note
 * that requesting a different collection set than the currently booted one
 * tears down the previous instance and boots a fresh one on that set's own
 * SQLite file.
 */
export async function getTestPayload(options: TestPayloadOptions = {}): Promise<Payload> {
  const collections = options.collections ?? defaultCollections
  const key = collectionsKey(collections)

  if (payloadSingleton && activeCollectionsKey === key) {
    return payloadSingleton
  }

  if (payloadSingleton) {
    // A different collection set was requested: drop the previous instance.
    const previous = payloadSingleton
    payloadSingleton = null
    activeCollectionsKey = null
    try {
      const payload = await previous
      await payload.db.destroy?.()
    } catch {
      /* ignore teardown errors of the previous instance */
    }
  }

  mkdirSync('./.tmp', { recursive: true })
  const { url, file } = dbFilesFor(key)
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    rmSync(file + suffix, { force: true })
  }
  payloadSingleton = getPayload({ config: getTestConfig(collections) })
  activeCollectionsKey = key
  return payloadSingleton
}

export async function teardownTestPayload(): Promise<void> {
  const singleton = payloadSingleton
  payloadSingleton = null
  activeCollectionsKey = null
  if (!singleton) return
  const payload = await singleton
  await payload.db.destroy?.()
}

export async function seedStock(payload: Payload): Promise<void> {
  for (const product of shopProducts) {
    for (const variant of product.variants) {
      for (const sizeEntry of variant.sizes) {
        const key = catalogKey(product.name, variant.label, sizeEntry.size)
        const existing = await payload.find({
          collection: 'shop-stock',
          where: { key: { equals: key } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing.totalDocs === 0) {
          await payload.create({
            collection: 'shop-stock',
            data: {
              key,
              productName: product.name,
              variant: variant.label,
              size: sizeEntry.size,
              stock: sizeEntry.initialStock,
            },
            overrideAccess: true,
          })
        }
      }
    }
  }
}

export async function resetState(
  payload: Payload,
  stockOverrides: Record<string, number> = {},
): Promise<void> {
  const reservations = await payload.find({
    collection: 'shop-reservations',
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  for (const reservation of reservations.docs) {
    await payload.delete({ collection: 'shop-reservations', id: reservation.id, overrideAccess: true })
  }

  for (const product of shopProducts) {
    for (const variant of product.variants) {
      for (const sizeEntry of variant.sizes) {
        const key = catalogKey(product.name, variant.label, sizeEntry.size)
        const target = stockOverrides[key] ?? sizeEntry.initialStock
        await payload.update({
          collection: 'shop-stock',
          where: { key: { equals: key } },
          data: { stock: target },
          overrideAccess: true,
        })
      }
    }
  }
}

export async function getStockValue(payload: Payload, key: string): Promise<number> {
  const result = await payload.find({
    collection: 'shop-stock',
    where: { key: { equals: key } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = result.docs[0] as unknown as { stock?: number } | undefined
  return doc?.stock ?? 0
}
