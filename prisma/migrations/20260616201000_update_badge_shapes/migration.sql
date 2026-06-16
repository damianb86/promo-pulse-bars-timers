-- SQLite stores Prisma enum values as text. Normalize earlier prototype values
-- to the Etapa 1 badge shapes used by CounterPulse.
UPDATE "BadgeSettings"
SET "badgeShape" = 'ROUNDED'
WHERE "badgeShape" = 'RECTANGLE';

UPDATE "BadgeSettings"
SET "badgeShape" = 'SQUARE'
WHERE "badgeShape" = 'RIBBON';
