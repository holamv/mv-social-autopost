import { google, type drive_v3 } from 'googleapis'
import { getEnv } from '../config/env.js'
import { DRIVE_API_VERSION, DRIVE_SCOPE } from '../config/constants.js'

let cachedClient: drive_v3.Drive | null = null

export function getDriveClient(): drive_v3.Drive {
  if (cachedClient) {
    return cachedClient
  }

  const env = getEnv()

  const auth = new google.auth.JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY,
    scopes: [DRIVE_SCOPE],
  })

  cachedClient = google.drive({ version: DRIVE_API_VERSION, auth })

  return cachedClient
}