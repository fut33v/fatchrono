ALTER TABLE "User"
  ALTER COLUMN "telegramId" TYPE BIGINT USING "telegramId"::bigint;
