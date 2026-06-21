# Shopify Markets Avanzado

Promo Pulse soporta reglas por market para ajustar campañas activas sin romper
las campañas globales existentes.

## Contexto Detectado

El endpoint storefront `GET /api/storefront/campaigns` acepta:

- `market`: handle o identificador disponible en storefront.
- `country`: codigo ISO de 2 letras.
- `locale`: locale storefront, por ejemplo `en` o `es-ES`.
- `currency`: codigo ISO de 3 letras.
- `cartSubtotal`: subtotal real cuando el bloque lo puede obtener.

Los assets del Theme App Extension intentan leer estos valores desde datasets
del bloque, `window.Shopify`, `window.PromoPulseCartCurrency` y settings
publicos. Si no estan disponibles, no se envian y el backend usa la campaña
global.

## Precedencia

1. Se resuelve elegibilidad normal de Stage 1: status, fechas, placement,
   targeting y plan.
2. Se serializa la campaña global.
3. Se busca la mejor `MarketCampaignRule` por especificidad:
   - market.
   - country.
   - locale.
   - currency.
4. Si la regla matching esta desactivada, la campaña se oculta solo para ese
   contexto.
5. Si la regla esta activa, sus overrides ganan sobre settings globales:
   - textos permitidos.
   - threshold y moneda de free shipping.
   - delivery cutoff settings.

Si ninguna regla matchea, la campaña global se devuelve sin cambios.

## Admin

El editor de campaña incluye una seccion `Markets` para planes Pro:

- lista mercados Shopify detectados;
- activar/desactivar campaña por regla;
- overrides de texto;
- threshold y moneda;
- delivery cutoff JSON;
- selectores simples para preview de market, locale y currency.

En `E2E_TEST_MODE=true`, `fetchShopMarkets()` devuelve mercados demo US/ES para
evitar depender de Shopify real.

## Scopes

La lista automatica de mercados requiere que la Admin API permita leer Shopify
Markets. Si la tienda o el scope no lo permiten, la UI muestra un warning y el
merchant todavia puede configurar reglas manuales por country, locale o
currency.

## Limitaciones

- Shopify no siempre expone el ID interno del market al storefront. Por eso la
  UI guarda el handle cuando existe y cae al ID solo si no hay handle.
- Email, checkout y post-purchase tienen sus propios contextos y deben integrar
  Markets caso por caso.
- Las reglas no crean descuentos ni stock; solo ajustan campañas y textos sobre
  datos existentes.
- Si no hay country/market/locale/currency detectable, no se aplica ningun
  override.
