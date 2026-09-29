import { getEnv } from '../config/env.js'
import { HTTP_INTERNAL_ERROR, HTTP_METHOD_POST } from '../config/constants.js'
import { LinkedInApiError, linkedInRequest } from './client.js'
import {
  COMMENTARY_MAX_LENGTH,
  LITTLE_TEXT_RESERVED,
  ORGANIZATION_URN_PREFIX,
  POSTS_PATH,
  POST_FEED_DISTRIBUTION,
  POST_LIFECYCLE_STATE,
  POST_VISIBILITY,
  RESTLI_ID_HEADER,
} from './constants.js'

export function escapeLittleText(text: string): string {
  return text.replace(LITTLE_TEXT_RESERVED, (character) => `\\${character}`).slice(0, COMMENTARY_MAX_LENGTH)
}

export async function createMediaPost(mediaUrn: string, caption: string): Promise<string> {
  const response = await linkedInRequest(POSTS_PATH, {
    method: HTTP_METHOD_POST,
    body: JSON.stringify({
      author: `${ORGANIZATION_URN_PREFIX}${getEnv().LINKEDIN_ORGANIZATION_ID ?? ''}`,
      commentary: escapeLittleText(caption),
      visibility: POST_VISIBILITY,
      distribution: { feedDistribution: POST_FEED_DISTRIBUTION, targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { id: mediaUrn } },
      lifecycleState: POST_LIFECYCLE_STATE,
      isReshareDisabledByAuthor: false,
    }),
  })
  const postUrn = response.headers.get(RESTLI_ID_HEADER)

  if (!postUrn) {
    throw new LinkedInApiError('LinkedIn creo el post pero no devolvio su ID', HTTP_INTERNAL_ERROR)
  }

  return postUrn
}
