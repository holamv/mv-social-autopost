import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'

const MAIN_TOKEN = 'token-main'
const MEXICO_TOKEN = 'token-mexico'
const ENOUGH_TIME_MS = 60000

Object.assign(process.env, {
  GOOGLE_CLIENT_EMAIL: 'autopost@example.iam.gserviceaccount.com',
  GOOGLE_PRIVATE_KEY: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }),
  DRIVE_SOURCE_FOLDER_ID: 'source-folder',
  META_GRAPH_ACCESS_TOKEN: MAIN_TOKEN,
  META_PAGE_ID: 'page-main',
  META_INSTAGRAM_USER_ID: 'ig-main',
  META_INSTAGRAM_USER_ID_MX: 'ig-mexico',
  META_GRAPH_ACCESS_TOKEN_MX: MEXICO_TOKEN,
  META_PAGE_ID_MX: 'page-mexico',
  PUBLIC_BASE_URL: 'https://autopost.example.com',
  MEDIA_SIGNING_SECRET: 'signing-secret',
  CRON_SECRET: 'cron-secret',
})

for (const name of [
  'META_INSTAGRAM_COUNTRY',
  'META_INSTAGRAM_USER_ID_CO',
  'META_INSTAGRAM_USER_ID_PE',
  'META_GRAPH_ACCESS_TOKEN_CO',
  'META_GRAPH_ACCESS_TOKEN_PE',
  'META_PAGE_ID_CO',
  'META_PAGE_ID_PE',
]) {
  delete process.env[name]
}

interface GraphCall {
  path: string
  token: string | null
}

const calls: GraphCall[] = []
const graph = { rejectPhotos: false }

function graphReply(path: string): Record<string, string> {
  if (path.endsWith('/media_publish')) {
    return { id: 'media-published' }
  }

  if (path.endsWith('/photos')) {
    return { id: 'photo', post_id: 'page-post' }
  }

  return path.endsWith('/media') ? { id: 'container' } : { status_code: 'FINISHED', username: 'manzanaverde' }
}

function requestToken(url: URL, init?: RequestInit): string | null {
  if (init?.body instanceof FormData) {
    return String(init.body.get('access_token'))
  }

  return url.searchParams.get('access_token') ?? new URLSearchParams(String(init?.body ?? '')).get('access_token')
}

globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = new URL(String(input))

  calls.push({ path: url.pathname, token: requestToken(url, init) })

  if (graph.rejectPhotos && url.pathname.endsWith('/photos')) {
    return new Response(JSON.stringify({ error: { message: 'Meta rechazo la foto' } }), { status: 400 })
  }

  return new Response(JSON.stringify(graphReply(url.pathname)))
}) as typeof fetch

const { CHANNEL_PUBLISHERS } = await import('../src/core/publishers.ts')
const { graphGet } = await import('../src/meta/client.ts')
const { SubmissionError, sourceProperties, submitFromGenerator } = await import('../src/generator/submit.ts')
const { mirrorToFacebook } = await import('../src/generator/facebookMirror.ts')
const { toPendingImage } = await import('../src/drive/listPending.ts')

const deadline = { remainingMs: () => ENOUGH_TIME_MS, isExpired: () => false }

function pendingImage(storedInstagramCountry: string | null) {
  return {
    id: 'file-1',
    name: 'post.jpg',
    order: 0,
    caption: 'Hola',
    mimeType: 'image/jpeg',
    sizeBytes: 1,
    lockedAt: null,
    postIds: {},
    linkedInMediaUrn: null,
    webViewLink: '',
    tikTokMessageId: null,
    storedInstagramCountry,
  }
}

describe('Instagram publishing by country', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('publishes a Mexico file on the Mexico account with the Mexico token', async () => {
    assert.equal(await CHANNEL_PUBLISHERS.instagram(pendingImage('MX'), deadline), 'media-published')
    assert.deepEqual(calls.map((call) => call.path.split('/').slice(2).join('/')), ['ig-mexico/media', 'container', 'ig-mexico/media_publish'])
    assert.ok(calls.every((call) => call.token === MEXICO_TOKEN))
  })

  it('publishes a file without country on the main account', async () => {
    await CHANNEL_PUBLISHERS.instagram(pendingImage(null), deadline)
    assert.ok(calls[0]?.path.endsWith('/ig-main/media'))
    assert.ok(calls.every((call) => call.token === MAIN_TOKEN))
  })

  it('fails without calling Meta when the country has no account', async () => {
    await assert.rejects(CHANNEL_PUBLISHERS.instagram(pendingImage('CO'), deadline), /Colombia|CO/)
    assert.equal(calls.length, 0)
  })

  it('fails without calling Meta when the stored country is unknown', async () => {
    await assert.rejects(CHANNEL_PUBLISHERS.instagram(pendingImage('AR'), deadline), /AR/)
    assert.equal(calls.length, 0)
  })

  it('keeps the main token for Facebook and metrics calls', async () => {
    await graphGet('page-main', 'followers_count')
    assert.equal(calls[0]?.token, MAIN_TOKEN)
  })
})

describe('country round trip through the Drive file', () => {
  beforeEach(() => {
    calls.length = 0
  })

  function uploadedFile(country: 'MX' | null) {
    return toPendingImage({ id: 'file-2', name: 'post.jpg', appProperties: sourceProperties(country) }, '')
  }

  it('publishes on Mexico what the generator uploaded for Mexico', async () => {
    await CHANNEL_PUBLISHERS.instagram(uploadedFile('MX'), deadline)
    assert.ok(calls[0]?.path.endsWith('/ig-mexico/media'))
    assert.ok(calls.every((call) => call.token === MEXICO_TOKEN))
  })

  it('publishes on the main account what was uploaded without country', async () => {
    await CHANNEL_PUBLISHERS.instagram(uploadedFile(null), deadline)
    assert.ok(calls[0]?.path.endsWith('/ig-main/media'))
    assert.ok(calls.every((call) => call.token === MAIN_TOKEN))
  })
})

describe('Facebook copy of a generator post', () => {
  const media = { fileId: 'file-3', name: 'post.jpg', mimeType: 'image/jpeg', sizeBytes: 1, buffer: Buffer.from('A') }

  beforeEach(() => {
    calls.length = 0
    graph.rejectPhotos = false
  })

  it('publishes the Mexico copy on the Mexico page with the Mexico token', async () => {
    assert.equal(await mirrorToFacebook(media, 'Hola', 'MX', deadline), 'page-post')
    assert.ok(calls[0]?.path.endsWith('/page-mexico/photos'))
    assert.equal(calls[0]?.token, MEXICO_TOKEN)
  })

  it('publishes the Peru copy on the main page with the main token', async () => {
    assert.equal(await mirrorToFacebook(media, 'Hola', 'PE', deadline), 'page-post')
    assert.ok(calls[0]?.path.endsWith('/page-main/photos'))
    assert.equal(calls[0]?.token, MAIN_TOKEN)
  })

  it('skips without calling Meta when the country has no Facebook page', async () => {
    assert.equal(await mirrorToFacebook(media, 'Hola', 'CO', deadline), null)
    assert.equal(calls.length, 0)
  })

  it('skips without calling Meta when Instagram used up the time budget', async () => {
    const expired = { remainingMs: () => 0, isExpired: () => true }

    assert.equal(await mirrorToFacebook(media, 'Hola', 'MX', expired), null)
    assert.equal(calls.length, 0)
  })

  it('returns null instead of failing when Meta rejects the copy', async () => {
    graph.rejectPhotos = true
    assert.equal(await mirrorToFacebook(media, 'Hola', 'MX', deadline), null)
    assert.equal(calls.length, 1)
  })
})

describe('Facebook publishing by country', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('fails without calling Meta or Drive when the country has no Facebook page', async () => {
    await assert.rejects(CHANNEL_PUBLISHERS.facebook(pendingImage('CO'), deadline), /META_PAGE_ID_CO/)
    assert.equal(calls.length, 0)
  })

  it('fails without calling Meta or Drive when the stored country is unknown', async () => {
    await assert.rejects(CHANNEL_PUBLISHERS.facebook(pendingImage('AR'), deadline), /AR/)
    assert.equal(calls.length, 0)
  })
})

describe('submitFromGenerator', () => {
  it('rejects a country without account with 409 before touching Drive or Meta', async () => {
    calls.length = 0
    const submission = { channel: 'instagram', country: 'CO', caption: 'Hola', mimeType: 'image/jpeg', dataBase64: 'AAAA' } as const

    await assert.rejects(submitFromGenerator(submission), (error: unknown) => error instanceof SubmissionError && error.status === 409)
    assert.equal(calls.length, 0)
  })
})
