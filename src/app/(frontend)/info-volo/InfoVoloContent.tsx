'use client'

import { useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen'
import 'yet-another-react-lightbox/styles.css'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-cvlt-gray-200 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left text-lg font-semibold text-cvlt-gray-900 transition-colors hover:text-cvlt-blue"
      >
        {title}
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm leading-relaxed text-cvlt-gray-700">{children}</div>
      )}
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-cvlt-blue transition-colors hover:text-cvlt-blue-dark"
    >
      {children}
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-4.5-6H18m0 0v4.5m0-4.5L10.5 13.5" />
      </svg>
    </a>
  )
}

function LinkCard({
  title,
  description,
  href,
}: {
  title: string
  description: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-lg border border-cvlt-gray-200 p-4 transition-all hover:border-cvlt-blue/30 hover:shadow-md"
    >
      <div className="flex-1">
        <h3 className="font-semibold text-cvlt-gray-900 group-hover:text-cvlt-blue">{title}</h3>
        <p className="mt-0.5 text-sm text-cvlt-gray-500">{description}</p>
      </div>
      <svg
        className="mt-0.5 h-4 w-4 flex-shrink-0 text-cvlt-gray-400 transition-colors group-hover:text-cvlt-blue"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-4.5-6H18m0 0v4.5m0-4.5L10.5 13.5" />
      </svg>
    </a>
  )
}

const ztSlides = [
  { src: '/zt_02.jpg', alt: 'Scheda ZT.02 Capolago' },
  { src: '/zt_20.jpg', alt: "Scheda ZT.20 Pizzo d'Orgnana" },
  { src: '/zt_27.jpg', alt: 'Scheda ZT.27 Brogoldone' },
]

/** Direct image URL + official page (same pattern as cvlt.ch/webcams). */
type WebcamFeed = {
  title: string
  href: string
  imageSrc?: string
  iframeSrc?: string
}

const WEBCAMS_IN_MONTAGNA: WebcamFeed[] = [
  {
    title: 'Airolo - Sasso della Boggia',
    imageSrc: 'https://www.airolo.ch/air_webcam/valbianca5/current.jpg',
    href: 'https://www.airolo.ch/webcam-airolo.php',
  },
  {
    title: 'Airolo - Pesciüm',
    imageSrc: 'https://www.airolo.ch/air_webcam/valbianca2/current.jpg',
    href: 'https://www.airolo.ch/webcam-airolo.php',
  },
  {
    title: 'Bosco Gurin - Sonnenberg (2500m)',
    imageSrc: 'https://tuks.ch/webcam/bosco7000M.jpg',
    href: 'https://www.bosco-gurin.ch/',
  },
  {
    title: 'Cardada',
    imageSrc: 'https://www.cardada.ch/webcam/cardada.jpg',
    href: 'https://www.cardada.ch/it/webcam',
  },
  {
    title: 'Colmanicchio',
    imageSrc: 'https://www.colmanicchio.ch/webcam/colmanicchio/current.jpg',
    href: 'https://www.colmanicchio.ch/',
  },
  {
    title: 'Carì 2000 - Laghetto 2280m',
    imageSrc: 'https://cari.swiss/webcam/vetta.jpg',
    href: 'https://cari.swiss/cam/',
  },
  {
    title: 'Cimetta',
    imageSrc: 'https://webticino.ch/cardada/webcam/cimetta.jpg',
    href: 'https://www.cardada.ch/it/webcam',
  },
  {
    title: 'Monte Dagro (Malvaglia)',
    imageSrc: 'https://images-webcams.windy.com/43/1462813443/current/full/1462813443.jpg',
    href: 'https://www.windy.com/-Webcams-Malvaglia-Malvaglia:-Dagro/webcams/1462813443?46.424,8.997,16',
  },
  {
    title: 'Monte Generoso',
    iframeSrc:
      'https://webtv.feratel.com/webtv/?&pg=5EB12424-7C2D-428A-BEFF-0C9140CD772F&design=v3&cam=4228&c1=0',
    href: 'https://www.montegeneroso.ch/it/webcam',
  },
  {
    title: 'Monte Tamaro',
    iframeSrc: 'https://monte-tamaro.roundshot.com/#/',
    href: 'https://www.montetamaro.ch/it/webcam/',
  },
  {
    title: 'Nara',
    imageSrc: 'https://www.nara.ch/webcam/web/current.jpg',
    href: 'https://www.nara.ch/',
  },
  {
    title: 'Robiei',
    imageSrc: 'https://www.robiei.ch/webcam/webcamro.jpg',
    href: 'https://www.robiei.ch/',
  },
  {
    title: 'Tarnolgio',
    imageSrc: 'https://www.tarnolgio.ch/webcam00.jpg',
    href: 'https://www.tarnolgio.ch/',
  },
  {
    title: 'Vallemaggia - da Gordevio',
    imageSrc: 'https://www.makeitbetter.ch/webcam/webcam.jpg',
    href: 'https://www.makeitbetter.ch/',
  },
]

const WEBCAMS_SECONDARIE: WebcamFeed[] = [
  {
    title: 'Chironico',
    imageSrc: 'https://www.leventina.ch/webcam/video.jpg',
    href: 'https://www.leventina.ch/',
  },
  {
    title: 'Locarno verso nord (Cimetta, Cardada, Salmone)',
    imageSrc: 'https://makeitbetter.ch/webcam/LocarnoNord.jpg',
    href: 'https://www.makeitbetter.ch/',
  },
  {
    title: 'Locarno verso sud (Tamaro, Gambarogno, Lema)',
    imageSrc: 'https://makeitbetter.ch/webcam/LocarnoSud.jpg',
    href: 'https://www.makeitbetter.ch/',
  },
  {
    title: 'Magadino (aeroporto Locarno)',
    imageSrc: 'https://swisshelicopter.ch/webcam/gordola/gordola.jpg',
    href: 'https://swisshelicopter.ch/',
  },
]

function WebcamFigure({ title, imageSrc, href }: WebcamFeed) {
  const [imageFailed, setImageFailed] = useState(false)
  if (!imageSrc) return null

  if (imageFailed) {
    return <WebcamPageOnlyTile title={title} href={href} />
  }

  return (
    <figure className="overflow-hidden rounded-lg border border-cvlt-gray-200 bg-white shadow-sm">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-cvlt-blue focus-visible:ring-offset-2"
        aria-label={`Apri la pagina della webcam: ${title}`}
      >
        <img
          src={imageSrc}
          alt=""
          className="aspect-[16/10] w-full bg-cvlt-gray-100 object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      </a>
      <figcaption className="border-t border-cvlt-gray-100 px-3 py-2 text-sm font-medium text-cvlt-gray-900">
        {title}
      </figcaption>
    </figure>
  )
}

function WebcamIframeFigure({ title, iframeSrc, href }: WebcamFeed) {
  const [iframeFailed, setIframeFailed] = useState(false)
  if (!iframeSrc) return null
  if (iframeFailed) {
    return <WebcamPageOnlyTile title={title} href={href} />
  }

  return (
    <figure className="overflow-hidden rounded-lg border border-cvlt-gray-200 bg-white shadow-sm">
      <div className="aspect-[16/10] w-full bg-cvlt-gray-100">
        <iframe
          src={iframeSrc}
          title={title}
          loading="lazy"
          className="h-full w-full border-0"
          referrerPolicy="strict-origin-when-cross-origin"
          onError={() => setIframeFailed(true)}
        />
      </div>
      <figcaption className="border-t border-cvlt-gray-100 px-3 py-2 text-sm font-medium text-cvlt-gray-900">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cvlt-gray-900 transition-colors hover:text-cvlt-blue"
        >
          {title}
        </a>
      </figcaption>
    </figure>
  )
}

function WebcamPageOnlyTile({ title, href }: { title: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col overflow-hidden rounded-lg border border-dashed border-cvlt-gray-300 bg-cvlt-gray-50/80 transition-colors hover:border-cvlt-blue/40 hover:bg-cvlt-blue-light/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cvlt-blue"
      aria-label={`Apri la pagina della webcam: ${title}`}
    >
      <div className="flex aspect-[16/10] items-center justify-center px-4 text-center text-sm leading-snug text-cvlt-gray-600">
        Anteprima non disponibile &ndash; clicca per aprire il sito ufficiale
      </div>
      <div className="border-t border-cvlt-gray-200 bg-white px-3 py-2 text-sm font-medium text-cvlt-gray-900">
        {title}
      </div>
    </a>
  )
}

export function InfoVoloContent() {
  const [ztIndex, setZtIndex] = useState(-1)

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-bold text-cvlt-gray-900">Informazioni di volo</h1>
      <p className="mt-4 text-cvlt-gray-700">
        Una panoramica sullo spazio aereo ticinese, le fonti meteo e i link utili per volare in sicurezza.
        Le informazioni ufficiali e aggiornate si trovano sempre sul sito della{' '}
        <ExternalLink href="https://www.shv-fsvl.ch">FSVL</ExternalLink>.
      </p>

      {/* Avvisi decolli */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-cvlt-gray-900">Avvisi decolli</h2>
        <div className="mt-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-shrink-0 md:order-last md:self-start">
              <a
                href="https://s.geo.admin.ch/abmzz7tvqlnp"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="/gana_map.png"
                  alt="Mappa decollo della Gana"
                  className="w-full rounded border border-cvlt-gray-200 transition-opacity hover:opacity-80 md:w-56"
                />
              </a>
              <p className="mt-1 text-center text-xs text-cvlt-gray-500">
                <ExternalLink href="https://s.geo.admin.ch/abmzz7tvqlnp">
                  map.geo.admin.ch
                </ExternalLink>
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-cvlt-gray-900">Decollo della Gana</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-cvlt-gray-700">
                <li>La strada per i <strong>Monti della Gana</strong> non è più percorribile in auto senza autorizzazione dal bivio per i Monti Motti.</li>
                <li><strong>Non è permesso decollare</strong> dal prato sotto la curva della strada.</li>
                <li>È possibile decollare dalla bandiera (<strong>Monti di Colla</strong>), ma bisogna salire a piedi.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Spazio aereo */}
      <div id="spazio-aereo" className="mt-10">
        <h2 className="text-xl font-bold text-cvlt-gray-900">Spazio aereo</h2>
        <p className="mt-2 text-sm text-cvlt-gray-600">
          Il Ticino presenta diverse zone regolamentate. Prima di ogni volo consulta il{' '}
          <strong>DABS</strong> (Daily Airspace Bulletin): riporta le restrizioni giornaliere
          dello spazio aereo, incluse attivazioni TMA, zone di tiro, manifestazioni aeree e
          voli militari speciali. Le ore sono in <strong>UTC</strong> (aggiungere 1h in inverno,
          2h in estate).
        </p>
        <p className="mt-3">
          <ExternalLink href="https://www.skybriefing.com/it/dabs">
            Consulta il DABS su skybriefing.com
          </ExternalLink>
        </p>

        {/* Mappa ufficiale dello spazio aereo (SHV/FSVL) */}
        <div className="mt-6">
          {/*
            L'iframe è ritagliato per nascondere la barra di intestazione del sito
            SHV/FSVL (logo/login/menu): l'iframe è più alto del contenitore e spostato
            in su dell'esatta altezza dell'header loro (+1px per nascondere anche il
            bordo superiore della loro toolbar, altrimenti doppia linea col bordo del
            contenitore). Le media query dell'iframe rispondono alla LARGHEZZA
            DELL'IFRAME (max ~992px, contenitore max-w-5xl), non a quella della
            finestra: header 106px se iframe <550px (⇔ viewport <582px, contando
            px-4 di padding), altrimenti 60px. Il regime ≥1150px (header 100px) non
            si verifica mai dentro il contenitore. Altezze da arsp.css di
            airspace.shv-fsvl.ch — aggiornarle se cambia il loro layout.
          */}
          <div className="relative h-[60vh] overflow-hidden rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-100 md:h-[70vh]">
            <iframe
              src="https://airspace.shv-fsvl.ch/map"
              title="Mappa dello spazio aereo SHV/FSVL"
              loading="lazy"
              className="absolute left-0 top-[-107px] h-[calc(60vh+107px)] w-full border-0 min-[582px]:top-[-61px] min-[582px]:h-[calc(60vh+61px)] md:h-[calc(70vh+61px)]"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
          <p className="mt-2 text-sm text-cvlt-gray-500">
            Mappa dello spazio aereo &mdash; fonte ufficiale SHV/FSVL.{' '}
            <ExternalLink href="https://airspace.shv-fsvl.ch/map">
              Apri a schermo intero
            </ExternalLink>
          </p>
          <p className="mt-1 text-xs text-cvlt-gray-500">
            La mappa mostra la geometria generale dello spazio aereo, non le attivazioni
            correnti: verifica sempre il DABS attuale su skybriefing.com.
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-cvlt-gray-200">
          <Section title="Zone di controllo (CTR)" defaultOpen>
            <p>
              Attorno agli aeroporti di <strong>Locarno-Magadino</strong> e{' '}
              <strong>Lugano-Agno</strong> esistono zone di controllo (CTR) in cui il volo
              libero richiede l&apos;autorizzazione della torre di controllo.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1">
              <li>Contattare la torre via radio prima di entrare nella CTR</li>
              <li>Rispettare le frequenze e le procedure pubblicate</li>
              <li>Verificare lo stato di attivazione sul DABS</li>
            </ul>
          </Section>

          <Section title="Regioni terminali (TMA)">
            <p>
              Le TMA si estendono sopra le CTR e limitano l&apos;altitudine massima di volo.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1">
              <li>
                <strong>TMA Locarno-Magadino</strong> &mdash; temporanea, attivata solo durante gli
                orari operativi dell&apos;aeroporto. Quando attiva limita il volo sopra una
                certa quota.
              </li>
              <li>
                <strong>TMA Milano</strong> &mdash; permanente, può limitare la quota nel
                Sottoceneri (zona Lugano/Mendrisio). Verificare le altitudini sul DABS.
              </li>
            </ul>
            <p className="mt-3">
              Si può volare sotto la TMA senza autorizzazione, ma mai al suo interno senza
              permesso.
            </p>

            <div className="mt-5 rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-50 p-4">
              <a
                href="https://www.facebook.com/TMA-Locarno-1037676889614177/"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src="/tmalocarno.png"
                  alt="TMA Locarno"
                  className="mx-auto w-full max-w-xs rounded"
                />
              </a>
              <p className="mt-3 text-sm">
                Su{' '}
                <ExternalLink href="https://www.facebook.com/TMA-Locarno-1037676889614177/">
                  Facebook
                </ExternalLink>{' '}
                è possibile consultare la pianificazione settimanale della TMA di Locarno.
              </p>
              <p className="mt-2 text-xs text-cvlt-gray-500">
                La pagina FB ha una valenza puramente informativa e non vincolante.
                Consultare sempre l&apos;ATIS ({' '}
                <a href="tel:+41918161744" className="font-medium text-cvlt-blue hover:underline">
                  +41 91 816 17 44
                </a>
                ) prima di decollare.
              </p>
            </div>
          </Section>

          <Section title="Aerovie (AWY)">
            <p>
              Diverse aerovie attraversano lo spazio aereo ticinese. I corridoi aerei hanno
              limiti inferiori che variano:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1">
              <li>
                <strong>Durante orari militari (HX)</strong> &mdash; limite inferiore FL 130
                (~3950 m)
              </li>
              <li>
                <strong>Al di fuori degli orari militari</strong> &mdash; limite inferiore FL 150
                (~4550 m)
              </li>
            </ul>
            <p className="mt-3">
              Il transito attraverso un&apos;aerovia sopra il limite inferiore richiede
              un&apos;autorizzazione.
            </p>
          </Section>

          <Section title="Zone di tranquillità">
            <p>
              Zone di protezione della fauna con <strong>raccomandazione</strong> di sorvolo
              ad una distanza minima dal suolo di 200 m. Attenzione alle restrizioni stagionali:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1">
              <li>
                <strong>ZT.02 Capolago</strong> &mdash; 15 febbraio &ndash; 15 agosto
              </li>
              <li>
                <strong>ZT.20 Pizzo d&apos;Orgnana</strong> &mdash; 1 gennaio &ndash; 31 marzo
              </li>
              <li>
                <strong>ZT.27 Brogoldone</strong> &mdash; 1 gennaio &ndash; 31 marzo
              </li>
            </ul>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {ztSlides.map((slide, i) => (
                <img
                  key={slide.src}
                  src={slide.src}
                  alt={slide.alt}
                  className="w-full cursor-pointer rounded-lg border border-cvlt-gray-200 transition-opacity hover:opacity-80"
                  onClick={() => setZtIndex(i)}
                />
              ))}
            </div>
            <ul className="mt-4 list-inside list-disc space-y-1">
              <li>
                <ExternalLink href="https://www.zone-di-tranquillita.ch/">
                  zone-di-tranquillita.ch
                </ExternalLink>
              </li>
              <li>
                <ExternalLink href="https://www4.ti.ch/dt/da/ucp/temi/caccia/caccia/pubblicazione-decreto-delle-zone-di-tranquillita-per-la-fauna-selvatica/">
                  Decreto cantonale
                </ExternalLink>
              </li>
            </ul>
          </Section>
        </div>
      </div>

      {/* Vento CVLT */}
      <div id="meteo-vento" className="mt-10">
        <h2 className="text-xl font-bold text-cvlt-gray-900">Meteo &amp; Vento</h2>
        <a
          href="/vento"
          className="group mt-4 flex items-center gap-4 rounded-lg border-2 border-cvlt-blue/20 bg-cvlt-blue-light p-5 transition-all hover:border-cvlt-blue/40 hover:shadow-md"
        >
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-cvlt-blue text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-cvlt-gray-900 group-hover:text-cvlt-blue">
              Vento CVLT
            </h3>
            <p className="text-sm text-cvlt-gray-600">
              Stazioni meteo, radiosondaggi, pressione e dati BAFU/MCH in tempo reale per il Sud delle Alpi.
            </p>
          </div>
          <svg
            className="h-5 w-5 flex-shrink-0 text-cvlt-gray-400 transition-colors group-hover:text-cvlt-blue"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </a>
      </div>

      {/* Altri link meteo */}
      <div id="link-meteo" className="mt-10">
        <h2 className="text-xl font-bold text-cvlt-gray-900">Altri link meteo</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <LinkCard
            title="MeteoSvizzera"
            description="Previsioni federali ufficiali"
            href="https://www.meteosvizzera.admin.ch"
          />
          <LinkCard
            title="SHV / FSVL Meteo (iOS)"
            description="App meteo ufficiale della federazione – previsioni, favonio e stazioni"
            href="https://apps.apple.com/ch/app/shv-fsvl/id6761252391"
          />
          <LinkCard
            title="SHV / FSVL Meteo (Android)"
            description="App meteo ufficiale della federazione – previsioni, favonio e stazioni"
            href="https://play.google.com/store/apps/details?id=ch.shv_fsvl"
          />
          <LinkCard
            title="Soaring Meteo"
            description="Previsioni per il volo termodinamico"
            href="https://soaringmeteo.org/v2/model=wrf&zone=central-alps"
          />
          <LinkCard
            title="Meteo-Parapente"
            description="Previsioni specifiche per il parapendio"
            href="https://meteo-parapente.com"
          />
          <LinkCard
            title="XCtherm"
            description="Mappa termica per il volo libero"
            href="https://xctherm.com/map"
          />
          <LinkCard
            title="burnair Map"
            description="Mappa interattiva siti e condizioni"
            href="https://map.burnair.cloud/"
          />
          <LinkCard
            title="Winds.mobi"
            description="Mappa vento in tempo reale"
            href="https://winds.mobi/stations/map"
          />
          <LinkCard
            title="Windspion"
            description="Stazioni vento alpine in tempo reale"
            href="https://www.windspion.app"
          />
        </div>
      </div>

      <div id="webcam" className="mt-10">
        <h2 className="text-xl font-bold text-cvlt-gray-900">Webcams</h2>

        <h3 className="mt-8 text-lg font-semibold text-cvlt-gray-900">In montagna</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WEBCAMS_IN_MONTAGNA.map((w) =>
            w.iframeSrc ? (
              <WebcamIframeFigure key={`${w.title}-iframe`} {...w} />
            ) : (
              <WebcamFigure key={`${w.title}-${w.imageSrc}`} {...w} />
            ),
          )}
        </div>

        <h3 className="mt-10 text-lg font-semibold text-cvlt-gray-900">Altre inquadrature</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WEBCAMS_SECONDARIE.map((w) =>
            w.iframeSrc ? (
              <WebcamIframeFigure key={`${w.title}-iframe`} {...w} />
            ) : (
              <WebcamFigure key={`${w.title}-${w.imageSrc}`} {...w} />
            ),
          )}
        </div>
      </div>

      {/* Link utili */}
      <div id="link-utili" className="mt-10">
        <h2 className="text-xl font-bold text-cvlt-gray-900">Link utili</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <LinkCard
            title="FSVL / SHV"
            description="Federazione svizzera di volo libero"
            href="https://www.shv-fsvl.ch"
          />
          <LinkCard
            title="FAI / CIVL"
            description="Federazione aeronautica internazionale"
            href="https://www.fai.org/commission/civl"
          />
          <LinkCard
            title="UFAC / BAZL"
            description="Ufficio federale dell'aviazione civile"
            href="https://www.bazl.admin.ch"
          />
          <LinkCard
            title="Skybriefing"
            description="NOTAM, DABS e carte aeronautiche"
            href="https://www.skybriefing.com"
          />
        </div>
      </div>
      <Lightbox
        open={ztIndex >= 0}
        close={() => setZtIndex(-1)}
        index={ztIndex}
        slides={ztSlides}
        plugins={[Fullscreen]}
      />
    </main>
  )
}
