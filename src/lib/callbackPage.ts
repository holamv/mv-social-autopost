const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' }
const HTML_SPECIAL_CHARACTERS = /[&<>"']/g
const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(text: string): string {
  return text.replace(HTML_SPECIAL_CHARACTERS, (character) => HTML_ENTITIES[character] ?? character)
}

export function callbackPage(title: string, message: string, status: number): Response {
  return new Response(`<!doctype html><meta charset="utf-8"><title>${title}</title><p>${message}</p>`, {
    status,
    headers: HTML_HEADERS,
  })
}
