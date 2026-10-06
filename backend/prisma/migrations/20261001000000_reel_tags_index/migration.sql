-- CreateIndex
CREATE INDEX "Reel_tags_idx" ON "Reel" USING GIN ("tags");
