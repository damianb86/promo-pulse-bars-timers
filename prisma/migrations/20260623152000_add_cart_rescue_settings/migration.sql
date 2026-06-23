CREATE TYPE "CartRescueReason" AS ENUM (
  'CART_RESERVED',
  'CHECKOUT_REMINDER',
  'FREE_SHIPPING_GOAL',
  'OFFER_EXPIRES',
  'SHIPPING_CUTOFF',
  'LOW_STOCK_RISK'
);

CREATE TABLE "CartRescueSettings" (
  "campaignId" TEXT NOT NULL,
  "rescueReason" "CartRescueReason" NOT NULL DEFAULT 'CART_RESERVED',
  "showTimer" BOOLEAN NOT NULL DEFAULT true,
  "showButton" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "CartRescueSettings_pkey" PRIMARY KEY ("campaignId")
);

ALTER TABLE "CartRescueSettings"
ADD CONSTRAINT "CartRescueSettings_campaignId_fkey"
FOREIGN KEY ("campaignId")
REFERENCES "Campaign"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
