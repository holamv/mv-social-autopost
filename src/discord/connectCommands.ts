import { EnvConfigError, getEnv, type Env } from '../config/env.js'
import { createOAuthState, type OAuthPurpose } from '../lib/oauthState.js'
import { buildAuthorizeUrl } from '../tiktok/tokens.js'
import { buildYouTubeAuthorizeUrl } from '../youtube/auth.js'
import { canPublish, type InteractionMember } from './access.js'
import { MESSAGE_FLAG_EPHEMERAL, RESPONSE_TYPE_CHANNEL_MESSAGE } from './constants.js'
import { getDiscordEnv } from './env.js'
import { formatConfigError, formatConnectLink, PUBLISH_ERROR_MESSAGE, PUBLISH_FORBIDDEN_MESSAGE } from './messages.js'

interface ConnectTarget {
  accountLabel: string
  requiredVariable: keyof Env
  buildUrl: (state: string) => string
}

const CONNECT_TARGETS: Record<OAuthPurpose, ConnectTarget> = {
  tiktok: { accountLabel: 'la cuenta de TikTok', requiredVariable: 'TIKTOK_CLIENT_KEY', buildUrl: buildAuthorizeUrl },
  youtube: { accountLabel: 'la cuenta de Google del canal de YouTube', requiredVariable: 'YOUTUBE_CLIENT_ID', buildUrl: buildYouTubeAuthorizeUrl },
}

export interface ConnectResponse {
  type: number
  data: { content: string; flags: number }
}

function ephemeral(content: string): ConnectResponse {
  return { type: RESPONSE_TYPE_CHANNEL_MESSAGE, data: { content, flags: MESSAGE_FLAG_EPHEMERAL } }
}

export function connectAccount(member: InteractionMember | undefined, purpose: OAuthPurpose): ConnectResponse {
  if (!canPublish(member, getDiscordEnv().DISCORD_PUBLISHER_IDS)) {
    return ephemeral(PUBLISH_FORBIDDEN_MESSAGE)
  }

  const target = CONNECT_TARGETS[purpose]

  try {
    if (!getEnv()[target.requiredVariable]) {
      return ephemeral(formatConfigError([target.requiredVariable]))
    }

    return ephemeral(formatConnectLink(target.accountLabel, target.buildUrl(createOAuthState(purpose))))
  } catch (error) {
    console.error(`[DiscordConnect] Error armando el enlace de ${purpose}:`, error)
    return ephemeral(error instanceof EnvConfigError ? formatConfigError(error.variables) : PUBLISH_ERROR_MESSAGE)
  }
}
