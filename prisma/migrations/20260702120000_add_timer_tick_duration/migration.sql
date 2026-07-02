-- AddColumn: separate animation duration for the timer-change (tick) effect.
ALTER TABLE "CampaignDesign" ADD COLUMN "timerTickDurationMs" INTEGER NOT NULL DEFAULT 220;
