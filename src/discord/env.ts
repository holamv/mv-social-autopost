import { z } from 'zod'

const discordEnvSchema = z.object({
  DISCORD_APPLICATION_ID: z.string().min(1),
  DISCORD_PUBLIC_KEY: z.string().regex(/^[0-9a-f]{64}$/i),
})

export type DiscordEnv = z.infer<typeof discordEnvSchema>

let cachedEnv: DiscordEnv | null = null

export function getDiscordEnv(): DiscordEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  const parsed = discordEnvSchema.safeParse(process.env)

  if (!parsed.success) {
    const invalid = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Invalid Discord configuration: ${invalid}`)
  }

  cachedEnv = parsed.data

  return cachedEnv
}
