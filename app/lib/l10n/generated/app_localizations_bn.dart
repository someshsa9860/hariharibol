// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Bengali Bangla (`bn`).
class AppLocalizationsBn extends AppLocalizations {
  AppLocalizationsBn([String locale = 'bn']) : super(locale);

  @override
  String get appName => 'HariHariBol';

  @override
  String get splashTagline => 'পড়ুন · জপ করুন · সাধনা করুন';

  @override
  String get actionRetry => 'আবার চেষ্টা করুন';

  @override
  String get actionCancel => 'বাতিল করুন';

  @override
  String get actionOk => 'ঠিক আছে';

  @override
  String get actionDone => 'সম্পন্ন';

  @override
  String get actionSave => 'সংরক্ষণ করুন';

  @override
  String get actionViewAll => 'সব দেখুন';

  @override
  String get actionSignOut => 'সাইন আউট করুন';

  @override
  String get actionDeleteAccount => 'অ্যাকাউন্ট মুছুন';

  @override
  String get actionContinue => 'চালিয়ে যান';

  @override
  String get errorGeneric =>
      'কিছু একটা ভুল হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get errorNetwork =>
      'সংযোগ নেই। আপনার ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।';

  @override
  String get errorTimeout =>
      'এতে অনেক সময় লেগে গেল। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get errorSessionExpired =>
      'আপনার সেশন শেষ হয়ে গেছে। অনুগ্রহ করে আবার সাইন ইন করুন।';

  @override
  String get errorSignIn =>
      'আমরা আপনাকে সাইন ইন করাতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get errorInsecureConnection => 'সংযোগটি নিরাপদ নয়।';

  @override
  String get errorCancelled => 'অনুরোধ বাতিল করা হয়েছে।';

  @override
  String get errorEmptyTitle => 'এখানে এখনও কিছু নেই';

  @override
  String get errorRouteNotFound => 'সেই স্ক্রিনটি নেই।';

  @override
  String get actionGoHome => 'হোমে যান';

  @override
  String get signInTitle => 'স্বাগতম';

  @override
  String get signInSubtitle =>
      'পড়ুন, জপ করুন এবং আপনার দৈনন্দিন সাধনা এক জায়গায় রাখুন।';

  @override
  String get signInWithGoogle => 'Google দিয়ে চালিয়ে যান';

  @override
  String get signInWithApple => 'Apple দিয়ে চালিয়ে যান';

  @override
  String get signInCancelled => 'সাইন-ইন বাতিল করা হয়েছে।';

  @override
  String get signInFailed =>
      'আমরা আপনাকে সাইন ইন করাতে পারিনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get signInLegal =>
      'চালিয়ে গেলে আপনি আমাদের শর্তাবলী ও গোপনীয়তা নীতিতে সম্মত হচ্ছেন।';

  @override
  String get introWelcomeTitle => 'HariHariBol-এ স্বাগতম';

  @override
  String get introWelcomeBody =>
      'পড়া, জপ করা আর আপনার দৈনন্দিন সাধনা রাখার একটি শান্ত জায়গা — সবকিছু একটি অ্যাপেই।';

  @override
  String get introReadTitle => 'শাস্ত্র পড়ুন';

  @override
  String get introReadBody =>
      'ভগবদ্গীতা ও শ্রীমদ্ভাগবতম্, শ্লোকে শ্লোকে, আপনার প্রিয় ভাষায়। পাঠ শুনুন, ইন্টারনেট ছাড়াও।';

  @override
  String get introChantTitle => 'প্রতিটি শ্বাসের সঙ্গে জপ করুন';

  @override
  String get introChantBody =>
      'শব্দ দিয়ে বা ট্যাপ করে আপনার জপ গুনুন, রেকর্ড করা মালার সঙ্গে জপ করুন, আর দিনে দিনে আপনার সাধনা বাড়তে দেখুন।';

  @override
  String get introSakhaTitle => 'Sakha-কে জিজ্ঞাসা করুন, পথের এক বন্ধু';

  @override
  String get introSakhaBody =>
      'একটি প্রশ্ন বা ভারী মন নিয়ে আসুন। Sakha একটি ডিজিটাল সঙ্গী, যা আপনার ভাষায়, কোমলভাবে, এক-একটি ছোট পদক্ষেপে উত্তর দেয়।';

  @override
  String get introReelsTitle => 'আপনার দিনকে আলোকিত করার রিলস';

  @override
  String get introReelsBody =>
      'শ্লোক ও ক্রিয়েটরদের ছোট ভক্তিমূলক রিলস। যখনই একটু থামবেন, একটু অনুপ্রেরণা দেখুন, সংরক্ষণ করুন ও শেয়ার করুন।';

  @override
  String get introNext => 'পরবর্তী';

  @override
  String get introSkip => 'বাদ দিন';

  @override
  String get introStart => 'শুরু করুন';

  @override
  String introPageOf(int current, int total) {
    return '$total-এর মধ্যে পৃষ্ঠা $current';
  }

  @override
  String languageStepOf(int current, int total) {
    return '$total-এর মধ্যে ধাপ $current';
  }

  @override
  String get languageAppTitle => 'কোন ভাষাটি আপন মনে হয়?';

  @override
  String get languageAppSubtitle =>
      'আপনি যেকোনো সময় সেটিংসে এটি বদলাতে পারবেন।';

  @override
  String get languageMantraTitle => 'আপনি কোন লিপিতে জপ করেন?';

  @override
  String get languageMantraSubtitle =>
      'মন্ত্র এই লিপিতে দেখানো হবে। তাদের অর্থ আপনার নিজের ভাষাতেই থাকবে।';

  @override
  String get actionBack => 'পিছনে';

  @override
  String get tabHome => 'হোম';

  @override
  String get tabSadhana => 'জপ';

  @override
  String get tabLibrary => 'পড়ুন';

  @override
  String get tabRoutine => 'রুটিন';

  @override
  String get tabSakha => 'Sakha';

  @override
  String get reelsTitle => 'রিলস';

  @override
  String get tabSearch => 'খুঁজুন';

  @override
  String get homeGreeting => 'হরি বোল';

  @override
  String homeGreetingNamed(String name) {
    return 'হরি বোল, $name';
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
  String get homeMoodPrompt => 'আজ আপনি কেমন আছেন?';

  @override
  String get homeMoodAnsweredToday =>
      'আজ আপনার কেমন লাগছে তা আপনি জানিয়েছেন। নতুন কিছু জানাতে কাল আবার আসুন।';

  @override
  String homeMoodViewToday(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'আজকের $countটি শ্লোক আবার পড়ুন',
      one: 'আজকের শ্লোকটি আবার পড়ুন',
    );
    return '$_temp0';
  }

  @override
  String homeMoodSubmit(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'আমাকে $countটি শ্লোক দেখান',
      one: 'আমাকে একটি শ্লোক দেখান',
    );
    return '$_temp0';
  }

  @override
  String get homeVerseOfTheDay => 'আজকের শ্লোক';

  @override
  String get homeSlokaForYou => 'আজ আপনার জন্য';

  @override
  String get homeTodaysSadhana => 'আজকের সাধনা';

  @override
  String get homeContinueReading => 'পড়া চালিয়ে যান';

  @override
  String get homeBooks => 'গ্রন্থ';

  @override
  String get homeMantras => 'মন্ত্র';

  @override
  String get homeStartYourDay => 'আজকের লক্ষ্য ঠিক করুন';

  @override
  String homeChantMantra(String mantra) {
    return '$mantra জপ করুন';
  }

  @override
  String bookChapterCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি অধ্যায়',
      one: '1টি অধ্যায়',
    );
    return '$_temp0';
  }

  @override
  String bookVerseCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি শ্লোক',
      one: '1টি শ্লোক',
    );
    return '$_temp0';
  }

  @override
  String get searchHint => 'শ্লোক, মন্ত্র, গ্রন্থ খুঁজুন';

  @override
  String get searchPrompt => 'পুরো গ্রন্থাগারে খুঁজুন, সরাসরি সার্ভার থেকে।';

  @override
  String get searchShortcutLabel => 'অথবা সরাসরি কোনো শ্লোকে যান:';

  @override
  String get searchNoResults =>
      'কোনো ফলাফল নেই। অন্য কোনো শব্দ চেষ্টা করুন, অথবা BG 2.47-এর মতো কোনো রেফারেন্স লিখুন।';

  @override
  String get searchSectionVerses => 'শ্লোক';

  @override
  String searchResultsTitle(String kind, String query) {
    return '$kind · $query';
  }

  @override
  String labelCanto(int number) {
    return 'স্কন্ধ $number';
  }

  @override
  String labelChapter(int number) {
    return 'অধ্যায় $number';
  }

  @override
  String labelVerse(int number) {
    return 'শ্লোক $number';
  }

  @override
  String labelCantoChapter(int canto, int chapter) {
    return 'স্কন্ধ $canto · অধ্যায় $chapter';
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
    return '$target-এর মধ্যে $done মালা';
  }

  @override
  String sadhanaTasksProgress(int done, int total) {
    return '$total-এর মধ্যে $doneটি কাজ সম্পন্ন';
  }

  @override
  String sadhanaStreak(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days দিনের ধারাবাহিকতা',
      one: '1 দিনের ধারাবাহিকতা',
      zero: 'এখনও ধারাবাহিকতা নেই',
    );
    return '$_temp0';
  }

  @override
  String get sadhanaGenericChant => 'জপ';

  @override
  String sadhanaRoundsShort(int rounds) {
    return '$rounds মালা';
  }

  @override
  String get sadhanaTodaysSessions => 'আজকের জপ';

  @override
  String get sadhanaNoSessionsYet => 'আজ এখনও কিছু নথিভুক্ত হয়নি।';

  @override
  String get sadhanaRoundsEyebrow => 'আজকের মালা';

  @override
  String get sadhanaRoundsCaption => 'মালা';

  @override
  String get sadhanaChantNow => 'এখনই জপ করুন';

  @override
  String get sadhanaLogRounds => 'মালা নথিভুক্ত করুন';

  @override
  String get sadhanaLogRoundsSubtitle =>
      'আপনার মালায় করা জপ, আজকের মোটের সঙ্গে যোগ হবে।';

  @override
  String sadhanaLogRoundsSubmit(int rounds) {
    return '$rounds মালা নথিভুক্ত করুন';
  }

  @override
  String get sadhanaTargetReached => 'আজকের লক্ষ্য পূর্ণ হয়েছে';

  @override
  String get sadhanaUndoBead => 'শেষ গুটিটি ফিরিয়ে নিন';

  @override
  String get sadhanaElapsedEyebrow => 'কেটে যাওয়া সময়';

  @override
  String get sadhanaPaceEyebrow => 'গতি';

  @override
  String sadhanaElapsedSeconds(String seconds) {
    return '$seconds সেকেন্ড';
  }

  @override
  String sadhanaPacePerMantra(String seconds) {
    return 'প্রতিটি $seconds সেকেন্ড';
  }

  @override
  String get sadhanaAutoCount => 'স্বয়ংক্রিয় গণনা';

  @override
  String get sadhanaAutoCountOff => 'বন্ধ — গুটি নিজে ট্যাপ করুন';

  @override
  String get sadhanaAutoCountIdle => 'জপের অপেক্ষায়';

  @override
  String get chantAutoCountLoading => 'স্বয়ংক্রিয় গণনা প্রস্তুত হচ্ছে…';

  @override
  String get chantFullPicture => 'পূর্ণ পর্দার ছবি';

  @override
  String get chantPrayerHint =>
      'প্রথমে এই প্রার্থনাটি করুন, তারপর গণনা শুরু করতে বৃত্তে ট্যাপ করুন।';

  @override
  String get sadhanaAutoCountListening => 'শুনছে…';

  @override
  String get sadhanaAutoCountCounted => 'গোনা হয়েছে — পরেরটির অপেক্ষায়';

  @override
  String get sadhanaAutoCountPermissionDenied =>
      'স্বয়ংক্রিয় গণনার জন্য মাইক্রোফোনের অনুমতি দরকার';

  @override
  String get sadhanaAutoCountUnavailable =>
      'স্বয়ংক্রিয় গণনা এখন পাওয়া যাচ্ছে না';

  @override
  String get chantModelTitle => 'আরও ভালো শোনা';

  @override
  String chantModelOffer(int megabytes) {
    return 'সংস্কৃত অনেক ভালো বোঝে। $megabytes MB-এর একটি ডাউনলোড — Wi-Fi ব্যবহার করুন।';
  }

  @override
  String get chantModelDownload => 'ডাউনলোড করুন';

  @override
  String chantModelDownloading(int percent) {
    return 'ডাউনলোড হচ্ছে… $percent%';
  }

  @override
  String get chantModelCancel => 'বাতিল করুন';

  @override
  String get chantModelInstalled =>
      'ডাউনলোড হয়েছে — পরের বার স্বয়ংক্রিয় গণনা চালু করলে ব্যবহার হবে';

  @override
  String get chantModelRemove => 'সরান';

  @override
  String get chantModelFailed => 'ডাউনলোড সম্পূর্ণ হয়নি';

  @override
  String get chantModelRetry => 'আবার চেষ্টা করুন';

  @override
  String get mantraAllCategories => 'সব';

  @override
  String get mantraNoneInCategory => 'এই বিভাগে এখনও কোনো মন্ত্র নেই।';

  @override
  String get mantraCategoryBeej => 'বীজমন্ত্র';

  @override
  String get mantraCategoryGayatri => 'গায়ত্রী';

  @override
  String get mantraCategoryMahamantra => 'মহামন্ত্র';

  @override
  String get mantraCategoryName => 'নামমন্ত্র';

  @override
  String mantraStandardRounds(int rounds) {
    return '$rounds মালা';
  }

  @override
  String mantraStandardCount(int count) {
    return '$count বার';
  }

  @override
  String get mantraHasAudio => 'পাঠ পাওয়া যাচ্ছে';

  @override
  String get mantraPurport => 'তাৎপর্য';

  @override
  String mantraMyRounds(int rounds) {
    return 'আপনি এর $rounds মালা জপ করেছেন';
  }

  @override
  String get mantraChantThis => 'এটি জপ করুন';

  @override
  String get profileStatVersesSaved => 'সংরক্ষিত শ্লোক';

  @override
  String get profileStatTotalRounds => 'মোট মালা';

  @override
  String get profileStatChantingDays => 'জপের দিন';

  @override
  String get profileStatSlokasRead => 'পড়া শ্লোক';

  @override
  String get profileRecentFavorites => 'সাম্প্রতিক প্রিয়';

  @override
  String get profileNoFavorites =>
      'এখনও কিছু সংরক্ষিত হয়নি। কোনো শ্লোক বুকমার্ক করুন, সেটি এখানে থাকবে।';

  @override
  String get settingsTitle => 'সেটিংস';

  @override
  String get settingsSectionPractice => 'সাধনা';

  @override
  String get settingsSectionAccount => 'অ্যাকাউন্ট';

  @override
  String get settingsLanguage => 'ভাষা';

  @override
  String get settingsTheme => 'থিম';

  @override
  String get settingsDailyGoal => 'দৈনিক লক্ষ্য';

  @override
  String get settingsDailyGoalSubtitle =>
      'প্রতিদিন কত মালার লক্ষ্য রাখবেন। প্রতিটি নতুন দিন এটি দিয়েই শুরু হয়।';

  @override
  String settingsDailyGoalSubmit(int rounds) {
    return 'দৈনিক লক্ষ্য $rounds করুন';
  }

  @override
  String get settingsPreferredMantra => 'পছন্দের মন্ত্র';

  @override
  String get settingsPreferredMantraNone => 'ঠিক করা নেই';

  @override
  String get settingsChooseMantraTitle => 'আপনার মন্ত্র বেছে নিন';

  @override
  String get settingsChooseMantraSubtitle =>
      '“এখনই জপ করুন” এটি দিয়ে খোলে। বাকি যেকোনো কিছু আপনি তার নিজের পাতা থেকে জপ করতে পারেন।';

  @override
  String get settingsNoMantraPreference =>
      'কোনো পছন্দ নেই — প্রতিবার আমাকে জিজ্ঞাসা করুন';

  @override
  String get settingsPlans => 'প্ল্যান ও প্রিমিয়াম';

  @override
  String get plansTitle => 'প্ল্যান';

  @override
  String get plansSubtitle =>
      'পুরো অ্যাপটি বিনামূল্যে। একটি পেইড প্ল্যান তার উপর আরও কিছু যোগ করে।';

  @override
  String get plansYourPlan => 'আপনার প্ল্যান';

  @override
  String get plansCurrent => 'বর্তমান প্ল্যান';

  @override
  String get plansFreeForEveryone => 'সবার জন্য বিনামূল্যে';

  @override
  String plansPricePer(String price, String period) {
    return '$price / $period';
  }

  @override
  String get plansPeriodWeek => 'সপ্তাহ';

  @override
  String get plansPeriodMonth => 'মাস';

  @override
  String get plansPeriodYear => 'বছর';

  @override
  String plansPeriodDays(int days) {
    return '$days দিন';
  }

  @override
  String plansTrial(int days) {
    return '$days দিনের বিনামূল্যে ট্রায়াল';
  }

  @override
  String get plansSubscribe => 'সাবস্ক্রাইব করুন';

  @override
  String get plansStartTrial => 'বিনামূল্যে ট্রায়াল শুরু করুন';

  @override
  String get plansRestore => 'কেনাকাটা পুনরুদ্ধার করুন';

  @override
  String get plansStoreUnavailable => 'এই ডিভাইসে স্টোর পাওয়া যাচ্ছে না।';

  @override
  String get plansProductMissing => 'এই প্ল্যানটি এখন স্টোরে পাওয়া যাচ্ছে না।';

  @override
  String get plansPurchasePending => 'আপনার কেনাকাটা প্রক্রিয়া করা হচ্ছে…';

  @override
  String get plansPurchaseSuccess => 'ধন্যবাদ — আপনার প্ল্যান চালু হয়েছে।';

  @override
  String get plansPurchaseFailed => 'কেনাকাটা সম্পূর্ণ হয়নি।';

  @override
  String get plansPurchaseCancelled => 'কেনাকাটা বাতিল করা হয়েছে।';

  @override
  String plansRenews(String date) {
    return '$date তারিখে নবায়ন হবে';
  }

  @override
  String plansEnds(String date) {
    return '$date পর্যন্ত অ্যাক্সেস';
  }

  @override
  String get plansPermanent =>
      'এটি চিরকালের জন্য আপনার — HariHariBol-কে সমর্থন করার জন্য ধন্যবাদ।';

  @override
  String get plansIncluded => 'অন্তর্ভুক্ত';

  @override
  String get plansNotIncluded => 'অন্তর্ভুক্ত নয়';

  @override
  String get plansUnlimited => 'সীমাহীন';

  @override
  String plansLimit(int limit, String unit) {
    return '$limit $unit';
  }

  @override
  String plansSakhaReplies(int count) {
    return 'মাসে প্রায় $countটি উত্তর';
  }

  @override
  String get plansNoFeatures => 'এখনও কোনো অতিরিক্ত সুবিধা নেই — আরও আসছে।';

  @override
  String get plansRestoreDone => 'কেনাকাটা পুনরুদ্ধার হয়েছে।';

  @override
  String get settingsPrivacy => 'গোপনীয়তা নীতি';

  @override
  String settingsVersion(String version) {
    return 'সংস্করণ $version';
  }

  @override
  String get settingsMadeWith => 'শ্রদ্ধার সঙ্গে তৈরি';

  @override
  String settingsFooter(String version, String madeWith) {
    return '$version · $madeWith';
  }

  @override
  String get themeSystem => 'স্বয়ংক্রিয়';

  @override
  String get themeLight => 'লাইট';

  @override
  String get themeDark => 'ডার্ক';

  @override
  String profileSignedInAs(String email) {
    return '$email হিসেবে সাইন ইন করা আছে';
  }

  @override
  String get profilePremium => 'প্রিমিয়াম';

  @override
  String get profileFree => 'বিনামূল্যে';

  @override
  String get signOutConfirm =>
      'আপনার সাধনার ইতিহাস দেখতে আপনাকে আবার সাইন ইন করতে হবে।';

  @override
  String get deleteAccountTitle => 'আপনার অ্যাকাউন্ট মুছবেন?';

  @override
  String get deleteAccountBody =>
      'এতে আপনার সাধনার ইতিহাস, প্রিয় তালিকা ও বিজ্ঞপ্তি মুছে যাবে। এটি ফেরানো যাবে না।';

  @override
  String get comingSoon => 'শীঘ্রই আসছে';

  @override
  String get libraryNoBooks => 'এখনও কোনো গ্রন্থ প্রকাশিত হয়নি।';

  @override
  String get libraryBookNotStarted => 'এখনও শুরু হয়নি। শুরু করতে ট্যাপ করুন।';

  @override
  String get actionEdit => 'সম্পাদনা করুন';

  @override
  String get actionDelete => 'মুছুন';

  @override
  String get libraryDownloadBook => 'অফলাইনে পড়ার জন্য ডাউনলোড করুন';

  @override
  String get libraryDownloading => 'ডাউনলোড হচ্ছে…';

  @override
  String get libraryDownloaded => 'অফলাইনে পড়ার জন্য ডাউনলোড হয়েছে';

  @override
  String get libraryDownloadFailed =>
      'এই গ্রন্থটি ডাউনলোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String bookCantoCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি স্কন্ধ',
      one: '1টি স্কন্ধ',
    );
    return '$_temp0';
  }

  @override
  String bookByTranslators(String names) {
    return '$names-এর অনুবাদ';
  }

  @override
  String get chapterPrevious => 'আগের অধ্যায়';

  @override
  String get chapterNext => 'পরের অধ্যায়';

  @override
  String get actionBookmark => 'বুকমার্ক করুন';

  @override
  String get actionRemoveBookmark => 'বুকমার্ক সরান';

  @override
  String get actionHighlight => 'হাইলাইট করুন';

  @override
  String get actionRemoveHighlight => 'হাইলাইট সরান';

  @override
  String get verseExplanationLabel => 'ব্যাখ্যা';

  @override
  String get verseExplanationAiLabel => 'ব্যাখ্যা (AI-এর সহায়তায়)';

  @override
  String get verseWordMeanings => 'শব্দার্থ';

  @override
  String get verseCompareTranslations => 'অনুবাদ তুলনা করুন';

  @override
  String get verseTranslationsEmpty => 'অন্য কোনো অনুবাদ এখনও প্রকাশিত হয়নি।';

  @override
  String get verseRelatedTitle => 'সম্পর্কিত শ্লোক';

  @override
  String get verseRelatedEmpty => 'এখনও কোনো সম্পর্কিত শ্লোক নেই।';

  @override
  String get relationSameConcept => 'একই ধারণা';

  @override
  String get relationExpandsOn => 'এর বিস্তার';

  @override
  String get relationQuotedIn => 'যেখানে উদ্ধৃত';

  @override
  String get relationContrastsWith => 'এর বিপরীত';

  @override
  String get verseNotesTitle => 'আমার নোট';

  @override
  String get verseNoteHint => 'একটি নোট লিখুন…';

  @override
  String get verseNoteAdd => 'নোট যোগ করুন';

  @override
  String get verseNoteEmpty => 'এই শ্লোকে এখনও কোনো নোট নেই।';

  @override
  String get verseNoteDeleteConfirm => 'এই নোটটি মুছবেন?';

  @override
  String get readingSettingsTitle => 'পড়ার সেটিংস';

  @override
  String get readingContents => 'সূচিপত্র';

  @override
  String get readingFontSizeLabel => 'লেখার আকার';

  @override
  String get readingFontSizeSmall => 'ছোট';

  @override
  String get readingFontSizeMedium => 'মাঝারি';

  @override
  String get readingFontSizeLarge => 'বড়';

  @override
  String get readingFontSizeExtraLarge => 'অনেক বড়';

  @override
  String get readingLanguageLabel => 'পড়ার ভাষা';

  @override
  String get readingHideLabel => 'শ্লোকে লুকান';

  @override
  String get readingHideSanskrit => 'সংস্কৃত';

  @override
  String get readingHideTransliteration => 'লিপ্যন্তর';

  @override
  String get readingModeLabel => 'পড়ার ধরন';

  @override
  String get readingModeVerses => 'শ্লোক ধরে ধরে';

  @override
  String get readingModeStory => 'কথা';

  @override
  String get readingStoryShowLabel => 'কথায় যা দেখাবে';

  @override
  String get readingStoryNumbers => 'শ্লোক সংখ্যা';

  @override
  String get readingStoryHint =>
      'কোনো শ্লোকে চেপে ধরে রাখুন — তা শুনতে, বুকমার্ক করতে, হাইলাইট করতে বা নোট যোগ করতে।';

  @override
  String get readingStoryNothing =>
      'এই অধ্যায়ে আপনার বেছে নেওয়া অংশের কিছু নেই। ওপর থেকে অন্য একটি বেছে নিন।';

  @override
  String get readingPartMeaning => 'অর্থ';

  @override
  String get routineSubtitle => 'ভক্তি, কাজ আর মাঝের সাধারণ মুহূর্তগুলি।';

  @override
  String routineProgress(int done, int total) {
    return '$total-এর মধ্যে $done সম্পন্ন';
  }

  @override
  String get routineEmptyBody =>
      'এক মালা জপ, একটি কাজ, একটি ঘরের কাজ যোগ করুন — আজকের দিনটি সংকল্পের সঙ্গে গড়ুন।';

  @override
  String get routineAddTask => 'কাজ যোগ করুন';

  @override
  String get routineTaskHint => 'কী করতে হবে?';

  @override
  String get routineCategoryLabel => 'বিভাগ';

  @override
  String get routineCategoryDevotion => 'ভক্তি';

  @override
  String get routineCategoryWork => 'কাজ';

  @override
  String get routineCategoryHome => 'ঘর';

  @override
  String get routineCategoryErrand => 'বাইরের কাজ';

  @override
  String get routineSlotMorning => 'সকাল';

  @override
  String get routineSlotAfternoon => 'দুপুর';

  @override
  String get routineSlotEvening => 'সন্ধ্যা';

  @override
  String get routineSlotAnytime => 'যেকোনো সময়';

  @override
  String get routinePresetWakeUp => 'ঘুম থেকে ওঠা';

  @override
  String get routinePresetMorningChant => 'সকালের জপ';

  @override
  String get routinePresetExercise => 'ব্যায়াম';

  @override
  String get routinePresetBreakfast => 'সকালের খাবার';

  @override
  String get routinePresetLunch => 'দুপুরের খাবার';

  @override
  String get routinePresetEveningChant => 'সন্ধ্যার জপ';

  @override
  String get routinePresetDinner => 'রাতের খাবার';

  @override
  String get routinePresetScriptureReading => 'শাস্ত্রপাঠ';

  @override
  String get routinePresetSleep => 'ঘুম';

  @override
  String get routineTaskNameLabel => 'কাজের নাম';

  @override
  String get routineWindowHeading => 'নির্ধারিত সময়';

  @override
  String get routineWindowHint =>
      'এই সময়ের মধ্যে করলে সময়মতো, তার আগে করলে আগেভাগে, তার পরে করলে দেরিতে ধরা হয়।';

  @override
  String get routineWindowSet => 'সময়সীমা ঠিক করুন';

  @override
  String get routineWindowClear => 'সময়সীমা সরান';

  @override
  String get routineWindowFrom => 'থেকে';

  @override
  String get routineWindowTo => 'পর্যন্ত';

  @override
  String routineWindowRange(String start, String end) {
    return '$start – $end';
  }

  @override
  String get routineWindowInvalid => 'শেষের সময় শুরুর পরে হতে হবে।';

  @override
  String get routineStatusNotDone => 'সম্পন্ন হয়নি';

  @override
  String get routineStatusDone => 'সম্পন্ন';

  @override
  String get routineStatusEarly => 'আগেভাগে';

  @override
  String get routineStatusOnTime => 'সময়মতো';

  @override
  String get routineStatusLate => 'দেরিতে';

  @override
  String routineStatusAtTime(String status, String time) {
    return '$status · $time';
  }

  @override
  String get routineChangeTime => 'সময় বদলান';

  @override
  String get routinePickDoneTime => 'এটি কখন সম্পন্ন হয়েছিল?';

  @override
  String get routineSaveAction => 'এই দিনে যোগ করুন';

  @override
  String get routineTaskRemoved => 'এই দিন থেকে সরানো হয়েছে';

  @override
  String get routineUndo => 'ফিরিয়ে আনুন';

  @override
  String get routineToday => 'আজ';

  @override
  String get routineJumpToToday => 'আজকে যান';

  @override
  String get routineEkadashi => 'একাদশী';

  @override
  String get routineEkadashiNote =>
      'আনুমানিক — মন্দিরের পঞ্জিকা এক দিন আলাদা হতে পারে।';

  @override
  String routineDayLabel(String date, String ekadashi, int done, int total) {
    String _temp0 = intl.Intl.selectLogic(ekadashi, {
      'yes': ' · একাদশী',
      'other': '',
    });
    String _temp1 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: ' · $total-এর মধ্যে $done সম্পন্ন',
      zero: '',
    );
    return '$date$_temp0$_temp1';
  }

  @override
  String get routineNothingPlanned => 'এই দিনের জন্য কিছু ঠিক করা নেই।';

  @override
  String get routineManageDaily => 'দৈনিক রুটিন';

  @override
  String get routineDailyTitle => 'দৈনিক রুটিন';

  @override
  String get routineDailyBody =>
      'ঐচ্ছিক। এগুলি প্রতিদিন পুনরাবৃত্তি হয়, আর প্রতিদিন নতুন টিক পড়ে।';

  @override
  String get routineDailyEmpty => 'এখনও কোনো দৈনিক রুটিন নেই।';

  @override
  String get routineDailyAdd => 'দৈনিক রুটিনে যোগ করুন';

  @override
  String get routineDailySaveAction => 'প্রতিদিনে যোগ করুন';

  @override
  String get routineDailyBadge => 'দৈনিক';

  @override
  String get routineDailyRemove => 'দৈনিক রুটিন থেকে সরান';

  @override
  String get routineDailyRemoved => 'আপনার দৈনিক রুটিন থেকে সরানো হয়েছে';

  @override
  String get reelsEmpty => 'এখনও কোনো রিল নেই';

  @override
  String get reelsEmptyBody =>
      'ক্রিয়েটররা পোস্ট করা শুরু করলে তাঁদের রিলস এখানে দেখা যাবে।';

  @override
  String get reelsFailed => 'রিলস লোড করা যায়নি';

  @override
  String get reelsRetry => 'আবার চেষ্টা করুন';

  @override
  String get reelFollow => 'ফলো করুন';

  @override
  String get reelFollowing => 'ফলো করছেন';

  @override
  String get reelLike => 'লাইক করুন';

  @override
  String get reelUnlike => 'লাইক সরান';

  @override
  String get reelComment => 'মন্তব্য';

  @override
  String get reelShare => 'শেয়ার করুন';

  @override
  String get reelSave => 'সংরক্ষণ করুন';

  @override
  String get reelUnsave => 'সংরক্ষিত থেকে সরান';

  @override
  String get reelSaved => 'সংরক্ষিত';

  @override
  String get reelRemovedFromSaved => 'সংরক্ষিত থেকে সরানো হয়েছে';

  @override
  String get reelMore => 'আরও বিকল্প';

  @override
  String get reelMuted => 'শব্দ বন্ধ';

  @override
  String get reelUnmuted => 'শব্দ চালু';

  @override
  String get reelPlay => 'চালান';

  @override
  String get reelPause => 'থামান';

  @override
  String get reelVideoUnavailable => 'এই ভিডিওটি এখনও প্রক্রিয়া করা হচ্ছে।';

  @override
  String get reelAudioUnavailable => 'এই পাঠটি এখনও প্রক্রিয়া করা হচ্ছে।';

  @override
  String get reelSimilar => 'এর মতো আরও';

  @override
  String get reelSimilarEmpty => 'এখনও এর মতো কোনো রিল নেই।';

  @override
  String reelSlideOf(int current, int total) {
    return '$total-এর মধ্যে $current';
  }

  @override
  String get reelBookGita => 'BG';

  @override
  String get reelBookBhagavatam => 'SB';

  @override
  String get reelCaptionMore => 'আরও';

  @override
  String get reelCaptionLess => 'কম';

  @override
  String get reelCommentsTitle => 'মন্তব্য';

  @override
  String reelCommentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি মন্তব্য',
      one: '1টি মন্তব্য',
      zero: 'এখনও কোনো মন্তব্য নেই',
    );
    return '$_temp0';
  }

  @override
  String get reelCommentsEmpty => 'সবার আগে কিছু বলুন।';

  @override
  String get reelCommentHint => 'একটি মন্তব্য যোগ করুন…';

  @override
  String reelReplyHint(String name) {
    return '$name-কে উত্তর দিন…';
  }

  @override
  String get reelCommentSend => 'পোস্ট করুন';

  @override
  String get reelCommentReply => 'উত্তর দিন';

  @override
  String get reelCommentDelete => 'মুছুন';

  @override
  String get reelCommentReport => 'রিপোর্ট করুন';

  @override
  String get reelCommentPin => 'পিন করুন';

  @override
  String get reelCommentUnpin => 'পিন সরান';

  @override
  String get reelCommentPinned => 'পিন করা';

  @override
  String get reelCommentRemoved => 'এই মন্তব্যটি সরিয়ে দেওয়া হয়েছে।';

  @override
  String get reelCommentDeleted => 'মন্তব্য মুছে ফেলা হয়েছে';

  @override
  String get reelCommentDeleteTitle => 'এই মন্তব্যটি মুছবেন?';

  @override
  String get reelCommentDeleteBody => 'এটি সবার জন্য, এর সব উত্তরসহ মুছে যাবে।';

  @override
  String get reelCommentCancelReply => 'উত্তর বাতিল করুন';

  @override
  String reelViewReplies(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি উত্তর দেখুন',
      one: '1টি উত্তর দেখুন',
    );
    return '$_temp0';
  }

  @override
  String get reelHideReplies => 'উত্তর লুকান';

  @override
  String get reelLoadMoreComments => 'আরও মন্তব্য লোড করুন';

  @override
  String get reelReportTitle => 'এই রিলটি রিপোর্ট করুন';

  @override
  String get reelReportCommentTitle => 'এই মন্তব্যটি রিপোর্ট করুন';

  @override
  String get reelReportBody =>
      'এতে কী সমস্যা আছে আমাদের জানান। একজন মডারেটর এটি পর্যালোচনা করবেন।';

  @override
  String get reelReportSpam => 'স্প্যাম বা বিভ্রান্তিকর';

  @override
  String get reelReportHarassment => 'হয়রানি বা অপব্যবহার';

  @override
  String get reelReportNonDevotional => 'ভক্তিমূলক বিষয়বস্তু নয়';

  @override
  String get reelReportMisinformation => 'ভুল তথ্য';

  @override
  String get reelReportSexualOrViolent => 'যৌন বা হিংসাত্মক';

  @override
  String get reelReportOther => 'অন্য কিছু';

  @override
  String get reelReportNoteHint => 'আমাদের আর কিছু জানার আছে? (ঐচ্ছিক)';

  @override
  String get reelReportSubmit => 'রিপোর্ট করুন';

  @override
  String get reelReportThanks => 'ধন্যবাদ। একজন মডারেটর এটি দেখবেন।';

  @override
  String get reelShareTitle => 'এই রিলটি শেয়ার করুন';

  @override
  String reelShareMessage(String caption, String link) {
    return '$caption\n\nHariHariBol-এ দেখুন: $link';
  }

  @override
  String get reelCopyLink => 'লিঙ্ক কপি করুন';

  @override
  String get reelLinkCopied => 'লিঙ্ক কপি হয়েছে';

  @override
  String get creatorTitle => 'ক্রিয়েটর';

  @override
  String creatorFollowers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count জন ফলোয়ার',
      one: '1 জন ফলোয়ার',
    );
    return '$_temp0';
  }

  @override
  String creatorReelCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি রিল',
      one: '1টি রিল',
    );
    return '$_temp0';
  }

  @override
  String creatorViews(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি ভিউ',
      one: '1টি ভিউ',
    );
    return '$_temp0';
  }

  @override
  String get creatorStatFollowers => 'ফলোয়ার';

  @override
  String get creatorStatReels => 'রিলস';

  @override
  String get creatorStatViews => 'ভিউ';

  @override
  String get creatorVerified => 'যাচাইকৃত ক্রিয়েটর';

  @override
  String get creatorNoReels => 'এখনও কিছু পোস্ট করা হয়নি।';

  @override
  String get creatorNotFound => 'সেই ক্রিয়েটর আর এখানে নেই।';

  @override
  String get chantAnalyticsTooltip => 'বিশ্লেষণ ও ইতিহাস';

  @override
  String get chantSittingTime => 'বসার সময়';

  @override
  String chantMalaTime(int number) {
    return 'মালা $number-এর সময়';
  }

  @override
  String get chantStatCurrentMala => 'বর্তমান মালা';

  @override
  String get chantStatCount => 'গণনা';

  @override
  String get chantStatMalasDone => 'সম্পূর্ণ মালা';

  @override
  String get chantStatAvgMala => 'মালা প্রতি গড়';

  @override
  String get chantStatAvgChant => 'জপ প্রতি গড়';

  @override
  String get chantStatTotalChants => 'মোট জপ';

  @override
  String get chantStatFastestMala => 'দ্রুততম মালা';

  @override
  String get chantStatTotalTime => 'মোট সময়';

  @override
  String get chantNoValue => '—';

  @override
  String get chantRecentTitle => 'সাম্প্রতিক জপ';

  @override
  String get chantRecentEmpty => 'শুরু করতে বৃত্তে ট্যাপ করুন।';

  @override
  String chantTapNumber(int seq) {
    return '#$seq';
  }

  @override
  String get chantAutoBadge => 'স্বয়ংক্রিয়';

  @override
  String get chantDetectWords => 'শব্দ শনাক্ত করুন';

  @override
  String get chantDetectWordsOff => 'বন্ধ — শব্দ রেকর্ড হয় না';

  @override
  String get chantDetectWordsListening => 'শব্দ শুনছে…';

  @override
  String get chantDetectWordsPermission => 'মাইক্রোফোনের অনুমতি দরকার';

  @override
  String get chantDetectWordsStarting => 'প্রস্তুত হচ্ছে…';

  @override
  String get chantDetectWordsUnavailable =>
      'এই ডিভাইসে শব্দ শনাক্তকরণ পাওয়া যাচ্ছে না';

  @override
  String get chantDetectWordsNote =>
      'শব্দ আপনার ফোনেই শনাক্ত হয়, আর অডিও কখনও রেকর্ড করা হয় না। লেখাটি 7 দিন রাখা হয়, তারপর মুছে ফেলা হয়।';

  @override
  String get chantSetupTitle => 'জপের সহায়ক';

  @override
  String get chantSetupSubtitle =>
      'এই বৈঠক কীভাবে গোনা ও লিপিবদ্ধ হবে তা বেছে নিন। শোনা আপনার ফোনেই হয়।';

  @override
  String get chantSetupButton => 'স্বয়ংক্রিয় গণনা ও শব্দ';

  @override
  String get chantSetupNoneOn => 'সেট আপ করুন';

  @override
  String chantSetupOn(int count) {
    return '$countটি চালু';
  }

  @override
  String chantSetupButtonState(String button, String state) {
    return '$button · $state';
  }

  @override
  String get chantSetupDone => 'সম্পন্ন';

  @override
  String get chantAnalyticsTitle => 'জপ বিশ্লেষণ';

  @override
  String get chantTabThisSitting => 'এই বৈঠক';

  @override
  String get chantTabHistory => 'ইতিহাস';

  @override
  String chantMalaTitle(int number) {
    return 'মালা $number';
  }

  @override
  String get chantMalaInProgress => 'চলছে';

  @override
  String get chantMalaStart => 'শুরু';

  @override
  String get chantMalaEnd => 'শেষ';

  @override
  String get chantMalaDuration => 'সময়কাল';

  @override
  String chantMalaChants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$countটি জপ',
      one: '1টি জপ',
    );
    return '$_temp0';
  }

  @override
  String get chantTapsHeader => 'প্রতিটি জপ';

  @override
  String get chantHeardLabel => 'শোনা গেছে';

  @override
  String get chantNoMalasYet =>
      'এই বৈঠকে এখনও কোনো জপ হয়নি। আপনি যে মালাই শেষ করবেন, তার শুরু, শেষ ও সময় সহ এখানে তালিকাভুক্ত হবে।';

  @override
  String get chantHistoryEmpty => 'এখনও কোনো আগের বৈঠক নেই।';

  @override
  String chantHistorySummary(int malas, int chants) {
    return '$malas মালা · $chants জপ';
  }

  @override
  String get chantHistoryNoDetail => 'জপের সময় রেকর্ড শুরুর আগে গোনা';

  @override
  String get chantSessionTitle => 'বৈঠক';

  @override
  String get chantSessionNoMalas =>
      'এই বৈঠকে সময়সহ কোনো মালা রেকর্ড করা হয়নি।';

  @override
  String get chantHeardExpiry =>
      'শোনা শব্দ বৈঠকের 7 দিন পরে আপনার অ্যাকাউন্ট থেকে মুছে ফেলা হয়।';

  @override
  String get chantHeardTitle => 'এই মুহূর্তে শোনা';

  @override
  String get chantHeardHearing => 'আপনাকে শুনছে…';

  @override
  String get chantHeardWaiting => 'আপনার কণ্ঠের অপেক্ষায়';

  @override
  String get chantHeardPlaceholder =>
      'জোরে জপ করুন। আপনার ফোন যে শব্দ শুনবে তা এখানে দেখা যাবে।';

  @override
  String get chantHeardLast => 'শেষবার শোনা';

  @override
  String chantHeardCounted(int count) {
    return 'গোনা হয়েছে +$count';
  }

  @override
  String get chantHeardNotCounted => 'গোনা হয়নি';

  @override
  String chantHeardMatch(int percent, int needed) {
    return '$percent% মিল · দরকার $needed%';
  }

  @override
  String chantHeardMatchShort(int percent) {
    return '$percent% মিল';
  }

  @override
  String get chantHeardEarlier => 'আগের';

  @override
  String get chantAlongTitle => 'সঙ্গে জপ করুন';

  @override
  String get chantAlongCaption =>
      'কাউন্টার রেকর্ডিংয়ের সঙ্গে গোনে। এটি চলার সময় স্বয়ংক্রিয় গণনা ও শব্দ শনাক্তকরণ বিশ্রামে থাকে।';

  @override
  String get chantAlongPlay => 'রেকর্ডিং চালান';

  @override
  String get chantAlongPause => 'রেকর্ডিং থামান';

  @override
  String get chantAlongPosition => 'রেকর্ডিংয়ে অবস্থান';

  @override
  String get chantAlongLoading => 'রেকর্ডিং লোড হচ্ছে…';

  @override
  String get chantAlongLoadFailed => 'রেকর্ডিং লোড করা যায়নি।';

  @override
  String get settingsSectionLanguages => 'ভাষা';

  @override
  String get settingsLanguageApp => 'অ্যাপের ভাষা';

  @override
  String get settingsLanguageAppHint => 'মেনু, বোতাম ও লেবেল';

  @override
  String get settingsLanguageReading => 'পড়ার ভাষা';

  @override
  String get settingsLanguageReadingHint => 'অনুবাদ, অর্থ ও তাৎপর্য';

  @override
  String get settingsLanguageSpeaking => 'বলা ও শোনার ভাষা';

  @override
  String get settingsLanguageSpeakingHint => 'অডিও ও বলে শোনানো অর্থ';

  @override
  String get settingsLanguagePickerApp => 'অ্যাপের ভাষা বেছে নিন';

  @override
  String get settingsLanguagePickerReading => 'পড়ার ভাষা বেছে নিন';

  @override
  String get settingsLanguagePickerSpeaking => 'বলার ভাষা বেছে নিন';

  @override
  String get settingsLanguageSanskritNote =>
      'সংস্কৃত শ্লোক সবসময় সংস্কৃতেই থাকে।';

  @override
  String get readingAudioPlayAll => 'পড়ে শোনান';

  @override
  String get readingAudioPlayVerse => 'এই শ্লোকটি শুনুন';

  @override
  String get readingAudioPause => 'থামান';

  @override
  String get readingAudioResume => 'আবার চালু করুন';

  @override
  String get readingAudioStop => 'বন্ধ করুন';

  @override
  String get readingAudioNext => 'পরের শ্লোক';

  @override
  String get readingAudioPrevious => 'আগের শ্লোক';

  @override
  String get readingAudioFromStart => 'শুরু থেকে';

  @override
  String readingAudioResumeFrom(int number) {
    return 'শ্লোক $number থেকে চালিয়ে যান';
  }

  @override
  String readingAudioNowPlaying(String section, int number) {
    return '$section · শ্লোক $number';
  }

  @override
  String get readingAudioLoading => 'লোড হচ্ছে…';

  @override
  String get readingAudioChannel => 'পড়ে শোনানো';

  @override
  String get pushChannelName => 'দৈনিক শ্লোক ও বিজ্ঞপ্তি';

  @override
  String get readingSectionVerse => 'শ্লোক';

  @override
  String get readingSectionMeaning => 'অর্থ';

  @override
  String get readingSectionPurport => 'তাৎপর্য';

  @override
  String get settingsVoices => 'কণ্ঠস্বর';

  @override
  String settingsVoicesValue(int count) {
    return '$countটি ইনস্টল করা';
  }

  @override
  String get voicesTitle => 'কণ্ঠস্বর';

  @override
  String get voicesIntro =>
      'অর্থ ও তাৎপর্য আপনার বলার ভাষায় পড়ে শোনানো হয়। কণ্ঠস্বর ডাউনলোড না হওয়া পর্যন্ত আপনার ফোনের নিজস্ব কণ্ঠস্বর ব্যবহার হয়, তাই পড়া কখনও থেমে থাকে না।';

  @override
  String voicesStorage(String size) {
    return 'এই ফোনে $size ব্যবহার হচ্ছে';
  }

  @override
  String get voicesEmpty =>
      'ডাউনলোডের জন্য এখনও কোনো কণ্ঠস্বর নেই। আপনার ফোনের নিজস্ব কণ্ঠস্বর ব্যবহার হয়।';

  @override
  String get voiceDownload => 'ডাউনলোড করুন';

  @override
  String get voiceDelete => 'মুছুন';

  @override
  String get voiceCancel => 'বাতিল করুন';

  @override
  String get voiceRetry => 'আবার চেষ্টা করুন';

  @override
  String voiceInstalled(String size) {
    return 'ইনস্টল করা · $size';
  }

  @override
  String voiceNotInstalled(String size) {
    return 'ডাউনলোড করা নেই · $size';
  }

  @override
  String voiceDownloading(int percent) {
    return 'ডাউনলোড হচ্ছে $percent%';
  }

  @override
  String get voiceVerifying => 'যাচাই হচ্ছে…';

  @override
  String get voiceExtracting => 'ইনস্টল হচ্ছে…';

  @override
  String get voiceFailed => 'এই কণ্ঠস্বর ইনস্টল করা যায়নি';

  @override
  String get voiceUnavailable =>
      'এখনও পাওয়া যাচ্ছে না · আপনার ফোনের কণ্ঠস্বর ব্যবহার হবে';

  @override
  String get voiceDeleteTitle => 'এই কণ্ঠস্বর মুছবেন?';

  @override
  String get voiceDeleteBody =>
      'এটি আবার ডাউনলোড করা যায়। ততক্ষণ আপনার ফোনের নিজস্ব কণ্ঠস্বর ব্যবহার হবে।';

  @override
  String voiceLanguages(String languages) {
    return '$languages বলে';
  }

  @override
  String labelVerseWithSection(int number, String section) {
    return 'শ্লোক $number · $section';
  }

  @override
  String get chatTitle => 'Sakha-কে জিজ্ঞাসা করুন';

  @override
  String get chatHomeTitle => 'Sakha-কে জিজ্ঞাসা করুন';

  @override
  String get chatHomeBody => 'শাস্ত্র, মন্ত্র ও আপনার সাধনা নিয়ে প্রশ্ন';

  @override
  String get chatIntroTitle => 'আপনার বন্ধু Sakha';

  @override
  String get chatIntroHint =>
      'কোনো শ্লোক, মন্ত্র বা আপনার সাধনা সম্পর্কে জিজ্ঞাসা করুন।';

  @override
  String get chatComposerHint => 'প্রশ্ন করুন';

  @override
  String get chatSend => 'পাঠান';

  @override
  String get chatStop => 'থামান';

  @override
  String chatCharacterCount(int count, int max) {
    return '$count / $max';
  }

  @override
  String chatCreditsLeft(int percent) {
    return '$percent% বাকি';
  }

  @override
  String chatCreditsLeftLevel(int percent, String level) {
    return '$percent% বাকি · $level';
  }

  @override
  String get chatCreditsResetsMidnight => 'মধ্যরাতে রিসেট হবে';

  @override
  String chatCreditsRenews(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat('d MMM', localeName);
    final String dateString = dateDateFormat.format(date);

    return 'নবায়ন: $dateString';
  }

  @override
  String get chatNotAvailableTitle => 'চ্যাট আপনার প্ল্যানে নেই';

  @override
  String get chatNotAvailableBody =>
      'Sakha-কে প্রশ্ন করতে আপনার প্ল্যান আপগ্রেড করুন।';

  @override
  String get chatExhaustedDailyTitle => 'আজকের ক্রেডিট শেষ হয়ে গেছে';

  @override
  String get chatExhaustedDailyBody =>
      'মধ্যরাতে সেগুলো আবার ভরে যাবে। তখন আপনি চালিয়ে যেতে পারবেন, অথবা আরও পেতে আপগ্রেড করুন।';

  @override
  String get chatExhaustedWalletTitle => 'আপনার ক্রেডিট শেষ হয়ে গেছে';

  @override
  String get chatExhaustedWalletBody =>
      'এগুলো আপনার প্ল্যানের সঙ্গে নবায়ন হয়। আপনি অপেক্ষা করতে পারেন, অথবা চালিয়ে যেতে আপগ্রেড করুন।';

  @override
  String get chatShareUsedTitle =>
      'এই চ্যাট তার অংশের ক্রেডিট ব্যবহার করে ফেলেছে';

  @override
  String get chatShareUsedBody =>
      'নতুন চ্যাট শুরু করুন, আপনি যেখানে ছিলেন Sakha সেখান থেকেই চালিয়ে যাবে।';

  @override
  String get chatUpgrade => 'আপগ্রেড করুন';

  @override
  String get chatStartNewChat => 'নতুন চ্যাট শুরু করুন';

  @override
  String get chatFullTitle => 'এই চ্যাট অনেক লম্বা হয়ে গেছে';

  @override
  String get chatFullBody =>
      'নতুন চ্যাট শুরু করুন, Sakha আমাদের কথোপকথন এগিয়ে নিয়ে যাবে।';

  @override
  String get chatContinuePartial =>
      'আপনার সাম্প্রতিক বার্তাগুলোর সারাংশ করা যায়নি, তাই শুধু আগের অংশটি সঙ্গে এসেছে।';

  @override
  String get chatTidying => 'আমাদের কথোপকথন গুছিয়ে নেওয়া হচ্ছে…';

  @override
  String get chatTyping => 'Sakha লিখছে';

  @override
  String get chatConnectionLost =>
      'সংযোগ মাঝপথে বিচ্ছিন্ন হয়ে গেছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get chatReplyFailed =>
      'Sakha উত্তরটি শেষ করতে পারেনি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get chatOverloaded =>
      'Sakha এখন ব্যস্ত। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।';

  @override
  String get chatUnavailable =>
      'Sakha এখন উপলব্ধ নেই। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।';

  @override
  String get chatBusy =>
      'অনুগ্রহ করে বর্তমান উত্তরটি শেষ হওয়া পর্যন্ত অপেক্ষা করুন।';

  @override
  String get chatTooLong => 'এই বার্তাটি খুব লম্বা। অনুগ্রহ করে ছোট করুন।';

  @override
  String get chatStopped => 'থামানো হয়েছে';

  @override
  String get chatInterrupted => 'বাধাপ্রাপ্ত';

  @override
  String get chatCopy => 'কপি করুন';

  @override
  String get chatCopied => 'কপি হয়েছে';

  @override
  String get chatShare => 'শেয়ার করুন';

  @override
  String get chatRegenerate => 'আবার উত্তর দিন';

  @override
  String get chatLinkCopied => 'লিংক কপি হয়েছে';

  @override
  String get chatImageUnavailable => 'ছবি পাওয়া যাচ্ছে না';

  @override
  String get chatClearTooltip => 'চ্যাট পরিষ্কার করুন';

  @override
  String get chatClearTitle => 'এই চ্যাট পরিষ্কার করবেন?';

  @override
  String get chatClearBody =>
      'আপনার বার্তা এবং Sakha যে উত্তর দিয়েছে তা মুছে যাবে, আর আমাদের কথোপকথন Sakha মনে রাখবে না। ব্যবহৃত ক্রেডিট ফেরত পাওয়া যায় না।';

  @override
  String get chatClearConfirm => 'পরিষ্কার করুন';

  @override
  String get chatCleared => 'চ্যাট পরিষ্কার হয়েছে';

  @override
  String get chatSuggestionsLabel => 'এগুলি জিজ্ঞাসা করে দেখুন';

  @override
  String get chatStarter1Title => 'জীবনের জন্য একটি শ্লোক';

  @override
  String get chatStarter1Prompt =>
      'আমাকে ভগবদ্গীতা 2.47 বুঝিয়ে বলুন — ফলের চিন্তা না করে নিজের কর্তব্য পালন করা।';

  @override
  String get chatStarter2Title => 'জপ শুরু করা';

  @override
  String get chatStarter2Prompt =>
      'হরে কৃষ্ণ মহামন্ত্র জপ কীভাবে শুরু করব, আর শুরুতে কয় মালা করা উচিত?';

  @override
  String get chatStarter3Title => 'দৈনন্দিন সাধনা';

  @override
  String get chatStarter3Prompt =>
      'ব্যস্ত দিনেও রাখা যায় এমন একটি সহজ দৈনন্দিন সাধনা সুপারিশ করুন।';

  @override
  String get chatStarter4Title => 'যখন মন অস্থির';

  @override
  String get chatStarter4Prompt =>
      'আমার মন অস্থির লাগছে। শান্তি পাওয়া নিয়ে শাস্ত্র কী বলে?';

  @override
  String get chatStarter5Title => 'শোনার মতো একটি কাহিনি';

  @override
  String get chatStarter5Prompt =>
      'আমাকে প্রহ্লাদের কাহিনি বলুন এবং তা থেকে কী শিক্ষা পাওয়া যায় তা জানান।';

  @override
  String get chatFollowUp1 => 'সহজ করে বুঝিয়ে বলুন';

  @override
  String get chatFollowUp2 => 'একটি উদাহরণ দিন';

  @override
  String get chatFollowUp3 => 'এটি কেন গুরুত্বপূর্ণ?';

  @override
  String get chatFollowUp4 => 'এটি কীভাবে অনুশীলন করব?';

  @override
  String get chatAttach => 'ছবি যোগ করুন';

  @override
  String get chatAttachCamera => 'ছবি তুলুন';

  @override
  String get chatAttachGallery => 'আপনার ছবি থেকে বেছে নিন';

  @override
  String get chatAttachNote =>
      'ছবিটি উত্তর লেখায় সাহায্যকারী পরিষেবায় পাঠানো হয়, এবং আপনি চ্যাট পরিষ্কার না করা পর্যন্ত এখানে থাকে।';

  @override
  String get chatImageRemove => 'ছবি সরান';

  @override
  String get chatImageUploading => 'ছবি যোগ হচ্ছে…';

  @override
  String get chatImageFailed =>
      'ছবিটি যোগ করা যায়নি। আবার চেষ্টা করতে ট্যাপ করুন।';

  @override
  String get chatImageRejected =>
      'এই ছবিটি ব্যবহার করা যাবে না। অনুগ্রহ করে অন্যটি বেছে নিন।';

  @override
  String get chatImageOff => 'আপনার প্ল্যানে ছবি উপলব্ধ নয়।';

  @override
  String get chatImageSemantics => 'আপনার পাঠানো ছবি';

  @override
  String get chatPictureDenied =>
      'ছবি যোগ করতে ফোনের সেটিংসে ক্যামেরা বা ছবির অনুমতি দিন।';

  @override
  String get chatMic => 'বলে প্রশ্ন করুন';

  @override
  String get chatMicStop => 'শোনা বন্ধ করুন';

  @override
  String get chatListening => 'বলুন…';

  @override
  String get chatMicDenied =>
      'বলার জন্য ফোনের সেটিংসে মাইক্রোফোন ও স্পিচ রিকগনিশনের অনুমতি দিন।';

  @override
  String get chatMicUnavailable => 'এই ফোনে বলে লেখা সম্ভব নয়।';

  @override
  String get chatMicNoSpeech =>
      'কিছু শোনা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get chatMicFailed =>
      'শোনা বন্ধ হয়ে গেছে। অনুগ্রহ করে আবার চেষ্টা করুন।';

  @override
  String get chatJumpToLatest => 'সর্বশেষ';

  @override
  String get verseAskSakha => 'এই শ্লোক সম্পর্কে Sakha-কে জিজ্ঞাসা করুন';

  @override
  String chatExplainVerse(String reference, String verse) {
    return 'অনুগ্রহ করে এই শ্লোকটি সহজ ভাষায় বুঝিয়ে দিন — $reference:\n\n$verse';
  }

  @override
  String chatActionQuestion(String place) {
    return '$place খুলবেন?';
  }

  @override
  String get chatActionOpen => 'খুলুন';

  @override
  String get chatActionNotNow => 'এখন নয়';

  @override
  String get searchTabAll => 'সব';

  @override
  String get searchAllBooks => 'সব গ্রন্থ';

  @override
  String searchShowingFor(String query) {
    return '“\$query”-এর ফলাফল দেখানো হচ্ছে';
  }

  @override
  String searchNoResultsInBook(String book) {
    return '\$book-এ কিছু পাওয়া যায়নি। সব গ্রন্থে খুঁজুন, অথবা অন্য বানান চেষ্টা করুন।';
  }

  @override
  String get searchTipsTitle => 'অনুসন্ধানের টিপস';

  @override
  String get searchTipSpelling => 'যেমন শোনায় তেমন লিখুন। “krishna”, “krsna” ও “kṛṣṇa” একই শ্লোক খুঁজে দেয়।';

  @override
  String get searchTipBook => 'গ্রন্থের নাম দিয়ে শুরু করুন — “gita karma” বা “bhagavatam surrender” — তাহলে শুধু সেটিতেই খোঁজা হবে।';

  @override
  String get searchTipPartial => 'শ্লোক, তার অর্থ বা তাৎপর্যের কয়েকটি শব্দ লিখুন। ছোটখাটো ভুল চলবে।';
}
