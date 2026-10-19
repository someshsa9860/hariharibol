// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Tamil (`ta`).
class AppLocalizationsTa extends AppLocalizations {
  AppLocalizationsTa([String locale = 'ta']) : super(locale);

  @override
  String get appName => 'HariHariBol';

  @override
  String get splashTagline => 'படியுங்கள் · ஜபியுங்கள் · சாதனா செய்யுங்கள்';

  @override
  String get actionRetry => 'மீண்டும் முயலவும்';

  @override
  String get actionCancel => 'ரத்துசெய்';

  @override
  String get actionOk => 'சரி';

  @override
  String get actionDone => 'முடிந்தது';

  @override
  String get actionSave => 'சேமி';

  @override
  String get actionViewAll => 'அனைத்தையும் காண்க';

  @override
  String get actionSignOut => 'வெளியேறு';

  @override
  String get actionDeleteAccount => 'கணக்கை நீக்கு';

  @override
  String get actionContinue => 'தொடர்க';

  @override
  String get errorGeneric => 'ஏதோ தவறு நடந்துவிட்டது. மீண்டும் முயலவும்.';

  @override
  String get errorNetwork =>
      'இணைப்பு இல்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்.';

  @override
  String get errorTimeout => 'இதற்கு அதிக நேரம் ஆனது. மீண்டும் முயலவும்.';

  @override
  String get errorSessionExpired =>
      'உங்கள் அமர்வு முடிந்துவிட்டது. மீண்டும் உள்நுழையவும்.';

  @override
  String get errorSignIn =>
      'உங்களை உள்நுழைய வைக்க இயலவில்லை. மீண்டும் முயலவும்.';

  @override
  String get errorInsecureConnection => 'இணைப்பு பாதுகாப்பாக இல்லை.';

  @override
  String get errorCancelled => 'கோரிக்கை ரத்து செய்யப்பட்டது.';

  @override
  String get errorEmptyTitle => 'இங்கே இன்னும் எதுவும் இல்லை';

  @override
  String get errorRouteNotFound => 'அந்தத் திரை இல்லை.';

  @override
  String get actionGoHome => 'முகப்புக்குச் செல்';

  @override
  String get signInTitle => 'வரவேற்கிறோம்';

  @override
  String get signInSubtitle =>
      'படியுங்கள், ஜபியுங்கள், உங்கள் தினசரி சாதனாவை ஒரே இடத்தில் பேணுங்கள்.';

  @override
  String get signInWithGoogle => 'Google மூலம் தொடரவும்';

  @override
  String get signInWithApple => 'Apple மூலம் தொடரவும்';

  @override
  String get signInCancelled => 'உள்நுழைவு ரத்து செய்யப்பட்டது.';

  @override
  String get signInFailed =>
      'உங்களை உள்நுழைய வைக்க இயலவில்லை. மீண்டும் முயலவும்.';

  @override
  String get signInLegal =>
      'தொடர்வதன் மூலம் எங்கள் பயன்பாட்டு விதிமுறைகள் மற்றும் தனியுரிமைக் கொள்கையை ஏற்கிறீர்கள்.';

  @override
  String languageStepOf(int current, int total) {
    return 'படி $current / $total';
  }

  @override
  String get languageAppTitle => 'எந்த மொழி உங்களுக்கு வீடு போல் தோன்றுகிறது?';

  @override
  String get languageAppSubtitle =>
      'இதை எப்போது வேண்டுமானாலும் அமைப்புகளில் மாற்றலாம்.';

  @override
  String get languageMantraTitle => 'எந்த எழுத்து வடிவில் ஜபம் செய்கிறீர்கள்?';

  @override
  String get languageMantraSubtitle =>
      'மந்திரங்கள் இந்த எழுத்தில் தோன்றும். அவற்றின் பொருள் உங்கள் சொந்த மொழியிலேயே இருக்கும்.';

  @override
  String get actionBack => 'பின்செல்';

  @override
  String get tabHome => 'முகப்பு';

  @override
  String get tabSadhana => 'ஜபம்';

  @override
  String get tabLibrary => 'வாசிப்பு';

  @override
  String get tabRoutine => 'தினசரி';

  @override
  String get tabSakha => 'Sakha';

  @override
  String get reelsTitle => 'ரீல்ஸ்';

  @override
  String get tabSearch => 'தேடல்';

  @override
  String get homeGreeting => 'ஹரி போல்';

  @override
  String homeGreetingNamed(String name) {
    return 'ஹரி போல், $name';
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
  String get homeMoodPrompt => 'இன்று எப்படி இருக்கிறீர்கள்?';

  @override
  String get homeMoodAnsweredToday =>
      'இன்று உங்கள் உணர்வைப் பகிர்ந்துவிட்டீர்கள். புதிதாகப் பகிர நாளை மீண்டும் வாருங்கள்.';

  @override
  String homeMoodViewToday(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'இன்றைய $count ஸ்லோகங்களை மீண்டும் படிக்க',
      one: 'இன்றைய ஸ்லோகத்தை மீண்டும் படிக்க',
    );
    return '$_temp0';
  }

  @override
  String homeMoodSubmit(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ஸ்லோகங்களைக் காட்டு',
      one: 'ஒரு ஸ்லோகத்தைக் காட்டு',
    );
    return '$_temp0';
  }

  @override
  String get homeVerseOfTheDay => 'இன்றைய ஸ்லோகம்';

  @override
  String get homeSlokaForYou => 'இன்று உங்களுக்காக';

  @override
  String get homeTodaysSadhana => 'இன்றைய சாதனா';

  @override
  String get homeContinueReading => 'படிப்பதைத் தொடரவும்';

  @override
  String get homeBooks => 'நூல்கள்';

  @override
  String get homeMantras => 'மந்திரங்கள்';

  @override
  String get homeStartYourDay => 'இன்றைய இலக்கை அமைக்கவும்';

  @override
  String homeChantMantra(String mantra) {
    return '$mantra ஜபிக்கவும்';
  }

  @override
  String bookChapterCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count அத்தியாயங்கள்',
      one: '1 அத்தியாயம்',
    );
    return '$_temp0';
  }

  @override
  String bookVerseCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ஸ்லோகங்கள்',
      one: '1 ஸ்லோகம்',
    );
    return '$_temp0';
  }

  @override
  String get searchHint => 'ஸ்லோகங்கள், மந்திரங்கள், நூல்களைத் தேடுங்கள்';

  @override
  String get searchPrompt =>
      'முழு நூலகத்தையும் சர்வரிலிருந்து நேரடியாகத் தேடுங்கள்.';

  @override
  String get searchShortcutLabel =>
      'அல்லது நேரடியாக ஒரு ஸ்லோகத்துக்குச் செல்லுங்கள்:';

  @override
  String get searchNoResults =>
      'முடிவுகள் இல்லை. வேறு சொல்லை முயலுங்கள் அல்லது BG 2.47 போன்ற குறிப்பைத் தாருங்கள்.';

  @override
  String get searchSectionVerses => 'ஸ்லோகங்கள்';

  @override
  String searchResultsTitle(String kind, String query) {
    return '$kind · $query';
  }

  @override
  String labelCanto(int number) {
    return 'ஸ்கந்தம் $number';
  }

  @override
  String labelChapter(int number) {
    return 'அத்தியாயம் $number';
  }

  @override
  String labelVerse(int number) {
    return 'ஸ்லோகம் $number';
  }

  @override
  String labelCantoChapter(int canto, int chapter) {
    return 'ஸ்கந்தம் $canto · அத்தியாயம் $chapter';
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
    return '$done / $target மாலாக்கள்';
  }

  @override
  String sadhanaTasksProgress(int done, int total) {
    return '$total பணிகளில் $done முடிந்தன';
  }

  @override
  String sadhanaStreak(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days நாள் தொடர்ச்சி',
      one: '1 நாள் தொடர்ச்சி',
      zero: 'இன்னும் தொடர்ச்சி இல்லை',
    );
    return '$_temp0';
  }

  @override
  String get sadhanaGenericChant => 'ஜபம்';

  @override
  String sadhanaRoundsShort(int rounds) {
    return '$rounds மாலாக்கள்';
  }

  @override
  String get sadhanaTodaysSessions => 'இன்றைய ஜபம்';

  @override
  String get sadhanaNoSessionsYet => 'இன்று இன்னும் எதுவும் பதிவாகவில்லை.';

  @override
  String get sadhanaRoundsEyebrow => 'இன்றைய மாலாக்கள்';

  @override
  String get sadhanaRoundsCaption => 'மாலாக்கள்';

  @override
  String get sadhanaChantNow => 'இப்போது ஜபியுங்கள்';

  @override
  String get sadhanaLogRounds => 'மாலாக்களைப் பதிவுசெய்';

  @override
  String get sadhanaLogRoundsSubtitle =>
      'உங்கள் மணிகளில் ஜபித்த மாலாக்கள் இன்றைய மொத்தத்தில் சேர்க்கப்படும்.';

  @override
  String sadhanaLogRoundsSubmit(int rounds) {
    return '$rounds மாலாக்களைப் பதிவுசெய்';
  }

  @override
  String get sadhanaTargetReached => 'இன்றைய இலக்கு எட்டப்பட்டது';

  @override
  String get sadhanaUndoBead => 'கடைசி மணியைத் திரும்பப்பெறு';

  @override
  String get sadhanaElapsedEyebrow => 'கடந்த நேரம்';

  @override
  String get sadhanaPaceEyebrow => 'வேகம்';

  @override
  String sadhanaElapsedSeconds(String seconds) {
    return '$seconds வி';
  }

  @override
  String sadhanaPacePerMantra(String seconds) {
    return 'ஒன்றுக்கு $seconds வி';
  }

  @override
  String get sadhanaAutoCount => 'தானியங்கு எண்ணிக்கை';

  @override
  String get sadhanaAutoCountOff => 'முடக்கம் — மணியை நீங்களே தட்டுங்கள்';

  @override
  String get sadhanaAutoCountIdle => 'ஜபத்துக்காகக் காத்திருக்கிறது';

  @override
  String get chantAutoCountLoading => 'தானியங்கி எண்ணிக்கை தயாராகிறது…';

  @override
  String get chantFullPicture => 'முழுத்திரை படம்';

  @override
  String get chantPrayerHint =>
      'முதலில் இந்தப் பிரார்த்தனையைச் சொல்லுங்கள், பிறகு எண்ணத் தொடங்க வளையத்தைத் தட்டுங்கள்.';

  @override
  String get sadhanaAutoCountListening => 'கேட்கிறது…';

  @override
  String get sadhanaAutoCountCounted =>
      'எண்ணப்பட்டது — அடுத்ததற்காகக் கேட்கிறது';

  @override
  String get sadhanaAutoCountPermissionDenied =>
      'தானியங்கு எண்ணிக்கைக்கு மைக்ரோஃபோன் அணுகல் தேவை';

  @override
  String get sadhanaAutoCountUnavailable =>
      'தானியங்கு எண்ணிக்கை இப்போது கிடைக்கவில்லை';

  @override
  String get chantModelTitle => 'கூர்மையான கேட்பு';

  @override
  String chantModelOffer(int megabytes) {
    return 'சம்ஸ்கிருதத்தை மிகச் சிறப்பாகப் புரிந்துகொள்ளும். $megabytes MB ஒருமுறை பதிவிறக்கம் — Wi-Fi பயன்படுத்தவும்.';
  }

  @override
  String get chantModelDownload => 'பதிவிறக்கு';

  @override
  String chantModelDownloading(int percent) {
    return 'பதிவிறக்கப்படுகிறது… $percent%';
  }

  @override
  String get chantModelCancel => 'ரத்துசெய்';

  @override
  String get chantModelInstalled =>
      'பதிவிறக்கப்பட்டது — அடுத்த முறை தானியங்கு எண்ணிக்கையை இயக்கும்போது பயன்படுத்தப்படும்';

  @override
  String get chantModelRemove => 'அகற்று';

  @override
  String get chantModelFailed => 'பதிவிறக்கம் முடியவில்லை';

  @override
  String get chantModelRetry => 'மீண்டும் முயலவும்';

  @override
  String get mantraAllCategories => 'அனைத்தும்';

  @override
  String get mantraNoneInCategory => 'இந்த வகையில் இன்னும் மந்திரங்கள் இல்லை.';

  @override
  String get mantraCategoryBeej => 'பீஜ மந்திரம்';

  @override
  String get mantraCategoryGayatri => 'காயத்ரி';

  @override
  String get mantraCategoryMahamantra => 'மகாமந்திரம்';

  @override
  String get mantraCategoryName => 'நாம மந்திரம்';

  @override
  String mantraStandardRounds(int rounds) {
    return '$rounds மாலாக்கள்';
  }

  @override
  String mantraStandardCount(int count) {
    return '$count முறை';
  }

  @override
  String get mantraHasAudio => 'ஒலிப்பதிவு உள்ளது';

  @override
  String get mantraPurport => 'பொருளுரை';

  @override
  String mantraMyRounds(int rounds) {
    return 'இதை நீங்கள் $rounds மாலாக்கள் ஜபித்துள்ளீர்கள்';
  }

  @override
  String get mantraChantThis => 'இதை ஜபியுங்கள்';

  @override
  String get profileStatVersesSaved => 'சேமித்த ஸ்லோகங்கள்';

  @override
  String get profileStatTotalRounds => 'மொத்த மாலாக்கள்';

  @override
  String get profileStatChantingDays => 'ஜப நாட்கள்';

  @override
  String get profileStatSlokasRead => 'படித்த ஸ்லோகங்கள்';

  @override
  String get profileRecentFavorites => 'சமீபத்திய விருப்பங்கள்';

  @override
  String get profileNoFavorites =>
      'இன்னும் எதுவும் சேமிக்கப்படவில்லை. ஒரு ஸ்லோகத்தைப் புக்மார்க் செய்தால் அது இங்கே இருக்கும்.';

  @override
  String get settingsTitle => 'அமைப்புகள்';

  @override
  String get settingsSectionPractice => 'சாதனா';

  @override
  String get settingsSectionAccount => 'கணக்கு';

  @override
  String get settingsLanguage => 'மொழி';

  @override
  String get settingsTheme => 'தீம்';

  @override
  String get settingsDailyGoal => 'தினசரி இலக்கு';

  @override
  String get settingsDailyGoalSubtitle =>
      'ஒவ்வொரு நாளும் இலக்காகக் கொள்ளும் மாலாக்கள். ஒவ்வொரு புதிய நாளும் இதிலிருந்தே தொடங்கும்.';

  @override
  String settingsDailyGoalSubmit(int rounds) {
    return 'தினசரி இலக்கை $rounds ஆக அமை';
  }

  @override
  String get settingsPreferredMantra => 'விருப்பமான மந்திரம்';

  @override
  String get settingsPreferredMantraNone => 'அமைக்கவில்லை';

  @override
  String get settingsChooseMantraTitle => 'உங்கள் மந்திரத்தைத் தேர்ந்தெடுங்கள்';

  @override
  String get settingsChooseMantraSubtitle =>
      '“இப்போது ஜபியுங்கள்” எதனுடன் திறக்கும் என்பது இது. வேறு எதையும் அதன் சொந்தப் பக்கத்திலிருந்து ஜபிக்கலாம்.';

  @override
  String get settingsNoMantraPreference =>
      'விருப்பம் இல்லை — ஒவ்வொரு முறையும் என்னிடம் கேளுங்கள்';

  @override
  String get settingsPlans => 'திட்டங்கள் & பிரீமியம்';

  @override
  String get plansTitle => 'திட்டங்கள்';

  @override
  String get plansSubtitle =>
      'முழு செயலியும் இலவசம். கட்டணத் திட்டம் இதன்மீது இன்னும் சிறிது சேர்க்கிறது.';

  @override
  String get plansYourPlan => 'உங்கள் திட்டம்';

  @override
  String get plansCurrent => 'தற்போதைய திட்டம்';

  @override
  String get plansFreeForEveryone => 'அனைவருக்கும் இலவசம்';

  @override
  String plansPricePer(String price, String period) {
    return '$price / $period';
  }

  @override
  String get plansPeriodWeek => 'வாரம்';

  @override
  String get plansPeriodMonth => 'மாதம்';

  @override
  String get plansPeriodYear => 'ஆண்டு';

  @override
  String plansPeriodDays(int days) {
    return '$days நாட்கள்';
  }

  @override
  String plansTrial(int days) {
    return '$days நாள் இலவச சோதனை';
  }

  @override
  String get plansSubscribe => 'சந்தா செலுத்து';

  @override
  String get plansStartTrial => 'இலவச சோதனையைத் தொடங்கு';

  @override
  String get plansRestore => 'வாங்கியவற்றை மீட்டெடு';

  @override
  String get plansStoreUnavailable => 'இந்தச் சாதனத்தில் ஸ்டோர் கிடைக்கவில்லை.';

  @override
  String get plansProductMissing =>
      'இந்தத் திட்டம் இப்போது ஸ்டோரில் கிடைக்கவில்லை.';

  @override
  String get plansPurchasePending => 'உங்கள் வாங்குதல் செயலாக்கப்படுகிறது…';

  @override
  String get plansPurchaseSuccess => 'நன்றி — உங்கள் திட்டம் செயலில் உள்ளது.';

  @override
  String get plansPurchaseFailed => 'வாங்குதல் நிறைவேறவில்லை.';

  @override
  String get plansPurchaseCancelled => 'வாங்குதல் ரத்து செய்யப்பட்டது.';

  @override
  String plansRenews(String date) {
    return '$date அன்று புதுப்பிக்கப்படும்';
  }

  @override
  String plansEnds(String date) {
    return '$date வரை அணுகல் உண்டு';
  }

  @override
  String get plansPermanent =>
      'என்றென்றும் உங்களுக்கே — HariHariBol-ஐ ஆதரித்ததற்கு நன்றி.';

  @override
  String get plansIncluded => 'உள்ளடங்கியது';

  @override
  String get plansNotIncluded => 'உள்ளடங்கவில்லை';

  @override
  String get plansUnlimited => 'வரம்பற்றது';

  @override
  String plansLimit(int limit, String unit) {
    return '$limit $unit';
  }

  @override
  String plansSakhaReplies(int count) {
    return 'மாதத்திற்கு சுமார் $count பதில்கள்';
  }

  @override
  String get plansNoFeatures =>
      'கூடுதல் பலன்கள் இன்னும் இல்லை — மேலும் வர உள்ளன.';

  @override
  String get plansRestoreDone => 'வாங்கியவை மீட்டெடுக்கப்பட்டன.';

  @override
  String get settingsPrivacy => 'தனியுரிமைக் கொள்கை';

  @override
  String settingsVersion(String version) {
    return 'பதிப்பு $version';
  }

  @override
  String get settingsMadeWith => 'பக்தியுடன் உருவாக்கப்பட்டது';

  @override
  String settingsFooter(String version, String madeWith) {
    return '$version · $madeWith';
  }

  @override
  String get themeSystem => 'தானியங்கு';

  @override
  String get themeLight => 'ஒளி';

  @override
  String get themeDark => 'இருள்';

  @override
  String profileSignedInAs(String email) {
    return '$email ஆக உள்நுழைந்துள்ளீர்கள்';
  }

  @override
  String get profilePremium => 'பிரீமியம்';

  @override
  String get profileFree => 'இலவசம்';

  @override
  String get signOutConfirm =>
      'உங்கள் சாதனா வரலாற்றைப் பார்க்க மீண்டும் உள்நுழைய வேண்டும்.';

  @override
  String get deleteAccountTitle => 'உங்கள் கணக்கை நீக்கவா?';

  @override
  String get deleteAccountBody =>
      'இது உங்கள் சாதனா வரலாறு, விருப்பங்கள் மற்றும் அறிவிப்புகளை நீக்கும். இதைத் திரும்பப்பெற முடியாது.';

  @override
  String get comingSoon => 'விரைவில் வருகிறது';

  @override
  String get libraryNoBooks => 'இன்னும் நூல்கள் வெளியிடப்படவில்லை.';

  @override
  String get libraryBookNotStarted =>
      'இன்னும் தொடங்கவில்லை. தொடங்க தட்டுங்கள்.';

  @override
  String get actionEdit => 'திருத்து';

  @override
  String get actionDelete => 'நீக்கு';

  @override
  String get libraryDownloadBook => 'ஆஃப்லைன் வாசிப்புக்குப் பதிவிறக்கு';

  @override
  String get libraryDownloading => 'பதிவிறக்கப்படுகிறது…';

  @override
  String get libraryDownloaded => 'ஆஃப்லைன் வாசிப்புக்குப் பதிவிறக்கப்பட்டது';

  @override
  String get libraryDownloadFailed =>
      'இந்த நூலைப் பதிவிறக்க இயலவில்லை. மீண்டும் முயலவும்.';

  @override
  String bookCantoCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ஸ்கந்தங்கள்',
      one: '1 ஸ்கந்தம்',
    );
    return '$_temp0';
  }

  @override
  String bookByTranslators(String names) {
    return '$names வழங்கிய மொழிபெயர்ப்புகள்';
  }

  @override
  String get chapterPrevious => 'முந்தைய அத்தியாயம்';

  @override
  String get chapterNext => 'அடுத்த அத்தியாயம்';

  @override
  String get actionBookmark => 'புக்மார்க்';

  @override
  String get actionRemoveBookmark => 'புக்மார்க்கை நீக்கு';

  @override
  String get actionHighlight => 'முன்னிலைப்படுத்து';

  @override
  String get actionRemoveHighlight => 'முன்னிலைப்படுத்தலை நீக்கு';

  @override
  String get verseExplanationLabel => 'விளக்கம்';

  @override
  String get verseExplanationAiLabel => 'விளக்கம் (AI உதவியுடன்)';

  @override
  String get verseWordMeanings => 'சொற்பொருள்';

  @override
  String get verseCompareTranslations => 'மொழிபெயர்ப்புகளை ஒப்பிடு';

  @override
  String get verseTranslationsEmpty =>
      'வேறு மொழிபெயர்ப்புகள் இன்னும் வெளியிடப்படவில்லை.';

  @override
  String get verseRelatedTitle => 'தொடர்புடைய ஸ்லோகங்கள்';

  @override
  String get verseRelatedEmpty => 'தொடர்புடைய ஸ்லோகங்கள் இன்னும் இல்லை.';

  @override
  String get relationSameConcept => 'அதே கருத்து';

  @override
  String get relationExpandsOn => 'விரித்துரைக்கிறது';

  @override
  String get relationQuotedIn => 'மேற்கோளாக வருமிடம்';

  @override
  String get relationContrastsWith => 'மாறுபடுகிறது';

  @override
  String get verseNotesTitle => 'என் குறிப்புகள்';

  @override
  String get verseNoteHint => 'குறிப்பு எழுதுங்கள்…';

  @override
  String get verseNoteAdd => 'குறிப்பைச் சேர்';

  @override
  String get verseNoteEmpty => 'இந்த ஸ்லோகத்தில் இன்னும் குறிப்புகள் இல்லை.';

  @override
  String get verseNoteDeleteConfirm => 'இந்தக் குறிப்பை நீக்கவா?';

  @override
  String get readingSettingsTitle => 'வாசிப்பு அமைப்புகள்';

  @override
  String get readingContents => 'உள்ளடக்கம்';

  @override
  String get readingFontSizeLabel => 'எழுத்தின் அளவு';

  @override
  String get readingFontSizeSmall => 'சிறியது';

  @override
  String get readingFontSizeMedium => 'நடுத்தரம்';

  @override
  String get readingFontSizeLarge => 'பெரியது';

  @override
  String get readingFontSizeExtraLarge => 'மிகப் பெரியது';

  @override
  String get readingLanguageLabel => 'வாசிப்பு மொழி';

  @override
  String get readingHideLabel => 'ஸ்லோகங்களில் மறைக்கவும்';

  @override
  String get readingHideSanskrit => 'சமஸ்கிருதம்';

  @override
  String get readingHideTransliteration => 'எழுத்துப்பெயர்ப்பு';

  @override
  String get readingModeLabel => 'வாசிக்கும் முறை';

  @override
  String get readingModeVerses => 'ஸ்லோகம் வாரியாக';

  @override
  String get readingModeStory => 'கதை';

  @override
  String get readingStoryShowLabel => 'கதையில் காட்டுவது';

  @override
  String get readingStoryNumbers => 'ஸ்லோக எண்கள்';

  @override
  String get readingStoryHint =>
      'ஒரு ஸ்லோகத்தை அழுத்திப் பிடித்தால் அதை இயக்கலாம், புக்மார்க் செய்யலாம், முன்னிலைப்படுத்தலாம் அல்லது குறிப்பு சேர்க்கலாம்.';

  @override
  String get readingStoryNothing =>
      'நீங்கள் தேர்ந்த பகுதிக்கு இந்த அத்தியாயத்தில் எதுவும் இல்லை. மேலே வேறொன்றைத் தேர்ந்தெடுங்கள்.';

  @override
  String get readingPartMeaning => 'பொருள்';

  @override
  String get routineSubtitle => 'பக்தி, பணி, இடையிலுள்ள சாதாரணமானவை.';

  @override
  String routineProgress(int done, int total) {
    return '$total இல் $done முடிந்தது';
  }

  @override
  String get routineEmptyBody =>
      'ஒரு மாலா ஜபம், ஒரு வேலை, ஒரு பணி — இன்றைய நாளை நோக்கத்துடன் அமையுங்கள்.';

  @override
  String get routineAddTask => 'பணியைச் சேர்';

  @override
  String get routineTaskHint => 'என்ன செய்ய வேண்டும்?';

  @override
  String get routineCategoryLabel => 'வகை';

  @override
  String get routineCategoryDevotion => 'பக்தி';

  @override
  String get routineCategoryWork => 'வேலை';

  @override
  String get routineCategoryHome => 'வீடு';

  @override
  String get routineCategoryErrand => 'வெளிவேலை';

  @override
  String get routineSlotMorning => 'காலை';

  @override
  String get routineSlotAfternoon => 'மதியம்';

  @override
  String get routineSlotEvening => 'மாலை';

  @override
  String get routineSlotAnytime => 'எந்த நேரமும்';

  @override
  String get routinePresetWakeUp => 'எழுதல்';

  @override
  String get routinePresetMorningChant => 'காலை ஜபம்';

  @override
  String get routinePresetExercise => 'உடற்பயிற்சி';

  @override
  String get routinePresetBreakfast => 'காலை உணவு';

  @override
  String get routinePresetLunch => 'மதிய உணவு';

  @override
  String get routinePresetEveningChant => 'மாலை ஜபம்';

  @override
  String get routinePresetDinner => 'இரவு உணவு';

  @override
  String get routinePresetScriptureReading => 'சாஸ்திர வாசிப்பு';

  @override
  String get routinePresetSleep => 'உறக்கம்';

  @override
  String get routineTaskNameLabel => 'பணியின் பெயர்';

  @override
  String get routineWindowHeading => 'நிர்ணயித்த நேரம்';

  @override
  String get routineWindowHint =>
      'இந்த நேர வரம்பிற்குள் செய்தால் சரியான நேரம், அதற்கு முன் என்றால் முன்கூட்டியே, அதற்குப் பின் என்றால் தாமதம் எனக் கணக்கிடப்படும்.';

  @override
  String get routineWindowSet => 'நேர வரம்பை அமை';

  @override
  String get routineWindowClear => 'நேர வரம்பை நீக்கு';

  @override
  String get routineWindowFrom => 'தொடக்கம்';

  @override
  String get routineWindowTo => 'முடிவு';

  @override
  String routineWindowRange(String start, String end) {
    return '$start – $end';
  }

  @override
  String get routineWindowInvalid =>
      'முடிவு நேரம் தொடக்க நேரத்துக்குப் பிறகு இருக்க வேண்டும்.';

  @override
  String get routineStatusNotDone => 'முடியவில்லை';

  @override
  String get routineStatusDone => 'முடிந்தது';

  @override
  String get routineStatusEarly => 'முன்கூட்டியே';

  @override
  String get routineStatusOnTime => 'சரியான நேரம்';

  @override
  String get routineStatusLate => 'தாமதம்';

  @override
  String routineStatusAtTime(String status, String time) {
    return '$status · $time';
  }

  @override
  String get routineChangeTime => 'நேரத்தை மாற்று';

  @override
  String get routinePickDoneTime => 'இது எப்போது முடிந்தது?';

  @override
  String get routineSaveAction => 'இந்த நாளில் சேர்';

  @override
  String get routineTaskRemoved => 'இந்த நாளிலிருந்து நீக்கப்பட்டது';

  @override
  String get routineUndo => 'செயல்தவிர்';

  @override
  String get routineToday => 'இன்று';

  @override
  String get routineJumpToToday => 'இன்றுக்குச் செல்';

  @override
  String get routineEkadashi => 'ஏகாதசி';

  @override
  String get routineEkadashiNote =>
      'தோராயமானது — கோயில் பஞ்சாங்கத்தில் ஒரு நாள் வித்தியாசம் இருக்கலாம்.';

  @override
  String routineDayLabel(String date, String ekadashi, int done, int total) {
    String _temp0 = intl.Intl.selectLogic(ekadashi, {
      'yes': ' · ஏகாதசி',
      'other': '',
    });
    String _temp1 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: ' · $total இல் $done முடிந்தது',
      zero: '',
    );
    return '$date$_temp0$_temp1';
  }

  @override
  String get routineNothingPlanned =>
      'இந்த நாளுக்கு எதுவும் திட்டமிடப்படவில்லை.';

  @override
  String get routineManageDaily => 'தினசரி வழக்கம்';

  @override
  String get routineDailyTitle => 'தினசரி வழக்கம்';

  @override
  String get routineDailyBody =>
      'விருப்பத்துக்குரியது. இவை ஒவ்வொரு நாளும் மீண்டும் வரும்; தினமும் புதிதாகக் குறிக்கலாம்.';

  @override
  String get routineDailyEmpty => 'தினசரி வழக்கம் இன்னும் இல்லை.';

  @override
  String get routineDailyAdd => 'தினசரி வழக்கத்தில் சேர்';

  @override
  String get routineDailySaveAction => 'ஒவ்வொரு நாளும் சேர்';

  @override
  String get routineDailyBadge => 'தினசரி';

  @override
  String get routineDailyRemove => 'தினசரி வழக்கத்திலிருந்து நீக்கு';

  @override
  String get routineDailyRemoved =>
      'உங்கள் தினசரி வழக்கத்திலிருந்து நீக்கப்பட்டது';

  @override
  String get reelsEmpty => 'ரீல்ஸ் இன்னும் இல்லை';

  @override
  String get reelsEmptyBody =>
      'படைப்பாளர்கள் பதிவிடத் தொடங்கியதும் அவர்களின் ரீல்ஸ் இங்கே தோன்றும்.';

  @override
  String get reelsFailed => 'ரீல்ஸை ஏற்ற இயலவில்லை';

  @override
  String get reelsRetry => 'மீண்டும் முயலவும்';

  @override
  String get reelFollow => 'பின்தொடர்';

  @override
  String get reelFollowing => 'பின்தொடர்கிறீர்கள்';

  @override
  String get reelLike => 'விரும்பு';

  @override
  String get reelUnlike => 'விருப்பத்தை நீக்கு';

  @override
  String get reelComment => 'கருத்து';

  @override
  String get reelShare => 'பகிர்';

  @override
  String get reelSave => 'சேமி';

  @override
  String get reelUnsave => 'சேமித்ததிலிருந்து நீக்கு';

  @override
  String get reelSaved => 'சேமிக்கப்பட்டது';

  @override
  String get reelRemovedFromSaved => 'சேமித்ததிலிருந்து நீக்கப்பட்டது';

  @override
  String get reelMore => 'மேலும் விருப்பங்கள்';

  @override
  String get reelMuted => 'ஒலி நிறுத்தம்';

  @override
  String get reelUnmuted => 'ஒலி இயக்கம்';

  @override
  String get reelPlay => 'இயக்கு';

  @override
  String get reelPause => 'இடைநிறுத்து';

  @override
  String get reelVideoUnavailable => 'இந்த வீடியோ இன்னும் செயலாக்கப்படுகிறது.';

  @override
  String get reelAudioUnavailable =>
      'இந்த ஒலிப்பதிவு இன்னும் செயலாக்கப்படுகிறது.';

  @override
  String get reelSimilar => 'இதுபோன்ற மேலும்';

  @override
  String get reelSimilarEmpty => 'இதுபோன்ற ரீல்ஸ் இன்னும் இல்லை.';

  @override
  String reelSlideOf(int current, int total) {
    return '$current / $total';
  }

  @override
  String get reelBookGita => 'BG';

  @override
  String get reelBookBhagavatam => 'SB';

  @override
  String get reelCaptionMore => 'மேலும்';

  @override
  String get reelCaptionLess => 'குறைவு';

  @override
  String get reelCommentsTitle => 'கருத்துகள்';

  @override
  String reelCommentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count கருத்துகள்',
      one: '1 கருத்து',
      zero: 'கருத்துகள் இன்னும் இல்லை',
    );
    return '$_temp0';
  }

  @override
  String get reelCommentsEmpty => 'முதலில் ஏதாவது சொல்லுங்கள்.';

  @override
  String get reelCommentHint => 'கருத்தைச் சேர்…';

  @override
  String reelReplyHint(String name) {
    return '$name அவர்களுக்குப் பதிலளி…';
  }

  @override
  String get reelCommentSend => 'இடுகையிடு';

  @override
  String get reelCommentReply => 'பதிலளி';

  @override
  String get reelCommentDelete => 'நீக்கு';

  @override
  String get reelCommentReport => 'புகாரளி';

  @override
  String get reelCommentPin => 'பின் செய்';

  @override
  String get reelCommentUnpin => 'பின்னை நீக்கு';

  @override
  String get reelCommentPinned => 'பின் செய்யப்பட்டது';

  @override
  String get reelCommentRemoved => 'இந்தக் கருத்து நீக்கப்பட்டது.';

  @override
  String get reelCommentDeleted => 'கருத்து நீக்கப்பட்டது';

  @override
  String get reelCommentDeleteTitle => 'இந்தக் கருத்தை நீக்கவா?';

  @override
  String get reelCommentDeleteBody =>
      'இது அனைவருக்கும் நீக்கப்படும்; இதற்கான பதில்களும் நீக்கப்படும்.';

  @override
  String get reelCommentCancelReply => 'பதிலை ரத்துசெய்';

  @override
  String reelViewReplies(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count பதில்களைக் காண்க',
      one: '1 பதிலைக் காண்க',
    );
    return '$_temp0';
  }

  @override
  String get reelHideReplies => 'பதில்களை மறை';

  @override
  String get reelLoadMoreComments => 'மேலும் கருத்துகளை ஏற்று';

  @override
  String get reelReportTitle => 'இந்த ரீலைப் புகாரளி';

  @override
  String get reelReportCommentTitle => 'இந்தக் கருத்தைப் புகாரளி';

  @override
  String get reelReportBody =>
      'இதில் என்ன தவறு என்று சொல்லுங்கள். ஒரு மதிப்பீட்டாளர் இதைப் பரிசீலிப்பார்.';

  @override
  String get reelReportSpam => 'ஸ்பேம் அல்லது தவறாக வழிநடத்துவது';

  @override
  String get reelReportHarassment => 'துன்புறுத்தல் அல்லது அவமதிப்பு';

  @override
  String get reelReportNonDevotional => 'பக்தி சார்ந்த உள்ளடக்கம் அல்ல';

  @override
  String get reelReportMisinformation => 'தவறான தகவல்';

  @override
  String get reelReportSexualOrViolent => 'பாலியல் அல்லது வன்முறை';

  @override
  String get reelReportOther => 'வேறு ஏதாவது';

  @override
  String get reelReportNoteHint =>
      'நாங்கள் வேறு ஏதாவது அறிய வேண்டுமா? (விருப்பத்துக்குரியது)';

  @override
  String get reelReportSubmit => 'புகாரளி';

  @override
  String get reelReportThanks => 'நன்றி. ஒரு மதிப்பீட்டாளர் இதைப் பார்ப்பார்.';

  @override
  String get reelShareTitle => 'இந்த ரீலைப் பகிர்';

  @override
  String reelShareMessage(String caption, String link) {
    return '$caption\n\nHariHariBol-இல் பாருங்கள்: $link';
  }

  @override
  String get reelCopyLink => 'இணைப்பை நகலெடு';

  @override
  String get reelLinkCopied => 'இணைப்பு நகலெடுக்கப்பட்டது';

  @override
  String get creatorTitle => 'படைப்பாளர்';

  @override
  String creatorFollowers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count பின்தொடர்பவர்கள்',
      one: '1 பின்தொடர்பவர்',
    );
    return '$_temp0';
  }

  @override
  String creatorReelCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ரீல்கள்',
      one: '1 ரீல்',
    );
    return '$_temp0';
  }

  @override
  String creatorViews(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count பார்வைகள்',
      one: '1 பார்வை',
    );
    return '$_temp0';
  }

  @override
  String get creatorStatFollowers => 'பின்தொடர்பவர்கள்';

  @override
  String get creatorStatReels => 'ரீல்ஸ்';

  @override
  String get creatorStatViews => 'பார்வைகள்';

  @override
  String get creatorVerified => 'சரிபார்க்கப்பட்ட படைப்பாளர்';

  @override
  String get creatorNoReels => 'இன்னும் எதுவும் பதிவிடப்படவில்லை.';

  @override
  String get creatorNotFound => 'அந்தப் படைப்பாளர் இப்போது இங்கு இல்லை.';

  @override
  String get chantAnalyticsTooltip => 'பகுப்பாய்வும் வரலாறும்';

  @override
  String get chantSittingTime => 'அமர்வு நேரம்';

  @override
  String chantMalaTime(int number) {
    return 'மாலா $number நேரம்';
  }

  @override
  String get chantStatCurrentMala => 'தற்போதைய மாலா';

  @override
  String get chantStatCount => 'எண்ணிக்கை';

  @override
  String get chantStatMalasDone => 'முடிந்த மாலாக்கள்';

  @override
  String get chantStatAvgMala => 'மாலாவுக்குச் சராசரி';

  @override
  String get chantStatAvgChant => 'ஜபத்துக்குச் சராசரி';

  @override
  String get chantStatTotalChants => 'மொத்த ஜபங்கள்';

  @override
  String get chantStatFastestMala => 'வேகமான மாலா';

  @override
  String get chantStatTotalTime => 'மொத்த நேரம்';

  @override
  String get chantNoValue => '—';

  @override
  String get chantRecentTitle => 'சமீபத்திய ஜபங்கள்';

  @override
  String get chantRecentEmpty => 'தொடங்க வளையத்தைத் தட்டுங்கள்.';

  @override
  String chantTapNumber(int seq) {
    return '#$seq';
  }

  @override
  String get chantAutoBadge => 'தானியங்கு';

  @override
  String get chantDetectWords => 'சொற்களைக் கண்டறி';

  @override
  String get chantDetectWordsOff => 'முடக்கம் — சொற்கள் பதிவு செய்யப்படாது';

  @override
  String get chantDetectWordsListening => 'சொற்களைக் கேட்கிறது…';

  @override
  String get chantDetectWordsPermission => 'மைக்ரோஃபோன் அணுகல் தேவை';

  @override
  String get chantDetectWordsStarting => 'தயாராகிறது…';

  @override
  String get chantDetectWordsUnavailable =>
      'இந்தச் சாதனத்தில் சொல் கண்டறிதல் கிடைக்கவில்லை';

  @override
  String get chantDetectWordsNote =>
      'சொற்கள் உங்கள் தொலைபேசியிலேயே அடையாளம் காணப்படும்; ஒலி ஒருபோதும் பதிவு செய்யப்படாது. உரை 7 நாட்கள் வைக்கப்பட்டு, பின்னர் நீக்கப்படும்.';

  @override
  String get chantSetupTitle => 'ஜப உதவிகள்';

  @override
  String get chantSetupSubtitle =>
      'இந்த அமர்வு எப்படி எண்ணப்பட்டு, குறிக்கப்படும் என்பதைத் தேர்ந்தெடுங்கள். கேட்பது உங்கள் தொலைபேசியிலேயே நடக்கும்.';

  @override
  String get chantSetupButton => 'தானியங்கு எண்ணிக்கை & சொற்கள்';

  @override
  String get chantSetupNoneOn => 'அமைக்க';

  @override
  String chantSetupOn(int count) {
    return '$count இயக்கத்தில்';
  }

  @override
  String chantSetupButtonState(String button, String state) {
    return '$button · $state';
  }

  @override
  String get chantSetupDone => 'முடிந்தது';

  @override
  String get chantAnalyticsTitle => 'ஜப பகுப்பாய்வு';

  @override
  String get chantTabThisSitting => 'இந்த அமர்வு';

  @override
  String get chantTabHistory => 'வரலாறு';

  @override
  String chantMalaTitle(int number) {
    return 'மாலா $number';
  }

  @override
  String get chantMalaInProgress => 'நடைபெறுகிறது';

  @override
  String get chantMalaStart => 'தொடக்கம்';

  @override
  String get chantMalaEnd => 'முடிவு';

  @override
  String get chantMalaDuration => 'கால அளவு';

  @override
  String chantMalaChants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ஜபங்கள்',
      one: '1 ஜபம்',
    );
    return '$_temp0';
  }

  @override
  String get chantTapsHeader => 'ஒவ்வொரு ஜபமும்';

  @override
  String get chantHeardLabel => 'கேட்டது';

  @override
  String get chantNoMalasYet =>
      'இந்த அமர்வில் இன்னும் ஜபங்கள் இல்லை. நீங்கள் முடிக்கும் ஒவ்வொரு மாலாவும் அதன் தொடக்கம், முடிவு, எடுத்த நேரத்துடன் இங்கே பட்டியலிடப்படும்.';

  @override
  String get chantHistoryEmpty => 'முந்தைய அமர்வுகள் இன்னும் இல்லை.';

  @override
  String chantHistorySummary(int malas, int chants) {
    return '$malas மாலாக்கள் · $chants ஜபங்கள்';
  }

  @override
  String get chantHistoryNoDetail =>
      'ஜப நேரம் பதிவு செய்யப்படுவதற்கு முன் எண்ணப்பட்டது';

  @override
  String get chantSessionTitle => 'அமர்வு';

  @override
  String get chantSessionNoMalas =>
      'இந்த அமர்வுக்கு நேரம் குறிக்கப்பட்ட மாலாக்கள் எதுவும் பதிவாகவில்லை.';

  @override
  String get chantHeardExpiry =>
      'கேட்கப்பட்ட சொற்கள் அமர்வு முடிந்து 7 நாட்களுக்குப் பிறகு உங்கள் கணக்கிலிருந்து நீக்கப்படும்.';

  @override
  String get chantHeardTitle => 'இப்போது கேட்டது';

  @override
  String get chantHeardHearing => 'உங்களைக் கேட்கிறது…';

  @override
  String get chantHeardWaiting => 'உங்கள் குரலுக்காகக் காத்திருக்கிறது';

  @override
  String get chantHeardPlaceholder =>
      'சத்தமாக ஜபியுங்கள். உங்கள் போன் கேட்கும் சொற்கள் இங்கே தோன்றும்.';

  @override
  String get chantHeardLast => 'கடைசியாகக் கேட்டது';

  @override
  String chantHeardCounted(int count) {
    return 'எண்ணப்பட்டது +$count';
  }

  @override
  String get chantHeardNotCounted => 'எண்ணப்படவில்லை';

  @override
  String chantHeardMatch(int percent, int needed) {
    return '$percent% பொருத்தம் · தேவை $needed%';
  }

  @override
  String chantHeardMatchShort(int percent) {
    return '$percent% பொருத்தம்';
  }

  @override
  String get chantHeardEarlier => 'முன்பு';

  @override
  String get chantAlongTitle => 'சேர்ந்து ஜபிக்க';

  @override
  String get chantAlongCaption =>
      'ஒலிப்பதிவுடன் சேர்ந்து எண்ணிக்கை எண்ணும். இது இயங்கும்போது தானியங்கு எண்ணிக்கையும் சொல் கண்டறிதலும் ஓய்வெடுக்கும்.';

  @override
  String get chantAlongPlay => 'ஒலிப்பதிவை இயக்கு';

  @override
  String get chantAlongPause => 'ஒலிப்பதிவை இடைநிறுத்து';

  @override
  String get chantAlongPosition => 'ஒலிப்பதிவில் நிலை';

  @override
  String get chantAlongLoading => 'ஒலிப்பதிவு ஏற்றப்படுகிறது…';

  @override
  String get chantAlongLoadFailed => 'ஒலிப்பதிவை ஏற்ற இயலவில்லை.';

  @override
  String get settingsSectionLanguages => 'மொழிகள்';

  @override
  String get settingsLanguageApp => 'செயலி மொழி';

  @override
  String get settingsLanguageAppHint => 'மெனுக்கள், பொத்தான்கள், லேபிள்கள்';

  @override
  String get settingsLanguageReading => 'வாசிப்பு மொழி';

  @override
  String get settingsLanguageReadingHint => 'மொழிபெயர்ப்பு, பொருள், பொருளுரை';

  @override
  String get settingsLanguageSpeaking => 'பேசும் மற்றும் கேட்கும் மொழி';

  @override
  String get settingsLanguageSpeakingHint => 'ஒலியும் பேசப்படும் பொருளும்';

  @override
  String get settingsLanguagePickerApp => 'செயலி மொழியைத் தேர்ந்தெடுங்கள்';

  @override
  String get settingsLanguagePickerReading =>
      'வாசிப்பு மொழியைத் தேர்ந்தெடுங்கள்';

  @override
  String get settingsLanguagePickerSpeaking =>
      'பேசும் மொழியைத் தேர்ந்தெடுங்கள்';

  @override
  String get settingsLanguageSanskritNote =>
      'சம்ஸ்கிருத ஸ்லோகங்கள் எப்போதும் சம்ஸ்கிருதத்திலேயே இருக்கும்.';

  @override
  String get readingAudioPlayAll => 'வாசித்துக் காட்டு';

  @override
  String get readingAudioPlayVerse => 'இந்த ஸ்லோகத்தை இயக்கு';

  @override
  String get readingAudioPause => 'இடைநிறுத்து';

  @override
  String get readingAudioResume => 'தொடரு';

  @override
  String get readingAudioStop => 'நிறுத்து';

  @override
  String get readingAudioNext => 'அடுத்த ஸ்லோகம்';

  @override
  String get readingAudioPrevious => 'முந்தைய ஸ்லோகம்';

  @override
  String get readingAudioFromStart => 'தொடக்கத்திலிருந்து';

  @override
  String readingAudioResumeFrom(int number) {
    return 'ஸ்லோகம் $number இலிருந்து தொடரு';
  }

  @override
  String readingAudioNowPlaying(String section, int number) {
    return '$section · ஸ்லோகம் $number';
  }

  @override
  String get readingAudioLoading => 'ஏற்றப்படுகிறது…';

  @override
  String get readingAudioChannel => 'வாசித்துக் காட்டுதல்';

  @override
  String get pushChannelName => 'தினசரி ஸ்லோகம் மற்றும் அறிவிப்புகள்';

  @override
  String get readingSectionVerse => 'ஸ்லோகம்';

  @override
  String get readingSectionMeaning => 'பொருள்';

  @override
  String get readingSectionPurport => 'பொருளுரை';

  @override
  String get settingsVoices => 'குரல்கள்';

  @override
  String settingsVoicesValue(int count) {
    return '$count நிறுவப்பட்டன';
  }

  @override
  String get voicesTitle => 'குரல்கள்';

  @override
  String get voicesIntro =>
      'பொருளும் பொருளுரையும் நீங்கள் தேர்ந்தெடுத்த பேசும் மொழியில் வாசிக்கப்படும். குரல் பதிவிறக்கப்படும் வரை உங்கள் தொலைபேசியின் சொந்தக் குரல் பயன்படுத்தப்படும்; எனவே வாசிப்பு காத்திருக்காது.';

  @override
  String voicesStorage(String size) {
    return 'இந்தத் தொலைபேசியில் $size பயன்படுத்தப்படுகிறது';
  }

  @override
  String get voicesEmpty =>
      'பதிவிறக்க குரல்கள் இன்னும் இல்லை. உங்கள் தொலைபேசியின் சொந்தக் குரல் பயன்படுத்தப்படும்.';

  @override
  String get voiceDownload => 'பதிவிறக்கு';

  @override
  String get voiceDelete => 'நீக்கு';

  @override
  String get voiceCancel => 'ரத்துசெய்';

  @override
  String get voiceRetry => 'மீண்டும் முயலவும்';

  @override
  String voiceInstalled(String size) {
    return 'நிறுவப்பட்டது · $size';
  }

  @override
  String voiceNotInstalled(String size) {
    return 'பதிவிறக்கப்படவில்லை · $size';
  }

  @override
  String voiceDownloading(int percent) {
    return 'பதிவிறக்கப்படுகிறது $percent%';
  }

  @override
  String get voiceVerifying => 'சரிபார்க்கிறது…';

  @override
  String get voiceExtracting => 'நிறுவுகிறது…';

  @override
  String get voiceFailed => 'இந்தக் குரலை நிறுவ இயலவில்லை';

  @override
  String get voiceUnavailable =>
      'இன்னும் கிடைக்கவில்லை · உங்கள் தொலைபேசியின் குரலைப் பயன்படுத்தும்';

  @override
  String get voiceDeleteTitle => 'இந்தக் குரலை நீக்கவா?';

  @override
  String get voiceDeleteBody =>
      'இதை மீண்டும் பதிவிறக்கலாம். அதுவரை உங்கள் தொலைபேசியின் சொந்தக் குரல் பயன்படுத்தப்படும்.';

  @override
  String voiceLanguages(String languages) {
    return '$languages பேசுகிறது';
  }

  @override
  String labelVerseWithSection(int number, String section) {
    return 'ஸ்லோகம் $number · $section';
  }

  @override
  String get chatTitle => 'Sakha-விடம் கேளுங்கள்';

  @override
  String get chatHomeTitle => 'Sakha-விடம் கேளுங்கள்';

  @override
  String get chatHomeBody =>
      'சாஸ்திரம், மந்திரங்கள், உங்கள் சாதனா பற்றிய கேள்விகள்';

  @override
  String get chatIntroTitle => 'உங்கள் நண்பர் Sakha';

  @override
  String get chatIntroHint =>
      'ஒரு ஸ்லோகம், மந்திரம் அல்லது உங்கள் சாதனா பற்றிக் கேளுங்கள்.';

  @override
  String get chatComposerHint => 'கேள்வி கேளுங்கள்';

  @override
  String get chatSend => 'அனுப்பு';

  @override
  String get chatStop => 'நிறுத்து';

  @override
  String chatCharacterCount(int count, int max) {
    return '$count / $max';
  }

  @override
  String chatCreditsLeft(int percent) {
    return '$percent% மீதம்';
  }

  @override
  String chatCreditsLeftLevel(int percent, String level) {
    return '$percent% மீதம் · $level';
  }

  @override
  String get chatCreditsResetsMidnight => 'நள்ளிரவில் மீட்டமையும்';

  @override
  String chatCreditsRenews(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat('d MMM', localeName);
    final String dateString = dateDateFormat.format(date);

    return 'புதுப்பிப்பு: $dateString';
  }

  @override
  String get chatNotAvailableTitle => 'அரட்டை உங்கள் திட்டத்தில் இல்லை';

  @override
  String get chatNotAvailableBody =>
      'Sakha-விடம் கேள்விகள் கேட்க உங்கள் திட்டத்தை மேம்படுத்துங்கள்.';

  @override
  String get chatExhaustedDailyTitle => 'இன்றைய கிரெடிட்கள் தீர்ந்துவிட்டன';

  @override
  String get chatExhaustedDailyBody =>
      'நள்ளிரவில் அவை மீண்டும் நிரம்பும். அப்போது தொடரலாம், அல்லது கூடுதலாகப் பெற மேம்படுத்தலாம்.';

  @override
  String get chatExhaustedWalletTitle => 'உங்கள் கிரெடிட்கள் தீர்ந்துவிட்டன';

  @override
  String get chatExhaustedWalletBody =>
      'இவை உங்கள் திட்டத்துடன் புதுப்பிக்கப்படும். காத்திருக்கலாம், அல்லது தொடர மேம்படுத்தலாம்.';

  @override
  String get chatShareUsedTitle =>
      'இந்த அரட்டை தனக்கான கிரெடிட்களைப் பயன்படுத்திவிட்டது';

  @override
  String get chatShareUsedBody =>
      'புதிய அரட்டையைத் தொடங்குங்கள்; நீங்கள் நிறுத்திய இடத்திலிருந்து Sakha தொடர்வார்.';

  @override
  String get chatUpgrade => 'மேம்படுத்து';

  @override
  String get chatStartNewChat => 'புதிய அரட்டையைத் தொடங்கு';

  @override
  String get chatFullTitle => 'இந்த அரட்டை மிக நீளமாகிவிட்டது';

  @override
  String get chatFullBody =>
      'புதிய அரட்டையைத் தொடங்குங்கள்; Sakha நம் உரையாடலைத் தொடர்வார்.';

  @override
  String get chatContinuePartial =>
      'உங்கள் சமீபத்திய செய்திகளைச் சுருக்க முடியவில்லை, அதனால் முந்தைய பகுதி மட்டுமே வந்தது.';

  @override
  String get chatTidying => 'நம் உரையாடலைச் சுருக்குகிறேன்…';

  @override
  String get chatTyping => 'Sakha எழுதுகிறார்';

  @override
  String get chatConnectionLost =>
      'இணைப்பு இடையில் துண்டிக்கப்பட்டது. மீண்டும் முயலவும்.';

  @override
  String get chatReplyFailed =>
      'Sakha-வால் அந்தப் பதிலை முடிக்க முடியவில்லை. மீண்டும் முயலவும்.';

  @override
  String get chatOverloaded =>
      'Sakha இப்போது மும்முரமாக இருக்கிறார். சிறிது நேரத்தில் மீண்டும் முயலவும்.';

  @override
  String get chatUnavailable =>
      'Sakha இப்போது கிடைக்கவில்லை. சிறிது நேரம் கழித்து மீண்டும் முயலவும்.';

  @override
  String get chatBusy => 'தற்போதைய பதில் முடியும் வரை காத்திருக்கவும்.';

  @override
  String get chatTooLong => 'இந்தச் செய்தி மிக நீளமாக உள்ளது. சுருக்கவும்.';

  @override
  String get chatStopped => 'நிறுத்தப்பட்டது';

  @override
  String get chatInterrupted => 'இடையில் நின்றது';

  @override
  String get chatCopy => 'நகலெடு';

  @override
  String get chatCopied => 'நகலெடுக்கப்பட்டது';

  @override
  String get chatShare => 'பகிர்';

  @override
  String get chatRegenerate => 'மீண்டும் பதிலளி';

  @override
  String get chatLinkCopied => 'இணைப்பு நகலெடுக்கப்பட்டது';

  @override
  String get chatImageUnavailable => 'படம் கிடைக்கவில்லை';

  @override
  String get chatClearTooltip => 'அரட்டையை அழிக்கவும்';

  @override
  String get chatClearTitle => 'இந்த அரட்டையை அழிக்கவா?';

  @override
  String get chatClearBody =>
      'உங்கள் செய்திகளும் Sakha அளித்த பதில்களும் நீக்கப்படும்; நம் உரையாடலை Sakha நினைவில் வைத்திருக்காது. ஏற்கெனவே பயன்படுத்திய கிரெடிட்கள் திரும்பக் கிடைக்காது.';

  @override
  String get chatClearConfirm => 'அழி';

  @override
  String get chatCleared => 'அரட்டை அழிக்கப்பட்டது';

  @override
  String get chatSuggestionsLabel => 'இவற்றைக் கேட்டுப் பாருங்கள்';

  @override
  String get chatStarter1Title => 'வாழ்க்கைக்கு ஒரு ஸ்லோகம்';

  @override
  String get chatStarter1Prompt =>
      'பகவத் கீதை 2.47 ஸ்லோகத்தை எனக்கு விளக்குங்கள் — பலனைப் பற்றிக் கவலைப்படாமல் என் கடமையைச் செய்வது.';

  @override
  String get chatStarter2Title => 'ஜபம் தொடங்குதல்';

  @override
  String get chatStarter2Prompt =>
      'ஹரே கிருஷ்ண மஹாமந்திரத்தை ஜபிக்க எப்படித் தொடங்குவது, தொடக்கத்தில் எத்தனை மாலா செய்ய வேண்டும்?';

  @override
  String get chatStarter3Title => 'தினசரி சாதனா';

  @override
  String get chatStarter3Prompt =>
      'பிஸியான நாளிலும் கடைப்பிடிக்கக்கூடிய எளிய தினசரி சாதனாவைப் பரிந்துரையுங்கள்.';

  @override
  String get chatStarter4Title => 'மனம் அமைதியற்றிருக்கும்போது';

  @override
  String get chatStarter4Prompt =>
      'என் மனம் அமைதியற்றதாக இருக்கிறது. அமைதியைப் பெறுவது பற்றி சாஸ்திரங்கள் என்ன சொல்கின்றன?';

  @override
  String get chatStarter5Title => 'கேட்க வேண்டிய ஒரு கதை';

  @override
  String get chatStarter5Prompt =>
      'பிரஹ்லாதனின் கதையையும் அது கற்பிப்பதையும் எனக்குச் சொல்லுங்கள்.';

  @override
  String get chatFollowUp1 => 'எளிமையாக விளக்குங்கள்';

  @override
  String get chatFollowUp2 => 'ஓர் உதாரணம் கொடுங்கள்';

  @override
  String get chatFollowUp3 => 'இது ஏன் முக்கியம்?';

  @override
  String get chatFollowUp4 => 'இதை எப்படிப் பயிற்சி செய்வது?';

  @override
  String get chatAttach => 'படத்தைச் சேர்க்கவும்';

  @override
  String get chatAttachCamera => 'புகைப்படம் எடுக்கவும்';

  @override
  String get chatAttachGallery =>
      'உங்கள் புகைப்படங்களிலிருந்து தேர்ந்தெடுக்கவும்';

  @override
  String get chatAttachNote =>
      'படம், பதில்களை எழுத உதவும் சேவைக்கு அனுப்பப்படும்; அரட்டையை அழிக்கும் வரை இங்கேயே இருக்கும்.';

  @override
  String get chatImageRemove => 'படத்தை நீக்கவும்';

  @override
  String get chatImageUploading => 'படம் சேர்க்கப்படுகிறது…';

  @override
  String get chatImageFailed =>
      'படத்தைச் சேர்க்க முடியவில்லை. மீண்டும் முயல தட்டவும்.';

  @override
  String get chatImageRejected =>
      'இந்தப் படத்தைப் பயன்படுத்த முடியாது. வேறொன்றைத் தேர்ந்தெடுக்கவும்.';

  @override
  String get chatImageOff => 'உங்கள் திட்டத்தில் படங்கள் கிடைக்காது.';

  @override
  String get chatImageSemantics => 'நீங்கள் அனுப்பிய படம்';

  @override
  String get chatPictureDenied =>
      'படத்தைச் சேர்க்க, ஃபோன் அமைப்புகளில் கேமரா அல்லது புகைப்படங்களுக்கான அனுமதியை வழங்குங்கள்.';

  @override
  String get chatMic => 'பேசிக் கேள்வி கேளுங்கள்';

  @override
  String get chatMicStop => 'கேட்பதை நிறுத்துங்கள்';

  @override
  String get chatListening => 'பேசுங்கள்…';

  @override
  String get chatMicDenied =>
      'பேச, ஃபோன் அமைப்புகளில் மைக்ரோஃபோன் மற்றும் பேச்சு அறிதலுக்கான அனுமதியை வழங்குங்கள்.';

  @override
  String get chatMicUnavailable =>
      'இந்த ஃபோனில் பேசி எழுதும் வசதி கிடைக்கவில்லை.';

  @override
  String get chatMicNoSpeech => 'எதுவும் கேட்கவில்லை. மீண்டும் முயலவும்.';

  @override
  String get chatMicFailed => 'கேட்பது நின்றுவிட்டது. மீண்டும் முயலவும்.';

  @override
  String get chatJumpToLatest => 'சமீபத்தியது';

  @override
  String get verseAskSakha => 'இந்த ஸ்லோகம் பற்றி Sakha-விடம் கேளுங்கள்';

  @override
  String chatExplainVerse(String reference, String verse) {
    return 'தயவுசெய்து இந்த ஸ்லோகத்தை எளிய சொற்களில் விளக்குங்கள் — $reference:\n\n$verse';
  }

  @override
  String chatActionQuestion(String place) {
    return '$place திறக்கவா?';
  }

  @override
  String get chatActionOpen => 'திற';

  @override
  String get chatActionNotNow => 'இப்போது வேண்டாம்';
}
