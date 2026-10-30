import { FACEBOOK_COPY_MIN_REMAINING_MS } from '../config/constants.js'
import type { InstagramCountry } from '../config/instagramAccounts.js'
import type { Deadline } from '../core/deadline.js'
import { storeChannelPostId } from '../drive/marking.js'
import { facebookPageFor, publishToFacebook } from '../meta/facebook.js'
import type { DriveImage } from '../types.js'

const FACEBOOK_CHANNEL = 'facebook'

export async function mirrorToFacebook(
  media: DriveImage,
  caption: string,
  country: InstagramCountry,
  deadline: Deadline,
): Promise<string | null> {
  const page = facebookPageFor(country)

  if (!page) {
    console.warn(`[Generator] Sin pagina de Facebook de ${country}: el archivo ${media.fileId} quedo solo en Instagram`)
    return null
  }

  const remainingMs = deadline.remainingMs()

  if (remainingMs < FACEBOOK_COPY_MIN_REMAINING_MS) {
    console.warn(`[Generator] Sin tiempo para copiar a Facebook de ${country} el archivo ${media.fileId}: quedo solo en Instagram`)
    return null
  }

  try {
    const postId = await publishToFacebook(media, caption, page, remainingMs)

    console.log(`[Facebook] Publicado el archivo ${media.fileId} en la pagina de ${country}: post ${postId}`)

    return postId
  } catch (error) {
    console.error(`[Generator] Instagram publico el archivo ${media.fileId} pero Facebook de ${country} fallo:`, error)
    return null
  }
}

export async function rememberFacebookPost(fileId: string, postId: string): Promise<void> {
  try {
    await storeChannelPostId(fileId, FACEBOOK_CHANNEL, postId)
  } catch (error) {
    console.error(`[Generator] Facebook publico el archivo ${fileId} (post ${postId}) pero no se guardo el id en Drive:`, error)
  }
}
