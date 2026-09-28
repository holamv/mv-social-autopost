import { getEnv } from '../config/env.js'
import { BYTES_PER_MEGABYTE, MAX_VIDEO_MEGABYTES, REAL_NEWLINE } from '../config/constants.js'
import { downloadStream } from '../drive/download.js'
import type { PendingImage } from '../types.js'
import { getYouTubeClient } from './auth.js'

const TITLE_MAX_LENGTH = 100
const DESCRIPTION_MAX_LENGTH = 5000
const SHORTS_HASHTAG = '#Shorts'
const DEFAULT_TITLE = 'Manzana Verde'
const FILE_EXTENSION = /\.[^.]+$/
const TITLE_FORBIDDEN_CHARACTERS = /[<>]/g
const UPLOAD_PARTS = ['snippet', 'status']

export class YouTubeUploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'YouTubeUploadError'
  }
}

export function buildTitle(file: PendingImage): string {
  const firstLine = file.caption.split(REAL_NEWLINE)[0]?.trim() ?? ''
  const base = firstLine || file.name.replace(FILE_EXTENSION, '')

  return base.replace(TITLE_FORBIDDEN_CHARACTERS, '').slice(0, TITLE_MAX_LENGTH).trim() || DEFAULT_TITLE
}

export function buildDescription(file: PendingImage): string {
  const caption = file.caption.trim()
  const withHashtag = caption.toLowerCase().includes(SHORTS_HASHTAG.toLowerCase())
    ? caption
    : [caption, SHORTS_HASHTAG].filter(Boolean).join(`${REAL_NEWLINE}${REAL_NEWLINE}`)

  return withHashtag.slice(0, DESCRIPTION_MAX_LENGTH)
}

function assertUploadable(file: PendingImage): void {
  const megabytes = file.sizeBytes / BYTES_PER_MEGABYTE

  if (megabytes > MAX_VIDEO_MEGABYTES) {
    throw new YouTubeUploadError(`${file.name} pesa ${megabytes.toFixed(1)} MB y el limite es ${MAX_VIDEO_MEGABYTES} MB`)
  }
}

export async function publishToYouTube(file: PendingImage): Promise<string> {
  assertUploadable(file)

  const env = getEnv()
  const youtube = await getYouTubeClient()
  const response = await youtube.videos.insert({
    part: UPLOAD_PARTS,
    notifySubscribers: true,
    requestBody: {
      snippet: { title: buildTitle(file), description: buildDescription(file), categoryId: env.YOUTUBE_CATEGORY_ID },
      status: { privacyStatus: env.YOUTUBE_PRIVACY, selfDeclaredMadeForKids: false },
    },
    media: { mimeType: file.mimeType, body: await downloadStream(file.id) },
  })

  if (!response.data.id) {
    throw new YouTubeUploadError(`YouTube no devolvio el ID del video ${file.name}`)
  }

  return response.data.id
}
