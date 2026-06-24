# Promo Pulse Campaign System Map

Este documento resume como funciona el sistema de campanas de Promo Pulse y que
queda cubierto por la suite Playwright real. Complementa los documentos
especificos existentes:

- `docs/theme-extension.md`
- `docs/analytics.md`
- `docs/advanced-reporting.md`
- `docs/unique-discount-codes.md`
- `docs/advanced-discounts.md`
- `docs/email-timers.md`
- `docs/markets.md`
- `docs/experiment-reporting.md`
- `docs/checkout-ui-extension.md`
- `docs/webhooks.md`
- `docs/real-store-e2e.md`

## Ciclo De Vida

Una campana nace en el admin como `DRAFT`, se edita desde el builder y se
publica con `publishCampaignForShop`. Al publicar se persisten `publishedAt` y
`publishedSnapshot`. El storefront no lee el draft en vivo: consume campanas
activas publicadas desde el endpoint de App Proxy `/apps/promo-pulse`, que
serializa el snapshot con contexto de placement, pais, locale, market, producto,
coleccion, carrito, device, UTM y visitor/session.

El storefront runtime guarda IDs anonimos en `localStorage` y `sessionStorage`.
Cuando una campana renderiza o recibe interacciones, envia eventos a la misma
ruta de App Proxy. El Web Pixel convierte `checkout_started` y
`checkout_completed` en eventos de analytics cuando existe una ultima campana
vista. El webhook `orders/create` no crea attribution; reconcilia codigos unicos
usados y marca el codigo como `USED`.

El cache de storefront usa firma de snapshot, headers `ETag` y ventanas cortas
de cliente. Publicar una campana o cambiar el snapshot debe invalidar el payload
visible sin depender de estado viejo del navegador.

## Tipos De Campana

- `COUNTDOWN_BAR`: barra global o custom selector con timer fijo o evergreen.
- `FREE_SHIPPING_GOAL`: progreso de carrito con threshold base y overrides por
  market.
- `DELIVERY_CUTOFF`: promesa de envio calculada con cutoff, dias habiles,
  feriados y comportamiento despues del cutoff.
- `PRODUCT_TIMER`: timer en pagina de producto mediante app block.
- `LOW_STOCK`: mensaje de stock bajo en contexto de producto. Debe evitar stock
  falso si no hay dato real.
- `PRODUCT_BADGE`: badge en pagina de producto o card de coleccion.
- `CART_TIMER`: timer de reserva/rescate de carrito en cart page o drawer.

Cada tipo comparte `CampaignTranslation`, `CampaignDesign`, `TimerSettings`,
`CampaignPlacement` y opcionalmente `CampaignTargeting`, descuentos,
experimentos, reglas de market y analytics.

## Placements

Los placements globales `TOP_BAR` y `BOTTOM_BAR` dependen del app embed. Los
placements `PRODUCT_PAGE`, `PRODUCT_PAGE_BADGE`, `COLLECTION_CARD` y
`CART_PAGE` dependen de bloques del Theme Editor o de contexto de producto/cart.
`CART_DRAWER` se inyecta desde el embed cuando el selector del drawer es
detectable. `CUSTOM_SELECTOR` usa el selector configurado en la campana.
`THANK_YOU_PAGE` y `ORDER_STATUS_PAGE` dependen de extensiones post-compra o
customer account.

El render correcto se valida por existencia de widget, posicion, texto,
diseno, ausencia de duplicados, ausencia de overflow y ausencia de errores de
assets criticos.

## Mensajes Y Diseno

La copia publica se resuelve desde `CampaignTranslation` por locale con fallback
al default. Los experimentos pueden sobreescribir texto, diseno, descuento y
placement para el visitor asignado. El editor permite modificar headline,
subheadline, CTA, expired text y copy especifico de delivery cutoff.

El diseno vive en `CampaignDesign`: colores, layout, tipografias, iconos,
timer style, labels, full width, padding, alignment, close button, animaciones,
progreso y CSS custom. Mobile no es una vista aparte: el runtime debe conservar
lectura, dimensiones y posicion usando la misma configuracion publicada.

## Schedule Y Timers

`startsAt`, `endsAt` y `timezone` definen elegibilidad de campana. Una campana
futura o expirada no debe servirse desde storefront aunque este publicada.

`TimerSettings` soporta:

- `FIXED_DATE`: usa el `endsAt` de la campana.
- `EVERGREEN_SESSION`: usa duracion por session/visitor.
- `RECURRING_DAILY` y `RECURRING_WEEKLY`: ventanas repetibles.

El runtime respeta `expiredBehavior`: esconder, despublicar visualmente o
mostrar expired text segun corresponda.

## Ofertas Y Descuentos

La sincronizacion basica (`DiscountSync`) cubre codigos existentes o codigos
creados por Promo Pulse. `REAL_E2E_EXISTING_DISCOUNT_CODE` permite testear el
link a un descuento real creado manualmente en Shopify.

Los codigos unicos crean un pool y asignan un codigo por visitor/session desde
`/api/storefront/unique-code/assign`. Si `uniqueCodeAutoApply=true`, el widget
expone un link `/discount/<code>` para que Shopify aplique el codigo. La app no
debe prometer que un codigo esta aplicado hasta que Shopify checkout lo acepte.

Las advanced discount rules se guardan como reglas de merchant y se ejecutan a
traves de Shopify Functions cuando la extension correspondiente esta desplegada.
La suite real valida persistencia segura de reglas, no fuerza descuentos no
desplegados.

Los email timers generan PNG publico desde la campana, usando fechas reales y
diseno de email timer. No usan timers falsos por apertura.

## Targeting Y Markets

`CampaignTargeting` filtra por paises, markets, locales, productos,
colecciones, tags de producto, tags de cliente, URL contains, exclusiones, UTM,
devices y reglas de comportamiento. Las reglas de comportamiento usan eventos
recientes anonimos y respetan consent/do-not-track.

`MarketCampaignRule` permite overrides por market, country, locale y currency.
Puede cambiar threshold de free shipping, texto y delivery settings. La regla
mas especifica gana; si no hay match, se usa la campana base.

## Experimentos

Los experimentos (`Experiment`, `ExperimentVariant`) asignan visitors por hash
estable y pesos. Una variante `ACTIVE` o `WINNER` puede sobreescribir texto,
diseno, descuento o placement. Las metricas se calculan desde
`AnalyticsEvent`, `AttributionTouch` y `AttributionConversion`.

Declarar ganador marca el estado del experimento. Aplicar ganador copia los
overrides seleccionados a la campana base; despues hay que publicar para que el
storefront reciba el snapshot actualizado.

## Analytics, Reports Y Recommendations

Analytics guarda impresiones, clicks, copy code, unique code assigned,
apply-code clicked, add-to-cart, checkout started y order attributed. Reports
agrega revenue, placements, pais, locale, market, variantes de experimento,
unique codes y email timer views.

Recommendations se generan desde datos reales de performance, attribution,
market y unique codes. Las recomendaciones accionables deben explicar el motivo
y proponer cambios concretos; no deben inventar resultados.

## Cobertura Playwright Real

La suite `tests/e2e-real` cubre ahora:

- `17.campaign-types-targeting-schedule.spec.ts`: matriz de tipos, targeting,
  schedule y cache.
- `18.offers-discounts-email.spec.ts`: descuentos basicos reales, advanced
  rules, unique codes auto-apply y email timer PNG.
- `19.experiments-winner-analytics.spec.ts`: variante servida, ganador manual,
  aplicacion del ganador, analytics, reports y recommendations.
- `20.mobile-campaign-rendering.spec.ts`: top/bottom bars y free shipping cart
  module en viewport mobile sin overflow.
- `21.checkout-discount-order-attribution.spec.ts`: codigo unico generado,
  checkout real con Bogus Gateway, orden con descuento, reconciliacion de
  codigo usado, `ORDER_ATTRIBUTED`, analytics y reports.

Los tests reales siguen siendo opt-in. No usan `E2E_TEST_MODE` y no deben crear
ordenes salvo que `REAL_E2E_ALLOW_ORDER=true` y
`REAL_E2E_ALLOW_CHECKOUT=true`.

## Prerequisitos Externos

Para cobertura completa en una dev store real:

- App local accesible por Shopify con `shopify app dev` y tunnel vigente.
- App embed `Promo Pulse embed` activo en el theme.
- Product/cart/badge blocks agregados donde correspondan.
- Plan/dev config con unique codes, experiments, analytics, reports,
  recommendations, email timers y checkout extensions habilitados.
- Web Pixel desplegado y configurado para enviar `checkout_completed` a
  `/api/analytics/pixel`.
- Webhook `orders/create` registrado para reconciliar codigos usados.
- `REAL_E2E_PRODUCT_HANDLE` apuntando a un producto pago, publicado y seguro.
- Shopify Bogus Gateway o metodo de pago test activo; la tarjeta de test es
  numero `1`, fecha futura y CVV arbitrario.
- `SHOPIFY_ADMIN_ACCESS_TOKEN` con scopes para productos, descuentos y ordenes
  cuando se validan recursos reales.
