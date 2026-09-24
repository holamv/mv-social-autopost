export const DISCORD_API_BASE_URL = 'https://discord.com/api/v10'

export const SIGNATURE_HEADER = 'x-signature-ed25519'
export const TIMESTAMP_HEADER = 'x-signature-timestamp'
export const SIGNATURE_KEY_FORMAT = 'jwk'
export const SIGNATURE_KEY_TYPE = 'OKP'
export const SIGNATURE_CURVE = 'Ed25519'
export const HEX_ENCODING = 'hex'
export const BASE64URL_ENCODING = 'base64url'

export const INTERACTION_TYPE_PING = 1
export const INTERACTION_TYPE_APPLICATION_COMMAND = 2

export const RESPONSE_TYPE_PONG = 1
export const RESPONSE_TYPE_CHANNEL_MESSAGE = 4
export const RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE = 5

export const MESSAGE_FLAG_EPHEMERAL = 64
export const MESSAGE_CONTENT_MAX_LENGTH = 2000
export const QUEUE_PREVIEW_SIZE = 5
export const TRUNCATION_SUFFIX = '…'
export const LINE_BREAK = '\n'

export const JSON_CONTENT_TYPE = 'application/json'
export const CONTENT_TYPE_HEADER = 'Content-Type'
export const HTTP_METHOD_PATCH = 'PATCH'
export const ORIGINAL_MESSAGE_PATH = 'messages/@original'
