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

## Bot de Discord

Opcionales: si faltan, el cron sigue funcionando y solo `/api/discord/interactions`
responde 500. Ver [DISCORD_BOT.md](DISCORD_BOT.md).

| Variable | Donde va | De donde sale |
|---|---|---|
| `DISCORD_APPLICATION_ID` | Vercel | Portal de Discord → General Information |
| `DISCORD_PUBLIC_KEY` | Vercel | Portal de Discord → General Information |
| `DISCORD_PUBLISHER_IDS` | Vercel, opcional | IDs de usuario o rol de Discord que pueden usar `/publicar-ahora`, separados por coma. Los administradores siempre pueden |
| `DISCORD_BOT_TOKEN` | Solo tu maquina, para `npm run discord:register` | Portal de Discord → Bot → Reset Token |
| `DISCORD_GUILD_ID` | Solo tu maquina | ID del servidor de MV: `619991595613290496` |

## Checklist antes del primer deploy

1. Las 11 variables obligatorias cargadas en **Production**.
2. Carpeta de origen compartida con la cuenta de servicio como **Editor**.
3. Si `MARK_STRATEGY='move'`, la carpeta destino tambien compartida como Editor.
4. `PUBLIC_BASE_URL` apuntando al dominio de produccion.
5. App de Meta en modo **Live** y token de larga duracion.
6. Primera corrida manual con `curl` antes de esperar al cron (ver README, seccion 5).
