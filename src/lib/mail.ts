import nodemailer from 'nodemailer'
import path from 'node:path'
import { requireEnv } from '@/lib/env'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const e = escapeHtml

const transporter = nodemailer.createTransport({
  host: 'mail.infomaniak.com',
  port: 587,
  secure: false,
  auth: {
    user: requireEnv('SMTP_USER'),
    pass: requireEnv('SMTP_PASS'),
  },
})

/**
 * Verifies the SMTP configuration (connect + auth) without sending any mail.
 * Used by the watchdog daily self-check.
 */
export async function verifyMailTransport(): Promise<void> {
  await transporter.verify()
}

const from = requireEnv('SMTP_FROM')
const contactRecipient = requireEnv('CONTACT_EMAIL')
const membershipRecipient = requireEnv('MEMBERSHIP_EMAIL')
const shopRecipient = requireEnv('SHOP_EMAIL')

type ContactData = {
  firstName: string
  lastName: string
  email: string
  message: string
}

export async function sendContactNotification(data: ContactData) {
  await transporter.sendMail({
    from,
    replyTo: data.email,
    to: contactRecipient,
    subject: `Messaggio dal sito: ${data.lastName} ${data.firstName}`,
    text: `Nuovo messaggio dal modulo di contatto sul sito cvlt.ch

Cognome: ${data.lastName}
Nome: ${data.firstName}
Email: ${data.email}

Messaggio:
${data.message}
`,
    html: `
<h2>Nuovo messaggio dal modulo di contatto</h2>
<table style="border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Cognome</td><td>${e(data.lastName)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Nome</td><td>${e(data.firstName)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td><a href="mailto:${e(data.email)}">${e(data.email)}</a></td></tr>
</table>
<h3 style="margin-top:16px;">Messaggio</h3>
<p style="white-space:pre-wrap;">${e(data.message)}</p>
`,
  })

  await transporter.sendMail({
    from,
    to: data.email,
    subject: 'Messaggio ricevuto - CVLT',
    text: `Gentile ${data.firstName} ${data.lastName},

Abbiamo ricevuto il tuo messaggio e ti risponderemo al più presto.

Il tuo messaggio:
${data.message}

Cordiali saluti,
Club Volo Libero Ticino
https://cvlt.ch
`,
    html: `
<p>Gentile ${e(data.firstName)} ${e(data.lastName)},</p>
<p>Abbiamo ricevuto il tuo messaggio e ti risponderemo al più presto.</p>
<h3 style="margin-top:16px;">Il tuo messaggio</h3>
<p style="white-space:pre-wrap;">${e(data.message)}</p>
<p style="margin-top:20px;">Cordiali saluti,<br>Club Volo Libero Ticino<br><a href="https://cvlt.ch">cvlt.ch</a></p>
`,
  })
}

type MembershipData = {
  firstName: string
  lastName: string
  address: string
  city: string
  email: string
  phone: string
  membershipType: string
  notes?: string
}

const typeLabels: Record<string, string> = {
  active: 'Socio attivo - CHF 40.–',
  family: 'Famiglia - CHF 45.–',
  supporter: 'Sostenitore - contributo libero',
}

export async function sendMembershipNotification(data: MembershipData) {
  const typeLabel = typeLabels[data.membershipType] || data.membershipType

  // Email to the club
  await transporter.sendMail({
    from,
    to: membershipRecipient,
    subject: `Nuova richiesta di adesione: ${data.lastName} ${data.firstName}`,
    text: `Nuova richiesta di adesione al CVLT

Cognome: ${data.lastName}
Nome: ${data.firstName}
Indirizzo: ${data.address}
NPA / Domicilio: ${data.city}
Email: ${data.email}
Telefono: ${data.phone}
Tipo di iscrizione: ${typeLabel}
${data.notes ? `\nOsservazioni: ${data.notes}` : ''}
`,
    html: `
<h2>Nuova richiesta di adesione al CVLT</h2>
<table style="border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Cognome</td><td>${e(data.lastName)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Nome</td><td>${e(data.firstName)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Indirizzo</td><td>${e(data.address)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">NPA / Domicilio</td><td>${e(data.city)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td><a href="mailto:${e(data.email)}">${e(data.email)}</a></td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Telefono</td><td>${e(data.phone)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Tipo di iscrizione</td><td>${e(typeLabel)}</td></tr>
  ${data.notes ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Osservazioni</td><td>${e(data.notes)}</td></tr>` : ''}
</table>
`,
  })

  // Confirmation to the applicant
  await transporter.sendMail({
    from,
    to: data.email,
    subject: 'Richiesta di adesione al CVLT ricevuta',
    text: `Gentile ${data.firstName} ${data.lastName},

Abbiamo ricevuto la tua richiesta di adesione al Club Volo Libero Ticino.
Ti contatteremo al più presto.

Riepilogo dei dati inviati:
  Cognome: ${data.lastName}
  Nome: ${data.firstName}
  Indirizzo: ${data.address}
  NPA / Domicilio: ${data.city}
  Email: ${data.email}
  Telefono: ${data.phone}
  Tipo di iscrizione: ${typeLabel}
${data.notes ? `  Osservazioni: ${data.notes}\n` : ''}
Se noti un errore nei dati, contattaci a ${membershipRecipient}.

Cordiali saluti,
Club Volo Libero Ticino
https://cvlt.ch
`,
    html: `
<p>Gentile ${e(data.firstName)} ${e(data.lastName)},</p>
<p>Abbiamo ricevuto la tua richiesta di adesione al Club Volo Libero Ticino.<br>Ti contatteremo al più presto.</p>
<h3 style="margin-top:20px;">Riepilogo dei dati inviati</h3>
<table style="border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Cognome</td><td>${e(data.lastName)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Nome</td><td>${e(data.firstName)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Indirizzo</td><td>${e(data.address)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">NPA / Domicilio</td><td>${e(data.city)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Email</td><td>${e(data.email)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Telefono</td><td>${e(data.phone)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Tipo di iscrizione</td><td>${e(typeLabel)}</td></tr>
  ${data.notes ? `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Osservazioni</td><td>${e(data.notes)}</td></tr>` : ''}
</table>
<p style="margin-top:16px;font-size:14px;color:#666;">Se noti un errore nei dati, contattaci a <a href="mailto:${membershipRecipient}">${membershipRecipient}</a>.</p>
<p style="margin-top:20px;">Cordiali saluti,<br>Club Volo Libero Ticino<br><a href="https://cvlt.ch">cvlt.ch</a></p>
`,
  })
}

type ShopOrderItem = {
  productName: string
  edition: string
  variant: string
  size: string
  quantity: number
  unitPrice: number
}

type ShopOrderData = {
  orderRef: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
  notes?: string
  paymentMethod: 'twint' | 'invoice'
  paymentStatus: 'paid' | 'pending_invoice'
  total: number
  createdAt: string
  items: ShopOrderItem[]
}

function formatCurrency(value: number) {
  return `CHF ${value.toFixed(2)}`
}

const shopInvoiceIban = 'CH82 0900 0000 6900 0419 3'
const shopInvoiceBeneficiary = 'Club Volo Libero Ticino, 6500 Bellinzona'
const shopQrBillImagePath = path.join(process.cwd(), 'public', 'qr-bill.png')

function paymentMethodLabel(paymentMethod: ShopOrderData['paymentMethod']) {
  return paymentMethod === 'invoice' ? 'Fattura / bonifico' : 'TWINT'
}

function paymentStatusLabel(paymentStatus: ShopOrderData['paymentStatus']) {
  return paymentStatus === 'pending_invoice' ? 'DA PAGARE (FATTURA)' : 'PAGATO (TWINT)'
}

export async function sendShopOrderNotification(data: ShopOrderData) {
  const invoiceAttachments = data.paymentMethod === 'invoice'
    ? [{ filename: 'qr-bill-cvlt.png', path: shopQrBillImagePath, cid: 'shop-qr-bill' }]
    : []

  const methodLabel = paymentMethodLabel(data.paymentMethod)
  const statusLabel = paymentStatusLabel(data.paymentStatus)
  const paymentInstructionsHtml = data.paymentMethod === 'invoice'
    ? `
<h3>Dati per il pagamento con fattura</h3>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border:1px solid #d9d9d9;border-radius:8px;background:#fafafa;">
  <tr>
    <td style="padding:14px;">
      <div style="font-size:12px;color:#555;margin-bottom:8px;">Dettagli per il bonifico</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:10px;font-size:14px;line-height:1.45;color:#111;">
        <tr>
          <td style="padding:2px 0;vertical-align:top;width:95px;"><strong>IBAN:</strong></td>
          <td style="padding:2px 0;vertical-align:top;">${shopInvoiceIban}</td>
        </tr>
        <tr>
          <td style="padding:2px 0;vertical-align:top;width:95px;"><strong>Beneficiario:</strong></td>
          <td style="padding:2px 0;vertical-align:top;">${shopInvoiceBeneficiary}</td>
        </tr>
        <tr>
          <td style="padding:2px 0;vertical-align:top;width:95px;"><strong>Causale:</strong></td>
          <td style="padding:2px 0;vertical-align:top;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace;word-break:break-all;">Ordine shop ${data.orderRef}</td>
        </tr>
      </table>

      <div style="margin-top:10px;font-size:12px;color:#555;">Inquadra il QR con l'app della tua banca.</div>
      <div style="margin-top:8px;">
        <img src="cid:shop-qr-bill" alt="QR code pagamento" style="width:148px;height:148px;border:1px solid #e5e5e5;border-radius:6px;display:block;background:#fff;">
      </div>
    </td>
  </tr>
</table>
`
    : ''

  const itemsText = data.items
    .map(
      (item) =>
        `- ${item.productName} (${item.edition}) | ${item.variant} | Taglia ${item.size} | Qta ${item.quantity} | ${formatCurrency(item.unitPrice)} | Subtotale ${formatCurrency(item.quantity * item.unitPrice)}`,
    )
    .join('\n')

  const itemsHtml = data.items
    .map(
      (item) => `
  <tr>
    <td style="padding:6px 8px;border:1px solid #ddd;">${e(item.productName)}</td>
    <td style="padding:6px 8px;border:1px solid #ddd;">${e(item.edition)}</td>
    <td style="padding:6px 8px;border:1px solid #ddd;">${e(item.variant)}</td>
    <td style="padding:6px 8px;border:1px solid #ddd;">${e(item.size)}</td>
    <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${item.quantity}</td>
    <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${formatCurrency(item.unitPrice)}</td>
    <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${formatCurrency(item.quantity * item.unitPrice)}</td>
  </tr>`,
    )
    .join('')

  // Email to the shop manager
  await transporter.sendMail({
    from,
    to: shopRecipient,
    subject: `[${statusLabel}] Nuovo ordine shop (${data.orderRef})`,
    text: `Nuovo ordine shop

Riferimento ordine: ${data.orderRef}
Data: ${data.createdAt}
Metodo di pagamento: ${methodLabel}
STATO PAGAMENTO: ${statusLabel}

Cliente:
Nome: ${data.firstName} ${data.lastName}
Email: ${data.email}
Telefono: ${data.phone}
Via: ${data.address}
NPA: ${data.postalCode}
Domicilio: ${data.city}
${data.notes ? `Note: ${data.notes}` : ''}

Articoli:
${itemsText}

Totale: ${formatCurrency(data.total)}
`,
    html: `
<h2>Nuovo ordine shop</h2>
<p><strong>Riferimento ordine:</strong> ${e(data.orderRef)}<br>
<strong>Data:</strong> ${e(data.createdAt)}<br>
<strong>Metodo di pagamento:</strong> ${e(methodLabel)}<br>
<strong>Stato pagamento:</strong> <span style="font-weight:700;">${e(statusLabel)}</span></p>

<h3>Cliente</h3>
<p><strong>Nome:</strong> ${e(data.firstName)} ${e(data.lastName)}<br>
<strong>Email:</strong> <a href="mailto:${e(data.email)}">${e(data.email)}</a><br>
<strong>Telefono:</strong> ${e(data.phone)}<br>
<strong>Via:</strong> ${e(data.address)}<br>
<strong>NPA:</strong> ${e(data.postalCode)}<br>
<strong>Domicilio:</strong> ${e(data.city)}
${data.notes ? `<br><strong>Note:</strong> ${e(data.notes)}` : ''}</p>

<h3>Articoli</h3>
<table style="border-collapse:collapse;width:100%;font-size:14px;">
  <thead>
    <tr>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Prodotto</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Edizione</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Variante</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Taglia</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Qta</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Prezzo</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Subtotale</th>
    </tr>
  </thead>
  <tbody>
    ${itemsHtml}
  </tbody>
</table>

<p style="margin-top:16px;"><strong>Totale:</strong> ${formatCurrency(data.total)}</p>
`,
  })

  // Confirmation email to the customer
  await transporter.sendMail({
    from,
    to: data.email,
    subject: `Conferma ordine CVLT Shop (${data.orderRef})`,
    text: `Gentile ${data.firstName} ${data.lastName},

Il tuo ordine è stato registrato con successo.

Riferimento ordine: ${data.orderRef}
Metodo di pagamento: ${methodLabel}
Stato pagamento: ${statusLabel}

Articoli ordinati:
${itemsText}

Totale: ${formatCurrency(data.total)}

Indirizzo di spedizione:
${data.firstName} ${data.lastName}
${data.address}
${data.postalCode} ${data.city}

${data.paymentMethod === 'invoice' ? `Pagamento con fattura:
IBAN: ${shopInvoiceIban}
Beneficiario: ${shopInvoiceBeneficiary}
Causale: Ordine shop ${data.orderRef}
` : ''}

Ti contatteremo per la spedizione.

Cordiali saluti,
Club Volo Libero Ticino
https://cvlt.ch
`,
    html: `
<p>Gentile ${e(data.firstName)} ${e(data.lastName)},</p>
<p>Il tuo ordine è stato registrato con successo.</p>
<p><strong>Riferimento ordine:</strong> ${e(data.orderRef)}<br>
<strong>Metodo di pagamento:</strong> ${e(methodLabel)}<br>
<strong>Stato pagamento:</strong> <span style="font-weight:700;">${e(statusLabel)}</span></p>

<h3>Articoli ordinati</h3>
<table style="border-collapse:collapse;width:100%;font-size:14px;">
  <thead>
    <tr>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Prodotto</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Edizione</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Variante</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Taglia</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Qta</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Prezzo</th>
      <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Subtotale</th>
    </tr>
  </thead>
  <tbody>
    ${itemsHtml}
  </tbody>
</table>

<p style="margin-top:16px;"><strong>Totale:</strong> ${formatCurrency(data.total)}</p>

<h3>Indirizzo di spedizione</h3>
    <p>${e(data.firstName)} ${e(data.lastName)}<br>${e(data.address)}<br>${e(data.postalCode)} ${e(data.city)}</p>

${paymentInstructionsHtml}

<p>Ti contatteremo per la spedizione.</p>
<p style="margin-top:20px;">Cordiali saluti,<br>Club Volo Libero Ticino<br><a href="https://cvlt.ch">cvlt.ch</a></p>
`,
    attachments: invoiceAttachments,
  })
}

function formatStockKey(stockKey: string) {
  const parts = stockKey.split('__')
  const productName = parts[0] ?? ''
  const variant = parts[1] ?? ''
  const size = parts[2] ?? ''
  return `${productName} (${variant}, taglia ${size})`
}

export type ShopWatchdogAlertData = {
  orderRef: string
  items: Array<{ key: string; qty: number }>
  createdAt?: string
}

/**
 * Alert sent to SHOP_EMAIL when a shop reservation expired without ever being
 * consumed (no confirmed order) — a paid order was probably lost.
 * The watchdog guarantees exactly one email per reservation (alertedAt field).
 */
export async function sendShopWatchdogAlert(data: ShopWatchdogAlertData) {
  const itemsText = data.items
    .map((item) => `- ${formatStockKey(item.key)} × ${item.qty}`)
    .join('\n')
  const itemsHtml = data.items
    .map(
      (item) =>
        `<li>${e(formatStockKey(item.key))} × ${item.qty}</li>`,
    )
    .join('')

  await transporter.sendMail({
    from,
    to: shopRecipient,
    subject: `[WATCHDOG] Possibile ordine shop perso (${data.orderRef})`,
    text: `Avviso automatico dal watchdog dello shop cvlt.ch

Una prenotazione di magazzino è scaduta senza che l'ordine fosse mai stato
confermato a livello server. Se il cliente aveva già pagato (TWINT), l'ordine
è probabilmente andato perso.

Riferimento ordine: ${data.orderRef}
Data creazione prenotazione: ${data.createdAt ?? 'sconosciuta'}

Articoli prenotati:
${itemsText}

Cosa fare:
1. Controlla sul backoffice RaiseNow se è arrivato un pagamento corrispondente
   (https://admin.raisenow.com).
2. Se il pagamento c'è, registra l'ordine manualmente in Payload
   (/admin → collezione "Ordini shop"), riutilizzando questo orderRef:
   ${data.orderRef}
3. Contatta il cliente con la conferma dell'ordine.
`,
    html: `
<h2>Possibile ordine shop perso</h2>
<p>Avviso automatico dal watchdog dello shop cvlt.ch: una prenotazione di magazzino è scaduta senza che l'ordine fosse mai stato confermato a livello server. <strong>Se il cliente aveva già pagato (TWINT), l'ordine è probabilmente andato perso.</strong></p>
<table style="border-collapse:collapse;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Riferimento ordine</td><td style="font-family:ui-monospace, monospace;">${e(data.orderRef)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Data creazione prenotazione</td><td>${e(data.createdAt ?? 'sconosciuta')}</td></tr>
</table>
<h3>Articoli prenotati</h3>
<ul>${itemsHtml}</ul>
<h3>Cosa fare</h3>
<ol>
  <li>Controlla sul <a href="https://admin.raisenow.com">backoffice RaiseNow</a> se è arrivato un pagamento corrispondente.</li>
  <li>Se il pagamento c'è, registra l'ordine manualmente in Payload (<em>/admin → Ordini shop</em>), riutilizzando questo orderRef: <code>${e(data.orderRef)}</code></li>
  <li>Contatta il cliente con la conferma dell'ordine.</li>
</ol>
`,
  })
}

/**
 * Digest of the failed watchdog self-checks (SMTP / DB / paylink).
 * Sent at most once per day (gated by the watchdog via payload.kv).
 */
export async function sendWatchdogSelfCheckAlert(failures: string[], ranAt: string) {
  const listText = failures.map((failure) => `- ${failure}`).join('\n')
  const listHtml = failures.map((failure) => `<li>${e(failure)}</li>`).join('')

  await transporter.sendMail({
    from,
    to: shopRecipient,
    subject: '[WATCHDOG] Controlli automatici falliti su cvlt.ch',
    text: `Avviso automatico dal watchdog dello shop cvlt.ch

Alcuni controlli automatici della pipeline sono falliti il ${ranAt}:

${listText}

Controlla i log del server per i dettagli (righe con prefisso [watchdog]).
`,
    html: `
<h2>Controlli automatici falliti</h2>
<p>Il watchdog dello shop cvlt.ch ha rilevato problemi il <strong>${e(ranAt)}</strong>:</p>
<ul>${listHtml}</ul>
<p>Controlla i log del server per i dettagli (righe con prefisso <code>[watchdog]</code>).</p>
`,
  })
}
