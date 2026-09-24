import type { ApiResponse, Channel, PublishRunSummary, RouteQueue } from '../types.js'
import { LINE_BREAK, MESSAGE_CONTENT_MAX_LENGTH, QUEUE_PREVIEW_SIZE, TRUNCATION_SUFFIX } from './constants.js'

export const UNKNOWN_COMMAND_MESSAGE = 'No conozco ese comando.'
export const PUBLISH_FORBIDDEN_MESSAGE =
  'No tienes permiso para publicar. Pide a un admin que agregue tu ID o tu rol a DISCORD_PUBLISHER_IDS.'
export const STATUS_ERROR_MESSAGE = 'No pude leer la carpeta de Drive. Revisa los logs en Vercel.'
export const PUBLISH_ERROR_MESSAGE = 'La publicacion fallo antes de empezar. Revisa los logs en Vercel.'

export function formatConfigError(variables: string[]): string {
  const names = variables.map((name) => `\`${name}\``).join(', ')

  return `Hay variables mal configuradas en Vercel: ${names}. Corrigelas en Settings → Environment Variables y redeploya.`
}

function fitToDiscord(content: string): string {
  if (content.length <= MESSAGE_CONTENT_MAX_LENGTH) {
    return content
  }

  return content.slice(0, MESSAGE_CONTENT_MAX_LENGTH - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX
}

const CHANNEL_LABELS: Record<Channel, string> = { facebook: 'Facebook', instagram: 'Instagram' }

function describeChannels(channels: Channel[]): string {
  return channels.map((channel) => CHANNEL_LABELS[channel]).join(' + ')
}

function formatQueue(queue: RouteQueue): string[] {
  const header = `**${queue.route.label}** → ${describeChannels(queue.route.channels)}: ${queue.pending.length} pendiente(s)`
  const nextImages = queue.pending.slice(0, QUEUE_PREVIEW_SIZE).map((image, index) => `  ${index + 1}. ${image.name}`)

  return [header, ...nextImages]
}

export function formatQueueStatus(queues: RouteQueue[]): string {
  if (queues.every((queue) => queue.pending.length === 0)) {
    return 'Las colas estan vacias: no hay imagenes pendientes en ninguna carpeta de Drive.'
  }

  return fitToDiscord(queues.flatMap(formatQueue).join(LINE_BREAK))
}

export function formatPublishResult(result: ApiResponse<PublishRunSummary>): string {
  if (!result.success) {
    return PUBLISH_ERROR_MESSAGE
  }

  const { published, failed, skipped, pendingCount } = result.data

  if (pendingCount === 0) {
    return 'No habia nada que publicar: la cola esta vacia.'
  }

  const lines = [
    ...published.map((image) => `✅ Publicada (${image.route}): ${image.name}`),
    ...failed.map((image) => `❌ Fallo (${image.route}): ${image.name}: ${image.error}`),
  ]

  if (skipped > 0) {
    lines.push(`⏳ ${skipped} imagen(es) quedaron para la proxima corrida por falta de tiempo.`)
  }

  return fitToDiscord(lines.join(LINE_BREAK))
}
