-- CreateEnum: configurable trigger for when the Cart Rescue countdown starts
CREATE TYPE "CartRescueTimerStart" AS ENUM ('CART_VIEWED', 'FIRST_ITEM', 'LATEST_ITEM', 'DISCOUNT_APPLIED');

-- AlterTable: Cart Rescue countdown start trigger + pre-trigger arming behavior
ALTER TABLE "CartRescueSettings" ADD COLUMN "timerStart" "CartRescueTimerStart" NOT NULL DEFAULT 'CART_VIEWED';
ALTER TABLE "CartRescueSettings" ADD COLUMN "armBeforeStart" BOOLEAN NOT NULL DEFAULT false;
