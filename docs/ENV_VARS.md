# Variables de entorno

Todas se cargan en Vercel en **Settings → Environment Variables**, marcadas para el
entorno **Production** (el cron solo corre en produccion). Para desarrollo local van
en `.env.local`, que nunca se commitea.

Las 11 primeras son obligatorias: si falta cualquiera, la funcion responde 500 y en
los logs aparece `Invalid environment configuration` con el nombre de la que falta.
La validacion vive en [`src/config/env.ts`](../src/config/env.ts).

## Credenciales de Google Drive

| Variable | Obligatoria | De donde sale |
|---|---|---|
| `GOOGLE_CLIENT_EMAIL` | si | Campo `client_email` del JSON de la cuenta de servicio |
| `GOOGLE_PRIVATE_KEY` | si | Campo `private_key` del mismo JSON, con los `-----BEGIN PRIVATE KEY-----` incluidos |

`GOOGLE_PRIVATE_KEY` tiene saltos de linea. En Vercel se pega completa tal cual. El
codigo tolera los errores comunes al pegarla: `\n` escapados, comillas alrededor,
espacios sobrantes, o el JSON entero de la cuenta de servicio (toma `private_key`).
Si aun asi no es una clave legible, la funcion falla al arrancar nombrando
`GOOGLE_PRIVATE_KEY`, y el bot de Discord lo dice en su respuesta.

## IDs de carpetas de Drive

| Variable | Obligatoria | De donde sale |
|---|---|---|
| `DRIVE_SOURCE_FOLDER_ID` | si | Lo que aparece en la URL despues de `/folders/` y antes de cualquier `?` (sin `?hl=es-419`) |
| `DRIVE_PUBLISHED_FOLDER_ID` | solo si `MARK_STRATEGY='move'` | Igual, en la carpeta "Publicados" |
| `MARK_STRATEGY` | no, default `properties` | `properties` marca y deja el archivo; `move` ademas lo mueve |

Ambas carpetas deben estar compartidas con `GOOGLE_CLIENT_EMAIL` con rol **Editor**.

## Tokens de Meta

| Variable | Obligatoria | De donde sale |
|---|---|---|
| `META_GRAPH_ACCESS_TOKEN` | si | Token de pagina de larga duracion (ver README, seccion 2) |
| `META_PAGE_ID` | si | `GET /me/accounts` |
| `META_INSTAGRAM_USER_ID` | si | `GET /{META_PAGE_ID}?fields=instagram_business_account` |

## Del propio servicio

| Variable | Obligatoria | De donde sale |
|---|---|---|
| `PUBLIC_BASE_URL` | si | URL de produccion del proyecto, sin barra final |
| `MEDIA_SIGNING_SECRET` | si | Generar con `openssl rand -hex 32` |
| `CRON_SECRET` | si | Generar con `openssl rand -hex 32` |
| `METRICS_API_TOKEN` | no | Generar con `openssl rand -hex 32`. Enciende `GET /api/metrics`; el mismo valor va como secret `AUTOPOST_METRICS_TOKEN` en el repo `mv-plan-contenidos` |
| `DATALAKE_API_TOKEN` | no | Token del Company Brain (`x-api-key`) para leer `/api/dris/weekly-evolution`. Enciende el reporte semanal de contenido. Lo da BizOps (Julio) |
| `DATALAKE_BASE_URL` | no | Default `https://data-lake-mv.manzanaverde.la` |
| `DISCORD_REPORT_CHANNEL_ID` | no | Canal de Discord donde el bot publica el reporte de los lunes (clic derecho en el canal → Copiar ID del canal). El bot necesita permiso para escribir ahí |

`CRON_SECRET` es el unico que Vercel usa por su cuenta: lo manda como
`Authorization: Bearer ...` al disparar el cron. Sin el, el endpoint queda abierto.

`PUBLIC_BASE_URL` debe apuntar al dominio de produccion, no a un preview. Si esta
mal, Facebook igual publica (recibe el binario) pero Instagram falla, porque
necesita alcanzar `/api/media`.

## Ajustes de comportamiento

| Variable | Obligatoria | Default | Que hace |
|---|---|---|---|
| `BATCH_SIZE` | no | `1` | Imagenes por ejecucion |
| `DEFAULT_CAPTION` | no | vacio | Texto a usar cuando el archivo no tiene descripcion en Drive |
| `SCHEDULE_TIMEZONE` | no | `America/Lima` | Zona horaria de los horarios de `/horario` (formato IANA, ej. `America/Bogota`) |

## LinkedIn

Opcionales. Sin `LINKEDIN_ORGANIZATION_ID` y un token, la carpeta `LinkedIn/` no se
publica. Ver README, seccion 2b.

| Variable | Obligatoria | De donde sale |
|---|---|---|
| `LINKEDIN_ORGANIZATION_ID` | para LinkedIn | Numero en `linkedin.com/company/<numero>/admin` |
| `LINKEDIN_ACCESS_TOKEN` | para LinkedIn, salvo que haya refresh | Token con `w_organization_social` de un admin de la pagina (60 dias) |
| `LINKEDIN_CLIENT_ID` | no | App de LinkedIn → Auth |
| `LINKEDIN_CLIENT_SECRET` | no | App de LinkedIn → Auth |
| `LINKEDIN_REFRESH_TOKEN` | no | Solo si LinkedIn aprobo refresh tokens para la app (1 año) |
| `LINKEDIN_API_VERSION` | no, default `202609` | Version `YYYYMM` de la API. LinkedIn retira cada version al año |

## YouTube

Opcionales. Sin ellas la carpeta `YouTube/` no se procesa y `/estado` lo dice.

| Variable | Obligatoria | Default | De donde sale |
|---|---|---|---|
| `YOUTUBE_CLIENT_ID` | para YouTube | — | Google Cloud → Credenciales → ID de cliente OAuth (web) |
| `YOUTUBE_CLIENT_SECRET` | para YouTube | — | Misma pantalla. Secreto |
| `YOUTUBE_PRIVACY` | no | `public` | `public`, `unlisted` o `private`. Sin auditoria, Google fuerza `private` |
| `YOUTUBE_CATEGORY_ID` | no | `26` | Categoria del video (26 = Consejos y estilo) |

El token del canal no va en Vercel: se guarda en Redis al usar `/conectar-youtube`.

## TikTok

Opcionales. Si falta cualquiera, la carpeta `TikTok/` no se procesa y `/estado` dice cual.

| Variable | De donde sale |
|---|---|
| `TIKTOK_CLIENT_KEY` | developers.tiktok.com → la app → Client key |
| `TIKTOK_CLIENT_SECRET` | Misma pantalla, Client secret. Secreto |
| `KV_REST_API_URL` | Vercel → Storage → Upstash Redis (se carga sola al conectar la base) |
| `KV_REST_API_TOKEN` | Idem. Guarda el token de TikTok, que cambia en cada renovacion |
| `DISCORD_BOT_TOKEN` | Ver seccion del bot. Hace falta para mandar los mensajes de aprobacion |
| `DISCORD_TIKTOK_CHANNEL_ID` | ID del canal de Discord donde se aprueba cada video |

## Higgsfield (videos con IA)

Opcionales. Encienden `/generar-video`. Ademas hacen falta `DISCORD_BOT_TOKEN` (para
avisar en el canal cuando el video esta listo) y Redis (`KV_REST_API_URL` y
`KV_REST_API_TOKEN`, para recordar cada pedido hasta que termine).

| Variable | Obligatoria | Default | De donde sale |
|---|---|---|---|
| `HF_API_KEY_ID` | para Higgsfield | — | console.higgsfield.ai → API keys. Es la parte antes de `:` |
| `HF_API_KEY_SECRET` | para Higgsfield | — | Misma credencial, la parte despues de `:`. Secreto |
| `HF_VIDEO_MODEL` | no | `kling-video/v2.5-turbo/pro/text-to-video` | Ruta del modelo de texto a video en Higgsfield, sin barra inicial (ej. `minimax/hailuo-2.3/standard/text-to-video`) |

## Bot de Discord

Opcionales: si faltan, el cron sigue funcionando y solo `/api/discord/interactions`
responde 500. Ver [DISCORD_BOT.md](DISCORD_BOT.md).

| Variable | Donde va | De donde sale |
|---|---|---|
| `DISCORD_APPLICATION_ID` | Vercel | Portal de Discord → General Information |
| `DISCORD_PUBLIC_KEY` | Vercel | Portal de Discord → General Information |
| `DISCORD_PUBLISHER_IDS` | Vercel, opcional | IDs de usuario o rol de Discord que pueden usar `/publicar-ahora`, separados por coma. Los administradores siempre pueden |
| `DISCORD_BOT_TOKEN` | Tu maquina para `npm run discord:register`; Vercel si se usa TikTok o `/generar-video` | Portal de Discord → Bot → Reset Token |
| `DISCORD_TIKTOK_CHANNEL_ID` | Vercel, para TikTok | Clic derecho sobre el canal de aprobacion → Copiar ID del canal |
| `DISCORD_GUILD_ID` | Solo tu maquina | ID del servidor de MV: `619991595613290496` |

## Checklist antes del primer deploy

1. Las 11 variables obligatorias cargadas en **Production**.
2. Carpeta de origen compartida con la cuenta de servicio como **Editor**.
3. Si `MARK_STRATEGY='move'`, la carpeta destino tambien compartida como Editor.
4. `PUBLIC_BASE_URL` apuntando al dominio de produccion.
5. App de Meta en modo **Live** y token de larga duracion.
6. Primera corrida manual con `curl` antes de esperar al cron (ver README, seccion 5).
