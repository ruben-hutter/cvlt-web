import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

const BASE_URL = 'https://cvlt.ch'

const staticPages: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
  { url: `${BASE_URL}/notizie`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  { url: `${BASE_URL}/calendario`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  { url: `${BASE_URL}/galleria`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
  { url: `${BASE_URL}/vento`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.6 },
  { url: `${BASE_URL}/gare`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/info-volo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  { url: `${BASE_URL}/comitato`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/statuto`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  { url: `${BASE_URL}/adesione`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  { url: `${BASE_URL}/quota-sociale`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  { url: `${BASE_URL}/biposto`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/shop`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  { url: `${BASE_URL}/contatto`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const payload = await getPayload({ config })

    // Mirror the article page's visibility rules: only published, already
    // released articles are renderable — everything else 404s and must not
    // be listed in the sitemap.
    const news = await payload.find({
      collection: 'news',
      limit: 0,
      select: { slug: true, updatedAt: true },
      where: {
        status: { equals: 'published' },
        publishDate: { less_than_equal: new Date().toISOString() },
      },
    })

    const newsPages: MetadataRoute.Sitemap = news.docs.map((doc) => ({
      url: `${BASE_URL}/notizie/${doc.slug}`,
      lastModified: new Date(doc.updatedAt as string),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }))

    const events = await payload.find({
      collection: 'events',
      limit: 0,
      select: { slug: true, updatedAt: true },
    })

    const eventPages: MetadataRoute.Sitemap = events.docs.map((doc) => ({
      url: `${BASE_URL}/calendario/${doc.slug}`,
      lastModified: new Date(doc.updatedAt as string),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }))

    return [...staticPages, ...newsPages, ...eventPages]
  } catch {
    return staticPages
  }
}
