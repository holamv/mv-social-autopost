import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { publishThenCopy, type PublishFlow } from '../src/generator/publishFlow.ts'

const PUBLISHED = { fileId: 'file-1', name: 'post.jpg', route: 'Instagram', postIds: { instagram: 'media-1' } }
const INSTAGRAM_FAILURE = new Error('Instagram rechazo el contenedor')

function recordingFlow(overrides: Partial<PublishFlow>) {
  const steps: string[] = []
  const flow: PublishFlow = {
    fileId: 'file-1',
    publish: async () => {
      steps.push('publish')
      return PUBLISHED
    },
    discard: async () => {
      steps.push('discard')
    },
    copy: async () => {
      steps.push('copy')
      return { facebook: 'post-1' }
    },
    ...overrides,
  }

  return { flow, steps }
}

describe('publishThenCopy', () => {
  it('copies only after publishing and answers with both ids', async () => {
    const { flow, steps } = recordingFlow({})

    assert.deepEqual(await publishThenCopy(flow), { instagram: 'media-1', facebook: 'post-1' })
    assert.deepEqual(steps, ['publish', 'copy'])
  })

  it('keeps the published post and answers success when the copy throws', async () => {
    const { flow, steps } = recordingFlow({
      copy: async () => {
        steps.push('copy')
        throw new Error('Drive no respondio')
      },
    })

    assert.deepEqual(await publishThenCopy(flow), { instagram: 'media-1' })
    assert.deepEqual(steps, ['publish', 'copy'])
  })

  it('discards the file and does not copy when publishing fails', async () => {
    const discarded: unknown[] = []
    const { flow, steps } = recordingFlow({
      publish: async () => {
        throw INSTAGRAM_FAILURE
      },
      discard: async (error) => {
        discarded.push(error)
      },
    })

    await assert.rejects(publishThenCopy(flow), INSTAGRAM_FAILURE)
    assert.deepEqual(discarded, [INSTAGRAM_FAILURE])
    assert.deepEqual(steps, [])
  })
})
