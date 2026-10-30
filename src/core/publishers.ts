import type { Deadline } from './deadline.js'
import { downloadImageToMemory } from '../drive/download.js'
import { buildSignedMediaUrl } from '../lib/signedUrl.js'
import { publishToFacebook, requireFacebookPage } from '../meta/facebook.js'
import { publishToInstagram, requireInstagramAccount } from '../meta/instagram.js'
import { publishToLinkedIn } from '../linkedin/publish.js'
import { publishToYouTube } from '../youtube/publish.js'
import type { Channel, PendingImage } from '../types.js'

type ChannelPublisher = (image: PendingImage, deadline: Deadline) => Promise<string>

async function publishImageToFacebook(image: PendingImage): Promise<string> {
  const page = requireFacebookPage(image.id, image.storedInstagramCountry)
  const postId = await publishToFacebook(await downloadImageToMemory(image.id), image.caption, page)

  console.log(`[Facebook] Publicado el archivo ${image.id} en la pagina de ${page.country}: post ${postId}`)

  return postId
}

async function publishImageToInstagram(image: PendingImage, deadline: Deadline): Promise<string> {
  const account = requireInstagramAccount(image.id, image.storedInstagramCountry)
  const mediaId = await publishToInstagram(buildSignedMediaUrl(image.id), image.caption, deadline, account)

  console.log(`[Instagram] Publicado el archivo ${image.id} en la cuenta de ${account.country}: media ${mediaId}`)

  return mediaId
}

async function rejectUnapprovedTikTok(): Promise<string> {
  throw new Error('TikTok solo publica con aprobacion desde Discord')
}

export const CHANNEL_PUBLISHERS: Record<Channel, ChannelPublisher> = {
  facebook: publishImageToFacebook,
  instagram: publishImageToInstagram,
  linkedin: publishToLinkedIn,
  tiktok: rejectUnapprovedTikTok,
  youtube: publishToYouTube,
}
