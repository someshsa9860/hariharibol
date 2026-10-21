-- The Scenes page's permissions, given to the admin roles by the migration itself, so the deploy is enough and the
-- seed does not have to be run (same as translation_runs). `npm run seed` still owns the full role definitions.
INSERT INTO "Permission" ("id", "slug", "name", "group", "createdAt") VALUES
    ('perm_scenes_read', 'scenes.read', 'View AI reel scene prompts and their runs', 'content', CURRENT_TIMESTAMP),
    ('perm_scenes_run', 'scenes.run', 'Start, resume and cancel AI reel scene prompt runs', 'content', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r."slug" IN ('admin', 'super_admin')
  AND p."slug" IN ('scenes.read', 'scenes.run')
ON CONFLICT DO NOTHING;
