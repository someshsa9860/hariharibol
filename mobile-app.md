# Mobile App — Flutter (iOS + Android)

> **Purpose:** The primary product surface — what end devotees experience. Must feel calm, premium, devotional, and trustworthy. Performance and offline-friendliness matter because devotees use this in temples, on travel, during chanting.

> **Platforms:** iOS 15+, Android 8+ (API 26+)
> **Special:** iOS 26+ uses glassmorphism components; Android uses Material 3 equivalents.

---

## Tech Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | **Flutter 3.27+** | Stable channel |
| Language | Dart 3.6+ | Sound null safety, records, patterns |
| Architecture | **Clean Architecture** | presentation / domain / data layers |
| State Management | **Riverpod 2.x** | Type-safe, testable, no boilerplate |
| Routing | **go_router** | Declarative, deep links, auth guards |
| HTTP Client | **Dio** | Interceptors, retry, refresh-on-401 |
| Local Storage | **Hive** + `flutter_secure_storage` | Hive for cache, secure for tokens |
| Real-time | **socket_io_client** | Group chat |
| Auth | `google_sign_in` + `sign_in_with_apple` | |
| i18n | `flutter_intl` + `intl` | Generated typed accessors |
| JSON | `freezed` + `json_serializable` | Immutable models, copyWith |
| DI | Riverpod providers | No separate DI lib needed |
| Push | `firebase_messaging` (FCM + APNs via FCM) | |
| Analytics | `firebase_analytics` or PostHog | |
| Crash | `firebase_crashlytics` or Sentry | |
| AI Streaming | Custom SSE client over Dio | |
| Audio | `just_audio` + `audio_service` | Background playback |
| Images | `cached_network_image` | |
| Animations | Built-in + `flutter_animate` | |
| Glass effect (iOS 26+) | Native via platform channels OR `BackdropFilter` polyfill | |
| Linting | `flutter_lints` + custom rules | |
| Testing | `flutter_test` + `mocktail` + `patrol` for E2E | |

---

## Folder Structure

```
mobile_app/
├── lib/
│   ├── main.dart                            # Entry point
│   ├── app.dart                             # MaterialApp.router setup
│   │
│   ├── core/
│   │   ├── config/
│   │   │   ├── app_config.dart              # Env-aware config
│   │   │   ├── flavors.dart                 # dev/staging/prod
│   │   │   └── constants.dart
│   │   │
│   │   ├── theme/
│   │   │   ├── app_theme.dart               # Light + dark
│   │   │   ├── app_colors.dart              # Devotional palette
│   │   │   ├── app_typography.dart
│   │   │   ├── app_spacing.dart
│   │   │   └── app_shadows.dart
│   │   │
│   │   ├── routing/
│   │   │   ├── app_router.dart              # go_router config
│   │   │   ├── route_paths.dart
│   │   │   └── auth_guard.dart
│   │   │
│   │   ├── network/
│   │   │   ├── api_client.dart              # Dio setup
│   │   │   ├── interceptors/
│   │   │   │   ├── auth_interceptor.dart
│   │   │   │   ├── refresh_interceptor.dart
│   │   │   │   ├── device_id_interceptor.dart
│   │   │   │   └── error_interceptor.dart
│   │   │   └── api_exceptions.dart
│   │   │
│   │   ├── storage/
│   │   │   ├── secure_storage.dart          # Tokens, sensitive
│   │   │   ├── hive_storage.dart            # Cache
│   │   │   └── device_id_provider.dart      # Persistent device ID
│   │   │
│   │   ├── error/
│   │   │   ├── failure.dart                 # Domain failures
│   │   │   └── error_mapper.dart
│   │   │
│   │   ├── utils/
│   │   │   ├── extensions/
│   │   │   ├── formatters.dart
│   │   │   └── validators.dart
│   │   │
│   │   └── widgets/                         # Truly shared widgets
│   │       ├── glass/                       # Glassmorphism (iOS 26+)
│   │       │   ├── glass_card.dart
│   │       │   ├── glass_tab_bar.dart
│   │       │   └── glass_app_bar.dart
│   │       ├── adaptive/                    # iOS/Android adaptive
│   │       │   ├── adaptive_card.dart
│   │       │   └── adaptive_button.dart
│   │       ├── verse_card.dart
│   │       ├── mantra_card.dart
│   │       ├── sampraday_tile.dart
│   │       ├── loading_shimmer.dart
│   │       ├── empty_state.dart
│   │       ├── error_view.dart
│   │       └── devotional_image.dart        # Cached + placeholder
│   │
│   ├── features/                            # Feature-first organization
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   ├── datasources/
│   │   │   │   │   └── auth_remote_datasource.dart
│   │   │   │   ├── models/
│   │   │   │   │   └── user_model.dart
│   │   │   │   └── repositories/
│   │   │   │       └── auth_repository_impl.dart
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   │   └── user.dart
│   │   │   │   ├── repositories/
│   │   │   │   │   └── auth_repository.dart
│   │   │   │   └── usecases/
│   │   │   │       ├── sign_in_with_google.dart
│   │   │   │       ├── sign_in_with_apple.dart
│   │   │   │       ├── sign_out.dart
│   │   │   │       └── delete_account.dart
│   │   │   └── presentation/
│   │   │       ├── providers/
│   │   │       │   └── auth_provider.dart
│   │   │       ├── pages/
│   │   │       │   ├── splash_page.dart
│   │   │       │   ├── login_page.dart
│   │   │       │   └── language_select_page.dart
│   │   │       └── widgets/
│   │   │           ├── google_sign_in_button.dart
│   │   │           └── apple_sign_in_button.dart
│   │   │
│   │   ├── home/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │       ├── pages/
│   │   │       │   ├── home_page.dart
│   │   │       │   └── verse_detail_page.dart
│   │   │       ├── providers/
│   │   │       └── widgets/
│   │   │           ├── verse_of_day_hero.dart
│   │   │           ├── category_section.dart
│   │   │           ├── narration_card.dart
│   │   │           └── followed_sampraday_section.dart
│   │   │
│   │   ├── chatbot/                         # GuruDev
│   │   │   ├── data/
│   │   │   │   └── sse_client.dart
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │       ├── pages/
│   │   │       │   ├── chatbot_page.dart
│   │   │       │   ├── chat_session_page.dart
│   │   │       │   └── chat_history_page.dart
│   │   │       └── widgets/
│   │   │           ├── message_bubble.dart
│   │   │           ├── typing_indicator.dart
│   │   │           ├── citation_chip.dart
│   │   │           ├── suggested_prompts.dart
│   │   │           └── guru_avatar.dart
│   │   │
│   │   ├── chanting/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │       ├── pages/
│   │   │       │   ├── chanting_page.dart           # Sampraday grid
│   │   │       │   ├── sampraday_detail_page.dart
│   │   │       │   ├── mantra_detail_page.dart
│   │   │       │   ├── chant_counter_page.dart      # Full-screen counter
│   │   │       │   └── chant_history_page.dart
│   │   │       └── widgets/
│   │   │           ├── sampraday_grid_tile.dart
│   │   │           ├── mantra_player.dart
│   │   │           ├── chant_counter_widget.dart
│   │   │           ├── mala_progress.dart
│   │   │           └── streak_badge.dart
│   │   │
│   │   ├── books/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │       ├── pages/
│   │   │       │   ├── books_library_page.dart
│   │   │       │   ├── book_reader_page.dart
│   │   │       │   ├── chapter_list_page.dart
│   │   │       │   └── verse_reader_page.dart
│   │   │       └── widgets/
│   │   │           ├── book_card.dart
│   │   │           ├── reader_settings_sheet.dart
│   │   │           ├── verse_navigator.dart
│   │   │           └── bookmark_button.dart
│   │   │
│   │   ├── sampradayas/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │       ├── pages/
│   │   │       │   └── sampraday_detail_page.dart
│   │   │       └── widgets/
│   │   │           ├── disciple_card.dart
│   │   │           ├── deity_hero.dart
│   │   │           └── follow_button.dart
│   │   │
│   │   ├── groups/
│   │   │   ├── data/
│   │   │   │   └── socket_client.dart
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │       ├── pages/
│   │   │       │   ├── groups_list_page.dart
│   │   │       │   └── group_chat_page.dart
│   │   │       └── widgets/
│   │   │           ├── chat_message.dart
│   │   │           ├── chat_input.dart
│   │   │           ├── hidden_message_indicator.dart
│   │   │           └── member_list_sheet.dart
│   │   │
│   │   ├── verses/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   └── presentation/
│   │   │       └── widgets/
│   │   │           ├── sanskrit_text.dart
│   │   │           ├── translation_text.dart
│   │   │           ├── word_meanings_panel.dart
│   │   │           └── share_verse_image.dart      # Generates branded image
│   │   │
│   │   ├── favorites/
│   │   │   └── presentation/
│   │   │       └── pages/
│   │   │           └── favorites_page.dart
│   │   │
│   │   ├── profile/
│   │   │   └── presentation/
│   │   │       ├── pages/
│   │   │       │   └── profile_page.dart
│   │   │       └── widgets/
│   │   │           ├── stats_grid.dart
│   │   │           └── followed_list.dart
│   │   │
│   │   ├── settings/
│   │   │   └── presentation/
│   │   │       ├── pages/
│   │   │       │   ├── settings_page.dart
│   │   │       │   ├── language_page.dart
│   │   │       │   ├── theme_page.dart
│   │   │       │   ├── notifications_page.dart
│   │   │       │   ├── about_page.dart
│   │   │       │   ├── privacy_policy_page.dart
│   │   │       │   └── delete_account_page.dart
│   │   │
│   │   └── shell/
│   │       └── presentation/
│   │           └── pages/
│   │               └── main_shell_page.dart        # Bottom nav scaffold
│   │
│   ├── l10n/
│   │   ├── intl_en.arb                             # Source language
│   │   ├── intl_hi.arb
│   │   ├── intl_gu.arb
│   │   ├── intl_mr.arb
│   │   └── ... (generated app_localizations.dart)
│   │
│   └── shared/
│       ├── providers/                              # Shared Riverpod providers
│       │   ├── locale_provider.dart
│       │   ├── theme_provider.dart
│       │   └── connectivity_provider.dart
│       └── models/                                 # Shared models
│
├── assets/
│   ├── images/
│   │   ├── splash_logo.png
│   │   ├── deity_placeholders/
│   │   └── sampraday_thumbnails/
│   ├── fonts/
│   │   ├── NotoSansDevanagari/
│   │   ├── Inter/
│   │   └── Sanskrit2003/
│   ├── audio/
│   │   └── default_chime.mp3
│   └── icons/
│
├── ios/
│   ├── Runner/
│   │   ├── Info.plist                              # Permissions, URL schemes
│   │   ├── AppDelegate.swift                       # Glass effect bridge
│   │   └── GlassEffectPlugin.swift                 # Native iOS 26 glass
│   └── Podfile
│
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   └── kotlin/.../MainActivity.kt
│   │   └── build.gradle
│   └── build.gradle
│
├── test/                                           # Unit + widget tests
│   └── features/
├── integration_test/                               # Patrol E2E
├── pubspec.yaml
├── analysis_options.yaml
├── l10n.yaml                                       # i18n config
└── README.md
```

---

## Architecture: Clean + Riverpod

### Layers

**Presentation** — Pages, widgets, Riverpod providers (UI state)
**Domain** — Entities, repository interfaces, use cases (pure Dart, no dependencies)
**Data** — Models (with JSON), data sources (remote/local), repository implementations

### Data Flow Example (fetching verse of the day)

```
HomePage
  ↓ watch
verseOfDayProvider (Riverpod)
  ↓ calls
GetVerseOfDayUseCase
  ↓ calls
VerseRepository (interface)
  ↓ implemented by
VerseRepositoryImpl
  ↓ uses
VerseRemoteDataSource → ApiClient (Dio) → Backend
                  +
VerseLocalDataSource → Hive (cache)
```

### Why Riverpod
- Compile-time safety
- Easy testing (`overrideWith` for mocks)
- No `BuildContext` required
- Auto-disposal
- Family for parameterized providers

---

## Screens (Detailed)

### 1. Splash (`/splash`)
- Devotional logo animation (subtle, ~1.5s)
- Bootstraps: load locale, check auth, fetch translations cache
- Routes to: `/login` (no auth) or `/` (authed)

### 2. Login (`/login`)
- Background: subtle devotional imagery (no specific deity to stay neutral) or simple gradient
- App name + tagline
- **Google Sign-In** button (full-width, prominent)
- **Apple Sign-In** button (iOS only, required by App Store)
- Privacy policy + terms links (small, bottom)
- **No email/password, no extra fields** — fast login per requirement

### 3. Language Select (`/language-select`)
- Shown ONCE on first launch (skippable)
- Grid of supported languages with native name
- "Continue in [device language]" if detected
- Saves to user profile

### 4. Main Shell (`/`)
Persistent bottom nav with 4 tabs:
- 🏠 **Home**
- 💬 **GuruDev**
- 📿 **Chanting**
- 📖 **Read** *(recommended 4th tab)*
- (Profile accessed via topbar avatar, not a tab)

iOS 26+ tab bar uses native glass effect. Older iOS + Android use opaque/blurred standard tab bars.

### 5. Home Tab (`/`)
**Sections (vertical scroll):**

1. **Personal greeting** — "Hare Krishna, Rajesh 🙏" or sampraday-appropriate greeting based on user affinity
2. **Verse of the Day Hero** — large card with:
   - Sanskrit (Devanagari)
   - Transliteration
   - Translation in user's language
   - Source: Bhagavad Gita 2.47
   - Tap → verse detail
   - Actions: ❤️ favorite, 📤 share-as-image, 🔊 play recitation
3. **Quick Chant FAB** — floating button (bottom right above tab bar) → opens chant counter for last-used mantra
4. **Categories** — horizontal scroll of category chips: Devotion, Knowledge, Surrender, Dharma, Stories...
5. **Verses by category** — sections for each (Devotion, Knowledge, etc.) with horizontal verse cards
6. **From your sampradayas** — once user follows any sampraday: featured verses, narrations, mantras from that tradition
7. **Today's wisdom** — short narration excerpt from a saint
8. **Suggested mantras** — based on affinity
9. **Pull-to-refresh** — fetches new content

### 6. Verse Detail (`/verse/:id`)
- Full screen, scrollable
- **Top:** Sanskrit (large, Noto Sans Devanagari)
- Transliteration (italic)
- Translation in user's language
- "Word meanings" expandable section
- **Source attribution:** Bhagavad Gita, Chapter 2, Verse 47 (tap to open in book reader)
- **Narrations section:** cards from saints — Shankaracharya, Ramanuja, Madhva, Prabhupada, etc. — with attribution
- **Action bar (bottom, glass on iOS 26+):** Favorite | Share image | Play audio | Open in book

### 7. GuruDev Tab — Chat List (`/chatbot`)
- **Top:** GuruDev avatar + name (dynamic, reflects user's affinity — e.g., displays as "Acharya GuruDev" or just "GuruDev" with a sampraday-appropriate visual aesthetic)
- "New conversation" button
- List of past sessions (title auto-generated from first message)
- Empty state: friendly intro to GuruDev with what they can ask

### 8. GuruDev Chat Session (`/chatbot/session/:id`)
- Standard chat UI
- **User messages:** right-aligned bubbles
- **GuruDev messages:** left-aligned, with avatar
- **Streaming responses** — text appears word-by-word (SSE)
- **Citation chips** below GuruDev messages — tap to open referenced verse
- **Suggested follow-up prompts** at the bottom (3 chips)
- **Input bar:** text field + send button (glass on iOS 26+)
- **Disclaimer at top of every new chat:** "GuruDev provides spiritual guidance based on scriptures. For personal/medical/legal matters, consult appropriate professionals."

### 9. Chanting Tab (`/chanting`)
- **Hero section:** "Today's chants: 432 / 1080" with progress + streak badge
- **Sampraday grid** — 2-column grid, square tiles, each with:
  - Hero image (deity or symbol)
  - Sampraday name
  - "Following" badge if followed
  - Member count (subtle)
- Tap → sampraday detail

### 10. Sampraday Detail (`/sampraday/:slug`)
- **Hero:** large deity image with subtle parallax
- **Sampraday name** (large) + short description
- **Follow button** (sticky at bottom while scrolling)
- **About section:** founder (with image), founding region, primary deity, philosophy
- **Key disciples** horizontal scroll
- **Public mantras** list — tap to mantra detail
- **Group** — "Join community group" button (if following)
- **Related verses** — verses tagged for this sampraday

### 11. Mantra Detail (`/mantra/:id`)
- Mantra Sanskrit (very large, Noto Sans Devanagari)
- Transliteration
- Meaning
- Significance
- **Audio player** — recitation (if available) with play/pause/loop
- **Start chanting** button (large, primary) → opens chant counter

### 12. Chant Counter (`/chant/:mantraId`) — Full-screen
- Mantra Sanskrit (top, smaller)
- **Huge tap target** in center — entire screen taps increment count
- **Mala visualization** — 108 beads, fills as you chant
- Current count + total session
- **Goal indicator** — e.g. "12 / 108"
- Streak badge
- Vibration/haptic on each tap (subtle)
- **Bottom controls:** Pause | Reset | Done (saves session)
- Auto-save every 10 counts (don't lose progress on crash)
- Background timer continues if user switches apps briefly

### 13. Chant History (`/chanting/history`)
- Tabs: Today | Week | Month | All Time
- **Stats:** total chants, total time, top mantra, streak
- **Calendar view** — heatmap (like GitHub contributions) showing days chanted
- **Per-mantra breakdown** — list of mantras with counts

### 14. Read Tab — Library (`/books`)
- **Header:** "Sacred Texts"
- Grid of books with cover images: Bhagavad Gita, Srimad Bhagavatam (at launch)
- Each card: cover, title, "X% read" progress bar
- Tap → book reader

### 15. Book Reader (`/books/:slug`)
- **Top app bar:** title, settings icon (font size, theme, language toggle)
- **Chapter selector** (top) — horizontal scroll of chapter numbers
- **Verse-by-verse layout:**
  - Chapter title at top
  - For each verse: number, Sanskrit, transliteration, translation
  - Tap verse → verse detail (with narrations)
- **Bookmark icon** per verse (long-press)
- **Reader settings sheet:** font size slider, line spacing, light/sepia/dark, language switcher
- **Bottom bar:** Previous chapter | Verse navigator | Next chapter
- **Resume reading:** auto-saves last position per book

### 16. Group Chat (`/groups/:id`)
- **Top app bar:** Group name, sampraday name, member count, info icon
- **Message list** (newest at bottom):
  - Sender avatar + name (small)
  - Message bubble
  - Timestamp
  - Hidden message indicator (only sender sees: "This message was hidden — please follow community guidelines")
- **Input bar (bottom, glass on iOS 26+):** text field, send button
- **Optimistic UI:** message appears immediately as "sending", confirmed once moderation passes
- **Long-press message:** Report (option appears)
- **Member list:** sheet from info icon

### 17. Favorites (`/profile/favorites`)
- Tabs: Verses | Mantras | Narrations
- List view with quick-access cards
- Search within favorites

### 18. Profile (`/profile`)
- **Header:** avatar, name, "joined X months ago"
- **Stats grid:** Verses favorited | Total chants | Streak | Sampradayas followed
- **Followed sampradayas** — horizontal scroll
- **Favorite verses** — last 3 + "view all"
- **Settings** access

### 19. Settings (`/settings`)
- **Sections:**
  - Account: name, email (read-only), sign out, **delete account**
  - Language (`/settings/language`)
  - Theme (`/settings/theme`) — System / Light / Dark
  - Notifications (`/settings/notifications`) — toggles for verse-of-day, group activity, etc.
  - Privacy Policy
  - Terms of Service
  - About
  - App version (small, bottom)

### 20. Language Settings (`/settings/language`)
- List of all active languages with native names
- Tap to switch — entire app re-renders immediately in new language
- All dynamic content (verses, narrations, sampradayas) refetched in new language

---

## Critical Implementation Details

### 1. Device ID Persistence
```dart
// On first launch, generate UUID v4
// Store in flutter_secure_storage (NOT shared_preferences — survives app uninstall on iOS via keychain)
// On Android: combination of secure storage + Android ID hash for resilience
// Send as X-Device-ID header on every API request
```

**Important:** Device ID must NOT be cleared on logout. It persists across logout/login on the same device.

### 2. Glass Effect (iOS 26+)
```dart
// Detect iOS 26+ via Platform check
// Method 1: Native iOS via platform channel (preferred for true glass)
//   - Wrap Flutter view in UIVisualEffectView with .systemThinMaterial / .systemUltraThinMaterial
//   - Expose as Flutter widget via PlatformView
// Method 2: Flutter polyfill (fallback)
//   - BackdropFilter with ImageFilter.blur
//   - Semi-transparent overlay
//   - Tinted border

// Used in: tab bar, app bars, action bars, modal sheets
// Android: Material 3 elevated surfaces (no glass mimicry — looks fake)
```

### 3. Dynamic Localization (Whole-App Reload)
```dart
// LocaleProvider (Riverpod StateProvider)
// On change:
//   1. Update locale state
//   2. Persist to backend (PATCH /users/me)
//   3. Persist to Hive (offline)
//   4. Invalidate ALL content providers (verses, sampradayas, narrations, mantras)
//   5. Refetch with new lang param
//   6. App rebuilds via Localizations.override
```

### 4. AI Chat Streaming (SSE)
```dart
// Custom Dio interceptor for SSE
// Stream response chunks → append to current message
// Handle reconnection on network blip
// Show typing indicator until first token arrives
// Citations parsed from response and displayed as chips
```

### 5. Offline-First Where It Matters
- Favorites — stored in Hive, synced to backend
- Last viewed verses — cached
- Chant logs — queued locally if offline, synced when online
- Verse-of-the-day — cached for the day
- Sampraday list + details — cached, refreshed weekly

### 6. Image Caching
- Use `cached_network_image` everywhere
- Placeholder: subtle devotional pattern (not a generic loading spinner)
- Pre-cache hero images on home screen for smooth scroll

### 7. Auth Token Refresh
```dart
// RefreshInterceptor in Dio
// On 401: try refresh once with refresh token
// On refresh success: retry original request
// On refresh failure: clear tokens, route to /login
// Mutex to prevent multiple simultaneous refreshes
```

### 8. Push Notifications
- Verse of the day (scheduled)
- New narration on followed sampraday
- Group activity (high-engagement messages)
- Streak reminders (gentle, not nagging)
- All controllable in settings

### 9. Share-as-Image
- Render verse to a Flutter widget off-screen with branded background
- Convert to PNG via `RepaintBoundary` + `toImage()`
- Share via `share_plus`
- Templates: minimal, ornate, full-bleed deity background

### 10. Audio Player
- `just_audio` for playback
- `audio_service` for background + lock screen controls
- Loop mantra recitation for chanting sessions
- Auto-pause on phone call

---

## Theme System

### Colors

**Primary palette:** Saffron + Krishna blue + cream
```dart
class AppColors {
  // Light theme
  static const saffron = Color(0xFFFF7E00);
  static const saffronDeep = Color(0xFFD96100);
  static const krishnaBlue = Color(0xFF1A4D8F);
  static const krishnaBlueDeep = Color(0xFF0D2B5C);
  static const cream = Color(0xFFFFF8EC);
  static const goldAccent = Color(0xFFD4A04C);

  // Dark theme
  static const darkBg = Color(0xFF0A0A0F);
  static const darkSurface = Color(0xFF15151E);
  static const darkSaffron = Color(0xFFFFA040); // adjusted for dark
}
```

### Typography
- **Sanskrit/Devanagari:** Noto Sans Devanagari (free, comprehensive)
- **Latin (UI + transliteration):** Inter (clean, modern, devotional-neutral)
- **Display headers (occasional):** Cormorant or Playfair (elegant serif, used sparingly)

### Spacing scale
```dart
class AppSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
  static const xxl = 48.0;
}
```

### Animation principles
- Subtle, never flashy (devotional context)
- Standard duration: 250ms
- Curves: `Curves.easeOutCubic` for entries, `Curves.easeIn` for exits
- Hero transitions for verse cards → detail
- No bouncy/playful animations

---

## Task List (Priority Order)

### 🔴 P0 — Foundation
1. Initialize Flutter project with flavors (dev/staging/prod)
2. Set up folder structure (clean architecture)
3. Configure `analysis_options.yaml` with strict lints
4. Add core dependencies (Riverpod, go_router, Dio, Hive, freezed, intl)
5. Set up Riverpod with `ProviderScope`
6. Configure go_router with shell route for bottom nav
7. Theme module (colors, typography, spacing, light + dark)
8. Build glass widgets (with iOS 26+ detection + fallback)
9. Adaptive widgets (iOS Cupertino vs Material)
10. App config + env handling

### 🔴 P0 — Networking
11. Dio client with base URL from config
12. AuthInterceptor (attaches Bearer token)
13. DeviceIdInterceptor (attaches X-Device-ID)
14. RefreshInterceptor (handles 401 with refresh token)
15. ErrorInterceptor (maps to domain Failures)
16. SSE client for chatbot streaming

### 🔴 P0 — Storage
17. SecureStorage wrapper (tokens, device ID)
18. Hive setup with type adapters
19. Device ID generation + persistence
20. Token storage + retrieval

### 🔴 P0 — i18n
21. Set up `flutter_intl` + `l10n.yaml`
22. Create `intl_en.arb` with all UI strings
23. LocaleProvider (Riverpod)
24. Locale persistence (Hive + backend sync)
25. Dynamic locale switching with content invalidation
26. Add Hindi, Gujarati, Marathi ARBs (initial set)

### 🔴 P0 — Auth Feature
27. Auth domain (entities, repository interface, use cases)
28. Auth data (models, remote datasource, repository impl)
29. Auth provider (Riverpod)
30. Splash page (bootstraps app)
31. Login page with Google + Apple buttons
32. Google Sign-In integration (configure iOS + Android)
33. Apple Sign-In integration (configure iOS entitlements)
34. Token storage on success
35. Auth state listener for routing
36. Sign out flow
37. Delete account flow (with confirmation)
38. Language select page (first launch)

### 🔴 P0 — Main Shell
39. Bottom nav scaffold with 4 tabs
40. Glass tab bar (iOS 26+) with fallback
41. Tab persistence (return to last sub-route per tab)
42. Floating "Quick Chant" FAB

### 🔴 P0 — Home Tab
43. Home page layout
44. Verse of the day hero card
45. Categories horizontal scroll
46. Verses by category sections (lazy-loaded)
47. Followed sampraday section
48. Today's wisdom card
49. Pull-to-refresh
50. Loading shimmers
51. Empty state for new users (no follows yet)

### 🔴 P0 — Verse Detail
52. Verse detail page layout
53. Sanskrit text rendering (Noto Sans Devanagari)
54. Translation rendering with reading-friendly typography
55. Word meanings expandable section
56. Narrations list with saint attribution
57. Action bar (favorite, share, audio, open in book)
58. Favorite toggle with optimistic UI
59. Share as image generator (3 templates)

### 🔴 P0 — Sampraday Feature
60. Sampraday list grid
61. Sampraday detail page with hero
62. Follow button with state management
63. Disciples horizontal scroll
64. Public mantras list
65. Related verses

### 🔴 P0 — Chanting Tab
66. Chanting page with stats hero
67. Sampraday grid (reused from chanting tab)
68. Mantra detail page
69. Audio player for mantra recitation
70. Chant counter full-screen page
71. Tap-to-count with haptic feedback
72. Mala visualization (108 beads filling)
73. Goal tracking
74. Auto-save every 10 counts
75. Chant log API integration
76. Chant history page with calendar heatmap

### 🔴 P0 — GuruDev Chat
77. Chat sessions list page
78. Dynamic GuruDev name + avatar (based on affinity)
79. Chat session page with message bubbles
80. SSE streaming integration
81. Typing indicator
82. Message bubble (user vs GuruDev styles)
83. Citation chips → tap opens verse detail
84. Suggested prompts row
85. Input bar with send button
86. Conversation history persistence
87. Delete conversation flow
88. Disclaimer banner

### 🟠 P1 — Read Book Tab
89. Books library page
90. Book reader page with chapter selector
91. Verse-by-verse layout in reader
92. Reader settings sheet (font size, theme, language)
93. Bookmark per verse
94. Reading progress tracking + resume
95. Tap verse → verse detail integration

### 🟠 P1 — Groups
96. Groups list page (per followed sampraday)
97. Group chat page with message list
98. Socket.IO client integration
99. Real-time message receive
100. Send message with optimistic UI
101. Hidden message indicator (sender-only)
102. Long-press to report message
103. Member list bottom sheet

### 🟠 P1 — Profile & Settings
104. Profile page with stats
105. Followed sampradayas section
106. Recent favorites preview
107. Settings page with sections
108. Language settings page
109. Theme settings page (system/light/dark)
110. Notifications settings page
111. Privacy policy page
112. Terms of service page
113. About page

### 🟠 P1 — Notifications
114. Firebase setup (iOS + Android)
115. Push token registration on login
116. Foreground notification handling
117. Background notification handling
118. Deep link from notification (verse → verse detail, group msg → chat)
119. Notification settings (granular toggles)

### 🟠 P1 — Favorites
120. Favorites page with tabs (verses/mantras/narrations)
121. Search within favorites
122. Offline favorites cache

### 🟠 P1 — Polish
123. Loading shimmers for all async sections
124. Error views with retry
125. Empty states (designed, not generic)
126. Hero transitions (verse card → detail)
127. Page transitions (subtle, devotional)
128. Haptic feedback on key interactions

### 🟡 P2 — Quality
129. Unit tests for use cases
130. Widget tests for critical screens (Home, Chat, Chanting)
131. Integration tests with Patrol (login flow, chanting flow)
132. Accessibility audit (VoiceOver + TalkBack)
133. Performance profiling (jank detection)
134. App size optimization (tree-shake icons, optimize assets)

### 🟡 P2 — Advanced
135. Offline mode banner
136. Sync queue for offline actions (chant logs, favorites)
137. App lifecycle handling (pause chant timer on background)
138. Background audio service for mantras
139. Lock-screen audio controls
140. iOS Live Activity for chanting session
141. Home screen widget — verse of the day (iOS + Android)
142. Apple Watch chant counter (companion app)
143. Wear OS chant counter

### 🟢 P3 — Future
144. Tablet-optimized layouts
145. iPad split view
146. macOS support (Catalyst)
147. Live discourse streaming
148. Donation/seva flow
149. Calendar integration (festivals, ekadashi)

---

## Build & Release

### Flavors
- `dev` — points to local backend, debug logging
- `staging` — staging backend, beta testers
- `prod` — production backend, release signing

### iOS Setup
- Bundle ID: `com.[brand].sanatan` (replace [brand])
- Capabilities: Sign in with Apple, Push Notifications, Background Modes (audio)
- Info.plist permissions: notifications, optional camera (for profile)
- Privacy manifest (required by Apple): declare data collection categories

### Android Setup
- Application ID: `com.[brand].sanatan`
- Min SDK: 26 (Android 8.0)
- Target SDK: latest stable
- Permissions: INTERNET, POST_NOTIFICATIONS, FOREGROUND_SERVICE (audio)
- Signing: keystore in CI secrets

### CI/CD
- GitHub Actions workflow:
  - On PR: lint, test, build (no upload)
  - On main merge: build dev + staging, distribute to internal testers via Firebase App Distribution
  - On tag: build prod, upload to App Store Connect (TestFlight) + Play Console (internal track), manual promotion to production

---

## Performance Targets
- **Cold start:** < 2.5s on iPhone 13 / Pixel 7
- **Tab switch:** < 100ms (instant feel)
- **API call (cached):** < 50ms
- **API call (network):** < 600ms p50
- **List scroll:** 60fps minimum, 120fps on capable devices
- **App size:** < 50MB download (excluding optional audio packs)
- **Memory:** < 150MB typical use

## Accessibility
- All tap targets >= 44pt (iOS) / 48dp (Android)
- VoiceOver / TalkBack labels on all interactive elements
- Dynamic Type support on iOS, font scaling on Android
- High contrast mode support
- Devanagari text scaling tested with various font sizes
- No reliance on color alone for state communication

---

## Environment Setup Checklist (for new dev)
1. Install Flutter 3.27+ stable
2. Install Xcode 16+ (iOS 26 SDK)
3. Install Android Studio + SDK 35
4. Run `flutter doctor` — all green
5. `flutter pub get`
6. Set up `.env.dev` with backend URL + keys
7. iOS: `cd ios && pod install`
8. Run: `flutter run --flavor dev -t lib/main_dev.dart`

---

*Document version: 1.0 — Last updated: April 27, 2026*
