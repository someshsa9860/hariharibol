// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Kannada (`kn`).
class AppLocalizationsKn extends AppLocalizations {
  AppLocalizationsKn([String locale = 'kn']) : super(locale);

  @override
  String get appName => 'HariHariBol';

  @override
  String get splashTagline => 'ಓದಿ · ಜಪಿಸಿ · ಸಾಧನೆ ಮಾಡಿ';

  @override
  String get actionRetry => 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ';

  @override
  String get actionCancel => 'ರದ್ದುಮಾಡಿ';

  @override
  String get actionOk => 'ಸರಿ';

  @override
  String get actionDone => 'ಮುಗಿಯಿತು';

  @override
  String get actionSave => 'ಉಳಿಸಿ';

  @override
  String get actionViewAll => 'ಎಲ್ಲವನ್ನೂ ನೋಡಿ';

  @override
  String get actionSignOut => 'ಸೈನ್ ಔಟ್';

  @override
  String get actionDeleteAccount => 'ಖಾತೆಯನ್ನು ಅಳಿಸಿ';

  @override
  String get actionContinue => 'ಮುಂದುವರಿಸಿ';

  @override
  String get errorGeneric => 'ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get errorNetwork =>
      'ಸಂಪರ್ಕವಿಲ್ಲ. ನಿಮ್ಮ ಇಂಟರ್ನೆಟ್ ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get errorTimeout =>
      'ಇದಕ್ಕೆ ಬಹಳ ಸಮಯ ತೆಗೆದುಕೊಂಡಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get errorSessionExpired =>
      'ನಿಮ್ಮ ಸೆಶನ್ ಮುಗಿದಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.';

  @override
  String get errorSignIn =>
      'ನಿಮ್ಮನ್ನು ಸೈನ್ ಇನ್ ಮಾಡಲು ಆಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get errorInsecureConnection => 'ಸಂಪರ್ಕ ಸುರಕ್ಷಿತವಾಗಿಲ್ಲ.';

  @override
  String get errorCancelled => 'ವಿನಂತಿಯನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ.';

  @override
  String get errorEmptyTitle => 'ಇಲ್ಲಿ ಇನ್ನೂ ಏನೂ ಇಲ್ಲ';

  @override
  String get errorRouteNotFound => 'ಆ ಪರದೆ ಅಸ್ತಿತ್ವದಲ್ಲಿಲ್ಲ.';

  @override
  String get actionGoHome => 'ಮುಖಪುಟಕ್ಕೆ ಹೋಗಿ';

  @override
  String get signInTitle => 'ಸ್ವಾಗತ';

  @override
  String get signInSubtitle =>
      'ಓದಿ, ಜಪಿಸಿ, ನಿಮ್ಮ ದೈನಂದಿನ ಸಾಧನೆಯನ್ನು ಒಂದೇ ಸ್ಥಳದಲ್ಲಿ ಇರಿಸಿ.';

  @override
  String get signInWithGoogle => 'Google ಮೂಲಕ ಮುಂದುವರಿಸಿ';

  @override
  String get signInWithApple => 'Apple ಮೂಲಕ ಮುಂದುವರಿಸಿ';

  @override
  String get signInCancelled => 'ಸೈನ್ ಇನ್ ರದ್ದಾಯಿತು.';

  @override
  String get signInFailed =>
      'ನಿಮ್ಮನ್ನು ಸೈನ್ ಇನ್ ಮಾಡಲು ಆಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get signInLegal =>
      'ಮುಂದುವರಿಸುವ ಮೂಲಕ ನೀವು ನಮ್ಮ ನಿಯಮಗಳು ಮತ್ತು ಗೌಪ್ಯತಾ ನೀತಿಗೆ ಒಪ್ಪುತ್ತೀರಿ.';

  @override
  String languageStepOf(int current, int total) {
    return 'ಹಂತ $current / $total';
  }

  @override
  String get languageAppTitle => 'ಯಾವ ಭಾಷೆ ನಿಮಗೆ ಮನೆಯಂತೆ ಅನಿಸುತ್ತದೆ?';

  @override
  String get languageAppSubtitle =>
      'ನೀವು ಇದನ್ನು ಯಾವಾಗ ಬೇಕಾದರೂ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಬದಲಾಯಿಸಬಹುದು.';

  @override
  String get languageMantraTitle => 'ನೀವು ಯಾವ ಲಿಪಿಯಲ್ಲಿ ಜಪಿಸುತ್ತೀರಿ?';

  @override
  String get languageMantraSubtitle =>
      'ಮಂತ್ರಗಳು ಈ ಲಿಪಿಯಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ. ಅವುಗಳ ಅರ್ಥ ನಿಮ್ಮ ಸ್ವಂತ ಭಾಷೆಯಲ್ಲೇ ಇರುತ್ತದೆ.';

  @override
  String get actionBack => 'ಹಿಂದೆ';

  @override
  String get tabHome => 'ಮುಖಪುಟ';

  @override
  String get tabSadhana => 'ಜಪ';

  @override
  String get tabLibrary => 'ಓದು';

  @override
  String get tabRoutine => 'ದಿನಚರಿ';

  @override
  String get tabSakha => 'Sakha';

  @override
  String get reelsTitle => 'ರೀಲ್ಸ್';

  @override
  String get tabSearch => 'ಹುಡುಕಿ';

  @override
  String get homeGreeting => 'ಹರಿ ಬೋಲ್';

  @override
  String homeGreetingNamed(String name) {
    return 'ಹರಿ ಬೋಲ್, $name';
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
  String get homeMoodPrompt => 'ಇಂದು ನೀವು ಹೇಗಿದ್ದೀರಿ?';

  @override
  String get homeMoodAnsweredToday =>
      'ಇಂದು ನಿಮ್ಮ ಭಾವನೆಯನ್ನು ಹಂಚಿಕೊಂಡಿದ್ದೀರಿ. ಹೊಸದನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ನಾಳೆ ಮತ್ತೆ ಬನ್ನಿ.';

  @override
  String homeMoodViewToday(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ಇಂದಿನ $count ಶ್ಲೋಕಗಳನ್ನು ಮತ್ತೆ ಓದಿ',
      one: 'ಇಂದಿನ ಶ್ಲೋಕವನ್ನು ಮತ್ತೆ ಓದಿ',
    );
    return '$_temp0';
  }

  @override
  String homeMoodSubmit(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ನನಗೆ $count ಶ್ಲೋಕಗಳನ್ನು ತೋರಿಸಿ',
      one: 'ನನಗೊಂದು ಶ್ಲೋಕ ತೋರಿಸಿ',
    );
    return '$_temp0';
  }

  @override
  String get homeVerseOfTheDay => 'ಇಂದಿನ ಶ್ಲೋಕ';

  @override
  String get homeSlokaForYou => 'ಇಂದು ನಿಮಗಾಗಿ';

  @override
  String get homeTodaysSadhana => 'ಇಂದಿನ ಸಾಧನೆ';

  @override
  String get homeContinueReading => 'ಓದುವುದನ್ನು ಮುಂದುವರಿಸಿ';

  @override
  String get homeBooks => 'ಪುಸ್ತಕಗಳು';

  @override
  String get homeMantras => 'ಮಂತ್ರಗಳು';

  @override
  String get homeStartYourDay => 'ಇಂದಿನ ಗುರಿಯನ್ನು ಹೊಂದಿಸಿ';

  @override
  String homeChantMantra(String mantra) {
    return '$mantra ಜಪಿಸಿ';
  }

  @override
  String bookChapterCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಅಧ್ಯಾಯಗಳು',
      one: '1 ಅಧ್ಯಾಯ',
    );
    return '$_temp0';
  }

  @override
  String bookVerseCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಶ್ಲೋಕಗಳು',
      one: '1 ಶ್ಲೋಕ',
    );
    return '$_temp0';
  }

  @override
  String get searchHint => 'ಶ್ಲೋಕಗಳು, ಮಂತ್ರಗಳು, ಪುಸ್ತಕಗಳನ್ನು ಹುಡುಕಿ';

  @override
  String get searchPrompt => 'ಇಡೀ ಗ್ರಂಥಾಲಯದಲ್ಲಿ, ನೇರವಾಗಿ ಸರ್ವರ್‌ನಿಂದ ಹುಡುಕಿ.';

  @override
  String get searchShortcutLabel => 'ಅಥವಾ ನೇರವಾಗಿ ಒಂದು ಶ್ಲೋಕಕ್ಕೆ ಹೋಗಿ:';

  @override
  String get searchNoResults =>
      'ಫಲಿತಾಂಶಗಳಿಲ್ಲ. ಬೇರೆ ಪದವನ್ನು ಪ್ರಯತ್ನಿಸಿ, ಅಥವಾ BG 2.47 ನಂತಹ ಉಲ್ಲೇಖವನ್ನು ನೀಡಿ.';

  @override
  String get searchSectionVerses => 'ಶ್ಲೋಕಗಳು';

  @override
  String searchResultsTitle(String kind, String query) {
    return '$kind · $query';
  }

  @override
  String labelCanto(int number) {
    return 'ಸ್ಕಂಧ $number';
  }

  @override
  String labelChapter(int number) {
    return 'ಅಧ್ಯಾಯ $number';
  }

  @override
  String labelVerse(int number) {
    return 'ಶ್ಲೋಕ $number';
  }

  @override
  String labelCantoChapter(int canto, int chapter) {
    return 'ಸ್ಕಂಧ $canto · ಅಧ್ಯಾಯ $chapter';
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
    return '$done / $target ಮಾಲೆಗಳು';
  }

  @override
  String sadhanaTasksProgress(int done, int total) {
    return '$total ಕೆಲಸಗಳಲ್ಲಿ $done ಮುಗಿದಿವೆ';
  }

  @override
  String sadhanaStreak(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days ದಿನಗಳ ನಿರಂತರತೆ',
      one: '1 ದಿನದ ನಿರಂತರತೆ',
      zero: 'ಇನ್ನೂ ನಿರಂತರತೆ ಇಲ್ಲ',
    );
    return '$_temp0';
  }

  @override
  String get sadhanaGenericChant => 'ಜಪ';

  @override
  String sadhanaRoundsShort(int rounds) {
    return '$rounds ಮಾಲೆಗಳು';
  }

  @override
  String get sadhanaTodaysSessions => 'ಇಂದಿನ ಜಪ';

  @override
  String get sadhanaNoSessionsYet => 'ಇಂದು ಇನ್ನೂ ಏನೂ ದಾಖಲಾಗಿಲ್ಲ.';

  @override
  String get sadhanaRoundsEyebrow => 'ಇಂದಿನ ಮಾಲೆಗಳು';

  @override
  String get sadhanaRoundsCaption => 'ಮಾಲೆಗಳು';

  @override
  String get sadhanaChantNow => 'ಈಗ ಜಪಿಸಿ';

  @override
  String get sadhanaLogRounds => 'ಮಾಲೆಗಳನ್ನು ದಾಖಲಿಸಿ';

  @override
  String get sadhanaLogRoundsSubtitle =>
      'ನಿಮ್ಮ ಜಪಮಾಲೆಯಲ್ಲಿ ಜಪಿಸಿದ ಮಾಲೆಗಳು, ಇಂದಿನ ಒಟ್ಟು ಮೊತ್ತಕ್ಕೆ ಸೇರುತ್ತವೆ.';

  @override
  String sadhanaLogRoundsSubmit(int rounds) {
    return '$rounds ಮಾಲೆಗಳನ್ನು ದಾಖಲಿಸಿ';
  }

  @override
  String get sadhanaTargetReached => 'ಇಂದಿನ ಗುರಿ ತಲುಪಲಾಗಿದೆ';

  @override
  String get sadhanaUndoBead => 'ಕೊನೆಯ ಮಣಿಯನ್ನು ರದ್ದುಮಾಡಿ';

  @override
  String get sadhanaElapsedEyebrow => 'ಕಳೆದ ಸಮಯ';

  @override
  String get sadhanaPaceEyebrow => 'ವೇಗ';

  @override
  String sadhanaElapsedSeconds(String seconds) {
    return '$seconds ಸೆ';
  }

  @override
  String sadhanaPacePerMantra(String seconds) {
    return 'ಒಂದಕ್ಕೆ $seconds ಸೆ';
  }

  @override
  String get sadhanaAutoCount => 'ಸ್ವಯಂ ಎಣಿಕೆ';

  @override
  String get sadhanaAutoCountOff => 'ಆಫ್ — ಮಣಿಯನ್ನು ನೀವೇ ಟ್ಯಾಪ್ ಮಾಡಿ';

  @override
  String get sadhanaAutoCountIdle => 'ಜಪಕ್ಕಾಗಿ ಕಾಯುತ್ತಿದೆ';

  @override
  String get chantAutoCountLoading => 'ಸ್ವಯಂ ಎಣಿಕೆ ಸಿದ್ಧವಾಗುತ್ತಿದೆ…';

  @override
  String get chantFullPicture => 'ಪೂರ್ಣ ಪರದೆಯ ಚಿತ್ರ';

  @override
  String get chantPrayerHint =>
      'ಮೊದಲು ಈ ಪ್ರಾರ್ಥನೆಯನ್ನು ಮಾಡಿ, ನಂತರ ಎಣಿಕೆ ಆರಂಭಿಸಲು ವೃತ್ತವನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String get sadhanaAutoCountListening => 'ಆಲಿಸುತ್ತಿದೆ…';

  @override
  String get sadhanaAutoCountCounted =>
      'ಎಣಿಸಲಾಯಿತು — ಮುಂದಿನದಕ್ಕಾಗಿ ಆಲಿಸುತ್ತಿದೆ';

  @override
  String get sadhanaAutoCountPermissionDenied =>
      'ಸ್ವಯಂ ಎಣಿಕೆಗೆ ಮೈಕ್ರೋಫೋನ್ ಅನುಮತಿ ಬೇಕು';

  @override
  String get sadhanaAutoCountUnavailable => 'ಸ್ವಯಂ ಎಣಿಕೆ ಈಗ ಲಭ್ಯವಿಲ್ಲ';

  @override
  String get chantModelTitle => 'ಹೆಚ್ಚು ನಿಖರವಾದ ಆಲಿಸುವಿಕೆ';

  @override
  String chantModelOffer(int megabytes) {
    return 'ಸಂಸ್ಕೃತವನ್ನು ಹೆಚ್ಚು ಚೆನ್ನಾಗಿ ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತದೆ. ಒಮ್ಮೆ $megabytes MB ಡೌನ್‌ಲೋಡ್ — Wi-Fi ಬಳಸಿ.';
  }

  @override
  String get chantModelDownload => 'ಡೌನ್‌ಲೋಡ್';

  @override
  String chantModelDownloading(int percent) {
    return 'ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ… $percent%';
  }

  @override
  String get chantModelCancel => 'ರದ್ದುಮಾಡಿ';

  @override
  String get chantModelInstalled =>
      'ಡೌನ್‌ಲೋಡ್ ಆಗಿದೆ — ಮುಂದಿನ ಬಾರಿ ಸ್ವಯಂ ಎಣಿಕೆಯನ್ನು ಆನ್ ಮಾಡಿದಾಗ ಬಳಸಲಾಗುತ್ತದೆ';

  @override
  String get chantModelRemove => 'ತೆಗೆದುಹಾಕಿ';

  @override
  String get chantModelFailed => 'ಡೌನ್‌ಲೋಡ್ ಪೂರ್ಣಗೊಳ್ಳಲಿಲ್ಲ';

  @override
  String get chantModelRetry => 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ';

  @override
  String get mantraAllCategories => 'ಎಲ್ಲವೂ';

  @override
  String get mantraNoneInCategory => 'ಈ ವರ್ಗದಲ್ಲಿ ಇನ್ನೂ ಮಂತ್ರಗಳಿಲ್ಲ.';

  @override
  String get mantraCategoryBeej => 'ಬೀಜ ಮಂತ್ರ';

  @override
  String get mantraCategoryGayatri => 'ಗಾಯತ್ರೀ';

  @override
  String get mantraCategoryMahamantra => 'ಮಹಾಮಂತ್ರ';

  @override
  String get mantraCategoryName => 'ನಾಮ ಮಂತ್ರ';

  @override
  String mantraStandardRounds(int rounds) {
    return '$rounds ಮಾಲೆಗಳು';
  }

  @override
  String mantraStandardCount(int count) {
    return '$count ಬಾರಿ';
  }

  @override
  String get mantraHasAudio => 'ಪಾರಾಯಣ ಲಭ್ಯವಿದೆ';

  @override
  String get mantraPurport => 'ತಾತ್ಪರ್ಯ';

  @override
  String mantraMyRounds(int rounds) {
    return 'ನೀವು ಇದನ್ನು $rounds ಮಾಲೆಗಳು ಜಪಿಸಿದ್ದೀರಿ';
  }

  @override
  String get mantraChantThis => 'ಇದನ್ನು ಜಪಿಸಿ';

  @override
  String get profileStatVersesSaved => 'ಉಳಿಸಿದ ಶ್ಲೋಕಗಳು';

  @override
  String get profileStatTotalRounds => 'ಒಟ್ಟು ಮಾಲೆಗಳು';

  @override
  String get profileStatChantingDays => 'ಜಪದ ದಿನಗಳು';

  @override
  String get profileStatSlokasRead => 'ಓದಿದ ಶ್ಲೋಕಗಳು';

  @override
  String get profileRecentFavorites => 'ಇತ್ತೀಚಿನ ಮೆಚ್ಚಿನವು';

  @override
  String get profileNoFavorites =>
      'ಇನ್ನೂ ಏನೂ ಉಳಿಸಿಲ್ಲ. ಒಂದು ಶ್ಲೋಕವನ್ನು ಬುಕ್‌ಮಾರ್ಕ್ ಮಾಡಿದರೆ ಅದು ಇಲ್ಲಿರುತ್ತದೆ.';

  @override
  String get settingsTitle => 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು';

  @override
  String get settingsSectionPractice => 'ಸಾಧನೆ';

  @override
  String get settingsSectionAccount => 'ಖಾತೆ';

  @override
  String get settingsLanguage => 'ಭಾಷೆ';

  @override
  String get settingsTheme => 'ಥೀಮ್';

  @override
  String get settingsDailyGoal => 'ದೈನಂದಿನ ಗುರಿ';

  @override
  String get settingsDailyGoalSubtitle =>
      'ಪ್ರತಿದಿನ ಗುರಿಯಾಗಿಸಿಕೊಳ್ಳುವ ಮಾಲೆಗಳು. ಪ್ರತಿ ಹೊಸ ದಿನವೂ ಇದರಿಂದಲೇ ಆರಂಭವಾಗುತ್ತದೆ.';

  @override
  String settingsDailyGoalSubmit(int rounds) {
    return 'ದೈನಂದಿನ ಗುರಿಯನ್ನು $rounds ಎಂದು ಹೊಂದಿಸಿ';
  }

  @override
  String get settingsPreferredMantra => 'ಇಷ್ಟದ ಮಂತ್ರ';

  @override
  String get settingsPreferredMantraNone => 'ಹೊಂದಿಸಿಲ್ಲ';

  @override
  String get settingsChooseMantraTitle => 'ನಿಮ್ಮ ಮಂತ್ರವನ್ನು ಆರಿಸಿ';

  @override
  String get settingsChooseMantraSubtitle =>
      '“ಈಗ ಜಪಿಸಿ” ಯಾವುದರೊಂದಿಗೆ ತೆರೆಯುತ್ತದೆ ಎಂಬುದು ಇದು. ಬೇರೆ ಯಾವುದನ್ನಾದರೂ ಅದರ ಸ್ವಂತ ಪುಟದಿಂದ ಜಪಿಸಬಹುದು.';

  @override
  String get settingsNoMantraPreference =>
      'ಆದ್ಯತೆ ಇಲ್ಲ — ಪ್ರತಿ ಬಾರಿ ನನ್ನನ್ನು ಕೇಳಿ';

  @override
  String get settingsPlans => 'ಪ್ಲಾನ್‌ಗಳು & ಪ್ರೀಮಿಯಂ';

  @override
  String get plansTitle => 'ಪ್ಲಾನ್‌ಗಳು';

  @override
  String get plansSubtitle =>
      'ಇಡೀ ಆ್ಯಪ್ ಉಚಿತ. ಪಾವತಿಸಿದ ಪ್ಲಾನ್ ಅದರ ಮೇಲೆ ಸ್ವಲ್ಪ ಹೆಚ್ಚು ಸೇರಿಸುತ್ತದೆ.';

  @override
  String get plansYourPlan => 'ನಿಮ್ಮ ಪ್ಲಾನ್';

  @override
  String get plansCurrent => 'ಪ್ರಸ್ತುತ ಪ್ಲಾನ್';

  @override
  String get plansFreeForEveryone => 'ಎಲ್ಲರಿಗೂ ಉಚಿತ';

  @override
  String plansPricePer(String price, String period) {
    return '$price / $period';
  }

  @override
  String get plansPeriodWeek => 'ವಾರ';

  @override
  String get plansPeriodMonth => 'ತಿಂಗಳು';

  @override
  String get plansPeriodYear => 'ವರ್ಷ';

  @override
  String plansPeriodDays(int days) {
    return '$days ದಿನಗಳು';
  }

  @override
  String plansTrial(int days) {
    return '$days ದಿನಗಳ ಉಚಿತ ಟ್ರಯಲ್';
  }

  @override
  String get plansSubscribe => 'ಚಂದಾದಾರರಾಗಿ';

  @override
  String get plansStartTrial => 'ಉಚಿತ ಟ್ರಯಲ್ ಆರಂಭಿಸಿ';

  @override
  String get plansRestore => 'ಖರೀದಿಗಳನ್ನು ಮರುಸ್ಥಾಪಿಸಿ';

  @override
  String get plansStoreUnavailable => 'ಈ ಸಾಧನದಲ್ಲಿ ಸ್ಟೋರ್ ಲಭ್ಯವಿಲ್ಲ.';

  @override
  String get plansProductMissing => 'ಈ ಪ್ಲಾನ್ ಈಗ ಸ್ಟೋರ್‌ನಲ್ಲಿ ಲಭ್ಯವಿಲ್ಲ.';

  @override
  String get plansPurchasePending =>
      'ನಿಮ್ಮ ಖರೀದಿಯನ್ನು ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲಾಗುತ್ತಿದೆ…';

  @override
  String get plansPurchaseSuccess => 'ಧನ್ಯವಾದಗಳು — ನಿಮ್ಮ ಪ್ಲಾನ್ ಸಕ್ರಿಯವಾಗಿದೆ.';

  @override
  String get plansPurchaseFailed => 'ಖರೀದಿ ಪೂರ್ಣಗೊಳ್ಳಲಿಲ್ಲ.';

  @override
  String get plansPurchaseCancelled => 'ಖರೀದಿ ರದ್ದಾಯಿತು.';

  @override
  String plansRenews(String date) {
    return '$date ರಂದು ನವೀಕರಣಗೊಳ್ಳುತ್ತದೆ';
  }

  @override
  String plansEnds(String date) {
    return '$date ವರೆಗೆ ಪ್ರವೇಶ';
  }

  @override
  String get plansPermanent =>
      'ಶಾಶ್ವತವಾಗಿ ನಿಮ್ಮದು — HariHariBol ಅನ್ನು ಬೆಂಬಲಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು.';

  @override
  String get plansIncluded => 'ಸೇರಿದೆ';

  @override
  String get plansNotIncluded => 'ಸೇರಿಲ್ಲ';

  @override
  String get plansUnlimited => 'ಅಪರಿಮಿತ';

  @override
  String plansLimit(int limit, String unit) {
    return '$limit $unit';
  }

  @override
  String plansSakhaReplies(int count) {
    return 'ತಿಂಗಳಿಗೆ ಸುಮಾರು $count ಉತ್ತರಗಳು';
  }

  @override
  String get plansNoFeatures =>
      'ಹೆಚ್ಚುವರಿ ಪ್ರಯೋಜನಗಳು ಇನ್ನೂ ಇಲ್ಲ — ಇನ್ನಷ್ಟು ಬರಲಿವೆ.';

  @override
  String get plansRestoreDone => 'ಖರೀದಿಗಳನ್ನು ಮರುಸ್ಥಾಪಿಸಲಾಗಿದೆ.';

  @override
  String get settingsPrivacy => 'ಗೌಪ್ಯತಾ ನೀತಿ';

  @override
  String settingsVersion(String version) {
    return 'ಆವೃತ್ತಿ $version';
  }

  @override
  String get settingsMadeWith => 'ಭಕ್ತಿಯಿಂದ ರಚಿಸಲಾಗಿದೆ';

  @override
  String settingsFooter(String version, String madeWith) {
    return '$version · $madeWith';
  }

  @override
  String get themeSystem => 'ಸ್ವಯಂ';

  @override
  String get themeLight => 'ಲೈಟ್';

  @override
  String get themeDark => 'ಡಾರ್ಕ್';

  @override
  String profileSignedInAs(String email) {
    return '$email ಆಗಿ ಸೈನ್ ಇನ್ ಆಗಿದ್ದೀರಿ';
  }

  @override
  String get profilePremium => 'ಪ್ರೀಮಿಯಂ';

  @override
  String get profileFree => 'ಉಚಿತ';

  @override
  String get signOutConfirm =>
      'ನಿಮ್ಮ ಸಾಧನೆಯ ಇತಿಹಾಸವನ್ನು ನೋಡಲು ನೀವು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಬೇಕು.';

  @override
  String get deleteAccountTitle => 'ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಅಳಿಸಬೇಕೆ?';

  @override
  String get deleteAccountBody =>
      'ಇದು ನಿಮ್ಮ ಸಾಧನೆಯ ಇತಿಹಾಸ, ಮೆಚ್ಚಿನವು ಮತ್ತು ಅಧಿಸೂಚನೆಗಳನ್ನು ತೆಗೆದುಹಾಕುತ್ತದೆ. ಇದನ್ನು ಹಿಂತಿರುಗಿಸಲಾಗದು.';

  @override
  String get comingSoon => 'ಶೀಘ್ರದಲ್ಲೇ ಬರಲಿದೆ';

  @override
  String get libraryNoBooks => 'ಇನ್ನೂ ಪುಸ್ತಕಗಳನ್ನು ಪ್ರಕಟಿಸಲಾಗಿಲ್ಲ.';

  @override
  String get libraryBookNotStarted => 'ಇನ್ನೂ ಆರಂಭಿಸಿಲ್ಲ. ಆರಂಭಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String get actionEdit => 'ಸಂಪಾದಿಸಿ';

  @override
  String get actionDelete => 'ಅಳಿಸಿ';

  @override
  String get libraryDownloadBook => 'ಆಫ್‌ಲೈನ್ ಓದಿಗಾಗಿ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ';

  @override
  String get libraryDownloading => 'ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ…';

  @override
  String get libraryDownloaded => 'ಆಫ್‌ಲೈನ್ ಓದಿಗಾಗಿ ಡೌನ್‌ಲೋಡ್ ಆಗಿದೆ';

  @override
  String get libraryDownloadFailed =>
      'ಈ ಪುಸ್ತಕವನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಲು ಆಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String bookCantoCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಸ್ಕಂಧಗಳು',
      one: '1 ಸ್ಕಂಧ',
    );
    return '$_temp0';
  }

  @override
  String bookByTranslators(String names) {
    return '$names ಅವರ ಅನುವಾದಗಳು';
  }

  @override
  String get chapterPrevious => 'ಹಿಂದಿನ ಅಧ್ಯಾಯ';

  @override
  String get chapterNext => 'ಮುಂದಿನ ಅಧ್ಯಾಯ';

  @override
  String get actionBookmark => 'ಬುಕ್‌ಮಾರ್ಕ್';

  @override
  String get actionRemoveBookmark => 'ಬುಕ್‌ಮಾರ್ಕ್ ತೆಗೆದುಹಾಕಿ';

  @override
  String get actionHighlight => 'ಹೈಲೈಟ್';

  @override
  String get actionRemoveHighlight => 'ಹೈಲೈಟ್ ತೆಗೆದುಹಾಕಿ';

  @override
  String get verseExplanationLabel => 'ವಿವರಣೆ';

  @override
  String get verseExplanationAiLabel => 'ವಿವರಣೆ (AI ಸಹಾಯದಿಂದ)';

  @override
  String get verseWordMeanings => 'ಪದಾರ್ಥ';

  @override
  String get verseCompareTranslations => 'ಅನುವಾದಗಳನ್ನು ಹೋಲಿಸಿ';

  @override
  String get verseTranslationsEmpty =>
      'ಬೇರೆ ಅನುವಾದಗಳನ್ನು ಇನ್ನೂ ಪ್ರಕಟಿಸಲಾಗಿಲ್ಲ.';

  @override
  String get verseRelatedTitle => 'ಸಂಬಂಧಿತ ಶ್ಲೋಕಗಳು';

  @override
  String get verseRelatedEmpty => 'ಸಂಬಂಧಿತ ಶ್ಲೋಕಗಳು ಇನ್ನೂ ಇಲ್ಲ.';

  @override
  String get relationSameConcept => 'ಅದೇ ಪರಿಕಲ್ಪನೆ';

  @override
  String get relationExpandsOn => 'ವಿಸ್ತರಿಸುತ್ತದೆ';

  @override
  String get relationQuotedIn => 'ಉಲ್ಲೇಖಿತವಾದ ಸ್ಥಳ';

  @override
  String get relationContrastsWith => 'ಭಿನ್ನವಾಗಿದೆ';

  @override
  String get verseNotesTitle => 'ನನ್ನ ಟಿಪ್ಪಣಿಗಳು';

  @override
  String get verseNoteHint => 'ಟಿಪ್ಪಣಿ ಬರೆಯಿರಿ…';

  @override
  String get verseNoteAdd => 'ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ';

  @override
  String get verseNoteEmpty => 'ಈ ಶ್ಲೋಕದ ಮೇಲೆ ಇನ್ನೂ ಟಿಪ್ಪಣಿಗಳಿಲ್ಲ.';

  @override
  String get verseNoteDeleteConfirm => 'ಈ ಟಿಪ್ಪಣಿಯನ್ನು ಅಳಿಸಬೇಕೆ?';

  @override
  String get readingSettingsTitle => 'ಓದುವ ಸೆಟ್ಟಿಂಗ್‌ಗಳು';

  @override
  String get readingContents => 'ಪರಿವಿಡಿ';

  @override
  String get readingFontSizeLabel => 'ಅಕ್ಷರದ ಗಾತ್ರ';

  @override
  String get readingFontSizeSmall => 'ಸಣ್ಣದು';

  @override
  String get readingFontSizeMedium => 'ಮಧ್ಯಮ';

  @override
  String get readingFontSizeLarge => 'ದೊಡ್ಡದು';

  @override
  String get readingFontSizeExtraLarge => 'ತುಂಬಾ ದೊಡ್ಡದು';

  @override
  String get readingLanguageLabel => 'ಓದುವ ಭಾಷೆ';

  @override
  String get readingHideLabel => 'ಶ್ಲೋಕಗಳಲ್ಲಿ ಮರೆಮಾಡಿ';

  @override
  String get readingHideSanskrit => 'ಸಂಸ್ಕೃತ';

  @override
  String get readingHideTransliteration => 'ಲಿಪ್ಯಂತರ';

  @override
  String get readingModeLabel => 'ಓದುವ ವಿಧಾನ';

  @override
  String get readingModeVerses => 'ಶ್ಲೋಕದಿಂದ ಶ್ಲೋಕಕ್ಕೆ';

  @override
  String get readingModeStory => 'ಕಥೆ';

  @override
  String get readingStoryShowLabel => 'ಕಥೆಯಲ್ಲಿ ತೋರಿಸುವುದು';

  @override
  String get readingStoryNumbers => 'ಶ್ಲೋಕ ಸಂಖ್ಯೆಗಳು';

  @override
  String get readingStoryHint =>
      'ಶ್ಲೋಕವನ್ನು ಒತ್ತಿ ಹಿಡಿಯಿರಿ — ಅದನ್ನು ಪ್ಲೇ ಮಾಡಲು, ಬುಕ್‌ಮಾರ್ಕ್ ಮಾಡಲು, ಹೈಲೈಟ್ ಮಾಡಲು ಅಥವಾ ಟಿಪ್ಪಣಿ ಸೇರಿಸಲು.';

  @override
  String get readingStoryNothing =>
      'ನೀವು ಆರಿಸಿದ ಭಾಗಕ್ಕೆ ಈ ಅಧ್ಯಾಯದಲ್ಲಿ ಏನೂ ಇಲ್ಲ. ಮೇಲೆ ಬೇರೊಂದನ್ನು ಆರಿಸಿ.';

  @override
  String get readingPartMeaning => 'ಅರ್ಥ';

  @override
  String get routineSubtitle => 'ಭಕ್ತಿ, ಕೆಲಸ ಮತ್ತು ನಡುವಿನ ಸಾಮಾನ್ಯ ವಿಷಯಗಳು.';

  @override
  String routineProgress(int done, int total) {
    return '$total ರಲ್ಲಿ $done ಮುಗಿದಿವೆ';
  }

  @override
  String get routineEmptyBody =>
      'ಒಂದು ಮಾಲೆ ಜಪ, ಒಂದು ಕೆಲಸ, ಒಂದು ಜವಾಬ್ದಾರಿ ಸೇರಿಸಿ — ಇಂದಿನ ದಿನವನ್ನು ಉದ್ದೇಶದಿಂದ ರೂಪಿಸಿ.';

  @override
  String get routineAddTask => 'ಕೆಲಸ ಸೇರಿಸಿ';

  @override
  String get routineTaskHint => 'ಏನು ಮಾಡಬೇಕು?';

  @override
  String get routineCategoryLabel => 'ವರ್ಗ';

  @override
  String get routineCategoryDevotion => 'ಭಕ್ತಿ';

  @override
  String get routineCategoryWork => 'ಕೆಲಸ';

  @override
  String get routineCategoryHome => 'ಮನೆ';

  @override
  String get routineCategoryErrand => 'ಹೊರಗಿನ ಕೆಲಸ';

  @override
  String get routineSlotMorning => 'ಬೆಳಿಗ್ಗೆ';

  @override
  String get routineSlotAfternoon => 'ಮಧ್ಯಾಹ್ನ';

  @override
  String get routineSlotEvening => 'ಸಂಜೆ';

  @override
  String get routineSlotAnytime => 'ಯಾವಾಗ ಬೇಕಾದರೂ';

  @override
  String get routinePresetWakeUp => 'ಎಚ್ಚರಗೊಳ್ಳುವುದು';

  @override
  String get routinePresetMorningChant => 'ಬೆಳಗಿನ ಜಪ';

  @override
  String get routinePresetExercise => 'ವ್ಯಾಯಾಮ';

  @override
  String get routinePresetBreakfast => 'ಬೆಳಗಿನ ತಿಂಡಿ';

  @override
  String get routinePresetLunch => 'ಮಧ್ಯಾಹ್ನದ ಊಟ';

  @override
  String get routinePresetEveningChant => 'ಸಂಜೆಯ ಜಪ';

  @override
  String get routinePresetDinner => 'ರಾತ್ರಿಯ ಊಟ';

  @override
  String get routinePresetScriptureReading => 'ಶಾಸ್ತ್ರ ಪಠಣ';

  @override
  String get routinePresetSleep => 'ನಿದ್ರೆ';

  @override
  String get routineTaskNameLabel => 'ಕೆಲಸದ ಹೆಸರು';

  @override
  String get routineWindowHeading => 'ನಿಗದಿತ ಸಮಯ';

  @override
  String get routineWindowHint =>
      'ಈ ಅವಧಿಯೊಳಗೆ ಮಾಡಿದರೆ ಸರಿಯಾದ ಸಮಯ, ಅದಕ್ಕೂ ಮೊದಲು ಮಾಡಿದರೆ ಬೇಗ, ಅದರ ನಂತರ ಮಾಡಿದರೆ ತಡ ಎಂದು ಪರಿಗಣಿಸಲಾಗುತ್ತದೆ.';

  @override
  String get routineWindowSet => 'ಸಮಯದ ಅವಧಿ ನಿಗದಿಪಡಿಸಿ';

  @override
  String get routineWindowClear => 'ಸಮಯದ ಅವಧಿ ತೆಗೆಯಿರಿ';

  @override
  String get routineWindowFrom => 'ಇಂದ';

  @override
  String get routineWindowTo => 'ವರೆಗೆ';

  @override
  String routineWindowRange(String start, String end) {
    return '$start – $end';
  }

  @override
  String get routineWindowInvalid => 'ಮುಕ್ತಾಯದ ಸಮಯ ಆರಂಭದ ನಂತರ ಇರಬೇಕು.';

  @override
  String get routineStatusNotDone => 'ಮುಗಿದಿಲ್ಲ';

  @override
  String get routineStatusDone => 'ಮುಗಿದಿದೆ';

  @override
  String get routineStatusEarly => 'ಬೇಗ';

  @override
  String get routineStatusOnTime => 'ಸರಿಯಾದ ಸಮಯಕ್ಕೆ';

  @override
  String get routineStatusLate => 'ತಡ';

  @override
  String routineStatusAtTime(String status, String time) {
    return '$status · $time';
  }

  @override
  String get routineChangeTime => 'ಸಮಯ ಬದಲಿಸಿ';

  @override
  String get routinePickDoneTime => 'ಇದು ಯಾವಾಗ ಮುಗಿಯಿತು?';

  @override
  String get routineSaveAction => 'ಈ ದಿನಕ್ಕೆ ಸೇರಿಸಿ';

  @override
  String get routineTaskRemoved => 'ಈ ದಿನದಿಂದ ತೆಗೆದುಹಾಕಲಾಗಿದೆ';

  @override
  String get routineUndo => 'ರದ್ದುಗೊಳಿಸಿ';

  @override
  String get routineToday => 'ಇಂದು';

  @override
  String get routineJumpToToday => 'ಇಂದಿಗೆ ಹೋಗಿ';

  @override
  String get routineEkadashi => 'ಏಕಾದಶಿ';

  @override
  String get routineEkadashiNote =>
      'ಅಂದಾಜು ದಿನಾಂಕ — ದೇವಾಲಯದ ಪಂಚಾಂಗದಲ್ಲಿ ಒಂದು ದಿನದ ವ್ಯತ್ಯಾಸ ಇರಬಹುದು.';

  @override
  String routineDayLabel(String date, String ekadashi, int done, int total) {
    String _temp0 = intl.Intl.selectLogic(ekadashi, {
      'yes': ' · ಏಕಾದಶಿ',
      'other': '',
    });
    String _temp1 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: ' · $total ರಲ್ಲಿ $done ಮುಗಿದಿವೆ',
      zero: '',
    );
    return '$date$_temp0$_temp1';
  }

  @override
  String get routineNothingPlanned => 'ಈ ದಿನಕ್ಕೆ ಏನನ್ನೂ ಯೋಜಿಸಿಲ್ಲ.';

  @override
  String get routineManageDaily => 'ದೈನಂದಿನ ದಿನಚರಿ';

  @override
  String get routineDailyTitle => 'ದೈನಂದಿನ ದಿನಚರಿ';

  @override
  String get routineDailyBody =>
      'ಐಚ್ಛಿಕ. ಇವು ಪ್ರತಿದಿನ ಪುನರಾವರ್ತನೆಯಾಗುತ್ತವೆ, ಪ್ರತಿದಿನ ಹೊಸದಾಗಿ ಟಿಕ್ ಮಾಡಬಹುದು.';

  @override
  String get routineDailyEmpty => 'ದೈನಂದಿನ ದಿನಚರಿ ಇನ್ನೂ ಇಲ್ಲ.';

  @override
  String get routineDailyAdd => 'ದೈನಂದಿನ ದಿನಚರಿಗೆ ಸೇರಿಸಿ';

  @override
  String get routineDailySaveAction => 'ಪ್ರತಿದಿನಕ್ಕೆ ಸೇರಿಸಿ';

  @override
  String get routineDailyBadge => 'ಪ್ರತಿದಿನ';

  @override
  String get routineDailyRemove => 'ದೈನಂದಿನ ದಿನಚರಿಯಿಂದ ತೆಗೆದುಹಾಕಿ';

  @override
  String get routineDailyRemoved => 'ನಿಮ್ಮ ದೈನಂದಿನ ದಿನಚರಿಯಿಂದ ತೆಗೆದುಹಾಕಲಾಗಿದೆ';

  @override
  String get reelsEmpty => 'ಇನ್ನೂ ರೀಲ್ಸ್ ಇಲ್ಲ';

  @override
  String get reelsEmptyBody =>
      'ಕ್ರಿಯೇಟರ್‌ಗಳು ಪೋಸ್ಟ್ ಮಾಡಲು ಆರಂಭಿಸಿದಾಗ ಅವರ ರೀಲ್ಸ್ ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.';

  @override
  String get reelsFailed => 'ರೀಲ್ಸ್ ಲೋಡ್ ಮಾಡಲು ಆಗಲಿಲ್ಲ';

  @override
  String get reelsRetry => 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ';

  @override
  String get reelFollow => 'ಫಾಲೋ';

  @override
  String get reelFollowing => 'ಫಾಲೋ ಮಾಡುತ್ತಿದ್ದೀರಿ';

  @override
  String get reelLike => 'ಇಷ್ಟ';

  @override
  String get reelUnlike => 'ಇಷ್ಟ ತೆಗೆದುಹಾಕಿ';

  @override
  String get reelComment => 'ಕಾಮೆಂಟ್';

  @override
  String get reelShare => 'ಹಂಚಿಕೊಳ್ಳಿ';

  @override
  String get reelSave => 'ಉಳಿಸಿ';

  @override
  String get reelUnsave => 'ಉಳಿಸಿದವುಗಳಿಂದ ತೆಗೆದುಹಾಕಿ';

  @override
  String get reelSaved => 'ಉಳಿಸಲಾಗಿದೆ';

  @override
  String get reelRemovedFromSaved => 'ಉಳಿಸಿದವುಗಳಿಂದ ತೆಗೆದುಹಾಕಲಾಗಿದೆ';

  @override
  String get reelMore => 'ಇನ್ನಷ್ಟು ಆಯ್ಕೆಗಳು';

  @override
  String get reelMuted => 'ಧ್ವನಿ ಆಫ್';

  @override
  String get reelUnmuted => 'ಧ್ವನಿ ಆನ್';

  @override
  String get reelPlay => 'ಪ್ಲೇ';

  @override
  String get reelPause => 'ವಿರಾಮ';

  @override
  String get reelVideoUnavailable => 'ಈ ವೀಡಿಯೊ ಇನ್ನೂ ಪ್ರಕ್ರಿಯೆಗೊಳ್ಳುತ್ತಿದೆ.';

  @override
  String get reelAudioUnavailable => 'ಈ ಪಾರಾಯಣ ಇನ್ನೂ ಪ್ರಕ್ರಿಯೆಗೊಳ್ಳುತ್ತಿದೆ.';

  @override
  String get reelSimilar => 'ಇಂತಹವು ಇನ್ನಷ್ಟು';

  @override
  String get reelSimilarEmpty => 'ಇಂತಹ ರೀಲ್ಸ್ ಇನ್ನೂ ಇಲ್ಲ.';

  @override
  String reelSlideOf(int current, int total) {
    return '$current / $total';
  }

  @override
  String get reelBookGita => 'BG';

  @override
  String get reelBookBhagavatam => 'SB';

  @override
  String get reelCaptionMore => 'ಇನ್ನಷ್ಟು';

  @override
  String get reelCaptionLess => 'ಕಡಿಮೆ';

  @override
  String get reelCommentsTitle => 'ಕಾಮೆಂಟ್‌ಗಳು';

  @override
  String reelCommentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಕಾಮೆಂಟ್‌ಗಳು',
      one: '1 ಕಾಮೆಂಟ್',
      zero: 'ಇನ್ನೂ ಕಾಮೆಂಟ್‌ಗಳಿಲ್ಲ',
    );
    return '$_temp0';
  }

  @override
  String get reelCommentsEmpty => 'ಮೊದಲು ನೀವೇ ಏನಾದರೂ ಹೇಳಿ.';

  @override
  String get reelCommentHint => 'ಕಾಮೆಂಟ್ ಸೇರಿಸಿ…';

  @override
  String reelReplyHint(String name) {
    return '$name ಅವರಿಗೆ ಉತ್ತರಿಸಿ…';
  }

  @override
  String get reelCommentSend => 'ಪೋಸ್ಟ್';

  @override
  String get reelCommentReply => 'ಉತ್ತರಿಸಿ';

  @override
  String get reelCommentDelete => 'ಅಳಿಸಿ';

  @override
  String get reelCommentReport => 'ವರದಿ ಮಾಡಿ';

  @override
  String get reelCommentPin => 'ಪಿನ್';

  @override
  String get reelCommentUnpin => 'ಅನ್‌ಪಿನ್';

  @override
  String get reelCommentPinned => 'ಪಿನ್ ಮಾಡಲಾಗಿದೆ';

  @override
  String get reelCommentRemoved => 'ಈ ಕಾಮೆಂಟ್ ಅನ್ನು ತೆಗೆದುಹಾಕಲಾಗಿದೆ.';

  @override
  String get reelCommentDeleted => 'ಕಾಮೆಂಟ್ ಅಳಿಸಲಾಗಿದೆ';

  @override
  String get reelCommentDeleteTitle => 'ಈ ಕಾಮೆಂಟ್ ಅನ್ನು ಅಳಿಸಬೇಕೆ?';

  @override
  String get reelCommentDeleteBody =>
      'ಇದು ಎಲ್ಲರಿಗೂ ತೆಗೆದುಹಾಕಲ್ಪಡುತ್ತದೆ, ಇದಕ್ಕೆ ಬಂದ ಉತ್ತರಗಳ ಸಹಿತ.';

  @override
  String get reelCommentCancelReply => 'ಉತ್ತರ ರದ್ದುಮಾಡಿ';

  @override
  String reelViewReplies(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಉತ್ತರಗಳನ್ನು ನೋಡಿ',
      one: '1 ಉತ್ತರ ನೋಡಿ',
    );
    return '$_temp0';
  }

  @override
  String get reelHideReplies => 'ಉತ್ತರಗಳನ್ನು ಮರೆಮಾಡಿ';

  @override
  String get reelLoadMoreComments => 'ಇನ್ನಷ್ಟು ಕಾಮೆಂಟ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಿ';

  @override
  String get reelReportTitle => 'ಈ ರೀಲ್ ಅನ್ನು ವರದಿ ಮಾಡಿ';

  @override
  String get reelReportCommentTitle => 'ಈ ಕಾಮೆಂಟ್ ಅನ್ನು ವರದಿ ಮಾಡಿ';

  @override
  String get reelReportBody =>
      'ಇದರಲ್ಲಿ ಏನು ತಪ್ಪಿದೆ ಎಂದು ನಮಗೆ ತಿಳಿಸಿ. ಒಬ್ಬ ಮಾಡರೇಟರ್ ಇದನ್ನು ಪರಿಶೀಲಿಸುತ್ತಾರೆ.';

  @override
  String get reelReportSpam => 'ಸ್ಪ್ಯಾಮ್ ಅಥವಾ ದಾರಿತಪ್ಪಿಸುವಂತಹದ್ದು';

  @override
  String get reelReportHarassment => 'ಕಿರುಕುಳ ಅಥವಾ ನಿಂದನೆ';

  @override
  String get reelReportNonDevotional => 'ಭಕ್ತಿಗೆ ಸಂಬಂಧಿಸಿದ ವಿಷಯವಲ್ಲ';

  @override
  String get reelReportMisinformation => 'ತಪ್ಪು ಮಾಹಿತಿ';

  @override
  String get reelReportSexualOrViolent => 'ಲೈಂಗಿಕ ಅಥವಾ ಹಿಂಸಾತ್ಮಕ';

  @override
  String get reelReportOther => 'ಬೇರೇನಾದರೂ';

  @override
  String get reelReportNoteHint =>
      'ನಾವು ತಿಳಿದುಕೊಳ್ಳಬೇಕಾದ ಇನ್ನೇನಾದರೂ ಇದೆಯೇ? (ಐಚ್ಛಿಕ)';

  @override
  String get reelReportSubmit => 'ವರದಿ ಮಾಡಿ';

  @override
  String get reelReportThanks => 'ಧನ್ಯವಾದಗಳು. ಒಬ್ಬ ಮಾಡರೇಟರ್ ಇದನ್ನು ನೋಡುತ್ತಾರೆ.';

  @override
  String get reelShareTitle => 'ಈ ರೀಲ್ ಅನ್ನು ಹಂಚಿಕೊಳ್ಳಿ';

  @override
  String reelShareMessage(String caption, String link) {
    return '$caption\n\nHariHariBol ನಲ್ಲಿ ನೋಡಿ: $link';
  }

  @override
  String get reelCopyLink => 'ಲಿಂಕ್ ನಕಲಿಸಿ';

  @override
  String get reelLinkCopied => 'ಲಿಂಕ್ ನಕಲಿಸಲಾಗಿದೆ';

  @override
  String get creatorTitle => 'ಕ್ರಿಯೇಟರ್';

  @override
  String creatorFollowers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಫಾಲೋಯರ್‌ಗಳು',
      one: '1 ಫಾಲೋಯರ್',
    );
    return '$_temp0';
  }

  @override
  String creatorReelCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ರೀಲ್ಸ್',
      one: '1 ರೀಲ್',
    );
    return '$_temp0';
  }

  @override
  String creatorViews(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ವೀಕ್ಷಣೆಗಳು',
      one: '1 ವೀಕ್ಷಣೆ',
    );
    return '$_temp0';
  }

  @override
  String get creatorStatFollowers => 'ಫಾಲೋಯರ್‌ಗಳು';

  @override
  String get creatorStatReels => 'ರೀಲ್ಸ್';

  @override
  String get creatorStatViews => 'ವೀಕ್ಷಣೆಗಳು';

  @override
  String get creatorVerified => 'ಪರಿಶೀಲಿತ ಕ್ರಿಯೇಟರ್';

  @override
  String get creatorNoReels => 'ಇನ್ನೂ ಏನನ್ನೂ ಪೋಸ್ಟ್ ಮಾಡಿಲ್ಲ.';

  @override
  String get creatorNotFound => 'ಆ ಕ್ರಿಯೇಟರ್ ಈಗ ಇಲ್ಲಿಲ್ಲ.';

  @override
  String get chantAnalyticsTooltip => 'ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಇತಿಹಾಸ';

  @override
  String get chantSittingTime => 'ಸೆಶನ್ ಸಮಯ';

  @override
  String chantMalaTime(int number) {
    return 'ಮಾಲೆ $number ಸಮಯ';
  }

  @override
  String get chantStatCurrentMala => 'ಪ್ರಸ್ತುತ ಮಾಲೆ';

  @override
  String get chantStatCount => 'ಎಣಿಕೆ';

  @override
  String get chantStatMalasDone => 'ಮುಗಿದ ಮಾಲೆಗಳು';

  @override
  String get chantStatAvgMala => 'ಮಾಲೆಗೆ ಸರಾಸರಿ';

  @override
  String get chantStatAvgChant => 'ಜಪಕ್ಕೆ ಸರಾಸರಿ';

  @override
  String get chantStatTotalChants => 'ಒಟ್ಟು ಜಪಗಳು';

  @override
  String get chantStatFastestMala => 'ಅತ್ಯಂತ ವೇಗದ ಮಾಲೆ';

  @override
  String get chantStatTotalTime => 'ಒಟ್ಟು ಸಮಯ';

  @override
  String get chantNoValue => '—';

  @override
  String get chantRecentTitle => 'ಇತ್ತೀಚಿನ ಜಪಗಳು';

  @override
  String get chantRecentEmpty => 'ಆರಂಭಿಸಲು ವೃತ್ತವನ್ನು ಟ್ಯಾಪ್ ಮಾಡಿ.';

  @override
  String chantTapNumber(int seq) {
    return '#$seq';
  }

  @override
  String get chantAutoBadge => 'ಸ್ವಯಂ';

  @override
  String get chantDetectWords => 'ಪದಗಳನ್ನು ಗುರುತಿಸಿ';

  @override
  String get chantDetectWordsOff => 'ಆಫ್ — ಪದಗಳನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡುವುದಿಲ್ಲ';

  @override
  String get chantDetectWordsListening => 'ಪದಗಳಿಗಾಗಿ ಆಲಿಸುತ್ತಿದೆ…';

  @override
  String get chantDetectWordsPermission => 'ಮೈಕ್ರೋಫೋನ್ ಅನುಮತಿ ಬೇಕು';

  @override
  String get chantDetectWordsStarting => 'ಸಿದ್ಧವಾಗುತ್ತಿದೆ…';

  @override
  String get chantDetectWordsUnavailable =>
      'ಈ ಸಾಧನದಲ್ಲಿ ಪದ ಗುರುತಿಸುವಿಕೆ ಲಭ್ಯವಿಲ್ಲ';

  @override
  String get chantDetectWordsNote =>
      'ಪದಗಳನ್ನು ನಿಮ್ಮ ಫೋನ್‌ನಲ್ಲಿಯೇ ಗುರುತಿಸಲಾಗುತ್ತದೆ, ಆಡಿಯೊವನ್ನು ಎಂದಿಗೂ ರೆಕಾರ್ಡ್ ಮಾಡುವುದಿಲ್ಲ. ಪಠ್ಯವನ್ನು 7 ದಿನಗಳ ಕಾಲ ಇರಿಸಿ, ನಂತರ ಅಳಿಸಲಾಗುತ್ತದೆ.';

  @override
  String get chantSetupTitle => 'ಜಪ ಸಹಾಯಕಗಳು';

  @override
  String get chantSetupSubtitle =>
      'ಈ ಸೆಶನ್ ಅನ್ನು ಹೇಗೆ ಎಣಿಸಬೇಕು ಮತ್ತು ದಾಖಲಿಸಬೇಕು ಎಂದು ಆರಿಸಿ. ಆಲಿಸುವಿಕೆ ನಿಮ್ಮ ಫೋನ್‌ನಲ್ಲಿಯೇ ನಡೆಯುತ್ತದೆ.';

  @override
  String get chantSetupButton => 'ಸ್ವಯಂ ಎಣಿಕೆ & ಪದಗಳು';

  @override
  String get chantSetupNoneOn => 'ಸೆಟಪ್';

  @override
  String chantSetupOn(int count) {
    return '$count ಆನ್';
  }

  @override
  String chantSetupButtonState(String button, String state) {
    return '$button · $state';
  }

  @override
  String get chantSetupDone => 'ಮುಗಿಯಿತು';

  @override
  String get chantAnalyticsTitle => 'ಜಪ ವಿಶ್ಲೇಷಣೆ';

  @override
  String get chantTabThisSitting => 'ಈ ಸೆಶನ್';

  @override
  String get chantTabHistory => 'ಇತಿಹಾಸ';

  @override
  String chantMalaTitle(int number) {
    return 'ಮಾಲೆ $number';
  }

  @override
  String get chantMalaInProgress => 'ನಡೆಯುತ್ತಿದೆ';

  @override
  String get chantMalaStart => 'ಆರಂಭ';

  @override
  String get chantMalaEnd => 'ಮುಕ್ತಾಯ';

  @override
  String get chantMalaDuration => 'ಅವಧಿ';

  @override
  String chantMalaChants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ಜಪಗಳು',
      one: '1 ಜಪ',
    );
    return '$_temp0';
  }

  @override
  String get chantTapsHeader => 'ಪ್ರತಿ ಜಪ';

  @override
  String get chantHeardLabel => 'ಕೇಳಿಸಿದ್ದು';

  @override
  String get chantNoMalasYet =>
      'ಈ ಸೆಶನ್‌ನಲ್ಲಿ ಇನ್ನೂ ಜಪಗಳಿಲ್ಲ. ನೀವು ಪೂರ್ಣಗೊಳಿಸುವ ಪ್ರತಿ ಮಾಲೆಯೂ ಅದರ ಆರಂಭ, ಮುಕ್ತಾಯ ಮತ್ತು ತೆಗೆದುಕೊಂಡ ಸಮಯದೊಂದಿಗೆ ಇಲ್ಲಿ ಪಟ್ಟಿಯಾಗುತ್ತದೆ.';

  @override
  String get chantHistoryEmpty => 'ಹಿಂದಿನ ಸೆಶನ್‌ಗಳು ಇನ್ನೂ ಇಲ್ಲ.';

  @override
  String chantHistorySummary(int malas, int chants) {
    return '$malas ಮಾಲೆಗಳು · $chants ಜಪಗಳು';
  }

  @override
  String get chantHistoryNoDetail => 'ಜಪದ ಸಮಯವನ್ನು ದಾಖಲಿಸುವ ಮೊದಲು ಎಣಿಸಲಾಗಿದೆ';

  @override
  String get chantSessionTitle => 'ಸೆಶನ್';

  @override
  String get chantSessionNoMalas =>
      'ಈ ಸೆಶನ್‌ಗೆ ಸಮಯ ದಾಖಲಾದ ಮಾಲೆಗಳು ಯಾವುದೂ ಇಲ್ಲ.';

  @override
  String get chantHeardExpiry =>
      'ಕೇಳಿಸಿದ ಪದಗಳನ್ನು ಸೆಶನ್ ಆದ 7 ದಿನಗಳ ನಂತರ ನಿಮ್ಮ ಖಾತೆಯಿಂದ ತೆಗೆದುಹಾಕಲಾಗುತ್ತದೆ.';

  @override
  String get chantHeardTitle => 'ಈಗ ಕೇಳಿಸಿದ್ದು';

  @override
  String get chantHeardHearing => 'ನಿಮ್ಮನ್ನು ಆಲಿಸುತ್ತಿದೆ…';

  @override
  String get chantHeardWaiting => 'ನಿಮ್ಮ ಧ್ವನಿಗಾಗಿ ಕಾಯುತ್ತಿದೆ';

  @override
  String get chantHeardPlaceholder =>
      'ಗಟ್ಟಿಯಾಗಿ ಜಪಿಸಿ. ನಿಮ್ಮ ಫೋನ್ ಕೇಳುವ ಪದಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.';

  @override
  String get chantHeardLast => 'ಕೊನೆಯದಾಗಿ ಕೇಳಿಸಿದ್ದು';

  @override
  String chantHeardCounted(int count) {
    return 'ಎಣಿಸಲಾಯಿತು +$count';
  }

  @override
  String get chantHeardNotCounted => 'ಎಣಿಸಲಿಲ್ಲ';

  @override
  String chantHeardMatch(int percent, int needed) {
    return '$percent% ಹೊಂದಿಕೆ · ಬೇಕಾದದ್ದು $needed%';
  }

  @override
  String chantHeardMatchShort(int percent) {
    return '$percent% ಹೊಂದಿಕೆ';
  }

  @override
  String get chantHeardEarlier => 'ಹಿಂದಿನದು';

  @override
  String get chantAlongTitle => 'ಜೊತೆಗೆ ಜಪಿಸಿ';

  @override
  String get chantAlongCaption =>
      'ರೆಕಾರ್ಡಿಂಗ್‌ನೊಂದಿಗೆ ಕೌಂಟರ್ ಎಣಿಸುತ್ತದೆ. ಅದು ಪ್ಲೇ ಆಗುತ್ತಿರುವಾಗ ಸ್ವಯಂ ಎಣಿಕೆ ಮತ್ತು ಪದ ಗುರುತಿಸುವಿಕೆ ವಿಶ್ರಾಂತಿ ಪಡೆಯುತ್ತವೆ.';

  @override
  String get chantAlongPlay => 'ರೆಕಾರ್ಡಿಂಗ್ ಪ್ಲೇ ಮಾಡಿ';

  @override
  String get chantAlongPause => 'ರೆಕಾರ್ಡಿಂಗ್ ವಿರಾಮಗೊಳಿಸಿ';

  @override
  String get chantAlongPosition => 'ರೆಕಾರ್ಡಿಂಗ್‌ನಲ್ಲಿನ ಸ್ಥಾನ';

  @override
  String get chantAlongLoading => 'ರೆಕಾರ್ಡಿಂಗ್ ಲೋಡ್ ಆಗುತ್ತಿದೆ…';

  @override
  String get chantAlongLoadFailed => 'ರೆಕಾರ್ಡಿಂಗ್ ಅನ್ನು ಲೋಡ್ ಮಾಡಲು ಆಗಲಿಲ್ಲ.';

  @override
  String get settingsSectionLanguages => 'ಭಾಷೆಗಳು';

  @override
  String get settingsLanguageApp => 'ಆ್ಯಪ್ ಭಾಷೆ';

  @override
  String get settingsLanguageAppHint => 'ಮೆನುಗಳು, ಬಟನ್‌ಗಳು ಮತ್ತು ಲೇಬಲ್‌ಗಳು';

  @override
  String get settingsLanguageReading => 'ಓದುವ ಭಾಷೆ';

  @override
  String get settingsLanguageReadingHint => 'ಅನುವಾದ, ಅರ್ಥ ಮತ್ತು ತಾತ್ಪರ್ಯ';

  @override
  String get settingsLanguageSpeaking => 'ಮಾತನಾಡುವ ಮತ್ತು ಕೇಳುವ ಭಾಷೆ';

  @override
  String get settingsLanguageSpeakingHint => 'ಆಡಿಯೊ ಮತ್ತು ಓದಿ ಹೇಳುವ ಅರ್ಥ';

  @override
  String get settingsLanguagePickerApp => 'ಆ್ಯಪ್ ಭಾಷೆಯನ್ನು ಆರಿಸಿ';

  @override
  String get settingsLanguagePickerReading => 'ಓದುವ ಭಾಷೆಯನ್ನು ಆರಿಸಿ';

  @override
  String get settingsLanguagePickerSpeaking => 'ಮಾತನಾಡುವ ಭಾಷೆಯನ್ನು ಆರಿಸಿ';

  @override
  String get settingsLanguageSanskritNote =>
      'ಸಂಸ್ಕೃತ ಶ್ಲೋಕಗಳು ಯಾವಾಗಲೂ ಸಂಸ್ಕೃತದಲ್ಲೇ ಇರುತ್ತವೆ.';

  @override
  String get readingAudioPlayAll => 'ಓದಿ ಹೇಳಿ';

  @override
  String get readingAudioPlayVerse => 'ಈ ಶ್ಲೋಕವನ್ನು ಪ್ಲೇ ಮಾಡಿ';

  @override
  String get readingAudioPause => 'ವಿರಾಮ';

  @override
  String get readingAudioResume => 'ಮುಂದುವರಿಸಿ';

  @override
  String get readingAudioStop => 'ನಿಲ್ಲಿಸಿ';

  @override
  String get readingAudioNext => 'ಮುಂದಿನ ಶ್ಲೋಕ';

  @override
  String get readingAudioPrevious => 'ಹಿಂದಿನ ಶ್ಲೋಕ';

  @override
  String get readingAudioFromStart => 'ಆರಂಭದಿಂದ';

  @override
  String readingAudioResumeFrom(int number) {
    return 'ಶ್ಲೋಕ $number ರಿಂದ ಮುಂದುವರಿಸಿ';
  }

  @override
  String readingAudioNowPlaying(String section, int number) {
    return '$section · ಶ್ಲೋಕ $number';
  }

  @override
  String get readingAudioLoading => 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…';

  @override
  String get readingAudioChannel => 'ಓದಿ ಹೇಳುವುದು';

  @override
  String get pushChannelName => 'ದೈನಿಕ ಶ್ಲೋಕ ಮತ್ತು ಸೂಚನೆಗಳು';

  @override
  String get readingSectionVerse => 'ಶ್ಲೋಕ';

  @override
  String get readingSectionMeaning => 'ಅರ್ಥ';

  @override
  String get readingSectionPurport => 'ತಾತ್ಪರ್ಯ';

  @override
  String get settingsVoices => 'ಧ್ವನಿಗಳು';

  @override
  String settingsVoicesValue(int count) {
    return '$count ಇನ್‌ಸ್ಟಾಲ್ ಆಗಿವೆ';
  }

  @override
  String get voicesTitle => 'ಧ್ವನಿಗಳು';

  @override
  String get voicesIntro =>
      'ಅರ್ಥ ಮತ್ತು ತಾತ್ಪರ್ಯಗಳನ್ನು ನಿಮ್ಮ ಮಾತನಾಡುವ ಭಾಷೆಯಲ್ಲಿ ಓದಿ ಹೇಳಲಾಗುತ್ತದೆ. ಧ್ವನಿ ಡೌನ್‌ಲೋಡ್ ಆಗುವವರೆಗೆ ನಿಮ್ಮ ಫೋನ್‌ನ ಸ್ವಂತ ಧ್ವನಿಯನ್ನು ಬಳಸಲಾಗುತ್ತದೆ, ಆದ್ದರಿಂದ ಓದುವಿಕೆ ಎಂದಿಗೂ ಕಾಯುವುದಿಲ್ಲ.';

  @override
  String voicesStorage(String size) {
    return 'ಈ ಫೋನ್‌ನಲ್ಲಿ $size ಬಳಸಲಾಗುತ್ತಿದೆ';
  }

  @override
  String get voicesEmpty =>
      'ಡೌನ್‌ಲೋಡ್ ಮಾಡಲು ಧ್ವನಿಗಳು ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ. ನಿಮ್ಮ ಫೋನ್‌ನ ಸ್ವಂತ ಧ್ವನಿಯನ್ನು ಬಳಸಲಾಗುತ್ತದೆ.';

  @override
  String get voiceDownload => 'ಡೌನ್‌ಲೋಡ್';

  @override
  String get voiceDelete => 'ಅಳಿಸಿ';

  @override
  String get voiceCancel => 'ರದ್ದುಮಾಡಿ';

  @override
  String get voiceRetry => 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ';

  @override
  String voiceInstalled(String size) {
    return 'ಇನ್‌ಸ್ಟಾಲ್ ಆಗಿದೆ · $size';
  }

  @override
  String voiceNotInstalled(String size) {
    return 'ಡೌನ್‌ಲೋಡ್ ಆಗಿಲ್ಲ · $size';
  }

  @override
  String voiceDownloading(int percent) {
    return 'ಡೌನ್‌ಲೋಡ್ ಆಗುತ್ತಿದೆ $percent%';
  }

  @override
  String get voiceVerifying => 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…';

  @override
  String get voiceExtracting => 'ಇನ್‌ಸ್ಟಾಲ್ ಆಗುತ್ತಿದೆ…';

  @override
  String get voiceFailed => 'ಈ ಧ್ವನಿಯನ್ನು ಇನ್‌ಸ್ಟಾಲ್ ಮಾಡಲು ಆಗಲಿಲ್ಲ';

  @override
  String get voiceUnavailable =>
      'ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲ · ನಿಮ್ಮ ಫೋನ್‌ನ ಧ್ವನಿಯನ್ನು ಬಳಸುತ್ತದೆ';

  @override
  String get voiceDeleteTitle => 'ಈ ಧ್ವನಿಯನ್ನು ಅಳಿಸಬೇಕೆ?';

  @override
  String get voiceDeleteBody =>
      'ಇದನ್ನು ಮತ್ತೆ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿಕೊಳ್ಳಬಹುದು. ಅಲ್ಲಿಯವರೆಗೆ ನಿಮ್ಮ ಫೋನ್‌ನ ಸ್ವಂತ ಧ್ವನಿಯನ್ನು ಬಳಸಲಾಗುತ್ತದೆ.';

  @override
  String voiceLanguages(String languages) {
    return '$languages ಮಾತನಾಡುತ್ತದೆ';
  }

  @override
  String labelVerseWithSection(int number, String section) {
    return 'ಶ್ಲೋಕ $number · $section';
  }

  @override
  String get chatTitle => 'Sakha ಅವರನ್ನು ಕೇಳಿ';

  @override
  String get chatHomeTitle => 'Sakha ಅವರನ್ನು ಕೇಳಿ';

  @override
  String get chatHomeBody =>
      'ಶಾಸ್ತ್ರ, ಮಂತ್ರ ಮತ್ತು ನಿಮ್ಮ ಸಾಧನೆಯ ಬಗ್ಗೆ ಪ್ರಶ್ನೆಗಳು';

  @override
  String get chatIntroTitle => 'ನಿಮ್ಮ ಸ್ನೇಹಿತ Sakha';

  @override
  String get chatIntroHint => 'ಒಂದು ಶ್ಲೋಕ, ಮಂತ್ರ ಅಥವಾ ನಿಮ್ಮ ಸಾಧನೆಯ ಬಗ್ಗೆ ಕೇಳಿ.';

  @override
  String get chatComposerHint => 'ಪ್ರಶ್ನೆ ಕೇಳಿ';

  @override
  String get chatSend => 'ಕಳುಹಿಸಿ';

  @override
  String get chatStop => 'ನಿಲ್ಲಿಸಿ';

  @override
  String chatCharacterCount(int count, int max) {
    return '$count / $max';
  }

  @override
  String chatCreditsLeft(int percent) {
    return '$percent% ಉಳಿದಿದೆ';
  }

  @override
  String chatCreditsLeftLevel(int percent, String level) {
    return '$percent% ಉಳಿದಿದೆ · $level';
  }

  @override
  String get chatCreditsResetsMidnight => 'ಮಧ್ಯರಾತ್ರಿ ಮರುಹೊಂದುತ್ತದೆ';

  @override
  String chatCreditsRenews(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat('d MMM', localeName);
    final String dateString = dateDateFormat.format(date);

    return 'ನವೀಕರಣ: $dateString';
  }

  @override
  String get chatNotAvailableTitle => 'ಚಾಟ್ ನಿಮ್ಮ ಪ್ಲಾನ್‌ನಲ್ಲಿ ಇಲ್ಲ';

  @override
  String get chatNotAvailableBody =>
      'Sakha ಅವರಿಗೆ ಪ್ರಶ್ನೆ ಕೇಳಲು ನಿಮ್ಮ ಪ್ಲಾನ್ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get chatExhaustedDailyTitle => 'ಇಂದಿನ ಕ್ರೆಡಿಟ್‌ಗಳು ಮುಗಿದಿವೆ';

  @override
  String get chatExhaustedDailyBody =>
      'ಅವು ಮಧ್ಯರಾತ್ರಿ ಮತ್ತೆ ತುಂಬುತ್ತವೆ. ಆಗ ನೀವು ಮುಂದುವರಿಸಬಹುದು, ಅಥವಾ ಹೆಚ್ಚಿನದಕ್ಕಾಗಿ ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get chatExhaustedWalletTitle => 'ನಿಮ್ಮ ಕ್ರೆಡಿಟ್‌ಗಳು ಮುಗಿದಿವೆ';

  @override
  String get chatExhaustedWalletBody =>
      'ಇವು ನಿಮ್ಮ ಪ್ಲಾನ್‌ನೊಂದಿಗೆ ನವೀಕರಣಗೊಳ್ಳುತ್ತವೆ. ನೀವು ಕಾಯಬಹುದು, ಅಥವಾ ಮುಂದುವರಿಸಲು ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ.';

  @override
  String get chatShareUsedTitle => 'ಈ ಚಾಟ್ ತನ್ನ ಪಾಲಿನ ಕ್ರೆಡಿಟ್‌ಗಳನ್ನು ಬಳಸಿದೆ';

  @override
  String get chatShareUsedBody =>
      'ಹೊಸ ಚಾಟ್ ಆರಂಭಿಸಿ, ನೀವು ಇದ್ದ ಜಾಗದಿಂದಲೇ Sakha ಮುಂದುವರಿಸುತ್ತಾರೆ.';

  @override
  String get chatUpgrade => 'ಅಪ್‌ಗ್ರೇಡ್ ಮಾಡಿ';

  @override
  String get chatStartNewChat => 'ಹೊಸ ಚಾಟ್ ಆರಂಭಿಸಿ';

  @override
  String get chatFullTitle => 'ಈ ಚಾಟ್ ತುಂಬಾ ಉದ್ದವಾಗಿದೆ';

  @override
  String get chatFullBody =>
      'ಹೊಸ ಚಾಟ್ ಆರಂಭಿಸಿ, Sakha ನಮ್ಮ ಸಂಭಾಷಣೆಯನ್ನು ಮುಂದುವರಿಸುತ್ತಾರೆ.';

  @override
  String get chatContinuePartial =>
      'ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಸಂದೇಶಗಳ ಸಾರಾಂಶ ಮಾಡಲಾಗಲಿಲ್ಲ, ಆದ್ದರಿಂದ ಹಿಂದಿನ ಭಾಗ ಮಾತ್ರ ಬಂದಿದೆ.';

  @override
  String get chatTidying => 'ನಮ್ಮ ಸಂಭಾಷಣೆಯನ್ನು ಸಂಕ್ಷೇಪಿಸಲಾಗುತ್ತಿದೆ…';

  @override
  String get chatTyping => 'Sakha ಬರೆಯುತ್ತಿದ್ದಾರೆ';

  @override
  String get chatConnectionLost =>
      'ಸಂಪರ್ಕ ಮಧ್ಯದಲ್ಲೇ ಕಡಿತಗೊಂಡಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get chatReplyFailed =>
      'Sakha ಅವರಿಗೆ ಆ ಉತ್ತರವನ್ನು ಪೂರ್ಣಗೊಳಿಸಲಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get chatOverloaded =>
      'Sakha ಈಗ ನಿರತರಾಗಿದ್ದಾರೆ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಸಮಯದಲ್ಲಿ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get chatUnavailable =>
      'Sakha ಈಗ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ವಲ್ಪ ಹೊತ್ತಿನ ನಂತರ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get chatBusy => 'ಈಗಿನ ಉತ್ತರ ಮುಗಿಯುವವರೆಗೆ ದಯವಿಟ್ಟು ಕಾಯಿರಿ.';

  @override
  String get chatTooLong => 'ಈ ಸಂದೇಶ ತುಂಬಾ ಉದ್ದವಾಗಿದೆ. ದಯವಿಟ್ಟು ಚಿಕ್ಕದಾಗಿಸಿ.';

  @override
  String get chatStopped => 'ನಿಲ್ಲಿಸಲಾಗಿದೆ';

  @override
  String get chatInterrupted => 'ಅಡಚಣೆಯಾಗಿದೆ';

  @override
  String get chatCopy => 'ನಕಲಿಸಿ';

  @override
  String get chatCopied => 'ನಕಲಿಸಲಾಗಿದೆ';

  @override
  String get chatShare => 'ಹಂಚಿಕೊಳ್ಳಿ';

  @override
  String get chatRegenerate => 'ಮತ್ತೆ ಉತ್ತರಿಸಿ';

  @override
  String get chatLinkCopied => 'ಲಿಂಕ್ ನಕಲಿಸಲಾಗಿದೆ';

  @override
  String get chatImageUnavailable => 'ಚಿತ್ರ ಲಭ್ಯವಿಲ್ಲ';

  @override
  String get chatClearTooltip => 'ಚಾಟ್ ತೆರವುಗೊಳಿಸಿ';

  @override
  String get chatClearTitle => 'ಈ ಚಾಟ್ ತೆರವುಗೊಳಿಸಬೇಕೇ?';

  @override
  String get chatClearBody =>
      'ನಿಮ್ಮ ಸಂದೇಶಗಳು ಮತ್ತು Sakha ಅವರು ನೀಡಿದ ಉತ್ತರಗಳನ್ನು ತೆಗೆದುಹಾಕಲಾಗುತ್ತದೆ, ಮತ್ತು ನಮ್ಮ ಸಂಭಾಷಣೆ Sakha ಅವರಿಗೆ ನೆನಪಿರುವುದಿಲ್ಲ. ಈಗಾಗಲೇ ಬಳಸಿದ ಕ್ರೆಡಿಟ್‌ಗಳು ಹಿಂತಿರುಗುವುದಿಲ್ಲ.';

  @override
  String get chatClearConfirm => 'ತೆರವುಗೊಳಿಸಿ';

  @override
  String get chatCleared => 'ಚಾಟ್ ತೆರವುಗೊಂಡಿದೆ';

  @override
  String get chatSuggestionsLabel => 'ಇವುಗಳನ್ನು ಕೇಳಿ ನೋಡಿ';

  @override
  String get chatStarter1Title => 'ಬದುಕಿಗೊಂದು ಶ್ಲೋಕ';

  @override
  String get chatStarter1Prompt =>
      'ಭಗವದ್ಗೀತೆ 2.47 ಅನ್ನು ನನಗೆ ವಿವರಿಸಿ — ಫಲದ ಚಿಂತೆ ಇಲ್ಲದೆ ನನ್ನ ಕರ್ತವ್ಯವನ್ನು ಮಾಡುವುದು.';

  @override
  String get chatStarter2Title => 'ಜಪ ಆರಂಭ';

  @override
  String get chatStarter2Prompt =>
      'ಹರೇ ಕೃಷ್ಣ ಮಹಾಮಂತ್ರದ ಜಪವನ್ನು ಹೇಗೆ ಆರಂಭಿಸಲಿ, ಆರಂಭದಲ್ಲಿ ಎಷ್ಟು ಮಾಲೆ ಮಾಡಬೇಕು?';

  @override
  String get chatStarter3Title => 'ದೈನಂದಿನ ಸಾಧನೆ';

  @override
  String get chatStarter3Prompt =>
      'ಬಿಡುವಿಲ್ಲದ ದಿನದಲ್ಲೂ ಮಾಡಬಹುದಾದ ಒಂದು ಸರಳ ದೈನಂದಿನ ಸಾಧನೆಯನ್ನು ಸೂಚಿಸಿ.';

  @override
  String get chatStarter4Title => 'ಮನಸ್ಸು ಚಂಚಲವಾದಾಗ';

  @override
  String get chatStarter4Prompt =>
      'ನನ್ನ ಮನಸ್ಸು ಚಂಚಲವಾಗಿದೆ. ಶಾಂತಿ ಪಡೆಯುವ ಬಗ್ಗೆ ಶಾಸ್ತ್ರಗಳು ಏನು ಹೇಳುತ್ತವೆ?';

  @override
  String get chatStarter5Title => 'ಕೇಳಬೇಕಾದ ಒಂದು ಕಥೆ';

  @override
  String get chatStarter5Prompt =>
      'ಪ್ರಹ್ಲಾದನ ಕಥೆಯನ್ನು ಮತ್ತು ಅದು ಕಲಿಸುವುದನ್ನು ನನಗೆ ಹೇಳಿ.';

  @override
  String get chatFollowUp1 => 'ಸರಳವಾಗಿ ವಿವರಿಸಿ';

  @override
  String get chatFollowUp2 => 'ಒಂದು ಉದಾಹರಣೆ ಕೊಡಿ';

  @override
  String get chatFollowUp3 => 'ಇದು ಏಕೆ ಮುಖ್ಯ?';

  @override
  String get chatFollowUp4 => 'ಇದನ್ನು ಹೇಗೆ ಅಭ್ಯಾಸ ಮಾಡಲಿ?';

  @override
  String get chatAttach => 'ಚಿತ್ರ ಸೇರಿಸಿ';

  @override
  String get chatAttachCamera => 'ಫೋಟೋ ತೆಗೆಯಿರಿ';

  @override
  String get chatAttachGallery => 'ನಿಮ್ಮ ಫೋಟೋಗಳಿಂದ ಆಯ್ಕೆಮಾಡಿ';

  @override
  String get chatAttachNote =>
      'ಚಿತ್ರವನ್ನು ಉತ್ತರ ಬರೆಯಲು ಸಹಾಯ ಮಾಡುವ ಸೇವೆಗೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ, ಮತ್ತು ನೀವು ಚಾಟ್ ತೆರವುಗೊಳಿಸುವವರೆಗೆ ಇಲ್ಲೇ ಇರುತ್ತದೆ.';

  @override
  String get chatImageRemove => 'ಚಿತ್ರ ತೆಗೆದುಹಾಕಿ';

  @override
  String get chatImageUploading => 'ಚಿತ್ರ ಸೇರಿಸಲಾಗುತ್ತಿದೆ…';

  @override
  String get chatImageFailed => 'ಚಿತ್ರ ಸೇರಿಸಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ತಟ್ಟಿ.';

  @override
  String get chatImageRejected =>
      'ಈ ಚಿತ್ರವನ್ನು ಬಳಸಲಾಗುವುದಿಲ್ಲ. ದಯವಿಟ್ಟು ಬೇರೆಯದನ್ನು ಆಯ್ಕೆಮಾಡಿ.';

  @override
  String get chatImageOff => 'ನಿಮ್ಮ ಪ್ಲಾನ್‌ನಲ್ಲಿ ಚಿತ್ರಗಳು ಲಭ್ಯವಿಲ್ಲ.';

  @override
  String get chatImageSemantics => 'ನೀವು ಕಳುಹಿಸಿದ ಚಿತ್ರ';

  @override
  String get chatPictureDenied =>
      'ಚಿತ್ರ ಸೇರಿಸಲು ಫೋನ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಕ್ಯಾಮೆರಾ ಅಥವಾ ಫೋಟೋಗಳ ಅನುಮತಿ ನೀಡಿ.';

  @override
  String get chatMic => 'ಮಾತನಾಡಿ ಪ್ರಶ್ನೆ ಕೇಳಿ';

  @override
  String get chatMicStop => 'ಆಲಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ';

  @override
  String get chatListening => 'ಮಾತನಾಡಿ…';

  @override
  String get chatMicDenied =>
      'ಮಾತನಾಡಲು ಫೋನ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಮೈಕ್ರೋಫೋನ್ ಮತ್ತು ಸ್ಪೀಚ್ ರೆಕಗ್ನಿಷನ್ ಅನುಮತಿ ನೀಡಿ.';

  @override
  String get chatMicUnavailable =>
      'ಈ ಫೋನ್‌ನಲ್ಲಿ ಮಾತನಾಡಿ ಬರೆಯುವ ಸೌಲಭ್ಯ ಲಭ್ಯವಿಲ್ಲ.';

  @override
  String get chatMicNoSpeech => 'ಏನೂ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get chatMicFailed =>
      'ಆಲಿಸುವುದು ನಿಂತುಹೋಯಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';

  @override
  String get chatJumpToLatest => 'ಇತ್ತೀಚಿನದು';
}
