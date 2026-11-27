import { describe, expect, it } from 'vitest'
import {
  fetchSLFStations,
  parseSLFMeta,
  parseSLFTimeseries,
  SLF_API_BASE,
  SLF_DATA_URL,
  SLF_IDS,
  SLF_INFO_URL,
} from '../src/app/(frontend)/api/vento/slf'
// Fixture captured 2026-11-27 from the live v2 API (public, non-secret data):
// https://public-meas-data-v2.slf.ch/public/station-data/timepoint/TEMPERATURE_AIR/current/geojson
// trimmed to the configured stations + a few extra codes for negative tests.
import geojsonFixture from './fixtures/slf-geojson-v2.json'

/**
 * Real SLF timeseries payload shape (captured 2026-11-27 from BED1), with a
 * dynamically generated timestamp so tests stay fresh forever. SLF reports
 * every ~30 min, so ageMinutes=10 mimics a healthy station.
 */
function slfTimeseries(ageMinutes = 10): Record<string, unknown> {
  const ts = new Date(Date.now() - ageMinutes * 60_000).toISOString()
  return {
    temperatureAir: { timestamp: ts, value: -7.96 },
    windVelocityMean: { timestamp: ts, value: 16.578 },
    windDirectionMean: { timestamp: ts, value: 338.5 },
    windVelocityMax: { timestamp: ts, value: 22.108 },
  }
}

type FetchOutcome = { status?: number; body?: unknown } | Error

/** Fetch stub mimicking the real failure patterns (DNS, HTTP errors, payloads). */
function makeFetch(handler: (url: string) => FetchOutcome): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const outcome = handler(url)
    if (outcome instanceof Error) throw outcome
    return new Response(JSON.stringify(outcome.body ?? {}), {
      status: outcome.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
}

/** TypeError with a getaddrinfo-style cause: the shape a DNS failure (NXDOMAIN) produces. */
function dnsError(host: string): Error {
  const cause = new Error(`getaddrinfo ${host} ENOTFOUND`)
  return Object.assign(new TypeError('fetch failed'), { cause })
}

function healthyRoutes(overrides: (url: string) => FetchOutcome | null = () => null): (url: string) => FetchOutcome {
  return (url) => {
    const overridden = overrides(url)
    if (overridden !== null) return overridden
    if (url === SLF_INFO_URL) return { body: geojsonFixture }
    if (url.startsWith(`${SLF_DATA_URL}/`)) return { body: slfTimeseries() }
    return { status: 404, body: {} }
  }
}

describe('SLF source configuration', () => {
  it('uses the successor v2 host that replaced the NXDOMAIN original', () => {
    expect(SLF_API_BASE).toBe('https://public-meas-data-v2.slf.ch')
    expect(SLF_INFO_URL).toBe(`${SLF_API_BASE}/public/station-data/timepoint/TEMPERATURE_AIR/current/geojson`)
    expect(SLF_DATA_URL).toBe(`${SLF_API_BASE}/public/station-data/timeseries/current/IMIS`)
  })
})

describe('parseSLFMeta', () => {
  it('parses the real v2 geojson payload', () => {
    const meta = parseSLFMeta(geojsonFixture)
    expect(meta.size).toBe(18)
    expect(meta.get('BED4')).toMatchObject({ elev: 2305, label: 'Sabbioni' })
    expect(meta.get('BED1')).toMatchObject({ label: 'Lucendro', elev: 2963 })
    expect(meta.get('BED1')!.lat).toBeCloseTo(46.54, 1)
  })

  it('returns an empty map for unexpected payload shapes (never throws)', () => {
    expect(parseSLFMeta(null).size).toBe(0)
    expect(parseSLFMeta(42).size).toBe(0)
    expect(parseSLFMeta({ type: 'FeatureCollection' }).size).toBe(0)
    expect(parseSLFMeta({ features: 'nope' }).size).toBe(0)
    expect(parseSLFMeta({ features: [{ properties: {} }, { geometry: {} }] }).size).toBe(0)
  })
})

describe('parseSLFTimeseries', () => {
  it('parses the real v2 station payload', () => {
    const payload = {
      temperatureAir: { timestamp: '2026-11-27T12:30:00Z', value: -7.96 },
      windVelocityMean: { timestamp: '2026-11-27T12:30:00Z', value: 16.578 },
      windDirectionMean: { timestamp: '2026-11-27T12:30:00Z', value: 338.5 },
      windVelocityMax: { timestamp: '2026-11-27T12:30:00Z', value: 22.108 },
    }
    expect(parseSLFTimeseries(payload)).toEqual({
      windAvg: 17,
      windGust: 22,
      windDir: 339,
      tempC: -7.96,
      obsTime: Date.parse('2026-11-27T12:30:00Z'),
    })
  })

  it('returns null when no wind fields are recognizable (format-change signature)', () => {
    expect(parseSLFTimeseries(null)).toBeNull()
    expect(parseSLFTimeseries('nope')).toBeNull()
    expect(parseSLFTimeseries({})).toBeNull()
    expect(parseSLFTimeseries({ status: 'ok', data: [] })).toBeNull()
    expect(parseSLFTimeseries({ windVelocityMean: { value: '16' } })).toBeNull()
    expect(parseSLFTimeseries({ temperatureAir: { value: -5 } })).toBeNull()
  })

  it('tolerates partial payloads (gust-only, no temperature, no direction)', () => {
    const reading = parseSLFTimeseries({ windVelocityMax: { timestamp: '2026-11-27T12:30:00Z', value: 22.1 } })
    expect(reading).not.toBeNull()
    expect(reading!.windGust).toBe(22)
    expect(reading!.windAvg).toBeNull()
    expect(reading!.windDir).toBeNull()
    expect(reading!.tempC).toBeNull()
    expect(reading!.obsTime).toBe(Date.parse('2026-11-27T12:30:00Z'))
  })
})

describe('fetchSLFStations (station source for /api/vento/others)', () => {
  it('maps all configured stations from healthy v2 payloads', async () => {
    const stations = await fetchSLFStations(makeFetch(healthyRoutes()))
    expect(stations).toHaveLength(SLF_IDS.length)

    const lucendro = stations.find((s) => s.name === 'SLF-Lucendro')!
    expect(lucendro).toBeDefined()
    expect(lucendro.windAvg).toBe(17)
    expect(lucendro.windGust).toBe(22)
    expect(lucendro.windDir).toBe(339)
    expect(lucendro.temp).toBe('-8°C')
    expect(lucendro.isPeak).toBe(true)
    expect(lucendro.lastUpdate).toBeGreaterThan(0)
    expect(lucendro.sourceUrl).toContain('/IMIS/BED1')

    // BED4 (Sabbioni) is the upstream successor of the removed BED2.
    expect(stations.find((s) => s.name === 'SLF-Sabbioni')).toBeDefined()
    // Every station carries its latitude so the route can sort all sources.
    for (const s of stations) expect(s.lat).toBeGreaterThan(0)
  })

  it('returns zero stations when the API host is unreachable (2026-11 NXDOMAIN pattern)', async () => {
    const stations = await fetchSLFStations(makeFetch((url) => dnsError(new URL(url).host)))
    expect(stations).toEqual([])
  })

  it('returns zero stations when upstream answers HTTP 500', async () => {
    const stations = await fetchSLFStations(makeFetch(() => ({ status: 500, body: 'internal error' })))
    expect(stations).toEqual([])
  })

  it('returns zero stations when the payload format changed', async () => {
    const stations = await fetchSLFStations(
      makeFetch((url) =>
        url === SLF_INFO_URL
          ? { body: { type: 'FeatureCollection', note: 'schema v3' } }
          : { body: { status: 'ok', measurements: [] } },
      ),
    )
    expect(stations).toEqual([])
  })

  it('skips stations that 404 (removed upstream) and keeps the rest', async () => {
    const removed = `${SLF_DATA_URL}/BED1`
    const stations = await fetchSLFStations(
      makeFetch((url) => (url === removed ? { status: 404, body: {} } : healthyRoutes()(url))),
    )
    expect(stations).toHaveLength(SLF_IDS.length - 1)
    expect(stations.find((s) => s.name === 'SLF-Lucendro')).toBeUndefined()
  })
})

