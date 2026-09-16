'use client'

import { useState } from 'react'
import { fuzzySearch } from '@/lib/search'
import { uiFieldClass } from '@/lib/ui'
import { ObfuscatedEmailLink } from '../components/ObfuscatedEmailLink'

type Pilot = {
  name: string
  phone: string
  /** base64-encoded address, see src/lib/obfuscate.ts */
  emailEnc?: string
  website?: string
}

const pilots: Pilot[] = [
  { name: 'Ambrosetti Marzio', phone: '+41796440138', emailEnc: 'bWFyemlvLmFtYnJvc2V0dGlAZ21haWwuY29t' },
  { name: 'Barchi Lorenz', phone: '+41792678374', emailEnc: 'aW5mb0BzdGFtYmVray1haXIuY2g=', website: 'stambekk-air.ch' },
  { name: 'Bisi Fabrizio', phone: '+41793498677', emailEnc: 'YmlzaWY2MEBnbWFpbC5jb20=' },
  { name: 'Bomio Alessio', phone: '+41795050433', emailEnc: 'YXMuYm9taW9AYmx1ZXdpbi5jaA==' },
  { name: 'Cattaneo Claudio', phone: '+41792390666', emailEnc: 'aW5mb0BwYXJhcGVuZGlvLmNo', website: 'parapendio.ch' },
  { name: 'Cavargna Eros', phone: '+41793671502', emailEnc: 'ZXJvc2NhdmFyZ25hQGdtYWlsLmNvbQ==' },
  { name: 'Cioldi Elio', phone: '+41796255918', emailEnc: 'ZWxpb2Npb2xkaUBnbWFpbC5jb20=', website: 'revolutionair.ch' },
  { name: 'Coda Andrea', phone: '+41765611311', emailEnc: 'YW5kcmVhLmNvZGFAYmx1ZXdpbi5jaA==' },
  { name: 'Coda Luca', phone: '+41793703445', emailEnc: 'bHVjYS5jb2RhQGJsdWV3aW4uY2g=' },
  { name: 'Croci Manuel', phone: '+41794150066' },
  { name: 'Domine Paolo', phone: '+41764411248', emailEnc: 'cGFvbG8uZG9taW5lQGJsdWV3aW4uY2g=' },
  { name: 'Ferrari Franco', phone: '+41793629955', emailEnc: 'ZnJhbmNvLmZAYmx1ZXdpbi5jaA==' },
  { name: 'Fontana Christian', phone: '+41793314347', emailEnc: 'Zm9udGFjcmlndUBnbWFpbC5jb20=' },
  { name: 'Genazzini Stefano', phone: '+41797967618', emailEnc: 'aW5mb0BmbHl0aWNpbm8uY2g=', website: 'flyticino.ch' },
  { name: 'Gerber Roman', phone: '+41799484264', emailEnc: 'Z2VyYmVycm9tYW5AaG90bWFpbC5jb20=' },
  { name: 'Grau Beat', phone: '+41794025852', emailEnc: 'aW5mby5ncmF1QGJsdWV3aW4uY2g=' },
  { name: 'Kessel Franco', phone: '+41794444414', emailEnc: 'aW5mb0BwaW5rLWJhcm9uLmNo', website: 'pink-baron.ch' },
  { name: 'Kneschaurek Lorenzo', phone: '+41795428442', emailEnc: 'bG9yZW56by5rbmVzY2hhdXJla0BibHVld2luLmNo' },
  { name: 'Lepori Biagio', phone: '+41794781729', emailEnc: 'YmlhZ2lvLmxlcG9yaUBnbWFpbC5jb20=' },
  { name: 'Loehrer Romano', phone: '+41763783537', emailEnc: 'cm9tYW5vQGxhbWFudGluby5jaA==', website: 'lamantino.ch' },
  { name: 'Milani Raffaello', phone: '+41796555931', emailEnc: 'cmFmZjIyQGdteC5uZXQ=' },
  { name: 'Monzeglio Matteo', phone: '+41794714102', emailEnc: 'bWF0dGVvLm1vbnplZ2xpb0BnbWFpbC5jb20=' },
  { name: 'M\u00fcller Marc', phone: '+41786866703', emailEnc: 'bWFyYy5tdWxsZXI5NUBob3RtYWlsLmNvbQ==' },
  { name: 'Pellegrini Matthews', phone: '+41795192880', emailEnc: 'd2VodHRhbUBob3RtYWlsLml0' },
  { name: 'Pfyl Ren\u00e9', phone: '+41794238566', emailEnc: 'aW5mb0BjYW1waW5nLXBhcmFkaXNvLmNo', website: 'tandem-paragliding-ticino.ch' },
  { name: 'Regusci Mauro', phone: '+41794242384', emailEnc: 'Zmx5LTQtZnVuQGJsdWV3aW4uY2g=' },
  { name: 'Rigozzi Michel', phone: '+41796829381', emailEnc: 'bXJpZ296emlAZ21haWwuY29t' },
  { name: 'Soland Michael', phone: '+41788794412', emailEnc: 'bXNvbGFuZEBnb29nbGVtYWlsLmNvbQ==' },
  { name: 'Soldati Federico', phone: '+41797967618', emailEnc: 'aW5mb0BmbHl0aWNpbm8uY2g=', website: 'flyticino.ch' },
  { name: 'Thio Christian', phone: '+41797615106', emailEnc: 'aW5mb0Btb3VudGFpbmdsaWRlcnMuY29t', website: 'mountaingliders.com' },
  { name: 'Vosti Claudio', phone: '+41796217731', emailEnc: 'dm9zdGkuY0BibHVld2luLmNo' },
  { name: 'Vosti Mattia', phone: '+41798705666', emailEnc: 'bWF0dGlhLnZvc3RpQGdtYWlsLmNvbQ==', website: 'mattiavosti.ch' },
  { name: 'Voumard Andrea', phone: '+41795810347', emailEnc: 'aGVuZHJpdUB0aWNpbm8uY29t' },
  { name: 'W\u00fcest Renato', phone: '+41794441455', emailEnc: 'cGFyYW1hbmlhQHRpY2luby5jb20=', website: 'paramania.ch' },
  { name: 'Wulz Gaby', phone: '+41792539953', emailEnc: 'Z2FieXd1bHpAZ21haWwuY29t', website: 'eagletandemfly.com' },
  { name: 'Zoppi Marco', phone: '+41793372959', emailEnc: 'YW1pbGFieWxpbG9AYmx1ZXdpbi5jaA==' },
]

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
    </svg>
  )
}

function WhatsAppIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  )
}

function WebIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  )
}

function formatPhone(phone: string) {
  // +41791234567 → +41 79 123 45 67
  const m = phone.match(/^\+41(\d{2})(\d{3})(\d{2})(\d{2})$/)
  if (m) return `+41\u00A0${m[1]}\u00A0${m[2]}\u00A0${m[3]}\u00A0${m[4]}`
  return phone
}

export function BipostoContent() {
  const [search, setSearch] = useState('')

  const filtered = search
    ? fuzzySearch(pilots, search, ['name'])
    : pilots

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-cvlt-gray-900">Voli in Biposto</h1>
      <p className="mt-4 text-cvlt-gray-700">
        I piloti tandem del CVLT offrono voli biposto in parapendio nel Ticino e Moesano.
        Contattali direttamente per prenotare il tuo volo.
      </p>

      <div className="mt-6 rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-50 px-5 py-4 text-sm text-cvlt-gray-600">
        <p>
          Tutti i piloti elencati sono in possesso della licenza ufficiale di volo libero,
          pilota biposto A, cat. parapendio rilasciata dalla Federazione Svizzera di Volo
          Libero (<a href="https://www.shv-fsvl.ch" target="_blank" rel="noopener noreferrer" className="font-medium text-cvlt-blue hover:underline">FSVL</a>)
          su incarico dell&apos;Ufficio Federale dell&apos;Aviazione
          Civile (<a href="https://www.bazl.admin.ch" target="_blank" rel="noopener noreferrer" className="font-medium text-cvlt-blue hover:underline">UFAC</a>).
        </p>
        <p className="mt-3 font-semibold text-cvlt-gray-700">
          Il Club Volo Libero Ticino non organizza i voli passeggeri.
          Vogliate contattare direttamente i piloti.
        </p>
      </div>

      <div className="mx-auto max-w-3xl">
      {/* Search */}
      <div className="relative mt-6">
        <svg
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cvlt-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Cerca pilota..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${uiFieldClass} border-cvlt-gray-200 bg-white py-2 pl-10 pr-4 placeholder:text-cvlt-gray-400`}
        />
      </div>

      {/* Pilot count */}
      <p className="mt-3 text-xs text-cvlt-gray-400">
        {filtered.length} {filtered.length === 1 ? 'pilota' : 'piloti'}
      </p>

      {/* Scrollable table */}
      <div className="mt-2 max-h-[60vh] overflow-y-auto rounded-lg border border-cvlt-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-cvlt-gray-50">
            <tr className="border-b border-cvlt-gray-200 text-xs font-semibold uppercase tracking-wide text-cvlt-gray-500">
              <th className="px-4 py-2.5">Pilota</th>
              <th className="px-4 py-2.5">Contatto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((pilot) => (
              <tr key={pilot.name} className="border-b border-cvlt-gray-100 last:border-b-0">
                <td className="px-4 py-3">
                  <span className="font-medium text-cvlt-gray-900">{pilot.name}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <a
                      href={`tel:${pilot.phone}`}
                      title="Telefono"
                      className="text-cvlt-gray-400 transition-colors hover:text-cvlt-blue"
                    >
                      <PhoneIcon />
                    </a>
                    <a
                      href={`https://wa.me/${pilot.phone.replace('+', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                      className="text-cvlt-gray-400 transition-colors hover:text-green-600"
                    >
                      <WhatsAppIcon />
                    </a>
                    {pilot.emailEnc && (
                      <ObfuscatedEmailLink
                        encoded={pilot.emailEnc}
                        title="Email"
                        ariaLabel={`Email ${pilot.name}`}
                        className="text-cvlt-gray-400 transition-colors hover:text-cvlt-blue"
                      >
                        <EmailIcon />
                      </ObfuscatedEmailLink>
                    )}
                    {pilot.website && (
                      <a
                        href={`https://${pilot.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={pilot.website}
                        className="text-cvlt-gray-400 transition-colors hover:text-cvlt-blue"
                      >
                        <WebIcon />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-cvlt-gray-400">
                  Nessun pilota trovato.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </main>
  )
}
