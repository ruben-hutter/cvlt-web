import { ContactForm } from './ContactForm'
import { ObfuscatedEmailLink } from '../components/ObfuscatedEmailLink'
import { CLUB_EMAIL_ENCODED } from '@/lib/obfuscate'

export const metadata = {
  title: 'Contatto',
  description:
    'Contatta il Club Volo Libero Ticino: modulo di contatto, indirizzo postale e email.',
  alternates: { canonical: '/contatto' },
}

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-cvlt-gray-900">Contatto</h1>

      <p className="mt-4 text-cvlt-gray-700">
        Per qualsiasi domanda o informazione, non esitare a contattarci
        tramite il modulo qui sotto oppure scrivici direttamente a{' '}
        <ObfuscatedEmailLink
          encoded={CLUB_EMAIL_ENCODED}
          className="font-medium text-cvlt-blue hover:text-cvlt-blue-dark hover:underline"
        />
        .
      </p>

      <div className="mx-auto mt-6 max-w-2xl">
        <div className="rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-50 px-5 py-4 text-sm text-cvlt-gray-600">
          <p className="font-semibold text-cvlt-gray-900">Recapito postale:</p>
          <p className="mt-1">
            Club Volo Libero Ticino<br />
            c/o Mirko Bonacina<br />
            Contrada al Lago 8<br />
            6987 Caslano (Svizzera)
          </p>
        </div>

        <div className="mt-8">
          <ContactForm />
        </div>
      </div>
    </main>
  )
}
