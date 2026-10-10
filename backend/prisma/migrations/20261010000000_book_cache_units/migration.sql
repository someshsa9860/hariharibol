-- CreateTable
CREATE TABLE "BookCacheUnit" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "unitType" VARCHAR(10) NOT NULL,
    "unitId" TEXT NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sizeBytes" INTEGER NOT NULL,
    "compressedBytes" INTEGER NOT NULL,
    "verseCount" INTEGER NOT NULL DEFAULT 0,
    "schemaVersion" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "contentUpdatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookCacheUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookCacheUnit_bookId_idx" ON "BookCacheUnit"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCacheUnit_bookId_unitType_unitId_key" ON "BookCacheUnit"("bookId", "unitType", "unitId");

-- AddForeignKey
ALTER TABLE "BookCacheUnit" ADD CONSTRAINT "BookCacheUnit_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
