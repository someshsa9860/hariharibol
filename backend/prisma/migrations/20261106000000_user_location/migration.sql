-- AlterTable
ALTER TABLE "User" ADD COLUMN     "city" VARCHAR(100),
ADD COLUMN     "country" VARCHAR(100),
ADD COLUMN     "countryCode" VARCHAR(2),
ADD COLUMN     "district" VARCHAR(100),
ADD COLUMN     "locationUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "state" VARCHAR(100);
