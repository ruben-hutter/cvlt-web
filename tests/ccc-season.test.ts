import { describe, expect, it } from 'vitest'
import { formatCccSeasonPeriod, getCccSeason } from '../src/lib/ccc-season'

// Local-time dates, like `new Date()` in the browser: the season follows the
// visitor's local date, not UTC. Noon avoids edge-of-day effects.
function local(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12)
}

describe('getCccSeason', () => {
  it('from January to September belongs to the season that started the previous year', () => {
    expect(getCccSeason(local(2027, 1, 1))).toEqual({ startYear: 2026, endYear: 2027 })
    expect(getCccSeason(local(2026, 5, 15))).toEqual({ startYear: 2025, endYear: 2026 })
  })

  it('from October onwards belongs to the season starting that year', () => {
    expect(getCccSeason(local(2026, 10, 1))).toEqual({ startYear: 2026, endYear: 2027 })
    expect(getCccSeason(local(2026, 12, 31))).toEqual({ startYear: 2026, endYear: 2027 })
  })

  it('30 September closes a season and 1 October opens the next one', () => {
    expect(getCccSeason(local(2026, 9, 30))).toEqual({ startYear: 2025, endYear: 2026 })
    expect(getCccSeason(local(2026, 10, 1))).toEqual({ startYear: 2026, endYear: 2027 })
  })
})

describe('formatCccSeasonPeriod', () => {
  it('labels start and end of the season', () => {
    expect(formatCccSeasonPeriod({ startYear: 2026, endYear: 2027 })).toBe(
      'Dal 1° ottobre 2026 al 30 settembre 2027',
    )
  })
})
