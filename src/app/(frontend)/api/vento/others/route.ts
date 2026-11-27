import { NextResponse } from 'next/server'
import type { WindStation, StationsResponse } from '../types'
import { computeWindLevel, formatCloudBase, fetchWithTimeout, msToKmh } from '../types'
import { fetchSLFStations } from '../slf'
import { cachedFetch } from '../cache'
import { rateLimit } from '@/lib/rate-limit'
import { extractClientIp } from '@/lib/antispam'

// ── PWS (Weather Underground) ──────────────────────────────────────────────
const PWS_BASE =
  'https://api.weather.com/v2/pws/observations/current?apiKey=6532d6454b8aa370768e63d6ba5a832e&format=json&units=m'

const PWS_STATIONS: Record<string, string> = {
  IRIVERA3: 'Rivera',
  ITICINOB2: 'Bellinzona',
  ISTAMARI2: 'Sta Maria GR',
  ILUGAGGI2: 'Skypull/Mte Bar2',
  IVAGLI1: 'Skypull/Mte Bar',
  ITESSINM2: 'Malvaglia',
  ITICINOT2: 'Taverne',
  IGORDE1: 'Gordevio',
  ILODRINO7: 'Lodrino',
}

async function fetchPWSStations(): Promise<(WindStation & { lat: number })[]> {
  const stations: (WindStation & { lat: number })[] = []

  const settled = await Promise.allSettled(
    Object.entries(PWS_STATIONS).map(async ([id, label]) => {
      const res = await fetchWithTimeout(`${PWS_BASE}&stationId=${id}`)
      if (!res.ok) return null
      const json = await res.json()
      const obs = json?.observations?.[0]
      if (!obs) return null

      const m = obs.metric
      const obsTime = obs.epoch != null ? obs.epoch * 1000 : null
      const windAvg = m?.windSpeed ?? null
      const windGust = m?.windGust ?? null
      const windDir = obs.winddir != null && obs.winddir <= 360 ? obs.winddir : null
      const temp = m?.temp
      const humidity = obs.humidity
      const elev = m?.elev ?? 0

      let cloudBase: string | null = null
      if (elev > 1200 && humidity > 0 && temp != null) {
        const hBaseDiff = (20 + temp / 5) * (100 - humidity)
        const hBase = Math.round((hBaseDiff + elev - 50) / 200) * 200
        cloudBase = formatCloudBase(hBase)
      }

      const station: WindStation & { lat: number } = {
        name: `PWS-${label}`,
        isPeak: elev > 700,
        windDir,
        windAvg: windAvg != null ? Math.round(windAvg) : null,
        windGust: windGust != null ? Math.round(windGust) : null,
        windLevel: computeWindLevel(windDir, windAvg, windGust),
        temp: temp != null ? `${Math.round(temp)}°C` : null,
        cloudBase,
        lastUpdate: obsTime,
        lat: obs.lat ?? 0,
        sourceUrl: `https://www.wunderground.com/dashboard/pws/${id}`,
      }
      return station
    }),
  )

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) stations.push(r.value)
  }
  return stations.filter((s) => !(s.windAvg === 0 && s.windDir === 0 && (s.windGust ?? 0) === 0))
}

// ── SLF (IMIS stations) ──────────────────────────────────────────
// Live station lookup and mapping live in ../slf.

// ── Holfuy ─────────────────────────────────────────────────────────────────
const HOLFUY_URL = 'http://widget.holfuy.com/?su=km/h&t=C&lang=en&mode=simple'

const HOLFUY_STATIONS: Record<number, { name: string; elev: number; lat: number }> = {
  969: { name: 'Alpe Foppa', elev: 1532, lat: 46.117 },
  1043: { name: 'Lago Ritom', elev: 1800, lat: 46.531 },
  1621: { name: 'Mte Lema', elev: 1621, lat: 46.040 },
}

async function fetchHolfuyStations(): Promise<(WindStation & { lat: number })[]> {
  const stations: (WindStation & { lat: number })[] = []

  const settled = await Promise.allSettled(
    Object.entries(HOLFUY_STATIONS).map(async ([idStr, info]) => {
      const res = await fetchWithTimeout(`${HOLFUY_URL}&station=${idStr}`)
      if (!res.ok) return null
      const text = await res.text()

      let windDir: number | null = null
      let windAvg: number | null = null
      let windGust: number | null = null
      let temp: number | null = null
      let obsTime: number | null = null

      for (const line of text.split('\n')) {
        const clean = line.replace(/"/g, '')
        const dirM = clean.match(/wind_dir\s*=\s*(.+)/)
        if (dirM) windDir = parseFloat(dirM[1])
        const spdM = clean.match(/wind_speed\s*=\s*(.+)/)
        if (spdM) windAvg = Math.round(parseFloat(spdM[1]))
        const gustM = clean.match(/wind_gust\s*=\s*(.+)/)
        if (gustM) windGust = Math.round(parseFloat(gustM[1]))
        const tempM = clean.match(/temperature\s*=\s*(.+)/)
        if (tempM) temp = parseFloat(tempM[1])
        const timeM = clean.match(/data_time\s*=\s*(\d+):(\d+)/)
        if (timeM) {
          const h = parseInt(timeM[1], 10)
          const m = parseInt(timeM[2], 10)
          const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Zurich',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false,
          })
          const parts = fmt.formatToParts(new Date())
          const nowH = parseInt(parts.find(p => p.type === 'hour')!.value, 10)
          const nowM = parseInt(parts.find(p => p.type === 'minute')!.value, 10)
          let diffMin = (nowH - h) * 60 + (nowM - m)
          if (diffMin < -60) diffMin += 1440
          obsTime = Date.now() - diffMin * 60000
        }
      }

      const station: WindStation & { lat: number } = {
        name: `HFY-${info.name}`,
        isPeak: info.elev > 700,
        windDir: windDir != null && windDir >= 0 && windDir <= 360 ? Math.round(windDir) : null,
        windAvg,
        windGust,
        windLevel: computeWindLevel(windDir, windAvg, windGust),
        temp: temp != null ? `${Math.round(temp)}°C` : null,
        cloudBase: null,
        lastUpdate: obsTime,
        lat: info.lat,
        sourceUrl: `https://holfuy.com/en/weather/${idStr}`,
      }
      return station
    }),
  )

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) stations.push(r.value)
  }
  return stations
}

// ── Windbird / Pioupiou ────────────────────────────────────────────────────
const PIOUPIOU_URL = 'https://api.pioupiou.fr/v1/live'

const WINDBIRD_STATIONS: Record<number, { name: string; elev: number; lat: number }> = {
  2175: { name: 'AlpeMatro', elev: 1140, lat: 46.137 },
  2075: { name: 'Carlazzo', elev: 920, lat: 46.054 },
  1322: { name: 'StaMariaGR', elev: 1218, lat: 46.267 },
}

async function fetchWindbirdStations(): Promise<(WindStation & { lat: number })[]> {
  const stations: (WindStation & { lat: number })[] = []

  const settled = await Promise.allSettled(
    Object.entries(WINDBIRD_STATIONS).map(async ([idStr, info]) => {
      const res = await fetchWithTimeout(`${PIOUPIOU_URL}/${idStr}`)
      if (!res.ok) return null
      const json = await res.json()
      const d = json?.data
      if (!d) return null

      const meas = d.measurements
      const windAvg = meas?.wind_speed_avg != null ? Math.round(meas.wind_speed_avg) : null
      const windGust = meas?.wind_speed_max != null ? Math.round(meas.wind_speed_max) : null
      const windDir = meas?.wind_heading != null ? Math.round(meas.wind_heading) : null

      const obsTime = meas?.date ? new Date(meas.date).getTime() : null

      const station: WindStation & { lat: number } = {
        name: `WBD-${info.name}`,
        isPeak: info.elev > 700,
        windDir: windDir != null && windDir >= 0 && windDir <= 360 ? windDir : null,
        windAvg,
        windGust,
        windLevel: computeWindLevel(windDir, windAvg, windGust),
        temp: null as string | null,
        cloudBase: null as string | null,
        lastUpdate: obsTime,
        lat: d.location?.latitude ?? info.lat,
        sourceUrl: `https://www.openwindmap.org/windbird-${idStr}`,
      }
      return station
    }),
  )

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) stations.push(r.value)
  }
  return stations
}

// ── OASI (Cantone Ticino) ──────────────────────────────────────────────────
const OASI_BASE = 'https://www.oasi.ti.ch/web/rest/measure/'

const OASI_STATIONS: Record<string, { name: string; elev: number; lat: number; code: string }> = {
  Camignolo: { name: 'Camignolo', elev: 435, lat: 46.146, code: 'air_525 01 01' },
}

type OasiParam = 'WD' | 'WS' | 'WSgust' | 'T'

function zurichDateString(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' })
}

// OASI returns naive timestamps in Europe/Zurich local time (no designator).
function parseZurichNaiveTime(naive: string): number | null {
  const asUtc = Date.parse(`${naive}Z`)
  if (Number.isNaN(asUtc)) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(asUtc))
  const off = parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  const m = off.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  let offsetMin = 0
  if (m) {
    offsetMin = (parseInt(m[2], 10) * 60 + parseInt(m[3] || '0', 10)) * (m[1] === '-' ? -1 : 1)
  }
  return asUtc - offsetMin * 60_000
}

type OasiReading = { value: number; time: number | null } | null

async function fetchOASIParameter(code: string, param: OasiParam): Promise<OasiReading> {
  const today = zurichDateString(new Date())
  const url = `${OASI_BASE}?domain=meteo&resolution=h&locations=${encodeURIComponent(code)}&from=${today}&to=${today}&parameter=${param}`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return null
  const json = await res.json()
  const data = json?.locations?.[0]?.data
  if (!Array.isArray(data) || data.length === 0) return null
  const now = Date.now()
  for (let i = data.length - 1; i >= 0; i--) {
    const point = data[i]
    const val = point?.values?.[0]?.value
    if (typeof val !== 'number' || Number.isNaN(val)) continue
    const time = parseZurichNaiveTime(point.date)
    if (time != null && time > now) continue
    return { value: val, time }
  }
  return null
}

async function fetchOASIStations(): Promise<(WindStation & { lat: number })[]> {
  const stations: (WindStation & { lat: number })[] = []

  const settled = await Promise.allSettled(
    Object.values(OASI_STATIONS).map(async (info) => {
      const [wd, ws, wsgust, t] = await Promise.all([
        fetchOASIParameter(info.code, 'WD'),
        fetchOASIParameter(info.code, 'WS'),
        fetchOASIParameter(info.code, 'WSgust'),
        fetchOASIParameter(info.code, 'T'),
      ])

      const windDir = wd && wd.value >= 0 && wd.value <= 360 ? Math.round(wd.value) : null
      const windAvg = ws ? msToKmh(ws.value) : null
      const windGust = wsgust ? msToKmh(wsgust.value) : null
      const tempVal = t && Math.abs(t.value) < 100 ? t.value : null

      if (windAvg == null && windGust == null && windDir == null) return null

      const times = [wd?.time, ws?.time, wsgust?.time, t?.time].filter(
        (x): x is number => x != null,
      )
      const lastUpdate = times.length ? Math.max(...times) : null

      const station: WindStation & { lat: number } = {
        name: `OASI-${info.name}`,
        isPeak: info.elev > 700,
        windDir,
        windAvg,
        windGust,
        windLevel: computeWindLevel(windDir, windAvg, windGust),
        temp: tempVal != null ? `${Math.round(tempVal)}°C` : null,
        cloudBase: null,
        lastUpdate,
        lat: info.lat,
        sourceUrl: 'https://www.oasi.ti.ch/web/dati/meteo.html',
      }
      return station
    }),
  )

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) stations.push(r.value)
  }
  return stations
}

// ── Faido ──────────────────────────────────────────────────────────────────
const FAIDO_URL = 'http://www.tencia.ch/data/allsensors.txt'
const FAIDO_LAT = 46.478

async function fetchFaidoStation(): Promise<(WindStation & { lat: number }) | null> {
  try {
    const res = await fetchWithTimeout(FAIDO_URL, 5000)
    if (!res.ok) return null
    const text = await res.text()

    let temp: number | null = null
    let windDir: number | null = null
    let windAvg: number | null = null
    let windGust: number | null = null
    let utcDate: number | null = null

    for (const line of text.split('\n')) {
      const utcM = line.match(/actual_utcdate\s+(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/)
      if (utcM) {
        utcDate = Date.UTC(+utcM[1], +utcM[2] - 1, +utcM[3], +utcM[4], +utcM[5], +utcM[6])
      }
      const tempM = line.match(/actual_th0_temp_c\s+(.+)/)
      if (tempM) temp = parseFloat(tempM[1])
      const dirM = line.match(/last15m_wind0_maindir_deg\s+(.+)/)
      if (dirM) windDir = Math.round(parseFloat(dirM[1]))
      const spdM = line.match(/last15m_wind0_gustspeed_kmh\s+(.+)/)
      if (spdM) windAvg = Math.round(parseFloat(spdM[1]))
      const gustM = line.match(/last15m_wind0_gustspeedmax_kmh\s+(.+)/)
      if (gustM) windGust = Math.round(parseFloat(gustM[1]))
    }

    const minutesAgo = utcDate != null ? Math.round((Date.now() - utcDate) / 60000) : null

    return {
      name: 'Faido',
      isPeak: false,
      windDir: windDir != null && windDir >= 0 && windDir <= 360 ? windDir : null,
      windAvg,
      windGust,
      windLevel: computeWindLevel(windDir, windAvg, windGust),
      temp: temp != null ? `${Math.round(temp)}°C` : null,
      cloudBase: null,
      lastUpdate: utcDate,
      lat: FAIDO_LAT,
      sourceUrl: 'http://www.tencia.ch/data/11___24h_Wind.png',
    }
  } catch {
    return null
  }
}

// ── Main route ─────────────────────────────────────────────────────────────

async function fetchAllOthers(): Promise<StationsResponse> {
  const [pwsList, slfList, holfuyList, windbirdList, oasiList, faido] = await Promise.all([
    fetchPWSStations().catch(() => [] as (WindStation & { lat: number })[]),
    fetchSLFStations().catch(() => [] as (WindStation & { lat: number })[]),
    fetchHolfuyStations().catch(() => [] as (WindStation & { lat: number })[]),
    fetchWindbirdStations().catch(() => [] as (WindStation & { lat: number })[]),
    fetchOASIStations().catch(() => [] as (WindStation & { lat: number })[]),
    fetchFaidoStation().catch(() => null),
  ])

  const all = [...pwsList, ...slfList, ...holfuyList, ...windbirdList, ...oasiList]
  if (faido) all.push(faido)

  all.sort((a, b) => b.lat - a.lat)
  const stations: WindStation[] = all.map(({ lat: _lat, ...rest }) => rest)

  const now = new Date()
  const timestamp = now.toLocaleString('it-CH', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Zurich',
  })

  return { timestamp, stations, fetchedAt: now.toISOString() }
}

export async function GET(request: Request) {
  const { allowed } = rateLimit({ key: `vento-others:${extractClientIp(request)}`, limit: 30, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Troppe richieste.' }, { status: 429 })
  }
  try {
    const data = await cachedFetch('vento-others', 300, fetchAllOthers)
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120' },
    })
  } catch (e) {
    console.error('[VENTO OTHERS]', e)
    return NextResponse.json({ error: 'Failed to fetch other station data' }, { status: 502 })
  }
}
