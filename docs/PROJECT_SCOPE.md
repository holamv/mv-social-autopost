# PROJECT_SCOPE - mv-social-autopost

**Version:** 1.2.0
**Estado:** base funcional, sin desplegar
**Ultima actualizacion:** 2026-09-24

## Objetivo

Automatizar la publicacion de imagenes en la pagina de Facebook y la cuenta de
Instagram de Manzana Verde, tomando el contenido de una carpeta de Google Drive
que administra el equipo de marketing sin tocar codigo.

## Alcance

Dentro del alcance:
- Lectura periodica de una carpeta de Drive, ordenada por numero en el nombre.
- Filtro de imagenes ya publicadas y de las tomadas por otra ejecucion.
- Publicacion de imagen unica con texto en Facebook e Instagram.
- Marcado idempotente en Drive (`appProperties`) y movimiento opcional de carpeta.
- Disparo por Vercel Cron Job con secreto compartido.
- Bot de Discord con `/estado` y `/publicar-ahora` (ver `docs/DISCORD_BOT.md`).

Fuera del alcance por ahora:
- Carruseles, Reels, Stories y video.
- Programacion por imagen (cada archivo con su propio horario).
- Panel de administracion o vista previa.
- Metricas de alcance o interaccion despues de publicar.

## Estado de funcionalidades

| Funcionalidad | Estado |
|---|---|
| Autenticacion con Google Drive (cuenta de servicio) | done |
| Descarga de imagen a memoria con validacion y tope de peso | done |
| Listado de pendientes con orden numerico | done |
| Subcarpetas por red (`Facebook/`, `Instagram/`) con `Publicados/<red>` | done |
| Videos en Facebook e Instagram (Reels) | pendiente (fase 2) |
| LinkedIn (imagenes y videos) | done (falta aprobacion de LinkedIn y token) |
| YouTube Shorts | pendiente (fase 4) |
| Filtro de publicadas y lock anti-duplicado | done |
| URL temporal firmada para servir la imagen a Instagram | done |
| Publicacion en Facebook por subida binaria directa | done |
| Publicacion en Instagram con espera de contenedor | done |
| Marcado en Drive | done |
| Movimiento a carpeta Publicados, idempotente y con errores traducidos | done |
| Vercel Cron Job configurado (cada hora) | done |
| Corte por tiempo antes del limite de Vercel | done |
| Validacion de variables de entorno con Zod | done |
| Tolerancia de formato en `GOOGLE_PRIVATE_KEY` y validacion de IDs de carpeta | done |
| Bot informa en Discord que variable esta mal configurada | done |
| `/publicar-ahora` habilitado por lista de usuarios o roles (`DISCORD_PUBLISHER_IDS`) | done |
| Bot de Discord: `/estado` y `/publicar-ahora` por HTTP interactions | done (falta crear la app y agregarla al servidor) |
| Tests unitarios (ordering, signedUrl, pipeline, discord) | pendiente |
| Alertas a Discord cuando una publicacion falla | pendiente |
| Soporte de carrusel y video | pendiente |

## Estructura de archivos

```
api/cron/publish.ts        Handler del cron
api/media.ts               Handler de la imagen firmada
api/discord/interactions.ts  Endpoint de comandos de Discord
src/config/constants.ts    Valores fijos
src/config/env.ts          Schema Zod de entorno
src/config/privateKey.ts   Normalizacion y validacion de la clave de Google
src/core/deadline.ts       Presupuesto de tiempo
src/core/pipeline.ts       Orquestacion del ciclo por cola
src/core/publishers.ts     Publicador de cada red
src/core/routes.ts         Carpeta principal y subcarpetas por red
src/discord/access.ts      Quien puede usar /publicar-ahora
src/discord/api.ts         Edicion de la respuesta diferida
src/discord/commandDefinitions.ts  Nombres y definiciones de comandos
src/discord/commands.ts    Ejecucion de cada comando
src/discord/constants.ts   Valores fijos de Discord
src/discord/env.ts         Schema Zod de entorno de Discord
src/discord/messages.ts    Textos de respuesta
src/discord/verify.ts      Verificacion de firma Ed25519
src/drive/client.ts        Cliente autenticado de Drive
src/drive/download.ts      Descarga de imagenes a memoria
src/drive/folders.ts       Busqueda de subcarpetas por nombre
src/linkedin/client.ts     Token, encabezados versionados y renovacion
src/linkedin/media.ts      Subida de imagenes y videos por partes
src/linkedin/posts.ts      Creacion del post y escape de texto
src/linkedin/publish.ts    Flujo completo con reanudacion de videos
src/drive/listPending.ts   Consulta y filtros
src/drive/marking.ts       Lock y marcado de estado
src/drive/move.ts          Movimiento entre carpetas
src/drive/ordering.ts      Orden numerico
src/lib/signedUrl.ts       HMAC de URLs temporales
src/meta/client.ts         Cliente Graph API
src/meta/facebook.ts       Publicacion en pagina
src/meta/instagram.ts      Publicacion en Instagram
src/types.ts               Contratos compartidos
scripts/registerDiscordCommands.ts  Registro de comandos en el servidor
vercel.json                Cron y limites
```

## APIs consumidas

| API | Uso |
|---|---|
| Google Drive API v3 | `files.list`, `files.get` (metadatos y binario), `files.update` |
| Discord API v10 | `PUT /applications/{app}/guilds/{guild}/commands`, `PATCH /webhooks/{app}/{token}/messages/@original` |
| LinkedIn REST API (202609) | `/rest/images`, `/rest/videos` (initialize, finalize, estado), `/rest/posts` |
| Meta Graph API v21.0 | `/{page}/photos`, `/{ig-user}/media`, `/{ig-user}/media_publish` |

## Decisiones tecnicas

- **Facebook por binario, Instagram por URL:** Facebook acepta `multipart/form-data`,
  asi que recibe el Buffer directo y no depende de que este servidor sea alcanzable.
  Instagram solo acepta una URL publica, y para eso se expone `/api/media` con HMAC y
  vencimiento de 30 min, en lugar de dar lectura anonima a los archivos de Drive.
- **Mover = `files.update` con `addParents`/`removeParents`:** Drive v3 no tiene
  endpoint de mover; un archivo pertenece a una lista de carpetas padre y moverlo es
  agregar una y quitar otra en la misma llamada. `removeParents` se calcula desde los
  padres reales del archivo para no pedir quitar una carpeta que no lo contiene.
- **La descarga ocurre solo si Facebook falta:** en un reintento con
  `mvFacebookPostId` ya guardado no se baja la imagen; Instagram no la necesita.
- **Marcado en `appProperties` en vez de renombrar:** los metadatos no son visibles
  para quien administra la carpeta y no rompen el orden por nombre.
- **`BATCH_SIZE=1` por defecto:** mantiene cada ejecucion corta y evita la cuota de
  50 publicaciones diarias de Instagram.
- **Presupuesto propio 20 s antes del limite de Vercel:** si la funcion se pasa de
  `maxDuration`, Vercel la mata sin respuesta y las imagenes quedan con el candado
  puesto 15 minutos. Cortando antes, la funcion responde, informa que quedo pendiente
  y el estado queda limpio.
- **Descarga en memoria, nunca a disco:** en Vercel el unico directorio escribible
  es `/tmp`, es efimero y se comparte entre invocaciones de la misma instancia. Un
  Buffer evita restos entre ejecuciones y no necesita limpieza. El tope de
  `MAX_IMAGE_MEGABYTES` protege la memoria de la funcion.
- **`mvFacebookPostId` guardado antes de Instagram:** si Instagram falla, el
  reintento no duplica el post de Facebook.
- **Discord por HTTP interactions, no por gateway:** un bot con gateway necesita un
  proceso siempre encendido, que Vercel no tiene. Con el Interactions Endpoint cada
  comando es una peticion firmada; se responde diferido antes de los 3 s y el trabajo
  sigue con `waitUntil`. El token del bot solo se usa para registrar comandos, desde
  local, y nunca se carga en Vercel.
- **Rutas por subcarpeta:** cada carpeta es una cola con sus redes. Cada red guarda
  su propio ID de publicacion en `appProperties`, asi un reintento solo publica en
  la red que falto. Las subcarpetas de `Publicados` no se crean solas porque una
  cuenta de servicio no puede ser duena de archivos en un Drive personal.
- **LinkedIn, videos por partes desde Drive:** cada parte de 4 MB se baja de Drive
  con `Range` y se sube directo, asi un video grande no ocupa la memoria de la
  funcion. El URN del video se guarda apenas termina la subida para no repetirla si
  LinkedIn todavia lo esta procesando.
