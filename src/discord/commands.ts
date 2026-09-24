import { waitUntil } from '@vercel/functions'
import { createDeadline } from '../core/deadline.js'
import { runPublishCycle } from '../core/pipeline.js'
import { listPendingImages } from '../drive/listPending.js'
import { editOriginalResponse } from './api.js'
import { PUBLISH_NOW_COMMAND, STATUS_COMMAND } from './commandDefinitions.js'
import {
  MESSAGE_FLAG_EPHEMERAL,
  RESPONSE_TYPE_CHANNEL_MESSAGE,
  RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE,
} from './constants.js'
import {
  STATUS_ERROR_MESSAGE,
  UNKNOWN_COMMAND_MESSAGE,
  formatPublishResult,
  formatQueueStatus,
} from './messages.js'

export interface CommandInteraction {
  token: string
  data: { name: string }
}

export interface InteractionResponse {
  type: number
  data?: { content?: string; flags?: number }
}

async function replyWithQueueStatus(token: string): Promise<void> {
  try {
    await editOriginalResponse(token, formatQueueStatus(await listPendingImages()))
  } catch (error) {
    console.error('[DiscordStatus] Error leyendo la cola:', error)
    await editOriginalResponse(token, STATUS_ERROR_MESSAGE)
  }
}

async function replyWithPublishResult(token: string): Promise<void> {
  const startedAt = Date.now()
  const result = await runPublishCycle(createDeadline())

  console.log(`[DiscordPublish] Ciclo terminado en ${Date.now() - startedAt} ms`)
  await editOriginalResponse(token, formatPublishResult(result))
}

export function handleCommand(interaction: CommandInteraction): InteractionResponse {
  switch (interaction.data.name) {
    case STATUS_COMMAND:
      waitUntil(replyWithQueueStatus(interaction.token))
      return { type: RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE, data: { flags: MESSAGE_FLAG_EPHEMERAL } }
    case PUBLISH_NOW_COMMAND:
      waitUntil(replyWithPublishResult(interaction.token))
      return { type: RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE }
    default:
      return {
        type: RESPONSE_TYPE_CHANNEL_MESSAGE,
        data: { content: UNKNOWN_COMMAND_MESSAGE, flags: MESSAGE_FLAG_EPHEMERAL },
      }
  }
}
