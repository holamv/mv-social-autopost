# Bot de Discord

Permite manejar la publicacion desde el Discord de Manzana Verde sin esperar al cron.

| Comando | Quien puede usarlo | Que hace |
|---|---|---|
| `/estado` | Cualquier miembro | Muestra cuantas imagenes quedan y las 5 proximas. Solo lo ve quien lo pide |
| `/publicar-ahora` | Solo administradores, salvo que un admin lo habilite para un rol | Corre un ciclo de publicacion igual al del cron y deja el resultado en el canal |

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
   Solo se usa en el paso 5, desde tu maquina. **No va en Vercel.**

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

Por defecto solo lo ven los administradores. Para habilitarlo a un rol (por ejemplo
Marketing): **Ajustes del servidor → Integraciones → MV Social Autopost →
`/publicar-ahora` → agregar rol**.
