# Promo Pulse: Bars & Timers

Promo Pulse: Bars & Timers es una app para Shopify enfocada en campanas
promocionales reales para merchants: barras con cuenta regresiva, timers en
producto y carrito, goal bars de envio gratis, delivery cutoffs, mensajes de
stock bajo, badges, targeting, sincronizacion basica con descuentos nativos de
Shopify, multi-idioma y analytics operativo.

Etapa 2 agrega features de optimizacion para campanas promocionales inteligentes:
codigos unicos por visitante, A/B testing, auto-winner, Shopify Functions para
descuentos avanzados, checkout/thank-you/order-status extensions, email
countdown timers, badges avanzados, Shopify Markets avanzado, AI Campaign
Builder, reporting avanzado, recomendaciones, biblioteca de plantillas y
dashboard multi-store para agencias.

El nombre publico final de la app es `Promo Pulse: Bars & Timers` y el nombre
corto es `Promo Pulse`. Las rutas de app proxy, assets de theme y extensiones
usan ese nombre para evitar alias heredados en superficies visibles.

## Stack base

- Shopify React Router app template oficial.
- TypeScript estricto.
- Prisma con SQLite local.
- Preparado para migrar a Postgres en produccion.
- Shopify App Bridge y APIs oficiales del template.
- Polaris Web Components para la UI admin del template.
- Workspace de extensiones Shopify en `extensions/`.

## Requisitos

- Node.js compatible con `package.json` (`>=20.19 <22` o `>=22.12`).
- npm.
- Shopify CLI via los scripts del proyecto.
- Cuenta Partner de Shopify y development store para probar OAuth, app embed,
  extensiones, webhooks y APIs reales.

## Setup local

```bash
npm install
cp .env.example .env
npm run prisma -- generate
npm run db:migrate
npm run db:seed
```

Luego vincula el proyecto a una app real de Shopify cuando tengas credenciales:

```bash
npm run config:link
npm run dev
```

`npm run dev` debe mostrar una linea similar a
`app_home └ Using URL: https://...trycloudflare.com`. El archivo
`shopify.app.toml` puede seguir mostrando `default-app-home` en desarrollo; lo
importante es la URL generada que aparece en el output de Shopify CLI. Si en
Shopify Admin ves `default-app-home` o el mensaje
`Find this app in the pages where you work`, la app todavia no esta usando el
preview local. Vuelve a ejecutar:

```bash
npm run config:link
npm run dev
npm run config:check
```

El callback OAuth esperado por este template es `/auth/callback`.

## Variables de entorno

`.env.example` documenta las variables esperadas:

- `SHOPIFY_API_KEY`: API key de la app Shopify.
- `SHOPIFY_API_SECRET`: API secret de la app Shopify.
- `SCOPES`: scopes separados por coma. Para Etapa 2 usa
  `read_products,read_orders,read_discounts,write_discounts,write_pixels,read_customer_events`.
  `read_shipping` no se usa en esta release; agregalo solo si una futura
  iteracion lee shipping profiles/rates desde Admin API.
- `SHOPIFY_APP_URL`: URL publica/tunel usada por Shopify CLI.
- `SHOP_CUSTOM_DOMAIN`: dominio custom opcional para shops especificos.
- `DATABASE_URL`: SQLite local por defecto, `file:./dev.sqlite`.
- `PROMO_PULSE_DEV_PLAN`: override local opcional (`FREE`, `STARTER`,
  `GROWTH`, `PRO`) para probar plan gating sin cambiar la base de datos. En
  `NODE_ENV=development`, si no hay override valido, el plan efectivo por
  defecto es `PRO`.

Para produccion con Postgres, cambia el datasource Prisma a `postgresql`,
configura `DATABASE_URL` con la URL administrada y genera una migracion dedicada.

## Comandos

```bash
npm run dev          # Shopify CLI + React Router dev server
npm run config:sync-url # sincroniza URLs de app/auth/app proxy desde SHOPIFY_APP_URL
npm run config:check # verifica web config, scopes y callback OAuth
npm run build        # build de Theme assets + React Router
npm run start        # sirve el build
npm run lint         # ESLint
npm run typecheck    # React Router typegen + TypeScript
npm run format       # Prettier write
npm run format:check # Prettier check
npm run test         # Vitest unitario + Playwright
npm run test:unit    # Vitest unitario
npm run test:e2e     # Playwright en E2E_TEST_MODE
npm run prisma       # Prisma CLI
npm run db:migrate   # aplica migraciones Prisma en la DB configurada
npm run db:seed      # carga shop y campanas demo
npm run setup        # prisma generate + migrate deploy
```

## Estructura principal

- `app/routes`: rutas React Router del admin embebido.
- `app/models`: modelos de dominio y acceso a persistencia.
- `app/services`: casos de uso y servicios de integracion.
- `app/components`: componentes reutilizables de UI admin.
- `app/lib`: wrappers compartidos para SDKs y clientes.
- `app/utils`: helpers puros y testeables.
- `app/types`: tipos compartidos del dominio.
- `prisma`: schema y migraciones.
- `extensions`: Theme App Extension, App Embed, Web Pixel, Checkout UI
  Extension, customer account/order-status extension y Shopify Function.
- `docs`: especificacion de producto y arquitectura.

## Estado actual

Etapa 1 incluye admin embebido, CRUD de campanas, editor de diseno y preview,
traducciones, targeting, Theme App Extension, App Embed, Product/Cart blocks,
Web Pixel, analytics basico, onboarding, plan gating y tests de logica critica.

Etapa 2 suma features de optimizacion y multi-store con cobertura E2E en modo mock:
unique codes, experiments, auto-winner, email timers, checkout/post-purchase
extensions, advanced badges, market overrides, AI builder, advanced reports,
behavior targeting, recommendations, template library y agency dashboard.

Para preparar una prueba en dev store o release candidate, revisa:

- `docs/stage-2-release-notes.md`
- `docs/stage-2-qa-checklist.md`
- `docs/stage-2-performance-privacy-compliance-audit.md`
- `docs/mvp-qa-checklist.md`
- `docs/release-notes.md`
- `docs/theme-extension.md`
- `docs/analytics.md`
- `docs/testing.md`

## Stage 2 Release Validation

Antes de considerar una release candidate, corre:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

Para validacion de Shopify real, ademas revisa scopes, OAuth reinstall,
webhooks, App Proxy, Web Pixel, checkout editor, customer account extension y
Shopify Function deployment en una development store.

Antes de `npm run deploy`, `SHOPIFY_APP_URL` debe apuntar al backend web
desplegado de Promo Pulse. El deploy ahora ejecuta `config:sync-url`, que escribe
en `shopify.app.toml`:

- `application_url = "$SHOPIFY_APP_URL"`
- `redirect_urls = ["$SHOPIFY_APP_URL/auth/callback"]`
- `[app_proxy].url = "$SHOPIFY_APP_URL/apps/promo-pulse"`

Si `/apps/promo-pulse` en storefront devuelve 404, vuelve a correr
`SHOPIFY_APP_URL=https://tu-backend npm run deploy` para publicar el App Proxy
en la app de Shopify correcta.
