-- Developer companion app: which app a device is, the live feed, and the reader's chat with the developer.
ALTER TABLE "Device" ADD COLUMN "app" VARCHAR(10) NOT NULL DEFAULT 'main';

CREATE TABLE "DevEvent" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "severity" VARCHAR(10) NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DevEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DevEvent_createdAt_idx" ON "DevEvent"("createdAt");
CREATE INDEX "DevEvent_type_createdAt_idx" ON "DevEvent"("type", "createdAt");

CREATE TABLE "DevConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessagePreview" VARCHAR(200),
    "userUnread" INTEGER NOT NULL DEFAULT 0,
    "devUnread" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DevConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DevConversation_userId_key" ON "DevConversation"("userId");
CREATE INDEX "DevConversation_lastMessageAt_idx" ON "DevConversation"("lastMessageAt");
CREATE INDEX "DevConversation_devUnread_idx" ON "DevConversation"("devUnread");
ALTER TABLE "DevConversation" ADD CONSTRAINT "DevConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DevMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fromDeveloper" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DevMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DevMessage_conversationId_createdAt_idx" ON "DevMessage"("conversationId", "createdAt");
ALTER TABLE "DevMessage" ADD CONSTRAINT "DevMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "DevConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- dev.access: the owner (super_admin) has it; the admin role does not unless granted.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_dev_access', 'dev.access', 'Sign in to the developer companion app (live feed, alerts, chat with readers)', 'system', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" = 'super_admin' AND p."slug" = 'dev.access'
ON CONFLICT DO NOTHING;
