import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const isDev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://unpkg.com https://gc.zgo.at`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://assets.raisenow.io",
  "connect-src 'self' https://api3.geo.admin.ch https://cvlt.goatcounter.com",
  "frame-src https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const cspPreview = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://unpkg.com https://gc.zgo.at`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://assets.raisenow.io",
  "connect-src 'self' https://api3.geo.admin.ch https://cvlt.goatcounter.com",
  "frame-src https:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': csp,
}

const previewPaths = ['/notizie/preview/']
const skipPaths = ['/admin', '/api/', '/_next/', '/feed']

const knownRootPaths = new Set([
  '', 'notizie', 'calendario', 'galleria', 'vento', 'gare',
  'info-volo', 'comitato', 'statuto', 'adesione', 'quota-sociale',
  'biposto', 'shop', 'contatto', 'feed',
])

const wpStaticPrefixes = [
  '/wp-content/', '/wp-includes/', '/wp-admin/',
  '/wp-json/', '/wp/v2/',
]

const wpQueryParams = new Set([
  'p', 'page_id', 'attachment_id', 'post', 'cat',
  'm', 'w', 'day', 'monthnum', 'paged',
  'mobile', '_page', 'option', 'Itemid', 'task', 'view',
]) // NB: 'year' intentionally absent — legitimate gallery filter

const wpGonePrefixes = [
  '/category/', '/tag/', '/author/', '/archives/',
  '/date/', '/blog/', '/comments/', '/search/',
  '/page/', '/feed/', '/events/',
]

const wpGoneSuffixes = [
  '/attachment/', '/feed',
]

function shouldSkip(pathname: string) {
  return skipPaths.some(p => pathname.startsWith(p))
}

function isPreviewPath(pathname: string) {
  return previewPaths.some(p => pathname.startsWith(p))
}

function isOldWordPressPost(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length !== 1) return false
  if (pathname.includes('.')) return false
  const slug = segments[0]
  if (knownRootPaths.has(slug)) return false
  if (/^gallery-/.test(slug)) return false
  return true
}

function isWpStaticPath(pathname: string) {
  return wpStaticPrefixes.some(p => pathname.startsWith(p))
}

function hasWpQueryParam(url: URL) {
  for (const key of wpQueryParams) {
    if (url.searchParams.has(key)) return true
  }
  return false
}

function isWpGonePath(pathname: string) {
  if (wpGonePrefixes.some(p => pathname.startsWith(p))) return true
  if (wpGoneSuffixes.some(s => pathname.endsWith(s))) return true
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 1 && /^20\d{2}$/.test(segments[0])) return true
  if (segments.length === 2 && /^20\d{2}$/.test(segments[0]) && /^\d{2}$/.test(segments[1])) return true
  if (segments.length >= 3 && /^20\d{2}$/.test(segments[0]) && /^\d{2}$/.test(segments[1]) && /^\d{2}$/.test(segments[2])) return true
  return false
}

function isWpPhpFile(pathname: string) {
  return pathname.endsWith('.php')
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (shouldSkip(pathname)) {
    return NextResponse.next()
  }

  if (isWpStaticPath(pathname) || isWpPhpFile(pathname)) {
    return new NextResponse(null, { status: 410 })
  }

  if (isWpGonePath(pathname)) {
    return new NextResponse(null, { status: 410 })
  }

  if (hasWpQueryParam(request.nextUrl)) {
    return new NextResponse(null, { status: 410 })
  }

  if (pathname !== '/' && pathname.endsWith('/')) {
    const url = new URL(pathname.replace(/\/+$/, '') + request.nextUrl.search, request.url)
    return NextResponse.redirect(url, 301)
  }

  if (isOldWordPressPost(pathname)) {
    return new NextResponse(null, { status: 410 })
  }

  const response = NextResponse.next()

  response.headers.append('x-pathname', pathname)
  const isPreview = isPreviewPath(pathname)

  for (const [key, value] of Object.entries(securityHeaders)) {
    if (isPreview && (key === 'X-Frame-Options' || key === 'Content-Security-Policy')) {
      continue
    }
    response.headers.set(key, value)
  }

  if (isPreview) {
    response.headers.set('Content-Security-Policy', cspPreview)
  }

  return response
}
