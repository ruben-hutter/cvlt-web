import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['sharp'],
  async redirects() {
    return [
      // --- Old WordPress pages → new Next.js pages (301: permanent move) ---
      { source: '/il-club', destination: '/comitato', permanent: true },
      { source: '/aderire-al-club', destination: '/adesione', permanent: true },
      { source: '/pagamento-quota-sociale', destination: '/quota-sociale', permanent: true },
      { source: '/twint', destination: '/quota-sociale', permanent: true },

      // Volare in Ticino → info-volo
      { source: '/volare-in-ticino', destination: '/info-volo', permanent: true },
      { source: '/siti-di-volo', destination: '/info-volo', permanent: true },
      { source: '/le-zone-di-controllo-ctr', destination: '/info-volo', permanent: true },
      { source: '/le-zone-di-controllo-ctr-2', destination: '/info-volo', permanent: true },
      { source: '/le-awy', destination: '/info-volo', permanent: true },
      { source: '/volare-in-ticino-2', destination: '/info-volo', permanent: true },
      { source: '/il-dabs', destination: '/info-volo', permanent: true },
      { source: '/locarno-ifr-area', destination: '/info-volo', permanent: true },
      { source: '/zone-di-tranquillita', destination: '/info-volo', permanent: true },
      { source: '/links', destination: '/info-volo', permanent: true },
      { source: '/link-meteo', destination: '/info-volo', permanent: true },

      // Calendar / Activities
      { source: '/attivita', destination: '/calendario', permanent: true },
      { source: '/calendario-eventi', destination: '/calendario', permanent: true },

      // Competitions
      { source: '/ccc-regolamento', destination: '/gare', permanent: true },
      { source: '/ccc-hall-of-fame', destination: '/gare', permanent: true },

      // Other pages
      { source: '/voli-biposto', destination: '/biposto', permanent: true },
      { source: '/vento-included', destination: '/vento', permanent: true },
      { source: '/webcams', destination: '/vento', permanent: true },
      { source: '/chi-e-in-volo', destination: '/', permanent: true },
      { source: '/video', destination: '/galleria', permanent: true },
      { source: '/carica-foto', destination: '/admin', permanent: true },
      { source: '/cookie-policy', destination: '/', permanent: true },
      { source: '/guests', destination: '/', permanent: true },

      // Gallery pages (per-year and range pages → single gallery)
      { source: '/gallery-:year(\\d{4})', destination: '/galleria', permanent: true },
      { source: '/gallery-oggi-2017', destination: '/galleria', permanent: true },
      { source: '/gallery-2016-2001', destination: '/galleria', permanent: true },
      { source: '/gallery-2016-2013', destination: '/galleria', permanent: true },
      { source: '/gallery-2012-2009', destination: '/galleria', permanent: true },
      { source: '/gallery-2008-2005', destination: '/galleria', permanent: true },
      { source: '/gallery-2004-2001', destination: '/galleria', permanent: true },

      // --- Legacy WP event editions → the recurring event's current page (301) ---
      // assemblea-generale-2025 (6)
      { source: '/events/assemblea-2018', destination: '/calendario/assemblea-generale-2025', permanent: true },
      { source: '/events/assemblea-generale-2017', destination: '/calendario/assemblea-generale-2025', permanent: true },
      { source: '/events/assemblea-generale-2019-2', destination: '/calendario/assemblea-generale-2025', permanent: true },
      { source: '/events/assemblea-generale-2021', destination: '/calendario/assemblea-generale-2025', permanent: true },
      { source: '/events/assemblea-generale-2022', destination: '/calendario/assemblea-generale-2025', permanent: true },
      { source: '/events/assemblea-generale-2024', destination: '/calendario/assemblea-generale-2025', permanent: true },
      // coppa-monte-generoso (1)
      { source: '/events/4-coppa-monte-generoso', destination: '/calendario/coppa-monte-generoso', permanent: true },
      // lema-air (3)
      { source: '/events/lema-air', destination: '/calendario/lema-air', permanent: true },
      { source: '/events/lema-air-2', destination: '/calendario/lema-air', permanent: true },
      { source: '/events/lema-air-3', destination: '/calendario/lema-air', permanent: true },
      // misoxperience (2)
      { source: '/events/misoxperience', destination: '/calendario/misoxperience', permanent: true },
      { source: '/events/misoxperience-2', destination: '/calendario/misoxperience', permanent: true },
      // porte-aperte-gvvt-magadino (4)
      { source: '/events/porte-aperte-gvvt', destination: '/calendario/porte-aperte-gvvt-magadino', permanent: true },
      { source: '/events/porte-aperte-gvvt-2', destination: '/calendario/porte-aperte-gvvt-magadino', permanent: true },
      { source: '/events/porte-aperte-gvvt-3', destination: '/calendario/porte-aperte-gvvt-magadino', permanent: true },
      { source: '/events/porte-aperte-gvvt-4', destination: '/calendario/porte-aperte-gvvt-magadino', permanent: true },
      // run-in-fly-gia-belli-in-fly-2 (1)
      { source: '/events/belli-in-fly', destination: '/calendario/run-in-fly-gia-belli-in-fly-2', permanent: true },
      // sun-valley-festival (5)
      { source: '/events/sun-valley-festival', destination: '/calendario/sun-valley-festival', permanent: true },
      { source: '/events/sun-valley-festival-2', destination: '/calendario/sun-valley-festival', permanent: true },
      { source: '/events/sun-valley-festival-2022', destination: '/calendario/sun-valley-festival', permanent: true },
      { source: '/events/sun-valley-festival-4', destination: '/calendario/sun-valley-festival', permanent: true },
      { source: '/events/sun-valley-festival-5', destination: '/calendario/sun-valley-festival', permanent: true },
      // ticino-x-race (6)
      { source: '/events/ticino-x-race', destination: '/calendario/ticino-x-race', permanent: true },
      { source: '/events/ticino-x-race-2', destination: '/calendario/ticino-x-race', permanent: true },
      { source: '/events/ticino-x-race-2023', destination: '/calendario/ticino-x-race', permanent: true },
      { source: '/events/ticino-x-race-3', destination: '/calendario/ticino-x-race', permanent: true },
      { source: '/events/ticino-x-race-4', destination: '/calendario/ticino-x-race', permanent: true },
      { source: '/events/ticino-x-race-5', destination: '/calendario/ticino-x-race', permanent: true },
      // traversata-del-lago (7)
      { source: '/events/traversata-del-lago', destination: '/calendario/traversata-del-lago', permanent: true },
      { source: '/events/traversata-del-lago-2', destination: '/calendario/traversata-del-lago', permanent: true },
      { source: '/events/traversata-del-lago-2022', destination: '/calendario/traversata-del-lago', permanent: true },
      { source: '/events/traversata-del-lago-3', destination: '/calendario/traversata-del-lago', permanent: true },
      { source: '/events/traversata-del-lago-4', destination: '/calendario/traversata-del-lago', permanent: true },
      { source: '/events/traversata-del-lago-5', destination: '/calendario/traversata-del-lago', permanent: true },
      { source: '/events/traversata-del-lago-6', destination: '/calendario/traversata-del-lago', permanent: true },
      // uscita-autunnale (8)
      { source: '/events/uscita-autunnale', destination: '/calendario/uscita-autunnale', permanent: true },
      { source: '/events/uscita-autunnale-2', destination: '/calendario/uscita-autunnale', permanent: true },
      { source: '/events/uscita-autunnale-2020', destination: '/calendario/uscita-autunnale', permanent: true },
      { source: '/events/uscita-autunnale-3', destination: '/calendario/uscita-autunnale', permanent: true },
      { source: '/events/uscita-autunnale-4', destination: '/calendario/uscita-autunnale', permanent: true },
      { source: '/events/uscita-autunnale-5', destination: '/calendario/uscita-autunnale', permanent: true },
      { source: '/events/uscita-autunnale-6', destination: '/calendario/uscita-autunnale', permanent: true },
      { source: '/events/uscita-autunnale-7', destination: '/calendario/uscita-autunnale', permanent: true },
      // uscita-primaverile-2 (5)
      { source: '/events/uscita-primaverile', destination: '/calendario/uscita-primaverile-2', permanent: true },
      { source: '/events/uscita-primaverile-2', destination: '/calendario/uscita-primaverile-2', permanent: true },
      { source: '/events/uscita-primaverile-23', destination: '/calendario/uscita-primaverile-2', permanent: true },
      { source: '/events/uscita-primaverile-3', destination: '/calendario/uscita-primaverile-2', permanent: true },
      { source: '/events/uscita-primaverile-4', destination: '/calendario/uscita-primaverile-2', permanent: true },
      // volo-e-aperitivo-di-fine-stagione (3)
      { source: '/events/aperitivo-di-fine-stagione', destination: '/calendario/volo-e-aperitivo-di-fine-stagione', permanent: true },
      { source: '/events/aperitivo-di-fine-stagione-2', destination: '/calendario/volo-e-aperitivo-di-fine-stagione', permanent: true },
      { source: '/events/aperitivo-di-fine-stagione-2021', destination: '/calendario/volo-e-aperitivo-di-fine-stagione', permanent: true },
    ]
  },
}

export default withPayload(nextConfig)
