import { mkdirSync, rmSync } from 'fs'
import { buildConfig, getPayload, type CollectionConfig, type Payload } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { ShopStock } from '../../src/collections/ShopStock'
import { ShopReservations } from '../../src/collections/ShopReservations'
import { shopProducts, catalogKey } from '../../src/lib/shop-catalog'

const TEST_DB_URL = 'file:./.tmp/test-payload.db'
const TEST_DB_FILE = './.tmp/test-payload.db'

const DEFAULT_COLLECTIONS: CollectionConfig[] = [ShopStock, ShopReservations]

type TestPayloadConfig = ReturnType<typeof buildConfig>

let configSingleton: TestPayloadConfig | null = null
let payloadSingleton: Promise<Payload> | null = null

/**
 * Build (once per test file) a Payload config registering the given collections.
 * The first call in a test file wins: subsequent calls with different collections
 * return the cached config, so every call site in one test file must pass the
 * same list. Route-level tests share this config with the `@payload-config` mock
 * so that `getPayload` boots exactly one instance against the shared SQLite file.
 */
export function getTestConfig(collections: CollectionConfig[] = DEFAULT_COLLECTIONS): TestPayloadConfig {
  if (!configSingleton) {
    configSingleton = buildConfig({
      secret: 'cvlt-test-secret-not-for-prod',
      graphQL: { disable: true },
      db: sqliteAdapter({ client: { url: TEST_DB_URL } }),
      editor: lexicalEditor({ features: [] }),
      collections,
    })
  }
  return configSingleton
}

/**
 * Boot a minimal Payload instance for tests. The collections list is
 * parameterized (e.g. add ShopOrders when testing order persistence); note
 * that the singleton memoizes the FIRST collections list it is called with.
 */
export async function getTestPayload(
  collections: CollectionConfig[] = DEFAULT_COLLECTIONS,
): Promise<Payload> {
  if (!payloadSingleton) {
    mkdirSync('./.tmp', { recursive: true })
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      rmSync(TEST_DB_FILE + suffix, { force: true })
    }
    payloadSingleton = getPayload({ config: getTestConfig(collections) })
  }
  return payloadSingleton
}

export async function teardownTestPayload(): Promise<void> {
  const singleton = payloadSingleton
  payloadSingleton = null
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
  return Number((result.docs[0] as { stock?: number } | undefined)?.stock ?? 0)
}
