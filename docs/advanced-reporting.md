# Advanced Reporting

Advanced Reporting vive en `/app/reports` y esta disponible para tiendas con
plan Growth o Pro mediante `ADVANCED_REPORTING`.

## Fuentes de Datos

- `AnalyticsEvent`: impressions, clicks, add-to-cart, checkout started,
  order-attributed events, country, locale, placement, path y user agent.
- `AttributionConversion`: revenue atribuido, orders y experiment variant.
- `AttributionTouch`: performance por experiment variant.
- `UniqueDiscountCode`: codigos asignados, usados y expirados.
- `MarketCampaignRule`: mapeo de country/locale a market cuando Shopify Markets
  esta configurado.

## Filtros

La pagina soporta filtros por:

- date range;
- campaign;
- placement;
- country;
- locale;
- market;
- device.

`device` se deriva desde `userAgent`. `market` se deriva desde
`MarketCampaignRule` y usa country como fallback cuando no hay regla matching.

## CSV

`/app/reports/csv` exporta el mismo rango y filtros aplicados en la UI.
El CSV incluye summary, campaign type, placement, country, locale, market,
experiment variant y unique-code rows.

## Weekly Report

El resumen semanal se genera dentro de la app. La infraestructura de email real
queda preparada como limitacion documentada; no se envia email hasta que exista
un provider transaccional configurado.

## Limitaciones

- Revenue principal usa `AttributionConversion`; dimensiones que solo viven en
  `AnalyticsEvent` pueden mostrar revenue desde eventos `ORDER_ATTRIBUTED`
  cuando no existe conversion equivalente.
- Email timer views se registran como impressions sin PII al renderizar la
  imagen publica.
- No se almacena device como columna; se clasifica en reportes desde user-agent.
