ALTER TABLE "CampaignDesign" ADD COLUMN "timerDaysLabel" TEXT NOT NULL DEFAULT 'Days';
ALTER TABLE "CampaignDesign" ADD COLUMN "timerHoursLabel" TEXT NOT NULL DEFAULT 'Hrs';
ALTER TABLE "CampaignDesign" ADD COLUMN "timerMinutesLabel" TEXT NOT NULL DEFAULT 'Mins';
ALTER TABLE "CampaignDesign" ADD COLUMN "timerSecondsLabel" TEXT NOT NULL DEFAULT 'Secs';
ALTER TABLE "CampaignDesign" ADD COLUMN "timerHideZeroDays" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "TimerSettings" ADD COLUMN "expiredBehavior" TEXT NOT NULL DEFAULT 'UNPUBLISH_TIMER';
