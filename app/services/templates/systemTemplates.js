export const templateMarkets = [
  { countryCode: "US", locale: "en", currencyCode: "USD", threshold: 75 },
  { countryCode: "UK", locale: "en", currencyCode: "GBP", threshold: 60 },
  { countryCode: "ES", locale: "es", currencyCode: "EUR", threshold: 70 },
  { countryCode: "MX", locale: "es", currencyCode: "MXN", threshold: 1200 },
  { countryCode: "AR", locale: "es", currencyCode: "ARS", threshold: 50000 },
  { countryCode: "BR", locale: "pt-BR", currencyCode: "BRL", threshold: 350 },
  { countryCode: "FR", locale: "fr", currencyCode: "EUR", threshold: 70 },
  { countryCode: "DE", locale: "de", currencyCode: "EUR", threshold: 70 },
];

const eventDefinitions = [
  event("black-friday", "Black Friday", "BFCM", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "black-friday",
    icon: "TAG",
    suggestedDurationHours: 48,
  }),
  event("cyber-monday", "Cyber Monday", "BFCM", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "black-friday",
    icon: "TAG",
    suggestedDurationHours: 24,
  }),
  event("christmas", "Christmas", "HOLIDAY", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "holiday",
    icon: "GIFT",
    suggestedDurationHours: 72,
  }),
  event("new-year", "New Year", "SEASONAL", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "premium-dark",
    icon: "GIFT",
    suggestedDurationHours: 48,
  }),
  event(
    "valentines-day",
    "Valentine's Day",
    "HOLIDAY",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      templateKey: "holiday",
      icon: "GIFT",
      suggestedDurationHours: 48,
    },
  ),
  event("mothers-day", "Mother's Day", "HOLIDAY", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "holiday",
    icon: "GIFT",
    suggestedDurationHours: 48,
  }),
  event("fathers-day", "Father's Day", "HOLIDAY", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "premium-dark",
    icon: "GIFT",
    suggestedDurationHours: 48,
  }),
  event("hot-sale", "Hot Sale", "COUNTRY_EVENT", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "flash-sale",
    icon: "FIRE",
    suggestedDurationHours: 72,
  }),
  event("buen-fin", "Buen Fin", "COUNTRY_EVENT", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "black-friday",
    icon: "TAG",
    suggestedDurationHours: 72,
  }),
  event("flash-sale", "Flash Sale", "FLASH_SALE", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "flash-sale",
    icon: "FIRE",
    suggestedDurationHours: 12,
  }),
  event(
    "product-launch",
    "Product Launch",
    "PRODUCT_LAUNCH",
    "PRODUCT_BADGE",
    "PRODUCT_BADGE",
    {
      templateKey: "clean-minimal",
      icon: "TAG",
      recommendedPlacement: "COLLECTION_CARD",
    },
  ),
  event("pre-order", "Pre-order", "PRODUCT_LAUNCH", "LAUNCH", "PRODUCT_TIMER", {
    templateKey: "premium-dark",
    icon: "CLOCK",
    recommendedPlacement: "PRODUCT_PAGE",
    suggestedDurationHours: 168,
  }),
  event(
    "free-shipping-weekend",
    "Free Shipping Weekend",
    "FREE_SHIPPING",
    "FREE_SHIPPING",
    "FREE_SHIPPING_GOAL",
    {
      templateKey: "free-shipping",
      icon: "TRUCK",
      recommendedPlacement: "CART_DRAWER",
    },
  ),
  event("clearance", "Clearance", "FLASH_SALE", "FLASH_SALE", "COUNTDOWN_BAR", {
    templateKey: "low-stock",
    icon: "TAG",
    suggestedDurationHours: 72,
  }),
  event(
    "last-chance",
    "Last Chance",
    "FLASH_SALE",
    "FLASH_SALE",
    "COUNTDOWN_BAR",
    {
      templateKey: "flash-sale",
      icon: "FIRE",
      suggestedDurationHours: 24,
    },
  ),
];

export function buildSystemCampaignTemplates() {
  return eventDefinitions.flatMap((definition) =>
    templateMarkets.map((market) => {
      const texts = buildTexts(definition, market);

      return {
        key: `${market.countryCode.toLowerCase()}-${definition.slug}`,
        category: definition.category,
        countryCode: market.countryCode,
        locale: market.locale,
        eventName: definition.eventName,
        goal: definition.goal,
        type: definition.type,
        defaultTexts: texts,
        defaultDesign: buildDesign(definition),
        defaultSettings: buildSettings(definition, market),
        isSystem: true,
      };
    }),
  );
}

function event(slug, eventName, category, goal, type, settings) {
  return { slug, eventName, category, goal, type, settings };
}

function buildTexts(definition, market) {
  const copy = copyForLocale(market.locale);
  const eventName = localEventName(definition.eventName, market.locale);

  if (definition.type === "FREE_SHIPPING_GOAL") {
    return {
      headline: copy.freeShippingHeadline,
      subheadline: copy.freeShippingSubheadline,
      ctaText: copy.continueShopping,
      ctaUrl: "/collections/all",
      expiredText: copy.expired,
      freeShippingEmptyText: copy.freeShippingEmpty,
      freeShippingProgressText: copy.freeShippingProgress,
      freeShippingSuccessText: copy.freeShippingSuccess,
      badgeText: copy.freeShippingBadge,
    };
  }

  if (definition.type === "PRODUCT_BADGE") {
    return {
      headline: copy.productLaunchHeadline(eventName),
      subheadline: copy.productLaunchSubheadline,
      ctaText: copy.viewCollection,
      ctaUrl: "/collections/new-arrivals",
      expiredText: copy.expired,
      badgeText: copy.productLaunchBadge,
    };
  }

  if (definition.type === "PRODUCT_TIMER") {
    return {
      headline: copy.preorderHeadline(eventName),
      subheadline: copy.preorderSubheadline,
      ctaText: copy.viewDetails,
      ctaUrl: "/collections/all",
      expiredText: copy.expired,
      badgeText: copy.preorderBadge,
    };
  }

  return {
    headline: copy.saleHeadline(eventName),
    subheadline: copy.saleSubheadline,
    ctaText: copy.shopEvent(eventName),
    ctaUrl: "/collections/sale",
    expiredText: copy.expired,
    badgeText: eventName,
  };
}

function buildDesign(definition) {
  return {
    templateKey: definition.settings.templateKey,
    icon: definition.settings.icon,
    showIcon: true,
    positionSticky: definition.type === "COUNTDOWN_BAR",
  };
}

function buildSettings(definition, market) {
  return {
    recommendedPlacement:
      definition.settings.recommendedPlacement || defaultPlacement(definition.type),
    suggestedDurationHours: definition.settings.suggestedDurationHours || 48,
    thresholdAmount: market.threshold,
    currencyCode: market.currencyCode,
    cutoffHour: 14,
    cutoffMinute: 0,
    timezone: defaultTimezone(market.countryCode),
    productContext: "selected products",
  };
}

function defaultPlacement(type) {
  if (type === "FREE_SHIPPING_GOAL") return "CART_DRAWER";
  if (type === "PRODUCT_BADGE") return "COLLECTION_CARD";
  if (type === "PRODUCT_TIMER") return "PRODUCT_PAGE";
  return "TOP_BAR";
}

function defaultTimezone(countryCode) {
  return (
    {
      US: "America/New_York",
      UK: "Europe/London",
      ES: "Europe/Madrid",
      MX: "America/Mexico_City",
      AR: "America/Argentina/Cordoba",
      BR: "America/Sao_Paulo",
      FR: "Europe/Paris",
      DE: "Europe/Berlin",
    }[countryCode] || "UTC"
  );
}

function localEventName(eventName, locale) {
  const names = {
    es: {
      Christmas: "Navidad",
      "New Year": "Ano Nuevo",
      "Valentine's Day": "San Valentin",
      "Mother's Day": "Dia de la Madre",
      "Father's Day": "Dia del Padre",
      "Flash Sale": "Oferta relampago",
      "Product Launch": "Lanzamiento",
      "Pre-order": "Preventa",
      Clearance: "Liquidacion",
      "Last Chance": "Ultima oportunidad",
      "Free Shipping Weekend": "Fin de semana con envio gratis",
    },
    "pt-BR": {
      Christmas: "Natal",
      "New Year": "Ano Novo",
      "Valentine's Day": "Dia dos Namorados",
      "Mother's Day": "Dia das Maes",
      "Father's Day": "Dia dos Pais",
      "Flash Sale": "Promocao relampago",
      "Product Launch": "Lancamento",
      "Pre-order": "Pre-venda",
      Clearance: "Liquidacao",
      "Last Chance": "Ultima chance",
      "Free Shipping Weekend": "Fim de semana com frete gratis",
    },
    fr: {
      Christmas: "Noel",
      "New Year": "Nouvel An",
      "Valentine's Day": "Saint-Valentin",
      "Mother's Day": "Fete des meres",
      "Father's Day": "Fete des peres",
      "Flash Sale": "Vente flash",
      "Product Launch": "Lancement",
      "Pre-order": "Precommande",
      Clearance: "Destockage",
      "Last Chance": "Derniere chance",
      "Free Shipping Weekend": "Week-end livraison gratuite",
    },
    de: {
      Christmas: "Weihnachten",
      "New Year": "Neujahr",
      "Valentine's Day": "Valentinstag",
      "Mother's Day": "Muttertag",
      "Father's Day": "Vatertag",
      "Flash Sale": "Blitzverkauf",
      "Product Launch": "Produkteinfuehrung",
      "Pre-order": "Vorbestellung",
      Clearance: "Abverkauf",
      "Last Chance": "Letzte Chance",
      "Free Shipping Weekend": "Wochenende mit kostenlosem Versand",
    },
  };

  return names[locale]?.[eventName] || eventName;
}

function copyForLocale(locale) {
  if (locale === "es") {
    return {
      saleHeadline: (eventName) => `${eventName} esta activo`,
      saleSubheadline: "Usa esta plantilla con una oferta real antes de publicar.",
      shopEvent: () => "Ver ofertas",
      expired: "Esta campana termino.",
      continueShopping: "Seguir comprando",
      freeShippingHeadline: "Estas cerca del envio gratis",
      freeShippingSubheadline: "Agrega productos para activar la meta.",
      freeShippingEmpty: "Agrega productos para activar envio gratis.",
      freeShippingProgress: "Agrega {{amount}} mas para envio gratis.",
      freeShippingSuccess: "Activaste el envio gratis.",
      freeShippingBadge: "Envio gratis",
      productLaunchHeadline: (eventName) => `${eventName} destacado`,
      productLaunchSubheadline: "Marca productos nuevos sin promesas inventadas.",
      productLaunchBadge: "Nuevo",
      preorderHeadline: (eventName) => `${eventName} disponible`,
      preorderSubheadline: "Muestra el periodo real de preventa.",
      preorderBadge: "Preventa",
      viewCollection: "Ver coleccion",
      viewDetails: "Ver detalles",
    };
  }

  if (locale === "pt-BR") {
    return {
      saleHeadline: (eventName) => `${eventName} esta ativo`,
      saleSubheadline: "Use esta plantilla com uma oferta real antes de publicar.",
      shopEvent: () => "Ver ofertas",
      expired: "Esta campanha terminou.",
      continueShopping: "Continuar comprando",
      freeShippingHeadline: "Voce esta perto do frete gratis",
      freeShippingSubheadline: "Adicione produtos para liberar a meta.",
      freeShippingEmpty: "Adicione produtos para liberar frete gratis.",
      freeShippingProgress: "Adicione mais {{amount}} para frete gratis.",
      freeShippingSuccess: "Voce liberou frete gratis.",
      freeShippingBadge: "Frete gratis",
      productLaunchHeadline: (eventName) => `${eventName} em destaque`,
      productLaunchSubheadline: "Marque novos produtos sem promessas inventadas.",
      productLaunchBadge: "Novo",
      preorderHeadline: (eventName) => `${eventName} disponivel`,
      preorderSubheadline: "Mostre o periodo real de pre-venda.",
      preorderBadge: "Pre-venda",
      viewCollection: "Ver colecao",
      viewDetails: "Ver detalhes",
    };
  }

  if (locale === "fr") {
    return {
      saleHeadline: (eventName) => `${eventName} est actif`,
      saleSubheadline: "Utilisez ce modele avec une vraie offre avant publication.",
      shopEvent: () => "Voir les offres",
      expired: "Cette campagne est terminee.",
      continueShopping: "Continuer les achats",
      freeShippingHeadline: "Vous etes proche de la livraison gratuite",
      freeShippingSubheadline: "Ajoutez des articles pour atteindre l'objectif.",
      freeShippingEmpty: "Ajoutez des articles pour debloquer la livraison gratuite.",
      freeShippingProgress: "Ajoutez encore {{amount}} pour la livraison gratuite.",
      freeShippingSuccess: "La livraison gratuite est debloquee.",
      freeShippingBadge: "Livraison gratuite",
      productLaunchHeadline: (eventName) => `${eventName} en vedette`,
      productLaunchSubheadline: "Signalez les nouveautes sans promesses inventees.",
      productLaunchBadge: "Nouveau",
      preorderHeadline: (eventName) => `${eventName} disponible`,
      preorderSubheadline: "Affichez la periode reelle de precommande.",
      preorderBadge: "Precommande",
      viewCollection: "Voir la collection",
      viewDetails: "Voir les details",
    };
  }

  if (locale === "de") {
    return {
      saleHeadline: (eventName) => `${eventName} ist aktiv`,
      saleSubheadline: "Nutze diese Vorlage mit einem echten Angebot vor der Veroeffentlichung.",
      shopEvent: () => "Angebote ansehen",
      expired: "Diese Kampagne ist beendet.",
      continueShopping: "Weiter einkaufen",
      freeShippingHeadline: "Du bist nah am kostenlosen Versand",
      freeShippingSubheadline: "Fuege Artikel hinzu, um das Ziel zu erreichen.",
      freeShippingEmpty: "Fuege Artikel hinzu, um kostenlosen Versand zu erhalten.",
      freeShippingProgress: "Fuege noch {{amount}} fuer kostenlosen Versand hinzu.",
      freeShippingSuccess: "Kostenloser Versand ist freigeschaltet.",
      freeShippingBadge: "Kostenloser Versand",
      productLaunchHeadline: (eventName) => `${eventName} im Fokus`,
      productLaunchSubheadline: "Kennzeichne neue Produkte ohne erfundene Aussagen.",
      productLaunchBadge: "Neu",
      preorderHeadline: (eventName) => `${eventName} verfuegbar`,
      preorderSubheadline: "Zeige den echten Vorbestellzeitraum.",
      preorderBadge: "Vorbestellung",
      viewCollection: "Kollektion ansehen",
      viewDetails: "Details ansehen",
    };
  }

  return {
    saleHeadline: (eventName) => `${eventName} is live`,
    saleSubheadline: "Use this template with a real offer before publishing.",
    shopEvent: () => "Shop offers",
    expired: "This campaign has ended.",
    continueShopping: "Continue shopping",
    freeShippingHeadline: "You are close to free shipping",
    freeShippingSubheadline: "Add items to unlock the goal.",
    freeShippingEmpty: "Add items to unlock free shipping.",
    freeShippingProgress: "You're {{amount}} away from free shipping.",
    freeShippingSuccess: "You've unlocked free shipping.",
    freeShippingBadge: "Free shipping",
    productLaunchHeadline: (eventName) => `${eventName} spotlight`,
    productLaunchSubheadline: "Highlight new products without invented claims.",
    productLaunchBadge: "New",
    preorderHeadline: (eventName) => `${eventName} available`,
    preorderSubheadline: "Show the real pre-order period.",
    preorderBadge: "Pre-order",
    viewCollection: "View collection",
    viewDetails: "View details",
  };
}
