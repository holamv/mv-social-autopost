# Variables de entorno

Todas se cargan en Vercel en **Settings → Environment Variables**, marcadas para el
entorno **Production** (el cron solo corre en produccion). Para desarrollo local van
en `.env.local`, que nunca se commitea.

Las 11 primeras son obligatorias: si falta cualquiera, la funcion responde 500 y en
los logs aparece `Invalid environment configuration` con el nombre de la que falta.
La validacion vive en [`src/config/env.ts`](../src/config/env.ts).

Antes de ese error se registra una linea `[Env] Invalid environment variables:` con
un JSON por variable (`variable`, `code`), nunca con el valor ni el mensaje de Zod. Se busca en
Vercel en **Logs** filtrando por `[Env]`:

| `code` | Que significa |
|---|---|
| `invalid_type` | La variable no existe en ese entorno |
| `invalid_string` | Existe pero el formato es incorrecto (URL o email) |
| `too_small` | Existe pero esta vacia |
| `invalid_enum_value` | Valor fuera de la lista permitida (p. ej. `MARK_STRATEGY` distinto de `properties` o `move`) |
| `custom` | Regla cruzada, p. ej. `MARK_STRATEGY=move` sin `DRIVE_PUBLISHED_FOLDER_ID` |

## Credenciales de Google Drive

| Variable | Obligatoria | De donde sale |
|---|---|---|
| `GOOGLE_CLIENT_EMAIL` | si | Campo `client_email` del JSON de la cuenta de servicio |
| `GOOGLE_PRIVATE_KEY` | si | Campo `private_key` del mismo JSON, con los `-----BEGIN PRIVATE KEY-----` incluidos |

`GOOGLE_PRIVATE_KEY` tiene saltos de linea. En Vercel se pega completa tal cual. Si
el valor queda con `\n` escapados, el codigo los convierte solo.

## IDs de carpetas de Drive

| Variable | Obligatoria | De donde sale |
|---|---|---|
| `DRIVE_SOURCE_FOLDER_ID` | si | Lo que aparece en la URL despues de `/folders/` |
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

## Checklist antes del primer deploy

1. Las 11 variables obligatorias cargadas en **Production**.
2. Carpeta de origen compartida con la cuenta de servicio como **Editor**.
3. Si `MARK_STRATEGY='move'`, la carpeta destino tambien compartida como Editor.
4. `PUBLIC_BASE_URL` apuntando al dominio de produccion.
5. App de Meta en modo **Live** y token de larga duracion.
6. Primera corrida manual con `curl` antes de esperar al cron (ver README, seccion 5).
