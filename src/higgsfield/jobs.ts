import { z } from 'zod'
import { kvDelete, kvGet, kvSetIfAbsent, kvSetWithExpiry } from '../lib/kv.js'
import { JOB_KEY_PREFIX, JOB_TTL_SECONDS, LOCK_KEY_PREFIX, LOCK_TTL_SECONDS, LOCK_VALUE } from './constants.js'

const VIDEO_ROUTE_KEYS = ['linkedin', 'tiktok', 'youtube'] as const

export const videoRouteKeySchema = z.enum(VIDEO_ROUTE_KEYS)

export type VideoRouteKey = z.infer<typeof videoRouteKeySchema>

const generationJobSchema = z.object({
  requestId: z.string().uuid(),
  routeKey: videoRouteKeySchema,
  prompt: z.string(),
  channelId: z.string(),
  requestedBy: z.string(),
  createdAt: z.string(),
})

export type GenerationJob = z.infer<typeof generationJobSchema>

export async function saveJob(job: GenerationJob): Promise<void> {
  await kvSetWithExpiry(`${JOB_KEY_PREFIX}${job.requestId}`, JSON.stringify(job), JOB_TTL_SECONDS)
}

export async function loadJob(requestId: string): Promise<GenerationJob | null> {
  const raw = await kvGet(`${JOB_KEY_PREFIX}${requestId}`)

  if (!raw) {
    return null
  }

  const parsed = generationJobSchema.safeParse(JSON.parse(raw))

  return parsed.success ? parsed.data : null
}

export async function finishJob(requestId: string): Promise<void> {
  await kvDelete(`${JOB_KEY_PREFIX}${requestId}`)
}

export async function claimJob(requestId: string): Promise<boolean> {
  return kvSetIfAbsent(`${LOCK_KEY_PREFIX}${requestId}`, LOCK_VALUE, LOCK_TTL_SECONDS)
}

export async function releaseJob(requestId: string): Promise<void> {
  await kvDelete(`${LOCK_KEY_PREFIX}${requestId}`)
}
