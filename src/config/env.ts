import { z } from 'zod'
import { DEFAULT_BATCH_SIZE } from './constants.js'
import { isReadablePrivateKey, normalizePrivateKey } from './privateKey.js'

const MARK_STRATEGIES = ['properties', 'move'] as const
const DRIVE_ID_PATTERN = /^[A-Za-z0-9_-]+$/
const DRIVE_ID_MESSAGE = 'must be only the folder ID, without URL parts like ?hl='
const PRIVATE_KEY_MESSAGE = 'is not a readable PEM private key'

const driveFolderId = z.string().trim().regex(DRIVE_ID_PATTERN, DRIVE_ID_MESSAGE)
const LINKEDIN_ORGANIZATION_PATTERN = /^\d+$/
const LINKEDIN_VERSION_PATTERN = /^\d{6}$/
const DEFAULT_LINKEDIN_API_VERSION = '202609'
const optionalSecret = z.string().trim().min(1).optional()
const DISCORD_ID_PATTERN = /^\d{17,20}$/

export class EnvConfigError extends Error {
  constructor(readonly variables: string[]) {
    super(`Invalid environment configuration: ${variables.join(', ')}`)
    this.name = 'EnvConfigError'
  }
}

const envSchema = z
  .object({
    GOOGLE_CLIENT_EMAIL: z.string().email(),
    GOOGLE_PRIVATE_KEY: z.string().min(1).transform(normalizePrivateKey).refine(isReadablePrivateKey, PRIVATE_KEY_MESSAGE),
    DRIVE_SOURCE_FOLDER_ID: driveFolderId,
    DRIVE_PUBLISHED_FOLDER_ID: driveFolderId.or(z.literal('')).optional(),
    MARK_STRATEGY: z.enum(MARK_STRATEGIES).default(MARK_STRATEGIES[0]),
    META_GRAPH_ACCESS_TOKEN: z.string().min(1),
    META_PAGE_ID: z.string().min(1),
    META_INSTAGRAM_USER_ID: z.string().min(1),
    PUBLIC_BASE_URL: z.string().url(),
    MEDIA_SIGNING_SECRET: z.string().min(1),
    CRON_SECRET: z.string().min(1),
    BATCH_SIZE: z.coerce.number().int().positive().default(DEFAULT_BATCH_SIZE),
    DEFAULT_CAPTION: z.string().default(''),
    LINKEDIN_ORGANIZATION_ID: z.string().trim().regex(LINKEDIN_ORGANIZATION_PATTERN).optional(),
    LINKEDIN_ACCESS_TOKEN: optionalSecret,
    LINKEDIN_CLIENT_ID: optionalSecret,
    LINKEDIN_CLIENT_SECRET: optionalSecret,
    LINKEDIN_REFRESH_TOKEN: optionalSecret,
    TIKTOK_CLIENT_KEY: optionalSecret,
    TIKTOK_CLIENT_SECRET: optionalSecret,
    KV_REST_API_URL: z.string().trim().url().optional(),
    KV_REST_API_TOKEN: optionalSecret,
    DISCORD_BOT_TOKEN: optionalSecret,
    DISCORD_TIKTOK_CHANNEL_ID: z.string().trim().regex(DISCORD_ID_PATTERN).optional(),
    LINKEDIN_API_VERSION: z.string().trim().regex(LINKEDIN_VERSION_PATTERN).default(DEFAULT_LINKEDIN_API_VERSION),
  })
  .superRefine((value, context) => {
    if (value.MARK_STRATEGY === MARK_STRATEGIES[1] && !value.DRIVE_PUBLISHED_FOLDER_ID) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DRIVE_PUBLISHED_FOLDER_ID'],
        message: 'DRIVE_PUBLISHED_FOLDER_ID is required when MARK_STRATEGY is move',
      })
    }
  })

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv
  }

  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    throw new EnvConfigError(parsed.error.issues.map((issue) => issue.path.join('.')))
  }

  cachedEnv = parsed.data

  return cachedEnv
}