ALTER TABLE "Experiment" ADD COLUMN "winnerDeclaredAt" DATETIME;
ALTER TABLE "Experiment" ADD COLUMN "autoWinnerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Experiment" ADD COLUMN "autoWinnerMinSampleSize" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Experiment" ADD COLUMN "autoWinnerMinRuntimeHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "Experiment" ADD COLUMN "autoWinnerConfidenceThreshold" REAL NOT NULL DEFAULT 0.95;
