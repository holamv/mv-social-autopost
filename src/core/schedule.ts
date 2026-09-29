import { getEnv } from '../config/env.js'
import { DECIMAL_RADIX } from '../config/constants.js'
import { kvGet, kvSet } from '../lib/kv.js'
import type { RouteKey } from '../types.js'

const SCHEDULES_KEY = 'schedules'
const HOUR_SEPARATOR = ','
const HOUR_PATTERN = /^\d{1,2}$/
const FIRST_HOUR = 0
const LAST_HOUR = 23
const HOUR_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = { hour: 'numeric', hourCycle: 'h23' }

export const ALWAYS_KEYWORD = 'siempre'
export const PAUSED_KEYWORD = 'pausa'
export const PAUSED = 'paused'

export type RouteSchedule = number[] | typeof PAUSED
export type Schedules = Partial<Record<RouteKey, RouteSchedule>>

export class ScheduleFormatError extends Error {
  constructor(input: string) {
    super(`No entiendo "${input}". Usa horas de 0 a 23 separadas por coma (ej: 9,13,19), "${ALWAYS_KEYWORD}" o "${PAUSED_KEYWORD}".`)
    this.name = 'ScheduleFormatError'
  }
}

export function isScheduleStoreConfigured(): boolean {
  const env = getEnv()

  return Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN)
}

export function parseSchedule(input: string): RouteSchedule | null {
  const normalized = input.trim().toLowerCase()

  if (normalized === ALWAYS_KEYWORD) {
    return null
  }

  if (normalized === PAUSED_KEYWORD) {
    return PAUSED
  }

  const parts = normalized.split(HOUR_SEPARATOR).map((part) => part.trim())
  const hours = parts.map((part) => Number.parseInt(part, DECIMAL_RADIX))
  const valid = parts.every((part) => HOUR_PATTERN.test(part)) && hours.every((hour) => hour >= FIRST_HOUR && hour <= LAST_HOUR)

  if (!valid || hours.length === 0) {
    throw new ScheduleFormatError(input)
  }

  return [...new Set(hours)].sort((left, right) => left - right)
}

export async function loadSchedules(): Promise<Schedules> {
  if (!isScheduleStoreConfigured()) {
    return {}
  }

  const raw = await kvGet(SCHEDULES_KEY)

  return raw ? (JSON.parse(raw) as Schedules) : {}
}

export async function saveSchedule(key: RouteKey, schedule: RouteSchedule | null): Promise<Schedules> {
  const schedules = await loadSchedules()

  if (schedule === null) {
    delete schedules[key]
  } else {
    schedules[key] = schedule
  }

  await kvSet(SCHEDULES_KEY, JSON.stringify(schedules))

  return schedules
}

export function currentLocalHour(now: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', { ...HOUR_FORMAT_OPTIONS, timeZone: getEnv().SCHEDULE_TIMEZONE })

  return Number.parseInt(formatter.format(now), DECIMAL_RADIX)
}

export function isDue(schedule: RouteSchedule | undefined, localHour: number): boolean {
  if (!schedule) {
    return true
  }

  return schedule !== PAUSED && schedule.includes(localHour)
}
