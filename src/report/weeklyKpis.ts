import { getEnv } from '../config/env.js'
import { HTTP_METHOD_GET } from '../config/constants.js'

const WEEKLY_EVOLUTION_PATH = '/api/dris/weekly-evolution'
const WEEKS_PARAM = 'weeks'
const API_KEY_HEADER = 'x-api-key'

export interface ReportWeek {
  period: string
  monday: string
  sunday: string
}

export interface WeeklyValue {
  period: string
  value: number | null
}

export interface WeeklyKpi {
  id: number
  nombre: string
  weekly: WeeklyValue[]
}

export interface WeeklyEvolution {
  weeks: ReportWeek[]
  kpis: WeeklyKpi[]
}

export function weeklyReportDisabledReason(): string | null {
  const env = getEnv()
  const required: [string, unknown][] = [
    ['DATALAKE_API_TOKEN', env.DATALAKE_API_TOKEN],
    ['DISCORD_BOT_TOKEN', env.DISCORD_BOT_TOKEN],
    ['DISCORD_REPORT_CHANNEL_ID', env.DISCORD_REPORT_CHANNEL_ID],
  ]
  const missing = required.filter(([, value]) => !value).map(([name]) => name)

  return missing.length > 0 ? `falta ${missing.join(', ')}` : null
}

export async function fetchWeeklyEvolution(weeks: number): Promise<WeeklyEvolution> {
  const env = getEnv()
  const url = new URL(WEEKLY_EVOLUTION_PATH, env.DATALAKE_BASE_URL)

  url.searchParams.set(WEEKS_PARAM, String(weeks))

  const response = await fetch(url, {
    method: HTTP_METHOD_GET,
    headers: { [API_KEY_HEADER]: env.DATALAKE_API_TOKEN ?? '' },
  })

  if (!response.ok) {
    throw new Error(`El data lake respondio ${response.status}: ${(await response.text()).slice(0, 200)}`)
  }

  return (await response.json()) as WeeklyEvolution
}
