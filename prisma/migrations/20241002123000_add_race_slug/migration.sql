ALTER TABLE "Race" ADD COLUMN "slug" TEXT;

CREATE UNIQUE INDEX "Race_slug_key" ON "Race"("slug");
