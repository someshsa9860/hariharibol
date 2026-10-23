-- AlterEnum
ALTER TYPE "AiWalletSource" ADD VALUE 'PROFILE';

-- CreateTable
CREATE TABLE "SakhaProfile" (
    "userId" TEXT NOT NULL,
    "learning" BOOLEAN NOT NULL DEFAULT true,
    "traits" JSONB NOT NULL DEFAULT '{}',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "messagesRead" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SakhaProfile_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "SakhaProfile" ADD CONSTRAINT "SakhaProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
