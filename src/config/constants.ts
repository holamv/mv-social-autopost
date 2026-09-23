export const DRIVE_API_VERSION = 'v3'
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
export const DRIVE_PAGE_SIZE = 200
export const DRIVE_MAX_PAGES = 10
export const DRIVE_PAGE_TOKEN_FIELD = 'nextPageToken'
export const DRIVE_FILE_COLLECTION = 'files'
export const DRIVE_FILE_PROPERTIES = ['id', 'name', 'mimeType', 'description', 'appProperties']
export const FIELD_SEPARATOR = ', '
export const DRIVE_DOWNLOAD_PROPERTIES = ['id', 'name', 'mimeType', 'size']
export const DRIVE_MOVE_PROPERTIES = ['id', 'parents']
export const DRIVE_PARENTS_FIELD = 'parents'
export const PARENT_SEPARATOR = ','
export const DRIVE_MEDIA_ALT = 'media'
export const IMAGE_MIME_PREFIX = 'image/'
export const ESCAPED_PRIVATE_KEY_NEWLINE = /\\n/g
export const REAL_NEWLINE = '\n'

export const STATUS_KEY = 'mvStatus'
export const STATUS_PUBLISHED = 'published'
export const PUBLISHED_AT_KEY = 'mvPublishedAt'
export const LOCKED_AT_KEY = 'mvLockedAt'
export const FACEBOOK_POST_ID_KEY = 'mvFacebookPostId'
export const INSTAGRAM_MEDIA_ID_KEY = 'mvInstagramMediaId'

export const BYTES_PER_MEGABYTE = 1048576
export const MAX_IMAGE_MEGABYTES = 25

export const FUNCTION_MAX_DURATION_SECONDS = 120
export const DEADLINE_SAFETY_SECONDS = 20

export const MS_PER_SECOND = 1000
export const SECONDS_PER_MINUTE = 60
export const LOCK_TTL_MINUTES = 15
export const MEDIA_URL_TTL_MINUTES = 30

export const GRAPH_BASE_URL = 'https://graph.facebook.com'
export const GRAPH_API_VERSION = 'v21.0'
export const GRAPH_PHOTOS_EDGE = 'photos'
export const GRAPH_MEDIA_EDGE = 'media'
export const GRAPH_MEDIA_PUBLISH_EDGE = 'media_publish'
export const INSTAGRAM_STATUS_FIELD = 'status_code'
export const INSTAGRAM_STATUS_FINISHED = 'FINISHED'
export const INSTAGRAM_STATUS_ERROR = 'ERROR'
export const INSTAGRAM_POLL_ATTEMPTS = 12
export const INSTAGRAM_POLL_DELAY_MS = 4000

export const MEDIA_ROUTE = '/api/media'
export const MEDIA_FILE_PARAM = 'file'
export const MEDIA_EXPIRES_PARAM = 'expires'
export const MEDIA_SIGNATURE_PARAM = 'signature'
export const SIGNATURE_ALGORITHM = 'sha256'
export const SIGNATURE_ENCODING = 'hex'
export const SIGNATURE_SEPARATOR = '.'

export const DEFAULT_BATCH_SIZE = 1
export const DEFAULT_MIME_TYPE = 'application/octet-stream'
export const MEDIA_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600'
export const UNNUMBERED_FILE_ORDER = Number.MAX_SAFE_INTEGER
export const LEADING_NUMBER_PATTERN = /^\s*(\d+)/
export const DECIMAL_RADIX = 10

export const HTTP_OK = 200
export const HTTP_MULTI_STATUS = 207
export const HTTP_BAD_REQUEST = 400
export const HTTP_UNAUTHORIZED = 401
export const HTTP_FORBIDDEN = 403
export const HTTP_NOT_FOUND = 404
export const HTTP_METHOD_NOT_ALLOWED = 405
export const HTTP_INTERNAL_ERROR = 500
export const HTTP_METHOD_GET = 'GET'
export const HTTP_METHOD_POST = 'POST'
export const AUTHORIZATION_HEADER = 'authorization'
export const BEARER_PREFIX = 'Bearer '
