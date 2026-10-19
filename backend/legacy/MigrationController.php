<?php

// Drop into the old Laravel API (HariHariBolApi): app/Http/Controllers/MigrationController.php
//
// The new server calls this once for each person who opens the new app with a token from the old one. It answers
// "who is this?" so the new server can make them an account and a session of its own, without asking them to sign
// in again. Two things are checked: the shared key (so only the new server can ask) and the bearer token (so only
// the token's own owner can be looked up).
//
// WRITTEN WITHOUT SIGHT OF THE OLD PROJECT. The three places marked ADAPT use table, column and relation names I
// had to guess. Nothing else here depends on your schema.

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MigrationController extends Controller
{
    public function account(Request $request): JsonResponse
    {
        // 1. The shared key. The same long random string is LEGACY_MIGRATION_KEY on the new server. Compared in
        //    constant time. If MIGRATION_KEY is not set here the endpoint is closed, never open.
        $expected = (string) env('MIGRATION_KEY', '');
        $given = (string) $request->header('X-Migration-Key', '');
        if ($expected === '' || !hash_equals($expected, $given)) {
            return response()->json(['success' => false, 'message' => 'Forbidden'], 403);
        }

        // 2. The person. The route sits behind your ordinary auth middleware (see the route below), so this is the
        //    owner of the bearer token and nobody else.
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        // 3. What they chanted, as a name and a count per mantra. ADAPT: the table and columns that hold a person's
        //    chanting. Counts only rank the mantras, so chants, beads or rounds are all fine as long as it is one unit.
        $mantras = DB::table('mantra_counts')                      // ADAPT: your table
            ->join('mantras', 'mantras.id', '=', 'mantra_counts.mantra_id')   // ADAPT
            ->where('mantra_counts.user_id', $user->id)            // ADAPT
            ->groupBy('mantras.id', 'mantras.name')                // ADAPT
            ->orderByDesc(DB::raw('SUM(mantra_counts.count)'))     // ADAPT
            ->limit(100)
            ->get(['mantras.name', DB::raw('SUM(mantra_counts.count) as count')])  // ADAPT
            ->map(fn ($row) => ['name' => $row->name, 'count' => (int) $row->count])
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'id' => (string) $user->id,
                'email' => $user->email,
                'name' => $user->name,
                'avatarUrl' => $user->avatar ?? null,           // ADAPT: the picture column, if any
                // 'google' or 'apple', and the provider's own id for them, if you stored it. With these the person's
                // first Google/Apple sign-in on the new app is recognised as the same account. Leave both null if not.
                'provider' => $user->provider ?? null,          // ADAPT
                'providerUserId' => $user->provider_id ?? null, // ADAPT
                'mantras' => $mantras,
            ],
        ]);
    }
}
