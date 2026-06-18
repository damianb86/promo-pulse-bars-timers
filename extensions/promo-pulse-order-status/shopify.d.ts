import '@shopify/ui-extensions';

//@ts-expect-error Shopify generated ambient module.
declare module './src/OrderStatus.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-status.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-expect-error Shopify generated ambient module.
declare module './src/postPurchaseApi.js' {
  const shopify: import('@shopify/ui-extensions/customer-account.order-status.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}
