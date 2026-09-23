import { getEnv } from '../config/env'
import { graphUpload } from './client'
import { toUploadBlob } from '../drive/download'
import { GRAPH_PHOTOS_EDGE } from '../config/constants'
import type { DriveImage } from '../types'

const SOURCE_PARAM = 'source'
const CAPTION_PARAM = 'caption'
const PUBLISHED_PARAM = 'published'
const PUBLISHED_VALUE = 'true'

interface PhotoResponse {
  id: string
  post_id?: string
}

export async function publishToFacebook(image: DriveImage, caption: string): Promise<string> {
  const form = new FormData()

  form.append(SOURCE_PARAM, toUploadBlob(image), image.name)
  form.append(CAPTION_PARAM, caption)
  form.append(PUBLISHED_PARAM, PUBLISHED_VALUE)

  const response = await graphUpload<PhotoResponse>(
    `${getEnv().META_PAGE_ID}/${GRAPH_PHOTOS_EDGE}`,
    form,
  )

  return response.post_id ?? response.id
}
