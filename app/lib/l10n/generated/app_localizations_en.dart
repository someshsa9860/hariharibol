// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'HariHariBol';

  @override
  String get splashTagline => 'Read · Chant · Practice';

  @override
  String get actionRetry => 'Try again';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionOk => 'OK';

  @override
  String get actionDone => 'Done';

  @override
  String get actionSave => 'Save';

  @override
  String get actionViewAll => 'View all';

  @override
  String get actionSignOut => 'Sign out';

  @override
  String get actionDeleteAccount => 'Delete account';

  @override
  String get actionContinue => 'Continue';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';

  @override
  String get errorNetwork =>
      'No connection. Check your internet and try again.';

  @override
  String get errorTimeout => 'That took too long. Please try again.';

  @override
  String get errorSessionExpired =>
      'Your session has ended. Please sign in again.';

  @override
  String get errorSignIn => 'We could not sign you in. Please try again.';

  @override
  String get errorInsecureConnection => 'The connection is not secure.';

  @override
  String get errorCancelled => 'Request cancelled.';

  @override
  String get errorEmptyTitle => 'Nothing here yet';

  @override
  String get errorRouteNotFound => 'That screen does not exist.';

  @override
  String get actionGoHome => 'Go to home';

  @override
  String get signInTitle => 'Welcome';

  @override
  String get signInSubtitle =>
      'Read, chant and keep your daily practice in one place.';

  @override
  String get signInWithGoogle => 'Continue with Google';

  @override
  String get signInWithApple => 'Continue with Apple';

  @override
  String get signInCancelled => 'Sign-in was cancelled.';

  @override
  String get signInFailed => 'We could not sign you in. Please try again.';

  @override
  String get signInLegal =>
      'By continuing you agree to our Terms and Privacy Policy.';

  @override
  String languageStepOf(int current, int total) {
    return 'Step $current of $total';
  }

  @override
  String get languageAppTitle => 'Which language feels like home?';

  @override
  String get languageAppSubtitle => 'You can change this anytime in settings.';

  @override
  String get languageMantraTitle => 'Which script do you chant in?';

  @override
  String get languageMantraSubtitle =>
      'Mantras appear in this script. Their meaning stays in your own language.';

  @override
  String get actionBack => 'Back';

  @override
  String get tabHome => 'Home';

  @override
  String get tabSadhana => 'Jap';

  @override
  String get tabLibrary => 'Read';

  @override
  String get tabRoutine => 'Routine';

  @override
  String get tabSakha => 'Sakha';

  @override
  String get reelsTitle => 'Reels';

  @override
  String get tabSearch => 'Search';

  @override
  String get homeGreeting => 'Hari Bol';

  @override
  String homeGreetingNamed(String name) {
    return 'Hari Bol, $name';
  }

  @override
  String homeDateLine(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat(
      'EEEE · d MMMM',
      localeName,
    );
    final String dateString = dateDateFormat.format(date);

    return '$dateString';
  }

  @override
  String get homeMoodPrompt => 'How are you today?';

  @override
  String get homeMoodAnsweredToday =>
      'You\'ve shared how you\'re feeling today. Come back tomorrow to share something new.';

  @override
  String homeMoodViewToday(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Read today\'s $count verses again',
      one: 'Read today\'s verse again',
    );
    return '$_temp0';
  }

  @override
  String homeMoodSubmit(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Show me $count verses',
      one: 'Show me a verse',
    );
    return '$_temp0';
  }

  @override
  String get homeVerseOfTheDay => 'Verse of the day';

  @override
  String get homeSlokaForYou => 'For you today';

  @override
  String get homeTodaysSadhana => 'Today\'s sadhana';

  @override
  String get homeContinueReading => 'Continue reading';

  @override
  String get homeBooks => 'Books';

  @override
  String get homeMantras => 'Mantras';

  @override
  String get homeStartYourDay => 'Set today\'s target';

  @override
  String homeChantMantra(String mantra) {
    return 'Chant $mantra';
  }

  @override
  String bookChapterCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count chapters',
      one: '1 chapter',
    );
    return '$_temp0';
  }

  @override
  String bookVerseCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count verses',
      one: '1 verse',
    );
    return '$_temp0';
  }

  @override
  String get searchHint => 'Search verses, mantras, books';

  @override
  String get searchPrompt =>
      'Search across the whole library, straight from the server.';

  @override
  String get searchShortcutLabel => 'Or jump straight to a verse:';

  @override
  String get searchNoResults =>
      'No results. Try a different word, or a reference like BG 2.47.';

  @override
  String get searchSectionVerses => 'Verses';

  @override
  String searchResultsTitle(String kind, String query) {
    return '$kind · $query';
  }

  @override
  String labelCanto(int number) {
    return 'Canto $number';
  }

  @override
  String labelChapter(int number) {
    return 'Chapter $number';
  }

  @override
  String labelVerse(int number) {
    return 'Verse $number';
  }

  @override
  String labelCantoChapter(int canto, int chapter) {
    return 'Canto $canto · Chapter $chapter';
  }

  @override
  String labelQuotedMeaning(String meaning) {
    return '“$meaning”';
  }

  @override
  String labelTranslatorCredit(String name) {
    return '— $name';
  }

  @override
  String sadhanaRoundsProgress(int done, int target) {
    return '$done of $target rounds';
  }

  @override
  String sadhanaTasksProgress(int done, int total) {
    return '$done of $total tasks done';
  }

  @override
  String sadhanaStreak(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days day streak',
      one: '1 day streak',
      zero: 'No streak yet',
    );
    return '$_temp0';
  }

  @override
  String get sadhanaGenericChant => 'Japa';

  @override
  String sadhanaRoundsShort(int rounds) {
    return '$rounds rounds';
  }

  @override
  String get sadhanaTodaysSessions => 'Today\'s chanting';

  @override
  String get sadhanaNoSessionsYet => 'Nothing logged yet today.';

  @override
  String get sadhanaRoundsEyebrow => 'Rounds today';

  @override
  String get sadhanaRoundsCaption => 'Rounds';

  @override
  String get sadhanaChantNow => 'Chant now';

  @override
  String get sadhanaLogRounds => 'Log rounds';

  @override
  String get sadhanaLogRoundsSubtitle =>
      'Rounds chanted on your beads, added to today\'s total.';

  @override
  String sadhanaLogRoundsSubmit(int rounds) {
    return 'Log $rounds rounds';
  }

  @override
  String get sadhanaTargetReached => 'Today\'s target reached';

  @override
  String get sadhanaUndoBead => 'Undo last bead';

  @override
  String get sadhanaElapsedEyebrow => 'Elapsed';

  @override
  String get sadhanaPaceEyebrow => 'Pace';

  @override
  String sadhanaElapsedSeconds(String seconds) {
    return '${seconds}s';
  }

  @override
  String sadhanaPacePerMantra(String seconds) {
    return '${seconds}s each';
  }

  @override
  String get sadhanaAutoCount => 'Auto count';

  @override
  String get sadhanaAutoCountOff => 'Off — tap a bead yourself';

  @override
  String get sadhanaAutoCountIdle => 'Waiting for chanting';

  @override
  String get chantAutoCountLoading => 'Getting auto count ready…';

  @override
  String get chantFullPicture => 'Full-screen picture';

  @override
  String get chantPrayerHint =>
      'Chant this prayer first, then tap the ring to begin counting.';

  @override
  String get sadhanaAutoCountListening => 'Listening…';

  @override
  String get sadhanaAutoCountCounted => 'Counted — listening for the next one';

  @override
  String get sadhanaAutoCountPermissionDenied =>
      'Microphone access is needed for auto count';

  @override
  String get sadhanaAutoCountUnavailable =>
      'Auto count isn\'t available right now';

  @override
  String get chantModelTitle => 'Sharper listening';

  @override
  String chantModelOffer(int megabytes) {
    return 'Understands Sanskrit far better. One download of $megabytes MB — use Wi-Fi.';
  }

  @override
  String get chantModelDownload => 'Download';

  @override
  String chantModelDownloading(int percent) {
    return 'Downloading… $percent%';
  }

  @override
  String get chantModelCancel => 'Cancel';

  @override
  String get chantModelInstalled =>
      'Downloaded — used the next time you switch auto count on';

  @override
  String get chantModelRemove => 'Remove';

  @override
  String get chantModelFailed => 'The download didn\'t finish';

  @override
  String get chantModelRetry => 'Try again';

  @override
  String get mantraAllCategories => 'All';

  @override
  String get mantraNoneInCategory => 'No mantras in this category yet.';

  @override
  String get mantraCategoryBeej => 'Beej';

  @override
  String get mantraCategoryGayatri => 'Gayatri';

  @override
  String get mantraCategoryMahamantra => 'Mahamantra';

  @override
  String get mantraCategoryName => 'Name';

  @override
  String mantraStandardRounds(int rounds) {
    return '$rounds rounds';
  }

  @override
  String mantraStandardCount(int count) {
    return '$count times';
  }

  @override
  String get mantraHasAudio => 'Recitation available';

  @override
  String get mantraPurport => 'Purport';

  @override
  String mantraMyRounds(int rounds) {
    return 'You\'ve chanted $rounds rounds of this';
  }

  @override
  String get mantraChantThis => 'Chant this';

  @override
  String get profileStatVersesSaved => 'Verses saved';

  @override
  String get profileStatTotalRounds => 'Total rounds';

  @override
  String get profileStatChantingDays => 'Chanting days';

  @override
  String get profileStatSlokasRead => 'Slokas read';

  @override
  String get profileRecentFavorites => 'Recent favourites';

  @override
  String get profileNoFavorites =>
      'Nothing saved yet. Bookmark a verse and it will be here.';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsSectionPractice => 'Practice';

  @override
  String get settingsSectionAccount => 'Account';

  @override
  String get settingsLanguage => 'Language';

  @override
  String get settingsTheme => 'Theme';

  @override
  String get settingsDailyGoal => 'Daily goal';

  @override
  String get settingsDailyGoalSubtitle =>
      'Rounds to aim for each day. Sets what every new day starts at.';

  @override
  String settingsDailyGoalSubmit(int rounds) {
    return 'Set daily goal to $rounds';
  }

  @override
  String get settingsPreferredMantra => 'Preferred mantra';

  @override
  String get settingsPreferredMantraNone => 'Not set';

  @override
  String get settingsChooseMantraTitle => 'Choose your mantra';

  @override
  String get settingsChooseMantraSubtitle =>
      'What \"Chant now\" opens with. You can still chant anything else from its own page.';

  @override
  String get settingsNoMantraPreference => 'No preference — ask me each time';

  @override
  String get settingsPlans => 'Plans & Premium';

  @override
  String get plansTitle => 'Plans';

  @override
  String get plansSubtitle =>
      'The whole app is free. A paid plan adds a little more on top.';

  @override
  String get plansYourPlan => 'Your plan';

  @override
  String get plansCurrent => 'Current plan';

  @override
  String get plansFreeForEveryone => 'Free for everyone';

  @override
  String plansPricePer(String price, String period) {
    return '$price / $period';
  }

  @override
  String get plansPeriodWeek => 'week';

  @override
  String get plansPeriodMonth => 'month';

  @override
  String get plansPeriodYear => 'year';

  @override
  String plansPeriodDays(int days) {
    return '$days days';
  }

  @override
  String plansTrial(int days) {
    return '$days-day free trial';
  }

  @override
  String get plansSubscribe => 'Subscribe';

  @override
  String get plansStartTrial => 'Start free trial';

  @override
  String get plansRestore => 'Restore purchases';

  @override
  String get plansStoreUnavailable =>
      'The store is not available on this device.';

  @override
  String get plansProductMissing =>
      'This plan is not available in the store right now.';

  @override
  String get plansPurchasePending => 'Your purchase is being processed…';

  @override
  String get plansPurchaseSuccess => 'Thank you — your plan is active.';

  @override
  String get plansPurchaseFailed => 'The purchase did not go through.';

  @override
  String get plansPurchaseCancelled => 'Purchase cancelled.';

  @override
  String plansRenews(String date) {
    return 'Renews on $date';
  }

  @override
  String plansEnds(String date) {
    return 'Access until $date';
  }

  @override
  String get plansPermanent =>
      'Yours permanently — thank you for supporting HariHariBol.';

  @override
  String get plansIncluded => 'Included';

  @override
  String get plansNotIncluded => 'Not included';

  @override
  String get plansUnlimited => 'Unlimited';

  @override
  String plansLimit(int limit, String unit) {
    return '$limit $unit';
  }

  @override
  String plansSakhaReplies(int count) {
    return 'About $count replies a month';
  }

  @override
  String get plansNoFeatures => 'No extra benefits yet — more are on the way.';

  @override
  String get plansRestoreDone => 'Purchases restored.';

  @override
  String get settingsPrivacy => 'Privacy policy';

  @override
  String settingsVersion(String version) {
    return 'Version $version';
  }

  @override
  String get settingsMadeWith => 'Made with reverence';

  @override
  String settingsFooter(String version, String madeWith) {
    return '$version · $madeWith';
  }

  @override
  String get themeSystem => 'Auto';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';

  @override
  String profileSignedInAs(String email) {
    return 'Signed in as $email';
  }

  @override
  String get profilePremium => 'Premium';

  @override
  String get profileFree => 'Free';

  @override
  String get signOutConfirm =>
      'You will need to sign in again to reach your practice history.';

  @override
  String get deleteAccountTitle => 'Delete your account?';

  @override
  String get deleteAccountBody =>
      'This removes your practice history, favourites and notifications. It cannot be undone.';

  @override
  String get comingSoon => 'Coming soon';

  @override
  String get libraryNoBooks => 'No books published yet.';

  @override
  String get libraryBookNotStarted => 'Not started yet. Tap to begin.';

  @override
  String get actionEdit => 'Edit';

  @override
  String get actionDelete => 'Delete';

  @override
  String get libraryDownloadBook => 'Download for offline reading';

  @override
  String get libraryDownloading => 'Downloading…';

  @override
  String get libraryDownloaded => 'Downloaded for offline reading';

  @override
  String get libraryDownloadFailed =>
      'Could not download this book. Please try again.';

  @override
  String bookCantoCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count cantos',
      one: '1 canto',
    );
    return '$_temp0';
  }

  @override
  String bookByTranslators(String names) {
    return 'Renderings by $names';
  }

  @override
  String get chapterPrevious => 'Previous chapter';

  @override
  String get chapterNext => 'Next chapter';

  @override
  String get actionBookmark => 'Bookmark';

  @override
  String get actionRemoveBookmark => 'Remove bookmark';

  @override
  String get actionHighlight => 'Highlight';

  @override
  String get actionRemoveHighlight => 'Remove highlight';

  @override
  String get verseExplanationLabel => 'Explanation';

  @override
  String get verseExplanationAiLabel => 'Explanation (AI-assisted)';

  @override
  String get verseWordMeanings => 'Word meanings';

  @override
  String get verseCompareTranslations => 'Compare translations';

  @override
  String get verseTranslationsEmpty => 'No other renderings published yet.';

  @override
  String get verseRelatedTitle => 'Related verses';

  @override
  String get verseRelatedEmpty => 'No related verses yet.';

  @override
  String get relationSameConcept => 'Same concept';

  @override
  String get relationExpandsOn => 'Expands on';

  @override
  String get relationQuotedIn => 'Quoted in';

  @override
  String get relationContrastsWith => 'Contrasts with';

  @override
  String get verseNotesTitle => 'My notes';

  @override
  String get verseNoteHint => 'Write a note…';

  @override
  String get verseNoteAdd => 'Add note';

  @override
  String get verseNoteEmpty => 'No notes yet on this verse.';

  @override
  String get verseNoteDeleteConfirm => 'Delete this note?';

  @override
  String get readingSettingsTitle => 'Reading settings';

  @override
  String get readingContents => 'Contents';

  @override
  String get readingFontSizeLabel => 'Text size';

  @override
  String get readingFontSizeSmall => 'Small';

  @override
  String get readingFontSizeMedium => 'Medium';

  @override
  String get readingFontSizeLarge => 'Large';

  @override
  String get readingFontSizeExtraLarge => 'Extra large';

  @override
  String get readingLanguageLabel => 'Reading language';

  @override
  String get readingHideLabel => 'Hide in verses';

  @override
  String get readingHideSanskrit => 'Sanskrit';

  @override
  String get readingHideTransliteration => 'Transliteration';

  @override
  String get routineSubtitle => 'Devotion, work and the ordinary in between.';

  @override
  String routineProgress(int done, int total) {
    return '$done of $total done';
  }

  @override
  String get routineEmptyBody =>
      'Add a round of japa, an errand, a chore — build today with intention.';

  @override
  String get routineAddTask => 'Add task';

  @override
  String get routineTaskHint => 'What needs doing?';

  @override
  String get routineCategoryLabel => 'Category';

  @override
  String get routineCategoryDevotion => 'Devotion';

  @override
  String get routineCategoryWork => 'Work';

  @override
  String get routineCategoryHome => 'Home';

  @override
  String get routineCategoryErrand => 'Errand';

  @override
  String get routineSlotMorning => 'Morning';

  @override
  String get routineSlotAfternoon => 'Afternoon';

  @override
  String get routineSlotEvening => 'Evening';

  @override
  String get routineSlotAnytime => 'Anytime';

  @override
  String get routinePresetWakeUp => 'Wake up';

  @override
  String get routinePresetMorningChant => 'Morning chanting';

  @override
  String get routinePresetExercise => 'Exercise';

  @override
  String get routinePresetBreakfast => 'Breakfast';

  @override
  String get routinePresetLunch => 'Lunch';

  @override
  String get routinePresetEveningChant => 'Evening chanting';

  @override
  String get routinePresetDinner => 'Dinner';

  @override
  String get routinePresetScriptureReading => 'Scripture reading';

  @override
  String get routinePresetSleep => 'Sleep';

  @override
  String get routineTaskNameLabel => 'Task name';

  @override
  String get routineWindowHeading => 'Standard time';

  @override
  String get routineWindowHint =>
      'Done inside this range counts as on time; before it is early, after it is late.';

  @override
  String get routineWindowSet => 'Set a time range';

  @override
  String get routineWindowClear => 'Remove time range';

  @override
  String get routineWindowFrom => 'From';

  @override
  String get routineWindowTo => 'To';

  @override
  String routineWindowRange(String start, String end) {
    return '$start – $end';
  }

  @override
  String get routineWindowInvalid => 'The end must be after the start.';

  @override
  String get routineStatusNotDone => 'Not done';

  @override
  String get routineStatusDone => 'Done';

  @override
  String get routineStatusEarly => 'Early';

  @override
  String get routineStatusOnTime => 'On time';

  @override
  String get routineStatusLate => 'Late';

  @override
  String routineStatusAtTime(String status, String time) {
    return '$status · $time';
  }

  @override
  String get routineChangeTime => 'Change time';

  @override
  String get routinePickDoneTime => 'When was this done?';

  @override
  String get routineSaveAction => 'Add to this day';

  @override
  String get routineTaskRemoved => 'Removed from this day';

  @override
  String get routineUndo => 'Undo';

  @override
  String get routineToday => 'Today';

  @override
  String get routineJumpToToday => 'Jump to today';

  @override
  String get routineEkadashi => 'Ekadashi';

  @override
  String get routineEkadashiNote =>
      'Approximate — a temple\'s almanac can differ by a day.';

  @override
  String routineDayLabel(String date, String ekadashi, int done, int total) {
    String _temp0 = intl.Intl.selectLogic(ekadashi, {
      'yes': ' · Ekadashi',
      'other': '',
    });
    String _temp1 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: ' · $done of $total done',
      zero: '',
    );
    return '$date$_temp0$_temp1';
  }

  @override
  String get routineNothingPlanned => 'Nothing planned for this day.';

  @override
  String get routineManageDaily => 'Daily routine';

  @override
  String get routineDailyTitle => 'Daily routine';

  @override
  String get routineDailyBody =>
      'Optional. These repeat every day, with a fresh check each day.';

  @override
  String get routineDailyEmpty => 'No daily routine yet.';

  @override
  String get routineDailyAdd => 'Add to daily routine';

  @override
  String get routineDailySaveAction => 'Add to every day';

  @override
  String get routineDailyBadge => 'Daily';

  @override
  String get routineDailyRemove => 'Remove from daily routine';

  @override
  String get routineDailyRemoved => 'Removed from your daily routine';

  @override
  String get reelsEmpty => 'No reels yet';

  @override
  String get reelsEmptyBody =>
      'When creators start posting, their reels will appear here.';

  @override
  String get reelsFailed => 'Could not load reels';

  @override
  String get reelsRetry => 'Try again';

  @override
  String get reelFollow => 'Follow';

  @override
  String get reelFollowing => 'Following';

  @override
  String get reelLike => 'Like';

  @override
  String get reelUnlike => 'Unlike';

  @override
  String get reelComment => 'Comment';

  @override
  String get reelShare => 'Share';

  @override
  String get reelSave => 'Save';

  @override
  String get reelUnsave => 'Remove from saved';

  @override
  String get reelSaved => 'Saved';

  @override
  String get reelRemovedFromSaved => 'Removed from saved';

  @override
  String get reelMore => 'More options';

  @override
  String get reelMuted => 'Sound off';

  @override
  String get reelUnmuted => 'Sound on';

  @override
  String get reelPlay => 'Play';

  @override
  String get reelPause => 'Pause';

  @override
  String get reelVideoUnavailable => 'This video is still processing.';

  @override
  String get reelAudioUnavailable => 'This recitation is still processing.';

  @override
  String get reelSimilar => 'More like this';

  @override
  String get reelSimilarEmpty => 'No similar reels yet.';

  @override
  String reelSlideOf(int current, int total) {
    return '$current of $total';
  }

  @override
  String get reelBookGita => 'BG';

  @override
  String get reelBookBhagavatam => 'SB';

  @override
  String get reelCaptionMore => 'more';

  @override
  String get reelCaptionLess => 'less';

  @override
  String get reelCommentsTitle => 'Comments';

  @override
  String reelCommentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count comments',
      one: '1 comment',
      zero: 'No comments yet',
    );
    return '$_temp0';
  }

  @override
  String get reelCommentsEmpty => 'Be the first to say something.';

  @override
  String get reelCommentHint => 'Add a comment…';

  @override
  String reelReplyHint(String name) {
    return 'Reply to $name…';
  }

  @override
  String get reelCommentSend => 'Post';

  @override
  String get reelCommentReply => 'Reply';

  @override
  String get reelCommentDelete => 'Delete';

  @override
  String get reelCommentReport => 'Report';

  @override
  String get reelCommentPin => 'Pin';

  @override
  String get reelCommentUnpin => 'Unpin';

  @override
  String get reelCommentPinned => 'Pinned';

  @override
  String get reelCommentRemoved => 'This comment was removed.';

  @override
  String get reelCommentDeleted => 'Comment deleted';

  @override
  String get reelCommentDeleteTitle => 'Delete this comment?';

  @override
  String get reelCommentDeleteBody =>
      'It will be removed for everyone, along with any replies to it.';

  @override
  String get reelCommentCancelReply => 'Cancel reply';

  @override
  String reelViewReplies(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'View $count replies',
      one: 'View 1 reply',
    );
    return '$_temp0';
  }

  @override
  String get reelHideReplies => 'Hide replies';

  @override
  String get reelLoadMoreComments => 'Load more comments';

  @override
  String get reelReportTitle => 'Report this reel';

  @override
  String get reelReportCommentTitle => 'Report this comment';

  @override
  String get reelReportBody =>
      'Tell us what is wrong with it. A moderator will review it.';

  @override
  String get reelReportSpam => 'Spam or misleading';

  @override
  String get reelReportHarassment => 'Harassment or abuse';

  @override
  String get reelReportNonDevotional => 'Not devotional content';

  @override
  String get reelReportMisinformation => 'Misinformation';

  @override
  String get reelReportSexualOrViolent => 'Sexual or violent';

  @override
  String get reelReportOther => 'Something else';

  @override
  String get reelReportNoteHint => 'Anything else we should know? (optional)';

  @override
  String get reelReportSubmit => 'Report';

  @override
  String get reelReportThanks => 'Thank you. A moderator will look at this.';

  @override
  String get reelShareTitle => 'Share this reel';

  @override
  String reelShareMessage(String caption, String link) {
    return '$caption\n\nWatch on HariHariBol: $link';
  }

  @override
  String get reelCopyLink => 'Copy link';

  @override
  String get reelLinkCopied => 'Link copied';

  @override
  String get creatorTitle => 'Creator';

  @override
  String creatorFollowers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count followers',
      one: '1 follower',
    );
    return '$_temp0';
  }

  @override
  String creatorReelCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count reels',
      one: '1 reel',
    );
    return '$_temp0';
  }

  @override
  String creatorViews(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count views',
      one: '1 view',
    );
    return '$_temp0';
  }

  @override
  String get creatorStatFollowers => 'Followers';

  @override
  String get creatorStatReels => 'Reels';

  @override
  String get creatorStatViews => 'Views';

  @override
  String get creatorVerified => 'Verified creator';

  @override
  String get creatorNoReels => 'Nothing posted yet.';

  @override
  String get creatorNotFound => 'That creator is no longer here.';

  @override
  String get chantAnalyticsTooltip => 'Analytics and history';

  @override
  String get chantSittingTime => 'Sitting time';

  @override
  String chantMalaTime(int number) {
    return 'Mala $number time';
  }

  @override
  String get chantStatCurrentMala => 'Current mala';

  @override
  String get chantStatCount => 'Count';

  @override
  String get chantStatMalasDone => 'Malas done';

  @override
  String get chantStatAvgMala => 'Avg per mala';

  @override
  String get chantStatAvgChant => 'Avg per chant';

  @override
  String get chantStatTotalChants => 'Total chants';

  @override
  String get chantStatFastestMala => 'Fastest mala';

  @override
  String get chantStatTotalTime => 'Total time';

  @override
  String get chantNoValue => '—';

  @override
  String get chantRecentTitle => 'Recent chants';

  @override
  String get chantRecentEmpty => 'Tap the ring to begin.';

  @override
  String chantTapNumber(int seq) {
    return '#$seq';
  }

  @override
  String get chantAutoBadge => 'Auto';

  @override
  String get chantDetectWords => 'Detect words';

  @override
  String get chantDetectWordsOff => 'Off — words aren\'t recorded';

  @override
  String get chantDetectWordsListening => 'Listening for words…';

  @override
  String get chantDetectWordsPermission => 'Microphone access is needed';

  @override
  String get chantDetectWordsStarting => 'Getting ready…';

  @override
  String get chantDetectWordsUnavailable =>
      'Word detection isn\'t available on this device';

  @override
  String get chantDetectWordsNote =>
      'Words are recognised on your phone, and audio is never recorded. The text is kept for 7 days, then deleted.';

  @override
  String get chantSetupTitle => 'Chanting helpers';

  @override
  String get chantSetupSubtitle =>
      'Choose how this sitting is counted and noted. Listening happens on your phone.';

  @override
  String get chantSetupButton => 'Auto count & words';

  @override
  String get chantSetupNoneOn => 'Set up';

  @override
  String chantSetupOn(int count) {
    return '$count on';
  }

  @override
  String chantSetupButtonState(String button, String state) {
    return '$button · $state';
  }

  @override
  String get chantSetupDone => 'Done';

  @override
  String get chantAnalyticsTitle => 'Chant analytics';

  @override
  String get chantTabThisSitting => 'This sitting';

  @override
  String get chantTabHistory => 'History';

  @override
  String chantMalaTitle(int number) {
    return 'Mala $number';
  }

  @override
  String get chantMalaInProgress => 'In progress';

  @override
  String get chantMalaStart => 'Start';

  @override
  String get chantMalaEnd => 'End';

  @override
  String get chantMalaDuration => 'Duration';

  @override
  String chantMalaChants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count chants',
      one: '1 chant',
    );
    return '$_temp0';
  }

  @override
  String get chantTapsHeader => 'Every chant';

  @override
  String get chantHeardLabel => 'Heard';

  @override
  String get chantNoMalasYet =>
      'No chants yet this sitting. Each mala you complete will be listed here, with its start, end and time taken.';

  @override
  String get chantHistoryEmpty => 'No earlier sittings yet.';

  @override
  String chantHistorySummary(int malas, int chants) {
    return '$malas malas · $chants chants';
  }

  @override
  String get chantHistoryNoDetail => 'Counted before chant timing was recorded';

  @override
  String get chantSessionTitle => 'Sitting';

  @override
  String get chantSessionNoMalas =>
      'No timed malas were recorded for this sitting.';

  @override
  String get chantHeardExpiry =>
      'Words heard are removed from your account 7 days after the sitting.';

  @override
  String get chantHeardTitle => 'Heard live';

  @override
  String get chantHeardHearing => 'Hearing you…';

  @override
  String get chantHeardWaiting => 'Waiting for your voice';

  @override
  String get chantHeardPlaceholder =>
      'Chant out loud. The words your phone hears will appear here.';

  @override
  String get chantHeardLast => 'Last heard';

  @override
  String chantHeardCounted(int count) {
    return 'Counted +$count';
  }

  @override
  String get chantHeardNotCounted => 'Not counted';

  @override
  String chantHeardMatch(int percent, int needed) {
    return '$percent% match · needs $needed%';
  }

  @override
  String chantHeardMatchShort(int percent) {
    return '$percent% match';
  }

  @override
  String get chantHeardEarlier => 'Earlier';

  @override
  String get chantAlongTitle => 'Chant along';

  @override
  String get chantAlongCaption =>
      'The counter counts with the recording. Auto count and word detection rest while it plays.';

  @override
  String get chantAlongPlay => 'Play recording';

  @override
  String get chantAlongPause => 'Pause recording';

  @override
  String get chantAlongPosition => 'Position in the recording';

  @override
  String get chantAlongLoading => 'Loading the recording…';

  @override
  String get chantAlongLoadFailed => 'The recording couldn\'t be loaded.';

  @override
  String get settingsSectionLanguages => 'Languages';

  @override
  String get settingsLanguageApp => 'App language';

  @override
  String get settingsLanguageAppHint => 'Menus, buttons and labels';

  @override
  String get settingsLanguageReading => 'Reading language';

  @override
  String get settingsLanguageReadingHint => 'Translation, meaning and purport';

  @override
  String get settingsLanguageSpeaking => 'Speaking and hearing language';

  @override
  String get settingsLanguageSpeakingHint => 'Audio and spoken meaning';

  @override
  String get settingsLanguagePickerApp => 'Choose the app language';

  @override
  String get settingsLanguagePickerReading => 'Choose the reading language';

  @override
  String get settingsLanguagePickerSpeaking => 'Choose the speaking language';

  @override
  String get settingsLanguageSanskritNote =>
      'Sanskrit verses always stay in Sanskrit.';

  @override
  String get readingAudioPlayAll => 'Read aloud';

  @override
  String get readingAudioPlayVerse => 'Play this verse';

  @override
  String get readingAudioPause => 'Pause';

  @override
  String get readingAudioResume => 'Resume';

  @override
  String get readingAudioStop => 'Stop';

  @override
  String get readingAudioNext => 'Next verse';

  @override
  String get readingAudioPrevious => 'Previous verse';

  @override
  String get readingAudioFromStart => 'From the beginning';

  @override
  String readingAudioResumeFrom(int number) {
    return 'Resume from verse $number';
  }

  @override
  String readingAudioNowPlaying(String section, int number) {
    return '$section · verse $number';
  }

  @override
  String get readingAudioLoading => 'Loading…';

  @override
  String get readingAudioChannel => 'Reading aloud';

  @override
  String get pushChannelName => 'Daily sloka and updates';

  @override
  String get readingSectionVerse => 'Verse';

  @override
  String get readingSectionMeaning => 'Meaning';

  @override
  String get readingSectionPurport => 'Purport';

  @override
  String get settingsVoices => 'Voices';

  @override
  String settingsVoicesValue(int count) {
    return '$count installed';
  }

  @override
  String get voicesTitle => 'Voices';

  @override
  String get voicesIntro =>
      'Meanings and purports are read aloud in your speaking language. Until a voice is downloaded your phone\'s own voice is used, so reading never waits.';

  @override
  String voicesStorage(String size) {
    return 'Using $size on this phone';
  }

  @override
  String get voicesEmpty =>
      'No voices are available to download yet. Your phone\'s own voice is used.';

  @override
  String get voiceDownload => 'Download';

  @override
  String get voiceDelete => 'Delete';

  @override
  String get voiceCancel => 'Cancel';

  @override
  String get voiceRetry => 'Try again';

  @override
  String voiceInstalled(String size) {
    return 'Installed · $size';
  }

  @override
  String voiceNotInstalled(String size) {
    return 'Not downloaded · $size';
  }

  @override
  String voiceDownloading(int percent) {
    return 'Downloading $percent%';
  }

  @override
  String get voiceVerifying => 'Checking…';

  @override
  String get voiceExtracting => 'Installing…';

  @override
  String get voiceFailed => 'Could not install this voice';

  @override
  String get voiceUnavailable => 'Not available yet · uses your phone\'s voice';

  @override
  String get voiceDeleteTitle => 'Delete this voice?';

  @override
  String get voiceDeleteBody =>
      'It can be downloaded again. Until then your phone\'s own voice is used.';

  @override
  String voiceLanguages(String languages) {
    return 'Speaks $languages';
  }

  @override
  String labelVerseWithSection(int number, String section) {
    return 'Verse $number · $section';
  }

  @override
  String get chatTitle => 'Ask Sakha';

  @override
  String get chatHomeTitle => 'Ask Sakha';

  @override
  String get chatHomeBody =>
      'Questions on scripture, mantras and your practice';

  @override
  String get chatIntroTitle => 'Your friend Sakha';

  @override
  String get chatIntroHint => 'Ask about a verse, a mantra or your practice.';

  @override
  String get chatComposerHint => 'Ask a question';

  @override
  String get chatSend => 'Send';

  @override
  String get chatStop => 'Stop';

  @override
  String chatCharacterCount(int count, int max) {
    return '$count / $max';
  }

  @override
  String chatCreditsLeft(int percent) {
    return '$percent% left';
  }

  @override
  String chatCreditsLeftLevel(int percent, String level) {
    return '$percent% left · $level';
  }

  @override
  String get chatCreditsResetsMidnight => 'Resets at midnight';

  @override
  String chatCreditsRenews(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat('d MMM', localeName);
    final String dateString = dateDateFormat.format(date);

    return 'Renews $dateString';
  }

  @override
  String get chatNotAvailableTitle => 'Chat is not part of your plan';

  @override
  String get chatNotAvailableBody =>
      'Upgrade your plan to ask Sakha your questions.';

  @override
  String get chatExhaustedDailyTitle => 'You have used today\'s credits';

  @override
  String get chatExhaustedDailyBody =>
      'They refill at midnight. You can carry on then, or upgrade for more.';

  @override
  String get chatExhaustedWalletTitle => 'Your credits have run out';

  @override
  String get chatExhaustedWalletBody =>
      'They renew with your plan. You can wait, or upgrade to keep going.';

  @override
  String get chatShareUsedTitle => 'This chat has used its share of credits';

  @override
  String get chatShareUsedBody =>
      'Start a new chat and Sakha will carry on from where you were.';

  @override
  String get chatUpgrade => 'Upgrade';

  @override
  String get chatStartNewChat => 'Start a new chat';

  @override
  String get chatFullTitle => 'This chat has grown long';

  @override
  String get chatFullBody =>
      'Start a new chat and Sakha will carry our conversation forward.';

  @override
  String get chatContinuePartial =>
      'Your latest messages could not be summarised, so only the earlier part came along.';

  @override
  String get chatTidying => 'Tidying our conversation…';

  @override
  String get chatTyping => 'Sakha is writing';

  @override
  String get chatConnectionLost =>
      'The connection was interrupted. Please try again.';

  @override
  String get chatReplyFailed =>
      'Sakha could not finish that reply. Please try again.';

  @override
  String get chatOverloaded =>
      'Sakha is busy right now. Please try again in a moment.';

  @override
  String get chatUnavailable =>
      'Sakha is not available right now. Please try again a little later.';

  @override
  String get chatBusy => 'Please wait for the current reply to finish.';

  @override
  String get chatTooLong => 'That message is too long. Please shorten it.';

  @override
  String get chatStopped => 'Stopped';

  @override
  String get chatInterrupted => 'Interrupted';

  @override
  String get chatCopy => 'Copy';

  @override
  String get chatCopied => 'Copied';

  @override
  String get chatShare => 'Share';

  @override
  String get chatRegenerate => 'Answer again';

  @override
  String get chatLinkCopied => 'Link copied';

  @override
  String get chatImageUnavailable => 'Image unavailable';

  @override
  String get chatClearTooltip => 'Clear chat';

  @override
  String get chatClearTitle => 'Clear this chat?';

  @override
  String get chatClearBody =>
      'Your messages and the replies Sakha gave are removed, and Sakha will not remember what we talked about. Credits already used are not returned.';

  @override
  String get chatClearConfirm => 'Clear';

  @override
  String get chatCleared => 'Chat cleared';

  @override
  String get chatSuggestionsLabel => 'Try asking';

  @override
  String get chatStarter1Title => 'A verse to live by';

  @override
  String get chatStarter1Prompt =>
      'Explain Bhagavad Gita 2.47 to me, about doing my duty without worrying about the result.';

  @override
  String get chatStarter2Title => 'Begin chanting';

  @override
  String get chatStarter2Prompt =>
      'How do I begin chanting the Hare Krishna mahamantra, and how many rounds should I start with?';

  @override
  String get chatStarter3Title => 'A daily practice';

  @override
  String get chatStarter3Prompt =>
      'Suggest a simple daily sadhana I can keep, even on a busy day.';

  @override
  String get chatStarter4Title => 'When the mind is restless';

  @override
  String get chatStarter4Prompt =>
      'My mind feels restless. What do the scriptures say about finding peace?';

  @override
  String get chatStarter5Title => 'A story to hear';

  @override
  String get chatStarter5Prompt =>
      'Tell me the story of Prahlada and what it teaches.';

  @override
  String get chatFollowUp1 => 'Explain simply';

  @override
  String get chatFollowUp2 => 'Give an example';

  @override
  String get chatFollowUp3 => 'Why does this matter?';

  @override
  String get chatFollowUp4 => 'How do I practise this?';

  @override
  String get chatAttach => 'Add a picture';

  @override
  String get chatAttachCamera => 'Take a photo';

  @override
  String get chatAttachGallery => 'Choose from your photos';

  @override
  String get chatAttachNote =>
      'The picture is shared with the service that helps write replies, and stays in this chat until you clear it.';

  @override
  String get chatImageRemove => 'Remove picture';

  @override
  String get chatImageUploading => 'Adding picture…';

  @override
  String get chatImageFailed =>
      'The picture could not be added. Tap to try again.';

  @override
  String get chatImageRejected =>
      'That picture cannot be used. Please choose another.';

  @override
  String get chatImageOff => 'Pictures are not available on your plan.';

  @override
  String get chatImageSemantics => 'Picture you sent';

  @override
  String get chatPictureDenied =>
      'Allow access to your camera or photos in your phone\'s Settings to add a picture.';

  @override
  String get chatMic => 'Speak your question';

  @override
  String get chatMicStop => 'Stop listening';

  @override
  String get chatListening => 'Listening…';

  @override
  String get chatMicDenied =>
      'Allow the microphone and speech recognition in your phone\'s Settings to speak your question.';

  @override
  String get chatMicUnavailable => 'Speaking is not available on this phone.';

  @override
  String get chatMicNoSpeech => 'Nothing was heard. Please try again.';

  @override
  String get chatMicFailed => 'Listening stopped. Please try again.';

  @override
  String get chatJumpToLatest => 'Latest';

  @override
  String get verseAskSakha => 'Ask Sakha about this verse';

  @override
  String chatExplainVerse(String reference, String verse) {
    return 'Please explain this verse to me in simple words — $reference:\n\n$verse';
  }

  @override
  String chatActionQuestion(String place) {
    return 'Open $place?';
  }

  @override
  String get chatActionOpen => 'Open';

  @override
  String get chatActionNotNow => 'Not now';
}
