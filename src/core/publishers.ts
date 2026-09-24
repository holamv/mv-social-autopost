import type { Deadline } from './deadline.js'
import { downloadImageToMemory } from '../drive/download.js'
import { buildSignedMediaUrl } from '../lib/signedUrl.js'
import { publishToFacebook } from '../meta/facebook.js'
import { publishToInstagram } from '../meta/instagram.js'
import { publishToLinkedIn } from '../linkedin/publish.js'
import type { Channel, PendingImage } from '../types.js'

type ChannelPublisher = (image: PendingImage, deadline: Deadline) => Promise<string>

async function publishImageToFacebook(image: PendingImage): Promise<string> {
  return publishToFacebook(await downloadImageToMemory(image.id), image.caption)
}

async function publishImageToInstagram(image: PendingImage, deadline: Deadline): Promise<string> {
  return publishToInstagram(buildSignedMediaUrl(image.id), image.caption, deadline)
}

export const CHANNEL_PUBLISHERS: Record<Channel, ChannelPublisher> = {
  facebook: publishImageToFacebook,
  instagram: publishImageToInstagram,
  linkedin: publishToLinkedIn,
}
