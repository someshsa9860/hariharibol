-- Support tickets, quick feedback and the store-rating prompt log.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUPPORT';

CREATE TYPE "SupportKind" AS ENUM ('TICKET', 'FEEDBACK');
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SupportKind" NOT NULL DEFAULT 'TICKET',
    "category" VARCHAR(30) NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "subject" VARCHAR(120),
    "rating" INTEGER,
    "screenshotKey" VARCHAR(500),
    "deviceInfo" JSONB,
    "assigneeId" TEXT,
    "userUnread" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");
CREATE INDEX "SupportTicket_status_lastMessageAt_idx" ON "SupportTicket"("status", "lastMessageAt");
CREATE INDEX "SupportTicket_kind_createdAt_idx" ON "SupportTicket"("kind", "createdAt");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReviewPrompt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "trigger" VARCHAR(30) NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewPrompt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReviewPrompt_userId_createdAt_idx" ON "ReviewPrompt"("userId", "createdAt");
ALTER TABLE "ReviewPrompt" ADD CONSTRAINT "ReviewPrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- support.manage goes to admin and super_admin.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_support_manage', 'support.manage', 'View and reply to support tickets and feedback', 'users', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin') AND p."slug" = 'support.manage'
ON CONFLICT DO NOTHING;
