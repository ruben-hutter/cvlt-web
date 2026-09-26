import type { Payload, PayloadRequest } from 'payload'
import type { ReservationItem } from '../collections/ShopReservations'

export class InsufficientStockError extends Error {
  constructor(public stockKey: string) {
    super(stockKey)
    this.name = 'InsufficientStockError'
  }
}

type StockEntry = { id: number | string; stock: number }

function txnReq(txn: string | number | undefined): Partial<PayloadRequest> | undefined {
  return txn === undefined ? undefined : ({ transactionID: txn } as Partial<PayloadRequest>)
}

async function withTransaction<T>(
  payload: Payload,
  fn: (txn: string | number | undefined) => Promise<T>,
): Promise<T> {
  const txn = await payload.db.beginTransaction()
  try {
    const result = await fn(txn === null ? undefined : txn)
    if (txn !== null) await payload.db.commitTransaction(txn)
    return result
  } catch (error) {
    if (txn !== null) {
      try {
        await payload.db.rollbackTransaction(txn)
      } catch {
        /* ignore rollback errors */
      }
    }
    throw error
  }
}

let stockMutex: Promise<unknown> = Promise.resolve()

async function withStockLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = stockMutex.then(() => fn())
  stockMutex = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

async function fetchStockMap(payload: Payload, txn: string | number | undefined) {
  const result = await payload.find({
    collection: 'shop-stock',
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req: txnReq(txn),
  })
  const map = new Map<string, StockEntry>()
  for (const doc of result.docs) {
    const d = doc as unknown as Record<string, unknown>
    if (typeof d.key === 'string') {
      map.set(d.key, { id: d.id as number | string, stock: Number(d.stock) || 0 })
    }
  }
  return map
}

async function fetchActiveReservations(payload: Payload, txn: string | number | undefined) {
  const result = await payload.find({
    collection: 'shop-reservations',
    where: { status: { equals: 'active' } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req: txnReq(txn),
  })
  return result.docs as unknown as Array<Record<string, unknown>>
}

function reservedByKey(reservations: Array<Record<string, unknown>>): Map<string, number> {
  const map = new Map<string, number>()
  const now = Date.now()
  for (const reservation of reservations) {
    const expiresAtRaw = reservation.expiresAt
    const expiresAtMs = typeof expiresAtRaw === 'string' ? new Date(expiresAtRaw).getTime() : NaN
    if (!Number.isNaN(expiresAtMs) && expiresAtMs <= now) continue

    const items = Array.isArray(reservation.items) ? (reservation.items as ReservationItem[]) : []
    for (const item of items) {
      const key = item?.key
      const qty = Number(item?.qty) || 0
      if (!key || qty <= 0) continue
      map.set(key, (map.get(key) ?? 0) + qty)
    }
  }
  return map
}

async function sweepExpiredReservationsInTxn(
  payload: Payload,
  txn: string | number | undefined,
): Promise<number> {
  const result = await payload.find({
    collection: 'shop-reservations',
    where: {
      status: { equals: 'active' },
      expiresAt: { less_than: new Date().toISOString() },
    },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req: txnReq(txn),
  })

  for (const doc of result.docs) {
    const d = doc as unknown as Record<string, unknown>
    // Mark as 'expired' (not 'released'): the watchdog alerts on expired rows
    // that were never consumed (no alertedAt). This way an order lost between
    // two watchdog runs is still caught — see plans/tickets/...-C-shop-watchdog.
    await payload.update({
      collection: 'shop-reservations',
      id: d.id as number | string,
      data: { status: 'expired' },
      overrideAccess: true,
      req: txnReq(txn),
    })
  }

  return result.docs.length
}

export async function sweepExpiredReservations(payload: Payload): Promise<number> {
  return withStockLock(() => withTransaction(payload, (txn) => sweepExpiredReservationsInTxn(payload, txn)))
}

export async function getAvailabilityMap(payload: Payload): Promise<Record<string, number>> {
  const stockMap = await fetchStockMap(payload, undefined)
  const reservedMap = reservedByKey(await fetchActiveReservations(payload, undefined))

  const availability: Record<string, number> = {}
  for (const [key, { stock }] of stockMap) {
    availability[key] = Math.max(stock - (reservedMap.get(key) ?? 0), 0)
  }
  return availability
}

function assertAvailable(
  items: ReservationItem[],
  stockMap: Map<string, StockEntry>,
  reservedMap: Map<string, number>,
) {
  for (const item of items) {
    const stock = stockMap.get(item.key)?.stock ?? 0
    const available = stock - (reservedMap.get(item.key) ?? 0)
    if (item.qty > available) throw new InsufficientStockError(item.key)
  }
}

function aggregateByKey(items: ReservationItem[]): ReservationItem[] {
  const totals = new Map<string, number>()
  for (const item of items) {
    const qty = Number(item.qty) || 0
    if (qty <= 0 || !item.key) continue
    totals.set(item.key, (totals.get(item.key) ?? 0) + qty)
  }
  return Array.from(totals, ([key, qty]) => ({ key, qty }))
}

export async function reserveItems(
  payload: Payload,
  items: ReservationItem[],
  orderRef: string,
  ttlMs: number,
): Promise<void> {
  await withStockLock(() =>
    withTransaction(payload, async (txn) => {
      await sweepExpiredReservationsInTxn(payload, txn)
      const stockMap = await fetchStockMap(payload, txn)
      const reservedMap = reservedByKey(await fetchActiveReservations(payload, txn))
      const aggregated = aggregateByKey(items)
      assertAvailable(aggregated, stockMap, reservedMap)

      await payload.create({
        collection: 'shop-reservations',
        data: {
          orderRef,
          status: 'active',
          items: aggregated,
          expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        },
        overrideAccess: true,
        req: txnReq(txn),
      })
    }),
  )
}

export async function consumeReservation(payload: Payload, orderRef: string): Promise<boolean> {
  return withStockLock(() =>
    withTransaction(payload, async (txn) => {
      await sweepExpiredReservationsInTxn(payload, txn)

      const found = await payload.find({
        collection: 'shop-reservations',
        where: { orderRef: { equals: orderRef } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req: txnReq(txn),
      })

      const reservation = found.docs[0] as unknown as Record<string, unknown> | undefined
      if (!reservation || reservation.status !== 'active') return false

      const items = aggregateByKey(
        Array.isArray(reservation.items)
          ? (reservation.items as ReservationItem[])
          : ([] as ReservationItem[]),
      )
      const stockMap = await fetchStockMap(payload, txn)

      for (const item of items) {
        const entry = stockMap.get(item.key)
        if (!entry) continue
        const newStock = Math.max(entry.stock - (Number(item.qty) || 0), 0)
        await payload.update({
          collection: 'shop-stock',
          id: entry.id,
          data: { stock: newStock },
          overrideAccess: true,
          req: txnReq(txn),
        })
      }

      await payload.update({
        collection: 'shop-reservations',
        id: reservation.id as number | string,
        data: { status: 'fulfilled' },
        overrideAccess: true,
        req: txnReq(txn),
      })

      return true
    }),
  )
}

export async function decrementStockForSale(
  payload: Payload,
  items: ReservationItem[],
): Promise<void> {
  await withStockLock(() =>
    withTransaction(payload, async (txn) => {
      await sweepExpiredReservationsInTxn(payload, txn)
      const stockMap = await fetchStockMap(payload, txn)
      const reservedMap = reservedByKey(await fetchActiveReservations(payload, txn))
      const aggregated = aggregateByKey(items)
      assertAvailable(aggregated, stockMap, reservedMap)

      for (const item of aggregated) {
        const entry = stockMap.get(item.key)
        if (!entry) continue
        const newStock = Math.max(entry.stock - (Number(item.qty) || 0), 0)
        await payload.update({
          collection: 'shop-stock',
          id: entry.id,
          data: { stock: newStock },
          overrideAccess: true,
          req: txnReq(txn),
        })
      }
    }),
  )
}
