import { route } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default [
  ...(await flatRoutes({
    ignoredRouteFiles: ["**/__test.*"],
  })),
  route("__test/login", "routes/__test.login.tsx"),
  route("__test/reset-db", "routes/__test.reset-db.ts"),
  route("__test/analytics-summary", "routes/__test.analytics-summary.ts"),
  route("__test/storefront", "routes/__test.storefront.tsx"),
  route("__test/storefront-product", "routes/__test.storefront-product.tsx"),
  route("__test/storefront-cart", "routes/__test.storefront-cart.tsx"),
  route("__test/theme-asset/:asset", "routes/__test.theme-asset.$asset.ts"),
];
