# Promo Pulse: Bars & Timers

Promo Pulse: Bars & Timers es una app para Shopify enfocada en campanas
promocionales reales para merchants: barras con cuenta regresiva, timers en
producto y carrito, goal bars de envio gratis, delivery cutoffs, mensajes de
stock bajo, badges, targeting, sincronizacion basica con descuentos nativos de
Shopify, multi-idioma y analytics operativo.

El producto fue definido originalmente con los alias PromoPilot y CounterPulse.
El nombre publico final de la app es `Promo Pulse: Bars & Timers`. El namespace
tecnico `counterpulse` se mantiene en rutas, assets, eventos y nombres internos
para no romper contratos existentes de la Theme App Extension.

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

`npm run dev` debe mostrar una URL HTTPS publica de Shopify CLI y actualizar la
app vinculada. Si en Shopify Admin ves `default-app-home` o el mensaje
`Find this app in the pages where you work`, la app todavia esta apuntando al
placeholder de Shopify y no al servidor local. Vuelve a ejecutar:

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
- `SCOPES`: scopes separados por coma. Para Etapa 1 usa
  `read_products,read_discounts,write_discounts,write_pixels,read_customer_events`.
- `SHOPIFY_APP_URL`: URL publica/tunel usada por Shopify CLI.
- `SHOP_CUSTOM_DOMAIN`: dominio custom opcional para shops especificos.
- `DATABASE_URL`: SQLite local por defecto, `file:./dev.sqlite`.
- `PROMO_PULSE_DEV_PLAN`: override local opcional (`FREE`, `STARTER`,
  `GROWTH`, `PRO`) para probar plan gating sin cambiar la base de datos.
- `COUNTERPULSE_DEV_PLAN` y `PROMOPILOT_DEV_PLAN`: aliases legacy aceptados en
  desarrollo local.

Para produccion con Postgres, cambia el datasource Prisma a `postgresql`,
configura `DATABASE_URL` con la URL administrada y genera una migracion dedicada.

## Comandos

```bash
npm run dev          # Shopify CLI + React Router dev server
npm run config:check # verifica que Shopify no siga en default-app-home
npm run build        # build de Theme assets + React Router
npm run start        # sirve el build
npm run lint         # ESLint
npm run typecheck    # React Router typegen + TypeScript
npm run format       # Prettier write
npm run format:check # Prettier check
npm run test         # Vitest unitario e integracion liviana
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
- `extensions`: Theme App Extension, App Embed y Web Pixel.
- `docs`: especificacion de producto y arquitectura.

## Estado actual

El MVP de Etapa 1 incluye admin embebido, CRUD de campanas, editor de diseno y
preview, traducciones, targeting, Theme App Extension, App Embed, Product/Cart
blocks, Web Pixel, analytics basico, onboarding, plan gating y tests de logica
critica. Para preparar una prueba en dev store, revisa:

- `docs/mvp-qa-checklist.md`
- `docs/release-notes.md`
- `docs/theme-extension.md`
- `docs/analytics.md`
- `docs/testing.md`
