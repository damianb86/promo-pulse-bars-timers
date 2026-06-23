import { E2E_DEMO_SHOP_DOMAIN } from "./e2e-test.server";

type StorefrontPageKind = "home" | "product" | "cart";

export function buildE2EStorefrontHtml(
  request: Request,
  kind: StorefrontPageKind,
) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") || "en";
  const country = url.searchParams.get("country") || "US";
  const market = url.searchParams.get("market") || "";
  const currency = url.searchParams.get("currency") || "USD";
  const badCart = url.searchParams.get("badCart") === "1";
  const consentAllowed = url.searchParams.get("consent") !== "denied";
  const visitorId = url.searchParams.get("visitorId") || "";
  const sessionId = url.searchParams.get("sessionId") || "";
  const subtotal = Number(url.searchParams.get("subtotal") || "40");
  const productId =
    url.searchParams.get("productId") || "gid://shopify/Product/e2e-hoodie";
  const productTags = url.searchParams.get("productTags") || "sale,hoodie";
  const collectionIds =
    url.searchParams.get("collectionIds") ||
    "gid://shopify/Collection/e2e-sale";
  const customThemeTargets = url.searchParams.get("customThemeTargets") === "1";
  const inventory = Number(url.searchParams.get("inventory") || "3");
  const inventoryQuantity = Number.isFinite(inventory) ? inventory : 3;
  const subtotalCents = Number.isFinite(subtotal)
    ? Math.round(subtotal * 100)
    : 4000;
  const title =
    kind === "product"
      ? "E2E Product"
      : kind === "cart"
        ? "E2E Cart"
        : "E2E Storefront";

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="/__test/theme-asset/promo-pulse.css" />
    <style>
      body { margin: 0; font-family: Inter, system-ui, sans-serif; color: #202223; }
      main { max-width: 960px; margin: 0 auto; padding: 32px 16px; }
      .e2e-product { display: grid; grid-template-columns: 220px 1fr; gap: 24px; align-items: start; }
      .e2e-product media-gallery { display: block; position: relative; }
      .e2e-image { width: 100%; aspect-ratio: 1; background: #f1f2f4; border-radius: 8px; }
      .e2e-product-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin: 32px 0; }
      .e2e-product-card a { color: inherit; text-decoration: none; }
      .e2e-product-card .card__inner { position: relative; display: grid; gap: 10px; }
      .e2e-product-card .card__media { position: relative; display: block; }
      .e2e-product-card img { width: 100%; display: block; border-radius: 10px; }
      .e2e-cart-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(380px, 100vw); padding: 20px; background: #fff; border-left: 1px solid #d8d8d8; box-shadow: -20px 0 60px rgba(0,0,0,.12); transform: translateX(105%); transition: transform 120ms ease; z-index: 20; }
      .e2e-cart-drawer[data-open="true"] { transform: translateX(0); }
      .drawer__contents { display: grid; gap: 12px; }
    </style>
    <script>
      window.Shopify = {
        shop: "${E2E_DEMO_SHOP_DOMAIN}",
        country: "${escapeJs(country)}",
        market: "${escapeJs(market)}",
        currency: { active: "${escapeJs(currency)}" },
        customerPrivacy: { analyticsProcessingAllowed: function () { return ${consentAllowed ? "true" : "false"}; } }
      };
      window.PromoPulseAnalyticsEndpoint = "/api/analytics/event";
      window.PromoPulseCartSubtotal = ${subtotalCents / 100};
      window.PromoPulseCartCurrency = "${escapeJs(currency)}";
      try {
        ${
          visitorId
            ? `window.localStorage.setItem("promo_pulse_visitor_id", "${escapeJs(visitorId)}");`
            : ""
        }
        ${
          sessionId
            ? `window.sessionStorage.setItem("promo_pulse_session_id", "${escapeJs(sessionId)}");`
            : ""
        }
      } catch {}
      window.__promoPulseFetchCounts = { cart: 0 };
      window.__promoPulseCart = {
        token: "e2e-cart-token",
        total_price: ${subtotalCents},
        currency: "${escapeJs(currency)}",
        item_count: ${subtotalCents > 0 ? 1 : 0}
      };
      (function () {
        var nativeFetch = window.fetch.bind(window);
        window.fetch = function (input, init) {
          var rawUrl = typeof input === "string" ? input : input && input.url;
          var target = new URL(rawUrl || "", window.location.href);
          if (target.pathname === "/cart.js") {
            window.__promoPulseFetchCounts.cart += 1;
            ${
              badCart
                ? `return Promise.resolve(new Response("<html>Password</html>", {
              status: 200,
              headers: { "Content-Type": "text/html" }
            }));`
                : ""
            }
            return Promise.resolve(new Response(JSON.stringify(window.__promoPulseCart), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }));
          }
          return nativeFetch(input, init);
        };
      })();
    </script>
  </head>
  <body>
    ${embedRoot({
      locale,
      country,
      currency,
      market,
      subtotalCents,
      productId: kind === "product" ? productId : "",
      productTags: kind === "product" ? productTags : "",
      collectionIds: kind === "product" ? collectionIds : "",
      inventoryQuantity: kind === "product" ? inventoryQuantity : null,
    })}
    ${bodyForKind(kind, {
      locale,
      country,
      currency,
      subtotalCents,
      productId,
      productTags,
      collectionIds,
      inventoryQuantity,
      customCampaignId: url.searchParams.get("customCampaignId") || "",
      customThemeTargets,
    })}
    ${scriptsForKind(kind)}
  </body>
</html>`;
}

function embedRoot({
  locale,
  country,
  currency,
  market,
  subtotalCents,
  productId,
  productTags,
  collectionIds,
  inventoryQuantity,
}: {
  locale: string;
  country: string;
  currency: string;
  market: string;
  subtotalCents: number;
  productId: string;
  productTags: string;
  collectionIds: string;
  inventoryQuantity: number | null;
}) {
  return `<div
    id="promo-pulse-app-embed"
    class="pp-root"
    data-shop="${E2E_DEMO_SHOP_DOMAIN}"
    data-default-locale="en"
    data-locale="${escapeHtml(locale)}"
    data-country="${escapeHtml(country)}"
    data-market="${escapeHtml(market)}"
    data-cart-total-cents="${subtotalCents}"
    data-cart-currency="${escapeHtml(currency)}"
    data-cart-token="e2e-cart-token"
    data-product-id="${escapeHtml(productId)}"
    data-product-tags="${escapeHtml(productTags)}"
    data-collection-ids="${escapeHtml(collectionIds)}"
    data-selected-variant-id="${productId ? "gid://shopify/ProductVariant/e2e-low" : ""}"
    data-inventory-quantity="${inventoryQuantity ?? ""}"
    data-cart-timer-src="/__test/theme-asset/cart-timer.js"
    data-analytics-path="/api/analytics/event"
    data-custom-cart-drawer-selector="#CartDrawer .drawer__contents"
    data-debug="true"
  >
    <aside class="pp-debug" role="status" aria-live="polite">
      <p data-pp-debug-status>Debug fixture mounted.</p>
      <code data-pp-debug-url>/apps/promo-pulse</code>
    </aside>
  </div>`;
}

function bodyForKind(
  kind: StorefrontPageKind,
  context: {
    locale: string;
    country: string;
    currency: string;
    subtotalCents: number;
    productId: string;
    productTags: string;
    collectionIds: string;
    inventoryQuantity: number;
    customCampaignId: string;
    customThemeTargets: boolean;
  },
) {
  if (kind === "product") {
    return `<main>
      <div class="e2e-product">
        <media-gallery id="MediaGallery-e2e" data-product-media>
          <div class="e2e-image"></div>
        </media-gallery>
        <section>
          <h1>Everyday Hoodie</h1>
          <p>$78.00</p>
          <form action="/cart/add">
            <label for="e2e-variant">Variant</label>
            <select id="e2e-variant" name="id">
              <option value="e2e-low">Low inventory</option>
              <option value="e2e-high">High inventory</option>
            </select>
          </form>
          <div
            class="pp-product-timer"
            data-shop="${E2E_DEMO_SHOP_DOMAIN}"
            data-product-id="${escapeHtml(context.productId)}"
            data-product-tags="${escapeHtml(context.productTags)}"
            data-collection-ids="${escapeHtml(context.collectionIds)}"
            data-selected-variant-id="gid://shopify/ProductVariant/e2e-low"
            data-inventory-quantity="${context.inventoryQuantity}"
            data-variants-script-id="promo-pulse-e2e-variants"
            data-locale="${escapeHtml(context.locale)}"
            data-country="${escapeHtml(context.country)}"
            data-fallback-mode="AUTO_ELIGIBLE"
            data-alignment="CENTER"
            data-debug="true"
          ></div>
          <script id="promo-pulse-e2e-variants" type="application/json">
            [
              {"id":"gid://shopify/ProductVariant/e2e-low","legacyId":"e2e-low","inventoryQuantity":${context.inventoryQuantity}},
              {"id":"gid://shopify/ProductVariant/e2e-high","legacyId":"e2e-high","inventoryQuantity":10}
            ]
          </script>
          <button type="button">Add to cart</button>
        </section>
      </div>
    </main>`;
  }

  if (kind === "cart") {
    return `<main>
      <h1>Cart</h1>
      <p>Subtotal: <span id="e2e-subtotal">$${(context.subtotalCents / 100).toFixed(2)}</span></p>
      <div
        class="pp-cart-timer"
        data-shop="${E2E_DEMO_SHOP_DOMAIN}"
        data-cart-total-cents="${context.subtotalCents}"
        data-cart-currency="${escapeHtml(context.currency)}"
        data-cart-token="e2e-cart-token"
        data-locale="${escapeHtml(context.locale)}"
        data-country="${escapeHtml(context.country)}"
        data-fallback-mode="AUTO_ELIGIBLE"
        data-alignment="CENTER"
        data-debug="true"
      ></div>
      <button id="open-cart-drawer" type="button">Open cart drawer</button>
    </main>
    <cart-drawer id="CartDrawer" class="e2e-cart-drawer" data-open="false">
      <div class="drawer__contents">
        <h2>Cart drawer</h2>
        <form action="/cart">
          <button type="button">Checkout</button>
        </form>
      </div>
    </cart-drawer>
    <script>
      document.getElementById("open-cart-drawer").addEventListener("click", function () {
        var drawer = document.getElementById("CartDrawer");
        drawer.dataset.open = drawer.dataset.open === "true" ? "false" : "true";
        document.dispatchEvent(new Event("cart:updated"));
      });
      window.__setPromoPulseSubtotal = function (amount) {
        window.PromoPulseCartSubtotal = amount;
        window.__promoPulseCart.total_price = Math.round(amount * 100);
        document.getElementById("e2e-subtotal").textContent = "$" + amount.toFixed(2);
        document.dispatchEvent(new Event("cart:updated"));
      };
    </script>`;
  }

  return `<main>
    <h1>E2E Storefront</h1>
    <p>This page simulates a Shopify storefront with the Promo Pulse app embed enabled.</p>
    ${
      context.customCampaignId
        ? `<div
      data-promo-pulse-placement="CUSTOM_SELECTOR"
      data-promo-pulse-campaign-id="${escapeHtml(context.customCampaignId)}"
    ></div>`
        : ""
    }
    ${
      context.customThemeTargets
        ? `<section class="e2e-custom-targets" aria-label="Custom placement targets">
      <div class="e2e-custom-target" data-testid="custom-theme-target"></div>
      <div class="e2e-custom-fallback-target" data-testid="custom-theme-fallback-target"></div>
    </section>`
        : ""
    }
    <section class="e2e-product-grid" aria-label="Featured products">
      ${productCard({
        id: "gid://shopify/Product/e2e-hoodie",
        title: "Everyday Hoodie",
        tags: "sale,hoodie",
        collectionIds: "gid://shopify/Collection/e2e-sale",
      })}
      ${productCard({
        id: "gid://shopify/Product/e2e-mug",
        title: "Ceramic Mug",
        tags: "gift,home",
        collectionIds: "gid://shopify/Collection/e2e-home",
      })}
      ${productCard({
        id: "gid://shopify/Product/e2e-bag",
        title: "Canvas Bag",
        tags: "vip-tag,accessory",
        collectionIds: "gid://shopify/Collection/e2e-sale",
      })}
    </section>
    <a href="/collections/sale">Sale collection</a>
  </main>`;
}

function productCard({
  id,
  title,
  tags,
  collectionIds,
}: {
  id: string;
  title: string;
  tags: string;
  collectionIds: string;
}) {
  return `<article
    class="e2e-product-card card-wrapper"
    data-product-card
    data-product-id="${escapeHtml(id)}"
    data-product-tags="${escapeHtml(tags)}"
    data-collection-ids="${escapeHtml(collectionIds)}"
    data-product-vendor="E2E Vendor"
    data-price="24"
    data-compare-at-price="32"
    data-discount-active="true"
  >
    <div class="card">
      <div class="card__inner">
        <div class="card__media">
          <a href="/products/${escapeHtml(title.toLowerCase().replace(/\s+/g, "-"))}">
            <img alt="${escapeHtml(title)}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 320 320'%3E%3Crect width='320' height='320' fill='%23f1f5f9'/%3E%3C/svg%3E" />
          </a>
        </div>
        <div class="card__content">
          <a href="/products/${escapeHtml(title.toLowerCase().replace(/\s+/g, "-"))}">
            <span>${escapeHtml(title)}</span>
          </a>
        </div>
      </div>
    </div>
  </article>`;
}

function scriptsForKind(kind: StorefrontPageKind) {
  const common = `
    <script src="/__test/theme-asset/discount-code.js" defer></script>`;

  if (kind === "product") {
    return `${common}
    <script src="/__test/theme-asset/product-badge.js" defer></script>
    <script src="/__test/theme-asset/delivery-cutoff.js" defer></script>
    <script src="/__test/theme-asset/product-timer.js" defer></script>
    <script src="/__test/theme-asset/low-stock.js" defer></script>`;
  }

  if (kind === "cart") {
    return `${common}
    <script src="/__test/theme-asset/cart-timer.js" defer></script>
    <script src="/__test/theme-asset/free-shipping.js" defer></script>`;
  }

  return `${common}
    <script src="/__test/theme-asset/product-badge.js" defer></script>
    <script src="/__test/theme-asset/free-shipping.js" defer></script>
    <script src="/__test/theme-asset/delivery-cutoff.js" defer></script>
    <script src="/__test/theme-asset/cart-timer.js" defer></script>
    <script src="/__test/theme-asset/promo-pulse.js" defer></script>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeJs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
