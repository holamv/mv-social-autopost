import type { ChannelPostIds, PublishedImage } from '../types.js'

export interface PublishFlow {
  fileId: string
  publish: () => Promise<PublishedImage>
  discard: (error: unknown) => Promise<void>
  copy: () => Promise<ChannelPostIds>
}

async function publishOrDiscard(flow: PublishFlow): Promise<PublishedImage> {
  try {
    return await flow.publish()
  } catch (error) {
    await flow.discard(error)
    throw error
  }
}

async function copyWithoutFailing(flow: PublishFlow): Promise<ChannelPostIds> {
  try {
    return await flow.copy()
  } catch (error) {
    console.error(`[Generator] El archivo ${flow.fileId} ya estaba publicado y la copia fallo; se responde exito igual:`, error)
    return {}
  }
}

export async function publishThenCopy(flow: PublishFlow): Promise<ChannelPostIds> {
  const published = await publishOrDiscard(flow)
  const copied = await copyWithoutFailing(flow)

  return { ...published.postIds, ...copied }
}
