import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { collectLikes, metaLikesPlan } from '../src/metrics/likes.ts'

const VARIABLES = {
  META_INSTAGRAM_COUNTRY: 'PE',
  META_PAGE_ID: 'page-peru',
  META_INSTAGRAM_USER_ID: 'ig-peru',
  META_GRAPH_ACCESS_TOKEN: 'token-peru',
  META_INSTAGRAM_USER_ID_MX: 'ig-mexico',
  META_PAGE_ID_MX: 'page-mexico',
  META_GRAPH_ACCESS_TOKEN_MX: 'token-mexico',
} as const

const GRAPH_REPLIES: Record<string, unknown> = {
  '/ig-peru/media': { data: [{ permalink: 'https://www.instagram.com/p/peru/', timestamp: '2026-11-01T15:00:00+0000', like_count: 40 }] },
  '/ig-mexico/media': { data: [{ permalink: 'https://www.instagram.com/p/mexico/', timestamp: '2026-11-02T15:00:00+0000', like_count: 12 }] },
  '/page-peru/posts': { data: [{ permalink_url: 'https://www.facebook.com/peru/posts/1', created_time: '2026-11-03T15:00:00+0000', reactions: { summary: { total_count: 7 } } }] },
  '/page-mexico/posts': { data: [{ permalink_url: 'https://www.facebook.com/mexico/posts/2', created_time: '2026-11-04T15:00:00+0000', reactions: { summary: { total_count: 3 } } }] },
}

interface GraphCall {
  account: string
  token: string | null
}

const originalFetch = globalThis.fetch
const calls: GraphCall[] = []

function mockGraph(): void {
  calls.length = 0
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input))
    const account = url.pathname.replace(/^\/v[\d.]+/, '')

    calls.push({ account, token: url.searchParams.get('access_token') })
    return new Response(JSON.stringify(GRAPH_REPLIES[account] ?? { data: [] }), { status: 200 })
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('metaLikesPlan', () => {
  it('reads Instagram and Facebook of every configured country and lists the ones without an account', () => {
    const plan = metaLikesPlan(VARIABLES)

    assert.deepEqual(plan.sources.map((source) => source.id), ['instagram-PE', 'facebook-PE', 'instagram-MX', 'facebook-MX'])
    assert.deepEqual(plan.missing, ['instagram-CO', 'facebook-CO'])
  })

  it('reads each account with its own token and tags every post with its country and likes only', async () => {
    mockGraph()

    const posts = (await Promise.all(metaLikesPlan(VARIABLES).sources.map((source) => source.read()))).flat()

    assert.deepEqual(calls, [
      { account: '/ig-peru/media', token: 'token-peru' },
      { account: '/page-peru/posts', token: 'token-peru' },
      { account: '/ig-mexico/media', token: 'token-mexico' },
      { account: '/page-mexico/posts', token: 'token-mexico' },
    ])
    assert.deepEqual(posts.map((post) => [post.network, post.country, post.metrics]), [
      ['instagram', 'PE', { likes: 40 }],
      ['facebook', 'PE', { likes: 7 }],
      ['instagram', 'MX', { likes: 12 }],
      ['facebook', 'MX', { likes: 3 }],
    ])
    assert.equal(posts[0]?.publishedAt, '2026-11-01T15:00:00.000Z')
  })
})

describe('collectLikes', () => {
  it('keeps the accounts that answered when another one fails, and reports the failure and the missing accounts', async () => {
    const post = { network: 'tiktok' as const, country: null, url: 'https://www.tiktok.com/@mv/video/1', publishedAt: null, metrics: { likes: 5 } }
    const report = await collectLikes({
      sources: [
        { id: 'tiktok', read: async () => [post] },
        { id: 'instagram-MX', read: async () => Promise.reject(new Error('token vencido')) },
      ],
      missing: ['facebook-CO'],
    })

    assert.deepEqual(report.sources, ['tiktok'])
    assert.deepEqual(report.failures, { 'instagram-MX': 'token vencido' })
    assert.deepEqual(report.missing, ['facebook-CO'])
    assert.deepEqual(report.posts, [post])
  })
})
