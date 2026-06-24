UPDATE "Shop"
SET "plan" = 'PRO'
WHERE "plan"::text IN ('PREMIUM', 'AGENCY');

ALTER TYPE "ShopPlan" RENAME TO "ShopPlan_old";

CREATE TYPE "ShopPlan" AS ENUM ('FREE', 'STARTER', 'GROWTH', 'PRO');

ALTER TABLE "Shop" ALTER COLUMN "plan" DROP DEFAULT;

ALTER TABLE "Shop"
ALTER COLUMN "plan" TYPE "ShopPlan"
USING (
  CASE "plan"::text
    WHEN 'PREMIUM' THEN 'PRO'
    WHEN 'AGENCY' THEN 'PRO'
    ELSE "plan"::text
  END
)::"ShopPlan";

ALTER TABLE "Shop" ALTER COLUMN "plan" SET DEFAULT 'FREE';

DROP TYPE "ShopPlan_old";
