import { waitUntil } from '@vercel/functions'
import { EnvConfigError, getEnv } from '../config/env.js'
import { isHiggsfieldConfigured, submitVideo } from '../higgsfield/client.js'
import { saveJob, videoRouteKeySchema, type GenerationJob } from '../higgsfield/jobs.js'
import {
  CHANNEL_REQUIRED_MESSAGE,
  GENERATE_ERROR_MESSAGE,
  GENERATE_MISSING_CONFIG_MESSAGE,
  PROMPT_REQUIRED_MESSAGE,
  formatSubmitted,
} from '../higgsfield/messages.js'
import { buildWebhookUrl } from '../higgsfield/webhookToken.js'
import { canPublish, type InteractionMember } from './access.js'
import { editOriginalResponse } from './api.js'
import { NETWORK_OPTION, PROMPT_OPTION } from './commandDefinitions.js'
import { MESSAGE_FLAG_EPHEMERAL, RESPONSE_TYPE_CHANNEL_MESSAGE, RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE } from './constants.js'
import { getDiscordEnv } from './env.js'
import { PUBLISH_FORBIDDEN_MESSAGE, formatConfigError } from './messages.js'
import { readOption, type OptionValue } from './scheduleCommand.js'

export interface GenerateInteraction {
  id: string
  token: string
  channel_id?: string
  member?: InteractionMember
  data: { options?: OptionValue[] }
}

interface GenerateResponse {
  type: number
  data?: { content: string; flags: number }
}

interface GenerateRequest {
  interaction: GenerateInteraction
  member: InteractionMember
  channelId: string
  prompt: string
}

function ephemeral(content: string): GenerateResponse {
  return { type: RESPONSE_TYPE_CHANNEL_MESSAGE, data: { content, flags: MESSAGE_FLAG_EPHEMERAL } }
}

function isReadyToGenerate(): boolean {
  const env = getEnv()

  return isHiggsfieldConfigured() && Boolean(env.DISCORD_BOT_TOKEN && env.KV_REST_API_URL && env.KV_REST_API_TOKEN)
}

async function submitAndRecord(request: GenerateRequest): Promise<void> {
  try {
    const routeKey = videoRouteKeySchema.parse(readOption(request.interaction.data.options, NETWORK_OPTION))
    const submitted = await submitVideo(request.prompt, buildWebhookUrl(), request.interaction.id)
    const job: GenerationJob = {
      requestId: submitted.request_id,
      routeKey,
      prompt: request.prompt,
      channelId: request.channelId,
      requestedBy: request.member.user.id,
      createdAt: new Date().toISOString(),
    }

    await saveJob(job)
    await editOriginalResponse(request.interaction.token, formatSubmitted(job))
  } catch (error) {
    console.error('[DiscordGenerate] Error enviando el pedido a Higgsfield:', error)
    await editOriginalResponse(request.interaction.token, GENERATE_ERROR_MESSAGE)
  }
}

function rejectionFor(interaction: GenerateInteraction): string | null {
  if (!canPublish(interaction.member, getDiscordEnv().DISCORD_PUBLISHER_IDS)) {
    return PUBLISH_FORBIDDEN_MESSAGE
  }

  if (!interaction.channel_id) {
    return CHANNEL_REQUIRED_MESSAGE
  }

  if (!readOption(interaction.data.options, PROMPT_OPTION)?.trim()) {
    return PROMPT_REQUIRED_MESSAGE
  }

  return isReadyToGenerate() ? null : GENERATE_MISSING_CONFIG_MESSAGE
}

export function handleGenerateCommand(interaction: GenerateInteraction): GenerateResponse {
  try {
    const rejection = rejectionFor(interaction)

    if (rejection || !interaction.member || !interaction.channel_id) {
      return ephemeral(rejection ?? CHANNEL_REQUIRED_MESSAGE)
    }

    const prompt = readOption(interaction.data.options, PROMPT_OPTION)?.trim() ?? ''

    waitUntil(submitAndRecord({ interaction, member: interaction.member, channelId: interaction.channel_id, prompt }))
  } catch (error) {
    console.error('[DiscordGenerate] Error de configuracion:', error)
    return ephemeral(error instanceof EnvConfigError ? formatConfigError(error.variables) : GENERATE_ERROR_MESSAGE)
  }

  return { type: RESPONSE_TYPE_DEFERRED_CHANNEL_MESSAGE }
}
