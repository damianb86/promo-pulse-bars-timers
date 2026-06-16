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
