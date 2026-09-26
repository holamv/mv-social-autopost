export const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/'
export const TIKTOK_API_BASE_URL = 'https://open.tiktokapis.com/v2'
export const TIKTOK_TOKEN_PATH = 'oauth/token/'
export const TIKTOK_CREATOR_INFO_PATH = 'post/publish/creator_info/query/'
export const TIKTOK_VIDEO_INIT_PATH = 'post/publish/video/init/'
export const TIKTOK_STATUS_PATH = 'post/publish/status/fetch/'
export const TIKTOK_CALLBACK_ROUTE = '/api/tiktok/callback'
export const TIKTOK_SCOPES = 'user.info.basic,video.publish,video.upload'

export const AUTHORIZATION_CODE_GRANT = 'authorization_code'
export const REFRESH_TOKEN_GRANT = 'refresh_token'
export const RESPONSE_TYPE_CODE = 'code'
export const TOKEN_STORE_KEY = 'tiktok:tokens'
export const TOKEN_EXPIRY_SAFETY_MS = 300000
export const OAUTH_STATE_TTL_MINUTES = 10
export const OAUTH_STATE_PURPOSE = 'tiktok-oauth'

export const JSON_UTF8_CONTENT_TYPE = 'application/json; charset=UTF-8'
export const FORM_CONTENT_TYPE = 'application/x-www-form-urlencoded'
export const OK_ERROR_CODE = 'ok'

export const FILE_UPLOAD_SOURCE = 'FILE_UPLOAD'
export const MAX_SINGLE_CHUNK_BYTES = 67108864
export const TARGET_CHUNK_BYTES = 10485760
export const HTTP_PARTIAL_CONTENT = 206
export const HTTP_CREATED = 201

export const STATUS_PUBLISH_COMPLETE = 'PUBLISH_COMPLETE'
export const STATUS_FAILED = 'FAILED'
export const STATUS_POLL_DELAY_MS = 5000
export const TITLE_MAX_LENGTH = 2200

export const PRIVACY_SELECT_PREFIX = 'tiktok-privacy:'
export const PUBLISH_BUTTON_PREFIX = 'tiktok-publish:'
export const TIKTOK_ROUTE_LABEL = 'TikTok'

export const MUSIC_USAGE_URL = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en'

export const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Todos',
  MUTUAL_FOLLOW_FRIENDS: 'Amigos',
  FOLLOWER_OF_CREATOR: 'Seguidores',
  SELF_ONLY: 'Solo yo',
}
