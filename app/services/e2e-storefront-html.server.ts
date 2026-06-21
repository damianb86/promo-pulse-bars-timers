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
      .e2e-image { width: 100%; aspect-ratio: 1; background: #f1f2f4; border-radius: 8px; }
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
    ${embedRoot({ locale, country, currency, market, subtotalCents })}
    ${bodyForKind(kind, { locale, country, currency, subtotalCents })}
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
}: {
  locale: string;
  country: string;
  currency: string;
  market: string;
  subtotalCents: number;
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
  },
) {
  if (kind === "product") {
    return `<main>
      <div class="e2e-product">
        <div class="e2e-image"></div>
        <section>
          <h1>Everyday Hoodie</h1>
          <p>$78.00</p>
          <div
            class="pp-product-timer"
            data-shop="${E2E_DEMO_SHOP_DOMAIN}"
            data-product-id="gid://shopify/Product/e2e-hoodie"
            data-product-tags="sale,hoodie"
            data-locale="${escapeHtml(context.locale)}"
            data-country="${escapeHtml(context.country)}"
            data-fallback-mode="AUTO_ELIGIBLE"
            data-alignment="CENTER"
            data-debug="true"
          ></div>
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
    <a href="/collections/sale">Sale collection</a>
  </main>`;
}

function scriptsForKind(kind: StorefrontPageKind) {
  const common = `
    <script src="/__test/theme-asset/discount-code.js" defer></script>`;

  if (kind === "product") {
    return `${common}
    <script src="/__test/theme-asset/delivery-cutoff.js" defer></script>
    <script src="/__test/theme-asset/product-timer.js" defer></script>`;
  }

  if (kind === "cart") {
    return `${common}
    <script src="/__test/theme-asset/cart-timer.js" defer></script>
    <script src="/__test/theme-asset/free-shipping.js" defer></script>`;
  }

  return `${common}
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
