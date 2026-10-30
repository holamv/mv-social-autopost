import { Readable } from 'node:stream'
import { z } from 'zod'
import { getEnv } from '../config/env.js'
import { BYTES_PER_MEGABYTE, INSTAGRAM_COUNTRY_KEY, MAX_IMAGE_MEGABYTES } from '../config/constants.js'
import { INSTAGRAM_COUNTRIES, type InstagramCountry } from '../config/instagramAccounts.js'
import { createDeadline, type Deadline } from '../core/deadline.js'
import { publishImage } from '../core/pipeline.js'
import { resolveRoutes } from '../core/routes.js'
import { getDriveClient } from '../drive/client.js'
import { getPendingFile } from '../drive/listPending.js'
import { uploadFile } from '../drive/upload.js'
import { fetchInstagramUsername, instagramAccountFor } from '../meta/instagram.js'
import { mirrorToFacebook, rememberFacebookPost } from './facebookMirror.js'
import { publishThenCopy } from './publishFlow.js'
import type { ChannelPostIds, PublishRoute, PublishedImage, RouteKey } from '../types.js'

const GENERATOR_CHANNELS = ['instagram', 'linkedin'] as const
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']
const SOURCE_PROPERTY = { mvSource: 'generador-de-posts' }
const FILE_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' }

export type GeneratorChannel = (typeof GENERATOR_CHANNELS)[number]

export const submissionSchema = z.object({
  channel: z.enum(GENERATOR_CHANNELS),
  country: z.enum(INSTAGRAM_COUNTRIES).optional(),
  caption: z.string().trim().min(1),
  mimeType: z.string().refine((value) => ALLOWED_MIME_TYPES.includes(value), 'solo JPG o PNG'),
  dataBase64: z.string().min(1),
})

export type Submission = z.infer<typeof submissionSchema>

export class SubmissionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'SubmissionError'
  }
}

export interface SubmissionResult {
  fileId: string
  postIds: ChannelPostIds
}

export interface InstagramAccountState {
  connected: boolean
  username: string | null
}

interface ChannelState {
  enabled: boolean
  reason: string | null
}

export interface GeneratorStatus {
  instagram: ChannelState & {
    country: InstagramCountry
    username: string | null
    accounts: Record<InstagramCountry, InstagramAccountState>
  }
  linkedin: ChannelState
}

async function routeFor(channel: GeneratorChannel): Promise<PublishRoute> {
  const route = (await resolveRoutes()).find((candidate) => candidate.key === (channel as RouteKey))

  if (!route) {
    throw new SubmissionError(`Falta la carpeta ${channel} en el Drive del autopost`, 409)
  }

  if (route.disabledReason) {
    throw new SubmissionError(`${channel} esta apagado en el autopost: ${route.disabledReason}`, 409)
  }

  return route
}

function instagramCountryFor(submission: Submission): InstagramCountry | null {
  if (submission.channel !== 'instagram') {
    return null
  }

  const country = submission.country ?? getEnv().META_INSTAGRAM_COUNTRY

  if (!instagramAccountFor(country)) {
    console.warn(`[Generator] Rechazado: no hay cuenta de Instagram de ${country}, no se subio nada a Drive`)
    throw new SubmissionError(`El autopost aun no tiene conectada la cuenta de Instagram de ${country}`, 409)
  }

  return country
}

export function sourceProperties(country: InstagramCountry | null): Record<string, string> {
  return country ? { ...SOURCE_PROPERTY, [INSTAGRAM_COUNTRY_KEY]: country } : SOURCE_PROPERTY
}

function decodeMedia(submission: Submission): Buffer {
  const buffer = Buffer.from(submission.dataBase64, 'base64')

  if (buffer.length === 0 || buffer.length > MAX_IMAGE_MEGABYTES * BYTES_PER_MEGABYTE) {
    throw new SubmissionError('La imagen esta vacia o es demasiado pesada', 400)
  }

  return buffer
}

async function discardFile(fileId: string): Promise<void> {
  try {
    await getDriveClient().files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true })
  } catch (error) {
    console.error(`[Generator] No se pudo mandar a la papelera ${fileId}:`, error)
  }
}

function generatorFileName(mimeType: string): string {
  return `generador-${new Date().toISOString().replace(/[:.]/g, '-')}.${FILE_EXTENSIONS[mimeType]}`
}

export interface UploadedSubmission {
  fileId: string
  name: string
  media: Buffer
  submission: Submission
  country: InstagramCountry | null
  deadline: Deadline
}

async function publishUploaded({ fileId, deadline }: UploadedSubmission, route: PublishRoute): Promise<PublishedImage> {
  const pending = await getPendingFile(fileId)

  if (!pending) {
    throw new SubmissionError('El archivo subido ya figuraba como publicado', 409)
  }

  return publishImage(pending, route, deadline)
}

async function discardAfterFailure({ fileId, submission, country }: UploadedSubmission, error: unknown): Promise<void> {
  console.error(`[Generator] No se pudo publicar el archivo ${fileId} en ${submission.channel} ${country ?? ''}:`, error)
  await discardFile(fileId)
}

export async function copyToFacebook({ fileId, name, media, submission, country, deadline }: UploadedSubmission): Promise<ChannelPostIds> {
  if (!country) {
    return {}
  }

  const image = { fileId, name, mimeType: submission.mimeType, sizeBytes: media.length, buffer: media }
  const postId = await mirrorToFacebook(image, submission.caption, country, deadline)

  if (!postId) {
    return {}
  }

  await rememberFacebookPost(fileId, postId)

  return { facebook: postId }
}

export async function submitFromGenerator(submission: Submission): Promise<SubmissionResult> {
  const deadline = createDeadline()
  const country = instagramCountryFor(submission)
  const route = await routeFor(submission.channel)
  const media = decodeMedia(submission)
  const name = generatorFileName(submission.mimeType)
  const uploaded = await uploadFile({
    folderId: route.sourceFolderId,
    name,
    mimeType: submission.mimeType,
    body: Readable.from(media),
    appProperties: sourceProperties(country),
    description: submission.caption,
  })

  const target = { fileId: uploaded.id, name, media, submission, country, deadline }
  const postIds = await publishThenCopy({
    fileId: uploaded.id,
    publish: () => publishUploaded(target, route),
    discard: (error) => discardAfterFailure(target, error),
    copy: () => copyToFacebook(target),
  })

  return { fileId: uploaded.id, postIds }
}

async function instagramAccountState(country: InstagramCountry): Promise<InstagramAccountState> {
  const account = instagramAccountFor(country)

  if (!account) {
    return { connected: false, username: null }
  }

  try {
    return { connected: true, username: await fetchInstagramUsername(account) }
  } catch (error) {
    console.warn(`[Generator] Meta no devolvio el usuario de Instagram de ${country}:`, error)
    return { connected: true, username: null }
  }
}

async function instagramAccountStates(): Promise<Record<InstagramCountry, InstagramAccountState>> {
  const states = await Promise.all(INSTAGRAM_COUNTRIES.map(async (country) => [country, await instagramAccountState(country)] as const))

  return Object.fromEntries(states) as Record<InstagramCountry, InstagramAccountState>
}

export async function generatorStatus(): Promise<GeneratorStatus> {
  const env = getEnv()
  const routes = await resolveRoutes()
  const channelState = (channel: GeneratorChannel) => {
    const route = routes.find((candidate) => candidate.key === (channel as RouteKey))
    return { enabled: Boolean(route && !route.disabledReason), reason: route ? route.disabledReason : 'falta la carpeta' }
  }
  const accounts = await instagramAccountStates()

  return {
    instagram: {
      ...channelState('instagram'),
      country: env.META_INSTAGRAM_COUNTRY,
      username: accounts[env.META_INSTAGRAM_COUNTRY].username,
      accounts,
    },
    linkedin: channelState('linkedin'),
  }
}
