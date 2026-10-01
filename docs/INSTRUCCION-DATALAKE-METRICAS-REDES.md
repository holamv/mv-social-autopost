# INSTRUCCIÓN: Métricas orgánicas de redes en el data lake — #693–#695 automáticos + #700–#702

**Versión:** 2 (corregida con la revisión de Julio del 29/09)
**Fecha:** 2026-09-29 · **Repo:** `manzana-verde-datalake` · **Pide:** Adrian Amado
**DRI de las fórmulas:** Carolina Andrade (dri2: Adrian Amado) · **Dueño de la plomería:** Julio
**Fuente de datos:** `mv-social-autopost` → `GET /api/metrics` (ya en producción)
**Tiempo estimado:** 5–7 h · **Modo:** Implementación con STOPs

### Cambios respecto de la v1

| # | Qué cambió | Por qué |
|---|---|---|
| 1 | El bronze pasa de "una foto por día" a **un registro por publicación**, con `metrics_ultima` y `metrics_7d` | `saveBronze` hace upsert por `source, entity, semana_id` (`persistence.js:70`): con una foto diaria bajo la semana de hoy, cada día pisaba al anterior. Y una fecha como `semana_id` la borra `prune-bronze-retention.mjs:41` por basura |
| 2 | Todas las semanas se calculan **en hora Lima** (−5 h antes de `semanaIdFrom`) | `semanaIdFrom` toma los 10 primeros caracteres (`isoWeek.js:24`). Un domingo 21:00 de Lima es lunes en UTC y caía en la semana siguiente |
| 3 | El silver se carga en **`loadSilvers`**, y la lógica va en un archivo nuevo `server/dris/socialOrganic.js` | Los resolvers solo ven lo que `loadSilvers` trae entidad por entidad. `kpi-resolver.js` ya pasa las 300 líneas y no puede crecer |
| 4 | El silver **se persiste** con `saveSilver` para W, W−1 y W−2, y lee `metrics_7d` del registro | La v1 lo calculaba pero no decía que se guardara |
| 5 | El hallazgo de seguridad **sale de este sprint** | Julio lo confirmó y lo trata aparte, con prioridad |

---

## 🚨 Contexto

Carolina ya tiene tres KPIs de contenido: **#693** piezas publicadas, **#694** alcance por pieza y **#695** interacción por pieza. Hoy son `ingreso_kpi = 'Manual'`: Adrian carga cada semana 21 inputs (`kpi693-pais-*`, `kpi694-alcance-*`, `kpi695-interacciones-*`) en `dris_input_values`. **Medido 2026-09-29: esos inputs no tienen ninguna carga**, así que los tres KPIs salen vacíos en todas las semanas.

Mientras tanto, `mv-social-autopost` (el servicio que publica solo en Facebook, Instagram, TikTok y YouTube desde Drive) ya lee las métricas de lo publicado con las mismas credenciales con las que publica. Este sprint conecta esa fuente al lake y los tres KPIs pasan a calcularse solos.

### HECHO 1 — La fuente ya existe y responde

`GET https://mv-social-autopost.vercel.app/api/metrics`, con `Authorization: Bearer <METRICS_API_TOKEN>`. Adrian pasa el token por canal privado, no por Discord.

```json
{
  "success": true,
  "data": {
    "updatedAt": "2026-09-29T15:20:00.000Z",
    "networks": ["facebook", "instagram", "youtube"],
    "failures": { "tiktok": "TikTok respondio scope_not_authorized ..." },
    "posts": [
      {
        "network": "instagram",
        "url": "https://www.instagram.com/p/Dd2AielGM1O/",
        "publishedAt": "2026-09-28T17:14:10.000Z",
        "metrics": { "views": null, "likes": 4, "comments": 0, "saves": null }
      }
    ]
  }
}
```

- Devuelve las **últimas 50 publicaciones por red**. Los números son **acumulados de por vida** de cada publicación, no de la semana.
- `publishedAt` viene **en UTC**.
- Cada red trae métricas distintas:

| Red | Campos en `metrics` |
|---|---|
| facebook | `reach`, `likes`, `comments`, `shares` |
| instagram | `views`, `likes`, `comments`, `saves` |
| youtube | `views`, `likes`, `comments`, `shares` (siempre `null`) |
| tiktok | `views`, `likes`, `comments`, `shares` |

- Si una red falla, las demás llegan igual y el error queda en `data.failures`. **Una red en `failures` significa "sin dato", nunca cero.**
- `null` en una métrica significa que la API no la entregó (permiso o red que no la expone). Tampoco es cero.

### HECHO 2 — Lo que hoy llega y lo que no (medido 2026-09-29)

| Red | Estado | Publicaciones | Qué falta |
|---|---|---|---|
| Facebook | ✅ | 50 | `reach` llega en `null`: al token le falta el permiso de estadísticas (`read_insights`) |
| Instagram | ✅ | 50 | `views` y `saves` en `null`: falta `instagram_manage_insights` |
| YouTube | ✅ | 50 | Falta confirmar que el canal conectado sea @ManzanaVerdeLatam |
| TikTok | ❌ | 0 | Falta reconectar la cuenta con el scope `video.list`. Está en curso |

**Línea base real de publicaciones por semana ISO, en hora Lima** (de las 150 publicaciones leídas):

| Semana | FB publ. | FB likes | IG publ. | IG likes | IG comentarios |
|---|---|---|---|---|---|
| 2026-W36 | 4 | 30 | 3 | 59 | 2 |
| 2026-W37 | 4 | 11 | 4 | 169 | 0 |
| 2026-W38 | 5 | 18 | 5 | 151 | 11 |
| 2026-W39 | 14 | 20 | 14 | 370 | 50 |

→ Volumen chico: ~5–15 publicaciones por red y por semana. Con la ventana de 35 días, el registro del bronze tiene como mucho unas 200 publicaciones (~40 KB en el peor caso, ~15 KB lo normal) y el silver queda por debajo de 20 KB.

### HECHO 3 — Las cuentas son una por red, no una por país

El autopost publica en **una** página de Facebook, **una** cuenta de Instagram, **un** canal de YouTube y **una** cuenta de TikTok. Los inputs manuales actuales están partidos por país (`kpi694-alcance-instagram-peru`, `-mexico`, `-colombia`), pero **la API no dice de qué país es cada publicación**.

→ El silver se arma por red, **sin `by_country`**. Si Carolina confirma que existen cuentas separadas por país, se agrega en una v2, cuando el autopost tenga esas cuentas conectadas.

### HECHO 4 — Los números son acumulados: hace falta fijar cuándo se miden

Una publicación del lunes sigue juntando likes durante semanas. Si el KPI suma lo acumulado "a hoy", la semana pasada cambia cada día y nunca se puede cerrar.

**Definición (decisión de Carolina como DRI):**
- **Cohorte por semana de publicación.** La semana W agrupa las publicaciones cuyo `publishedAt` **en hora Lima** cae en la semana ISO W (lunes a domingo, como #691 y el resto de Growth).
- **Medidas a 7 días.** De cada publicación se toma `metrics_7d`: los números de la **primera corrida del cron en la que cumplió 7 días** (ver Fase 2).
- **`reportable_lag_weeks = 1`.** La semana W queda completa el domingo de W+1, cuando su publicación más nueva cumple 7 días. Antes de eso se marca `parcial: true`.

Es el mismo criterio de "por pieza" que ya tienen #694 y #695: mide si la pieza fue buena, no cuánto tiempo pasó.

### HECHO 5 — Las semanas se calculan en hora Lima, no en UTC

`semanaIdFrom(iso)` (`server/datalake/isoWeek.js:24`) usa `iso.slice(0, 10)`, o sea el **día UTC**. Una publicación del domingo 27/09 a las 21:00 de Lima es `2026-09-28T02:00:00Z`: el lunes en UTC, y caería en la semana 402026 en vez de la 392026.

→ Toda semana de este sprint pasa por un helper que **resta 5 horas antes** de llamar a `semanaIdFrom`. Vale para el `publishedAt` de cada publicación y para el "hoy" del cron:

```js
const LIMA_OFFSET_MS = 5 * 3600 * 1000;
export function semanaIdLima(isoUtc) {
  return semanaIdFrom(new Date(new Date(isoUtc).getTime() - LIMA_OFFSET_MS).toISOString());
}
```

### Lo que SÍ funciona (no tocar)

- `loadContenidoInputs()` (`server/datalake/persistence.js:284`) y `contenidoTotales()` (`server/dris/kpi-resolver.js:2138`). Se mantienen como **respaldo manual**: si no hay silver para la semana, los KPIs siguen leyendo lo que cargue Adrian.
- El cron `acquisition-refresh` y su esquema de presupuesto por paso (`crearPresupuesto` / `conLimite`). Se le agrega un paso; no se crea un cron nuevo (ya hay 32).
- `saveBronze`, `loadBronze`, `saveSilver` y `fetchSilverByMonth` tal como están.

---

## 🎯 Objetivo

1. Mantener en **bronze** un registro por publicación con sus últimos números y sus números a 7 días.
2. Publicar y **persistir** el silver **`social_organic_weekly`**: cohorte por semana de publicación, medida a 7 días, por red.
3. Pasar **#693, #694 y #695** a `ingreso_kpi = 'Calculado'`, leyendo el silver primero y lo manual como respaldo.
4. Crear **#700–#702** (vistas por pieza de video, tasa de interacción y seguidores netos).

**Fuera de alcance:**
- Separar por país (ver HECHO 3).
- LinkedIn: la API sigue sin aprobación.
- Métricas de anuncios: ya viven en `facebook_ads_spend`.
- Borrar los inputs manuales de Adrian: quedan como respaldo.
- El hallazgo de seguridad de la anon key: Julio lo trata aparte.

---

## 📋 Orden de ejecución

```
FASE 1 → dris_definitions: actualizar #693-#695, crear #700-#702      ~30 min [Nivel A]
   🛑 STOP → 6 filas, Carolina DRI, las 6 en Calculado
FASE 2 → Bronze social/post_metrics: registro por publicación          ~1.5 h  [Nivel B]
   🛑 STOP → 1 fila por semana, ingested_at de hoy, metrics_7d en las de ≥7 días
FASE 3 → Silver social_organic_weekly, persistido para W, W-1 y W-2    ~1.5 h  [Nivel B]
   🛑 STOP → W39 cuadra con la línea base (FB 14 / IG 14 publicaciones)
FASE 4 → loadSilvers + socialOrganic.js + resolver #693-#702            ~1.5 h  [Nivel B]
   🛑 STOP → #693 de 392026 sale del silver (visible en _detail), null donde falta permiso
FASE 5 → Retención y verificación E2E                                   ~30 min
```

---

## 🛡️ GUARDS

```bash
# Guard 1: no romper el camino manual (respaldo)
git diff -U0 server/datalake/persistence.js | grep -E "^-.*loadContenidoInputs"
# Esperado: VACÍO (se agrega, no se borra).

# Guard 2: vercel.json sin crons nuevos
python3 -c "import json;print(len(json.load(open('vercel.json'))['crons']))"   # sigue en 32

# Guard 3: kpi-resolver.js no crece (ya pasa las 300 líneas)
git diff --numstat server/dris/kpi-resolver.js   # agregadas <= borradas

# Guard 4: storage (free tier ~225%) — el registro del bronze < 50 KB
# y social/post_metrics dentro de PRUNE_ENTITIES (16 semanas).

# Guard 5: el token del autopost solo vive en Vercel
git grep -n "AUTOPOST_METRICS_TOKEN" -- ':!*.md' | grep -v "process.env"
# Esperado: VACÍO.

# Guard 6: nada del front lee el bronze
git diff --name-only | grep -E "^src/" | xargs -r grep -n "datalake_bronze"
# Esperado: VACÍO.
```

---

## FASE 1 → `dris_definitions` (Nivel A)

Escribir con **SERVICE_ROLE**.

### 1.1 Actualizar #693–#695

| id | ingreso_kpi | silver_path | reportable_lag_weeks | notas (reemplazar) |
|---|---|---|---|---|
| 693 | Calculado | `social_organic_weekly.total.publicaciones` | 1 | Publicaciones orgánicas de la semana ISO en hora Lima (una por red: un mismo arte en FB e IG son 2). Fuente: silver `social_organic_weekly` (autopost). Respaldo: `kpi693-pais-*` manual si no hay silver. |
| 694 | Calculado | `social_organic_weekly.total.alcance_por_pieza` | 1 | Σ reach a 7 días / publicaciones con reach. Solo FB+IG (TikTok y YouTube no exponen reach; sus vistas van en #700). Null hasta que el token de Meta tenga permiso de estadísticas. |
| 695 | Calculado | `social_organic_weekly.total.interacciones_por_pieza` | 1 | (comentarios + compartidos + guardados) a 7 días / publicaciones. Sin likes (decisión de Carlos 18/09). Cada red suma los componentes que su API entrega; el detalle por red queda en `_detail`. |

`category` pasa de `D` a `A`.

### 1.2 Crear #700–#702

**Antes de insertar:** verificar que el bloque siga libre. Al 2026-09-29, `MAX(id) = 699` y el resolver no usa ningún ID ≥ 700.

```sql
SELECT id FROM dris_definitions WHERE id >= 700 ORDER BY id;  -- esperado: vacío
```

| id | objetivo | kr | nivel | kpi_padre | nombre | unidad | tipo_meta | tipo_freq | ingreso_kpi | silver_path |
|---|---|---|---|---|---|---|---|---|---|---|
| 700 | O5 | KR4 | Sub-KPI | 23 | Vistas de video por pieza | vistas/pieza | positiva | Semanal | Calculado | `social_organic_weekly.total.vistas_video_por_pieza` |
| 701 | O5 | KR4 | Sub-KPI | 23 | Tasa de interacción sobre alcance | % | positiva | Semanal | Calculado | `social_organic_weekly.total.tasa_interaccion_pct` |
| 702 | O5 | KR4 | Sub-KPI | 23 | Seguidores netos de la semana | seguidores | positiva | Semanal | Calculado | `social_organic_weekly.seguidores.neto_total` |

Campos comunes: `area = 'Growth - Organico & Retencion'`, `dri_name = 'Carolina Andrade'`, `dri2_name = 'Adrian Amado'`, `activo = true`, `tolerancia_pct = 10`, `category = 'A'`, `metas = {}` (sin meta hasta tener 4 semanas de serie). `reportable_lag_weeks = 1` en #700 y #701; en #702 va `null`, porque es una foto de cierre y no una cohorte.

**Fórmulas:**
- **#700** = Σ vistas a 7 días de las publicaciones de video (TikTok + YouTube + Reels de Instagram) / cantidad de esas publicaciones. Separado de #694 porque una vista y una persona alcanzada no son lo mismo: sumarlas inflaría el alcance.
- **#701** = Σ interacciones de #695 / Σ reach de #694, solo sobre publicaciones que tienen ambos datos. Null si no hay reach.
- **#702** = Σ por red de (seguidores al cierre del domingo − seguidores al cierre del domingo anterior). **Depende de un cambio en el autopost** que agrega el conteo de seguidores (ver Pendientes). Hasta entonces sale null.

### 1.3 🛑 STOP DE FASE 1

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/dris_definitions?id=in.(693,694,695,700,701,702)&select=id,nombre,ingreso_kpi,dri_name,silver_path,reportable_lag_weeks&order=id"
```

**Esperado:** 6 filas, `dri_name = Carolina Andrade` en todas, `ingreso_kpi = Calculado` en las 6.

---

## FASE 2 → Bronze `social / post_metrics`: un registro por publicación (Nivel B)

### 2.1 Por qué registro y no foto

`saveBronze` hace upsert por `(source, entity, semana_id)` (`persistence.js:70`). Una foto por día guardada bajo la semana de hoy dejaría **una sola foto por semana**, la última, y no habría de dónde sacar la "primera foto a 7 días". Usar la fecha como `semana_id` tampoco sirve: `prune-bronze-retention.mjs:41` borra por basura cualquier `semana_id` que no tenga formato de semana.

→ La fila de la semana es un **registro que se va actualizando**: una entrada por publicación que guarda sus últimos números y, **una sola vez**, sus números a 7 días.

### 2.2 Forma del registro (`data`)

```js
{
  _rule: 'social_post_metrics_v1',
  corrida_at: '2026-09-29T13:30:12Z',        // última corrida que tocó el registro
  networks: ['facebook', 'instagram', 'youtube'],   // de esa corrida
  failures: { tiktok: 'scope_not_authorized ...' }, // de esa corrida
  posts: {
    'instagram.com/p/Dd2AielGM1O': {         // clave = URL normalizada (ver 2.4)
      network: 'instagram',
      url: 'https://www.instagram.com/p/Dd2AielGM1O/',
      publishedAt: '2026-09-28T17:14:10.000Z',
      semana_publicacion: '402026',           // semanaIdLima(publishedAt)
      metrics_ultima: { views: null, likes: 4, comments: 0, saves: null },
      medido_ultima_at: '2026-09-29T13:30:12Z',
      metrics_7d: null,                       // se llena una sola vez
      medido_7d_at: null
    }
  }
}
```

### 2.3 Paso nuevo en `api/cron/acquisition-refresh.js`

Va al final, con su propio presupuesto (la llamada al autopost tarda ~5–15 s). En cada corrida:

1. **Leer el registro vigente.** `loadBronze('social', 'post_metrics', semanaIdLima(ahora))`. Si no existe, que es lo que pasa el primer día de cada semana, leer el de la semana anterior: **el registro se arrastra de una semana a otra.** Si tampoco existe, arrancar vacío.
2. **Pedir las métricas al autopost:**
   ```js
   // Variables de Vercel del lake: AUTOPOST_METRICS_URL, AUTOPOST_METRICS_TOKEN
   const res = await fetch(process.env.AUTOPOST_METRICS_URL, {
     headers: { Authorization: `Bearer ${process.env.AUTOPOST_METRICS_TOKEN}` },
   });
   const body = await res.json();
   if (!res.ok || !body.success) throw new Error(`autopost ${res.status}: ${body.error}`);
   ```
3. **Por cada publicación que devuelve el autopost:** crear la entrada si no existe y actualizar `metrics_ultima` y `medido_ultima_at`.
4. **La primera vez que cumple 7 días** (`ahora − publishedAt ≥ 7 días` y `metrics_7d == null`): copiar los números a `metrics_7d` y poner `medido_7d_at`. **Después ya no se tocan**, aunque la publicación siga sumando likes.
5. **Descartar** las entradas con `publishedAt` de más de 35 días.
6. **Guardar `networks` y `failures`** de esta corrida.
7. **Persistir** con `saveBronze('social', 'post_metrics', semanaIdLima(ahora), registro, Object.keys(registro.posts).length)`.

Una red que viene en `failures` **no toca** sus entradas: conservan su último número y su `metrics_7d`, si ya lo tenían.

Sin las variables de entorno, el paso se salta y queda en `result.steps.social_post_metrics = { skipped: 'AUTOPOST_METRICS_URL no configurado en Vercel' }`, como GSC.

**Limitación conocida:** si el cron no corre justo el día en que la publicación cumple 7 días, `metrics_7d` se toma en la siguiente corrida, a los 8 o 9 días. `medido_7d_at` deja ver cuándo fue.

### 2.4 Normalización de la URL (clave)

Minúsculas en el dominio, sin `https://`, sin `www.`, sin `?query`, sin `#` y sin `/` final. `instagram.com/reel/X` e `instagram.com/reels/X` pasan a `instagram.com/p/X`, y `youtu.be/X` y `youtube.com/watch?v=X` pasan a `youtube.com/shorts/X`. Es la misma regla que ya usa el plan de contenidos (`mv-plan-contenidos/normalize.js`), así que las dos puntas casan.

### 2.5 Tests

- `semanaIdLima('2026-09-28T02:00:00Z') === '392026'` (domingo 27/09 en Lima).
- `semanaIdLima('2026-09-28T05:00:00Z') === '402026'` (lunes 00:00 en Lima).
- Una entrada con `metrics_7d` ya puesto **no cambia** cuando llega un número nuevo.
- Una red en `failures` no modifica sus entradas.
- El registro de la semana anterior se arrastra cuando no existe el de la semana en curso.

### 2.6 🛑 STOP DE FASE 2

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/datalake_bronze?source=eq.social&entity=eq.post_metrics&select=semana_id,row_count,ingested_at,data->posts&order=semana_id.desc&limit=1" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s)[0];
     const p=Object.values(r.posts||{});
     console.log(r.semana_id,'ingested',r.ingested_at,'bytes',JSON.stringify(r.posts).length);
     console.log('con metrics_7d:',p.filter(x=>x.metrics_7d).length,'de',p.length)})"
```

**Esperado:** **una fila por semana** (la de hoy en Lima), con `ingested_at` de hoy, menos de 50 000 bytes y `metrics_7d` en las publicaciones que ya cumplieron 7 días. Al día siguiente, la misma fila con `ingested_at` nuevo, no una fila más.

---

## FASE 3 → Silver `social_organic_weekly`, persistido (Nivel B)

### 3.1 Nuevo archivo: `server/datalake/silver/socialOrganicWeekly.js`

Mismo patrón que `gscNonbrandWeekly.js`: una función pura `armarSemana(semanaId, registro)` (testeable sin red) y otra `computeSocialOrganicWeekly(semanaId)` que lee el registro vigente del bronze.

**Algoritmo:**
1. Leer el registro vigente (el de la semana de hoy en Lima).
2. Quedarse con las entradas cuyo `semana_publicacion` es W.
3. Por cada una, usar **`metrics_7d`**. Si todavía no existe, usar `metrics_ultima`, marcar la entrada `a_7d: false` y la semana `parcial: true`.
4. Agregar por red y en total. Un `null` **no suma**: se cuenta aparte en `sin_dato`.
5. Una red que estuvo en `failures` y no tiene entradas de W sale como `null` y va a `redes_sin_respuesta`. **No se cuenta como 0 publicaciones.**

**Estructura del output** (< 20 KB):

```js
{
  _rule: 'social_organic_weekly_v1',
  _note: 'Cohorte: publicaciones orgánicas cuya fecha en hora Lima cae en la semana ISO, medidas a 7 días (metrics_7d del bronze social/post_metrics, fuente mv-social-autopost). null = la API no lo entregó, no cero.',
  semana_id: '392026', week_start: '2026-09-21', week_end: '2026-09-27',
  asOf: '2026-10-06',
  parcial: false,
  redes_sin_respuesta: ['tiktok'],
  por_red: {
    facebook:  { publicaciones: 14, a_7d: 14, con_reach: 0, reach: null, vistas: null, likes: 20,  comentarios: 1,  compartidos: 4,    guardados: null },
    instagram: { publicaciones: 14, a_7d: 14, con_reach: 0, reach: null, vistas: null, likes: 370, comentarios: 50, compartidos: null, guardados: null, videos: 3 },
    youtube:   { publicaciones: 0 },
    tiktok:    null
  },
  total: {
    publicaciones: 28,
    alcance_por_pieza: null,          // #694
    interacciones_por_pieza: 1.96,    // #695 = (1+4+50) / 28
    vistas_video_por_pieza: null,     // #700
    tasa_interaccion_pct: null        // #701
  },
  seguidores: { neto_total: null, por_red: {} },   // #702, cuando el autopost los mande
  top: [ { network, url, publishedAt, likes, comentarios, compartidos } ]  // las 5 con más interacciones
}
```

Registrar `'social_organic_weekly'` en `SILVER_ENTITIES` (`runPipeline.js`) y en el array de entidades del front.

### 3.2 Persistencia y semanas que se recalculan

En el mismo paso del cron, **después** de guardar el bronze:

```js
const hoy = semanaIdLima(new Date().toISOString());
for (const semana of [hoy, semanaAnterior(hoy), semanaAnterior(semanaAnterior(hoy))]) {
  await saveSilver('social_organic_weekly', semana, armarSemana(semana, registro));
}
```

- **W (en curso):** siempre `parcial: true`.
- **W−1:** se completa durante la semana, a medida que sus publicaciones cumplen 7 días.
- **W−2:** ya debería estar completa. Se recalcula para absorber una corrida perdida.
- Desde W−3 no se toca: queda congelada con su último cálculo.

### 3.3 🛑 STOP DE FASE 3

```bash
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "$SUPABASE_URL/rest/v1/datalake_silver?entity=eq.social_organic_weekly&select=semana_id,transformed_at,data&order=semana_id.desc&limit=3" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>JSON.parse(s).forEach(r=>
     console.log(r.semana_id,'bytes',JSON.stringify(r.data).length,'parcial',r.data.parcial,
       '| FB',r.data.por_red.facebook?.publicaciones,'| IG',r.data.por_red.instagram?.publicaciones)))"
```

**Esperado:** 3 filas (W, W−1, W−2), cada una de menos de 20 000 bytes.

La W39 solo se puede verificar contra la línea base (**FB 14 e IG 14**) si el bronze ya existía el 21/09. **No va a existir:** el registro arranca el día del deploy, y el autopost solo devuelve las últimas 50 publicaciones por red, así que la primera corrida sí trae las de W39. Esas publicaciones ya tienen más de 7 días, así que su `metrics_7d` sale de la primera corrida y **queda con los números de ese día, no de los 7 días**. Por eso:
- las publicaciones que ya tenían más de 7 días en la primera corrida se marcan `a_7d: false`;
- se verifica el **conteo** de W39 (14 / 14), no las interacciones;
- la primera semana medida a 7 días de verdad es **la del deploy**.

**Backfill:** no hay historia para medir a 7 días hacia atrás. **No inventar una medición a 7 días con números de hoy.**

---

## FASE 4 → `loadSilvers` + `socialOrganic.js` + resolver (Nivel B)

### 4.1 Cargar el silver en `loadSilvers`

Los resolvers solo ven lo que `loadSilvers` (`server/dris/kpi-resolver.js:3500`) trae entidad por entidad y devuelve en el objeto final (~línea 3789). **Registrarlo en `SILVER_ENTITIES` no alcanza.**

```js
const social_organic = await fetchSilverByMonth(supabaseUrl, supabaseKey, 'social_organic_weekly', semanas);
// ...y agregar `social_organic` al return
```

- Usar **`semanas` (ISO)**, no `semanasSF`.
- **No** agregarla a `SAT_FRI_ENTITIES`.

### 4.2 Nuevo archivo: `server/dris/socialOrganic.js`

`kpi-resolver.js` ya pasa las 300 líneas y no puede crecer. Toda la lógica va en un archivo nuevo:

```js
export function socialTotal(silvers, period, campo) { /* ... */ }
export function socialSeguidoresNeto(silvers, period) { /* ... */ }
export function socialDetail(silvers, period) { /* 'silver social_organic_weekly · FB 14 · IG 14 · TikTok sin respuesta' */ }
```

- **Mes = suma de las semanas** para las cantidades (#693, #702). **Promedio ponderado por publicaciones** para los "por pieza" y la tasa (#694, #695, #700, #701). Promediar promedios planos le daría el mismo peso a una semana de 2 publicaciones que a una de 14.
- Devuelve `null` si el período no tiene silver: así el resolver cae al respaldo manual.

### 4.3 Entradas del resolver

Reemplazar las líneas de 693–695 (~3173) sin sumar líneas netas (Guard 3):

```js
693: (s, m) => socialTotal(s, m, 'publicaciones') ?? resolvePiezasContenido(s, m),
694: (s, m) => socialTotal(s, m, 'alcance_por_pieza') ?? porPieza(s, m, 'alcance'),
695: (s, m) => socialTotal(s, m, 'interacciones_por_pieza') ?? porPieza(s, m, 'interacciones'),
700: (s, m) => socialTotal(s, m, 'vistas_video_por_pieza'),
701: (s, m) => socialTotal(s, m, 'tasa_interaccion_pct'),
702: (s, m) => socialSeguidoresNeto(s, m),
```

- `_detail` obligatorio (constitución §5): usa `socialDetail()`, que dice **de dónde salió el número**: `silver social_organic_weekly` o `respaldo manual`.
- `693` y `702` van a `COUNT_INT`.
- Si las líneas nuevas no entran sin crecer, se compensan en el mismo archivo, por ejemplo moviendo `contenidoTotales` / `porPieza` a `socialOrganic.js`.

### 4.4 🛑 STOP DE FASE 4

```bash
curl -s -H "x-api-key: $OKR_API_KEY" "https://data-lake-mv.manzanaverde.la/api/public/datalake/392026?include=gold" \
 | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const g=JSON.parse(s).gold.kpis;
   for (const i of [693,694,695,700,701,702]) console.log('#'+i, g[i] ? JSON.stringify(g[i]).slice(0,160) : '— SIN VALOR')})"
```

**Esperado:**
- **#693 con valor y `_detail` que dice `silver social_organic_weekly`**, no `respaldo manual`. Si dice respaldo manual, falta el paso 4.1.
- **#695 con valor.**
- **#694, #700, #701 y #702 sin valor.** Es correcto: faltan los permisos y cambios de la sección Pendientes. **No completar con 0.**

---

## FASE 5 → Retención y E2E

- Agregar `'post_metrics'` a `PRUNE_ENTITIES` en `scripts/prune-bronze-retention.mjs:26` (16 semanas). Como el registro se arrastra, las filas de semanas viejas son solo historia: la vigente es la de la semana en curso.
- Verificar los guards 1–6.
- Correr el cron a mano dos días seguidos y confirmar:
  - el bronze **sigue siendo una fila** para la semana, con `ingested_at` nuevo;
  - una publicación que cruzó los 7 días entre las dos corridas tiene `metrics_7d` en la segunda, y ese valor no cambia en una tercera corrida;
  - la W−1 del silver pasa de `parcial: true` a `false` cuando todas sus publicaciones cumplen 7 días.

---

## ✅ Criterios de aceptación

- [ ] #693–#695 en `Calculado` con `silver_path` y `reportable_lag_weeks = 1`; #700–#702 creados con Carolina como DRI
- [ ] `semanaIdLima` con los dos tests de borde (`2026-09-28T02:00:00Z` → 392026; `2026-09-28T05:00:00Z` → 402026)
- [ ] Bronze `social/post_metrics`: **una fila por semana** que se actualiza; `metrics_7d` escrito una sola vez; entradas de más de 35 días descartadas; < 50 KB; en `PRUNE_ENTITIES`
- [ ] Silver `social_organic_weekly` persistido para W, W−1 y W−2, < 20 KB, en `SILVER_ENTITIES` y en el front
- [ ] `loadSilvers` trae `social_organic_weekly` con semanas ISO y lo devuelve
- [ ] Lógica en `server/dris/socialOrganic.js`; `kpi-resolver.js` sin crecer
- [ ] #693 de 392026 sale del silver, y el `_detail` lo dice
- [ ] Una red en `failures` aparece como `null` / `redes_sin_respuesta`, nunca como 0 publicaciones
- [ ] Sin cron nuevo; token solo en variables de Vercel; nada del front lee el bronze

---

## 📌 Antes de ejecutar

| # | Qué | Quién |
|---|---|---|
| a | Confirmar las 3 decisiones de abajo | Carolina (DRI) |
| b | Pasar el token del autopost por canal privado | Adrian |
| c | Cargar `AUTOPOST_METRICS_URL` y `AUTOPOST_METRICS_TOKEN` en el proyecto de Vercel `manzana-verde-datalake`. Sin eso, el paso se salta | Julio (o quien tenga acceso a ese Vercel) |

## 📌 Pendientes que no son del lake (sin ellos, #693 y #695 salen solos; #694, #700, #701 y #702 quedan sin valor, y está bien)

| # | Qué | Quién | Destraba |
|---|---|---|---|
| 1 | Regenerar el token de sistema de Meta con `read_insights` e `instagram_manage_insights` | Adrian (administra el portafolio de Meta) | #694, #701, vistas y guardados de IG |
| 2 | En el autopost: pedir `reach` y `shares` en las estadísticas de IG, y exponer los seguidores de cada red | Adrian, en `mv-social-autopost` | #695 completo en IG, #702 |
| 3 | Reconectar TikTok con `video.list` (`/conectar-tiktok`) | Adrian | TikTok en #693, #695 y #700 |
| 4 | Confirmar que YouTube está conectado a @ManzanaVerdeLatam | Adrian | Que los números de YouTube sean de la cuenta correcta |
| 5 | Confirmar si hay cuentas por país. Si las hay, conectarlas al autopost | Carolina | `by_country` en una v2 |

## ❓ Decisiones para confirmar con Carolina antes de la Fase 1

1. **Pieza = publicación por red.** Un mismo arte en FB e IG cuenta como 2 en #693. La alternativa es contar el arte una sola vez, pero el autopost hoy no expone qué publicaciones salieron del mismo archivo; habría que agregarlo.
2. **Medición a 7 días** con `reportable_lag_weeks = 1`. La alternativa es a 3 días, con menos atraso y números menos maduros.
3. **Cuándo deja Adrian de cargar los 21 inputs manuales.** Propuesta: cuando el silver tenga 2 semanas completas (`parcial: false`). Desde ahí quedan solo como respaldo.

---

## 🔎 Hallazgo menor (fuera de este sprint)

`prune-bronze-retention.mjs:35` solo acepta semanas de **2024 a 2027** (`validWeek`). Desde la primera semana de 2028, **todo** el bronze semanal va a caer como "basura" y el script lo va a borrar. Conviene cambiar el tope por el año en curso + 1 antes de fin de 2027.
