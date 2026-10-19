# Carrying accounts over from the old (Laravel) server

People who used the old app and update to this one are signed in without signing in again. The old app's token is
checked with the old server, server to server; this server then makes (or finds) their account and issues a session of
its own.

```
app ──(old token)──▶ POST /api/app/auth/legacy ──(old token + X-Migration-Key)──▶ POST /api/migration/account (Laravel)
app ◀──(new tokens + user)── this server ◀──(id, email, name, provider ids, mantras with counts)── Laravel
```

Both servers are hosted together, so this stays on the private path; the key is still required because the Laravel
route is reachable by anyone who can reach the host.

## Switching it on

1. Laravel: copy `MigrationController.php` into `app/Http/Controllers/`, fix the three **ADAPT** spots, add the route
   below and set `MIGRATION_KEY` in its `.env` (`php artisan tinker` → `Str::random(64)` makes a good one).
2. This server's `.env`: `LEGACY_API_URL=` (the Laravel base URL, no trailing slash) and `LEGACY_MIGRATION_KEY=` (the
   **same** string). Either blank and `/auth/legacy` answers 404, and the app simply shows its sign-in screen.
3. `prisma migrate deploy` for `20261026000000_legacy_user_link` (it does not run with the seed).

```php
// routes/api.php — inside the group that already authenticates the old app's bearer token (Sanctum/Passport/JWT),
// so $request->user() is the token's owner. Do not put it outside that group.
Route::post('/migration/account', [MigrationController::class, 'account']);
```

## What the new server does with the answer

- Finds the account by the old id, then by the provider's id, then by the email; otherwise creates it. An old account
  with no email gets `legacy-<id>@legacy.hariharibol.invalid`.
- When the old server gave a provider id, the new account holds it, so signing in with Google later is the same account.
  Without one the account holds `legacy:<id>` and the **first** Google/Apple sign-in with the same email adopts it.
- The mantra chanted most (by `count`) that matches one of ours by name, slug or transliteration becomes the stand-in
  favourite for "Chant now" until they have chanted five rounds of something here (`utils/favourite-mantra.js`).
- The old chant history is **not** imported as sittings: it would count towards today's rounds, streaks and sampradaya.

## Testing

`npm run test:legacy` (top of `scripts/legacy-e2e.js` says how) walks it against a stand-in for the Laravel route.
It has **not** been run against the real Laravel API.
