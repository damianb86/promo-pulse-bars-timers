-- Add storefront path context to analytics events.
ALTER TABLE "AnalyticsEvent" ADD COLUMN "path" TEXT;
