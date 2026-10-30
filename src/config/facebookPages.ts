import type { Env } from './env.js'
import type { InstagramCountry } from './instagramAccounts.js'

export interface FacebookPage {
  country: InstagramCountry
  pageId: string
  accessToken: string
}

type CountryVariable = `META_PAGE_ID_${InstagramCountry}` | `META_GRAPH_ACCESS_TOKEN_${InstagramCountry}`

export type FacebookPageVariables = Pick<Env, 'META_INSTAGRAM_COUNTRY' | 'META_PAGE_ID' | 'META_GRAPH_ACCESS_TOKEN'> &
  Partial<Record<CountryVariable, string>>

export function resolveFacebookPage(variables: FacebookPageVariables, country: InstagramCountry): FacebookPage | null {
  if (country === variables.META_INSTAGRAM_COUNTRY) {
    return { country, pageId: variables.META_PAGE_ID, accessToken: variables.META_GRAPH_ACCESS_TOKEN }
  }

  const countryPageId = variables[`META_PAGE_ID_${country}`]

  if (!countryPageId) {
    return null
  }

  return {
    country,
    pageId: countryPageId,
    accessToken: variables[`META_GRAPH_ACCESS_TOKEN_${country}`] ?? variables.META_GRAPH_ACCESS_TOKEN,
  }
}
