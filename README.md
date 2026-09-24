# mv-social-autopost

Publica automaticamente imagenes de una carpeta de Google Drive en una pagina de
Facebook y en una cuenta de Instagram, una por vez, en orden numerico, sin repetir.

Corre en Vercel como **Serverless Function** (una funcion que solo se ejecuta cuando
alguien la llama, y no cuesta nada mientras duerme) disparada por un **Cron Job**
(un reloj que llama a esa funcion en un horario fijo).

---

## Como funciona

```
Vercel Cron (horario fijo)
        │
        ▼
GET /api/cron/publish          ← protegido con CRON_SECRET
        │
        ├─ 1. Lista la carpeta de Drive
        │     · solo imagenes, sin papelera
        │     · descarta las que ya tienen la marca mvStatus=published
        │     · descarta las que otra ejecucion tomo hace menos de 15 min
        │     · ordena por el numero al inicio del nombre (1, 2, 10, 11...)
        │
        ├─ 2. Toma las primeras BATCH_SIZE imagenes (por defecto 1)
        │
        ├─ 3. Marca la imagen como "en proceso" (mvLockedAt)
        │
        ├─ 4. Descarga la imagen a memoria (Buffer, sin tocar disco)
        │
        ├─ 5. Publica en Facebook subiendo el binario (multipart/form-data)
        │     → guarda mvFacebookPostId
        │
        ├─ 6. Publica en Instagram con una URL temporal firmada
        │     https://tu-app.vercel.app/api/media?file=...&expires=...&signature=...
        │     → crea contenedor, espera FINISHED, publica
        │
        └─ 7. Marca como publicada (mvStatus=published) y, si corresponde,
              mueve el archivo a la carpeta de publicadas
```

### Carpetas por red

Dentro de la carpeta de origen se puede elegir en que red sale cada archivo:

```
Carpeta de origen
├── foto-suelta.jpg   → Facebook + Instagram
├── Facebook/         → solo Facebook
└── Instagram/        → solo Instagram
```

- Los nombres de las subcarpetas son exactos: `Facebook` e `Instagram`. Si una no
  existe, esa cola simplemente no se procesa.
- Cada corrida publica hasta `BATCH_SIZE` archivos **por cola**, en orden numerico.
- Con `MARK_STRATEGY='move'`, lo publicado se mueve a `Publicados/` (sueltas) o a
  `Publicados/Facebook/` y `Publicados/Instagram/`. Esas subcarpetas se crean a mano
  en Drive: si faltan, el archivo queda marcado como publicado pero no se mueve.
- `/estado` en Discord muestra cada cola por separado.

### Por que cada red se publica distinto

**Facebook acepta el archivo directo.** La imagen se descarga de Drive a memoria y
se sube como `multipart/form-data`, igual que un formulario con un archivo adjunto.
Facebook nunca necesita alcanzar este servidor.

**Instagram no.** Exige una URL publica desde donde bajar la imagen; no existe forma
de pasarle los bytes. Los archivos de Drive no son publicos, y en vez de abrir la
carpeta a todo internet, el proyecto expone la imagen por `/api/media` con una firma
criptografica (HMAC) que vence a los 30 minutos. Solo Meta la usa, durante ese rato,
y despues el enlace deja de servir.

Nada se guarda en disco: la imagen vive en un `Buffer` mientras dura la ejecucion.

### Como se evita publicar dos veces

Tres candados independientes:

| Candado | Que hace |
|---|---|
| `mvStatus=published` | La consulta a Drive ya ni siquiera trae esas imagenes |
| `mvLockedAt` | Si dos ejecuciones se pisan, la segunda salta la imagen tomada |
| `mvFacebookPostId` | Si Instagram falla despues de Facebook, el reintento no repite el post de Facebook |

Estas marcas viven en `appProperties` de Drive: metadatos invisibles para quien
mira la carpeta, no ensucian el nombre ni el contenido del archivo.

---

## Estructura

```
api/
  cron/publish.ts        Funcion que dispara el cron
  media.ts               Sirve la imagen firmada a Instagram
  discord/interactions.ts  Comandos del bot de Discord
src/
  config/constants.ts    Todos los valores fijos
  config/env.ts          Validacion de variables de entorno con Zod
  core/deadline.ts       Presupuesto de tiempo de la ejecucion
  core/pipeline.ts       Orquestacion del ciclo completo
  discord/               Firma, comandos y respuestas del bot
  drive/client.ts        Cliente autenticado de Google Drive
  drive/download.ts      Descarga a memoria y Blob para subida binaria
  drive/listPending.ts   Consulta y filtro de pendientes
  drive/marking.ts       Lock y marcado de estado
  drive/move.ts          Movimiento entre carpetas de Drive
  drive/ordering.ts      Orden numerico por nombre
  lib/signedUrl.ts       Firma y verificacion de URLs temporales
  meta/client.ts         Cliente HTTP del Graph API
  meta/facebook.ts       Publicacion en la pagina por binario
  meta/instagram.ts      Contenedor + espera + publicacion
scripts/
  registerDiscordCommands.ts  Registra /estado y /publicar-ahora
vercel.json              Cron y limites de ejecucion
```

El bot de Discord se configura aparte: ver [docs/DISCORD_BOT.md](docs/DISCORD_BOT.md).

---

## 1. Configurar Google Drive

1. Entrar a [Google Cloud Console](https://console.cloud.google.com) y crear un
   proyecto (o usar uno existente).
2. **APIs y servicios → Biblioteca** → buscar *Google Drive API* → **Habilitar**.
3. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**.
   Una cuenta de servicio es un "usuario robot": tiene su propio correo y se
   autentica con una llave, no con contrasena.
4. Abrir la cuenta creada → pestana **Claves** → **Agregar clave → Crear clave
   nueva → JSON**. Se descarga un archivo.
5. De ese JSON se usan dos campos:
   - `client_email` → va en `GOOGLE_CLIENT_EMAIL`
   - `private_key` → va en `GOOGLE_PRIVATE_KEY`
6. **Compartir la carpeta de Drive con ese `client_email`**, con permiso de
   **Editor** (necesita editar para poder marcar y mover archivos). Sin este paso
   la cuenta de servicio no ve nada.
7. El ID de la carpeta es lo que aparece en la URL despues de `/folders/`:
   `https://drive.google.com/drive/folders/1AbCdEf...` → `DRIVE_SOURCE_FOLDER_ID`.
8. Si se usa `MARK_STRATEGY='move'`, crear una segunda carpeta "Publicadas",
   compartirla igual y poner su ID en `DRIVE_PUBLISHED_FOLDER_ID`.

**Nombre y texto de cada imagen:**
- El nombre define el orden: `01 - promo lunes.jpg`, `02 - receta.png`, etc.
  Se lee el numero del inicio; las que no tienen numero van al final.
- El **texto del post sale de la descripcion del archivo en Drive**
  (clic derecho → Detalles del archivo → Agregar descripcion). Si esta vacia se
  usa `DEFAULT_CAPTION`.

## 2. Configurar Meta (Facebook + Instagram)

Requisitos previos del lado de las cuentas:
- La cuenta de Instagram debe ser **Business** (no personal ni de creador).
- Debe estar **vinculada a la pagina de Facebook** desde la configuracion de la pagina.

Pasos:

1. Entrar a [developers.facebook.com](https://developers.facebook.com) → **Mis apps
   → Crear app** → tipo **Business**.
2. Agregar los productos **Facebook Login for Business** e **Instagram Graph API**.
3. Abrir el [Explorador de la API Graph](https://developers.facebook.com/tools/explorer),
   elegir la app y pedir estos permisos:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management`
4. Generar el token de usuario y obtener los IDs:
   - `GET /me/accounts` → devuelve la lista de paginas. El `id` de la pagina es
     `META_PAGE_ID` y su `access_token` es el token de pagina.
   - `GET /{META_PAGE_ID}?fields=instagram_business_account` → devuelve el
     `META_INSTAGRAM_USER_ID`.
5. **Convertir el token en uno de larga duracion.** Los tokens cortos vencen en
   horas y el cron dejaria de funcionar en silencio:
   ```
   GET /oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={APP_ID}
     &client_secret={APP_SECRET}
     &fb_exchange_token={TOKEN_CORTO}
   ```
   Un token **de pagina** derivado de un token de usuario de larga duracion no
   vence. Alternativa mas robusta para produccion: crear un **usuario del sistema**
   en Meta Business Suite y generar desde ahi un token sin vencimiento.
6. Ese token final va en `META_GRAPH_ACCESS_TOKEN`.
7. Mientras la app este en modo desarrollo solo funciona con cuentas que figuren
   como administradoras. Para uso real hay que pasarla a **modo Live** y completar
   la **verificacion del negocio**.

## 3. Variables de entorno

Copiar `.env.example` a `.env.local` para desarrollo y cargarlas en Vercel en
**Settings → Environment Variables** para el deploy.

| Variable | Para que sirve |
|---|---|
| `GOOGLE_CLIENT_EMAIL` | Correo de la cuenta de servicio |
| `GOOGLE_PRIVATE_KEY` | Llave privada del JSON, entre comillas simples |
| `DRIVE_SOURCE_FOLDER_ID` | Carpeta con las imagenes por publicar |
| `DRIVE_PUBLISHED_FOLDER_ID` | Carpeta destino, solo si `MARK_STRATEGY='move'` |
| `MARK_STRATEGY` | `properties` (marca y deja) o `move` (marca y mueve) |
| `META_GRAPH_ACCESS_TOKEN` | Token de pagina de larga duracion |
| `META_PAGE_ID` | ID de la pagina de Facebook |
| `META_INSTAGRAM_USER_ID` | ID de la cuenta de Instagram Business |
| `PUBLIC_BASE_URL` | URL publica del deploy, ej. `https://mv-social-autopost.vercel.app` |
| `MEDIA_SIGNING_SECRET` | Secreto para firmar las URLs de imagen |
| `CRON_SECRET` | Secreto que Vercel manda para autorizar el cron |
| `BATCH_SIZE` | Cuantas imagenes por ejecucion (recomendado: 1) |
| `DEFAULT_CAPTION` | Texto a usar si el archivo no tiene descripcion |

Generar los secretos con:

```bash
openssl rand -hex 32
```

> Usar **comillas simples** en los valores. Las dobles expanden `$` y si el valor
> lo contiene queda mutilado, sin ningun error visible.

La llave privada de Google tiene saltos de linea. En Vercel se pega completa tal
cual; si se guarda con `\n` escapados, `src/config/env.ts` los convierte solo.

## 4. Deploy y cron

```bash
npm install
npx vercel link
npx vercel deploy --prod
```

El cron ya esta declarado en `vercel.json`:

```json
{ "path": "/api/cron/publish", "schedule": "0 * * * *" }
```

- `0 * * * *` corre **cada hora en punto**. Con `BATCH_SIZE=1` eso son hasta 24
  publicaciones por dia, debajo del limite de 50 de Instagram. Si hay menos
  imagenes pendientes, las corridas sobrantes no hacen nada y responden 200.
- Los horarios estan en **UTC**. Para publicar una vez al dia a las 9:00 de Peru
  o Colombia (UTC-5) seria `0 14 * * *`.
- Vercel agrega solo el header `Authorization: Bearer $CRON_SECRET`, por eso hay
  que definir `CRON_SECRET` en las variables de entorno del proyecto.
- **Plan Hobby: el cron solo puede correr una vez por dia.** El `0 * * * *` de
  arriba necesita plan **Pro**. En Hobby hay que cambiarlo por un horario diario
  como `0 14 * * *`, o el deploy falla.
- El cron solo corre en **produccion**, no en los preview deploys.

Para publicar solo en ciertas horas en vez de cada hora, por ejemplo tres veces
al dia:

```json
"crons": [
  { "path": "/api/cron/publish", "schedule": "0 14,18,23 * * *" }
]
```

## 5. Probar

Ejecucion manual, sin esperar al horario:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://tu-app.vercel.app/api/cron/publish
```

Codigos de respuesta:

| Codigo | Significado |
|---|---|
| `200` | Todo bien, con o sin imagenes publicadas |
| `207` | Se publicaron algunas y fallaron otras |
| `401` | Falta o no coincide el `CRON_SECRET` |
| `405` | Se llamo con un metodo distinto de GET |
| `500` | Fallo el ciclo entero, o fallaron todas las imagenes intentadas |

Respuesta esperada:

```json
{
  "success": true,
  "data": {
    "pendingCount": 12,
    "published": [
      {
        "fileId": "1AbC...",
        "name": "01 - promo lunes.jpg",
        "facebookPostId": "1234_5678",
        "instagramMediaId": "1789..."
      }
    ],
    "failed": [],
    "skipped": 0
  }
}
```

`skipped` cuenta las imagenes que quedaron sin intentar porque se acabo el tiempo
de la funcion. Vuelven a estar disponibles en la corrida siguiente.

Los logs quedan en **Vercel → Deployments → Functions**, con los prefijos
`[Pipeline]` y `[Media]`.

## Limites a tener en cuenta

| Limite | Valor |
|---|---|
| Publicaciones de Instagram por API | 50 cada 24 horas |
| Formato de imagen en Instagram | JPEG; relacion de aspecto entre 4:5 y 1.91:1 |
| Peso maximo en Instagram | 8 MB |
| Duracion maxima de la funcion | 120 s (`vercel.json`) |
| Presupuesto interno antes de cortar | 100 s (20 s de margen para responder) |
| Vigencia del enlace firmado | 30 minutos |
| Lock por imagen | 15 minutos |

Si una imagen falla, se libera el lock y vuelve a intentarse en la siguiente
ejecucion; queda registrada en `failed` con el motivo.
