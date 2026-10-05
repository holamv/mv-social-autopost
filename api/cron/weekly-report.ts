import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getEnv } from '../../src/config/env.js'
import { sendChannelMessage } from '../../src/discord/botApi.js'
import { buildContentReport } from '../../src/report/contentReport.js'
import { fetchWeeklyEvolution, weeklyReportDisabledReason } from '../../src/report/weeklyKpis.js'
import {
  AUTHORIZATION_HEADER,
  BEARER_PREFIX,
  HTTP_INTERNAL_ERROR,
  HTTP_METHOD_GET,
  HTTP_METHOD_NOT_ALLOWED,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
} from '../../src/config/constants.js'

const HTTP_SERVICE_UNAVAILABLE = 503
const REPORT_WEEKS = 5
const LIMA_OFFSET_MS = 18000000
const ISO_DATE_LENGTH = 10
const UNAUTHORIZED_MESSAGE = 'No autorizado'
const METHOD_MESSAGE = 'Metodo no permitido'
const NO_WEEK_MESSAGE = 'No hay una semana cerrada para reportar'
const REPORT_ERROR_MESSAGE = 'No se pudo armar o publicar el reporte semanal'

function todayInLima(): string {
  return new Date(Date.now() - LIMA_OFFSET_MS).toISOString().slice(0, ISO_DATE_LENGTH)
}

function isAuthorized(request: VercelRequest): boolean {
  return request.headers[AUTHORIZATION_HEADER] === `${BEARER_PREFIX}${getEnv().CRON_SECRET}`
}

async function publishReport(): Promise<string | null> {
  const report = buildContentReport(await fetchWeeklyEvolution(REPORT_WEEKS), todayInLima())

  if (!report) {
    return null
  }

  return sendChannelMessage(getEnv().DISCORD_REPORT_CHANNEL_ID ?? '', { content: report, components: [] })
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== HTTP_METHOD_GET) {
    response.status(HTTP_METHOD_NOT_ALLOWED).json({ success: false, data: null, error: METHOD_MESSAGE })
    return
  }

  try {
    if (!isAuthorized(request)) {
      response.status(HTTP_UNAUTHORIZED).json({ success: false, data: null, error: UNAUTHORIZED_MESSAGE })
      return
    }

    const disabledReason = weeklyReportDisabledReason()

    if (disabledReason) {
      response.status(HTTP_SERVICE_UNAVAILABLE).json({ success: false, data: null, error: disabledReason })
      return
    }

    const messageId = await publishReport()
    const error = messageId ? undefined : NO_WEEK_MESSAGE

    response.status(HTTP_OK).json({ success: Boolean(messageId), data: { messageId }, error })
  } catch (error) {
    console.error('[WeeklyReport] Error publicando el reporte:', error)
    response.status(HTTP_INTERNAL_ERROR).json({ success: false, data: null, error: REPORT_ERROR_MESSAGE })
  }
}
