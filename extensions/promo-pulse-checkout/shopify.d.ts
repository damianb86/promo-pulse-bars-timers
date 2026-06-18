import '@shopify/ui-extensions';

//@ts-expect-error Shopify generated ambient module.
declare module './src/Checkout.jsx' {
  const shopify: import('@shopify/ui-extensions/purchase.checkout.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-expect-error Shopify generated ambient module.
declare module './src/ThankYou.jsx' {
  const shopify: import('@shopify/ui-extensions/purchase.thank-you.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-expect-error Shopify generated ambient module.
declare module './src/checkoutApi.js' {
  const shopify: import('@shopify/ui-extensions/purchase.checkout.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-expect-error Shopify generated ambient module.
declare module './src/postPurchaseApi.js' {
  const shopify: import('@shopify/ui-extensions/purchase.thank-you.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}
