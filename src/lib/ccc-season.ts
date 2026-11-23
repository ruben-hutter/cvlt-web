/**
 * CCC (Cross Country Cup) season boundaries.
 *
 * A season runs from 1 October to 30 September of the following year, like the
 * "CCC CVLT" leaderboard on XContest. From October onwards we are already in
 * the season that started that year; from January to September in the one that
 * started the previous year.
 */

/** Month the season starts in (1 = January … 12 = December). */
export const CCC_SEASON_START_MONTH = 10

export interface CccSeason {
  /** Year the season starts in (1 October). */
  startYear: number
  /** Year the season ends in (30 September). */
  endYear: number
}

/**
 * Season containing `date`. Uses the visitor's local date (`new Date()` in the
 * browser), so the season rolls over at local midnight on 1 October.
 */
export function getCccSeason(date: Date = new Date()): CccSeason {
  const startYear =
    date.getMonth() + 1 >= CCC_SEASON_START_MONTH ? date.getFullYear() : date.getFullYear() - 1
  return { startYear, endYear: startYear + 1 }
}

/** Italian label for the season period, e.g. "Dal 1° ottobre 2026 al 30 settembre 2027". */
export function formatCccSeasonPeriod(season: CccSeason): string {
  return `Dal 1° ottobre ${season.startYear} al 30 settembre ${season.endYear}`
}
