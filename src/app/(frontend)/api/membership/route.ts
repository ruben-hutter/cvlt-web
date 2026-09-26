import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendMembershipNotification } from '@/lib/mail'
import { rateLimit } from '@/lib/rate-limit'
import { extractClientIp, isBlockedEmailDomain, validateAntispamFields, isValidEmailFormat, isWithinLimit } from '@/lib/antispam'

const VALID_MEMBERSHIP_TYPES = new Set(['active', 'family', 'supporter'])

export async function POST(request: Request) {
  const ip = extractClientIp(request)
  const { allowed } = rateLimit({ key: `membership:${ip}`, limit: 3, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova più tardi.' }, { status: 429 })
  }
  try {
    const body = await request.json()

    const { firstName, lastName, address, city, email, phone, membershipType, notes, website, renderTs } = body

    const antispam = validateAntispamFields({ honeypot: website, renderTs })
    if (!antispam.ok) {
      if (antispam.reason === 'honeypot') {
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: 'Verifica anti-spam non superata. Ricarica la pagina e riprova.' }, { status: 400 })
    }

    if (!firstName || !lastName || !address || !city || !email || !phone || !membershipType) {
      return NextResponse.json({ error: 'Tutti i campi obbligatori devono essere compilati.' }, { status: 400 })
    }

    if (
      typeof firstName !== 'string' || typeof lastName !== 'string' ||
      typeof address !== 'string' || typeof city !== 'string' ||
      typeof email !== 'string' || typeof phone !== 'string' ||
      typeof membershipType !== 'string'
    ) {
      return NextResponse.json({ error: 'Dati non validi.' }, { status: 400 })
    }

    if (!VALID_MEMBERSHIP_TYPES.has(membershipType)) {
      return NextResponse.json({ error: 'Tipo di iscrizione non valido.' }, { status: 400 })
    }

    if (
      !isWithinLimit(firstName, 'name') || !isWithinLimit(lastName, 'name') ||
      !isWithinLimit(address, 'address') || !isWithinLimit(city, 'city') ||
      !isWithinLimit(phone, 'phone') || !isWithinLimit(notes, 'notes')
    ) {
      return NextResponse.json({ error: 'Testo troppo lungo.' }, { status: 400 })
    }

    if (!isValidEmailFormat(email) || isBlockedEmailDomain(email)) {
      return NextResponse.json({ error: 'Indirizzo email non valido.' }, { status: 400 })
    }

    const phoneDigits = phone.replaceAll(/\D/g, '')
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return NextResponse.json({ error: 'Numero di telefono non valido.' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    await payload.create({
      collection: 'membership-submissions',
      data: {
        firstName,
        lastName,
        address,
        city,
        email,
        phone,
        membershipType: membershipType as 'active' | 'family' | 'supporter',
        notes: notes || '',
      },
      overrideAccess: true,
    })

    console.info('[membership] submission received')

    try {
      await sendMembershipNotification({ firstName, lastName, address, city, email, phone, membershipType, notes })
      console.info('[membership] email sent')
    } catch (emailError) {
      console.error('[membership] email failed:', emailError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[membership] unhandled error:', error)
    return NextResponse.json({ error: 'Si è verificato un errore. Riprova più tardi.' }, { status: 500 })
  }
}
