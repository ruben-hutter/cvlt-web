import { Suspense } from 'react'
import { ShopConfirmContent } from './ShopConfirmContent'

export const metadata = {
  title: 'Conferma ordine',
  description: 'Stato del tuo ordine sullo shop del Club Volo Libero Ticino.',
  alternates: { canonical: '/shop/confirm' },
}

export default function ShopConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ShopConfirmContent />
    </Suspense>
  )
}
