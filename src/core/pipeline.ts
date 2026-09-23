import { getEnv } from '../config/env'
import type { Deadline } from './deadline'
import { downloadImageToMemory } from '../drive/download'
import { listPendingImages } from '../drive/listPending'
import { claimImage, markAsPublished, releaseImage, storeFacebookPostId } from '../drive/marking'
import { buildSignedMediaUrl } from '../lib/signedUrl'
import { publishToFacebook } from '../meta/facebook'
import { publishToInstagram } from '../meta/instagram'
import type { ApiResponse, FailedImage, PendingImage, PublishRunSummary, PublishedImage } from '../types'

const RUN_ERROR_MESSAGE = 'No se pudo completar la publicacion programada'

interface BatchOutcome {
  published: PublishedImage[]
  failed: FailedImage[]
  skipped: number
}

async function publishImage(image: PendingImage, deadline: Deadline): Promise<PublishedImage> {
  await claimImage(image.id)

  let facebookPostId = image.facebookPostId

  if (!facebookPostId) {
    const binary = await downloadImageToMemory(image.id)

    facebookPostId = await publishToFacebook(binary, image.caption)
    await storeFacebookPostId(image.id, facebookPostId)
  }

  const instagramMediaId = await publishToInstagram(buildSignedMediaUrl(image.id), image.caption, deadline)

  await markAsPublished(image.id, facebookPostId, instagramMediaId)

  return { fileId: image.id, name: image.name, facebookPostId, instagramMediaId }
}

async function publishBatch(batch: PendingImage[], deadline: Deadline): Promise<BatchOutcome> {
  const published: PublishedImage[] = []
  const failed: FailedImage[] = []
  let skipped = 0

  for (const image of batch) {
    if (deadline.isExpired()) {
      skipped += 1
      continue
    }

    try {
      published.push(await publishImage(image, deadline))
    } catch (error) {
      console.error(`[Pipeline] Error publicando ${image.name}:`, error)
      failed.push({ fileId: image.id, name: image.name, error: String(error) })
      await releaseImage(image.id)
    }
  }

  return { published, failed, skipped }
}

export async function runPublishCycle(deadline: Deadline): Promise<ApiResponse<PublishRunSummary>> {
  try {
    const pending = await listPendingImages()
    const outcome = await publishBatch(pending.slice(0, getEnv().BATCH_SIZE), deadline)

    return { success: true, data: { pendingCount: pending.length, ...outcome } }
  } catch (error) {
    console.error('[Pipeline] Error en el ciclo de publicacion:', error)

    return {
      success: false,
      data: { pendingCount: 0, published: [], failed: [], skipped: 0 },
      error: RUN_ERROR_MESSAGE,
    }
  }
}
