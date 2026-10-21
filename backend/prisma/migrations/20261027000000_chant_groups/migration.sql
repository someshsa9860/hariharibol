-- CreateEnum
CREATE TYPE "ChantGroupRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ChantGroupMemberStatus" AS ENUM ('INVITED', 'ACTIVE');

-- CreateTable
CREATE TABLE "ChantGroup" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(300),
    "ownerId" TEXT NOT NULL,
    "mantraId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChantGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChantGroupMember" (
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ChantGroupRole" NOT NULL DEFAULT 'MEMBER',
    "status" "ChantGroupMemberStatus" NOT NULL DEFAULT 'INVITED',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),

    CONSTRAINT "ChantGroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "ChantGroupSession" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ChantGroupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChantGroupParticipant" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "ChantGroupParticipant_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateIndex
CREATE INDEX "ChantGroup_ownerId_idx" ON "ChantGroup"("ownerId");

-- CreateIndex
CREATE INDEX "ChantGroupMember_userId_status_idx" ON "ChantGroupMember"("userId", "status");

-- CreateIndex
CREATE INDEX "ChantGroupSession_groupId_endedAt_idx" ON "ChantGroupSession"("groupId", "endedAt");

-- CreateIndex
CREATE INDEX "ChantGroupParticipant_userId_idx" ON "ChantGroupParticipant"("userId");

-- AddForeignKey
ALTER TABLE "ChantGroup" ADD CONSTRAINT "ChantGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantGroup" ADD CONSTRAINT "ChantGroup_mantraId_fkey" FOREIGN KEY ("mantraId") REFERENCES "Mantra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantGroupMember" ADD CONSTRAINT "ChantGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChantGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantGroupMember" ADD CONSTRAINT "ChantGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantGroupSession" ADD CONSTRAINT "ChantGroupSession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChantGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantGroupParticipant" ADD CONSTRAINT "ChantGroupParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChantGroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChantGroupParticipant" ADD CONSTRAINT "ChantGroupParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

