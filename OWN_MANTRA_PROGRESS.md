# Readers' own mantras — progress and handover

Last updated 2026-10-22. **Nothing is committed.** Paths are from the repo root (`hariharibol/`): the Flutter app is `app/`, the API is `backend/`. This file is untracked — delete it or commit it, as you like.

## 0. Start here

| Part | State |
|---|---|
| Backend: routes, AI calls, migration, e2e, unit tests | **Done and verified.** `npm run test:mantra-own` → 146 passed, 0 failed. Leave it alone unless a test fails. |
| Flutter app | **Not started.** No Dart file has been created or edited for this feature (checked 2026-10-22). Sections 5–7 hold what is needed to write it without more exploring. |
| Tests for the app | Not written (section 8). |
| Docs (`backend/CLAUDE.md`, `app/CLAUDE.md`, root `CLAUDE.md`) | **Not written** (section 9). |
| Final report | **Not written** (section 11 says what it must contain). |

The user has asked twice to **finish fast** ("finish this faster", "finish it as soon as possible"). Write the remaining code directly, with as few tool calls as possible: tight, but complete. Read an existing file's relevant range right before editing it (the Edit tool needs a prior Read) and nothing beyond that.

Order of work: `cd app && tool/flutter.sh pub get` → Flutter steps 1–11 (section 5) → ARB + `gen-l10n` (section 7) → tests (section 8) → `analyze` / `test` → docs (section 9) → final report (section 11).

## 1. The request and the user's decisions

Original request, verbatim:

> in our mantra (jap) tab, give option for user to create his own mantra , there may be some users who chants another mantra  which does not exists in our system, such mantra will be saved in our db but mantraType (new column default valud public) but if its added by end user from our app then it will be private and visible to him only, also one important thing is that we can't add mantra whatever user enter, we use our ai system here (we can use free tier ai , or gemini, or gpt-6-luna model whatever work) , user will enter or say mantra (os assistent tts) , then whatever user entered same passed to ai from our backend then ai should suggest some related mantra , then that mantra will be shown to user , user will choose max 5 mantra from selections, then that selection will be passed to our backend, our backend will pass to ai, then ai will give all mantra details like whatever we saved for other mantra , also one public image url (not ai image generatiin whcih is costier) or  there is no image available give option for user to change image , also if any mantra already exists in our system then that mantra should be visible to this new user also so both users will access it, and if any mantra is accessible for 11+ users then that mantra should be promoted to public and available in all languagesd which we support, also user who add or request this mantra , then this mantra should be available in english+ reading languages of users which are requested

Follow-ups from the user:

- **"yes respective deity should be created"** — when the model names a deity we do not hold, create it. Decision taken: it is created with `isPublished:false`, so an admin reviews it, adds a picture and publishes it. The same applies to a new Guru. **The final report must say this and offer to flip them to published.**
- **"make sure mantra should be well known deity/sant"** — only mantras of well-known deities and saints are ever offered. Done in the backend (section 3).
- **"finish this faster" / "finish it as soon as possible"**.

Standing rules from the user and the repo:

- Do not commit or push unless asked. A commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; a PR description ends with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Secrets are never committed (`.env`, Firebase configs, Android signing keys).
- **Do not run the dev `.env` against the real S3 bucket.** Blank `AWS_ACCESS_KEY_ID=` and `AWS_SECRET_ACCESS_KEY=` when starting the API or an upload e2e locally. `scripts/mantra-own-e2e.js` blanks them itself and needs only Postgres and Redis.
- Report outcomes faithfully: if a test fails, say so with the output; if a step was skipped, say that.

## 2. How the feature works

1. In the Jap tab the reader taps **Add your own mantra** and lands on `/mantras/add`.
2. They type, or say it with the phone's own recogniser (the words land in the box and are never sent by themselves). **Find mantras** → `POST /api/app/mantras/own/suggest {text}`.
3. The server sends the text **as entered** to the model (`mantra.suggest`), which names up to 8 related mantras of **well-known deities and saints**. They are held in Redis for 1 hour under a `suggestionId`, and each comes back with a `status`.
4. The reader chooses up to 5 (only `new` and `shared` can be chosen) → `POST /api/app/mantras/own {suggestionId, picks}`. The phone sends only index numbers, so nothing but what was suggested can be saved.
5. For each pick the server either gives the reader access to a mantra we already hold (`shared`), or has the model write the full details (`mantra.details`) in the same shape as a catalogue mantra, finds a public web picture URL (no image generation), saves it `PRIVATE`, and writes it in the reader's reading language in the background (`mantra.translate`).
6. The reader may change the picture of a mantra **they created** (upload), and may remove any private mantra from their list.
7. When **11** readers hold a private mantra it is promoted: `mantraType:'PUBLIC'`, `isPublished:true`, the creator's upload is dropped, and it is queued in every supported language.

Who sees what:

- A private mantra keeps `isPublished=false`, so every "published mantras" query leaves it out. Only the queries that serve a reader their own mantras look at `MantraAccess`.
- `GET /mantras` = published mantras plus the signed-in reader's private ones, first. `GET /mantras/:slug` for someone else's private mantra → 404.
- A mantra already in the catalogue is reported as `catalog` and opened by `slug`; it is never copied.
- **Private mantras cannot be shared** (`services/share.js` requires `isPublished: true`): 404 on `POST /share/link`, 410 on resolve. No backend change was needed, and the e2e asserts it. The app must hide the Share button for a private mantra.
- The label in the app is **"Private"**, not "Only you": a private mantra can be held by up to 10 other readers before it is promoted.

## 3. Backend — what exists (finished; do not change unless a test fails)

Plain Node.js ESM, Prisma + Postgres, Redis, BullMQ. Routes use `createRouter`, input is on `req.valid.*`, errors are `AppError(status, code, msg)`.

**New files** (all exist, uncommitted):

- `backend/services/user-mantra.js` — suggest / create / promote / leave / change picture; shared by the controller and the worker job (that is why it is a service: `backend/CLAUDE.md` rule 4 says controllers have none).
- `backend/utils/mantra-own.js` — parsing and validation of the model's answers, the well-known rule.
- `backend/utils/mantra-visibility.js` — `visibleTo(user)` = `{OR:[{isPublished:true},{mantraType:'PRIVATE',access:{some:{userId}}}]}`.
- `backend/services/public-image.js` — finds the public picture URL.
- `backend/config/mantra-own.js` — `MAX_SUGGESTIONS=8`, `MAX_PICKS=5`, `SUGGESTS_PER_DAY=20`, `CREATES_PER_DAY=10`, `MAX_OWN_MANTRAS=50`, `PUBLIC_AFTER_READERS=11`, `IMAGE_MAX_BYTES` (5 MB), `IMAGE_MAX_EDGE`, `TRANSLATE_MAX_TOKENS`, `PROMOTED_DISPLAY_ORDER`.
- `backend/prisma/migrations/20261104000000_user_mantras/migration.sql` (43 lines).
- `backend/scripts/mantra-own-e2e.js` and `backend/test/mantra-own.test.js` (46 unit tests); `package.json` script `"test:mantra-own": "node scripts/mantra-own-e2e.js"`.

**Changed files**: `prisma/schema.prisma`, `routes/app/mantra.js` (161 lines; four routes before `/:slug`), `controllers/app/mantra.js` (`list`/`get`/`categories` use `visibleTo`; new `suggestOwn`, `createOwn`, `changeOwnImage`, `leaveOwn`), `utils/present.js`, and two small guards:

- `controllers/admin/mantra.js:194` — publishing a `PRIVATE` mantra from the admin also makes it `PUBLIC`.
- `controllers/app/reel-make.js:87` — a made reel can only be tied to a `PUBLIC` mantra.

**Schema** (`prisma/schema.prisma`): `enum MantraType {PUBLIC PRIVATE}`; `Mantra` gains `mantraType` (default `PUBLIC`, indexed), `createdById` / `createdBy` (relation `"MantraCreator"`, `SetNull`; the reader who first added it), `access MantraAccess[]`, `matchKey VarChar(120)` (indexed; the consonant skeleton of the transliteration, filled lazily), `imageUrl`, `imagePath`; new `model MantraAccess {mantraId, userId, createdAt}` (`@@unique([mantraId,userId])`, cascades on both sides); `User.mantraAccess`. **The enum's comment in `schema.prisma` already points to a section called "Readers' own mantras" in `backend/CLAUDE.md` — that exact heading has to exist** (section 9).

**AI**: `services/ai/index.js` `complete({operation,…})` with operations `mantra.suggest`, `mantra.details`, `mantra.translate`, each logged to `AiUsageLog`. **Cost answer (grep, 2026-10-22):** `services/user-mantra.js` and `utils/mantra-own.js` contain no wallet or debit call, so the mantra flow is **not** paid from the Sakha token wallet; it is limited only by the per-user daily caps (`SUGGESTS_PER_DAY`, `CREATES_PER_DAY`), `MAX_OWN_MANTRAS` and the `ai` rate-limit bucket. Before writing the docs, glance at `services/ai/index.js` to confirm `complete()` itself does not debit anyone, and document what you find.

**The well-known rule is layered:** the model must return `wellKnown===true` and `kind` ∈ {`deity`, `saint`}; it must return a validated plain `addressedTo` name; living persons are excluded by the prompt; a deity mantra needs a deity and a saint's mantra needs a guru. A Deity or Guru the model names but we do not hold is created with `isPublished:false`.

**Presented mantra** (`present.js`): `mantraType` (`'PRIVATE'`/`'PUBLIC'`), `isMine`, `imageUrl`, `deity {id,slug,name,imageUrl,fullImageUrl}`, `guru {id,slug,name,imageUrl}` — the deity and guru are presented whether or not they are published. A stored `imagePath` (the reader's own upload) wins over the stored web `imageUrl`. After promotion the upload is dropped, so the app shows the web `imageUrl`, else the deity's or guru's picture, and "Change picture" is no longer valid.

**Rate-limit buckets:** suggest and create → `limit: 'ai'`; picture and delete → `limit: 'write'`.

**Verified** (against local Postgres + Redis; the model faked):

| Check | Result |
|---|---|
| `npm run test:mantra-own` | 146 passed, 0 failed, no leftover rows |
| `node --test test/mantra-own.test.js` | 46 / 46 |
| whole unit suite | 998 passed |
| e2e regression: mantra-prayer 20, sampradaya 29, chant 38, routine 42, auth 31, chat 308, share-referral 57, legacy-migration 118, reels 80 | all passed |
| e2e: mantra-mala | 24 pass, **3 of 27 fail — pre-existing, not mine**: HEAD's `services/s3.js` stages uploads under `temp/<date>/hariharibol/…` while the untouched `scripts/mantra-mala-e2e.js` still expects `mantras/mala/…` (read from HEAD's code, not a baseline run) |
| e2e: admin-users | **could not run**: it needs the websocket server on :4001, which was not running. The geo-IP diff in `controllers/admin/user.js` belongs to another work stream |

The dev DB is clean: 12 deities, 10 gurus, 0 private mantras, 0 access rows, no e2e users, no leftover share links.

## 4. API contract the app must match

All under `/api/app/mantras` (the `/own…` routes are registered before `/:slug`). Signed-in only, except the two public reads.

**`POST /own/suggest`** — body `{text}` (1–1000 chars). 200 gives:

```json
{ "suggestionId": "<24 hex>",
  "items": [ { "index": 0, "name": "", "sanskrit": "", "transliteration": "",
               "kind": "deity|saint", "addressedTo": "", "status": "new|shared|yours|catalog", "slug": null } ] }
```

- `status`: `new` (can be added), `shared` (another reader added it — choosing it gives this reader access too), `yours` (already on the list), `catalog` (already in the catalogue — open it by `slug`). **Only `new` and `shared` can be chosen.**
- `items` is empty, and there is no `suggestionId`, when nothing was found. At most 8 items.
- Errors: 422 `MANTRA_INPUT_NOT_USABLE`; 429 at the daily limit; 503 `MANTRA_AI_UNAVAILABLE`.

**`POST /own`** — body `{suggestionId (24 hex), picks: [int 0..7]}` (1..5 picks). 201 gives `{items:[{status:'created'|'shared'|'already'|'failed', mantra: <presented mantra> | null}]}`, one entry per pick, in order.

- Errors: 409 `MANTRA_LIMIT`; **410 (the suggestions expired — search again)**; 429; 503 `MANTRA_AI_UNAVAILABLE`.
- The new mantra is written in the reader's reading language in the background.

**`PUT /own/:slug/image`** — the raw body is the picture (JPEG, PNG or WebP; any content type; 5 MB limit; what it really is gets judged from its bytes). 200 gives the presented mantra.

- 403 `FORBIDDEN`: the reader only shares it. 404: not theirs, or not private. **413** `IMAGE_TOO_LARGE`. 422 `IMAGE_NOT_USABLE`.

**`DELETE /own/:slug`** — 204, no body. Takes away the reader's access, favourite and standing choice of it; when no reader holds it and nothing refers to it, it is deleted (and its S3 picture). A public mantra cannot be removed this way (404).

**Error wording:** the new `AppError` codes have no `locales/*.json` ids, so their server text goes out in English. **The app must word them itself by code** (and never show `failure.message`). `ApiClient._kindFor` maps 400/422 → validation, 401 → unauthorized, 403 → unauthorized-if-`UNAUTHENTICATED` else forbidden, 404 → notFound, 409 → conflict, 429 → rateLimited, ≥500 → server. **410 and 413 are `FailureKind.unknown`**, so detect them by `failure.statusCode`, and the rest by `failure.code`.

## 5. Flutter — what to write, in order

Run everything from `app/` through `tool/flutter.sh` (`pub get`, `gen-l10n`, `analyze`, `test`). `pub get` may be needed first: `file_picker` and `in_app_review` are new dependencies from other streams. Keep every Dart file ≤ 500 lines.

**1. `app/lib/core/constants/own_mantra_config.dart`** (new). `abstract final class OwnMantraConfig`, in `chat_config.dart`'s style (sectioned `static const`, a `///` on each). Holds: `typePublic='PUBLIC'`, `typePrivate='PRIVATE'`; kinds `deity` / `saint`; suggestion statuses (`new` is a Dart keyword — name it `statusNew`) `new` / `shared` / `yours` / `catalog`; result statuses `created` / `shared` / `already` / `failed`; `maxPicks=5`, `maxText=1000`, `maxSuggestions=8`; error codes `MANTRA_INPUT_NOT_USABLE`, `MANTRA_LIMIT`, `MANTRA_AI_UNAVAILABLE`, `IMAGE_TOO_LARGE`, `IMAGE_NOT_USABLE`; the HTTP statuses 410 and 413. The picture picker already downsizes (1280 px, quality 82), so no picture constants are needed beyond the server's 5 MB if you pre-check.

**2. `app/lib/models/mantra.dart`** (148 lines; `guru` is already there as `ReferenceItem?`). Add to the constructor (it ends `this.myRounds = 0,`): `this.mantraType = OwnMantraConfig.typePublic, this.isMine = false, this.imageUrl,`. Add fields `final String mantraType; final bool isMine; final String? imageUrl;` and getters `bool get isPrivate => mantraType == OwnMantraConfig.typePrivate;` and `String? get imageCacheKey => imageUrl?.split('?').first;`. In `fromJson` (ends `isFavorite: asBool(json['isFavorite']), myRounds: asInt(json['myRounds']),`): `mantraType: asString(json['mantraType'], OwnMantraConfig.typePublic), isMine: asBool(json['isMine']), imageUrl: asStringOrNull(json['imageUrl']),`. **Cached answers from before this change lack these fields, so the defaults matter.** Add `///` comments in the file's style.

**3. `app/lib/models/own_mantra.dart`** (new). `MantraSuggestion {index, name, sanskrit, transliteration, kind, addressedTo, status, slug?}` with `bool get canPick` (status new or shared); `MantraSuggestions {suggestionId, items}`; `OwnMantraResult {status, Mantra? mantra}`. Parse with `Json` and the helpers in `models/json.dart` (`asString`, `asStringOrNull`, `asInt`, `asBool`, `asJson`, `asStringList`).

**4. `app/lib/core/constants/api_paths.dart`** (230 lines). After line 100 (`static String mantra(String slug) => '$_app/mantras/$slug';`) insert:

```dart
  // Readers' own mantras
  static const String mantraOwnSuggest = '$_app/mantras/own/suggest';
  static const String mantraOwn = '$_app/mantras/own';
  static String mantraOwnOne(String slug) => '$_app/mantras/own/$slug'; // DELETE
  static String mantraOwnImage(String slug) => '$_app/mantras/own/$slug/image'; // PUT
```

Keep the mantra error codes in `OwnMantraConfig`, not in `ApiCodes` (which holds only `unauthenticated` and `conflict`).

**5. `app/lib/services/api_client.dart`** (569 lines — already over the cap; keep the addition minimal). `postBytes` is at lines ~136–160 (a `_dio.request` with `data: bytes`, `options: Options(method: 'POST', contentType: contentType, sendTimeout: AppConfig.uploadTimeout)`, `_unwrap(response)`, `on DioException → throw _toFailure(error)`). Make `postBytes` a one-line delegate to a new private `_sendBytes(String method, String path, Uint8List bytes, {required String contentType, ApiCancelToken? cancel})` holding that body with `method: method`; add `putBytes` with the same signature delegating with `'PUT'`. `put` / `patch` / `delete` are `_send(...)` one-liners at ~lines 255–259; a 204 gives `ApiResponse(null, null, statusCode)`, so do not parse data on `DELETE`. **Re-read the file just before editing.**

**6. `app/lib/services/own_mantra_service.dart`** and **`app/lib/providers/own_mantra_provider.dart`** (new).

- Service: a singleton like `MantraService` (`OwnMantraService._(); static final instance`; `final ApiClient _api = ApiClient.instance`). Methods `suggest(text)`, `create(suggestionId, picks)`, `changeImage(slug, Uint8List bytes)` (via `putBytes`; send the picked file's real content type, or `image/jpeg` as the picker re-encodes), `leave(slug)`. After `create`, `changeImage` and `leave`, wipe the saved copies — `LocalStore.instance.deleteWithPrefix(BoxKeys.mantraCachePrefix)` inside try/catch (a failed cache write must never fail the request; `MantraService._keep` is the model for swallowing errors).
- Provider: a `Notifier` (Riverpod 3 idiom — copy `providers/routine_provider.dart:22,224` or `chat_provider.dart:29,52`). Sketch: `enum OwnMantraStage {input, suggesting, choosing, creating, done}` and a state holding the stage, the typed text, the `MantraSuggestions?`, the picked indices (a set, max 5), the results and an `ApiFailure?`. A failure keeps the screen where it was, so the reader can retry or search again (410 → back to the input with the expired line). Make it `autoDispose` so the state resets when the screen goes. After results, `ref.invalidate(mantraListProvider)`, `ref.invalidate(mantraCategoriesProvider)` and `ref.invalidate(mantraDetailProvider(slug))` for each affected slug.

**7. Routes.**

- `app/lib/core/navigation/app_routes.dart` (168 lines): after `mantraPath` (lines ~59–66) add
  ```dart
  /// The screen that adds a mantra of the reader's own. Registered before
  /// [mantraPattern], which would otherwise take "add" for a slug.
  static const String addMantra = '/mantras/add';
  ```
  and in `RouteNames` (beside `mantraDetail`) `static const String addMantra = 'addMantra';`.
- `app/lib/core/navigation/app_router.dart` (460 lines): add `import '../../views/mantra/add_mantra_view.dart';` before the `mantra_detail_view` import (~line 28), and insert **just before** the mantra GoRoute (~line 215; route order matters — `/mantras/add` must match before `/mantras/:slug`):
  ```dart
        GoRoute(
          path: AppRoutes.addMantra,
          name: RouteNames.addMantra,
          builder: (context, state) => ContentWidth(
            maxWidth: ContentWidths.reading,
            child: const AddMantraView(),
          ),
        ),
  ```
  The router already redirects signed-out and no-language readers, so no extra gating.

**8. The screen and its widgets** (`views/mantra/add_mantra_view.dart` stays thin; widgets live in `widgets/mantra/`):

- `add_mantra_card.dart` — the Jap-tab entry, same shape as `widgets/chat/chat_entry_card.dart` (a `Card(clipBehavior: Clip.antiAlias)` → `InkWell` → `Padding(AppSpacing.card)` → `Row` of an icon, a title, a one-line body and a chevron; `onTap: () => AppNavigator.instance.push(AppRoutes.addMantra)`).
- `mantra_text_input.dart` — a text field (`maxLength: OwnMantraConfig.maxText`), a mic toggle and a **Find mantras** button. The mic uses `ChatDictation` (`widgets/chat/chat_dictation.dart`) with `ref.read(speechInputProvider)`; it is a `ChangeNotifier`, so show `listening` through a `ListenableBuilder`; `toggle(languageCode: Localizations.localeOf(context).languageCode, maxChars: OwnMantraConfig.maxText)`; dispose it. A plain `IconButton` that swaps mic / stop is enough (do not copy the chat's private pulsing button). `DictationNotice` → words: `denied` → own `ownMantraMicDenied`, `unavailable` → `chatMicUnavailable`, `heardNothing` → `chatMicNoSpeech`, `failed` → `chatMicFailed`, shown with `AppNavigator.instance.showMessage(...)`. Reuse `chatMicStop` and `chatListening`. Avoid the chat-specific `chatMic` ("question"), `chatMicDenied` and `chatAttachNote`.
- `suggestion_tile.dart` — a checkbox only when `canPick`; name, Sanskrit, transliteration, and a line by `kind` ("for {addressedTo}" for a deity, "of {addressedTo}" for a saint); a **status word** for `shared`, `yours`, `catalog` (colour never carries meaning alone); `catalog` opens `AppRoutes.mantraPath(slug)`; `yours` is a plain label. A "n of 5 chosen" counter and an **Add chosen mantras** button (disabled at zero; the sixth tick is ignored). An empty state when nothing was found that also says only well-known deities' and saints' mantras are suggested.
- `own_mantra_results.dart` — per pick: the mantra's name and a status line (`created`, `shared`, `already`, `failed` with a failure line); **Open** (`AppRoutes.mantraPath(slug)`); **Change picture** only for `status == created` with `mantra.isMine && mantra.isPrivate` (a reader who only shares it would get 403); `actionDone` to close.
- `mantra_picture_sheet.dart` — a bottom sheet like `chooseChatPicture` in `widgets/chat/chat_attach_sheet.dart` (`showModalBottomSheet(useRootNavigator: true, showDragHandle: true)`, camera and gallery tiles with `chatAttachCamera` / `chatAttachGallery`), its own one-line note instead of `chatAttachNote`. Pick with `ref.read(chatImagePickerProvider).pick(PictureSource.camera|gallery)` — it returns a **file path** (use `File(path).readAsBytes()`), `null` when the reader backs out, and throws `PictureAccessDenied` (word it with `chatPictureDenied`).
- `own_mantra_problem.dart` — one function turning an `ApiFailure` into reader words, by code (never `failure.message`): `MANTRA_INPUT_NOT_USABLE` → not-usable; rateLimited / 429 → daily limit; `MANTRA_AI_UNAVAILABLE` → unavailable; `MANTRA_LIMIT` → list full; `statusCode == 410` → expired, search again; `IMAGE_TOO_LARGE` / 413 → too large; `IMAGE_NOT_USABLE` → not usable; forbidden on the picture → only the reader who added it; else `failure.ownWords(AppLocalizations.of(context))`.
- No reader-facing string says "AI", "assistant" or "bot".

**9. `app/lib/widgets/dashboard/mantra_list_tile.dart`** (136 lines; re-read lines 60–136 first) and **`app/lib/views/dashboard/sadhana_tab.dart`** (396 lines, with other streams' uncommitted edits).

- Tile: add optional `imageUrl`, `imageCacheKey`, `guru` (`ReferenceItem?`) and `isPrivate`. The picture falls back own `imageUrl` (cache key = the URL **without its query string**; never a fixed key and never the presigned URL) → `deity.imageUrl` (cache key `'deity-${deity.id}'`, as today) → `guru.imageUrl` → the motif panel. When `isPrivate`, show a badge beside the category chip: a lock icon **and** the word "Private".
- Jap tab: `_MantraBrowser` is at ~lines 283–374; its `build` returns a `Column` that starts with `SectionHeader(title: text.homeMantras)`; the `MantraListTile(...)` call is at ~354–364. Pass `imageUrl: mantra.imageUrl`, `imageCacheKey: mantra.imageCacheKey`, `guru: mantra.guru`, `isPrivate: mantra.isPrivate`, and put the entry card near the header. Add its import.

**10. `app/lib/views/mantra/mantra_detail_view.dart`** (175 lines; the AppBar share button is `ShareStudio.open(context, ShareTarget.mantra(mantra.value!))`).

- Hide the share button when `mantra.isPrivate`.
- Add a picture header for a private mantra (the same fallback chain as the tile).
- Show **Change picture** when `isMine && isPrivate` (the picture sheet, then `changeImage`; word 403 / 413 / 422).
- Show **Remove from my list** when `isPrivate` (shared holders too): `AppNavigator.instance.confirm(title:, message:, confirmLabel:, isDestructive: true)` (signature at `core/navigation/app_navigator.dart:95`), then `leave(slug)`, then leave the screen (look for a `pop` on `AppNavigator`) and `showMessage(ownMantraRemoved)`. Check where `confirm` takes its cancel label from before adding an own cancel string.
- After either action, wipe the saved copies and invalidate `mantraListProvider`, `mantraCategoriesProvider` and `mantraDetailProvider(slug)`.

**11. ARB in 12 languages and `gen-l10n`** — section 7. Then the tests (section 8) and `analyze` / `test`.

## 6. Flutter — facts about existing code (so nothing needs re-reading)

**Rules that bite** (`app/CLAUDE.md`):

- Nothing hardcoded: no magic strings, colours, sizes, durations or endpoints inline — constants go in `core/constants/*.dart`. Never `Colors.*` except `Colors.transparent`; no `Color(0xFF…)` outside `app_colors.dart`. Colour never carries meaning alone: an icon or a word always accompanies it. No control that does nothing.
- Every reader-facing string goes through ARB. Services write no words: show failures with `failure.describe(AppLocalizations.of(context))`, or by code / `ownWords` where the server's text must never reach the reader (as the chat's `ChatProblem` does).
- Views are thin; custom widgets live in `widgets/{module}/{name}.dart`; ≤ 500 lines per Dart file.
- A theme `FilledButton` is full width; inside a `Row` set `minimumSize: Size(0, AppSizes.buttonHeight)`.
- Bottom sheets: `showModalBottomSheet(useRootNavigator: true, isScrollControlled: true)`.
- Widget tests that write `LocalStore` under a fake clock can hang the next `setUp`: use `keepStoresInMemory()` from `test/support/chant_stores.dart` and `ReadingPlaceStore.keepInMemory()`.

**Tokens** (`core/theme/app_spacing.dart`, which also defines the radius, size and duration classes): `AppSpacing` xxs=2 xs=4 sm=8 md=12 lg=16 xl=24 xxl=32 xxxl=48, `screenH`, `card` (`EdgeInsets.all(lg)`), `page` (`fromLTRB(lg,lg,lg,xxxl)`); `AppRadius` sm=8 md=12 lg=20 pill=999 with `smAll`/`mdAll`/`lgAll`/`lgTop`; `AppSizes` iconSm=16 iconMd=24 iconLg=32 avatarSm=32 avatarMd=44 avatarLg=72 buttonHeight=52 buttonHeightSm=44; `AppDurations` fast/normal/slow/snack. Theme access: `context.colors`, `context.texts`, `context.theme` (`core/theme/app_theme.dart`). Layout: `ContentWidth(maxWidth:, child:)` and `ContentWidths` (`reading` 720, `regular` 880, `wide` 1180) in `core/layout/adaptive.dart`.

**Shared widgets and helpers:**

- `AppImage({url,width,height,cacheKey,borderRadius=AppRadius.mdAll,fit=BoxFit.cover})` — `widgets/common/app_image.dart`. `MotifPanel` — `widgets/common/motif.dart`. `SectionHeader({title, onViewAll, actionLabel})`.
- `ReferenceItem {id, slug, name, description?, imageUrl?, fullImageUrl?, displayOrder}` (`models/reference_item.dart`) is both the deity and the guru type.
- `ApiFailure {kind, message='', code, statusCode, details, retryAfter}`; `describe(text)` gives the server's message if non-empty, else `ownWords(text)`; `ownWords` maps `ClientFailureCode`, then `FailureKind`, to `errorSignIn / errorInsecureConnection / errorCancelled / errorTimeout / errorNetwork / errorSessionExpired / errorGeneric`.
- `AppNavigator.instance`: `showFailure(failure)`, `showMessage(String)`, `push`, `confirm`.
- `ChatDictation({required input, required text, required onNotice})` — `enum DictationNotice {denied, unavailable, heardNothing, failed}`; `bool get listening`; `Future<void> toggle({required String languageCode, required int maxChars})`; `cancel()`; `dispose()`. What is heard is appended after the existing text and clipped to `maxChars`; "heard nothing" is not reported if the reader pressed stop. `speechInputProvider` is in `providers/chat_provider.dart:18`; `chatImagePickerProvider` at `:14`.
- `ChatImagePicker` (`services/chat_image_picker.dart`): `enum PictureSource {camera, gallery}`; `Future<String?> pick(PictureSource)`; throws `PictureAccessDenied(source)`.
- `MantraService` (`services/mantra_service.dart`): a singleton that writes the raw API answer to the offline cache under `BoxKeys.mantraList(category)`, `BoxKeys.mantraCategories`, `BoxKeys.mantraDetail(slug)`; `_keep` swallows write errors; the providers in `providers/mantra_provider.dart` (`mantraCategoriesProvider`, `mantraListProvider` family by category, `mantraDetailProvider` family autoDispose) use `savedThenFresh(saved, fetch)` — a stream that shows the saved copy first, then the fresh one.
- `models/json.dart`: `Json`, `asString(value,[fallback])`, `asStringOrNull`, `asStringList`, `asInt`, `asBool`, `asJson`.

**Test support:** `test/support/fake_chat_device.dart` has `FakeChatImagePicker` and `FakeSpeechInput`; `test/jap_offline_test.dart` shows the real-store pattern (temp dir with a path_provider mock, `LocalStore.instance.init()`); `ApiClient.forTesting({adapter})` with a scripted adapter as in `api_client_auth_test.dart`; the tests build `ProviderContainer(retry: (_, _) => null …)`.

## 7. Strings (ARB)

Add each key at the **end** of every ARB, before the closing brace: `app_en.arb` plus `app_hi mr gu bn ta te kn or pa ml as`. Rules (`test/l10n_parity_test.dart` enforces them): same keys in the same order; no `@key` metadata outside English (English alone carries it, for placeholder keys: `ownMantraChosenCount` with `{chosen}` and `{max}` typed `int`, `ownMantraForDeity` and `ownMantraForSaint` with `{name}` typed `String`); placeholders kept exactly; Latin digits only; every value a non-empty string; a value identical to English fails if it still has a word of three or more Latin letters. Then run `tool/flutter.sh gen-l10n` and check `git diff --stat` for unexpected generated-file changes (other streams hand-edited some generated files).

Draft English (final wording is yours; none of it says "AI", "assistant" or "bot"; about 40 keys, trim as you go):

| Key | Draft English |
|---|---|
| `ownMantraAddTitle` | Add your own mantra |
| `ownMantraAddBody` | Chant a mantra that is not in our list? Tell us which one and we will find it. |
| `ownMantraInputHint` | Type or say a mantra, or the name of a deity |
| `ownMantraWellKnownNote` | We add mantras of well-known deities and saints only. |
| `ownMantraMic` | Say it instead |
| `ownMantraMicDenied` | Allow the microphone in your phone's Settings to say a mantra. |
| `ownMantraFind` / `ownMantraFinding` | Find mantras / Finding mantras… |
| `ownMantraNoneFound` | We could not find a mantra of a well-known deity or saint for that. Try another name. |
| `ownMantraChosenCount` | {chosen} of {max} chosen |
| `ownMantraAddChosen` / `ownMantraAdding` | Add chosen mantras / Adding… |
| `ownMantraForDeity` / `ownMantraForSaint` | Mantra for {name} / Mantra of {name} |
| `ownMantraStatusShared` / `…Yours` / `…Catalog` | Added by other readers / Already on your list / Already in our list |
| `ownMantraResultCreated` / `…Shared` / `…Already` / `…Failed` | Added to your list / Added — other readers have it too / Already on your list / Could not be added. Please try again. |
| `ownMantraOpen` | Open |
| `ownMantraChangePicture` / `ownMantraPictureNote` / `ownMantraPictureSaved` | Change picture / Choose a clear, respectful picture. / Picture changed |
| `ownMantraPictureTooLarge` / `…NotUsable` / `…Forbidden` | That picture is too large. Please choose a smaller one. / That picture could not be used. Please choose a JPEG, PNG or WebP photo. / Only the reader who added this mantra can change its picture. |
| `ownMantraRemove` / `…RemoveTitle` / `…RemoveBody` / `…RemoveConfirm` / `ownMantraRemoved` | Remove from my list / Remove this mantra? / It will be taken off your list. / Remove / Removed from your list |
| `ownMantraPrivate` | Private |
| `ownMantraErrorNotUsable` | We could not understand that. Please type or say the name of a mantra or a deity. |
| `ownMantraErrorDailyLimit` | You have reached today's limit. Please try again tomorrow. |
| `ownMantraErrorUnavailable` | Adding mantras is not available right now. Please try again later. |
| `ownMantraErrorLimit` | Your list of own mantras is full. Remove one to add another. |
| `ownMantraErrorExpired` | These suggestions have expired. Please search again. |

Existing keys to reuse (English): `actionDone` "Done"; `chatAttachCamera` "Take a photo"; `chatAttachGallery` "Choose from your photos"; `chatPictureDenied` "Allow access to your camera or photos in your phone's Settings to add a picture."; `chatMicStop` "Stop listening"; `chatListening` "Listening…"; `chatMicUnavailable` "Speaking is not available on this phone."; `chatMicNoSpeech` "Nothing was heard. Please try again."; `chatMicFailed` "Listening stopped. Please try again." There is no generic cancel, remove, close or retry key.

Gotcha: the Write tool turns `​`-style escapes into the raw characters. If an ARB file must contain such an escape (a zero-width joiner in Indic text), write it with Python.

## 8. Tests to write

- `app/test/own_mantra_test.dart` — model parsing (`MantraSuggestions`, `OwnMantraResult`, `canPick`); `Mantra.fromJson` defaults for an old cached answer (no `mantraType` → public, `isMine` false, `imageUrl` null; `imageCacheKey` drops the query); the service against a scripted adapter (suggest posts `{text}`; create posts `{suggestionId, picks}`; `changeImage` PUTs the bytes to `/own/<slug>/image`; `leave` DELETEs and copes with a 204; the saved copies are wiped after each); the provider (stage changes, the sixth pick ignored, `yours` / `catalog` not pickable, a 410 keeps the screen and sets the failure).
- `app/test/add_mantra_view_test.dart` — the screen end to end: type → find → choose → add → results; the empty state; the "n of 5" counter; the mic with `FakeSpeechInput` appending text; the picture sheet with `FakeChatImagePicker`; in-memory stores.
- Run: `tool/flutter.sh test test/l10n_parity_test.dart test/own_mantra_test.dart test/add_mantra_view_test.dart test/jap_offline_test.dart test/models_test.dart`, then `tool/flutter.sh analyze` (and the whole `tool/flutter.sh test` if time allows). `analyze` may report issues from the other streams' uncommitted work — separate those from yours and say so.

## 9. Docs to write

**`backend/CLAUDE.md`**

- Amend the cost rule. Under "Cost rule: AI never runs on the request path" there is the parenthetical "(The one exception is **AI chat**, below — a person is waiting for a reply and pays for it from their own wallet.)": name the readers' own-mantra flow as a second exception — a person is waiting, and it is capped per user per day rather than paid from the wallet (confirm `complete()` first, section 3).
- Add a section headed exactly **"Readers' own mantras"** (the schema comment points to it): why `services/user-mantra.js` is a service (the controller and the worker job share it); the flow; the layered well-known rule and the exclusion of living persons; deities and gurus created **unpublished**; the limits and `config/mantra-own.js`; suggestions held in Redis for an hour; the visibility rule (`visibleTo`, `isPublished` stays false while private); promotion at 11 (the upload is dropped, every language is queued); the picture rule; the new error codes going out in English by design (no `locales/*.json` id — the app words them by code); the admin guard at `controllers/admin/mantra.js:194` and the reel guard at `controllers/app/reel-make.js:87`; the tests `npm run test:mantra-own` and `node --test test/mantra-own.test.js`.
- One line in "Sharing, deep links and refer and earn": a private mantra is refused (`services/share.js` requires `isPublished`).

**`app/CLAUDE.md`** — a feature section: the flow and files; the rule that no string says "AI"; failures worded by code (410 / 413 by `statusCode`); the saved copies wiped and the providers invalidated after a change; the picture cache key (the URL minus its query); `isPrivate` hides Share; the route order (`/mantras/add` before `/mantras/:slug`); the tests; not run on a device; the 11 translations are AI-drafted.

**Root `CLAUDE.md`** — one row in the Status table, as a targeted Edit with a unique anchor (read the table first; the file already carries other streams' uncommitted edits). Draft, to be made true to what is finished: "**Readers' own mantras (Jap tab)** — Built on the backend and verified (`npm run test:mantra-own`, 146 checks, provider faked); the app side is written, analysed and tested but not run on a phone, and nothing has run against a real AI provider. A reader types or says a mantra that is not in the catalogue; the server sends it as entered to the model, which suggests mantras of well-known deities and saints only; the reader picks up to 5; each is written out in the catalogue's shape, saved `PRIVATE` to the readers who hold it, given a public web picture (no image generation) and written in their reading language. Someone else asking for the same mantra shares it; at 11 readers it becomes `PUBLIC` in every language. Deities and gurus we do not hold are created unpublished for an admin to review. **Production needs `prisma migrate deploy` for `20261104000000_user_mantras`** (the seed is not involved). See 'Readers' own mantras' in backend/CLAUDE.md and app/CLAUDE.md."

## 10. Known limitations (state them in the docs and in the final report)

- The model-drafted Sanskrit and translations have not been read by a native speaker; the 11 app translations of the new strings are AI-drafted too.
- Picture credit is not tracked, and Wikimedia Commons pictures are hotlinked.
- "Well-known" is the model's judgment plus the prompt and parse rules; it cannot be fully verified. Living persons are excluded by the prompt only.
- The admin panel UI was not updated for the new fields (reviewing the unpublished deities and gurus, seeing private mantras). The website was not changed.
- `matchKey` goes stale after an admin edits a mantra's transliteration.
- Auto-created deities and gurus are unpublished, with no picture and no `nameI18n`; a duplicate spelling of an existing one is possible.
- An admin cannot hide a bad private mantra except by deleting it.
- The reel-make guard (`controllers/app/reel-make.js:87`) is not covered by the e2e.
- Nothing has been run against a real AI provider; the model is faked in the tests. The app has not been run on a device.
- Production needs `prisma migrate deploy` for `20261104000000_user_mantras`.
- Pre-existing, not from this work: `test:mantra-mala` fails 3 of 27 checks (the S3 staging path, section 3), and `test:admin-users` needs the websocket server on :4001.

## 11. The final report must say

- What was built and what was verified, plainly: the e2e 146/146, the unit suites and the regression suites (section 3), and the real Flutter `analyze` / `test` results — including any failure, with its output.
- **That a Deity or Guru the model names but we do not hold is created unpublished, for an admin to review, add a picture to and publish — and offer to flip them to published.**
- The limitations in section 10, briefly, and the two pre-existing failures.
- That nothing was committed.
- Do not cite the code-graph MCP tools. Keep it short; the user wants speed.

## 12. Environment and gotchas

- Primary working directory may be the repo root or `app/`; give `cd` explicitly. Backend commands run from `backend/`.
- The working tree holds many uncommitted changes from **other work streams** (all 12 ARBs, the generated l10n files, `api_paths.dart`, `storage_keys.dart`, `sadhana_tab.dart`, `chant_view.dart`, `chat_view.dart`, `app.dart`, the root `CLAUDE.md`, `admin/*` and more). Make targeted edits; never revert or reformat them.
- My backend work is uncommitted too (section 3). Don't `git add -A` blindly.
- macOS has no `timeout`; foreground `sleep` is blocked (use `run_in_background`). In zsh, quote globs (`--include='*.dart'`). In ugrep use `-E`, not `\|`.
- Local Node is v20.19.2: run backend unit tests one file at a time with `node --test <file>`.
- The regression e2e suites need the API running with blank AWS and AI keys.
- Backend rules (`backend/CLAUDE.md`): ESM only, relative imports carry `.js`; server errors shown to readers are localized through `utils/messages.js` and `locales/*.json` (a message with no rule goes out in English; adding a message needs an id in every `locales/*.json`, and `test/messages.test.js` enforces it).
- Fallback for anything missing here: the first chat's transcript is at `/Users/teja/.claude/projects/-Users-SSS-Jay-Jay-Ram-Krishna-Hari-app-hariharibol/b9362fdb-7d9b-4635-a2be-9e48718c443f.jsonl`.
