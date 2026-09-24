export const LINKEDIN_API_BASE_URL = 'https://api.linkedin.com/rest'
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'

export const LINKEDIN_VERSION_HEADER = 'LinkedIn-Version'
export const RESTLI_PROTOCOL_HEADER = 'X-Restli-Protocol-Version'
export const RESTLI_PROTOCOL_VERSION = '2.0.0'
export const RESTLI_ID_HEADER = 'x-restli-id'
export const ETAG_HEADER = 'etag'
export const AUTHORIZATION_HEADER = 'Authorization'
export const CONTENT_TYPE_HEADER = 'Content-Type'
export const JSON_CONTENT_TYPE = 'application/json'
export const BINARY_CONTENT_TYPE = 'application/octet-stream'

export const REFRESH_GRANT_TYPE = 'refresh_token'
export const TOKEN_EXPIRY_SAFETY_MS = 60000

export const ORGANIZATION_URN_PREFIX = 'urn:li:organization:'
export const IMAGE_URN_PREFIX = 'urn:li:image:'

export const IMAGES_INITIALIZE_PATH = 'images?action=initializeUpload'
export const VIDEOS_INITIALIZE_PATH = 'videos?action=initializeUpload'
export const VIDEOS_FINALIZE_PATH = 'videos?action=finalizeUpload'
export const VIDEOS_PATH = 'videos'
export const POSTS_PATH = 'posts'

export const VIDEO_STATUS_AVAILABLE = 'AVAILABLE'
export const VIDEO_STATUS_FAILED = 'PROCESSING_FAILED'
export const VIDEO_POLL_DELAY_MS = 5000

export const POST_VISIBILITY = 'PUBLIC'
export const POST_FEED_DISTRIBUTION = 'MAIN_FEED'
export const POST_LIFECYCLE_STATE = 'PUBLISHED'
export const COMMENTARY_MAX_LENGTH = 3000
export const LITTLE_TEXT_RESERVED = /[\\|{}@[\]()<>#*_~]/g
