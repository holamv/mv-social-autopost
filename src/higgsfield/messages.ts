import { LINE_BREAK } from '../discord/constants.js'
import type { UploadedFile } from '../drive/upload.js'
import { VIDEO_ROUTE_FOLDERS } from './deliver.js'
import type { GenerationJob } from './jobs.js'

export const GENERATE_MISSING_CONFIG_MESSAGE =
  'Para generar videos hacen falta HF_API_KEY_ID, HF_API_KEY_SECRET, DISCORD_BOT_TOKEN y el almacen Redis (KV_REST_API_URL y KV_REST_API_TOKEN).'
export const GENERATE_ERROR_MESSAGE = 'Higgsfield no acepto el pedido. Revisa los logs en Vercel.'
export const PROMPT_REQUIRED_MESSAGE = 'Escribe en la opcion "prompt" que video quieres.'
export const CHANNEL_REQUIRED_MESSAGE = 'Usa este comando dentro de un canal del servidor, no por mensaje directo.'

const FAILURE_REASONS: Record<string, string> = {
  failed: 'Higgsfield no pudo generarlo',
  nsfw: 'Higgsfield lo bloqueo por contenido sensible',
  canceled: 'el pedido se cancelo',
}

function folderOf(job: GenerationJob): string {
  return VIDEO_ROUTE_FOLDERS[job.routeKey]
}

export function formatSubmitted(job: GenerationJob): string {
  return [
    `🎬 Pedido enviado a Higgsfield para **${folderOf(job)}/** (\`${job.requestId}\`).`,
    'Tarda unos minutos. Aviso en este canal cuando el video este en Drive.',
  ].join(LINE_BREAK)
}

export function formatDelivered(job: GenerationJob, file: UploadedFile): string {
  return [
    `✅ <@${job.requestedBy}> tu video ya esta en **${folderOf(job)}/**: ${file.webViewLink}`,
    'Agrega el texto del post en la descripcion del archivo en Drive antes de que salga en la cola.',
  ].join(LINE_BREAK)
}

export function formatRejected(job: GenerationJob, status: string, error: string | null | undefined): string {
  const reason = FAILURE_REASONS[status] ?? `quedo en estado ${status}`
  const detail = error ? ` (${error})` : ''

  return `❌ <@${job.requestedBy}> el video para **${folderOf(job)}/** no salio: ${reason}${detail}. Pedido \`${job.requestId}\`.`
}

export function formatDeliveryFailure(job: GenerationJob, reason: string): string {
  return `⚠️ <@${job.requestedBy}> Higgsfield genero el video pero no pude dejarlo en **${folderOf(job)}/**: ${reason}. Pedido \`${job.requestId}\`.`
}
