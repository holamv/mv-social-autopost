import { createDeadline } from '../core/deadline.js'
import { resolveRoutes } from '../core/routes.js'
import { getPendingFile, isLocked } from '../drive/listPending.js'
import { claimImage, markAsPublished, releaseImage, storeChannelPostId } from '../drive/marking.js'
import { editOriginalResponse } from '../discord/api.js'
import type { MessageComponent } from '../discord/components.js'
import type { PublishRoute } from '../types.js'
import { PRIVACY_LABELS, TIKTOK_ROUTE_LABEL } from './constants.js'
import { publishTikTokVideo, type TikTokPublishResult } from './publish.js'

export interface ApprovalRequest {
  fileId: string
  privacy: string
  interactionToken: string
  approvedBy: string
  components: MessageComponent[]
}

async function findTikTokRoute(): Promise<PublishRoute> {
  const route = (await resolveRoutes()).find((candidate) => candidate.label === TIKTOK_ROUTE_LABEL)

  if (!route) {
    throw new Error('No se encontro la carpeta TikTok en Drive')
  }

  return route
}

function describeSuccess(name: string, request: ApprovalRequest, result: TikTokPublishResult): string {
  const audience = PRIVACY_LABELS[request.privacy] ?? request.privacy

  if (!result.completed) {
    return `⏳ **${name}** subido por <@${request.approvedBy}> (visible para: ${audience}). TikTok lo esta procesando y aparecera en la cuenta en unos minutos.`
  }

  return `✅ **${name}** publicado en TikTok por <@${request.approvedBy}> (visible para: ${audience}).`
}

async function publishClaimed(request: ApprovalRequest): Promise<string> {
  const file = await getPendingFile(request.fileId)

  if (!file) {
    return 'Este video ya estaba publicado.'
  }

  if (isLocked(file, Date.now())) {
    return 'Este video ya se esta publicando.'
  }

  await claimImage(file.id)

  const result = await publishTikTokVideo(file, request.privacy, createDeadline())

  await storeChannelPostId(file.id, 'tiktok', result.publishId)
  await markAsPublished(file.id, await findTikTokRoute())

  return describeSuccess(file.name, request, result)
}

export async function publishApproved(request: ApprovalRequest): Promise<void> {
  try {
    const content = await publishClaimed(request)

    await editOriginalResponse(request.interactionToken, { content, components: [] })
  } catch (error) {
    console.error(`[TikTokApproval] Error publicando ${request.fileId}:`, error)
    await releaseImage(request.fileId).catch((releaseError: unknown) => {
      console.error(`[TikTokApproval] Error liberando ${request.fileId}:`, releaseError)
    })
    await editOriginalResponse(request.interactionToken, {
      content: `❌ No se pudo publicar en TikTok: ${String(error)}\nPuedes volver a intentarlo con el boton.`,
      components: request.components,
    })
  }
}
