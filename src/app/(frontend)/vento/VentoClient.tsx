'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { WindStation, LakeLevel, StationsResponse, LakesResponse } from '../api/vento/types'
import { VENTO_PRESSURE_SECTION_IDS, VENTO_SECTION_IDS } from '@/lib/constants'

function WindArrow({ degrees, size = 28 }: { degrees: number; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${(degrees + 180) % 360}deg)` }}
      className="inline-block translate-y-[1px]"
    >
      <path d="M12 4 L8 16 L12 13 L16 16 Z" fill="currentColor" />
    </svg>
  )
}

function windLevelColor(level: WindStation['windLevel']) {
  switch (level) {
    case 'strong': return 'text-red-600'
    case 'moderate': return 'text-amber-600'
    default: return 'text-cvlt-gray-900'
  }
}

function windLevelBorder(level: WindStation['windLevel']) {
  switch (level) {
    case 'strong': return 'border-red-300 bg-red-100'
    case 'moderate': return 'border-amber-200 bg-amber-100'
    default: return 'border-cvlt-gray-200'
  }
}

function formatLastUpdate(epochMs: number | null): string {
  if (epochMs == null) return '—'
  const minutesAgo = Math.round((Date.now() - epochMs) / 60000)
  if (minutesAgo < 0 || minutesAgo >= 120) return '—'
  return `${minutesAgo}min`
}

function StationCard({ station, now }: { station: WindStation; now: number }) {
  const peakIcon = station.isPeak ? (
    <svg className="h-3.5 w-3.5 flex-shrink-0 text-cvlt-gray-400 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 22h20L12 2zm0 4l7 14H5l7-14z" />
    </svg>
  ) : (
    <svg className="h-3.5 w-3.5 flex-shrink-0 text-cvlt-gray-300 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="16" width="20" height="2" rx="1" />
    </svg>
  )

  return (
    <a
      href={station.sourceUrl ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-lg border p-2 transition-shadow hover:shadow-md sm:p-3 ${windLevelBorder(station.windLevel)}`}
    >
      {/* Mobile: single compact row with lastUpdate */}
      <div className="flex items-center gap-1.5 sm:hidden">
        {peakIcon}
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-cvlt-gray-900">{formatDisplayName(station.name)}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {station.cloudBase && (
            <span className="text-base text-green-700">☁ {station.cloudBase}</span>
          )}
          {station.temp && (
            <span className="text-base text-cvlt-gray-500">{station.temp}</span>
          )}
          {station.windDir !== null && (
            <span className="text-cvlt-gray-500" title={`${station.windDir}°`}>
              <WindArrow degrees={station.windDir} size={30} />
            </span>
          )}
          {station.windAvg !== null ? (
            <span className={`text-base font-bold tabular-nums ${windLevelColor(station.windLevel)}`}>
              {station.windAvg}<span className="text-sm font-bold text-cvlt-gray-400"> - </span>{station.windGust}
            </span>
          ) : (
            <span className="text-base text-cvlt-gray-400">—</span>
          )}
        </div>
        <span className="flex-shrink-0 text-[11px] text-cvlt-gray-400">{formatLastUpdate(station.lastUpdate)}</span>
      </div>

      {/* Desktop: original two-row layout */}
      <div className="hidden sm:block">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {peakIcon}
              <span className="truncate text-sm font-semibold text-cvlt-gray-900">{formatDisplayName(station.name)}</span>
            </div>
          </div>
          <span className="flex-shrink-0 text-xs text-cvlt-gray-400">{formatLastUpdate(station.lastUpdate)}</span>
        </div>

        <div className="mt-2 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {station.windDir !== null && (
              <span className="text-cvlt-gray-500" title={`${station.windDir}°`}>
                <WindArrow degrees={station.windDir} />
              </span>
            )}
            <span className={`text-lg font-bold tabular-nums ${windLevelColor(station.windLevel)}`}>
              {station.windAvg !== null ? (
                <>{station.windAvg}<span className="text-xs font-normal"> - </span>{station.windGust}</>
              ) : '-'}
            </span>
            <span className="text-xs text-cvlt-gray-400">km/h</span>
          </div>

          {station.temp && (
            <span className="text-sm text-cvlt-gray-600">{station.temp}</span>
          )}

          {station.cloudBase && (
            <span className="text-sm text-green-700">{station.cloudBase}</span>
          )}
        </div>
      </div>
    </a>
  )
}

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section className="animate-pulse">
      <h2 className="text-lg font-bold text-cvlt-gray-900">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-50" />
        ))}
      </div>
    </section>
  )
}

function SectionError({ title }: { title: string }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-cvlt-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-cvlt-gray-400">Dati non disponibili al momento.</p>
    </section>
  )
}

function StationsSection({ title, timestamp, stations }: { title: string; timestamp: string; stations: WindStation[] }) {
  if (stations.length === 0) return null

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-cvlt-gray-900">{title}</h2>
        {timestamp && <span className="text-xs text-cvlt-gray-400">{timestamp}</span>}
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:mt-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {stations.map((s, i) => <StationCard key={`${s.name}-${i}`} station={s} now={Date.now()} />)}
      </div>
    </section>
  )
}

function LakesSection({ lakes }: { lakes: LakeLevel[] }) {
  if (lakes.length === 0) return null

  return (
    <section>
      <h2 className="text-lg font-bold text-cvlt-gray-900">Laghi</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cvlt-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-cvlt-gray-500">
              <th className="py-2 pr-4">Lago</th>
              <th className="py-2 pr-4">Aggiornamento</th>
              <th className="py-2 pr-4 text-right">Livello</th>
              <th className="py-2 pr-4 text-right">Media</th>
              <th className="py-2 text-right">Max</th>
            </tr>
          </thead>
          <tbody>
            {lakes.map((lake, i) => (
              <tr key={i} className="border-b border-cvlt-gray-100">
                <td className="py-2 pr-4 font-medium text-cvlt-gray-900">{lake.name}</td>
                <td className="py-2 pr-4 text-cvlt-gray-500">{lake.date}</td>
                <td className="py-2 pr-4 text-right font-semibold tabular-nums text-cvlt-gray-900">{lake.level}</td>
                <td className="py-2 pr-4 text-right tabular-nums text-cvlt-gray-500">{lake.average}</td>
                <td className="py-2 text-right tabular-nums text-cvlt-gray-500">{lake.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type PressurePoint = {
  time: string
  diffP: number | null
  diffT: number | null
  windMTR: number | null
}

type FoehnPoint = {
  time: string
  diffP: number
}

const STATION_REGIONS: Record<string, string> = {
  'Andermatt': 'alpi',
  'Piotta': 'alpi',
  'San Bernardino': 'alpi',
  'Robiei': 'alpi',
  'Matro': 'alpi',
  'Cimetta': 'sopraceneri',
  'SLF-Löita': 'alpi',
  'SLF-Preda': 'alpi',
  'HFY-Lago Ritom': 'alpi',
  'SLF-Cassinello': 'alpi',
  'SLF-Tremorgio': 'alpi',
  'SLF-Bassa di Nara': 'alpi',
  'SLF-Piano del Simano': 'alpi',
  'SLF-Fontane': 'alpi',
  'SLF-Motto Crostel': 'alpi',
  'SLF-Cima del Simano': 'alpi',
  'SLF-Piz Pian Grand': 'alpi',
  'SLF-Pian Grand': 'alpi',
  'SLF-Predanass': 'alpi',
  'SLF-Lucendro': 'alpi',
  'SLF-Bombögn Wind': 'alpi',
  'WBD-StaMariaGR': 'sopraceneri',
  'SLF-Porcaresc': 'sopraceneri',
  'WBD-AlpeMatro': 'sottoceneri',
  'Comprovasco': 'alpi',
  'Biasca': 'sopraceneri',
  'Cevio': 'sopraceneri',
  'Faido': 'alpi',
  'Grono': 'sopraceneri',
  'Locarno': 'sopraceneri',
  'Cadenazzo': 'sopraceneri',
  'PWS-Lodrino': 'sopraceneri',
  'PWS-Gordevio': 'sopraceneri',
  'PWS-Rivera': 'sottoceneri',
  'HFY-Alpe Foppa': 'sottoceneri',
  'WBD-Carlazzo': 'sottoceneri',
  'OASI-Camignolo': 'sottoceneri',
  'HFY-Mte Lema': 'sottoceneri',
  'Lugano': 'sottoceneri',
  'Generoso': 'sottoceneri',
  'Stabio': 'sottoceneri',
}

const REGION_ORDER = ['alpi', 'sopraceneri', 'sottoceneri'] as const

const REGION_LABELS: Record<string, string> = {
  alpi: 'Alpi ticinesi',
  sopraceneri: 'Sopraceneri',
  sottoceneri: 'Sottoceneri',
}

const REGION_ALL = 'all'

function getStationRegion(name: string): string {
  return STATION_REGIONS[name] || 'sopraceneri'
}

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  'WBD-StaMariaGR': 'Sta Maria GR',
  'WBD-AlpeMatro': 'Piccolo Matro',
  'HFY-Mte Lema': 'Monte Lema',
  'SLF-Bombögn Wind': 'Bombögn',
}

function formatDisplayName(name: string): string {
  if (DISPLAY_NAME_OVERRIDES[name]) return DISPLAY_NAME_OVERRIDES[name]
  const match = name.match(/^([A-Z]+)-(.+)$/)
  if (match) return match[2]
  return name
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

function useIsMobilePortrait(): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const check = () => setIsMobile(mq.matches && window.innerWidth < window.innerHeight)
    check()
    const onResize = () => check()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isMobile
}

function capFoehnForecastSevenDays(points: FoehnPoint[]): FoehnPoint[] {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const start = now.getTime()
  const end = start + 7 * MS_PER_DAY
  return points.filter((p) => {
    const t = new Date(p.time).getTime()
    return !Number.isNaN(t) && t >= start && t < end
  })
}

function PressureChart({ data, isMobilePortrait }: { data: PressurePoint[]; isMobilePortrait: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return

    function draw() {
      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const rect = canvas!.getBoundingClientRect()
      canvas!.width = rect.width * dpr
      canvas!.height = rect.height * dpr
      ctx.scale(dpr, dpr)
      const W = rect.width
      const H = rect.height

      const pad = { top: 10, right: 70, bottom: 38, left: 40 }
    const cW = W - pad.left - pad.right
    const cH = H - pad.top - pad.bottom

    const isNarrow = window.innerWidth < 640 && window.innerWidth < window.innerHeight
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const chartTMin = isNarrow
      ? today.getTime() - 3 * MS_PER_DAY
      : today.getTime() - 6 * MS_PER_DAY
    const chartTMax = today.getTime() + MS_PER_DAY
    const chartData = data.filter(d => {
      const t = new Date(d.time).getTime()
      return t >= chartTMin
    })
    if (chartData.length === 0) return

    const tMin = chartTMin
    const tMax = chartTMax

    const pressures = chartData.map(d => d.diffP).filter((v): v is number => v !== null)
    const temps = chartData.map(d => d.diffT).filter((v): v is number => v !== null)
    const winds = chartData.map(d => d.windMTR).filter((v): v is number => v !== null)
    const pMin = Math.min(...pressures, 0)
    const pMax = Math.max(...pressures, 0)
    const pRange = Math.max(Math.abs(pMin), Math.abs(pMax), 2)
    const tempMin = Math.min(...temps, 0)
    const tempMax = Math.max(...temps, 0)
    const wMax = winds.length > 0 ? Math.max(...winds, 10) : 10
    const tRange = Math.max(Math.abs(tempMin), Math.abs(tempMax), 2)
    const tStep = tRange > 8 ? 2 : 1

    const xScale = (t: number) => pad.left + ((t - tMin) / (tMax - tMin)) * cW
    const yP = (v: number) => pad.top + cH / 2 - (v / pRange) * (cH / 2)
    const yT = (v: number) => pad.top + cH / 2 - (v / tRange) * (cH / 2)
    const yW = (v: number) => pad.top + cH - (v / wMax) * cH

    // Background
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)

    // Horizontal guides: single neutral system aligned to Δ pressione (left axis).
    // Solid y=0 slightly stronger than dashed tick guides.
    const pStep = pRange > 8 ? 2 : 1
    ctx.lineWidth = 1
    ctx.strokeStyle = '#94a3b8'
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(pad.left, yP(0))
    ctx.lineTo(W - pad.right, yP(0))
    ctx.stroke()
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 0.75
    ctx.setLineDash([3, 3])
    for (let v = -Math.ceil(pRange); v <= Math.ceil(pRange); v += pStep) {
      if (v !== 0 && Math.abs(v) <= pRange) {
        ctx.beginPath()
        ctx.moveTo(pad.left, yP(v))
        ctx.lineTo(W - pad.right, yP(v))
        ctx.stroke()
      }
    }
    ctx.setLineDash([])

    // Time labels on x-axis
    ctx.fillStyle = '#6b7280'
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    const dayMs = 24 * 60 * 60 * 1000
    const totalDays = (tMax - tMin) / dayMs
    const pxPerDay = cW / totalDays
    const dayStep = pxPerDay < 40 ? 2 : 1
    const startDay = new Date(tMin)
    startDay.setHours(0, 0, 0, 0)
    const allDays: number[] = []
    for (let d = startDay.getTime(); d < tMax; d += dayMs) {
      allDays.push(d)
    }
    for (let dayIdx = 0; dayIdx < allDays.length; dayIdx++) {
      const d = allDays[dayIdx]
      const x = xScale(d)
      if (x > pad.left + 1 && x < W - pad.right - 1) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x, pad.top)
        ctx.lineTo(x, pad.top + cH)
        ctx.stroke()
        ctx.setLineDash([])
      }
      if (dayIdx % dayStep === 0) {
        const midDay = d + dayMs / 2
        const labelX = xScale(midDay)
        if (labelX >= pad.left && labelX <= W - pad.right - 5) {
          ctx.fillStyle = '#6b7280'
          ctx.fillText(new Date(d).toLocaleDateString('it-CH', { weekday: 'short' }), labelX, H - pad.bottom + 13)
          ctx.fillText(new Date(d).toLocaleDateString('it-CH', { day: 'numeric', month: 'short' }), labelX, H - pad.bottom + 25)
        }
      }
    }

    // Y-axis labels (pressure) - dynamic range with step of 1
    ctx.textAlign = 'right'
    ctx.fillStyle = '#3b82f6'
    for (let v = -Math.ceil(pRange); v <= Math.ceil(pRange); v += pStep) {
      if (Math.abs(v) <= pRange) {
        ctx.fillText(`${v}`, pad.left - 5, yP(v) + 3)
      }
    }
    // Pressure bars
    const barWidth = Math.max(1, (cW / chartData.length) * 0.7)
    const zeroY = yP(0)
    for (const point of chartData) {
      if (point.diffP === null) continue
      const x = xScale(new Date(point.time).getTime())
      const y = yP(point.diffP)
      const barH = zeroY - y

      if (point.diffP <= -4) ctx.fillStyle = 'rgba(239, 68, 68, 0.7)'
      else if (point.diffP <= -3) ctx.fillStyle = 'rgba(249, 115, 22, 0.7)'
      else if (point.diffP <= -2) ctx.fillStyle = 'rgba(234, 179, 8, 0.7)'
      else ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'

      ctx.fillRect(x - barWidth / 2, Math.min(y, zeroY), barWidth, Math.abs(barH))
    }

    // Temperature line
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    let started = false
    for (const point of chartData) {
      if (point.diffT === null) continue
      const x = xScale(new Date(point.time).getTime())
      const y = yT(point.diffT)
      if (!started) { ctx.moveTo(x, y); started = true }
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Wind MTR area
    ctx.fillStyle = 'rgba(34, 197, 94, 0.1)'
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    const windPoints: { x: number; y: number }[] = []
    for (const point of chartData) {
      if (point.windMTR === null) continue
      const x = xScale(new Date(point.time).getTime())
      const y = yW(point.windMTR)
      windPoints.push({ x, y })
    }
    if (windPoints.length > 0) {
      ctx.moveTo(windPoints[0].x, yW(0))
      for (const p of windPoints) ctx.lineTo(p.x, p.y)
      ctx.lineTo(windPoints[windPoints.length - 1].x, yW(0))
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(windPoints[0].x, windPoints[0].y)
      for (let i = 1; i < windPoints.length; i++) ctx.lineTo(windPoints[i].x, windPoints[i].y)
      ctx.stroke()
    }

    // "Now" vertical line
    const nowMs = Date.now()
    if (nowMs >= tMin && nowMs <= tMax) {
      const nowX = xScale(nowMs)
      ctx.save()
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 3])
      ctx.beginPath()
      ctx.moveTo(nowX, pad.top)
      ctx.lineTo(nowX, pad.top + cH)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#f97316'
      ctx.font = 'bold 11px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('ora', nowX, pad.top - 2)
      ctx.restore()
    }

    // Right axis labels (temp) - tick marks with values
    ctx.textAlign = 'left'
    ctx.fillStyle = '#1e293b'
    ctx.font = '10px system-ui, sans-serif'
    for (let v = -Math.ceil(tRange); v <= Math.ceil(tRange); v += tStep) {
      if (Math.abs(v) <= tRange) {
        ctx.fillText(`${v}`, W - pad.right + 5, yT(v) + 3)
      }
    }
    // Right axis labels (wind) - tick marks with values
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(34, 197, 94, 0.8)'
    ctx.font = '10px system-ui, sans-serif'
    for (let v = 0; v <= wMax; v += 5) {
      const wy = yW(v)
      if (wy >= pad.top && wy <= pad.top + cH) {
        ctx.fillText(`${v}`, W - pad.right + 35, wy + 3)
      }
    }
    // (Legend moved to sidebar)
    } // end draw()
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [data])

  return (
    <canvas
      ref={canvasRef}
      className="h-64 w-full rounded-lg border border-cvlt-gray-200 sm:h-80"
      style={{ width: '100%' }}
    />
  )
}

function FoehnChart({ data }: { data: FoehnPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return

    function draw() {
      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      const rect = canvas!.getBoundingClientRect()
      canvas!.width = rect.width * dpr
      canvas!.height = rect.height * dpr
      ctx.scale(dpr, dpr)
      const W = rect.width
      const H = rect.height

      const pad = { top: 10, right: 30, bottom: 38, left: 40 }
    const cW = W - pad.left - pad.right
    const cH = H - pad.top - pad.bottom

    const pressures = data.map(d => d.diffP)
    const times = data.map(d => new Date(d.time).getTime())

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tMin = today.getTime()
    const tMax = tMin + 7 * MS_PER_DAY
    const pMin = Math.min(...pressures, -4)
    const pMax = Math.max(...pressures, 4)
    const pRange = Math.max(Math.abs(pMin), Math.abs(pMax), 4)

    const xScale = (t: number) => pad.left + ((t - tMin) / (tMax - tMin)) * cW
    const yP = (v: number) => pad.top + cH / 2 - (v / pRange) * (cH / 2)

    // Background
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, W, H)

    // Threshold zones
    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)'
    ctx.fillRect(pad.left, yP(pRange), cW, yP(4) - yP(pRange))
    ctx.fillRect(pad.left, yP(-4), cW, yP(-pRange) - yP(-4))

    // Grid + labels (same horizontal guide style as measured pressure chart)
    ctx.font = '10px system-ui, sans-serif'
    const pStep = pRange > 10 ? 2 : 1
    ctx.lineWidth = 1
    ctx.strokeStyle = '#94a3b8'
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(pad.left, yP(0))
    ctx.lineTo(W - pad.right, yP(0))
    ctx.stroke()
    ctx.strokeStyle = '#d1d5db'
    ctx.lineWidth = 0.75
    ctx.setLineDash([3, 3])
    for (let v = -Math.ceil(pRange); v <= Math.ceil(pRange); v += pStep) {
      if (v !== 0 && Math.abs(v) <= pRange) {
        ctx.beginPath()
        ctx.moveTo(pad.left, yP(v))
        ctx.lineTo(W - pad.right, yP(v))
        ctx.stroke()
      }
    }
    ctx.setLineDash([])
    ctx.textAlign = 'right'
    ctx.fillStyle = '#6b7280'
    for (let v = -Math.ceil(pRange); v <= Math.ceil(pRange); v += pStep) {
      if (Math.abs(v) <= pRange) {
        ctx.fillText(`${v}`, pad.left - 5, yP(v) + 3)
      }
    }

    // ±4 threshold lines
    ctx.strokeStyle = '#93c5fd'
    ctx.lineWidth = 1.5
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(pad.left, yP(4))
    ctx.lineTo(W - pad.right, yP(4))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pad.left, yP(-4))
    ctx.lineTo(W - pad.right, yP(-4))
    ctx.stroke()
    ctx.setLineDash([])

    // Föhn labels at thresholds
    ctx.fillStyle = '#3b82f6'
    ctx.font = '9px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('SÜD FÖHN', W - pad.right - 55, yP(pRange) + 12)
    ctx.fillText('NORD FÖHN', W - pad.right - 60, yP(-pRange) - 4)

    // Time labels on x-axis
    ctx.fillStyle = '#6b7280'
    ctx.font = '10px system-ui, sans-serif'
    ctx.textAlign = 'center'
    const dayMs = 24 * 60 * 60 * 1000
    const totalDays = (tMax - tMin) / dayMs
    const pxPerDay = cW / totalDays
      const dayStep = pxPerDay < 35 ? 2 : 1
    const startDay = new Date(tMin)
    startDay.setHours(0, 0, 0, 0)
    const allDays: number[] = []
    for (let d = startDay.getTime(); d <= tMax; d += dayMs) {
      allDays.push(d)
    }
    for (let dayIdx = 0; dayIdx < allDays.length; dayIdx++) {
      const d = allDays[dayIdx]
      const isFirst = dayIdx === 0
      const isLast = dayIdx === allDays.length - 1
      if (!isFirst && !isLast) {
        const x = xScale(d)
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.9)'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x, pad.top)
        ctx.lineTo(x, pad.top + cH)
        ctx.stroke()
        ctx.setLineDash([])
      }
      if (dayIdx % dayStep === 0) {
        const midDay = d + dayMs / 2
        const labelX = midDay <= tMax ? xScale(midDay) : xScale(d)
        if (labelX <= W - pad.right - 5) {
          ctx.fillStyle = '#6b7280'
          ctx.fillText(new Date(d).toLocaleDateString('it-CH', { weekday: 'short' }), labelX, H - pad.bottom + 13)
          ctx.fillText(new Date(d).toLocaleDateString('it-CH', { day: 'numeric', month: 'short' }), labelX, H - pad.bottom + 25)
        }
      }
    }

    // Clip chart area so pre-midnight anchor point doesn't bleed into y-axis
    ctx.save()
    ctx.beginPath()
    ctx.rect(pad.left, pad.top, cW, cH)
    ctx.clip()

    // Pressure line
    ctx.strokeStyle = '#1e40af'
    ctx.lineWidth = 2
    ctx.beginPath()
    let started = false
    for (const point of data) {
      const x = xScale(new Date(point.time).getTime())
      if (x < pad.left) continue
      const y = yP(point.diffP)
      if (!started) { ctx.moveTo(x, y); started = true }
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Fill below line
    ctx.beginPath()
    let fillStarted = false
    for (const point of data) {
      const x = xScale(new Date(point.time).getTime())
      if (x < pad.left) continue
      const y = yP(point.diffP)
      if (!fillStarted) {
        ctx.moveTo(x, yP(0))
        ctx.lineTo(x, y)
        fillStarted = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    if (fillStarted) {
      const lastX = xScale(new Date(data[data.length - 1].time).getTime())
      ctx.lineTo(lastX, yP(0))
      ctx.closePath()
      ctx.fillStyle = 'rgba(30, 64, 175, 0.08)'
      ctx.fill()
    }

    // "Now" dot on the pressure line
    const nowMs = Date.now()
    if (nowMs >= tMin && nowMs <= tMax) {
      let nearest = data[0]
      let nearestDist = Math.abs(new Date(data[0].time).getTime() - nowMs)
      for (const point of data) {
        const dist = Math.abs(new Date(point.time).getTime() - nowMs)
        if (dist < nearestDist) { nearest = point; nearestDist = dist }
      }
      const dotX = xScale(new Date(nearest.time).getTime())
      const dotY = yP(nearest.diffP)
      ctx.beginPath()
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#1e40af'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    ctx.restore()
    } // end draw()
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [data])

  return (
    <canvas
      ref={canvasRef}
      className="h-64 w-full rounded-lg border border-cvlt-gray-200 sm:h-80"
      style={{ width: '100%' }}
    />
  )
}

function PressureSection({ data, loading, error, foehnData, foehnLoading, foehnError }: {
  data: PressurePoint[] | null; loading: boolean; error: boolean
  foehnData: FoehnPoint[] | null; foehnLoading: boolean; foehnError: boolean
}) {
  const isMobilePortrait = useIsMobilePortrait()
  const foehnForChart = useMemo(
    () => (foehnData ? capFoehnForecastSevenDays(foehnData) : []),
    [foehnData],
  )

  return (
    <section>
      <h2 className="text-lg font-bold text-cvlt-gray-900">Pressione</h2>
      <div className="mt-3 space-y-4">
        <div>
          <h3 className="mb-1 text-sm font-medium text-cvlt-gray-600">
            Dati misurati: Locarno{'\u2013'}Kloten (OTL-KLO) e Vento Matro
          </h3>
          <p className="mb-2 text-xs text-cvlt-gray-400">MeteoSwiss</p>
          {loading && !data ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-50">
              <span className="text-sm text-cvlt-gray-400 animate-pulse">Caricamento dati pressione...</span>
            </div>
          ) : error && !data ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-50">
              <span className="text-sm text-cvlt-gray-400">Dati pressione non disponibili.</span>
            </div>
          ) : data && data.length > 0 ? (
            <PressureChart data={data} isMobilePortrait={isMobilePortrait} />
          ) : null}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-medium text-cvlt-gray-600">
            Previsione föhn: Lugano&ndash;Zürich
          </h3>
          <p className="mb-2 text-xs text-cvlt-gray-400">MOSMIX (DWD)</p>
          {foehnLoading && !foehnData ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-50">
              <span className="text-sm text-cvlt-gray-400 animate-pulse">Caricamento previsione föhn...</span>
            </div>
          ) : foehnError && !foehnData ? (
            <div className="flex h-64 items-center justify-center rounded-lg border border-cvlt-gray-200 bg-cvlt-gray-50">
              <span className="text-sm text-cvlt-gray-400">Previsione föhn non disponibile.</span>
            </div>
          ) : foehnForChart.length > 0 ? (
            <FoehnChart data={foehnForChart} />
          ) : null}
        </div>
      </div>
    </section>
  )
}

function WindLegend() {
  return (
    <div className="space-y-2 text-xs text-cvlt-gray-600">
      <div className="flex items-center gap-2">
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-cvlt-gray-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 22h20L12 2zm0 4l7 14H5l7-14z" />
        </svg>
        Vetta
      </div>
      <div className="flex items-center gap-2">
        <svg className="h-3.5 w-3.5 flex-shrink-0 text-cvlt-gray-300" viewBox="0 0 24 24" fill="currentColor">
          <rect x="2" y="16" width="20" height="2" rx="1" />
        </svg>
        Fondovalle
      </div>
      <div className="flex items-center gap-2">
        <WindArrow degrees={45} size={14} />
        <span>Direzione vento</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold tabular-nums text-amber-600">5-12</span>
        <span>Media &ndash; raffica (km/h)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-green-700">☁</span>
        <span>Base nubi stimata (solo vetta)</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-cvlt-gray-400">10min</span>
        <span>Ultimo aggiornamento</span>
      </div>
      <div className="border-t border-cvlt-gray-200 pt-2 mt-2 space-y-2">
        <p className="font-medium text-cvlt-gray-500">Colore bordo e testo:</p>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full border border-red-300 bg-red-100" />
          <span>Rosso &ndash; vento forte oppure da nord con &gt;8 km/h</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full border border-amber-200 bg-amber-100" />
          <span>Arancione &ndash; vento moderato oppure da nord con raffiche</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full border border-cvlt-gray-200 bg-white" />
          <span>Normale &ndash; condizioni calme</span>
        </div>
      </div>
    </div>
  )
}

function PressureLegend() {
  return (
    <div className="space-y-2 text-xs text-cvlt-gray-600">
      <p className="font-medium text-cvlt-gray-500">Grafici:</p>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-4 flex-shrink-0 rounded-sm bg-blue-400/40" />
        Δ Pressione (hPa)
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-4 flex-shrink-0 bg-gray-800" />
        Δ Temperatura (°C)
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-4 flex-shrink-0 rounded-sm bg-green-500/20 border border-green-500/40" />
        Vento Matro (km/h)
      </div>
      <div className="border-t border-cvlt-gray-200 pt-2 mt-2">
        <p className="font-medium text-cvlt-gray-500 mb-1.5">Colori barre pressione:</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-4 flex-shrink-0 rounded-sm bg-blue-400/40" />
            &gt; -2 hPa
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-4 flex-shrink-0 rounded-sm bg-yellow-500/70" />
            <span className="text-yellow-600">≤ -2 hPa</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-4 flex-shrink-0 rounded-sm bg-orange-500/70" />
            <span className="text-orange-500">≤ -3 hPa</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-4 flex-shrink-0 rounded-sm bg-red-500/70" />
            <span className="text-red-500">≤ -4 hPa</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Legend() {
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const handleScroll = () => {
      const navHeight = 80
      let current = ''
      for (const id of VENTO_SECTION_IDS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= navHeight + 10) {
          current = id
        }
      }
      setActiveSection(current)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const showPressure = VENTO_PRESSURE_SECTION_IDS.some((id) => id === activeSection)

  return (
    <aside className="hidden flex-shrink-0 lg:block lg:w-52">
      <div className="sticky top-20 space-y-3 rounded-lg border border-cvlt-gray-200 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-cvlt-gray-400">
          Legenda
        </h3>
        {showPressure ? <PressureLegend /> : <WindLegend />}
      </div>
    </aside>
  )
}

function MobileLegend() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-cvlt-gray-200 bg-white text-cvlt-gray-600 shadow-lg transition-colors hover:bg-cvlt-gray-50 active:bg-cvlt-gray-100 lg:hidden"
        aria-label="Legenda"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-cvlt-gray-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-cvlt-gray-400">
                Legenda
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-cvlt-gray-400 transition-colors hover:text-cvlt-gray-600"
                aria-label="Chiudi"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-cvlt-gray-400">Vento — stazioni</h4>
                <WindLegend />
              </div>
              <div className="border-t-2 border-cvlt-gray-200 pt-7">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-cvlt-gray-400">Pressione — grafici</h4>
                <PressureLegend />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Forecast section (commented out - enable when needed) ──────────────────
//
// type ForecastSite = {
//   name: string; top: string; distance: string; flyability: number
//   level: 'good' | 'moderate' | 'poor'; graphUrl: string | null
// }
// type ForecastDay = { date: string; sites: ForecastSite[] }
//
// function ForecastSection({ forecast }: { forecast: ForecastDay[] }) {
//   return (
//     <section>
//       <h2 className="text-lg font-bold text-cvlt-gray-900">Previsione di volo</h2>
//       <p className="mt-1 text-xs text-cvlt-gray-500">
//         Startleiter di Daniele Nerini -{' '}
//         <a href="https://github.com/dnerini/startleiter" target="_blank" rel="noopener noreferrer"
//            className="text-cvlt-blue hover:underline">info</a>
//       </p>
//       {/* ... render forecast days/sites here ... */}
//     </section>
//   )
// }

type SectionState<T> = {
  data: T | null
  loading: boolean
  error: boolean
}

export function VentoClient() {
  const [mch, setMch] = useState<SectionState<StationsResponse>>({ data: null, loading: true, error: false })
  const [others, setOthers] = useState<SectionState<StationsResponse>>({ data: null, loading: true, error: false })
  const [lakes, setLakes] = useState<SectionState<LakesResponse>>({ data: null, loading: true, error: false })
  const [pressure, setPressure] = useState<SectionState<{ data: PressurePoint[] }>>({ data: null, loading: true, error: false })
  const [foehn, setFoehn] = useState<SectionState<{ data: FoehnPoint[] }>>({ data: null, loading: true, error: false })
  const [regionFilter, setRegionFilter] = useState<string>(REGION_ALL)
  const [tick, setTick] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const fetchSection = useCallback(async <T,>(
    url: string,
    setter: React.Dispatch<React.SetStateAction<SectionState<T>>>,
    cacheKey: string,
  ) => {
    setter((prev) => ({ ...prev, loading: true }))
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setter({ data, loading: false, error: false })
      try { localStorage.setItem(cacheKey, JSON.stringify(data)) } catch {}
    } catch {
      setter((prev) => ({ ...prev, loading: false, error: true }))
    }
  }, [])

  useEffect(() => {
    const cacheKeys = [
      { key: 'vento:mch:v3', setter: setMch },
      { key: 'vento:others:v4', setter: setOthers },
      { key: 'vento:lakes', setter: setLakes },
      { key: 'vento:pressure', setter: setPressure },
      { key: 'vento:foehn', setter: setFoehn },
    ]
    for (const { key, setter } of cacheKeys) {
      try {
        const cached = localStorage.getItem(key)
        if (cached) setter({ data: JSON.parse(cached), loading: true, error: false })
      } catch {}
    }

    const fetchWind = () => {
      fetchSection<StationsResponse>('/api/vento/mch', setMch, 'vento:mch:v3')
      fetchSection<StationsResponse>('/api/vento/others', setOthers, 'vento:others:v4')
    }
    const fetchPressureFn = () => fetchSection<{ data: PressurePoint[] }>('/api/vento/pressure', setPressure, 'vento:pressure')
    const fetchFoehnFn = () => fetchSection<{ data: FoehnPoint[] }>('/api/vento/foehn', setFoehn, 'vento:foehn')

    fetchWind()
    fetchSection<LakesResponse>('/api/vento/lakes', setLakes, 'vento:lakes')
    fetchPressureFn()
    fetchFoehnFn()

    const windInterval = setInterval(fetchWind, 5 * 60_000)
    const pressureInterval = setInterval(fetchPressureFn, 10 * 60_000)
    const foehnInterval = setInterval(fetchFoehnFn, 15 * 60_000)

    return () => {
      clearInterval(windInterval)
      clearInterval(pressureInterval)
      clearInterval(foehnInterval)
    }
  }, [fetchSection])

  const allStations = useMemo(() => {
    const merged = [...(mch.data?.stations ?? []), ...(others.data?.stations ?? [])]
    return merged.map((s) => ({ ...s, region: getStationRegion(s.name) }))
  }, [mch.data, others.data])

  const stationsByRegion = useMemo(() => {
    const groups: Record<string, WindStation[]> = {}
    for (const s of allStations) {
      if (regionFilter !== REGION_ALL && s.region !== regionFilter) continue
      if (!groups[s.region]) groups[s.region] = []
      groups[s.region].push(s)
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (a.isPeak !== b.isPeak) return a.isPeak ? -1 : 1
        return formatDisplayName(a.name).localeCompare(formatDisplayName(b.name), 'it')
      })
    }
    return REGION_ORDER
      .filter((r) => groups[r])
      .map((r) => ({ region: r, label: REGION_LABELS[r], stations: groups[r] }))
  }, [allStations, regionFilter])

  const timestamp = mch.data?.timestamp || others.data?.timestamp

  const hasScrolled = useRef(false)
  useEffect(() => {
    if (hasScrolled.current) return
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const hasAny = mch.data || others.data || lakes.data || pressure.data || foehn.data
    if (!hasAny) return
    hasScrolled.current = true
    requestAnimationFrame(() => {
      const el = document.getElementById(hash)
      if (el) el.scrollIntoView({ behavior: 'smooth' })
    })
  }, [mch.data, others.data, lakes.data, pressure.data, foehn.data])

  const hasAnyData = mch.data || others.data || lakes.data || pressure.data || foehn.data
  const allLoading = mch.loading && others.loading && lakes.loading && pressure.loading && foehn.loading && !hasAnyData
  const windLoading = mch.loading && others.loading && !mch.data && !others.data

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-12">
      <div>
        <h1 className="text-2xl font-bold text-cvlt-gray-900 sm:text-3xl">Vento &amp; Meteo</h1>
        <p className="mt-0.5 text-xs text-cvlt-gray-500 sm:mt-1 sm:text-sm">
          Dati in tempo reale per il volo libero nel Sud delle Alpi.
        </p>
        <a
          href="https://vento.cvlt.ch"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-cvlt-gray-400 transition-colors hover:text-cvlt-blue sm:mt-1.5 sm:text-sm"
        >
          Versione classica: vento.cvlt.ch
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-4.5-6H18m0 0v4.5m0-4.5L10.5 13.5" />
          </svg>
        </a>
      </div>

      {allLoading && (
        <div className="mt-8 space-y-10">
          <SectionSkeleton title="Stazioni" />
        </div>
      )}

      {!allLoading && (
        <div className="mt-4 flex gap-6 sm:mt-8">
          <div className="min-w-0 flex-1 space-y-6 sm:space-y-10">
            {/* Region filter + stations */}
            <div id="stazioni">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-cvlt-gray-900">Stazioni</h2>
                <div className="flex items-center gap-2">
                  {timestamp && <span className="text-xs text-cvlt-gray-400">{timestamp}</span>}
                  <select
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className="rounded-md border border-cvlt-gray-200 bg-white px-2 py-1 text-xs text-cvlt-gray-700 shadow-sm focus:border-cvlt-blue focus:outline-none focus:ring-1 focus:ring-cvlt-blue"
                  >
                    <option value={REGION_ALL}>Tutte le regioni</option>
                    {REGION_ORDER.map((r) => (
                      <option key={r} value={r}>{REGION_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
              </div>
              {windLoading ? (
                <SectionSkeleton title="" />
              ) : (
                <div className="mt-2 space-y-5">
                  {stationsByRegion.map(({ region, label, stations }) => (
                    <div key={region}>
                      {regionFilter === REGION_ALL && (
                        <h3 className="mb-1.5 text-sm font-semibold text-cvlt-gray-500">{label}</h3>
                      )}
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
                        {stations.map((s, i) => <StationCard key={`${s.name}-${i}`} station={s} now={tick} />)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pressure */}
            <div id="pressione">
              <PressureSection
                data={pressure.data?.data ?? null}
                loading={pressure.loading}
                error={pressure.error}
                foehnData={foehn.data?.data ?? null}
                foehnLoading={foehn.loading}
                foehnError={foehn.error}
              />
            </div>

            {/* Forecast - commented out for now */}
            {/* <ForecastSection forecast={[]} /> */}

            {/* Lakes */}
            <div id="laghi">
              {lakes.loading && !lakes.data ? (
                <SectionSkeleton title="Laghi" />
              ) : lakes.error && !lakes.data ? (
                <SectionError title="Laghi" />
              ) : lakes.data ? (
                <LakesSection lakes={lakes.data.lakes} />
              ) : null}
            </div>

            {/* Radiosondaggi */}
            <section id="radiosondaggi">
              <h2 className="text-lg font-bold text-cvlt-gray-900">Radiosondaggi</h2>
              <p className="mt-2 text-sm text-cvlt-gray-600">
                I radiosondaggi di Milano e Payerne sono disponibili su MeteoSvizzera.
              </p>
              <a
                href="https://www.meteosvizzera.admin.ch/home/sistemi-di-rilevamento-e-previsione/atmosfera/radiosondaggi.html"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-cvlt-blue transition-colors hover:text-cvlt-blue-dark"
              >
                Vai a MeteoSvizzera
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-4.5-6H18m0 0v4.5m0-4.5L10.5 13.5" />
                </svg>
              </a>
            </section>
          </div>

          <Legend />
        </div>
      )}

      <MobileLegend />
    </main>
  )
}
