# Bot de Discord

Permite manejar la publicacion desde el Discord de Manzana Verde sin esperar al cron.

| Comando | Quien puede usarlo | Que hace |
|---|---|---|
| `/estado` | Cualquier miembro | Muestra cuantas imagenes quedan y las 5 proximas. Solo lo ve quien lo pide |
| `/publicar-ahora` | Administradores y los IDs de usuario o rol en `DISCORD_PUBLISHER_IDS` | Corre un ciclo de publicacion igual al del cron y deja el resultado en el canal |
| `/conectar-tiktok` | Los mismos que `/publicar-ahora` | Da un enlace firmado (vence en 10 min) para autorizar la cuenta de TikTok de MV |

## Aprobacion de TikTok

TikTok no permite publicar sin que una persona confirme cada video. Por cada MP4 nuevo
en `TikTok/`, el cron manda al canal `DISCORD_TIKTOK_CHANNEL_ID` un mensaje con la
cuenta, el texto, un enlace al video, un menu de privacidad (las opciones que TikTok
permite para esa cuenta, sin valor por defecto) y el boton **Publicar en TikTok**. Solo
publican los administradores y `DISCORD_PUBLISHER_IDS`. Al terminar, el mensaje se
edita con el resultado y se quitan los botones. Si falla, los botones quedan para
reintentar.

## Como funciona

El bot no queda "encendido". Discord manda cada comando como una peticion HTTP a
`/api/discord/interactions`, que corre en Vercel como las demas funciones.

```
Usuario escribe /publicar-ahora
        │
        ▼
Discord → POST /api/discord/interactions   ← firmado con Ed25519
        │
        ├─ 1. Verifica la firma con DISCORD_PUBLIC_KEY (si falla, 401)
        ├─ 2. Responde "pensando..." antes de los 3 s que exige Discord
        └─ 3. Sigue trabajando en segundo plano (waitUntil) y edita el
              mensaje con el resultado
```

`/publicar-ahora` usa los mismos candados que el cron (`mvLockedAt`,
`mvFacebookPostId`), asi que si coincide con una corrida programada no publica dos
veces la misma imagen.

## Puesta en marcha

Los pasos 1, 4 y 5 los hace una persona con acceso: no se pueden automatizar.

### 1. Crear la aplicacion en Discord

1. Entrar a https://discord.com/developers/applications → **New Application** →
   nombre `MV Social Autopost`.
2. En **General Information** copiar:
   - **Application ID** → `DISCORD_APPLICATION_ID`
   - **Public Key** → `DISCORD_PUBLIC_KEY`
3. En **Bot** → **Reset Token** y copiar el token → `DISCORD_BOT_TOKEN`.
   Se usa en el paso 5 y, si se activa TikTok, tambien en Vercel: el cron lo necesita
   para mandar los mensajes de aprobacion al canal.

### 2. Cargar las variables en Vercel

`DISCORD_APPLICATION_ID` y `DISCORD_PUBLIC_KEY` en **Settings → Environment
Variables** (Production), y redeployar.

### 3. Conectar el endpoint

En **General Information → Interactions Endpoint URL** poner:

```
https://<dominio-de-produccion>/api/discord/interactions
```

Al guardar, Discord manda una prueba firmada. Si no la acepta, revisar que el deploy
tenga las dos variables del paso 2.

### 4. Agregar el bot al servidor de Manzana Verde

Un bot no puede pedir unirse solo: lo agrega alguien con permiso **Gestionar
servidor**. Mandarle este enlace (reemplazando el ID):

```
https://discord.com/oauth2/authorize?client_id=<DISCORD_APPLICATION_ID>&scope=applications.commands
```

Pide solo `applications.commands`: el bot no lee mensajes ni tiene permisos sobre
canales.

### 5. Registrar los comandos

Una vez que el bot esta en el servidor:

```bash
export DISCORD_BOT_TOKEN='...'
export DISCORD_APPLICATION_ID='...'
export DISCORD_GUILD_ID='619991595613290496'
npm run discord:register
```

Debe imprimir `Registered commands: /estado, /publicar-ahora`. Se vuelve a correr solo
si cambian los comandos en `src/discord/commandDefinitions.ts`.

### 6. Dar acceso a `/publicar-ahora`

El comando se ve para todos, pero el bot solo publica si quien lo usa es
administrador o si su ID de usuario, o el de alguno de sus roles, esta en
`DISCORD_PUBLISHER_IDS` (Vercel, separados por coma). El resto recibe un aviso que
solo ve esa persona.

Para sacar un ID: Discord → Ajustes → Avanzado → activar **Modo desarrollador**, y
despues clic derecho sobre la persona o el rol → **Copiar ID**. Cambiar la lista
requiere redeploy, no volver a registrar comandos.
