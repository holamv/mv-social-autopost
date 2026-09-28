const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' }

export function callbackPage(title: string, message: string, status: number): Response {
  return new Response(`<!doctype html><meta charset="utf-8"><title>${title}</title><p>${message}</p>`, {
    status,
    headers: HTML_HEADERS,
  })
}
