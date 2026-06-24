# Promo Pulse Stage 2 Plan

## Objetivo

Stage 2 convierte Promo Pulse: Bars & Timers en una app premium de campanas
promocionales inteligentes. El trabajo debe avanzar por incrementos pequenos,
mantener compatibilidad con Stage 1 y no activar features sin datos reales,
permisos Shopify validos o mocks bajo `E2E_TEST_MODE=true`.

## Features

1. Unique discount codes por visitante.
2. Auto-apply y expiracion real de codigos.
3. A/B testing de mensajes, disenos, descuentos y placements.
4. Auto-winner para experimentos.
5. Shopify Functions para descuentos avanzados.
6. Checkout, thank-you y order-status extensions.
7. Email countdown timers dinamicos.
8. Product badges avanzados.
9. Shopify Markets avanzado.
10. AI Campaign Builder.
11. Reporting avanzado.
12. Multi-store y agency dashboard.
13. Segmentacion por comportamiento.
14. Recomendaciones automaticas.
15. Biblioteca de campanas por pais y temporada.
16. Plan gating premium.

## Dependencias

- Shopify Admin API: `read_discounts`, `write_discounts`, products,
  markets, localization y reporting segun cada corte.
- Shopify Functions: extensiones versionadas, despliegue CLI y pruebas con
  carts mockeados.
- Checkout UI extensions: app scopes y entornos de checkout compatibles.
- Theme App Extension: debe seguir funcionando con los scripts de Stage 1; los
  nuevos payloads deben ser backwards-compatible.
- Web Pixel Extension: fuente primaria de eventos de comportamiento y
  atribucion.
- Prisma: migraciones aditivas, con tablas nuevas antes de usar rutas o UI.
- Billing: Growth agrupa optimizacion y reporting, mientras Pro agrupa todo lo
  implementado, incluido multi-store y automatizacion avanzada.
- E2E: toda dependencia de Shopify real debe tener mock o bypass solo bajo
  `E2E_TEST_MODE=true` y nunca en produccion.

## Orden De Implementacion

1. Base de arquitectura: tipos Stage 2, feature flags, carpetas de servicios,
   plan docs y helper `canUsePremiumFeature`.
2. Unique codes: completar lifecycle con webhooks/order attribution para marcar
   aplicado, redimido, expirado o revocado.
3. Auto-apply: conectar Theme App Extension con endpoint de codigo unico y
   validar redireccion `/discount/:code` sin mostrar descuentos inexistentes.
4. A/B testing: modelos de experimento, variantes y asignacion estable por
   visitante.
5. Auto-winner: reglas estadisticas conservadoras, ventana minima y rollback a
   control.
6. Advanced discounts: Shopify Functions con fixtures, versionado y fallback
   claro si la funcion no esta instalada.
7. Checkout/thank-you/order-status: Checkout UI block base implementado;
   quedan thank-you, order-status y atribucion de conversion especifica.
8. Reporting avanzado: cohortes, revenue, funnel, export y confidence labels.
9. Product badges avanzados y Markets avanzado: reglas por pais, mercado,
   currency, idioma y coleccion.
10. Email timers: endpoint de render dinamico con cache segura y expiracion
    real.
11. Behavioral targeting y recomendaciones: usar eventos reales, no inventar
    stock, compradores ni urgencia.
12. AI Campaign Builder: generar borradores editables, con guardrails de claims
    y sin publicar automaticamente.
13. Multi-store/agency dashboard: permisos, store switching y reportes
    agregados.
14. Biblioteca de campanas por pais/temporada: templates versionados,
    localizacion y reglas de elegibilidad.

## Riesgos

- Permisos Shopify incompletos pueden hacer fallar descuentos, functions o
  checkout extensions; las rutas deben devolver errores explicitos.
- Doble fuente de verdad entre Admin API, Functions y Prisma; cada feature
  debe definir ownership de estado.
- A/B testing puede sesgar analytics si la asignacion no es estable o si el
  tracking se duplica.
- Auto-winner prematuro puede degradar conversion; exigir muestra minima,
  duracion minima y criterio transparente.
- Email timers pueden ser cacheados por clientes de email; se debe definir
  cache-control y expiracion visual honesta.
- Markets avanzado puede mezclar currency, pais, mercado e idioma; las reglas
  deben resolverse con prioridad documentada.
- AI puede generar claims no verificables; todo resultado debe quedar como
  borrador revisable.
- Multi-store agrega riesgo de aislamiento de datos; todo query debe filtrar
  por shop o agencia autorizada.

## Planes Afectados

- `FREE`: prueba real con limites estrictos, campanas basicas, codigos unicos y
  analytics de 7 dias.
- `STARTER`: primera conversion paga con mas volumen, templates, reports
  basicos y soporte email.
- `GROWTH`: plan recomendado con optimizacion, Markets avanzado, reports
  avanzados, CSV, email timers, AI limitado y custom CSS.
- `PRO`: todo incluido, auto-winner, descuentos avanzados, checkout placements,
  multi-store, templates compartidos, soporte prioritario y early access.

## Feature Flags Internos

Los flags tipados viven en `app/types/stage2.ts` y los defaults en
`app/services/premiumFeatures.server.ts`.

- `UNIQUE_CODES`: enabled, porque ya existe la primera base backend.
- `AB_TESTING`: enabled.
- `AUTO_WINNER`: disabled.
- `ADVANCED_DISCOUNTS`: enabled para la base de Shopify Functions.
- `CHECKOUT_EXTENSIONS`: enabled para el bloque checkout base.
- `EMAIL_TIMERS`: enabled.
- `ADVANCED_BADGES`: enabled.
- `MARKETS_ADVANCED`: enabled.
- `AI_CAMPAIGN_BUILDER`: enabled con provider mock por defecto y guardrails de
  claims.
- `AGENCY_DASHBOARD`: disabled.

## Criterios Tecnicos Por Corte

- Migracion Prisma aditiva y reversible por despliegue.
- Unit tests para parsers, gates y reglas puras.
- E2E enfocado para la ruta o flujo modificado.
- No debilitar tests para pasar.
- No mostrar timers falsos, stock falso ni descuentos que no existan.
- No romper Theme App Extension, Web Pixel Extension, billing ni analytics.
