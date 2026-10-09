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
  String get routineSubtitle => 'Devotion, work and the ordinary in between.';

  @override
  String routineProgress(int done, int total) {
    return '$done of $total done today';
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
  String get routineSlotLabel => 'Time of day';

  @override
  String get routineSlotMorning => 'Morning';

  @override
  String get routineSlotAfternoon => 'Afternoon';

  @override
  String get routineSlotEvening => 'Evening';

  @override
  String get routineSlotAnytime => 'Anytime';

  @override
  String get routineSaveAction => 'Add to today';

  @override
  String get routineTaskRemoved => 'Removed from today\'s list';

  @override
  String get routineUndo => 'Undo';

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
  String reelVerseRef(String book, int chapter, int verse) {
    return '$book $chapter.$verse';
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
}
