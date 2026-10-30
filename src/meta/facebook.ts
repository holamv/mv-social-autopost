import { getEnv } from '../config/env.js'
import { resolveFacebookPage, type FacebookPage } from '../config/facebookPages.js'
import type { InstagramCountry } from '../config/instagramAccounts.js'
import { graphUpload, MetaApiError } from './client.js'
import { countryOrFail } from './fileCountry.js'
import { toUploadBlob } from '../drive/download.js'
import { GRAPH_PHOTOS_EDGE, HTTP_INTERNAL_ERROR } from '../config/constants.js'
import type { DriveImage } from '../types.js'

const SOURCE_PARAM = 'source'
const CAPTION_PARAM = 'caption'
const PUBLISHED_PARAM = 'published'
const PUBLISHED_VALUE = 'true'
const FACEBOOK_LOG_LABEL = 'Facebook'

interface PhotoResponse {
  id: string
  post_id?: string
}

export function facebookPageFor(country: InstagramCountry): FacebookPage | null {
  return resolveFacebookPage(getEnv(), country)
}

export function requireFacebookPage(fileId: string, storedCountry: string | null): FacebookPage {
  const country = countryOrFail(fileId, storedCountry, FACEBOOK_LOG_LABEL)
  const page = facebookPageFor(country)

  if (!page) {
    console.warn(`[Facebook] Sin pagina de ${country} para publicar el archivo ${fileId}`)
    throw new MetaApiError(`Falta conectar la pagina de Facebook de ${country} (META_PAGE_ID_${country})`, HTTP_INTERNAL_ERROR)
  }

  return page
}

export async function publishToFacebook(image: DriveImage, caption: string, page: FacebookPage, timeoutMs?: number): Promise<string> {
  const form = new FormData()

  form.append(SOURCE_PARAM, toUploadBlob(image), image.name)
  form.append(CAPTION_PARAM, caption)
  form.append(PUBLISHED_PARAM, PUBLISHED_VALUE)

  const response = await graphUpload<PhotoResponse>(`${page.pageId}/${GRAPH_PHOTOS_EDGE}`, form, page.accessToken, timeoutMs)

  return response.post_id ?? response.id
}
