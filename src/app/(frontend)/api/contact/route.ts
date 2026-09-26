import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendContactNotification } from '@/lib/mail'
import { rateLimit } from '@/lib/rate-limit'
import { extractClientIp, isBlockedEmailDomain, validateAntispamFields, isValidEmailFormat, isWithinLimit } from '@/lib/antispam'

export async function POST(request: Request) {
  const ip = extractClientIp(request)
  const { allowed } = rateLimit({ key: `contact:${ip}`, limit: 3, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova più tardi.' }, { status: 429 })
  }
  try {
    const body = await request.json()
    const { firstName, lastName, email, message, website, renderTs } = body

    const antispam = validateAntispamFields({ honeypot: website, renderTs })
    if (!antispam.ok) {
      if (antispam.reason === 'honeypot') {
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: 'Verifica anti-spam non superata. Ricarica la pagina e riprova.' }, { status: 400 })
    }

    if (!firstName || !lastName || !email || !message) {
      return NextResponse.json({ error: 'Tutti i campi obbligatori devono essere compilati.' }, { status: 400 })
    }

    if (typeof firstName !== 'string' || typeof lastName !== 'string' || typeof email !== 'string' || typeof message !== 'string') {
      return NextResponse.json({ error: 'Dati non validi.' }, { status: 400 })
    }

    if (!isWithinLimit(firstName, 'name') || !isWithinLimit(lastName, 'name') || !isWithinLimit(message, 'message')) {
      return NextResponse.json({ error: 'Testo troppo lungo.' }, { status: 400 })
    }

    if (!isValidEmailFormat(email) || isBlockedEmailDomain(email)) {
      return NextResponse.json({ error: 'Indirizzo email non valido.' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    await payload.create({
      collection: 'contact-submissions',
      data: {
        firstName,
        lastName,
        email,
        message,
      },
      overrideAccess: true,
    })

    console.info('[contact] submission received')

    try {
      await sendContactNotification({ firstName, lastName, email, message })
      console.info('[contact] email sent')
    } catch (emailError) {
      console.error('[contact] email failed:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[contact] unhandled error:', error)
    return NextResponse.json({ error: 'Si è verificato un errore. Riprova più tardi.' }, { status: 500 })
  }
}
