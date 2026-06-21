-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ShopPlan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'PRO', 'PREMIUM', 'AGENCY');

-- CreateEnum
CREATE TYPE "ConsentMode" AS ENUM ('BASIC', 'STRICT');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('COUNTDOWN_BAR', 'PRODUCT_TIMER', 'CART_TIMER', 'FREE_SHIPPING_GOAL', 'DELIVERY_CUTOFF', 'LOW_STOCK', 'PRODUCT_BADGE');

-- CreateEnum
CREATE TYPE "CampaignGoal" AS ENUM ('FLASH_SALE', 'FREE_SHIPPING', 'CART_RESCUE', 'SHIPPING_PROMISE', 'LOW_STOCK_URGENCY', 'DELIVERY_CUTOFF', 'PRODUCT_BADGE', 'ANNOUNCEMENT', 'LAUNCH', 'PREORDER');

-- CreateEnum
CREATE TYPE "PlacementType" AS ENUM ('TOP_BAR', 'BOTTOM_BAR', 'PRODUCT_PAGE', 'COLLECTION_CARD', 'CART_PAGE', 'CART_DRAWER', 'THANK_YOU_PAGE', 'ORDER_STATUS_PAGE', 'PASSWORD_PAGE', 'CUSTOM_SELECTOR');

-- CreateEnum
CREATE TYPE "TimerMode" AS ENUM ('FIXED_DATE', 'EVERGREEN_SESSION', 'RECURRING_DAILY', 'RECURRING_WEEKLY');

-- CreateEnum
CREATE TYPE "TimerResetBehavior" AS ENUM ('NEVER', 'ON_SESSION_END', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "TimerExpiredBehavior" AS ENUM ('UNPUBLISH_TIMER', 'HIDE_TIMER', 'REPEAT_COUNTDOWN', 'SHOW_CUSTOM_TITLE', 'DO_NOTHING');

-- CreateEnum
CREATE TYPE "FreeShippingProgressStyle" AS ENUM ('BAR', 'COMPACT', 'CIRCULAR');

-- CreateEnum
CREATE TYPE "DeliveryAfterCutoffBehavior" AS ENUM ('SHOW_NEXT_WINDOW', 'SHOW_AFTER_CUTOFF_MESSAGE', 'HIDE');

-- CreateEnum
CREATE TYPE "BadgeShape" AS ENUM ('PILL', 'ROUNDED', 'SQUARE');

-- CreateEnum
CREATE TYPE "BadgePosition" AS ENUM ('TOP_LEFT', 'TOP_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_RIGHT', 'INLINE');

-- CreateEnum
CREATE TYPE "DiscountSyncMethod" AS ENUM ('CODE', 'AUTOMATIC', 'UNIQUE_CODE');

-- CreateEnum
CREATE TYPE "DiscountCodeValueType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "DiscountCodeGrantStatus" AS ENUM ('ISSUED', 'REDEEMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "UniqueDiscountCodeStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'USED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DiscountCodePoolStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExperimentVariantStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'WINNER', 'LOSER', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExperimentPrimaryMetric" AS ENUM ('CLICK_RATE', 'ADD_TO_CART_RATE', 'CHECKOUT_RATE', 'REVENUE_PER_VISITOR');

-- CreateEnum
CREATE TYPE "AttributionModel" AS ENUM ('LAST_CLICK', 'FIRST_CLICK', 'LINEAR', 'POSITION_BASED', 'TIME_DECAY', 'LAST_TOUCH_24H', 'LAST_TOUCH_7D', 'FIRST_TOUCH_7D');

-- CreateEnum
CREATE TYPE "EmailTimerMode" AS ENUM ('FIXED_DATE', 'EVERGREEN');

-- CreateEnum
CREATE TYPE "EmailTimerExpiredBehavior" AS ENUM ('SHOW_EXPIRED', 'SHOW_ZERO', 'HIDE');

-- CreateEnum
CREATE TYPE "Stage2RuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AdvancedDiscountRuleType" AS ENUM ('SPEND_X_GET_Y', 'TIERED_DISCOUNT', 'FREE_GIFT', 'PRODUCT_SHIPPING_COMBO', 'CART_CONTENTS');

-- CreateEnum
CREATE TYPE "AdvancedDiscountRuleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignRecommendationType" AS ENUM ('CAMPAIGN_TEMPLATE', 'PLACEMENT', 'DISCOUNT_VALUE', 'MESSAGE', 'TARGETING', 'TIMING', 'MARKET_LOCALIZATION');

-- CreateEnum
CREATE TYPE "CampaignRecommendationStatus" AS ENUM ('NEW', 'VIEWED', 'APPLIED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "CampaignTemplateCategory" AS ENUM ('HOLIDAY', 'SEASONAL', 'COUNTRY_EVENT', 'FLASH_SALE', 'FREE_SHIPPING', 'PRODUCT_LAUNCH', 'CART_RECOVERY', 'BFCM');

-- CreateEnum
CREATE TYPE "AgencyShopRole" AS ENUM ('OWNER', 'ADMIN', 'ANALYST');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('IMPRESSION', 'CLICK', 'PRODUCT_VIEWED', 'BADGE_IMPRESSION', 'BADGE_CLICK', 'COPY_CODE', 'UNIQUE_CODE_ASSIGNED', 'APPLY_CODE_CLICKED', 'ADD_TO_CART', 'CHECKOUT_STARTED', 'POST_PURCHASE_IMPRESSION', 'REORDER_OFFER_CLICK', 'ORDER_ATTRIBUTED');

-- CreateEnum
CREATE TYPE "DesignAlignment" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

-- CreateEnum
CREATE TYPE "DesignLayout" AS ENUM ('STANDARD', 'BALANCED', 'INLINE', 'CTA_RIGHT', 'CTA_LEFT', 'CTA_TOP');

-- CreateEnum
CREATE TYPE "DesignBackgroundType" AS ENUM ('SOLID', 'GRADIENT', 'IMAGE');

-- CreateEnum
CREATE TYPE "DesignFontFamily" AS ENUM ('THEME', 'SYSTEM', 'SERIF', 'ROUNDED', 'MONO', 'GEOMETRIC', 'HUMANIST', 'CONDENSED', 'CASUAL');

-- CreateEnum
CREATE TYPE "DesignTimerStyle" AS ENUM ('PLAIN', 'GROUPED', 'BOXES');

-- CreateEnum
CREATE TYPE "DesignTimerFormat" AS ENUM ('UNITS', 'COLON');

-- CreateEnum
CREATE TYPE "DesignPositionMode" AS ENUM ('FLOW', 'OVERLAY');

-- CreateEnum
CREATE TYPE "DesignBannerAnimation" AS ENUM ('NONE', 'FADE', 'SLIDE', 'POP');

-- CreateEnum
CREATE TYPE "DesignTimerTickAnimation" AS ENUM ('NONE', 'FADE', 'FLIP', 'PULSE');

-- CreateEnum
CREATE TYPE "CampaignDesignIcon" AS ENUM ('FIRE', 'CLOCK', 'TRUCK', 'GIFT', 'TAG', 'CUSTOM', 'NONE');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shopifyDomain" TEXT NOT NULL,
    "plan" "ShopPlan" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "shopId" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL DEFAULT 'en',
    "enabledLocales" JSONB NOT NULL,
    "defaultTimezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "enableDebugMode" BOOLEAN NOT NULL DEFAULT false,
    "brandName" TEXT,
    "supportEmail" TEXT,
    "defaultCountry" TEXT,
    "customCartDrawerSelector" TEXT,
    "customCartPageSelector" TEXT,
    "customProductFormSelector" TEXT,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "respectDoNotTrack" BOOLEAN NOT NULL DEFAULT true,
    "consentMode" "ConsentMode" NOT NULL DEFAULT 'BASIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("shopId")
);

-- CreateTable
CREATE TABLE "ShopOnboardingChecklist" (
    "shopId" TEXT NOT NULL,
    "firstCampaignCreated" BOOLEAN NOT NULL DEFAULT false,
    "appEmbedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "productBlockAdded" BOOLEAN NOT NULL DEFAULT false,
    "cartBlockAdded" BOOLEAN NOT NULL DEFAULT false,
    "firstImpressionReceived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopOnboardingChecklist_pkey" PRIMARY KEY ("shopId")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "CampaignType" NOT NULL,
    "goal" "CampaignGoal" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "publishedSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignPlacement" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "placementType" "PlacementType" NOT NULL,
    "customSelector" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CampaignPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTargeting" (
    "campaignId" TEXT NOT NULL,
    "countries" JSONB NOT NULL,
    "markets" JSONB NOT NULL,
    "locales" JSONB NOT NULL,
    "productIds" JSONB NOT NULL,
    "collectionIds" JSONB NOT NULL,
    "productTags" JSONB NOT NULL,
    "customerTags" JSONB NOT NULL,
    "urlContains" JSONB NOT NULL,
    "utmSources" JSONB NOT NULL,
    "devices" JSONB NOT NULL,
    "excludeProductIds" JSONB NOT NULL,
    "excludeCollectionIds" JSONB NOT NULL,
    "behaviorRules" JSONB,

    CONSTRAINT "CampaignTargeting_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "CampaignDesign" (
    "campaignId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL DEFAULT 'clean-minimal',
    "layout" "DesignLayout" NOT NULL DEFAULT 'STANDARD',
    "backgroundType" "DesignBackgroundType" NOT NULL DEFAULT 'SOLID',
    "backgroundColor" TEXT NOT NULL DEFAULT '#111827',
    "backgroundImageUrl" TEXT NOT NULL DEFAULT '',
    "gradientStartColor" TEXT NOT NULL DEFAULT '#252237',
    "gradientEndColor" TEXT NOT NULL DEFAULT '#4C4861',
    "gradientAngle" INTEGER NOT NULL DEFAULT 90,
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "accentColor" TEXT NOT NULL DEFAULT '#22C55E',
    "buttonColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#111827',
    "closeButtonColor" TEXT NOT NULL DEFAULT '#111827',
    "fontSize" INTEGER NOT NULL DEFAULT 14,
    "borderRadius" INTEGER NOT NULL DEFAULT 0,
    "borderSize" INTEGER NOT NULL DEFAULT 0,
    "borderColor" TEXT NOT NULL DEFAULT '#E5E7EB',
    "fontFamily" "DesignFontFamily" NOT NULL DEFAULT 'THEME',
    "titleFontSize" INTEGER NOT NULL DEFAULT 22,
    "titleColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "subheadingFontSize" INTEGER NOT NULL DEFAULT 14,
    "subheadingColor" TEXT NOT NULL DEFAULT '#D1D5DB',
    "timerFontSize" INTEGER NOT NULL DEFAULT 38,
    "timerColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "legendFontSize" INTEGER NOT NULL DEFAULT 12,
    "legendColor" TEXT NOT NULL DEFAULT '#D1D5DB',
    "timerStyle" "DesignTimerStyle" NOT NULL DEFAULT 'PLAIN',
    "timerFormat" "DesignTimerFormat" NOT NULL DEFAULT 'UNITS',
    "timerShowLabels" BOOLEAN NOT NULL DEFAULT true,
    "timerShowSeconds" BOOLEAN NOT NULL DEFAULT true,
    "timerDaysLabel" TEXT NOT NULL DEFAULT 'Days',
    "timerHoursLabel" TEXT NOT NULL DEFAULT 'Hrs',
    "timerMinutesLabel" TEXT NOT NULL DEFAULT 'Mins',
    "timerSecondsLabel" TEXT NOT NULL DEFAULT 'Secs',
    "timerHideZeroDays" BOOLEAN NOT NULL DEFAULT true,
    "timerSurfaceColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "timerSurfaceBorderColor" TEXT NOT NULL DEFAULT '#D1D5DB',
    "timerSurfaceBorderSize" INTEGER NOT NULL DEFAULT 0,
    "timerSurfaceRadius" INTEGER NOT NULL DEFAULT 8,
    "paddingBlock" INTEGER NOT NULL DEFAULT 20,
    "paddingInline" INTEGER NOT NULL DEFAULT 24,
    "contentGap" INTEGER NOT NULL DEFAULT 8,
    "contentMaxWidth" INTEGER NOT NULL DEFAULT 960,
    "fullWidth" BOOLEAN NOT NULL DEFAULT false,
    "positionMode" "DesignPositionMode" NOT NULL DEFAULT 'FLOW',
    "positionSticky" BOOLEAN NOT NULL DEFAULT true,
    "entranceAnimation" "DesignBannerAnimation" NOT NULL DEFAULT 'FADE',
    "exitAnimation" "DesignBannerAnimation" NOT NULL DEFAULT 'FADE',
    "animationDurationMs" INTEGER NOT NULL DEFAULT 220,
    "timerTickAnimation" "DesignTimerTickAnimation" NOT NULL DEFAULT 'NONE',
    "customCss" TEXT,
    "mobileEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alignment" "DesignAlignment" NOT NULL DEFAULT 'CENTER',
    "showCloseButton" BOOLEAN NOT NULL DEFAULT true,
    "showButton" BOOLEAN NOT NULL DEFAULT true,
    "showIcon" BOOLEAN NOT NULL DEFAULT true,
    "icon" "CampaignDesignIcon" NOT NULL DEFAULT 'NONE',
    "iconSize" INTEGER NOT NULL DEFAULT 20,
    "customIconUrl" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "CampaignDesign_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "TimerSettings" (
    "campaignId" TEXT NOT NULL,
    "mode" "TimerMode" NOT NULL,
    "durationMinutes" INTEGER,
    "recurringDays" JSONB NOT NULL,
    "resetBehavior" "TimerResetBehavior" NOT NULL DEFAULT 'NEVER',
    "expiredBehavior" "TimerExpiredBehavior" NOT NULL DEFAULT 'UNPUBLISH_TIMER',

    CONSTRAINT "TimerSettings_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "FreeShippingSettings" (
    "campaignId" TEXT NOT NULL,
    "thresholdAmount" DECIMAL(65,30) NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "includeDiscountedSubtotal" BOOLEAN NOT NULL DEFAULT true,
    "emptyCartMessage" TEXT,
    "successMessage" TEXT,
    "progressStyle" "FreeShippingProgressStyle" NOT NULL DEFAULT 'BAR',
    "thresholdRules" JSONB,

    CONSTRAINT "FreeShippingSettings_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "DeliveryCutoffSettings" (
    "campaignId" TEXT NOT NULL,
    "cutoffHour" INTEGER NOT NULL,
    "cutoffMinute" INTEGER NOT NULL DEFAULT 0,
    "processingDays" INTEGER NOT NULL DEFAULT 0,
    "minDeliveryDays" INTEGER NOT NULL,
    "maxDeliveryDays" INTEGER NOT NULL,
    "workingDays" JSONB NOT NULL,
    "holidays" JSONB NOT NULL,
    "countryRules" JSONB NOT NULL,
    "afterCutoffBehavior" "DeliveryAfterCutoffBehavior" NOT NULL DEFAULT 'SHOW_NEXT_WINDOW',

    CONSTRAINT "DeliveryCutoffSettings_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "LowStockSettings" (
    "campaignId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "showExactQuantity" BOOLEAN NOT NULL DEFAULT false,
    "fallbackMessage" TEXT,

    CONSTRAINT "LowStockSettings_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "BadgeSettings" (
    "campaignId" TEXT NOT NULL,
    "badgeText" TEXT NOT NULL,
    "badgeShape" "BadgeShape" NOT NULL DEFAULT 'PILL',
    "badgePosition" "BadgePosition" NOT NULL DEFAULT 'TOP_RIGHT',

    CONSTRAINT "BadgeSettings_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "DiscountSync" (
    "campaignId" TEXT NOT NULL,
    "shopifyDiscountId" TEXT,
    "discountCode" TEXT,
    "method" "DiscountSyncMethod" NOT NULL,
    "syncStartEnd" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "title" TEXT,
    "valueType" "DiscountCodeValueType",
    "value" DECIMAL(65,30),
    "minimumSubtotal" DECIMAL(65,30),
    "appliesOncePerCustomer" BOOLEAN NOT NULL DEFAULT false,
    "showCodeOnStorefront" BOOLEAN NOT NULL DEFAULT true,
    "uniqueCodePrefix" TEXT,
    "uniqueCodeExpiresMinutes" INTEGER,
    "uniqueCodeAutoApply" BOOLEAN NOT NULL DEFAULT false,
    "uniqueCodeStartsAt" TIMESTAMP(3),
    "uniqueCodeEndsAt" TIMESTAMP(3),

    CONSTRAINT "DiscountSync_pkey" PRIMARY KEY ("campaignId")
);

-- CreateTable
CREATE TABLE "DiscountCodeGrant" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "cartToken" TEXT,
    "code" TEXT NOT NULL,
    "shopifyDiscountId" TEXT,
    "status" "DiscountCodeGrantStatus" NOT NULL DEFAULT 'ISSUED',
    "expiresAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCodeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTranslation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "headline" TEXT,
    "subheadline" TEXT,
    "ctaText" TEXT,
    "ctaUrl" TEXT,
    "expiredText" TEXT,
    "freeShippingEmptyText" TEXT,
    "freeShippingProgressText" TEXT,
    "freeShippingSuccessText" TEXT,
    "deliveryBeforeCutoffText" TEXT,
    "deliveryAfterCutoffText" TEXT,
    "lowStockText" TEXT,
    "badgeText" TEXT,

    CONSTRAINT "CampaignTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "eventType" "AnalyticsEventType" NOT NULL,
    "placementType" "PlacementType",
    "sessionId" TEXT,
    "cartToken" TEXT,
    "orderId" TEXT,
    "revenueAmount" DECIMAL(65,30),
    "currencyCode" TEXT,
    "country" TEXT,
    "locale" TEXT,
    "path" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniqueDiscountCode" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "code" TEXT NOT NULL,
    "shopifyDiscountId" TEXT,
    "status" "UniqueDiscountCodeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "assignedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniqueDiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCodePool" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "discountType" "DiscountCodeValueType" NOT NULL,
    "value" DECIMAL(65,30),
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "totalGenerated" INTEGER NOT NULL DEFAULT 0,
    "totalAssigned" INTEGER NOT NULL DEFAULT 0,
    "totalUsed" INTEGER NOT NULL DEFAULT 0,
    "status" "DiscountCodePoolStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCodePool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "trafficSplitStrategy" TEXT NOT NULL DEFAULT 'WEIGHTED',
    "primaryMetric" "ExperimentPrimaryMetric" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "winnerVariantId" TEXT,
    "winnerDeclaredAt" TIMESTAMP(3),
    "autoWinnerEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoWinnerMinSampleSize" INTEGER NOT NULL DEFAULT 100,
    "autoWinnerMinRuntimeHours" INTEGER NOT NULL DEFAULT 24,
    "autoWinnerConfidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 0,
    "status" "ExperimentVariantStatus" NOT NULL DEFAULT 'DRAFT',
    "designOverride" JSONB,
    "textOverride" JSONB,
    "discountOverride" JSONB,
    "placementOverride" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionTouch" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "experimentId" TEXT,
    "variantId" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "eventType" "AnalyticsEventType" NOT NULL,
    "placementType" "PlacementType",
    "path" TEXT,
    "country" TEXT,
    "locale" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionTouch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributionConversion" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "experimentId" TEXT,
    "variantId" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "orderId" TEXT NOT NULL,
    "revenueAmount" DECIMAL(65,30),
    "currencyCode" TEXT,
    "attributionModel" "AttributionModel" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttributionConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTimer" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "mode" "EmailTimerMode" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "expiredBehavior" "EmailTimerExpiredBehavior" NOT NULL DEFAULT 'SHOW_EXPIRED',
    "design" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTimer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvancedDiscountRule" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "ruleType" "AdvancedDiscountRuleType" NOT NULL,
    "thresholds" JSONB,
    "productIds" JSONB,
    "collectionIds" JSONB,
    "discountValue" DECIMAL(65,30),
    "shippingDiscountValue" DECIMAL(65,30),
    "status" "AdvancedDiscountRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "functionId" TEXT,
    "shopifyDiscountId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvancedDiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvancedBadgeRule" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "design" JSONB NOT NULL,
    "status" "Stage2RuleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvancedBadgeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketCampaignRule" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "marketId" TEXT,
    "countryCode" TEXT,
    "locale" TEXT,
    "currencyCode" TEXT,
    "thresholdAmount" DECIMAL(65,30),
    "deliverySettings" JSONB,
    "textOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketCampaignRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignRecommendation" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" "CampaignRecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "CampaignRecommendationStatus" NOT NULL DEFAULT 'NEW',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "category" "CampaignTemplateCategory" NOT NULL,
    "countryCode" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "eventName" TEXT NOT NULL,
    "goal" "CampaignGoal" NOT NULL,
    "type" "CampaignType" NOT NULL,
    "defaultTexts" JSONB NOT NULL,
    "defaultDesign" JSONB NOT NULL,
    "defaultSettings" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyShopAccess" (
    "agencyId" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "role" "AgencyShopRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyShopAccess_pkey" PRIMARY KEY ("agencyId","shopId")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopifyDomain_key" ON "Shop"("shopifyDomain");

-- CreateIndex
CREATE INDEX "Campaign_shopId_status_idx" ON "Campaign"("shopId", "status");

-- CreateIndex
CREATE INDEX "Campaign_shopId_type_idx" ON "Campaign"("shopId", "type");

-- CreateIndex
CREATE INDEX "Campaign_shopId_priority_idx" ON "Campaign"("shopId", "priority");

-- CreateIndex
CREATE INDEX "Campaign_shopId_publishedAt_idx" ON "Campaign"("shopId", "publishedAt");

-- CreateIndex
CREATE INDEX "Campaign_startsAt_endsAt_idx" ON "Campaign"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "CampaignPlacement_campaignId_idx" ON "CampaignPlacement"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignPlacement_placementType_idx" ON "CampaignPlacement"("placementType");

-- CreateIndex
CREATE INDEX "DiscountSync_shopifyDiscountId_idx" ON "DiscountSync"("shopifyDiscountId");

-- CreateIndex
CREATE INDEX "DiscountSync_discountCode_idx" ON "DiscountSync"("discountCode");

-- CreateIndex
CREATE INDEX "DiscountCodeGrant_campaignId_visitorKey_idx" ON "DiscountCodeGrant"("campaignId", "visitorKey");

-- CreateIndex
CREATE INDEX "DiscountCodeGrant_campaignId_status_expiresAt_idx" ON "DiscountCodeGrant"("campaignId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "DiscountCodeGrant_shopId_createdAt_idx" ON "DiscountCodeGrant"("shopId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCodeGrant_shopId_code_key" ON "DiscountCodeGrant"("shopId", "code");

-- CreateIndex
CREATE INDEX "CampaignTranslation_locale_idx" ON "CampaignTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTranslation_campaignId_locale_key" ON "CampaignTranslation"("campaignId", "locale");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_shopId_occurredAt_idx" ON "AnalyticsEvent"("shopId", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_campaignId_eventType_occurredAt_idx" ON "AnalyticsEvent"("campaignId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventType_occurredAt_idx" ON "AnalyticsEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_orderId_idx" ON "AnalyticsEvent"("orderId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "UniqueDiscountCode_campaignId_status_idx" ON "UniqueDiscountCode"("campaignId", "status");

-- CreateIndex
CREATE INDEX "UniqueDiscountCode_campaignId_visitorId_idx" ON "UniqueDiscountCode"("campaignId", "visitorId");

-- CreateIndex
CREATE INDEX "UniqueDiscountCode_sessionId_idx" ON "UniqueDiscountCode"("sessionId");

-- CreateIndex
CREATE INDEX "UniqueDiscountCode_orderId_idx" ON "UniqueDiscountCode"("orderId");

-- CreateIndex
CREATE INDEX "UniqueDiscountCode_expiresAt_idx" ON "UniqueDiscountCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "UniqueDiscountCode_shopId_code_key" ON "UniqueDiscountCode"("shopId", "code");

-- CreateIndex
CREATE INDEX "DiscountCodePool_shopId_status_idx" ON "DiscountCodePool"("shopId", "status");

-- CreateIndex
CREATE INDEX "DiscountCodePool_campaignId_status_idx" ON "DiscountCodePool"("campaignId", "status");

-- CreateIndex
CREATE INDEX "DiscountCodePool_prefix_idx" ON "DiscountCodePool"("prefix");

-- CreateIndex
CREATE INDEX "Experiment_shopId_status_idx" ON "Experiment"("shopId", "status");

-- CreateIndex
CREATE INDEX "Experiment_campaignId_status_idx" ON "Experiment"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Experiment_winnerVariantId_idx" ON "Experiment"("winnerVariantId");

-- CreateIndex
CREATE INDEX "ExperimentVariant_experimentId_status_idx" ON "ExperimentVariant"("experimentId", "status");

-- CreateIndex
CREATE INDEX "ExperimentVariant_campaignId_idx" ON "ExperimentVariant"("campaignId");

-- CreateIndex
CREATE INDEX "AttributionTouch_shopId_occurredAt_idx" ON "AttributionTouch"("shopId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttributionTouch_campaignId_occurredAt_idx" ON "AttributionTouch"("campaignId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttributionTouch_experimentId_variantId_idx" ON "AttributionTouch"("experimentId", "variantId");

-- CreateIndex
CREATE INDEX "AttributionTouch_visitorId_idx" ON "AttributionTouch"("visitorId");

-- CreateIndex
CREATE INDEX "AttributionTouch_sessionId_idx" ON "AttributionTouch"("sessionId");

-- CreateIndex
CREATE INDEX "AttributionConversion_shopId_occurredAt_idx" ON "AttributionConversion"("shopId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttributionConversion_campaignId_occurredAt_idx" ON "AttributionConversion"("campaignId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttributionConversion_experimentId_variantId_idx" ON "AttributionConversion"("experimentId", "variantId");

-- CreateIndex
CREATE INDEX "AttributionConversion_orderId_idx" ON "AttributionConversion"("orderId");

-- CreateIndex
CREATE INDEX "AttributionConversion_visitorId_idx" ON "AttributionConversion"("visitorId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTimer_publicToken_key" ON "EmailTimer"("publicToken");

-- CreateIndex
CREATE INDEX "EmailTimer_shopId_idx" ON "EmailTimer"("shopId");

-- CreateIndex
CREATE INDEX "EmailTimer_campaignId_idx" ON "EmailTimer"("campaignId");

-- CreateIndex
CREATE INDEX "EmailTimer_endsAt_idx" ON "EmailTimer"("endsAt");

-- CreateIndex
CREATE INDEX "AdvancedDiscountRule_shopId_status_idx" ON "AdvancedDiscountRule"("shopId", "status");

-- CreateIndex
CREATE INDEX "AdvancedDiscountRule_campaignId_status_idx" ON "AdvancedDiscountRule"("campaignId", "status");

-- CreateIndex
CREATE INDEX "AdvancedDiscountRule_shopifyDiscountId_idx" ON "AdvancedDiscountRule"("shopifyDiscountId");

-- CreateIndex
CREATE INDEX "AdvancedBadgeRule_shopId_status_idx" ON "AdvancedBadgeRule"("shopId", "status");

-- CreateIndex
CREATE INDEX "AdvancedBadgeRule_campaignId_priority_idx" ON "AdvancedBadgeRule"("campaignId", "priority");

-- CreateIndex
CREATE INDEX "MarketCampaignRule_shopId_idx" ON "MarketCampaignRule"("shopId");

-- CreateIndex
CREATE INDEX "MarketCampaignRule_campaignId_idx" ON "MarketCampaignRule"("campaignId");

-- CreateIndex
CREATE INDEX "MarketCampaignRule_marketId_idx" ON "MarketCampaignRule"("marketId");

-- CreateIndex
CREATE INDEX "MarketCampaignRule_countryCode_locale_idx" ON "MarketCampaignRule"("countryCode", "locale");

-- CreateIndex
CREATE INDEX "CampaignRecommendation_shopId_status_idx" ON "CampaignRecommendation"("shopId", "status");

-- CreateIndex
CREATE INDEX "CampaignRecommendation_campaignId_status_idx" ON "CampaignRecommendation"("campaignId", "status");

-- CreateIndex
CREATE INDEX "CampaignRecommendation_type_idx" ON "CampaignRecommendation"("type");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTemplate_key_key" ON "CampaignTemplate"("key");

-- CreateIndex
CREATE INDEX "CampaignTemplate_category_idx" ON "CampaignTemplate"("category");

-- CreateIndex
CREATE INDEX "CampaignTemplate_countryCode_locale_idx" ON "CampaignTemplate"("countryCode", "locale");

-- CreateIndex
CREATE INDEX "CampaignTemplate_goal_type_idx" ON "CampaignTemplate"("goal", "type");

-- CreateIndex
CREATE INDEX "AgencyShopAccess_shopId_idx" ON "AgencyShopAccess"("shopId");

-- CreateIndex
CREATE INDEX "AgencyShopAccess_role_idx" ON "AgencyShopAccess"("role");

-- CreateIndex
CREATE INDEX "ContactRequest_shopId_createdAt_idx" ON "ContactRequest"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ContactRequest_shopDomain_createdAt_idx" ON "ContactRequest"("shopDomain", "createdAt");

-- CreateIndex
CREATE INDEX "ContactRequest_type_idx" ON "ContactRequest"("type");

-- AddForeignKey
ALTER TABLE "ShopSettings" ADD CONSTRAINT "ShopSettings_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopOnboardingChecklist" ADD CONSTRAINT "ShopOnboardingChecklist_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPlacement" ADD CONSTRAINT "CampaignPlacement_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTargeting" ADD CONSTRAINT "CampaignTargeting_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDesign" ADD CONSTRAINT "CampaignDesign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimerSettings" ADD CONSTRAINT "TimerSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeShippingSettings" ADD CONSTRAINT "FreeShippingSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryCutoffSettings" ADD CONSTRAINT "DeliveryCutoffSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LowStockSettings" ADD CONSTRAINT "LowStockSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeSettings" ADD CONSTRAINT "BadgeSettings_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountSync" ADD CONSTRAINT "DiscountSync_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodeGrant" ADD CONSTRAINT "DiscountCodeGrant_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodeGrant" ADD CONSTRAINT "DiscountCodeGrant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTranslation" ADD CONSTRAINT "CampaignTranslation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniqueDiscountCode" ADD CONSTRAINT "UniqueDiscountCode_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniqueDiscountCode" ADD CONSTRAINT "UniqueDiscountCode_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodePool" ADD CONSTRAINT "DiscountCodePool_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCodePool" ADD CONSTRAINT "DiscountCodePool_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTouch" ADD CONSTRAINT "AttributionTouch_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTouch" ADD CONSTRAINT "AttributionTouch_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTouch" ADD CONSTRAINT "AttributionTouch_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionTouch" ADD CONSTRAINT "AttributionTouch_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionConversion" ADD CONSTRAINT "AttributionConversion_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionConversion" ADD CONSTRAINT "AttributionConversion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionConversion" ADD CONSTRAINT "AttributionConversion_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributionConversion" ADD CONSTRAINT "AttributionConversion_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ExperimentVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTimer" ADD CONSTRAINT "EmailTimer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTimer" ADD CONSTRAINT "EmailTimer_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvancedDiscountRule" ADD CONSTRAINT "AdvancedDiscountRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvancedDiscountRule" ADD CONSTRAINT "AdvancedDiscountRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvancedBadgeRule" ADD CONSTRAINT "AdvancedBadgeRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvancedBadgeRule" ADD CONSTRAINT "AdvancedBadgeRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketCampaignRule" ADD CONSTRAINT "MarketCampaignRule_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketCampaignRule" ADD CONSTRAINT "MarketCampaignRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecommendation" ADD CONSTRAINT "CampaignRecommendation_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignRecommendation" ADD CONSTRAINT "CampaignRecommendation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyShopAccess" ADD CONSTRAINT "AgencyShopAccess_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "AgencyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyShopAccess" ADD CONSTRAINT "AgencyShopAccess_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
