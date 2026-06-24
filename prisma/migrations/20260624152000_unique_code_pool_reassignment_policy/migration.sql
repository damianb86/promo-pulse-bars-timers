-- Store unique-code reassignment policy per generated pool.
ALTER TABLE "DiscountCodePool"
ADD COLUMN "reassignExpiredUnused" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "UniqueDiscountCode"
ADD COLUMN "poolId" TEXT;

UPDATE "DiscountCodePool" AS pool
SET "reassignExpiredUnused" = COALESCE(sync."uniqueCodeReassignExpired", false)
FROM "DiscountSync" AS sync
WHERE sync."campaignId" = pool."campaignId";

WITH pool_candidates AS (
    SELECT
        code."id" AS "codeId",
        pool."id" AS "poolId",
        ROW_NUMBER() OVER (
            PARTITION BY code."id"
            ORDER BY
                CASE WHEN pool."createdAt" <= code."createdAt" THEN 0 ELSE 1 END,
                pool."createdAt" DESC
        ) AS "rank"
    FROM "UniqueDiscountCode" AS code
    INNER JOIN "DiscountCodePool" AS pool
        ON pool."shopId" = code."shopId"
        AND pool."campaignId" = code."campaignId"
        AND code."code" LIKE pool."prefix" || '-%'
)
UPDATE "UniqueDiscountCode" AS code
SET "poolId" = pool_candidates."poolId"
FROM pool_candidates
WHERE code."id" = pool_candidates."codeId"
  AND pool_candidates."rank" = 1;

CREATE INDEX "UniqueDiscountCode_poolId_status_idx"
ON "UniqueDiscountCode"("poolId", "status");

ALTER TABLE "UniqueDiscountCode"
ADD CONSTRAINT "UniqueDiscountCode_poolId_fkey"
FOREIGN KEY ("poolId") REFERENCES "DiscountCodePool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
