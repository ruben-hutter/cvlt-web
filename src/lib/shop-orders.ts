import { getPayload } from 'payload'
import config from '@payload-config'
import type { CartItem, PaymentMethod, PaymentStatus } from '@/lib/shop'

/**
 * The signed/serialized representation of a shop order, shared by the
 * client-driven confirm flow (POST /api/shop-order action 'confirm') and the
 * server-driven RaiseNow webhook (POST /api/shop-webhook). Keeping persistence
 * and the isOrderConfirmed check here guarantees that both paths finalize an
 * order through the exact same idempotent code.
 */
export type OrderPayload = {
  orderRef: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
  notes?: string
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  total: number
  createdAt: string
  items: CartItem[]
}

export async function isOrderConfirmed(orderRef: string): Promise<boolean> {
  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'shop-orders',
    where: { orderRef: { equals: orderRef } },
    limit: 1,
  })
  return existing.totalDocs > 0
}

export async function saveOrderToDb(order: OrderPayload) {
  const payload = await getPayload({ config })
  await payload.create({
    collection: 'shop-orders',
    data: {
      orderRef: order.orderRef,
      firstName: order.firstName,
      lastName: order.lastName,
      email: order.email,
      phone: order.phone,
      address: order.address,
      postalCode: order.postalCode,
      city: order.city,
      notes: order.notes || '',
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      total: order.total,
      items: order.items,
    },
    overrideAccess: true,
  })
}
