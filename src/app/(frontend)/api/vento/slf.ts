import type { WindStation } from './types'
import { computeWindLevel, fetchWithTimeout } from './types'

export type SlfStation = WindStation & { lat: number }

/**
 * SLF (IMIS) wind station source for /api/vento/others (the /vento page).
 *
 * History note (2026-11 outage): SLF renamed the API host from
 * `public-meas-data.slf.ch` to `public-meas-data-v2.slf.ch` and removed the
 * old name from DNS entirely. Paths and payload shapes were unchanged, so the
 * only symptom was that every SLF station silently vanished from /vento.
 */

export const SLF_API_BASE = 'https://public-meas-data-v2.slf.ch'
export const SLF_INFO_URL = `${SLF_API_BASE}/public/station-data/timepoint/TEMPERATURE_AIR/current/geojson`
export const SLF_DATA_URL = `${SLF_API_BASE}/public/station-data/timeseries/current/IMIS`

/**
 * Curated IMIS stations relevant to Ticino pilots. BED2 and MTR1 were removed
 * upstream when SLF moved to the v2 API (404); BED4 (Sabbioni, Val Bedretto)
 * took BED2's place. If SLF retires more stations, update this list.
 */
export const SLF_IDS = [
  'BED1', 'MES1', 'CAM1', 'SIM1', 'VAL1', 'SIM2', 'BED3', 'MES2',
  'NAR1', 'CAM2', 'MTR2', 'BED4', 'NAR2', 'DTR2', 'BOG3', 'VRG3',
] as const

export type SlfMeta = { lat: number; lon: number; elev: number; label: string }

export type SlfReading = {
  windAvg: number | null
  windGust: number | null
  windDir: number | null
  tempC: number | null
  obsTime: number | null
}

export type FetchLike = typeof fetch

type GeoJsonFeature = {
  properties?: { code?: unknown; elevation?: unknown; label?: unknown }
  geometry?: { coordinates?: unknown[] }
}

/**
 * Parses the geojson station-metadata endpoint into code → meta.
 * Returns an empty map for any unexpected payload shape (never throws).
 */
export function parseSLFMeta(json: unknown): Map<string, SlfMeta> {
  const meta = new Map<string, SlfMeta>()
  if (typeof json !== 'object' || json === null) return meta
  const features = (json as { features?: unknown }).features
  if (!Array.isArray(features)) return meta

  for (const f of features as GeoJsonFeature[]) {
    const code = f?.properties?.code
    if (typeof code !== 'string' || code.length === 0) continue
    const coords = f?.geometry?.coordinates ?? []
    meta.set(code, {
      lat: typeof coords[1] === 'number' ? coords[1] : 0,
      lon: typeof coords[0] === 'number' ? coords[0] : 0,
      elev: typeof f?.properties?.elevation === 'number' ? f.properties.elevation : 0,
      label: typeof f?.properties?.label === 'string' ? f.properties.label : code,
    })
  }
  return meta
}

function isNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Parses one station timeseries payload into a reading. Returns null when the
 * payload has no recognizable wind fields at all, which is the signature of
 * an upstream format change.
 */
export function parseSLFTimeseries(raw: unknown): SlfReading | null {
  if (typeof raw !== 'object' || raw === null) return null
  const data = raw as Record<string, unknown>

  const field = (name: string): { value: unknown; timestamp: unknown } | null => {
    const f = data[name]
    if (typeof f !== 'object' || f === null) return null
    return f as { value: unknown; timestamp: unknown }
  }

  const mean = field('windVelocityMean')
  const max = field('windVelocityMax')
  const dir = field('windDirectionMean')
  const temp = field('temperatureAir')

  const windAvg = mean && isNumeric(mean.value) ? Math.round(mean.value) : null
  const windGust = max && isNumeric(max.value) ? Math.round(max.value) : null
  if (windAvg === null && windGust === null) return null

  const windDir = dir && isNumeric(dir.value) ? Math.round(dir.value) : null
  const tempC = temp && isNumeric(temp.value) ? temp.value : null

  const ts = mean?.timestamp ?? max?.timestamp
  const obsTime = typeof ts === 'string' && !Number.isNaN(Date.parse(ts)) ? Date.parse(ts) : null

  return { windAvg, windGust, windDir, tempC, obsTime }
}

async function fetchJson(url: string, fetchImpl: FetchLike): Promise<unknown> {
  const res = await fetchWithTimeout(url, 8000, 2, 1500, fetchImpl)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Fetches and maps all SLF stations. Any per-station failure (network, HTTP
 * error, shape change) skips just that station, so the /vento page keeps
 * showing whatever is available.
 */
export async function fetchSLFStations(fetchImpl: FetchLike = fetch): Promise<SlfStation[]> {
  const settled = await Promise.allSettled([
    fetchJson(SLF_INFO_URL, fetchImpl),
    ...SLF_IDS.map((id) => fetchJson(`${SLF_DATA_URL}/${id}`, fetchImpl)),
  ])

  let metaMap = new Map<string, SlfMeta>()
  if (settled[0].status === 'fulfilled') {
    metaMap = parseSLFMeta(settled[0].value)
  }

  const stations: SlfStation[] = []

  if (metaMap.size > 0) {
    for (let i = 0; i < SLF_IDS.length; i++) {
      const result = settled[i + 1]
      if (result.status !== 'fulfilled') continue

      const id = SLF_IDS[i]
      const meta = metaMap.get(id)
      if (!meta) continue

      const reading = parseSLFTimeseries(result.value)
      if (!reading) continue

      const label = meta.label.replace(/\s+\d{4,}$/, '')

      stations.push({
        name: `SLF-${label}`,
        isPeak: meta.elev > 700,
        windDir: reading.windDir !== null && reading.windDir >= 0 && reading.windDir <= 360
          ? reading.windDir
          : null,
        windAvg: reading.windAvg,
        windGust: reading.windGust,
        windLevel: computeWindLevel(reading.windDir, reading.windAvg, reading.windGust),
        temp: reading.tempC !== null && Math.abs(reading.tempC) < 100
          ? `${Math.round(reading.tempC)}°C`
          : null,
        cloudBase: null,
        lastUpdate: reading.obsTime,
        lat: meta.lat,
        sourceUrl: `https://whiterisk.ch/en/conditions/measurements/station/IMIS/${id}`,
      })
    }
  }

  return stations
}

