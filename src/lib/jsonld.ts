function jsonLdScript(data: Record<string, unknown>) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function organizationJsonLd(baseUrl: string) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'SportsOrganization',
    name: 'Club Volo Libero Ticino',
    alternateName: 'CVLT',
    url: baseUrl,
    logo: `${baseUrl}/logo_CVLT.png`,
    foundingDate: '1987',
    address: {
      '@type': 'PostalAddress',
      addressRegion: 'Ticino',
      addressCountry: 'CH',
    },
    sport: 'Paragliding',
  })
}

export function websiteJsonLd(baseUrl: string) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'CVLT - Club Volo Libero Ticino',
    url: baseUrl,
  })
}

export function articleJsonLd(args: {
  title: string
  slug: string
  publishDate: string
  authorName?: string
  imageUrl?: string
  baseUrl: string
}) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: args.title,
    url: `${args.baseUrl}/notizie/${args.slug}`,
    datePublished: args.publishDate,
    ...(args.authorName && {
      author: {
        '@type': 'Person',
        name: args.authorName,
      },
    }),
    ...(args.imageUrl && { image: args.imageUrl }),
    publisher: {
      '@type': 'SportsOrganization',
      name: 'Club Volo Libero Ticino',
      url: args.baseUrl,
    },
  })
}

export function eventJsonLd(args: {
  title: string
  slug: string
  startDate: string
  endDate?: string | null
  location?: string | null
  status?: string | null
  description?: string | null
  baseUrl: string
}) {
  const statusMap: Record<string, string> = {
    confirmed: 'https://schema.org/EventScheduled',
    tentative: 'https://schema.org/EventPostponed',
    cancelled: 'https://schema.org/EventCancelled',
  }

  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: args.title,
    startDate: args.startDate,
    ...(args.endDate && { endDate: args.endDate }),
    location: {
      '@type': 'Place',
      name: args.location || 'Ticino, Svizzera',
      address: {
        '@type': 'PostalAddress',
        addressRegion: 'Ticino',
        addressCountry: 'CH',
      },
    },
    eventStatus: statusMap[args.status || 'confirmed'] || 'https://schema.org/EventScheduled',
    ...(args.description && { description: args.description }),
    image: `${args.baseUrl}/logo_CVLT.png`,
    organizer: {
      '@type': 'SportsOrganization',
      name: 'Club Volo Libero Ticino',
      url: args.baseUrl,
    },
    url: `${args.baseUrl}/calendario/${args.slug}`,
  })
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
) {
  return jsonLdScript({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  })
}
