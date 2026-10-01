import { sendChannelMessage } from '../discord/botApi.js'
import { fetchRequestStatus, isTerminalStatus } from './client.js'
import { STATUS_COMPLETED } from './constants.js'
import { DeliveryError, deliverVideo } from './deliver.js'
import { claimJob, finishJob, loadJob, releaseJob, type GenerationJob } from './jobs.js'
import { formatDelivered, formatDeliveryFailure, formatRejected } from './messages.js'

const MISSING_VIDEO_REASON = 'Higgsfield marco el pedido como completo pero no devolvio el video'
const UNEXPECTED_REASON = 'error inesperado, revisa los logs en Vercel'

async function notify(job: GenerationJob, content: string): Promise<void> {
  try {
    await sendChannelMessage(job.channelId, { content, components: [] })
  } catch (error) {
    console.error(`[Higgsfield] No pude avisar en Discord del pedido ${job.requestId}:`, error)
  }
}

async function settle(job: GenerationJob): Promise<boolean> {
  const status = await fetchRequestStatus(job.requestId)

  if (!isTerminalStatus(status.status)) {
    return false
  }

  if (status.status !== STATUS_COMPLETED) {
    await notify(job, formatRejected(job, status.status, status.error))
    return true
  }

  if (!status.video) {
    await notify(job, formatDeliveryFailure(job, MISSING_VIDEO_REASON))
    return true
  }

  await notify(job, formatDelivered(job, await deliverVideo(job, status.video.url)))
  return true
}

async function settleSafely(job: GenerationJob): Promise<void> {
  try {
    if (await settle(job)) {
      await finishJob(job.requestId)
    }
  } catch (error) {
    console.error(`[Higgsfield] Error procesando el pedido ${job.requestId}:`, error)
    await notify(job, formatDeliveryFailure(job, error instanceof DeliveryError ? error.message : UNEXPECTED_REASON))
  }
}

export async function processResult(requestId: string): Promise<void> {
  const job = await loadJob(requestId)

  if (!job) {
    console.warn(`[Higgsfield] Aviso de un pedido desconocido o ya entregado: ${requestId}`)
    return
  }

  if (!(await claimJob(requestId))) {
    console.log(`[Higgsfield] El pedido ${requestId} ya se esta procesando`)
    return
  }

  try {
    await settleSafely(job)
  } finally {
    await releaseJob(requestId)
  }
}
