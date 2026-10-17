-- A picture sent with a chat message: the storage key of the server's copy.
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "imagePath" VARCHAR(500);
