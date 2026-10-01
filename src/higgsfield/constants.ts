export const HIGGSFIELD_API_BASE_URL = 'https://api.higgsfield.ai'
export const HIGGSFIELD_AUTH_SCHEME = 'Key'
export const HIGGSFIELD_KEY_SEPARATOR = ':'
export const HIGGSFIELD_WEBHOOK_PARAM = 'hf_webhook'
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key'

export const WEBHOOK_ROUTE = '/api/higgsfield/webhook'
export const WEBHOOK_TOKEN_PARAM = 'token'
export const WEBHOOK_TOKEN_PURPOSE = 'higgsfield-webhook'

export const STATUS_COMPLETED = 'completed'
export const TERMINAL_STATUSES = ['completed', 'failed', 'nsfw', 'canceled'] as const

export const JOB_KEY_PREFIX = 'higgsfield:job:'
export const LOCK_KEY_PREFIX = 'higgsfield:lock:'
export const JOB_TTL_SECONDS = 604800
export const LOCK_TTL_SECONDS = 300
export const LOCK_VALUE = '1'

export const GENERATED_FILE_PREFIX = 'higgsfield'
export const GENERATED_FILE_EXTENSION = '.mp4'
export const GENERATED_VIDEO_MIME_TYPE = 'video/mp4'
export const SHORT_ID_LENGTH = 8
export const ISO_DATE_LENGTH = 10
export const REQUEST_ID_PROPERTY = 'mvHiggsfieldRequestId'
export const CONTENT_LENGTH_HEADER = 'content-length'
export const STORAGE_QUOTA_ERROR = /storage quota/i
