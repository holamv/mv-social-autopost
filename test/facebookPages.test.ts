import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveFacebookPage } from '../src/config/facebookPages.ts'

const MAIN_PAGE = {
  META_INSTAGRAM_COUNTRY: 'PE',
  META_PAGE_ID: 'page-peru',
  META_GRAPH_ACCESS_TOKEN: 'token-peru',
} as const

describe('resolveFacebookPage', () => {
  it('uses the main page for the main country', () => {
    assert.deepEqual(resolveFacebookPage(MAIN_PAGE, 'PE'), {
      country: 'PE',
      pageId: 'page-peru',
      accessToken: 'token-peru',
    })
  })

  it('returns null for a country without its own page', () => {
    assert.equal(resolveFacebookPage(MAIN_PAGE, 'MX'), null)
    assert.equal(resolveFacebookPage(MAIN_PAGE, 'CO'), null)
  })

  it('uses the country page with the token of that country', () => {
    const variables = { ...MAIN_PAGE, META_PAGE_ID_MX: 'page-mexico', META_GRAPH_ACCESS_TOKEN_MX: 'token-mexico' }

    assert.deepEqual(resolveFacebookPage(variables, 'MX'), {
      country: 'MX',
      pageId: 'page-mexico',
      accessToken: 'token-mexico',
    })
  })

  it('falls back to the main token when the country only sets its page id', () => {
    const variables = { ...MAIN_PAGE, META_PAGE_ID_CO: 'page-colombia' }

    assert.equal(resolveFacebookPage(variables, 'CO')?.accessToken, 'token-peru')
  })

  it('keeps the main page and token for the main country even if its country variables are set', () => {
    const variables = { ...MAIN_PAGE, META_PAGE_ID_PE: 'page-peru-other', META_GRAPH_ACCESS_TOKEN_PE: 'token-instagram-only' }

    assert.deepEqual(resolveFacebookPage(variables, 'PE'), {
      country: 'PE',
      pageId: 'page-peru',
      accessToken: 'token-peru',
    })
  })

  it('uses the country variables for Peru when the main country is another one', () => {
    const variables = { ...MAIN_PAGE, META_INSTAGRAM_COUNTRY: 'MX', META_PAGE_ID_PE: 'page-peru-own', META_GRAPH_ACCESS_TOKEN_PE: 'token-peru-own' } as const

    assert.deepEqual(resolveFacebookPage(variables, 'PE'), {
      country: 'PE',
      pageId: 'page-peru-own',
      accessToken: 'token-peru-own',
    })
    assert.equal(resolveFacebookPage(variables, 'MX')?.pageId, 'page-peru')
  })
})
