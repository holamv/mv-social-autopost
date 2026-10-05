import type { ReportWeek, WeeklyEvolution, WeeklyKpi } from './weeklyKpis.js'

export const CONTENT_BASELINE_PIECES = 12
const BASELINE_SOURCE = 'exp-2026-058'
const PIECES_KPI_ID = 693
const PER_PIECE_KPIS = [
  { id: 695, label: 'Interacciones por pieza' },
  { id: 700, label: 'Vistas de video por pieza' },
  { id: 694, label: 'Alcance por pieza' },
  { id: 701, label: 'Tasa de interacción sobre alcance', suffix: '%' },
] as const
const FOLLOWERS_KPI_ID = 702
const HISTORY_WEEKS = 4
const PERCENT = 100
const LOCALE = 'es-PE'
const MAX_DECIMALS = 2
const NO_DATA = 'sin dato'
const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', timeZone: 'UTC' }

function formatNumber(value: number): string {
  return value.toLocaleString(LOCALE, { maximumFractionDigits: MAX_DECIMALS })
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(LOCALE, DATE_FORMAT)
}

function shortWeek(period: string): string {
  return period.slice(period.indexOf('W'))
}

function valueFor(kpi: WeeklyKpi | undefined, period: string): number | null {
  return kpi?.weekly.find((entry) => entry.period === period)?.value ?? null
}

function changeAgainst(current: number, reference: number | null): string {
  if (reference === null || reference === 0) {
    return NO_DATA
  }

  const change = Math.round(((current - reference) / reference) * PERCENT)

  return `${change >= 0 ? '+' : ''}${change}%`
}

export function lastClosedWeek(weeks: ReportWeek[], today: string): ReportWeek | null {
  const closed = weeks.filter((week) => week.sunday < today)

  return closed.at(-1) ?? null
}

function piecesLine(pieces: WeeklyKpi | undefined, week: ReportWeek, previous: ReportWeek | undefined): string {
  const value = valueFor(pieces, week.period)

  if (value === null) {
    return `**Piezas publicadas (#${PIECES_KPI_ID}):** ${NO_DATA}`
  }

  const previousValue = previous ? valueFor(pieces, previous.period) : null
  const versusPrevious = previous ? ` · vs ${shortWeek(previous.period)}: ${changeAgainst(value, previousValue)}` : ''

  return `**Piezas publicadas (#${PIECES_KPI_ID}): ${formatNumber(value)}**${versusPrevious} · vs baseline ${CONTENT_BASELINE_PIECES} (${BASELINE_SOURCE}): ${changeAgainst(value, CONTENT_BASELINE_PIECES)}`
}

function perPieceLines(byId: Map<number, WeeklyKpi>, period: string): string[] {
  return PER_PIECE_KPIS.map(({ id, label, ...rest }) => {
    const value = valueFor(byId.get(id), period)
    const suffix = 'suffix' in rest ? rest.suffix : ''

    return `${label} (#${id}): ${value === null ? NO_DATA : `${formatNumber(value)}${suffix}`}`
  })
}

function historyLine(pieces: WeeklyKpi | undefined, weeks: ReportWeek[]): string {
  const entries = weeks.map((week) => `${shortWeek(week.period)} ${valueFor(pieces, week.period) ?? '—'}`)

  return `Piezas, últimas ${weeks.length} semanas: ${entries.join(' · ')}`
}

export function buildContentReport(evolution: WeeklyEvolution, today: string): string | null {
  const week = lastClosedWeek(evolution.weeks, today)

  if (!week) {
    return null
  }

  const byId = new Map(evolution.kpis.map((kpi) => [kpi.id, kpi]))
  const pieces = byId.get(PIECES_KPI_ID)
  const closedWeeks = evolution.weeks.filter((entry) => entry.sunday <= week.sunday).slice(-HISTORY_WEEKS)
  const previous = closedWeeks.at(-2)
  const followers = valueFor(byId.get(FOLLOWERS_KPI_ID), week.period)

  return [
    `📊 **Contenido orgánico · ${shortWeek(week.period)} (${formatDate(week.monday)}–${formatDate(week.sunday)})**`,
    '',
    piecesLine(pieces, week, previous),
    ...perPieceLines(byId, week.period),
    `Seguidores netos (#${FOLLOWERS_KPI_ID}): ${followers === null ? NO_DATA : formatNumber(followers)}`,
    '',
    historyLine(pieces, closedWeeks),
    `_Las métricas por pieza se miden a 7 días de publicada cada pieza: las de ${shortWeek(week.period)} quedan definitivas el domingo._`,
  ].join('\n')
}
