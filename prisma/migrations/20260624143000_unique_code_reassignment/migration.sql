-- Add unique-code reassignment policy and visitor assignment history.
ALTER TABLE "DiscountSync"
ADD COLUMN "uniqueCodeReassignExpired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "UniqueDiscountCodeAssignment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT,
    "code" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniqueDiscountCodeAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UniqueDiscountCodeAssignment_shopId_campaignId_visitorId_key"
ON "UniqueDiscountCodeAssignment"("shopId", "campaignId", "visitorId");

CREATE INDEX "UniqueDiscountCodeAssignment_campaignId_expiresAt_idx"
ON "UniqueDiscountCodeAssignment"("campaignId", "expiresAt");

CREATE INDEX "UniqueDiscountCodeAssignment_campaignId_codeId_idx"
ON "UniqueDiscountCodeAssignment"("campaignId", "codeId");

CREATE INDEX "UniqueDiscountCodeAssignment_visitorId_idx"
ON "UniqueDiscountCodeAssignment"("visitorId");

ALTER TABLE "UniqueDiscountCodeAssignment"
ADD CONSTRAINT "UniqueDiscountCodeAssignment_shopId_fkey"
FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UniqueDiscountCodeAssignment"
ADD CONSTRAINT "UniqueDiscountCodeAssignment_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UniqueDiscountCodeAssignment"
ADD CONSTRAINT "UniqueDiscountCodeAssignment_codeId_fkey"
FOREIGN KEY ("codeId") REFERENCES "UniqueDiscountCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UniqueDiscountCodeAssignment" (
    "id",
    "shopId",
    "campaignId",
    "codeId",
    "visitorId",
    "sessionId",
    "code",
    "assignedAt",
    "expiresAt",
    "expiredAt",
    "usedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'uca_' || md5("shopId" || ':' || "campaignId" || ':' || "visitorId"),
    "shopId",
    "campaignId",
    "id",
    "visitorId",
    "sessionId",
    "code",
    COALESCE("assignedAt", "createdAt"),
    "expiresAt",
    CASE
        WHEN "status" = 'EXPIRED' THEN COALESCE("expiresAt", "updatedAt")
        ELSE NULL
    END,
    "usedAt",
    "createdAt",
    "updatedAt"
FROM "UniqueDiscountCode"
WHERE "visitorId" IS NOT NULL
ON CONFLICT ("shopId", "campaignId", "visitorId") DO NOTHING;
