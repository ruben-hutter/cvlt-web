'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Lightbox from 'yet-another-react-lightbox'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import 'yet-another-react-lightbox/styles.css'
import { useAddressSearch, formatPhone, isValidEmail, isValidPhone, useFormRenderTime } from '@/lib/forms'
import type { AddressSuggestion } from '@/lib/forms'
import {
  formatCurrency,
  SHOP_PENDING_ORDER_TOKEN_STORAGE_KEY,
  type CartItem,
  type PaymentMethod,
  type PaymentStatus,
} from '@/lib/shop'
import { uiFieldClass, uiPrimaryButtonClass, uiSecondaryButtonClass, uiSelectClass } from '@/lib/ui'

type Variant = {
  label: string
  sizes: string[]
  price?: number
  compareAtPrice?: number
}

type Product = {
  name: string
  edition: string
  price: number
  compareAtPrice?: number
  priceLabel?: string
  image: string
  description?: string
  variants: Variant[]
  promo?: string
}

type ProductSelection = {
  variantIndex: number
  size: string
  quantity: number
}

const products: Product[] = [
  {
    name: 'Maglietta 100% Cotone Bio',
    edition: 'ed. 2025 - Unisex',
    price: 25,
    image: '/shop/maglietta-bio-2025.jpg',
    variants: [
      { label: 'Sapphire', sizes: ['M', 'L'] },
      { label: 'Dusty Indigo', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
      { label: 'Royal', sizes: ['S', 'M', 'L', 'XL'] },
    ],
  },
  {
    name: 'Giacca Fleece Uomo',
    edition: 'ed. 2023',
    price: 55,
    image: '/shop/fleece-uomo-2023.jpg',
    variants: [
      { label: 'Grigia', sizes: ['S', 'L', 'XL', 'XXL'] },
    ],
  },
  {
    name: 'Giacca Fleece Donna',
    edition: 'ed. 2023',
    price: 55,
    image: '/shop/fleece-donna-2023.jpg',
    variants: [
      { label: 'Grigia', sizes: ['S', 'M', 'L', 'XL'] },
    ],
  },
  {
    name: 'Cappellino CVLT',
    edition: 'ed. 2021',
    price: 15,
    compareAtPrice: 25,
    image: '/shop/cap-2021.jpeg',
    variants: [
      { label: 'Blu scuro', sizes: ['S/M', 'L/XL'] },
    ],
  },
]

function itemKey(item: CartItem) {
  return `${item.productName}__${item.variant}__${item.size}`
}

function BasketIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h16l-1.2 8.5a2 2 0 0 1-2 1.5H7.2a2 2 0 0 1-2-1.5L4 10Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10V8a3 3 0 1 1 6 0v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 13.5h.01M14.5 13.5h.01" />
    </svg>
  )
}

function paymentMethodLabel(value: PaymentMethod) {
  return value === 'invoice' ? 'Fattura / bonifico' : 'TWINT'
}

function paymentStatusLabel(value: PaymentStatus) {
  return value === 'pending_invoice' ? 'Da pagare (fattura)' : 'Pagato (TWINT)'
}

export function ShopContent() {
  const searchParams = useSearchParams()
  const [lightboxIndex, setLightboxIndex] = useState(-1)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)

  const renderTime = useFormRenderTime()

  const [isPreparingCheckout, setIsPreparingCheckout] = useState(false)
  const [isConfirmingOrder, setIsConfirmingOrder] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('twint')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)
  const [confirmedOrderRef, setConfirmedOrderRef] = useState<string | null>(null)
  const [confirmedPaymentStatus, setConfirmedPaymentStatus] = useState<PaymentStatus | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [toastFading, setToastFading] = useState(false)

  const suggestionsRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const hasAttemptedAutoConfirmRef = useRef(false)

  const suggestions = useAddressSearch(address)

  const [selectionByProduct, setSelectionByProduct] = useState<Record<number, ProductSelection>>(() => {
    const initial: Record<number, ProductSelection> = {}
    products.forEach((product, index) => {
      initial[index] = {
        variantIndex: 0,
        size: product.variants[0]?.sizes[0] || '',
        quantity: 1,
      }
    })
    return initial
  })

  const finalTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cartItems],
  )
  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems])

  const canStartCheckout =
    cartItems.length > 0 &&
    !!firstName.trim() &&
    !!lastName.trim() &&
    !!email.trim() &&
    !!phone.trim() &&
    !!address.trim() &&
    !!postalCode.trim() &&
    !!city.trim() &&
    isValidEmail(email) &&
    isValidPhone(phone)

  useEffect(() => {
    setActiveSuggestionIndex(-1)
  }, [suggestions])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!toastMessage) return
    setToastFading(false)
    const fadeTimer = globalThis.setTimeout(() => setToastFading(true), 2000)
    const removeTimer = globalThis.setTimeout(() => setToastMessage(null), 2500)

    return () => {
      globalThis.clearTimeout(fadeTimer)
      globalThis.clearTimeout(removeTimer)
    }
  }, [toastMessage])

  useEffect(() => {
    const { body } = document
    const previousOverflow = body.style.overflow
    if (isCartOpen) body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousOverflow
    }
  }, [isCartOpen])

  useEffect(() => {
    const paid = searchParams.get('shop_paid') === '1'
    const failed = searchParams.get('shop_failed') === '1'

    if (failed) {
      setFeedbackError('Pagamento non completato. Puoi riprovare qui sotto.')
      window.history.replaceState({}, '', window.location.pathname)
    }

    if (!paid || hasAttemptedAutoConfirmRef.current) return

    hasAttemptedAutoConfirmRef.current = true

    const token = localStorage.getItem(SHOP_PENDING_ORDER_TOKEN_STORAGE_KEY)
    if (!token) {
      setFeedbackError('Ordine non trovato localmente. Se hai pagato, contatta il comitato shop.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    setIsConfirmingOrder(true)
    setFeedbackError(null)

    void fetch('/api/shop-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm', orderToken: token }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'Conferma ordine fallita')

        setConfirmedOrderRef(data.orderRef)
        setConfirmedPaymentStatus((data.paymentStatus === 'pending_invoice' ? 'pending_invoice' : 'paid') as PaymentStatus)
        setFeedbackMessage(
          'Ordine confermato! Riceverai una mail di conferma con il riepilogo. Grazie per il tuo acquisto!',
        )
        setCartItems([])
        setFirstName('')
        setLastName('')
        setEmail('')
        setPhone('')
        setAddress('')
        setPostalCode('')
        setCity('')
        setNotes('')
        setPaymentMethod('twint')
        setIsCartOpen(false)
        localStorage.removeItem(SHOP_PENDING_ORDER_TOKEN_STORAGE_KEY)
        window.history.replaceState({}, '', window.location.pathname)
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Conferma ordine fallita'
        setFeedbackError(message)
      })
      .finally(() => {
        setIsConfirmingOrder(false)
      })
  }, [searchParams])

  function updateSelection(index: number, update: Partial<ProductSelection>) {
    setSelectionByProduct((prev) => {
      const current = prev[index]
      if (!current) return prev
      return {
        ...prev,
        [index]: {
          ...current,
          ...update,
        },
      }
    })
  }

  function addToCart(productIndex: number) {
    const product = products[productIndex]
    const selection = selectionByProduct[productIndex]
    if (!product || !selection) return

    const variant = product.variants[selection.variantIndex]
    if (!variant || !selection.size || selection.quantity <= 0) return

    const unitPrice = variant.price || product.price
    const newItem: CartItem = {
      productName: product.name,
      edition: product.edition,
      variant: variant.label,
      size: selection.size,
      quantity: selection.quantity,
      unitPrice,
    }

    setCartItems((prev) => {
      const key = itemKey(newItem)
      const existing = prev.find((item) => itemKey(item) === key)
      if (!existing) return [...prev, newItem]

      return prev.map((item) =>
        itemKey(item) === key ? { ...item, quantity: Math.min(item.quantity + newItem.quantity, 99) } : item,
      )
    })

    setFeedbackError(null)
    setToastMessage(`Aggiunto al carrello: ${newItem.productName} (${newItem.variant}, ${newItem.size}) x${newItem.quantity}`)
  }

  function removeFromCart(item: CartItem) {
    setCartItems((prev) => prev.filter((x) => itemKey(x) !== itemKey(item)))
  }

  function increaseCartQuantity(item: CartItem) {
    setCartItems((prev) =>
      prev.map((x) => (itemKey(x) === itemKey(item) ? { ...x, quantity: Math.min(x.quantity + 1, 99) } : x)),
    )
  }

  function decreaseCartQuantity(item: CartItem) {
    setCartItems((prev) =>
      prev
        .map((x) => (itemKey(x) === itemKey(item) ? { ...x, quantity: x.quantity - 1 } : x))
        .filter((x) => x.quantity > 0),
    )
  }

  function selectAddress(suggestion: AddressSuggestion) {
    setAddress(suggestion.street)
    setPostalCode(suggestion.zip)
    setCity(suggestion.city)
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)
    setTimeout(() => emailRef.current?.focus(), 0)
  }

  function handleAddressKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
      return
    }

    if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault()
      selectAddress(suggestions[activeSuggestionIndex])
      return
    }

    if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
    }
  }

  async function startCheckout() {
    if (!canStartCheckout || isPreparingCheckout) return

    if (!isValidEmail(email)) {
      setFeedbackError('Indirizzo email non valido.')
      return
    }

    if (!isValidPhone(phone)) {
      setFeedbackError('Numero di telefono non valido (minimo 10 cifre).')
      return
    }

    setIsPreparingCheckout(true)
    setFeedbackError(null)
    setFeedbackMessage(null)

    try {
      const res = await fetch('/api/shop-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare',
          firstName,
          lastName,
          email,
          phone,
          address,
          postalCode,
          city,
          notes,
          paymentMethod,
          items: cartItems,
          website: honeypot,
          renderTs: renderTime,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Impossibile avviare il pagamento')

      if (paymentMethod === 'invoice') {
        setConfirmedOrderRef(data.orderRef)
        setConfirmedPaymentStatus((data.paymentStatus === 'pending_invoice' ? 'pending_invoice' : 'paid') as PaymentStatus)
        setFeedbackMessage('Ordine ricevuto! Ti abbiamo inviato una mail con i dati per il pagamento tramite fattura.')
        setCartItems([])
        setFirstName('')
        setLastName('')
        setEmail('')
        setPhone('')
        setAddress('')
        setPostalCode('')
        setCity('')
        setNotes('')
        setPaymentMethod('twint')
        setIsCartOpen(false)
        localStorage.removeItem(SHOP_PENDING_ORDER_TOKEN_STORAGE_KEY)
        return
      }

      localStorage.setItem(SHOP_PENDING_ORDER_TOKEN_STORAGE_KEY, data.orderToken)
      window.location.href = data.checkoutUrl
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Impossibile avviare il pagamento'
      setFeedbackError(message)
    } finally {
      setIsPreparingCheckout(false)
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold text-cvlt-gray-900">Shop</h1>
        <button
          type="button"
          className={`${uiSecondaryButtonClass} gap-2 px-4 py-2 font-semibold shadow-sm lg:hidden`}
          onClick={() => setIsCartOpen(true)}
          aria-label={`Apri carrello (${cartCount})`}
        >
          <BasketIcon />
          <span className="text-xs">({cartCount})</span>
          <span className="rounded-full bg-cvlt-blue/10 px-2 py-0.5 text-xs text-cvlt-blue">{formatCurrency(finalTotal)}</span>
        </button>
      </div>

      <p className="mt-4 text-cvlt-gray-700">
        Articoli del Club Volo Libero Ticino. Seleziona articoli, completa il pagamento TWINT e la spedizione sarà
        gestita da Barbara.
      </p>

      {feedbackMessage && (
        <div className="mt-5 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {feedbackMessage}
          {confirmedOrderRef && <div className="mt-1 font-medium">Riferimento ordine: {confirmedOrderRef}</div>}
          {confirmedPaymentStatus && (
            <div className="mt-2 inline-flex rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
              Stato pagamento: {paymentStatusLabel(confirmedPaymentStatus)}
            </div>
          )}
        </div>
      )}

      {feedbackError && (
        <div className="mt-5 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {feedbackError}
        </div>
      )}

      <div className="mt-4 flex gap-6 sm:mt-8">
        <div className="min-w-0 flex-1">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product, i) => {
            const selection = selectionByProduct[i]
            const selectedVariant = product.variants[selection?.variantIndex ?? 0]
            const unitPrice = selectedVariant?.price || product.price
            const oldPrice = selectedVariant?.compareAtPrice || product.compareAtPrice
            const isOnSale = !!oldPrice && oldPrice > unitPrice

            return (
              <div key={`${product.name}-${product.edition}`} className="overflow-hidden rounded-lg border border-cvlt-gray-200">
                <button onClick={() => setLightboxIndex(i)} className="w-full">
                  <div className="aspect-square overflow-hidden bg-cvlt-gray-100">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                    />
                  </div>
                </button>

                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-cvlt-gray-900">{product.name}</h2>
                    {isOnSale && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">Saldi</span>
                    )}
                  </div>
                  <p className="text-xs text-cvlt-gray-500">{product.edition}</p>
                  {isOnSale ? (
                    <p className="mt-2 text-lg font-bold">
                      <span className="relative inline-block text-cvlt-gray-400">
                        {formatCurrency(oldPrice)}
                        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                      </span>{' '}
                      <span className="text-red-600">{formatCurrency(unitPrice)}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-lg font-bold text-cvlt-blue">{formatCurrency(unitPrice)}</p>
                  )}

                  <div className="mt-3 space-y-3">
                    <div>
                      <label
                        htmlFor={`variant-${i}`}
                        className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cvlt-gray-500"
                      >
                        Variante
                      </label>
                        <select
                          id={`variant-${i}`}
                          className={uiSelectClass}
                          value={selection?.variantIndex ?? 0}
                        onChange={(event) => {
                          const variantIndex = Number(event.target.value)
                          const nextVariant = product.variants[variantIndex]
                          updateSelection(i, {
                            variantIndex,
                            size: nextVariant?.sizes[0] || '',
                          })
                        }}
                      >
                        {product.variants.map((variant, variantIndex) => {
                          const variantPrice = variant.price || product.price
                          const extra = variantPrice === product.price ? '' : ` (${formatCurrency(variantPrice)})`

                          return (
                            <option key={variant.label} value={variantIndex}>
                              {variant.label}
                              {extra}
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`size-${i}`}
                        className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cvlt-gray-500"
                      >
                        Taglia
                      </label>
                        <select
                          id={`size-${i}`}
                          className={uiSelectClass}
                          value={selection?.size || ''}
                        onChange={(event) => updateSelection(i, { size: event.target.value })}
                      >
                        {selectedVariant?.sizes.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`quantity-${i}`}
                        className="mb-1 block text-xs font-semibold uppercase tracking-wide text-cvlt-gray-500"
                      >
                        Quantita
                      </label>
                      <div id={`quantity-${i}`} className="flex items-center gap-2">
                        <button
                          type="button"
                          className={uiSecondaryButtonClass}
                          onClick={() =>
                            updateSelection(i, {
                              quantity: Math.max((selection?.quantity ?? 1) - 1, 1),
                            })
                          }
                        >
                          -
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold">{selection?.quantity ?? 1}</span>
                        <button
                          type="button"
                          className={uiSecondaryButtonClass}
                          onClick={() =>
                            updateSelection(i, {
                              quantity: Math.min((selection?.quantity ?? 1) + 1, 20),
                            })
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`${uiPrimaryButtonClass} mt-4 w-full`}
                    onClick={() => addToCart(i)}
                  >
                    Aggiungi al carrello
                  </button>

                  {product.promo && (
                    <p className="mt-3 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">{product.promo}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </div>

        <aside className="hidden flex-shrink-0 lg:block lg:w-44">
          <div className="sticky top-20">
            <button
              type="button"
              className={`${uiSecondaryButtonClass} gap-2 px-4 py-2 font-semibold shadow-sm`}
              onClick={() => setIsCartOpen(true)}
              aria-label={`Apri carrello (${cartCount})`}
            >
              <BasketIcon />
              <span className="text-xs">({cartCount})</span>
              <span className="rounded-full bg-cvlt-blue/10 px-2 py-0.5 text-xs text-cvlt-blue">{formatCurrency(finalTotal)}</span>
            </button>
          </div>
        </aside>
      </div>

      {isCartOpen && (
        <button
          type="button"
          aria-label="Chiudi carrello"
          className="fixed inset-0 z-40 bg-black/35"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      <aside
        id="shop-cart"
        className={`fixed inset-0 z-50 overflow-y-auto bg-white shadow-2xl transition duration-300 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(96vw,780px)] sm:border-l sm:border-cvlt-gray-200 ${
          isCartOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
          <div className="flex items-center justify-between border-b border-cvlt-gray-200 px-5 py-4">
            <h2 className="text-xl font-semibold text-cvlt-gray-900">Carrello</h2>
            <button
              type="button"
              className={uiSecondaryButtonClass}
              onClick={() => setIsCartOpen(false)}
            >
              Chiudi
            </button>
          </div>

          <div className="space-y-6 px-5 py-5">
          {cartItems.length === 0 ? (
            <p className="text-sm text-cvlt-gray-600">Nessun articolo nel carrello.</p>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div key={itemKey(item)} className="rounded-lg border border-cvlt-gray-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-cvlt-gray-900">{item.productName}</div>
                      <div className="text-xs text-cvlt-gray-500">{item.edition}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-cvlt-gray-600">
                        <span>{item.variant}</span>
                        <span>Taglia {item.size}</span>
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-cvlt-gray-900 whitespace-nowrap">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        className={`${uiSecondaryButtonClass} px-2 py-0.5 text-xs`}
                        onClick={() => decreaseCartQuantity(item)}
                      >
                        -
                      </button>
                      <span className="min-w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        className={`${uiSecondaryButtonClass} px-2 py-0.5 text-xs`}
                        onClick={() => increaseCartQuantity(item)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-cvlt-gray-500 underline"
                      onClick={() => removeFromCart(item)}
                    >
                      Rimuovi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1 text-right">
            <div className="text-lg font-bold text-cvlt-gray-900">Totale: {formatCurrency(finalTotal)}</div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="shop-lastName" className="mb-1 block text-sm font-medium">Cognome <span className="text-red-500">*</span></label>
              <input
                id="shop-lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={uiFieldClass}
              />
            </div>
            <div>
              <label htmlFor="shop-firstName" className="mb-1 block text-sm font-medium">Nome <span className="text-red-500">*</span></label>
              <input
                id="shop-firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={uiFieldClass}
              />
            </div>
          </div>

          <div className="relative" ref={suggestionsRef}>
            <label htmlFor="shop-address" className="mb-1 block text-sm font-medium">Via e Nr. <span className="text-red-500">*</span></label>
            <input
              id="shop-address"
              type="text"
              value={address}
              autoComplete="off"
              placeholder="Inizia a digitare per cercare..."
              onChange={(e) => {
                setAddress(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleAddressKeyDown}
              className={uiFieldClass}
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg">
                {suggestions.map((suggestion, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => selectAddress(suggestion)}
                      className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm ${
                        index === activeSuggestionIndex ? 'bg-blue-50' : 'hover:bg-cvlt-blue-light'
                      }`}
                    >
                      <span className="font-medium">{suggestion.street}</span>
                      <span className="text-gray-400">
                        {suggestion.zip} {suggestion.city}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-[8rem_1fr]">
            <div>
              <label htmlFor="shop-postalCode" className="mb-1 block text-sm font-medium">NPA <span className="text-red-500">*</span></label>
              <input
                id="shop-postalCode"
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="6500"
                className={uiFieldClass}
              />
            </div>
            <div>
              <label htmlFor="shop-city" className="mb-1 block text-sm font-medium">Domicilio <span className="text-red-500">*</span></label>
              <input
                id="shop-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Bellinzona"
                className={uiFieldClass}
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="shop-email" className="mb-1 block text-sm font-medium">Email <span className="text-red-500">*</span></label>
              <input
                ref={emailRef}
                id="shop-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={uiFieldClass}
              />
            </div>
            <div>
              <label htmlFor="shop-phone" className="mb-1 block text-sm font-medium">Telefono <span className="text-red-500">*</span></label>
              <input
                id="shop-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="+41 79 123 45 67"
                className={uiFieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="shop-notes" className="mb-1 block text-sm font-medium">Commenti o domande (opzionale)</label>
            <textarea
              id="shop-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={uiFieldClass}
              placeholder="Richieste particolari, consegna, ecc."
            />
          </div>

          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="absolute h-0 w-0 opacity-0"
            style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}
          />

          <div>
            <label className="mb-2 block text-sm font-medium">Metodo di pagamento <span className="text-red-500">*</span></label>
            <div className="space-y-2">
              {([
                { value: 'twint', label: 'TWINT', price: 'pagamento immediato online' },
                { value: 'invoice', label: 'Fattura', price: 'pagamento tramite bonifico' },
              ] as const).map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-3 rounded border px-4 py-3 transition-colors ${
                    paymentMethod === option.value
                      ? 'border-cvlt-blue bg-cvlt-blue-light'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="shop-payment-method"
                    value={option.value}
                    checked={paymentMethod === option.value}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="accent-cvlt-blue"
                  />
                  <span className="font-medium">{option.label}</span>
                  <span className="text-sm text-gray-500">&mdash; {option.price}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startCheckout}
              disabled={!canStartCheckout || isPreparingCheckout || isConfirmingOrder}
              className={uiPrimaryButtonClass}
            >
              {isPreparingCheckout
                ? paymentMethod === 'invoice'
                  ? 'Invio ordine...'
                  : 'Preparazione checkout...'
                : paymentMethod === 'invoice'
                  ? 'Invia ordine con fattura'
                  : 'Checkout'}
            </button>

            <span className="text-sm text-cvlt-gray-600">Selezionato: {paymentMethodLabel(paymentMethod)}</span>

            {isConfirmingOrder && <span className="text-sm text-cvlt-gray-600">Conferma ordine in corso...</span>}
          </div>

        </div>
      </aside>

      <Lightbox
        open={lightboxIndex >= 0}
        close={() => setLightboxIndex(-1)}
        index={lightboxIndex}
        slides={products.map((p) => ({ src: p.image, alt: p.name }))}
        plugins={[Fullscreen]}
      />

      {toastMessage && (
        <div className={`pointer-events-none fixed top-20 right-4 z-[60] w-[min(92vw,420px)] rounded-lg border border-cvlt-blue/20 bg-white px-4 py-3 text-sm text-cvlt-gray-900 shadow-xl transition-all duration-500 ${toastFading ? 'translate-x-[calc(100%+1rem)] opacity-0' : 'translate-x-0 opacity-100'}`}>
          {toastMessage}
        </div>
      )}
    </main>
  )
}
