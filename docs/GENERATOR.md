# Publicacion desde el generador de posts

El generador de posts (`mv-generador-posts.vercel.app`) arma la imagen en el navegador
y la manda a este servicio para publicarla al instante. El generador nunca ve los
tokens de Meta: su backend reenvia el pedido con `GENERATOR_API_TOKEN`.

## Ruta

`/api/generator/publish`, con `Authorization: Bearer $GENERATOR_API_TOKEN`.

- `GET` devuelve que canales estan activos y que cuenta de Instagram hay por pais:

  ```json
  {
    "success": true,
    "data": {
      "instagram": {
        "enabled": true,
        "reason": null,
        "country": "PE",
        "username": "manzanaverde.pe",
        "accounts": {
          "PE": { "connected": true, "username": "manzanaverde.pe" },
          "MX": { "connected": true, "username": "manzanaverde.mx" },
          "CO": { "connected": false, "username": null }
        }
      },
      "linkedin": { "enabled": true, "reason": null }
    }
  }
  ```

  `country` y `username` son los de la cuenta principal y se mantienen para que una
  version vieja del generador siga funcionando. El generador nuevo lee `accounts`.
  El tipo de esta respuesta es `GeneratorStatus` en `src/generator/submit.ts`.

  `connected: true` solo dice que hay un ID cargado para ese pais, no que el token
  sirva. Si viene con `username: null`, Meta no respondio con esas credenciales: casi
  siempre es un token vencido o de otra pagina, y publicar tambien va a fallar.

- `POST` publica. Cuerpo: `channel` (`instagram` o `linkedin`), `country` (`PE`, `MX`
  o `CO`, solo Instagram; si falta se usa `META_INSTAGRAM_COUNTRY`), `caption`,
  `mimeType` (`image/jpeg` o `image/png`) y `dataBase64`. Si el pais no tiene cuenta
  conectada responde `409` sin subir nada a Drive.

## Una cuenta de Instagram por pais

Cada pais tiene su propia pagina de Facebook con su propia cuenta de Instagram
Business, y un token de pagina solo sirve para la cuenta de esa pagina. Por eso cada
pais se configura aparte:

| Pais | Cuenta | Token |
|---|---|---|
| El de `META_INSTAGRAM_COUNTRY` (default `PE`) | `META_INSTAGRAM_USER_ID` | `META_GRAPH_ACCESS_TOKEN` |
| `MX` | `META_INSTAGRAM_USER_ID_MX` | `META_GRAPH_ACCESS_TOKEN_MX` |
| `CO` | `META_INSTAGRAM_USER_ID_CO` | `META_GRAPH_ACCESS_TOKEN_CO` |

Si un pais tiene su ID pero no su token, se usa `META_GRAPH_ACCESS_TOKEN`. Eso solo
funciona si ese token es de un usuario del sistema con acceso a las tres paginas; con
un token de pagina Meta rechaza la publicacion y el error vuelve al generador.

El pais principal tambien acepta `META_INSTAGRAM_USER_ID_PE` y
`META_GRAPH_ACCESS_TOKEN_PE` (o el sufijo que corresponda). Si se cargan, **pisan** a
las genericas solo para publicar en Instagram; Facebook y `/api/metrics` siguen
usando `META_INSTAGRAM_USER_ID` y `META_GRAPH_ACCESS_TOKEN`. Lo normal es no cargarlas:
si apuntan a otra cuenta, se publica en una y se miden metricas de otra.

Para sacar los valores de Mexico o Colombia se repiten los pasos de la seccion 2 del
README con un usuario que administre esa pagina: `GET /me/accounts` da el
`access_token` de la pagina y `GET /{page-id}?fields=instagram_business_account` da el
ID de la cuenta. Despues de cargarlos en Vercel hay que redeployar.

## Por que el pais viaja en el archivo de Drive

La imagen se sube a la carpeta `Instagram/` del Drive del autopost, porque Instagram
baja la imagen desde `/api/media` y esa ruta la sirve desde Drive. Al subirla se guarda
el pais en la propiedad `mvInstagramCountry`. El publicador lee esa propiedad, asi que
si el cron agarra el archivo antes que el generador, o si se reintenta, la cuenta sale
bien. Ojo: la cuenta sale bien, pero hay dos caminos a un post duplicado que ya
existian antes de las cuentas por pais:

- El cron y el generador agarran el mismo archivo si coinciden en el mismo medio
  segundo, y los dos publican.
- Si Instagram ya publico y despues falla algo en Drive (guardar el id, marcar o mover
  el archivo), el generador manda el archivo a la papelera y responde error. Si la
  persona reintenta, sale un segundo post.

Un archivo sin esa propiedad (los que sube marketing a mano) va a la cuenta principal,
como antes. Un archivo con un valor que no es `PE`, `MX` ni `CO` no se publica: falla
con error en vez de irse en silencio a la cuenta principal.

## Logs

Mismo formato que el resto del repo: `[Modulo] Frase`, con el archivo y el pais.

- `[Instagram] Publicado el archivo <fileId> en la cuenta de <pais>: media <mediaId>`
  en cada publicacion, venga del generador o del cron.
- `[Instagram] Sin cuenta de <pais> para publicar el archivo <fileId>` cuando un archivo
  pide un pais sin cuenta conectada.
- `[Instagram] El archivo <fileId> pide un pais desconocido: <valor>`.
- `[Generator] Rechazado: no hay cuenta de Instagram de <pais>, no se subio nada a Drive`.
- `[Generator] No se pudo publicar el archivo <fileId> en <canal> <pais>:` con el error
  de Meta o de Drive. Despues de este log el archivo va a la papelera.
- `[Generator] Meta no devolvio el usuario de Instagram de <pais>:` en el `GET`; suele ser
  un token vencido o de otra pagina.

## Tests

`npm test` corre `test/` con el runner de Node. `test/instagramPublishing.test.ts`
simula Meta reemplazando `fetch` y comprueba que un archivo de MX sale por la cuenta y
el token de MX, que uno sin pais sale por la principal y que un pais sin cuenta o
desconocido falla sin llamar a Meta. Tambien hace la ida y vuelta completa: las
propiedades que escribe el generador (`sourceProperties`) se leen como las lee el cron
(`toPendingImage`) y el post sale por la cuenta de ese pais.

`test/support/resolveTs.mjs` deja que Node resuelva los imports `.js` del codigo a sus
archivos `.ts`. Usa `module.registerHooks`, asi que `npm test` necesita Node 22.15 o
mas nuevo (Vercel solo ejecuta las funciones, no los tests).
