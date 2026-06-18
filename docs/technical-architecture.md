# Promo Pulse Technical Architecture

## Base

Promo Pulse: Bars & Timers parte del template oficial Shopify React Router App.
La app admin corre como una aplicacion embebida, autenticada mediante
`@shopify/shopify-app-react-router`, con sesiones persistidas por Prisma.

## Capas

- `app/routes`: loaders, actions y paginas React Router.
- `app/components`: UI reutilizable del admin, basada en Polaris Web Components.
- `app/models`: acceso a datos y transformaciones cercanas a Prisma.
- `app/services`: casos de uso de negocio, integraciones Shopify y reglas de
  producto.
- `app/utils`: helpers puros, validaciones y funciones testeables.
- `app/lib`: inicializacion de clientes, SDK wrappers y dependencias externas.
- `app/types`: tipos compartidos entre rutas, servicios y componentes.
- `prisma`: schema, migraciones y cliente generado.
- `extensions`: extensiones Shopify generadas por CLI.

## Persistencia

La base usa SQLite local a traves de `DATABASE_URL="file:./dev.sqlite"`.
Prisma ya contiene el modelo `Session` requerido por el session storage oficial.

Para produccion se recomienda Postgres administrado:

1. Cambiar `provider = "sqlite"` por `provider = "postgresql"`.
2. Configurar `DATABASE_URL` con la URL de Postgres.
3. Generar una migracion especifica de produccion.
4. Ejecutar `prisma migrate deploy` durante el despliegue.

## Shopify Admin App

El admin embebido usa:

- React Router para rutas, loaders y actions.
- `authenticate.admin(request)` para proteger rutas privadas.
- App Bridge via el provider del template.
- Polaris Web Components para mantener compatibilidad con el template actual.

Las rutas MVP cubren dashboard, campanas, onboarding, analytics, settings y
billing placeholder.

## Extensiones

Las extensiones actuales se mantienen bajo `extensions/`:

- Theme App Extension para countdown bars, timers, goal bars, badges y mensajes.
- App Embed para scripts globales y configuracion comun de storefront.
- Web Pixel Extension para capturar eventos analytics permitidos por Shopify.
- Checkout UI Extension para mensajes promocionales en checkout mediante el
  bloque `purchase.checkout.block.render`.
- Thank-you extension target para mensajes post-compra mediante
  `purchase.thank-you.block.render`.
- Customer Account UI Extension para order-status mediante
  `customer-account.order-status.block.render`.

Los archivos generados deben vivir bajo `extensions/` para conservar el flujo
estandar de `shopify app dev`, `shopify app generate` y `shopify app deploy`.

## Dominio

Entidades principales:

- Campaign.
- CampaignPlacement.
- CampaignTargetingRule.
- CampaignTranslation.
- CampaignTemplate.
- DiscountSyncMapping.
- AnalyticsEvent.
- PlanEntitlement.

La implementacion debe mantener reglas testeables en `app/services` y
`app/utils`, evitando acoplar logica de negocio directamente a componentes.

## Stage 2 Premium Architecture

Stage 2 agrega una capa premium por encima de las campanas existentes, sin
modificar el contrato base de Stage 1. Las features nuevas deben entrar por
feature flag interno y por plan gate antes de exponerse en UI o storefront.

Tipos y flags:

- `app/types/stage2.ts` define `PremiumFeatureKey`, estados de experimentos,
  modelos de atribucion, estados de codigos unicos, tipos de recomendacion y
  categorias de templates.
- `app/services/premiumFeatures.server.ts` define los defaults de flags
  internos y el helper `canUsePremiumFeature(shop, featureKey)`.
- `UNIQUE_CODES`, `AB_TESTING`, `ADVANCED_DISCOUNTS`, `CHECKOUT_EXTENSIONS` y
  `EMAIL_TIMERS` quedan habilitados porque ya tienen base implementada. Los
  demas flags Stage 2 quedan deshabilitados hasta su implementacion.

Servicios reservados para Stage 2:

- `app/services/discounts`: unique codes, auto-apply y Shopify Functions.
- `app/services/experiments`: A/B testing y auto-winner.
- `app/services/attribution`: touchpoints, checkout, thank-you y order-status.
- `app/services/recommendations`: recomendaciones automaticas.
- `app/services/ai`: AI Campaign Builder y asistentes de copy/localizacion.
- `app/services/markets`: reglas avanzadas de pais, mercado, idioma y moneda.
- `app/services/email-timers`: render dinamico de countdown timers para email.
- `app/services/agency`: multi-store y agency dashboard.
- `app/services/checkout`: seleccion segura de campanas elegibles para checkout
  y view models sin PII para Checkout UI Extension.
- `app/services/post-purchase`: seleccion segura de campanas elegibles para
  thank-you/order-status y view models sin PII para extensiones post-compra.
- `app/routes/api.email-timer.$publicToken.ts`: endpoint publico de imagen
  `GET /api/email-timer/:publicToken.png` para countdown timers de email.
- `app/components/stage2`: slots/componentes admin para features premium.

Reglas de integracion:

- No activar UI premium solo por existir el tipo o carpeta.
- No llamar APIs reales de Shopify desde tests automatizados salvo mocks o
  `E2E_TEST_MODE=true`.
- No exponer IDs internos, tokens de visitante o configuracion privada en
  payloads storefront.
- No simular urgencia: timers, stock y descuentos deben venir de datos reales o
  quedar ocultos.
- No bloquear progreso de checkout desde Promo Pulse; la extension de checkout
  solo renderiza mensajes y debe fallar cerrada si el backend no responde.
- No afirmar que una oferta fue usada en post-compra salvo que Shopify reporte
  un codigo aplicado que coincida con la campana.
- Mantener payloads storefront backwards-compatible para no romper Theme App
  Extension ni Web Pixel Extension.

## Analytics

El Web Pixel sera la fuente principal para eventos de storefront. La app admin
debe agregar datos por shop, campana, placement, idioma y ventana temporal.
Cuando la atribucion de orden no sea exacta, se debe marcar como aproximada en
el modelo y en la UI.

## Targeting

El targeting se resolvera en dos niveles:

- Admin: configuracion y validacion de reglas.
- Storefront/extension: evaluacion rapida con el contexto disponible.

Reglas que dependan de datos no disponibles en storefront deben degradar de
forma explicita y quedar documentadas.

## Testing

- Unit tests para validaciones, reglas de targeting, plan gating y calculos de
  analytics.
- Tests de loaders/actions cuando haya contratos de datos relevantes.
- Verificacion manual con development store para OAuth, extensiones, webhooks y
  pixel, porque dependen de Shopify real.

## Credenciales, Configuracion Y Placeholders

No hay credenciales reales en el repo. `.env.example` documenta lo minimo para
desarrollo local. `shopify.app.toml` debe vincularse con `npm run config:link`
y `npm run dev` para actualizar URLs reales de OAuth/app proxy durante pruebas.
