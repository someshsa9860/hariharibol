# Admin — HariHariBol Admin Panel

Admin panel for content management, moderation and configuration.

## Rules

_Not yet defined — rules for this part are still to be shared._

Nothing should be built here until they are. When they arrive, they get written into this file before any code is written.

## Notes carried over

- Admins are not a separate account type. They are rows in the same users table as everyone else, distinguished by a `role` column, and reach admin surfaces only when their role and permissions allow it. See [backend/CLAUDE.md](../backend/CLAUDE.md).
- Admin API endpoints live under `backend/routes/admin/` and `backend/controllers/admin/`.
- The previous Next.js admin panel is archived on the `unorganized` branch at `admin/` — reference only.
