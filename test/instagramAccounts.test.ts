import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveInstagramAccount, toInstagramCountry } from '../src/config/instagramAccounts.ts'

const MAIN_ACCOUNT = {
  META_INSTAGRAM_COUNTRY: 'PE',
  META_INSTAGRAM_USER_ID: 'ig-peru',
  META_GRAPH_ACCESS_TOKEN: 'token-peru',
} as const

describe('resolveInstagramAccount', () => {
  it('uses the main account for the main country', () => {
    assert.deepEqual(resolveInstagramAccount(MAIN_ACCOUNT, 'PE'), {
      country: 'PE',
      userId: 'ig-peru',
      accessToken: 'token-peru',
    })
  })

  it('returns null for a country without its own account', () => {
    assert.equal(resolveInstagramAccount(MAIN_ACCOUNT, 'MX'), null)
    assert.equal(resolveInstagramAccount(MAIN_ACCOUNT, 'CO'), null)
  })

  it('uses the country account and its own token when both are set', () => {
    const variables = { ...MAIN_ACCOUNT, META_INSTAGRAM_USER_ID_MX: 'ig-mexico', META_GRAPH_ACCESS_TOKEN_MX: 'token-mexico' }

    assert.deepEqual(resolveInstagramAccount(variables, 'MX'), {
      country: 'MX',
      userId: 'ig-mexico',
      accessToken: 'token-mexico',
    })
  })

  it('falls back to the main token when the country only sets its account id', () => {
    const variables = { ...MAIN_ACCOUNT, META_INSTAGRAM_USER_ID_CO: 'ig-colombia' }

    assert.deepEqual(resolveInstagramAccount(variables, 'CO'), {
      country: 'CO',
      userId: 'ig-colombia',
      accessToken: 'token-peru',
    })
  })

  it('lets the country variables override the main account for the main country', () => {
    const variables = { ...MAIN_ACCOUNT, META_INSTAGRAM_USER_ID_PE: 'ig-peru-new', META_GRAPH_ACCESS_TOKEN_PE: 'token-peru-new' }

    assert.deepEqual(resolveInstagramAccount(variables, 'PE'), {
      country: 'PE',
      userId: 'ig-peru-new',
      accessToken: 'token-peru-new',
    })
  })

  it('follows META_INSTAGRAM_COUNTRY when the main account is not Peru', () => {
    const variables = { ...MAIN_ACCOUNT, META_INSTAGRAM_COUNTRY: 'MX' } as const

    assert.equal(resolveInstagramAccount(variables, 'PE'), null)
    assert.equal(resolveInstagramAccount(variables, 'MX')?.userId, 'ig-peru')
  })
})

describe('toInstagramCountry', () => {
  it('accepts only the supported countries', () => {
    assert.equal(toInstagramCountry('CO'), 'CO')
    assert.equal(toInstagramCountry('AR'), null)
    assert.equal(toInstagramCountry(undefined), null)
  })
})
