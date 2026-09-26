import type { CollectionConfig } from 'payload'
import { isAdmin } from './Users'

// 'released' is kept only for historical rows; the sweep now writes 'expired'
// so the watchdog can spot holds that lapsed without a confirmed order.
export type ReservationStatus = 'active' | 'fulfilled' | 'expired' | 'released'

export type ReservationItem = {
  key: string
  qty: number
}

export const ShopReservations: CollectionConfig = {
  slug: 'shop-reservations',
  labels: { singular: 'Prenotazione shop', plural: 'Prenotazioni shop' },
  lockDocuments: false,
  admin: {
    useAsTitle: 'orderRef',
    group: 'Shop',
    defaultColumns: ['orderRef', 'status', 'expiresAt', 'createdAt'],
    description:
      'Prenotazioni di magazzino per checkout TWINT non ancora confermati. Gestite automaticamente dal sistema: scadono dopo 2 ore e passano a "Scaduta". Il watchdog invia una mail di avviso (una sola) se la prenotazione scade senza ordine confermato (campo "Avviso inviato il"). Sola lettura.',
  },
  access: {
    read: isAdmin,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'orderRef',
      type: 'text',
      label: 'Riferimento ordine',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Stato',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Attiva', value: 'active' },
        { label: 'Confermata', value: 'fulfilled' },
        { label: 'Scaduta', value: 'expired' },
        { label: 'Rilasciata', value: 'released' },
      ],
    },
    {
      name: 'items',
      type: 'json',
      label: 'Articoli (chiave + quantità)',
      required: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      label: 'Scadenza',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'alertedAt',
      type: 'date',
      label: 'Avviso inviato il',
      admin: {
        readOnly: true,
        description:
          'Impostato dal watchdog quando la mail "possibile ordine perso" è stata inviata per questa prenotazione. Garantisce un solo avviso per prenotazione.',
      },
    },
  ],
}
