import { getEnv } from '../config/env.js'
import { storeTikTokMessageId } from '../drive/marking.js'
import { sendChannelMessage } from '../discord/botApi.js'
import {
  actionRow,
  BUTTON_STYLE_LINK,
  BUTTON_STYLE_PRIMARY,
  BUTTON_TYPE,
  STRING_SELECT_TYPE,
  type MessagePayload,
} from '../discord/components.js'
import { LINE_BREAK } from '../discord/constants.js'
import type { PendingImage } from '../types.js'
import { queryCreatorInfo, type CreatorInfo } from './api.js'
import { MUSIC_USAGE_URL, PRIVACY_LABELS, PRIVACY_SELECT_PREFIX, PUBLISH_BUTTON_PREFIX } from './constants.js'

const NO_CAPTION = '(sin texto)'

function describeFile(file: PendingImage, creator: CreatorInfo): string {
  return [
    `🎬 **Video para TikTok:** ${file.name}`,
    `**Cuenta:** ${creator.creator_nickname} (@${creator.creator_username})`,
    `**Texto:** ${file.caption || NO_CAPTION}`,
    'Revisa el video, elige quien puede verlo y toca **Publicar en TikTok**.',
    `Al publicar aceptas la [Confirmacion de uso de musica de TikTok](${MUSIC_USAGE_URL}).`,
  ].join(LINE_BREAK)
}

export function buildProposalMessage(file: PendingImage, creator: CreatorInfo): MessagePayload {
  const privacySelect = {
    type: STRING_SELECT_TYPE,
    custom_id: `${PRIVACY_SELECT_PREFIX}${file.id}`,
    placeholder: '¿Quien puede ver este video?',
    options: creator.privacy_level_options.map((value) => ({ label: PRIVACY_LABELS[value] ?? value, value })),
  }
  const previewButton = { type: BUTTON_TYPE, style: BUTTON_STYLE_LINK, label: 'Ver video', url: file.webViewLink }
  const publishButton = {
    type: BUTTON_TYPE,
    style: BUTTON_STYLE_PRIMARY,
    label: 'Publicar en TikTok',
    custom_id: `${PUBLISH_BUTTON_PREFIX}${file.id}`,
  }

  return {
    content: describeFile(file, creator),
    components: [actionRow(privacySelect), actionRow(previewButton, publishButton)],
  }
}

export async function proposeFile(file: PendingImage): Promise<void> {
  const creator = await queryCreatorInfo()
  const messageId = await sendChannelMessage(getEnv().DISCORD_TIKTOK_CHANNEL_ID ?? '', buildProposalMessage(file, creator))

  await storeTikTokMessageId(file.id, messageId)
}
