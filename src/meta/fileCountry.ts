import { getEnv } from '../config/env.js'
import { toInstagramCountry, type InstagramCountry } from '../config/instagramAccounts.js'
import { HTTP_INTERNAL_ERROR } from '../config/constants.js'
import { MetaApiError } from './client.js'

export function countryOrFail(fileId: string, storedCountry: string | null, channelLabel: string): InstagramCountry {
  if (storedCountry === null) {
    return getEnv().META_INSTAGRAM_COUNTRY
  }

  const country = toInstagramCountry(storedCountry)

  if (!country) {
    console.warn(`[${channelLabel}] El archivo ${fileId} pide un pais desconocido: ${storedCountry}`)
    throw new MetaApiError(`El archivo pide el pais de Instagram "${storedCountry}", que el autopost no conoce`, HTTP_INTERNAL_ERROR)
  }

  return country
}
