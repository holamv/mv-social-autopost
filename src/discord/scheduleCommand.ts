import { waitUntil } from '@vercel/functions'
import { getEnv } from '../config/env.js'
import { isScheduleStoreConfigured, loadSchedules, parseSchedule, saveSchedule, ScheduleFormatError } from '../core/schedule.js'
import type { RouteKey } from '../types.js'
import { canPublish, type InteractionMember } from './access.js'
import { editOriginalResponse } from './api.js'
import { HOURS_OPTION, NETWORK_CHOICES, NETWORK_OPTION } from './commandDefinitions.js'
import { MESSAGE_FLAG_EPHEMERAL, RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE } from './constants.js'
import { getDiscordEnv } from './env.js'
import { formatSchedules, PUBLISH_FORBIDDEN_MESSAGE } from './messages.js'

const STORE_MISSING_MESSAGE = 'Para usar horarios hace falta el almacen Redis (KV_REST_API_URL y KV_REST_API_TOKEN).'
const NETWORK_REQUIRED_MESSAGE = 'Elige la red que quieres configurar en la opcion "red".'
const SCHEDULE_ERROR_MESSAGE = 'No pude leer o guardar los horarios. Revisa los logs en Vercel.'

export interface OptionValue {
  name: string
  value: string
}

export interface ScheduleInteraction {
  token: string
  member?: InteractionMember
  data: { options?: OptionValue[] }
}

export function readOption(options: OptionValue[] | undefined, name: string): string | undefined {
  return options?.find((option) => option.name === name)?.value
}

export function toRouteKey(value: string | undefined): RouteKey | undefined {
  return NETWORK_CHOICES.some((choice) => choice.value === value) ? (value as RouteKey) : undefined
}

async function describeUpdate(interaction: ScheduleInteraction): Promise<string> {
  const routeKey = toRouteKey(readOption(interaction.data.options, NETWORK_OPTION))
  const hours = readOption(interaction.data.options, HOURS_OPTION)
  const timeZone = getEnv().SCHEDULE_TIMEZONE

  if (hours === undefined) {
    return formatSchedules(await loadSchedules(), timeZone)
  }

  if (!routeKey) {
    return NETWORK_REQUIRED_MESSAGE
  }

  if (!canPublish(interaction.member, getDiscordEnv().DISCORD_PUBLISHER_IDS)) {
    return PUBLISH_FORBIDDEN_MESSAGE
  }

  return formatSchedules(await saveSchedule(routeKey, parseSchedule(hours)), timeZone)
}

async function replyWithSchedules(interaction: ScheduleInteraction): Promise<void> {
  try {
    await editOriginalResponse(interaction.token, isScheduleStoreConfigured() ? await describeUpdate(interaction) : STORE_MISSING_MESSAGE)
  } catch (error) {
    console.error('[DiscordSchedule] Error con los horarios:', error)
    await editOriginalResponse(interaction.token, error instanceof ScheduleFormatError ? error.message : SCHEDULE_ERROR_MESSAGE)
  }
}

export function handleScheduleCommand(interaction: ScheduleInteraction): { type: number; data: { flags: number } } {
  waitUntil(replyWithSchedules(interaction))

  return { type: RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE, data: { flags: MESSAGE_FLAG_EPHEMERAL } }
}
