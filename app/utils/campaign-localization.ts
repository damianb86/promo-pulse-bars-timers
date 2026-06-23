import type {
  CampaignGoalValue,
  CampaignTypeValue,
} from "../types/campaign-options";
import {
  campaignTranslationFields,
  createEmptyCampaignTranslationsByLocale,
  defaultStorefrontLocale,
  emptyCampaignTranslationValues,
  storefrontLocales,
  type CampaignTextField,
  type CampaignTranslationValues,
  type CampaignTranslationsByLocale,
  type StorefrontLocale,
} from "../types/localization";

export type CampaignTranslationRecord = {
  locale: string;
} & Partial<Record<CampaignTextField, string | null>> & {
    ctaUrl?: string | null;
  };

export type CampaignTextLookup = {
  name?: string;
  type?: string;
  goal?: string;
  translations: CampaignTranslationRecord[];
};

export type CampaignTranslationsViewModel = {
  locales: typeof storefrontLocales;
  fields: typeof campaignTranslationFields;
  values: CampaignTranslationsByLocale;
  resolvedValues: CampaignTranslationsByLocale;
};

type DefaultCampaignCopyKey =
  | "flashSale"
  | "freeShipping"
  | "cartRescue"
  | "deliveryCutoff"
  | "lowStock"
  | "badge"
  | "announcement";

type DefaultTranslationOverrides = Partial<
  Record<
    StorefrontLocale,
    Partial<CampaignTranslationValues> & {
      ctaUrl?: string;
    }
  >
>;

export type CampaignTranslationCreateValues = CampaignTranslationValues & {
  locale: StorefrontLocale;
  ctaUrl?: string;
};

const genericCopy: Record<StorefrontLocale, CampaignTranslationValues> = {
  en: copy({
    headline: "Limited-time offer",
    subheadline: "Save while this promotion is available.",
    ctaText: "Shop now",
    expiredText: "This offer has ended.",
    freeShippingEmptyText:
      "Your cart is empty. Add items to unlock free shipping.",
    freeShippingProgressText: "You're {{amount}} away from free shipping",
    freeShippingSuccessText: "You've unlocked free shipping!",
    deliveryBeforeCutoffText: "Order in {{time_left}} to ship today.",
    deliveryAfterCutoffText: "Orders placed now ship {{ships_weekday}}.",
    lowStockText: "Only {{quantity}} left.",
    badgeText: "Special offer",
  }),
  es: copy({
    headline: "Oferta por tiempo limitado",
    subheadline: "Ahorra mientras esta promocion esta disponible.",
    ctaText: "Comprar ahora",
    expiredText: "Esta oferta termino.",
    freeShippingEmptyText:
      "Tu carrito esta vacio. Agrega productos para activar envio gratis.",
    freeShippingProgressText:
      "Agrega {{remaining_amount}} mas para envio gratis.",
    freeShippingSuccessText: "Activaste el envio gratis.",
    deliveryBeforeCutoffText: "Compra en {{time_left}} para despachar hoy.",
    deliveryAfterCutoffText:
      "Los pedidos realizados ahora se despachan el proximo dia habil.",
    lowStockText: "Solo quedan {{quantity}}.",
    badgeText: "Oferta especial",
  }),
  "pt-BR": copy({
    headline: "Oferta por tempo limitado",
    subheadline: "Economize enquanto esta promocao estiver disponivel.",
    ctaText: "Comprar agora",
    expiredText: "Esta oferta terminou.",
    freeShippingEmptyText:
      "Seu carrinho esta vazio. Adicione itens para liberar frete gratis.",
    freeShippingProgressText:
      "Adicione mais {{remaining_amount}} para frete gratis.",
    freeShippingSuccessText: "Voce desbloqueou frete gratis.",
    deliveryBeforeCutoffText: "Compre em {{time_left}} para enviar hoje.",
    deliveryAfterCutoffText: "Pedidos feitos agora enviam no proximo dia util.",
    lowStockText: "Restam apenas {{quantity}}.",
    badgeText: "Oferta especial",
  }),
  fr: copy({
    headline: "Offre a duree limitee",
    subheadline: "Economisez pendant que cette promotion est disponible.",
    ctaText: "Acheter",
    expiredText: "Cette offre est terminee.",
    freeShippingEmptyText:
      "Votre panier est vide. Ajoutez des articles pour debloquer la livraison gratuite.",
    freeShippingProgressText:
      "Ajoutez encore {{remaining_amount}} pour la livraison gratuite.",
    freeShippingSuccessText: "Vous avez debloque la livraison gratuite.",
    deliveryBeforeCutoffText:
      "Commandez dans {{time_left}} pour une expedition aujourd'hui.",
    deliveryAfterCutoffText:
      "Les commandes passees maintenant partiront le prochain jour ouvre.",
    lowStockText: "Il ne reste que {{quantity}}.",
    badgeText: "Offre speciale",
  }),
  de: copy({
    headline: "Zeitlich begrenztes Angebot",
    subheadline: "Spare, solange diese Aktion verfuegbar ist.",
    ctaText: "Jetzt kaufen",
    expiredText: "Dieses Angebot ist beendet.",
    freeShippingEmptyText:
      "Dein Warenkorb ist leer. Fuege Artikel hinzu, um kostenlosen Versand zu erhalten.",
    freeShippingProgressText:
      "Fuege {{remaining_amount}} hinzu fuer kostenlosen Versand.",
    freeShippingSuccessText: "Du hast kostenlosen Versand freigeschaltet.",
    deliveryBeforeCutoffText:
      "Bestelle innerhalb von {{time_left}}, damit heute versendet wird.",
    deliveryAfterCutoffText:
      "Bestellungen ab jetzt werden am naechsten Werktag versendet.",
    lowStockText: "Nur noch {{quantity}} verfuegbar.",
    badgeText: "Sonderangebot",
  }),
};

const defaultCampaignCopy: Record<
  DefaultCampaignCopyKey,
  Record<StorefrontLocale, CampaignTranslationValues>
> = {
  flashSale: withLocaleOverrides({
    en: {
      headline: "Flash sale ends soon",
      subheadline: "Save before the timer runs out.",
      ctaText: "Shop sale",
      expiredText: "This flash sale has ended.",
      badgeText: "Flash sale",
    },
    es: {
      headline: "La oferta relampago termina pronto",
      subheadline: "Ahorra antes de que termine el contador.",
      ctaText: "Ver ofertas",
      expiredText: "Esta oferta relampago termino.",
      badgeText: "Oferta relampago",
    },
    "pt-BR": {
      headline: "A promocao relampago termina em breve",
      subheadline: "Economize antes que o contador acabe.",
      ctaText: "Ver ofertas",
      expiredText: "Esta promocao relampago terminou.",
      badgeText: "Promocao relampago",
    },
    fr: {
      headline: "La vente flash se termine bientot",
      subheadline: "Profitez-en avant la fin du compte a rebours.",
      ctaText: "Voir les offres",
      expiredText: "Cette vente flash est terminee.",
      badgeText: "Vente flash",
    },
    de: {
      headline: "Der Blitzverkauf endet bald",
      subheadline: "Spare, bevor der Timer ablaeuft.",
      ctaText: "Angebote ansehen",
      expiredText: "Dieser Blitzverkauf ist beendet.",
      badgeText: "Blitzverkauf",
    },
  }),
  freeShipping: withLocaleOverrides({
    en: {
      headline: "You are close to free shipping",
      subheadline: "Keep adding items to unlock delivery on us.",
      ctaText: "Continue shopping",
      freeShippingEmptyText:
        "Your cart is empty. Add items to unlock free shipping.",
      freeShippingProgressText: "You're {{amount}} away from free shipping",
      freeShippingSuccessText: "You've unlocked free shipping!",
      badgeText: "Free shipping",
    },
    es: {
      headline: "Estas cerca del envio gratis",
      subheadline: "Agrega mas productos para activar el envio gratis.",
      ctaText: "Seguir comprando",
      freeShippingEmptyText:
        "Tu carrito esta vacio. Agrega productos para activar envio gratis.",
      freeShippingProgressText:
        "Agrega {{remaining_amount}} mas para envio gratis.",
      freeShippingSuccessText: "Activaste el envio gratis.",
      badgeText: "Envio gratis",
    },
    "pt-BR": {
      headline: "Voce esta perto do frete gratis",
      subheadline: "Adicione mais itens para liberar o frete por nossa conta.",
      ctaText: "Continuar comprando",
      freeShippingEmptyText:
        "Seu carrinho esta vazio. Adicione itens para liberar frete gratis.",
      freeShippingProgressText:
        "Adicione mais {{remaining_amount}} para frete gratis.",
      freeShippingSuccessText: "Voce desbloqueou frete gratis.",
      badgeText: "Frete gratis",
    },
    fr: {
      headline: "Vous etes proche de la livraison gratuite",
      subheadline: "Ajoutez des articles pour debloquer la livraison offerte.",
      ctaText: "Continuer mes achats",
      freeShippingEmptyText:
        "Votre panier est vide. Ajoutez des articles pour debloquer la livraison gratuite.",
      freeShippingProgressText:
        "Ajoutez encore {{remaining_amount}} pour la livraison gratuite.",
      freeShippingSuccessText: "Vous avez debloque la livraison gratuite.",
      badgeText: "Livraison gratuite",
    },
    de: {
      headline: "Du bist nah am kostenlosen Versand",
      subheadline:
        "Fuege weitere Artikel hinzu, um kostenlosen Versand zu erhalten.",
      ctaText: "Weiter einkaufen",
      freeShippingEmptyText:
        "Dein Warenkorb ist leer. Fuege Artikel hinzu, um kostenlosen Versand zu erhalten.",
      freeShippingProgressText:
        "Fuege {{remaining_amount}} hinzu fuer kostenlosen Versand.",
      freeShippingSuccessText: "Du hast kostenlosen Versand freigeschaltet.",
      badgeText: "Kostenloser Versand",
    },
  }),
  cartRescue: withLocaleOverrides({
    en: {
      headline: "Your cart is ready",
      subheadline: "We will hold this offer for a limited time.",
      ctaText: "Checkout",
      expiredText: "This cart offer is no longer available.",
      badgeText: "Cart offer",
    },
    es: {
      headline: "Tu carrito esta listo",
      subheadline: "Guardaremos esta oferta por tiempo limitado.",
      ctaText: "Pagar",
      expiredText: "Esta oferta del carrito ya no esta disponible.",
      badgeText: "Oferta carrito",
    },
    "pt-BR": {
      headline: "Seu carrinho esta pronto",
      subheadline: "Vamos guardar esta oferta por tempo limitado.",
      ctaText: "Finalizar compra",
      expiredText: "Esta oferta do carrinho nao esta mais disponivel.",
      badgeText: "Oferta no carrinho",
    },
    fr: {
      headline: "Votre panier est pret",
      subheadline: "Nous gardons cette offre pendant une duree limitee.",
      ctaText: "Commander",
      expiredText: "Cette offre panier n'est plus disponible.",
      badgeText: "Offre panier",
    },
    de: {
      headline: "Dein Warenkorb ist bereit",
      subheadline: "Wir halten dieses Angebot fuer eine begrenzte Zeit.",
      ctaText: "Jetzt bezahlen",
      expiredText: "Dieses Warenkorb-Angebot ist nicht mehr verfuegbar.",
      badgeText: "Warenkorb-Angebot",
    },
  }),
  deliveryCutoff: withLocaleOverrides({
    en: {
      headline: "Order today for fast delivery",
      subheadline: "Beat the cutoff and get your order moving sooner.",
      ctaText: "Order now",
      deliveryBeforeCutoffText:
        "Order within {{time_left}} to get it by {{max_delivery_weekday}}",
      deliveryAfterCutoffText: "Orders placed now ship {{ships_weekday}}",
      badgeText: "Ships today",
    },
    es: {
      headline: "Compra hoy para entrega rapida",
      subheadline: "Llega antes del corte y despachamos antes.",
      ctaText: "Comprar ahora",
      badgeText: "Despacha hoy",
    },
    "pt-BR": {
      headline: "Compre hoje para entrega rapida",
      subheadline: "Aproveite antes do limite e envie mais cedo.",
      ctaText: "Comprar agora",
      badgeText: "Envia hoje",
    },
    fr: {
      headline: "Commandez aujourd'hui pour une livraison rapide",
      subheadline: "Passez avant l'heure limite pour expedier plus rapidement.",
      ctaText: "Commander",
      badgeText: "Expedie aujourd'hui",
    },
    de: {
      headline: "Bestelle heute fuer schnelle Lieferung",
      subheadline:
        "Bestelle vor Annahmeschluss, damit deine Bestellung frueher startet.",
      ctaText: "Jetzt bestellen",
      badgeText: "Versand heute",
    },
  }),
  lowStock: withLocaleOverrides({
    en: {
      headline: "Low stock, selling fast",
      subheadline: "Order before this product sells out.",
      ctaText: "Buy now",
      lowStockText: "Only {{quantity}} left in stock.",
      badgeText: "Low stock",
    },
    es: {
      headline: "Queda poco stock",
      subheadline: "Compra antes de que este producto se agote.",
      ctaText: "Comprar ahora",
      lowStockText: "Solo quedan {{quantity}} disponibles.",
      badgeText: "Poco stock",
    },
    "pt-BR": {
      headline: "Estoque baixo",
      subheadline: "Compre antes que este produto acabe.",
      ctaText: "Comprar agora",
      lowStockText: "Restam apenas {{quantity}} em estoque.",
      badgeText: "Estoque baixo",
    },
    fr: {
      headline: "Stock limite",
      subheadline: "Commandez avant que ce produit soit epuise.",
      ctaText: "Acheter",
      lowStockText: "Il ne reste que {{quantity}} en stock.",
      badgeText: "Stock limite",
    },
    de: {
      headline: "Nur noch wenige auf Lager",
      subheadline: "Bestelle, bevor dieses Produkt ausverkauft ist.",
      ctaText: "Jetzt kaufen",
      lowStockText: "Nur noch {{quantity}} auf Lager.",
      badgeText: "Wenig Lagerbestand",
    },
  }),
  badge: withLocaleOverrides({
    en: {
      headline: "Featured deal",
      subheadline: "Highlight this offer for shoppers.",
      ctaText: "Shop now",
      badgeText: "Deal",
    },
    es: {
      headline: "Oferta destacada",
      subheadline: "Destaca esta oferta para tus compradores.",
      ctaText: "Comprar ahora",
      badgeText: "Oferta",
    },
    "pt-BR": {
      headline: "Oferta em destaque",
      subheadline: "Destaque esta oferta para compradores.",
      ctaText: "Comprar agora",
      badgeText: "Oferta",
    },
    fr: {
      headline: "Offre mise en avant",
      subheadline: "Mettez cette offre en avant pour les acheteurs.",
      ctaText: "Acheter",
      badgeText: "Offre",
    },
    de: {
      headline: "Hervorgehobenes Angebot",
      subheadline: "Heb dieses Angebot fuer Kaeufer hervor.",
      ctaText: "Jetzt kaufen",
      badgeText: "Angebot",
    },
  }),
  announcement: genericCopy,
};

export function getCampaignText(
  campaign: CampaignTextLookup,
  locale: string,
  field: CampaignTextField,
) {
  const normalizedLocale = normalizeStorefrontLocale(locale);
  const requestedTranslation = normalizedLocale
    ? findTranslation(campaign.translations, normalizedLocale)
    : null;
  const englishTranslation = findTranslation(
    campaign.translations,
    defaultStorefrontLocale,
  );
  const firstTranslationWithText = campaign.translations.find((translation) =>
    hasText(translation[field]),
  );

  return (
    readText(requestedTranslation, field) ||
    readText(englishTranslation, field) ||
    readText(firstTranslationWithText, field)
  );
}

export function getCampaignTranslationsViewModel(
  campaign: CampaignTextLookup,
): CampaignTranslationsViewModel {
  const values = createEmptyCampaignTranslationsByLocale();
  const resolvedValues = createEmptyCampaignTranslationsByLocale();

  for (const localeOption of storefrontLocales) {
    const translation = findTranslation(
      campaign.translations,
      localeOption.locale,
    );

    for (const field of campaignTranslationFields) {
      values[localeOption.locale][field.key] = readText(translation, field.key);
      resolvedValues[localeOption.locale][field.key] = getCampaignText(
        campaign,
        localeOption.locale,
        field.key,
      );
    }
  }

  return {
    locales: storefrontLocales,
    fields: campaignTranslationFields,
    values,
    resolvedValues,
  };
}

export function buildDefaultCampaignTranslations({
  goal,
  type,
  overrides = {},
}: {
  goal: CampaignGoalValue | string;
  type: CampaignTypeValue | string;
  overrides?: DefaultTranslationOverrides;
}): CampaignTranslationCreateValues[] {
  const copyKey = getDefaultCampaignCopyKey(goal, type);

  return storefrontLocales.map(({ locale }) => {
    const baseValues = defaultCampaignCopy[copyKey][locale];
    const override = overrides[locale] ?? {};
    const cleanOverride = removeBlankOverrideValues(override);

    return {
      locale,
      ...baseValues,
      ...cleanOverride,
    };
  });
}

export function getDefaultCampaignTranslationValues(
  goal: CampaignGoalValue | string,
  type: CampaignTypeValue | string,
  locale: StorefrontLocale,
) {
  return defaultCampaignCopy[getDefaultCampaignCopyKey(goal, type)][locale];
}

export function normalizeStorefrontLocale(
  locale: string | null | undefined,
): StorefrontLocale | null {
  const normalized = locale?.trim().replace("_", "-").toLowerCase();
  if (!normalized) return null;

  if (
    normalized === "pt-br" ||
    normalized === "pt" ||
    normalized.startsWith("pt-")
  ) {
    return "pt-BR";
  }

  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "es" || normalized.startsWith("es-")) return "es";
  if (normalized === "fr" || normalized.startsWith("fr-")) return "fr";
  if (normalized === "de" || normalized.startsWith("de-")) return "de";

  return null;
}

function findTranslation(
  translations: CampaignTranslationRecord[],
  locale: StorefrontLocale,
) {
  return translations.find(
    (translation) => normalizeStorefrontLocale(translation.locale) === locale,
  );
}

function readText(
  translation: CampaignTranslationRecord | undefined | null,
  field: CampaignTextField,
) {
  const value = translation?.[field];
  return typeof value === "string" ? value.trim() : "";
}

function hasText(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function getDefaultCampaignCopyKey(
  goal: CampaignGoalValue | string,
  type: CampaignTypeValue | string,
): DefaultCampaignCopyKey {
  if (goal === "FREE_SHIPPING" || type === "FREE_SHIPPING_GOAL") {
    return "freeShipping";
  }

  if (goal === "CART_RESCUE" || type === "CART_TIMER") {
    return "cartRescue";
  }

  if (goal === "DELIVERY_CUTOFF" || type === "DELIVERY_CUTOFF") {
    return "deliveryCutoff";
  }

  if (goal === "LOW_STOCK_URGENCY" || type === "LOW_STOCK") {
    return "lowStock";
  }

  if (goal === "PRODUCT_BADGE" || type === "PRODUCT_BADGE") {
    return "badge";
  }

  if (goal === "FLASH_SALE" || type === "COUNTDOWN_BAR") {
    return "flashSale";
  }

  return "announcement";
}

function copy(values: Partial<CampaignTranslationValues>) {
  return {
    ...emptyCampaignTranslationValues,
    ...values,
  };
}

function withLocaleOverrides(
  overrides: Record<StorefrontLocale, Partial<CampaignTranslationValues>>,
) {
  return storefrontLocales.reduce(
    (copies, localeOption) => {
      copies[localeOption.locale] = {
        ...genericCopy[localeOption.locale],
        ...overrides[localeOption.locale],
      };
      return copies;
    },
    {} as Record<StorefrontLocale, CampaignTranslationValues>,
  );
}

function removeBlankOverrideValues(
  override: Partial<CampaignTranslationValues> & { ctaUrl?: string },
) {
  return Object.entries(override).reduce<
    Partial<CampaignTranslationValues> & { ctaUrl?: string }
  >((values, [key, value]) => {
    if (typeof value === "string" && value.trim().length > 0) {
      values[key as keyof CampaignTranslationValues] = value.trim();
    }

    return values;
  }, {});
}
