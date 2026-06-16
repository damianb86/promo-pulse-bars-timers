-- AlterTable
ALTER TABLE "DeliveryCutoffSettings" ADD COLUMN "afterCutoffBehavior" TEXT NOT NULL DEFAULT 'SHOW_NEXT_WINDOW';
