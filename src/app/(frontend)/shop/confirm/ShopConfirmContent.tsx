'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { SHOP_PENDING_ORDER_TOKEN_STORAGE_KEY } from '@/lib/shop'
import { uiPrimaryButtonClass } from '@/lib/ui'

type PollStatus = 'paid' | 'pending' | 'not_found'
type ViewState = PollStatus | 'searching' | 'unknown_ref' | 'timeout'

const POLL_INTERVAL_MS = 3_000
const POLL_DEADLINE_MS = 3 * 60 * 1000

// Fallback for redirect configs without ?order_ref=: the signed order token in
// localStorage contains the orderRef. We only decode it to poll the read-only
// status endpoint — the server still verifies everything it acts on.
function readOrderRefFromToken(): string | null {
  try {
    const token = localStorage.getItem(SHOP_PENDING_ORDER_TOKEN_STORAGE_KEY)
    if (!token) return null
    const [encoded] = token.split('.')
    if (!encoded) return null
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { orderRef?: unknown }
    return typeof data.orderRef === 'string' && data.orderRef.length > 0 ? data.orderRef : null
  } catch {
    return null
  }
}

function Spinner() {
  return (
    <svg
      className="h-8 w-8 animate-spin text-cvlt-blue"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  )
}

function StatusCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-cvlt-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
      {children}
    </div>
  )
}

export function ShopConfirmContent() {
  const searchParams = useSearchParams()
  const [view, setView] = useState<ViewState>('searching')

  const queryRef = searchParams.get('order_ref')

  useEffect(() => {
    const orderRef = (queryRef && queryRef.trim().toLowerCase()) || readOrderRefFromToken()
    if (!orderRef) {
      setView('unknown_ref')
      return
    }

    let cancelled = false
    const deadline = Date.now() + POLL_DEADLINE_MS

    async function poll() {
      if (cancelled) return
      try {
        const res = await fetch('/api/shop-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status', orderRef }),
        })
        const data = (await res.json()) as { status?: PollStatus }
        if (!cancelled && res.ok && data.status === 'paid') {
          setView('paid')
          return
        }
        if (!cancelled && res.ok && data.status === 'pending') {
          // Reservation exists, order not yet recorded — the webhook is on its way.
          setView((current) => (current === 'paid' ? current : 'pending'))
        }
      } catch {
        // Network hiccup: keep polling until the deadline.
      }
      if (cancelled) return
      if (Date.now() >= deadline) {
        setView((current) => (current === 'paid' ? current : 'timeout'))
        return
      }
      globalThis.setTimeout(() => void poll(), POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      cancelled = true
    }
  }, [queryRef])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="mb-8 text-3xl font-bold text-cvlt-gray-900">Conferma ordine</h1>

      {view === 'searching' && (
        <StatusCard>
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-sm text-cvlt-gray-600">
              Verifichiamo lo stato del tuo ordine… La pagina si aggiorna automaticamente.
            </p>
          </div>
        </StatusCard>
      )}

      {view === 'paid' && (
        <StatusCard>
          <div className="flex flex-col items-center gap-4">
            <svg className="h-12 w-12 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5 11.5 15 15.5 9.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <h2 className="text-xl font-semibold text-cvlt-gray-900">Ordine confermato!</h2>
            <p className="text-sm text-cvlt-gray-600">
              Il tuo pagamento è andato a buon fine e l&apos;ordine è stato registrato. Riceverai una
              mail di conferma con il riepilogo. Grazie per il tuo acquisto!
            </p>
            <Link href="/shop" className={uiPrimaryButtonClass}>
              Torna allo shop
            </Link>
          </div>
        </StatusCard>
      )}

      {view === 'pending' && (
        <StatusCard>
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <h2 className="text-xl font-semibold text-cvlt-gray-900">Ordine in fase di conferma</h2>
            <p className="text-sm text-cvlt-gray-600">
              Abbiamo ricevuto il tuo pagamento: l&apos;ordine viene registrato dal server. Questa
              pagina si aggiorna automaticamente.
            </p>
          </div>
        </StatusCard>
      )}

      {view === 'timeout' && (
        <StatusCard>
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-semibold text-cvlt-gray-900">Ordine non ancora visibile</h2>
            <p className="text-sm text-cvlt-gray-600">
              Se hai pagato con TWINT, l&apos;ordine viene registrato automaticamente di solito nel
              giro di pochi minuti e ricevi una mail di conferma. Se dopo un&apos;ora non hai
              ricevuto nulla, contatta il comitato shop: il pagamento risulta comunque su RaiseNow
              e rimedieremo.
            </p>
            <Link href="/shop" className={uiPrimaryButtonClass}>
              Torna allo shop
            </Link>
          </div>
        </StatusCard>
      )}

      {view === 'unknown_ref' && (
        <StatusCard>
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-semibold text-cvlt-gray-900">Grazie per il tuo acquisto!</h2>
            <p className="text-sm text-cvlt-gray-600">
              Non abbiamo trovato un riferimento ordine da controllare, ma se hai completato il
              pagamento con TWINT l&apos;ordine viene registrato automaticamente dal server e ricevi
              una mail di conferma. Se entro un&apos;ora non hai ricevuto nulla, contatta il comitato
              shop.
            </p>
            <Link href="/shop" className={uiPrimaryButtonClass}>
              Torna allo shop
            </Link>
          </div>
        </StatusCard>
      )}
    </main>
  )
}
