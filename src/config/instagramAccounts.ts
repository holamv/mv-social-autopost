import type { Env } from './env.js'

export const INSTAGRAM_COUNTRIES = ['PE', 'MX', 'CO'] as const

export type InstagramCountry = (typeof INSTAGRAM_COUNTRIES)[number]

export interface InstagramAccount {
  country: InstagramCountry
  userId: string
  accessToken: string
}

type CountryVariable = `META_INSTAGRAM_USER_ID_${InstagramCountry}` | `META_GRAPH_ACCESS_TOKEN_${InstagramCountry}`

export type InstagramAccountVariables = Pick<
  Env,
  'META_INSTAGRAM_COUNTRY' | 'META_INSTAGRAM_USER_ID' | 'META_GRAPH_ACCESS_TOKEN'
> &
  Partial<Record<CountryVariable, string>>

export function toInstagramCountry(value: string | null | undefined): InstagramCountry | null {
  return INSTAGRAM_COUNTRIES.find((country) => country === value) ?? null
}

export function resolveInstagramAccount(
  variables: InstagramAccountVariables,
  country: InstagramCountry,
): InstagramAccount | null {
  const isMainCountry = country === variables.META_INSTAGRAM_COUNTRY
  const userId =
    variables[`META_INSTAGRAM_USER_ID_${country}`] ?? (isMainCountry ? variables.META_INSTAGRAM_USER_ID : undefined)

  if (!userId) {
    return null
  }

  return {
    country,
    userId,
    accessToken: variables[`META_GRAPH_ACCESS_TOKEN_${country}`] ?? variables.META_GRAPH_ACCESS_TOKEN,
  }
}
