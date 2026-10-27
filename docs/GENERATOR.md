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

Para sacar los valores de Mexico o Colombia se repiten los pasos de la seccion 2 del
README con un usuario que administre esa pagina: `GET /me/accounts` da el
`access_token` de la pagina y `GET /{page-id}?fields=instagram_business_account` da el
ID de la cuenta. Despues de cargarlos en Vercel hay que redeployar.

## Por que el pais viaja en el archivo de Drive

La imagen se sube a la carpeta `Instagram/` del Drive del autopost, porque Instagram
baja la imagen desde `/api/media` y esa ruta la sirve desde Drive. Al subirla se guarda
el pais en la propiedad `mvInstagramCountry`. El publicador lee esa propiedad, asi que
si el cron agarra el archivo antes que el generador, o si se reintenta, igual publica
en la cuenta correcta. Un archivo sin esa propiedad (los que sube marketing a mano) va
a la cuenta principal, como antes.

## Logs

- `[Instagram] instagram_post_published country=.. mediaId=..` cada publicacion.
- `[Instagram] instagram_account_missing country=..` cuando un archivo pide un pais sin
  cuenta conectada.
- `[Generator] instagram_post_rejected reason=account_missing country=..` cuando el
  generador pide un pais sin cuenta (no se sube nada).
- `[Generator] instagram_username_unresolved country=..` cuando Meta no devuelve el
  usuario de una cuenta en el `GET`; suele ser un token vencido o de otra pagina.
