# Plan: a personal "Śloka of the Day" — levels, a nine-week beginner journey, moods, the calendar

> **Status: designed on 14 Oct 2026, nothing built.** No table, no job, no picker change. The
> daily sloka today is the existing mood-and-weights picker (see "The daily sloka push" in
> `CLAUDE.md`); this file is the agreed-to-be-discussed design for replacing it. It starts from a
> product brief the owner pasted on 14 Oct 2026 (levels Beginner / Intermediate / Advanced, three
> ~3-week stages Śraddhā → Jñāna → Bhakti, mood personalisation, a "must have opened the app on X
> of the last 21 days" rule, ~weekly "wow" verses, a Hindu-calendar overlay, no repeat in ~90
> days). **Read "Open questions" first** — several decide the shape of the work.
>
> Everything marked ● / ○ below was checked against the local database on 14 Oct 2026; re-check
> before relying on it (the pool changes whenever an admin opts verses in).

## 1. What exists, and what the brief adds

| The brief needs | What is already here | Gap |
|---|---|---|
| A pool of verses fit for a daily sloka | `Verse.isSlokaEligible` — a deliberate opt-in; only BG and SB (`bookNumber` 1, 2) | **322** verses are in it (83 BG, 239 SB); 13,701 verses exist. See §2 |
| Tags: category, difficulty, mood | `Verse.tags String[]` (empty on every verse), `Issue` + `VerseIssue` (weighted; 8 issues: the six vikāras + two practice issues; 409 links) | No category, difficulty, stage or tone; no moods beyond the vikāras |
| Linked verses across SB and BG | `VerseLink` (SAME_CONCEPT, EXPANDS_ON, QUOTED_IN, CONTRASTS_WITH) and `Story`/`StoryPart` | **0 links** |
| Plain-language summary + one-line takeaway | `VerseExplanation` (an AI-explanation table) | **0 rows** |
| A user's level | `UserPreferenceProfile.avgRoundsPerDay`, `chantConsistency`; `SadhanaDay.roundsCompleted`; `ChantSession.mantraId`; `SadhanaProfile.dailyRoundTarget` (default 16) | No level; **no onboarding question** about chanting |
| "Opened the app on X of the last 21 days" | `User.lastActiveAt` — one timestamp, no history | **No record of which days.** Needs a table |
| A mood | `UserIssue` — append-only log with `intensity` and local `date` | Fine as is; add non-vikāra moods as `Issue` rows |
| No repeat in ~90 days | `buildGlobal` already uses a 90-day window; `UserDailySloka` is one row per user per day with `verseId` | Per-user window not enforced yet |
| Calendar: Pitṛ-pakṣa, Kārtika, Ekādaśī, Janmāṣṭamī, Gītā Jayantī | Nothing | All new. Tithi dates depend on the calendar authority and the place — see §8 |
| "Why you got this" | `UserDailySloka.reason`, `issueId` | Add a `trigger` so it can be analysed |

## 2. Numbers and corrections to know before planning content

- **13,701 verses, not ~19,000** (701 BG, 13,000 SB) in the local database. If the production
  count differs, the bucket is the source of truth.
- **Tagging all of them is the wrong goal.** Many Bhāgavatam verses (genealogies, geography,
  cosmology) will never make a daily sloka. The pool is **already an opt-in**, so the plan is to
  grow *that* — to roughly 1,500–2,500 reviewed verses — not to tag everything. Rough floor:
  ~350 for Stage 1 (it has to cover several moods without repeating), ~400 each for Stages 2 and 3,
  ~600 for the Intermediate/Advanced track, ~100 "wow" verses. These are estimates.
- **The pool is thin exactly where the brief leans on it.** SB approved verses by canto: 1→10,
  2→4, 3→20, 4→24, 5→13, 6→18, 7→25, 8→14, 9→15, 10→30, 11→61, **12→5**. Ambarīṣa and Durvāsā
  (SB 9.4–9.5, 88 verses) has **none**. The Gita side is nearly ready for anger: BG 2.56, 2.62,
  2.63, 3.37, 5.23 and 16.21 are all in the pool.
- **The brief's content correction is right.** The naraka descriptions are SB 5.26 (40 verses
  here) and the Ajāmila story is SB 6.1–6.3 (137 verses). Canto 12 (480 verses) is Kali-yuga,
  Parīkṣit's death and the glories of the Bhāgavatam. Because SB 5.26 is frightening, it needs a
  **tone** flag (below) so it never lands in the trust-building stage.
- **Generated text needs a reviewer.** A summary and a one-line takeaway per verse is new text on
  a devotional platform. The standing rule (devotional commentary only, nothing invented) means:
  generated from Prabhupāda's translation and purport only, saved as a `DRAFT`, and **a person
  approves it before the verse can be sent**.

## 3. The model, in words

- **Level** — `BEGINNER`, `INTERMEDIATE`, `ADVANCED`. Detected from chanting data, seeded by one
  onboarding question, never shown as a label the user must accept (§6).
- **Journey and stages are data, not code.** A `Journey` has ordered `JourneyStage`s with their
  length (21 days), the active-days needed to move on (default 14 of 21), the book mix, the
  difficulty cap and how strongly mood counts. Changing "3 weeks" to "4" is an admin edit.
- **Categories are a small editable list** (Śraddhā, Jñāna, Bhakti, Vairāgya, Karma, Mind control,
  Surrender, Death and the soul, Pastimes …); **difficulty and tone are fixed enums**, because the
  rules read them.
- **Moods reuse `Issue` / `VerseIssue`.** Add rows for anxiety, grief, fear, loneliness and so on
  (category `OTHER`). The mood picker, `UserIssue`, the productivity report all keep working.
- **One source of truth for "in the pool".** A verse becomes eligible when its curation is
  `APPROVED`, and approving sets `isSlokaEligible = true` (retiring clears it). The existing
  picker, the admin sloka page and the app keep reading `isSlokaEligible`.

## 4. Schema (sketch — not applied)

```prisma
enum SlokaLevel     { BEGINNER INTERMEDIATE ADVANCED }
enum LevelSource    { AUTO SELF ADMIN }
enum Difficulty     { EASY MEDIUM ADVANCED }
enum Tone           { GENTLE HEAVY }          // naraka, death, downfall: HEAVY, kept out of Stage 1
enum CurationStatus { DRAFT APPROVED RETIRED }
enum SlokaTrigger   { CALENDAR WOW STAGE MOOD CONTINUITY SURPRISE FALLBACK ADMIN }
enum EventMode      { TAKEOVER BIAS }         // a festival replaces the pick; a season only leans

// The editable list of categories.
model SlokaCategory {
  id String @id @default(cuid())
  slug String @unique              // "shraddha", "mind-control", "pastimes" …
  name String
  nameI18n Json?
  displayOrder Int @default(0)
  verses VerseCategoryLink[]
}
model VerseCategoryLink {
  verseId String
  categoryId String
  @@id([verseId, categoryId])
}

// What the engine knows about a verse beyond the verse. 1:1 with Verse.
model VerseCuration {
  verseId String @id
  difficulty Difficulty
  tone Tone @default(GENTLE)
  stages String[] @default([])      // stage slugs it may serve: "shraddha", "jnana", "bhakti", "intermediate"…
  isWow Boolean @default(false)
  wowHook String?                  // one line: why this one is a story worth a day
  summary Json  @default("{}")      // { en: "...", hi: "..." } plain language
  takeaway Json @default("{}")      // { en: "..." } one practical line
  status CurationStatus @default(DRAFT)
  suggestedBy String @default("AI") // AI | HUMAN
  reviewedById String?
  reviewedAt DateTime?
  updatedAt DateTime @updatedAt
  @@index([status, difficulty])
}

model Journey { id String @id @default(cuid())  slug String @unique  name String  stages JourneyStage[] }
model JourneyStage {
  id String @id @default(cuid())
  journeyId String
  slug String                       // "shraddha"
  name String
  nameI18n Json?
  displayOrder Int
  targetDays Int @default(21)
  minActiveDays Int @default(14)    // the "X of 21" rule
  bookMix Json                      // { "srimad-bhagavatam": 1.0 }  or { "srimad-bhagavatam": 0.5, "bhagavad-gita": 0.5 }
  maxDifficulty Difficulty
  moodStrength Float @default(1)    // Stage 1 = 1.0 … later stages lower
  @@unique([journeyId, slug])
}

model UserJourney {
  userId String @id
  level SlokaLevel @default(BEGINNER)
  levelSource LevelSource @default(AUTO)
  stageId String?
  stageStartedOn DateTime @db.Date
  stageDay Int @default(1)
  extensions Int @default(0)        // times the stage was repeated for lack of active days
  lastEvaluatedOn DateTime? @db.Date
}

// One row per local date the person opened the app. The only way to answer "X of the last 21 days".
model UserActiveDay {
  userId String
  date DateTime @db.Date
  @@id([userId, date])
}

model CalendarEvent {
  id String @id @default(cuid())
  slug String @unique              // "ekadashi", "janmashtami", "kartika", "pitru-paksha", "gita-jayanti"
  name String
  mode EventMode
  verses CalendarEventVerse[]
  dates  CalendarEventDate[]
}
model CalendarEventDate  { eventId String  date DateTime @db.Date  region String @default("")  @@id([eventId, date, region]) }
model CalendarEventVerse { eventId String  verseId String  weight Int @default(0)  @@id([eventId, verseId]) }

// UserDailySloka gains:  trigger SlokaTrigger?   stageId String?   stageDay Int?
```

Links between verses reuse `VerseLink`; a story's own order comes from `StoryPart`. Add one
relation value (`CONTINUES`) only if that proves not enough.

## 5. The selection logic

One pure function — `utils/sloka-engine.js`, like `utils/sloka-delivery.js` — takes the user's
state and the candidate rows and returns `{ verseId, trigger, reason }`. A thin loader in
`controllers/` reads the rows. The rules are therefore testable without a database, and every edge
case in §7 is a table-driven test.

```
for user U, local date D   (inside sloka.build)

 0  pool = APPROVED verses  minus  anything sent to U in the last 90 days
        pool empty?  → drop the 90-day rule, oldest-seen first.  Never send nothing.

 1  CALENDAR   an event active on D for U's region?
        TAKEOVER (Janmāṣṭamī, Gītā Jayantī)  → its verse U has not seen        → DONE  trigger=CALENDAR
        BIAS     (Kārtika, Pitṛ-pakṣa, Ekādaśī) → remember it; bonus in step 5

 2  LEVEL & STAGE   from UserJourney
        BEGINNER   → stage.bookMix, stage.maxDifficulty, stage.slug in verse.stages, tone GENTLE in Stage 1
        INTERMEDIATE / ADVANCED → that track's pool
        candidates = pool ∩ stage fit        (empty? relax to the level's pool, then to FALLBACK)

 3  WOW        today is U's wow day (every 7th day of the stage) and an unseen wow verse fits
        → pick it                                                              → DONE  trigger=WOW
        (a calendar TAKEOVER on that day wins; the wow moves to the next day)

 4  MOOD       U reported a mood in the last 3 days (UserIssue)
        score += VerseIssue.weight × stage.moodStrength
        (no candidate carries the mood? drop the mood, keep the stage — say so in `reason`)

 5  SCORE & PICK
        + continuity   linked from yesterday's verse (VerseLink / next StoryPart), unseen — at most 2 days running
        + calendar bias bonus
        + novelty      never sent to U over sent-before-the-window
        draw one of the top 5, weighted, seeded by (userId, D) so a re-run gives the same answer
        about 1 day in 10: ignore stage fit and draw from the best of the pool   trigger=SURPRISE

 6  write UserDailySloka(verseId, trigger, stageId, stageDay, reason)
```

**Progression** — a daily job `journey.evaluate` (not part of picking, so a bug in one cannot
break the other). When `stageDay` reaches `targetDays`: count the `UserActiveDay` rows in the stage
window. At least `minActiveDays` → next stage, `stageDay = 1`. Fewer → **extend by 7 days**
(`extensions + 1`) and keep drawing *unseen* verses of the same stage; after 2 extensions move on
anyway so nobody is stuck on Śraddhā forever (the number is an open question).

**Level** — recomputed weekly with `UserPreferenceProfile`, from the last 14 days:
- `ADVANCED` — rounds ≥ `dailyRoundTarget` (16) on at least 10 of 14 days;
- `INTERMEDIATE` — any round of the mahāmantra or a Viṣṇu mantra (by `Mantra` slug / `Deity`) on at least 4 of 14 days;
- `BEGINNER` — otherwise, and for anyone with no data yet.
Up after **2 consecutive** qualifying weeks, down only after **3** below — so one busy or lazy
week does not flip someone's whole feed.

## 6. Sample: a beginner, Stage 1 (Śraddhā), saying they struggle with anger — 21 days

Stage 1 is Bhāgavatam only; no calendar event in these days. ● = in the pool today, ○ = exists but
is not in the pool, **gap** = the pool has nothing suitable and a verse has to be found and
approved. The takeaway lines are **drafts to show the format**, not approved text.

| Day | Verse | | What the day does (draft takeaway) |
|---|---|---|---|
| **Week 1 — hearing works** | | | |
| 1 | SB 1.2.17 | ○ | Hearing is itself the cleansing; nothing has to be fixed first. |
| 2 | SB 1.2.18 | ● | A little hearing, regularly, removes what troubles the heart. |
| 3 | SB 1.2.21 | ○ | The knot in the heart loosens; doubts do not have to be forced out. |
| 4 | SB 1.2.6 | ○ | The aim is a practice that satisfies the self, not a result. |
| 5 | easy · faith · short | **gap** | — |
| 6 | SB 10.89.3 | ● | Story hook: a sage sets out to test who is most forbearing. |
| 7 | SB 6.1.30 | ● | **Wow.** The Viṣṇudūtas arrive on hearing the holy name (Ajāmila). |
| **Week 2 — anger, seen at work** | | | |
| 8 | SB 10.89.4 | ● | Brahmā feels anger rise toward his own son and governs it with intelligence. |
| 9 | SB 11.21.20 | ● | Quarrel → intolerable anger → the darkness of ignorance. |
| 10 | SB 11.17.21 | ● | What the opposite looks like: nonviolence, truthfulness, freedom from anger. |
| 11 | SB 1.18.29 | ● | A great king's anger toward a sage, and what followed. |
| 12 | story · krodha · easy (the curse that followed, SB 1.18) | **gap** | — |
| 13 | SB 10.89.8-9 | ○ | Continuity from day 6/8: Bhṛgu kicks Viṣṇu on the chest. |
| 14 | SB 12.3.51 | ● | **Wow.** Kali-yuga is an ocean of faults, yet one thing redeems it. |
| **Week 3 — the way through** | | | |
| 15 | Viṣṇu's answer to Bhṛgu (SB 10.89, later verses) | **gap** | — |
| 16 | Ambarīṣa and Durvāsā (SB 9.4–9.5) | **gap** | — |
| 17 | Ambarīṣa and Durvāsā, the outcome | **gap** | — |
| 18 | SB 7.9.39 | ● | Humility: Prahlāda's prayer from his own sense of being fallen. |
| 19 | the holy name as the help against anger · short | **gap** | — |
| 20 | a bridge verse to Stage 2 · short | **gap** | — |
| 21 | SB 6.2.38 | ● | **Wow, and the stage's close.** "Because I chanted … my heart is now becoming purified." |

**What this shows:** 10 days are ready (●), 4 verses exist and need approving (○), and **7 days
have nothing in the pool** — a third of the plan. Day 7 is a wow because the engine puts one
every 7th day; day 14 is a Canto 12 wow, as the brief asks. **Stage 2 then opens from the Gita,
already in the pool:** BG 2.62, 2.63 (anger → delusion → loss of memory), 3.37, 5.23, 2.56, 16.21.
SB 5.26 (naraka) is tone `HEAVY` and starts at Stage 2, never here.

## 7. Edge cases

| Case | What happens |
|---|---|
| Skips days | The stage does not advance on its own: `stageDay` moves on **calendar days**, but progression is decided by *active days*, so a gap means an extension, not a missed verse. No catch-up pile on return. |
| Away 14+ days | The next verse is an EASY, GENTLE, faith-stage verse ("welcome back"), then back to where they were. The stage is **not restarted**. |
| Opens the app, ignores the push | Counts. `UserActiveDay` is the app opening, not the notification. |
| Level goes up mid-stage | Only after 2 qualifying weeks; takes effect at the **next stage boundary** (or immediately if they are in Stage 1 with a week to go — open question). |
| Level goes down | After 3 weeks below; their stage position is kept. No demotion pop-up. |
| Mood changes | The latest mood within 3 days wins. Reporting the same mood daily is fine: step 0 keeps verses from repeating, and the stage still sets the books. |
| Mood with nothing matching in this stage | Mood is dropped for the day, stage is kept; `reason` says so. |
| Mood reported *after* the evening build | `sloka.build` picks tomorrow's verse the evening before, so it cannot see it. The mood endpoint answers right away; a re-pick at delivery time is an open question. |
| Calendar day on a wow day | The festival wins; the wow moves to the next day. |
| Ekādaśī every ~12 days | `BIAS`, never a takeover — it leans the pick, it does not break the journey. |
| Verse retired after being sent | Kept in history (never deleted from `UserDailySloka`); no longer drawn. |
| Time zone changes | Day boundaries follow the current `User.timezone`; a repeated or skipped local date is absorbed by `UserDailySloka`'s unique `(userId, date)`. |
| Installed today | Day 1 is built on demand with the Stage 1 default; nobody waits for the evening build. |
| Pool exhausted | Rule 0 relaxes (oldest-seen first). It is logged, because it means the pool is too small. |

## 8. Build order

1. **Record what is needed, change nothing visible.** `UserActiveDay` (one upsert per day, from the
   home call), the level job writing `UserJourney` in **shadow mode**, an onboarding question. The
   admin sees what level each user would be. *This starts the 21-day clock for later.*
2. **Curation.** `VerseCuration`, categories, new mood `Issue` rows, an admin **Curation** page, and
   an AI "suggest tags and summary" job on BullMQ with an estimate before it runs and
   `AiUsageLog` rows (the Translations page is the pattern). Approve into the pool by hand.
3. **Calendar.** `CalendarEvent*` and an admin page; dates entered once a year.
4. **The engine** behind an AppSetting (`sloka.engine = legacy | journey`), first run in shadow
   (write what it *would* pick, compare with what was sent), then switched on for a few users.
5. **The app.** "Day 9 of Śraddhā", the summary and takeaway on the sloka screen, a mood chooser
   (the `UserIssue` endpoint exists), all text in every language (`l10n_parity_test`).

## 9. Open questions (with the recommendation)

1. **Curate ~2,000 verses, not all 13,701?** Recommend yes (§2).
2. **Who approves the AI summaries and takeaways?** Someone devotional, before a verse is sent.
   A review queue in the admin panel is part of step 2. Who?
3. **`minActiveDays`** — 14 of 21 proposed. And how many extensions before moving on anyway (2)?
4. **How is the level first known?** Recommend one onboarding question with three plain choices
   ("I don't chant yet" / "I chant some" / "I chant 16 rounds"), then the data takes over.
5. **Whose calendar?** Ekādaśī, Pitṛ-pakṣa and Kārtika dates differ by tradition and by place.
   Recommend: an admin enters one authority's dates yearly (per region only if needed). Which?
6. **How long does a mood last?** 3 days proposed. Mood told by tapping, never inferred.
7. **The wow day** — every 7th day of the user's own stage (proposed), or one fixed weekday for all?
8. **Pick at delivery time rather than the evening before**, so a mood told that evening counts?
   Cheap (one query per delivered user). Recommend yes, once the engine is on.
9. **The Intermediate and Advanced tracks aren't described in the brief.** What are their stages —
   monthly themes? Until they are, those users get today's picker.
10. **Summary and takeaway languages** — English first, then the Translations pipeline (a cost), or
    start with English, Hindi and Marathi?
11. **Is the journey a subscription feature?** The feature catalogue can carry it (no schema change).
12. **A level-up in Stage 1** — move up at once, or at the stage boundary (§7)?
