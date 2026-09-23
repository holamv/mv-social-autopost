import { z } from 'zod'
import { DEFAULT_BATCH_SIZE, ESCAPED_PRIVATE_KEY_NEWLINE, FIELD_SEPARATOR, REAL_NEWLINE } from './constants.js'

const MARK_STRATEGIES = ['properties', 'move'] as const

const envSchema = z
  .object({
    GOOGLE_CLIENT_EMAIL: z.string().email(),
    GOOGLE_PRIVATE_KEY: z.string().min(1),
    DRIVE_SOURCE_FOLDER_ID: z.string().min(1),
    DRIVE_PUBLISHED_FOLDER_ID: z.string().optional(),
    MARK_STRATEGY: z.enum(MARK_STRATEGIES).default(MARK_STRATEGIES[0]),
    META_GRAPH_ACCESS_TOKEN: z.string().min(1),
    META_PAGE_ID: z.string().min(1),
    META_INSTAGRAM_USER_ID: z.string().min(1),
    PUBLIC_BASE_URL: z.string().url(),
    MEDIA_SIGNING_SECRET: z.string().min(1),
    CRON_SECRET: z.string().min(1),
    BATCH_SIZE: z.coerce.number().int().positive().default(DEFAULT_BATCH_SIZE),
    DEFAULT_CAPTION: z.string().default(''),
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
    const failingVariables = parsed.error.issues.map((issue) => ({
      variable: issue.path.join('.'),
      code: issue.code,
      message: issue.message,
    }))
    console.error('[Env] Invalid environment variables:', JSON.stringify(failingVariables))
    const missing = failingVariables.map(({ variable }) => variable).join(FIELD_SEPARATOR)
    throw new Error(`Invalid environment configuration: ${missing}`)
  }

  cachedEnv = {
    ...parsed.data,
    GOOGLE_PRIVATE_KEY: parsed.data.GOOGLE_PRIVATE_KEY.replace(ESCAPED_PRIVATE_KEY_NEWLINE, REAL_NEWLINE),
  }

  return cachedEnv
}