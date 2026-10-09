import { Readable } from 'node:stream'
import { z } from 'zod'
import { getEnv } from '../config/env.js'
import { BYTES_PER_MEGABYTE, MAX_IMAGE_MEGABYTES } from '../config/constants.js'
import { createDeadline } from '../core/deadline.js'
import { publishImage } from '../core/pipeline.js'
import { resolveRoutes } from '../core/routes.js'
import { getDriveClient } from '../drive/client.js'
import { getPendingFile } from '../drive/listPending.js'
import { uploadFile } from '../drive/upload.js'
import { graphGet } from '../meta/client.js'
import type { ChannelPostIds, PublishRoute, RouteKey } from '../types.js'

const GENERATOR_CHANNELS = ['instagram', 'linkedin'] as const
const COUNTRIES = ['PE', 'MX', 'CO'] as const
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']
const SOURCE_PROPERTY = { mvSource: 'generador-de-posts' }
const FILE_EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png' }

export type GeneratorChannel = (typeof GENERATOR_CHANNELS)[number]

export const submissionSchema = z.object({
  channel: z.enum(GENERATOR_CHANNELS),
  country: z.enum(COUNTRIES).optional(),
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

function assertCountry(submission: Submission): void {
  const accountCountry = getEnv().META_INSTAGRAM_COUNTRY

  if (submission.channel === 'instagram' && submission.country && submission.country !== accountCountry) {
    throw new SubmissionError(`El autopost solo tiene conectada la cuenta de Instagram de ${accountCountry}`, 409)
  }
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

export async function submitFromGenerator(submission: Submission): Promise<SubmissionResult> {
  assertCountry(submission)
  const route = await routeFor(submission.channel)
  const extension = FILE_EXTENSIONS[submission.mimeType]
  const uploaded = await uploadFile({
    folderId: route.sourceFolderId,
    name: `generador-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
    mimeType: submission.mimeType,
    body: Readable.from(decodeMedia(submission)),
    appProperties: SOURCE_PROPERTY,
    description: submission.caption,
  })

  try {
    const pending = await getPendingFile(uploaded.id)

    if (!pending) {
      throw new SubmissionError('El archivo subido ya figuraba como publicado', 409)
    }

    const published = await publishImage(pending, route, createDeadline())

    return { fileId: uploaded.id, postIds: published.postIds }
  } catch (error) {
    await discardFile(uploaded.id)
    throw error
  }
}

export async function generatorStatus(): Promise<Record<string, unknown>> {
  const env = getEnv()
  const routes = await resolveRoutes()
  const channelState = (channel: GeneratorChannel) => {
    const route = routes.find((candidate) => candidate.key === (channel as RouteKey))
    return { enabled: Boolean(route && !route.disabledReason), reason: route ? route.disabledReason : 'falta la carpeta' }
  }
  const account = await graphGet<{ username?: string }>(env.META_INSTAGRAM_USER_ID, 'username').catch(() => ({ username: '' }))

  return {
    instagram: { ...channelState('instagram'), country: env.META_INSTAGRAM_COUNTRY, username: account.username || null },
    linkedin: channelState('linkedin'),
  }
}
