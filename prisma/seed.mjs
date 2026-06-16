/* eslint-env node */
import {
  AnalyticsEventType,
  CampaignGoal,
  CampaignStatus,
  CampaignType,
  DeliveryAfterCutoffBehavior,
  DiscountSyncMethod,
  FreeShippingProgressStyle,
  PlacementType,
  PrismaClient,
  ShopPlan,
  TimerMode,
  TimerResetBehavior,
} from "@prisma/client";

const prisma = new PrismaClient();

const demoShopDomain = "counterpulse-demo.myshopify.com";
const demoCampaignIds = [
  "demo-flash-sale-countdown-bar",
  "demo-free-shipping-goal",
  "demo-delivery-cutoff",
];

const emptyTargeting = {
  countries: [],
  markets: [],
  locales: ["en", "es", "pt-BR", "fr", "de"],
  productIds: [],
  collectionIds: [],
  productTags: [],
  customerTags: [],
  urlContains: [],
  utmSources: [],
  devices: ["desktop", "mobile"],
  excludeProductIds: [],
  excludeCollectionIds: [],
};

const translations = {
  countdown: [
    {
      locale: "en",
      headline: "Flash sale ends soon",
      subheadline: "Save today before the timer runs out.",
      ctaText: "Shop now",
      ctaUrl: "/collections/sale",
      expiredText: "This offer has ended.",
    },
    {
      locale: "es",
      headline: "La oferta relampago termina pronto",
      subheadline: "Ahorra hoy antes de que termine el contador.",
      ctaText: "Comprar ahora",
      ctaUrl: "/collections/sale",
      expiredText: "Esta oferta termino.",
    },
    {
      locale: "pt-BR",
      headline: "A promocao relampago termina em breve",
      subheadline: "Economize hoje antes que o contador acabe.",
      ctaText: "Comprar agora",
      ctaUrl: "/collections/sale",
      expiredText: "Esta oferta terminou.",
    },
    {
      locale: "fr",
      headline: "La vente flash se termine bientot",
      subheadline: "Profitez-en avant la fin du compte a rebours.",
      ctaText: "Acheter",
      ctaUrl: "/collections/sale",
      expiredText: "Cette offre est terminee.",
    },
    {
      locale: "de",
      headline: "Der Blitzverkauf endet bald",
      subheadline: "Spare heute, bevor der Timer ablaeuft.",
      ctaText: "Jetzt kaufen",
      ctaUrl: "/collections/sale",
      expiredText: "Dieses Angebot ist beendet.",
    },
  ],
  freeShipping: [
    {
      locale: "en",
      headline: "You are close to free shipping",
      subheadline: "Keep adding items to unlock delivery on us.",
      ctaText: "Continue shopping",
      freeShippingEmptyText: "Your cart is empty. Add items to unlock free shipping.",
      freeShippingProgressText: "You're {{amount}} away from free shipping",
      freeShippingSuccessText: "You've unlocked free shipping!",
      badgeText: "Free shipping",
    },
    {
      locale: "es",
      headline: "Estas cerca del envio gratis",
      subheadline: "Agrega mas productos para activar el envio gratis.",
      ctaText: "Seguir comprando",
      freeShippingEmptyText: "Tu carrito esta vacio. Agrega productos para activar envio gratis.",
      freeShippingProgressText: "Agrega {{remaining_amount}} mas para envio gratis.",
      freeShippingSuccessText: "Activaste el envio gratis.",
      badgeText: "Envio gratis",
    },
    {
      locale: "pt-BR",
      headline: "Voce esta perto do frete gratis",
      subheadline: "Adicione mais itens para liberar o frete por nossa conta.",
      ctaText: "Continuar comprando",
      freeShippingEmptyText: "Seu carrinho esta vazio. Adicione itens para liberar frete gratis.",
      freeShippingProgressText: "Adicione mais {{remaining_amount}} para frete gratis.",
      freeShippingSuccessText: "Voce desbloqueou frete gratis.",
      badgeText: "Frete gratis",
    },
    {
      locale: "fr",
      headline: "Vous etes proche de la livraison gratuite",
      subheadline: "Ajoutez des articles pour debloquer la livraison offerte.",
      ctaText: "Continuer mes achats",
      freeShippingEmptyText: "Votre panier est vide. Ajoutez des articles pour debloquer la livraison gratuite.",
      freeShippingProgressText: "Ajoutez encore {{remaining_amount}} pour la livraison gratuite.",
      freeShippingSuccessText: "Vous avez debloque la livraison gratuite.",
      badgeText: "Livraison gratuite",
    },
    {
      locale: "de",
      headline: "Du bist nah am kostenlosen Versand",
      subheadline: "Fuege weitere Artikel hinzu, um kostenlosen Versand zu erhalten.",
      ctaText: "Weiter einkaufen",
      freeShippingEmptyText: "Dein Warenkorb ist leer. Fuege Artikel hinzu, um kostenlosen Versand zu erhalten.",
      freeShippingProgressText: "Fuege {{remaining_amount}} hinzu fuer kostenlosen Versand.",
      freeShippingSuccessText: "Du hast kostenlosen Versand freigeschaltet.",
      badgeText: "Kostenloser Versand",
    },
  ],
  deliveryCutoff: [
    {
      locale: "en",
      headline: "Order today for fast delivery",
      subheadline: "Beat the cutoff and get your order moving sooner.",
      ctaText: "Order now",
      deliveryBeforeCutoffText:
        "Order within {{time_left}} to get it by {{max_delivery_weekday}}.",
      deliveryAfterCutoffText: "Orders placed now ship {{ships_weekday}}.",
      badgeText: "Ships today",
    },
    {
      locale: "es",
      headline: "Compra hoy para entrega rapida",
      subheadline: "Llega antes del corte y despachamos antes.",
      ctaText: "Comprar ahora",
      deliveryBeforeCutoffText: "Compra en {{time_left}} para despachar hoy.",
      deliveryAfterCutoffText: "Los pedidos ahora despachan el proximo dia habil.",
      badgeText: "Despacha hoy",
    },
    {
      locale: "pt-BR",
      headline: "Compre hoje para entrega rapida",
      subheadline: "Aproveite antes do limite e envie mais cedo.",
      ctaText: "Comprar agora",
      deliveryBeforeCutoffText: "Compre em {{time_left}} para enviar hoje.",
      deliveryAfterCutoffText: "Pedidos feitos agora enviam no proximo dia util.",
      badgeText: "Envia hoje",
    },
    {
      locale: "fr",
      headline: "Commandez aujourd'hui pour une livraison rapide",
      subheadline: "Passez avant l'heure limite pour expedier plus rapidement.",
      ctaText: "Commander",
      deliveryBeforeCutoffText: "Commandez dans {{time_left}} pour une expedition aujourd'hui.",
      deliveryAfterCutoffText: "Les commandes passees maintenant partiront le prochain jour ouvre.",
      badgeText: "Expedie aujourd'hui",
    },
    {
      locale: "de",
      headline: "Bestelle heute fuer schnelle Lieferung",
      subheadline: "Bestelle vor Annahmeschluss, damit deine Bestellung frueher startet.",
      ctaText: "Jetzt bestellen",
      deliveryBeforeCutoffText: "Bestelle innerhalb von {{time_left}}, damit heute versendet wird.",
      deliveryAfterCutoffText: "Bestellungen ab jetzt werden am naechsten Werktag versendet.",
      badgeText: "Versand heute",
    },
  ],
};

function daysFromNow(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function main() {
  const shop = await prisma.shop.upsert({
    where: { shopifyDomain: demoShopDomain },
    update: { plan: ShopPlan.GROWTH },
    create: {
      shopifyDomain: demoShopDomain,
      plan: ShopPlan.GROWTH,
    },
  });

  await prisma.shopOnboardingChecklist.upsert({
    where: { shopId: shop.id },
    update: {
      firstCampaignCreated: true,
      appEmbedEnabled: false,
      productBlockAdded: false,
      cartBlockAdded: false,
      firstImpressionReceived: false,
    },
    create: {
      shopId: shop.id,
      firstCampaignCreated: true,
    },
  });

  await prisma.shopSettings.upsert({
    where: { shopId: shop.id },
    update: {
      defaultLocale: "en",
      enabledLocales: ["en", "es", "pt-BR", "fr", "de"],
      defaultTimezone: "America/New_York",
      defaultCurrency: "USD",
      enableDebugMode: false,
      brandName: "Promo Pulse",
      supportEmail: "support@example.com",
      defaultCountry: "US",
      customCartDrawerSelector: "#CartDrawer",
      analyticsEnabled: true,
      respectDoNotTrack: true,
      consentMode: "BASIC",
    },
    create: {
      shopId: shop.id,
      defaultLocale: "en",
      enabledLocales: ["en", "es", "pt-BR", "fr", "de"],
      defaultTimezone: "America/New_York",
      defaultCurrency: "USD",
      enableDebugMode: false,
      brandName: "Promo Pulse",
      supportEmail: "support@example.com",
      defaultCountry: "US",
      customCartDrawerSelector: "#CartDrawer",
      analyticsEnabled: true,
      respectDoNotTrack: true,
      consentMode: "BASIC",
    },
  });

  await prisma.analyticsEvent.deleteMany({
    where: { shopId: shop.id },
  });

  await prisma.campaign.deleteMany({
    where: {
      id: { in: demoCampaignIds },
      shopId: shop.id,
    },
  });

  const flashSaleCampaign = await prisma.campaign.create({
    data: {
      id: "demo-flash-sale-countdown-bar",
      shopId: shop.id,
      name: "Flash Sale Countdown Bar",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.COUNTDOWN_BAR,
      goal: CampaignGoal.FLASH_SALE,
      startsAt: daysFromNow(-1),
      endsAt: daysFromNow(7),
      timezone: "America/New_York",
      priority: 100,
      placements: {
        create: [{ placementType: PlacementType.TOP_BAR }],
      },
      targeting: {
        create: {
          ...emptyTargeting,
          utmSources: ["summer-sale", "email"],
        },
      },
      design: {
        create: {
          templateKey: "flash-sale-bold",
          backgroundColor: "#111827",
          textColor: "#FFFFFF",
          accentColor: "#F97316",
          buttonColor: "#FFFFFF",
          buttonTextColor: "#111827",
          fontSize: 15,
          borderRadius: 4,
          positionSticky: true,
          mobileEnabled: true,
          alignment: "CENTER",
          showCloseButton: true,
          showIcon: true,
          icon: "FIRE",
        },
      },
      timerSettings: {
        create: {
          mode: TimerMode.FIXED_DATE,
          durationMinutes: null,
          recurringDays: [],
          resetBehavior: TimerResetBehavior.NEVER,
        },
      },
      discountSync: {
        create: {
          shopifyDiscountId: "gid://shopify/DiscountCodeNode/demo-flash-sale",
          discountCode: "FLASH20",
          method: DiscountSyncMethod.CODE,
          syncStartEnd: true,
        },
      },
      translations: {
        create: translations.countdown,
      },
    },
  });

  const freeShippingCampaign = await prisma.campaign.create({
    data: {
      id: "demo-free-shipping-goal",
      shopId: shop.id,
      name: "Free Shipping Goal",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.FREE_SHIPPING_GOAL,
      goal: CampaignGoal.FREE_SHIPPING,
      startsAt: daysFromNow(-1),
      endsAt: null,
      timezone: "America/New_York",
      priority: 80,
      placements: {
        create: [
          { placementType: PlacementType.CART_PAGE },
          { placementType: PlacementType.CART_DRAWER },
        ],
      },
      targeting: {
        create: {
          ...emptyTargeting,
          countries: ["US", "CA"],
        },
      },
      design: {
        create: {
          templateKey: "free-shipping-progress",
          backgroundColor: "#F8FAFC",
          textColor: "#111827",
          accentColor: "#16A34A",
          buttonColor: "#111827",
          buttonTextColor: "#FFFFFF",
          fontSize: 14,
          borderRadius: 6,
          positionSticky: false,
          mobileEnabled: true,
          alignment: "CENTER",
          showCloseButton: false,
          showIcon: true,
          icon: "TRUCK",
        },
      },
      freeShippingSettings: {
        create: {
          thresholdAmount: "75.00",
          currencyCode: "USD",
          includeDiscountedSubtotal: true,
          emptyCartMessage: "Your cart is empty. Add items to unlock free shipping.",
          successMessage: "Free shipping unlocked.",
          progressStyle: FreeShippingProgressStyle.BAR,
          thresholdRules: {
            countries: {
              CA: 100,
              US: 75,
            },
          },
        },
      },
      translations: {
        create: translations.freeShipping,
      },
    },
  });

  const deliveryCutoffCampaign = await prisma.campaign.create({
    data: {
      id: "demo-delivery-cutoff",
      shopId: shop.id,
      name: "Delivery Cutoff",
      status: CampaignStatus.ACTIVE,
      type: CampaignType.DELIVERY_CUTOFF,
      goal: CampaignGoal.DELIVERY_CUTOFF,
      startsAt: daysFromNow(-1),
      endsAt: null,
      timezone: "America/New_York",
      priority: 60,
      placements: {
        create: [
          { placementType: PlacementType.PRODUCT_PAGE },
          { placementType: PlacementType.CART_DRAWER },
        ],
      },
      targeting: {
        create: {
          ...emptyTargeting,
          countries: ["US"],
          devices: ["desktop", "mobile", "tablet"],
        },
      },
      design: {
        create: {
          templateKey: "delivery-cutoff-clean",
          backgroundColor: "#FFFFFF",
          textColor: "#111827",
          accentColor: "#2563EB",
          buttonColor: "#2563EB",
          buttonTextColor: "#FFFFFF",
          fontSize: 14,
          borderRadius: 4,
          positionSticky: false,
          mobileEnabled: true,
          alignment: "LEFT",
          showCloseButton: false,
          showIcon: true,
          icon: "CLOCK",
        },
      },
      deliveryCutoffSettings: {
        create: {
          cutoffHour: 14,
          cutoffMinute: 0,
          processingDays: 0,
          minDeliveryDays: 2,
          maxDeliveryDays: 5,
          workingDays: [1, 2, 3, 4, 5],
          holidays: [],
          countryRules: {
            US: {
              cutoffHour: 14,
              cutoffMinute: 0,
              minDeliveryDays: 2,
              maxDeliveryDays: 5,
            },
          },
          afterCutoffBehavior: DeliveryAfterCutoffBehavior.SHOW_NEXT_WINDOW,
        },
      },
      translations: {
        create: translations.deliveryCutoff,
      },
    },
  });

  await prisma.analyticsEvent.createMany({
    data: [
      {
        shopId: shop.id,
        campaignId: flashSaleCampaign.id,
        eventType: AnalyticsEventType.IMPRESSION,
        placementType: PlacementType.TOP_BAR,
        sessionId: "demo-session-1",
        country: "US",
        locale: "en",
        occurredAt: daysFromNow(-1),
      },
      {
        shopId: shop.id,
        campaignId: flashSaleCampaign.id,
        eventType: AnalyticsEventType.IMPRESSION,
        placementType: PlacementType.TOP_BAR,
        sessionId: "demo-session-2",
        country: "US",
        locale: "en",
        occurredAt: daysFromNow(-2),
      },
      {
        shopId: shop.id,
        campaignId: flashSaleCampaign.id,
        eventType: AnalyticsEventType.CLICK,
        placementType: PlacementType.TOP_BAR,
        sessionId: "demo-session-1",
        country: "US",
        locale: "en",
        occurredAt: daysFromNow(-1),
      },
      {
        shopId: shop.id,
        campaignId: flashSaleCampaign.id,
        eventType: AnalyticsEventType.ORDER_ATTRIBUTED,
        placementType: PlacementType.TOP_BAR,
        sessionId: "demo-session-1",
        orderId: "demo-order-1001",
        revenueAmount: "128.50",
        currencyCode: "USD",
        country: "US",
        locale: "en",
        occurredAt: daysFromNow(-1),
      },
      {
        shopId: shop.id,
        campaignId: freeShippingCampaign.id,
        eventType: AnalyticsEventType.IMPRESSION,
        placementType: PlacementType.CART_DRAWER,
        sessionId: "demo-session-3",
        cartToken: "demo-cart-3",
        country: "CA",
        locale: "en",
        occurredAt: daysFromNow(-3),
      },
      {
        shopId: shop.id,
        campaignId: freeShippingCampaign.id,
        eventType: AnalyticsEventType.CLICK,
        placementType: PlacementType.CART_DRAWER,
        sessionId: "demo-session-3",
        cartToken: "demo-cart-3",
        country: "CA",
        locale: "en",
        occurredAt: daysFromNow(-3),
      },
      {
        shopId: shop.id,
        campaignId: deliveryCutoffCampaign.id,
        eventType: AnalyticsEventType.IMPRESSION,
        placementType: PlacementType.PRODUCT_PAGE,
        sessionId: "demo-session-4",
        country: "US",
        locale: "es",
        occurredAt: daysFromNow(-4),
      },
    ],
  });

  console.log(
    `Seeded ${demoCampaignIds.length} demo campaigns for ${shop.shopifyDomain}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
