-- The verses behind the standard routine's reminders. See the comment on RoutineKind in schema.prisma.

CREATE TABLE "RoutineKind" (
    "key" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "voiceScript" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RoutineKind_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "RoutineNudge" (
    "id" TEXT NOT NULL,
    "kindKey" TEXT NOT NULL,
    "verseId" TEXT,
    "reference" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineNudge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoutineNudge_kindKey_position_key" ON "RoutineNudge"("kindKey", "position");
CREATE INDEX "RoutineNudge_verseId_idx" ON "RoutineNudge"("verseId");

ALTER TABLE "RoutineNudge" ADD CONSTRAINT "RoutineNudge_kindKey_fkey"
    FOREIGN KEY ("kindKey") REFERENCES "RoutineKind"("key") ON DELETE CASCADE ON UPDATE CASCADE;
