import { COMMAND_DEFINITIONS } from '../src/discord/commandDefinitions.ts'

const DISCORD_API_BASE_URL = 'https://discord.com/api/v10'
const REQUIRED_VARIABLES = ['DISCORD_BOT_TOKEN', 'DISCORD_APPLICATION_ID', 'DISCORD_GUILD_ID'] as const
const FAILURE_EXIT_CODE = 1

type RequiredVariable = (typeof REQUIRED_VARIABLES)[number]

function readRequiredEnv(): Record<RequiredVariable, string> {
  const missing = REQUIRED_VARIABLES.filter((name) => !process.env[name])

  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(', ')}`)
    process.exit(FAILURE_EXIT_CODE)
  }

  return Object.fromEntries(REQUIRED_VARIABLES.map((name) => [name, process.env[name] ?? ''])) as Record<
    RequiredVariable,
    string
  >
}

async function registerCommands(): Promise<void> {
  const env = readRequiredEnv()
  const url = `${DISCORD_API_BASE_URL}/applications/${env.DISCORD_APPLICATION_ID}/guilds/${env.DISCORD_GUILD_ID}/commands`

  const response = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(COMMAND_DEFINITIONS),
  })

  if (!response.ok) {
    console.error(`Discord rejected the commands: ${response.status} ${await response.text()}`)
    process.exit(FAILURE_EXIT_CODE)
  }

  const registered = (await response.json()) as { name: string }[]
  console.log(`Registered commands: ${registered.map((command) => `/${command.name}`).join(', ')}`)
}

await registerCommands()
