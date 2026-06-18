# Checkout UI Extension

Promo Pulse incluye una Checkout UI Extension en
`extensions/promo-pulse-checkout` para mostrar mensajes promocionales de baja
friccion cuando el merchant agrega el bloque desde el checkout editor.

## Que Muestra

El bloque consume `/api/checkout/campaign` o, por defecto, el App Proxy:

`/apps/counterpulse-campaigns/api/checkout/campaign`

El backend selecciona una campana activa y checkout-safe para estos casos:

- Free shipping reminder.
- Discount code expiration.
- Delivery cutoff.
- Limited-time offer.
- Cart goal.

El bloque solo muestra mensajes y timers derivados de datos reales de la
campana. No modifica carrito, descuentos, atributos, metafields ni progreso de
pago.

## Settings Del Bloque

En el checkout editor, el bloque expone:

- `campaignId`: opcional. Requerido solo con `SPECIFIC_CAMPAIGN`.
- `mode`: `AUTO_ELIGIBLE` o `SPECIFIC_CAMPAIGN`.
- `compactMode`: reduce espaciado del mensaje.
- `showTimer`: muestra countdown solo si la campana tiene `endsAt` futuro.

Si `mode=SPECIFIC_CAMPAIGN` y falta `campaignId`, la extension no llama al
backend y no renderiza contenido.

## Gating

La feature usa `canUsePremiumFeature(shop, "CHECKOUT_EXTENSIONS")`.

- Permitida desde `GROWTH`.
- `PRO` queda incluido como tier superior actual del repo.
- `FREE` y `STARTER` reciben respuesta gated y la extension no muestra bloque.

## Seguridad

El endpoint directo `/api/checkout/campaign` autentica requests de checkout con
`authenticate.public.checkout()` y valida que el `shop` de la query coincida con
el `dest` del session token.

El endpoint de App Proxy
`/apps/counterpulse-campaigns/api/checkout/campaign` valida el request con
`authenticate.public.appProxy()` antes de resolver campanas.

En `E2E_TEST_MODE=true` se permite llamar el endpoint sin Shopify real para
tests automatizados. Ese bypass no funciona en produccion.

## Network Access

La extension usa `network_access = true` porque necesita pedir al backend la
campana elegible. Antes de publicar, habilitar network access en Partner
Dashboard para la app. El backend responde CORS con:

`Access-Control-Allow-Origin: *`

## Como Agregar El Bloque

1. Desplegar la app con `shopify app deploy`.
2. Confirmar que `extensions/promo-pulse-checkout` aparece en la version de la
   app.
3. En Shopify Admin, abrir el checkout editor.
4. Agregar el bloque `promo-pulse-checkout` en una ubicacion soportada.
5. Dejar `mode=AUTO_ELIGIBLE` para seleccion automatica o usar
   `SPECIFIC_CAMPAIGN` con un `campaignId`.
6. Guardar checkout.

## Limitaciones Shopify

Segun la documentacion de Shopify 2026-04, las Checkout UI extensions en los
pasos information, shipping y payment estan disponibles solo para tiendas
Shopify Plus. Si la tienda no tiene checkout editor o no soporta el target
`purchase.checkout.block.render`, el merchant no podra agregar el bloque.

El bloque no auto-aplica descuentos. Para codigos, muestra solamente el codigo
publico que el backend devuelve y no afirma que este aplicado.

## Como Probar

```bash
npm run test:unit -- app/services/checkout/checkoutCampaignViewModel.test.ts tests/unit/checkout-campaign-endpoint.test.ts tests/unit/checkout-extension-api.test.ts
npx playwright test tests/e2e/checkout-extension.spec.ts
npx shopify app build
```

Para smoke manual en una dev store compatible:

1. Usar un shop `GROWTH` o `PRO` en Promo Pulse.
2. Crear una campana activa de free shipping, delivery cutoff, countdown o cart
   timer.
3. Agregar el bloque en checkout editor.
4. Probar que el bloque desaparece si el endpoint falla o si el plan baja a
   `STARTER`.
