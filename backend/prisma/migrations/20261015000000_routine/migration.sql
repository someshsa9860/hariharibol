-- CreateTable
CREATE TABLE "RoutineTask" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "windowStart" INTEGER,
    "windowEnd" INTEGER,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineTask_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "RoutineDailyItem" (
    "userId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "windowStart" INTEGER,
    "windowEnd" INTEGER,
    "since" VARCHAR(10) NOT NULL,
    "until" VARCHAR(10) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineDailyItem_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "RoutineCheck" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "doneAt" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineCheck_pkey" PRIMARY KEY ("userId","itemId","day")
);

-- CreateIndex
CREATE INDEX "RoutineTask_userId_day_idx" ON "RoutineTask"("userId", "day");

-- CreateIndex
CREATE INDEX "RoutineCheck_userId_day_idx" ON "RoutineCheck"("userId", "day");

-- AddForeignKey
ALTER TABLE "RoutineTask" ADD CONSTRAINT "RoutineTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineDailyItem" ADD CONSTRAINT "RoutineDailyItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCheck" ADD CONSTRAINT "RoutineCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
