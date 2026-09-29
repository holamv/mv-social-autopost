import { waitUntil } from '@vercel/functions'
import { publishApproved } from '../tiktok/approval.js'
import { PRIVACY_SELECT_PREFIX, PUBLISH_BUTTON_PREFIX } from '../tiktok/constants.js'
import { canPublish, type InteractionMember } from './access.js'
import { findSelectedValue, withSelectedValue, type MessageComponent } from './components.js'
import {
  MESSAGE_FLAG_EPHEMERAL,
  RESPONSE_TYPE_CHANNEL_MESSAGE,
  RESPONSE_TYPE_DEFERRED_UPDATE_MESSAGE,
  RESPONSE_TYPE_UPDATE_MESSAGE,
} from './constants.js'
import { getDiscordEnv } from './env.js'
import { PUBLISH_FORBIDDEN_MESSAGE, UNKNOWN_COMMAND_MESSAGE } from './messages.js'

const PRIVACY_REQUIRED_MESSAGE = 'Primero elige quien puede ver el video.'

export interface ComponentInteraction {
  token: string
  member?: InteractionMember
  data: { custom_id: string; values?: string[] }
  message: { components: MessageComponent[] }
}

export interface ComponentResponse {
  type: number
  data?: { content?: string; flags?: number; components?: MessageComponent[] }
}

function ephemeral(content: string): ComponentResponse {
  return { type: RESPONSE_TYPE_CHANNEL_MESSAGE, data: { content, flags: MESSAGE_FLAG_EPHEMERAL } }
}

function selectPrivacy(interaction: ComponentInteraction): ComponentResponse {
  const value = interaction.data.values?.[0] ?? ''

  return {
    type: RESPONSE_TYPE_UPDATE_MESSAGE,
    data: { components: withSelectedValue(interaction.message.components, interaction.data.custom_id, value) },
  }
}

function startPublish(interaction: ComponentInteraction): ComponentResponse {
  if (!canPublish(interaction.member, getDiscordEnv().DISCORD_PUBLISHER_IDS)) {
    return ephemeral(PUBLISH_FORBIDDEN_MESSAGE)
  }

  const fileId = interaction.data.custom_id.slice(PUBLISH_BUTTON_PREFIX.length)
  const privacy = findSelectedValue(interaction.message.components, `${PRIVACY_SELECT_PREFIX}${fileId}`)

  if (!privacy) {
    return ephemeral(PRIVACY_REQUIRED_MESSAGE)
  }

  waitUntil(
    publishApproved({
      fileId,
      privacy,
      interactionToken: interaction.token,
      approvedBy: interaction.member?.user.id ?? '',
      components: interaction.message.components,
    }),
  )

  return { type: RESPONSE_TYPE_DEFERRED_UPDATE_MESSAGE }
}

export function handleComponent(interaction: ComponentInteraction): ComponentResponse {
  if (interaction.data.custom_id.startsWith(PRIVACY_SELECT_PREFIX)) {
    return selectPrivacy(interaction)
  }

  if (interaction.data.custom_id.startsWith(PUBLISH_BUTTON_PREFIX)) {
    return startPublish(interaction)
  }

  return ephemeral(UNKNOWN_COMMAND_MESSAGE)
}
