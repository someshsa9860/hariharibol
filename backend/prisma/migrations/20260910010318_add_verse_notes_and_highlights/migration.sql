-- CreateTable
CREATE TABLE "VerseNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerseNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerseHighlight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerseHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerseNote_userId_verseId_idx" ON "VerseNote"("userId", "verseId");

-- CreateIndex
CREATE INDEX "VerseHighlight_userId_idx" ON "VerseHighlight"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerseHighlight_userId_verseId_key" ON "VerseHighlight"("userId", "verseId");

-- AddForeignKey
ALTER TABLE "VerseNote" ADD CONSTRAINT "VerseNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseNote" ADD CONSTRAINT "VerseNote_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseHighlight" ADD CONSTRAINT "VerseHighlight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerseHighlight" ADD CONSTRAINT "VerseHighlight_verseId_fkey" FOREIGN KEY ("verseId") REFERENCES "Verse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
