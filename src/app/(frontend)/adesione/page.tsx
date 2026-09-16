import { MembershipForm } from './MembershipForm'
import { ObfuscatedEmailLink } from '../components/ObfuscatedEmailLink'
import { CLUB_EMAIL_ENCODED } from '@/lib/obfuscate'

export const metadata = {
  title: 'Aderire al club',
  description:
    'Diventa socio del Club Volo Libero Ticino: moduli di adesione, quote annuali e informazioni.',
  alternates: { canonical: '/adesione' },
}

export default function MembershipPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-cvlt-gray-900">Aderire al club</h1>

      <div className="mt-6 space-y-4 text-cvlt-gray-700">
        <p>
          Sei interessato a far parte del nostro club? Compila il modulo sottostante per
          inviare la tua richiesta di adesione. La richiesta sarà visionata dal comitato
          e verrai ricontattato al più presto.
        </p>
        <p>
          Per ulteriori informazioni leggi lo{' '}
          <a href="/statuto" className="font-medium text-cvlt-blue hover:text-cvlt-blue-dark hover:underline">statuto del club</a>{' '}
          o scrivici a{' '}
          <ObfuscatedEmailLink
            encoded={CLUB_EMAIL_ENCODED}
            className="font-medium text-cvlt-blue hover:text-cvlt-blue-dark hover:underline"
          />
          .
        </p>
      </div>

      <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-cvlt-blue/20 bg-cvlt-blue-light p-4 text-sm text-cvlt-gray-700">
        <p className="font-semibold text-cvlt-gray-900">Quote annuali:</p>
        <ul className="mt-2 space-y-1">
          <li className="flex justify-between sm:justify-start sm:gap-6">
            <span>Soci attivi</span>
            <span className="font-semibold text-cvlt-gray-900">CHF 40.&ndash;</span>
          </li>
          <li className="flex justify-between sm:justify-start sm:gap-6">
            <span>Famiglie</span>
            <span className="font-semibold text-cvlt-gray-900">CHF 45.&ndash;</span>
          </li>
          <li className="flex justify-between sm:justify-start sm:gap-6">
            <span>Sostenitori</span>
            <span className="font-semibold text-cvlt-gray-900">Contributo libero</span>
          </li>
        </ul>
      </div>

      <div className="mx-auto mt-8 max-w-2xl">
        <MembershipForm />
      </div>
    </main>
  )
}
