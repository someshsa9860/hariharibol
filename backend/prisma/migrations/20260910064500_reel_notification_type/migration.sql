-- Reel engagement notifications: a comment or a reply on your reel, and a new
-- follower. The row's `data` JSON carries which of those it was along with the
-- reelId/creatorId, so one enum value covers the whole reel section rather
-- than adding a value per event.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REEL';
