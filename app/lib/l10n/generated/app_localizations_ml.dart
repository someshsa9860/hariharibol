// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Malayalam (`ml`).
class AppLocalizationsMl extends AppLocalizations {
  AppLocalizationsMl([String locale = 'ml']) : super(locale);

  @override
  String get appName => 'HariHariBol';

  @override
  String get splashTagline => 'വായന · ജപം · സാധന';

  @override
  String get actionRetry => 'വീണ്ടും ശ്രമിക്കുക';

  @override
  String get actionCancel => 'റദ്ദാക്കുക';

  @override
  String get actionOk => 'ശരി';

  @override
  String get actionDone => 'പൂർത്തിയായി';

  @override
  String get actionSave => 'സേവ് ചെയ്യുക';

  @override
  String get actionViewAll => 'എല്ലാം കാണുക';

  @override
  String get actionSignOut => 'സൈൻ ഔട്ട് ചെയ്യുക';

  @override
  String get actionDeleteAccount => 'അക്കൗണ്ട് ഇല്ലാതാക്കുക';

  @override
  String get actionContinue => 'തുടരുക';

  @override
  String get errorGeneric =>
      'എന്തോ പിഴവ് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get errorNetwork =>
      'കണക്ഷൻ ഇല്ല. ഇന്റർനെറ്റ് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get errorTimeout =>
      'ഇതിന് വളരെയധികം സമയമെടുത്തു. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get errorSessionExpired =>
      'നിങ്ങളുടെ സെഷൻ അവസാനിച്ചു. ദയവായി വീണ്ടും സൈൻ ഇൻ ചെയ്യുക.';

  @override
  String get errorSignIn =>
      'നിങ്ങളെ സൈൻ ഇൻ ചെയ്യിക്കാൻ ഞങ്ങൾക്കു കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get errorInsecureConnection => 'കണക്ഷൻ സുരക്ഷിതമല്ല.';

  @override
  String get errorCancelled => 'അഭ്യർത്ഥന റദ്ദാക്കി.';

  @override
  String get errorEmptyTitle => 'ഇവിടെ ഇതുവരെ ഒന്നുമില്ല';

  @override
  String get errorRouteNotFound => 'ആ സ്ക്രീൻ നിലവിലില്ല.';

  @override
  String get actionGoHome => 'ഹോമിലേക്ക് പോകുക';

  @override
  String get signInTitle => 'സ്വാഗതം';

  @override
  String get signInSubtitle =>
      'വായിക്കുക, ജപിക്കുക, നിങ്ങളുടെ ദൈനംദിന സാധന ഒരിടത്ത് സൂക്ഷിക്കുക.';

  @override
  String get signInWithGoogle => 'Google ഉപയോഗിച്ച് തുടരുക';

  @override
  String get signInWithApple => 'Apple ഉപയോഗിച്ച് തുടരുക';

  @override
  String get signInCancelled => 'സൈൻ ഇൻ റദ്ദാക്കി.';

  @override
  String get signInFailed =>
      'നിങ്ങളെ സൈൻ ഇൻ ചെയ്യിക്കാൻ ഞങ്ങൾക്കു കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String get signInLegal =>
      'തുടരുന്നതിലൂടെ നിങ്ങൾ ഞങ്ങളുടെ നിബന്ധനകളും സ്വകാര്യതാ നയവും അംഗീകരിക്കുന്നു.';

  @override
  String languageStepOf(int current, int total) {
    return 'ഘട്ടം $current / $total';
  }

  @override
  String get languageAppTitle =>
      'ഏത് ഭാഷയാണ് നിങ്ങൾക്ക് സ്വന്തം വീടുപോലെ തോന്നുന്നത്?';

  @override
  String get languageAppSubtitle =>
      'ഇത് എപ്പോൾ വേണമെങ്കിലും ക്രമീകരണങ്ങളിൽ മാറ്റാം.';

  @override
  String get languageMantraTitle => 'ഏത് ലിപിയിലാണ് നിങ്ങൾ ജപിക്കുന്നത്?';

  @override
  String get languageMantraSubtitle =>
      'മന്ത്രങ്ങൾ ഈ ലിപിയിൽ കാണിക്കും. അവയുടെ അർത്ഥം നിങ്ങളുടെ സ്വന്തം ഭാഷയിൽ തന്നെ തുടരും.';

  @override
  String get actionBack => 'തിരികെ';

  @override
  String get tabHome => 'ഹോം';

  @override
  String get tabSadhana => 'ജപം';

  @override
  String get tabLibrary => 'വായന';

  @override
  String get tabRoutine => 'ദിനചര്യ';

  @override
  String get reelsTitle => 'റീലുകൾ';

  @override
  String get tabSearch => 'തിരയുക';

  @override
  String get homeGreeting => 'ഹരി ബോൾ';

  @override
  String homeGreetingNamed(String name) {
    return 'ഹരി ബോൾ, $name';
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
  String get homeMoodPrompt => 'ഇന്ന് നിങ്ങൾക്ക് എങ്ങനെയുണ്ട്?';

  @override
  String get homeMoodAnsweredToday =>
      'ഇന്ന് നിങ്ങൾക്ക് എങ്ങനെ തോന്നുന്നു എന്ന് നിങ്ങൾ പങ്കുവച്ചു കഴിഞ്ഞു. പുതിയത് പങ്കുവയ്ക്കാൻ നാളെ വീണ്ടും വരൂ.';

  @override
  String homeMoodViewToday(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ഇന്നത്തെ $count ശ്ലോകങ്ങൾ വീണ്ടും വായിക്കുക',
      one: 'ഇന്നത്തെ ശ്ലോകം വീണ്ടും വായിക്കുക',
    );
    return '$_temp0';
  }

  @override
  String homeMoodSubmit(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'എനിക്ക് $count ശ്ലോകങ്ങൾ കാണിക്കൂ',
      one: 'എനിക്ക് ഒരു ശ്ലോകം കാണിക്കൂ',
    );
    return '$_temp0';
  }

  @override
  String get homeVerseOfTheDay => 'ഇന്നത്തെ ശ്ലോകം';

  @override
  String get homeSlokaForYou => 'ഇന്ന് നിങ്ങൾക്കായി';

  @override
  String get homeTodaysSadhana => 'ഇന്നത്തെ സാധന';

  @override
  String get homeContinueReading => 'വായന തുടരുക';

  @override
  String get homeBooks => 'പുസ്തകങ്ങൾ';

  @override
  String get homeMantras => 'മന്ത്രങ്ങൾ';

  @override
  String get homeStartYourDay => 'ഇന്നത്തെ ലക്ഷ്യം നിശ്ചയിക്കുക';

  @override
  String homeChantMantra(String mantra) {
    return '$mantra ജപിക്കുക';
  }

  @override
  String bookChapterCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count അധ്യായങ്ങൾ',
      one: '1 അധ്യായം',
    );
    return '$_temp0';
  }

  @override
  String bookVerseCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ശ്ലോകങ്ങൾ',
      one: '1 ശ്ലോകം',
    );
    return '$_temp0';
  }

  @override
  String get searchHint => 'ശ്ലോകങ്ങൾ, മന്ത്രങ്ങൾ, പുസ്തകങ്ങൾ തിരയുക';

  @override
  String get searchPrompt =>
      'മുഴുവൻ ലൈബ്രറിയിലും, നേരിട്ട് സെർവറിൽ നിന്ന് തിരയുക.';

  @override
  String get searchShortcutLabel =>
      'അല്ലെങ്കിൽ നേരിട്ട് ഒരു ശ്ലോകത്തിലേക്ക് പോകുക:';

  @override
  String get searchNoResults =>
      'ഫലങ്ങളൊന്നുമില്ല. മറ്റൊരു വാക്കോ BG 2.47 പോലുള്ള ഒരു റഫറൻസോ പരീക്ഷിക്കുക.';

  @override
  String get searchSectionVerses => 'ശ്ലോകങ്ങൾ';

  @override
  String searchResultsTitle(String kind, String query) {
    return '$kind · $query';
  }

  @override
  String labelCanto(int number) {
    return 'സ്കന്ധം $number';
  }

  @override
  String labelChapter(int number) {
    return 'അധ്യായം $number';
  }

  @override
  String labelVerse(int number) {
    return 'ശ്ലോകം $number';
  }

  @override
  String labelCantoChapter(int canto, int chapter) {
    return 'സ്കന്ധം $canto · അധ്യായം $chapter';
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
    return '$done / $target മാലകൾ';
  }

  @override
  String sadhanaTasksProgress(int done, int total) {
    return '$total ടാസ്കുകളിൽ $done പൂർത്തിയായി';
  }

  @override
  String sadhanaStreak(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days ദിവസത്തെ തുടർച്ച',
      one: '1 ദിവസത്തെ തുടർച്ച',
      zero: 'ഇതുവരെ തുടർച്ചയില്ല',
    );
    return '$_temp0';
  }

  @override
  String get sadhanaGenericChant => 'ജപം';

  @override
  String sadhanaRoundsShort(int rounds) {
    return '$rounds മാല';
  }

  @override
  String get sadhanaTodaysSessions => 'ഇന്നത്തെ ജപം';

  @override
  String get sadhanaNoSessionsYet =>
      'ഇന്ന് ഇതുവരെ ഒന്നും രേഖപ്പെടുത്തിയിട്ടില്ല.';

  @override
  String get sadhanaRoundsEyebrow => 'ഇന്നത്തെ മാലകൾ';

  @override
  String get sadhanaRoundsCaption => 'മാലകൾ';

  @override
  String get sadhanaChantNow => 'ഇപ്പോൾ ജപിക്കുക';

  @override
  String get sadhanaLogRounds => 'മാലകൾ രേഖപ്പെടുത്തുക';

  @override
  String get sadhanaLogRoundsSubtitle =>
      'നിങ്ങളുടെ ജപമാലയിൽ ജപിച്ച മാലകൾ, ഇന്നത്തെ ആകെ എണ്ണത്തിൽ ചേർക്കും.';

  @override
  String sadhanaLogRoundsSubmit(int rounds) {
    return '$rounds മാല രേഖപ്പെടുത്തുക';
  }

  @override
  String get sadhanaTargetReached => 'ഇന്നത്തെ ലക്ഷ്യം കൈവരിച്ചു';

  @override
  String get sadhanaUndoBead => 'അവസാനത്തെ മണി തിരികെയെടുക്കുക';

  @override
  String get sadhanaElapsedEyebrow => 'കഴിഞ്ഞ സമയം';

  @override
  String get sadhanaPaceEyebrow => 'വേഗം';

  @override
  String sadhanaElapsedSeconds(String seconds) {
    return '$seconds സെക്കൻഡ്';
  }

  @override
  String sadhanaPacePerMantra(String seconds) {
    return 'ഓരോന്നിനും $seconds സെക്കൻഡ്';
  }

  @override
  String get sadhanaAutoCount => 'സ്വയം എണ്ണൽ';

  @override
  String get sadhanaAutoCountOff => 'ഓഫ് — മണി സ്വയം ടാപ്പ് ചെയ്യുക';

  @override
  String get sadhanaAutoCountIdle => 'ജപത്തിനായി കാത്തിരിക്കുന്നു';

  @override
  String get sadhanaAutoCountListening => 'കേൾക്കുന്നു…';

  @override
  String get sadhanaAutoCountCounted => 'എണ്ണി — അടുത്തതിനായി കേൾക്കുന്നു';

  @override
  String get sadhanaAutoCountPermissionDenied =>
      'സ്വയം എണ്ണലിന് മൈക്രോഫോൺ അനുമതി ആവശ്യമാണ്';

  @override
  String get sadhanaAutoCountUnavailable => 'സ്വയം എണ്ണൽ ഇപ്പോൾ ലഭ്യമല്ല';

  @override
  String get chantModelTitle => 'കൂടുതൽ കൃത്യമായി കേൾക്കൽ';

  @override
  String chantModelOffer(int megabytes) {
    return 'സംസ്കൃതം വളരെ നന്നായി മനസ്സിലാക്കുന്നു. $megabytes MB ഒറ്റത്തവണ ഡൗൺലോഡ് — Wi-Fi ഉപയോഗിക്കുക.';
  }

  @override
  String get chantModelDownload => 'ഡൗൺലോഡ് ചെയ്യുക';

  @override
  String chantModelDownloading(int percent) {
    return 'ഡൗൺലോഡ് ചെയ്യുന്നു… $percent%';
  }

  @override
  String get chantModelCancel => 'റദ്ദാക്കുക';

  @override
  String get chantModelInstalled =>
      'ഡൗൺലോഡ് ചെയ്തു — അടുത്ത തവണ സ്വയം എണ്ണൽ ഓണാക്കുമ്പോൾ ഉപയോഗിക്കും';

  @override
  String get chantModelRemove => 'നീക്കം ചെയ്യുക';

  @override
  String get chantModelFailed => 'ഡൗൺലോഡ് പൂർത്തിയായില്ല';

  @override
  String get chantModelRetry => 'വീണ്ടും ശ്രമിക്കുക';

  @override
  String get mantraAllCategories => 'എല്ലാം';

  @override
  String get mantraNoneInCategory => 'ഈ വിഭാഗത്തിൽ ഇതുവരെ മന്ത്രങ്ങളില്ല.';

  @override
  String get mantraCategoryBeej => 'ബീജമന്ത്രം';

  @override
  String get mantraCategoryGayatri => 'ഗായത്രീ';

  @override
  String get mantraCategoryMahamantra => 'മഹാമന്ത്രം';

  @override
  String get mantraCategoryName => 'നാമമന്ത്രം';

  @override
  String mantraStandardRounds(int rounds) {
    return '$rounds മാല';
  }

  @override
  String mantraStandardCount(int count) {
    return '$count തവണ';
  }

  @override
  String get mantraHasAudio => 'പാരായണം ലഭ്യമാണ്';

  @override
  String get mantraPurport => 'ഭാവാർത്ഥം';

  @override
  String mantraMyRounds(int rounds) {
    return 'ഇതിന്റെ $rounds മാല നിങ്ങൾ ജപിച്ചിട്ടുണ്ട്';
  }

  @override
  String get mantraChantThis => 'ഇത് ജപിക്കുക';

  @override
  String get profileStatVersesSaved => 'സേവ് ചെയ്ത ശ്ലോകങ്ങൾ';

  @override
  String get profileStatTotalRounds => 'ആകെ മാലകൾ';

  @override
  String get profileStatChantingDays => 'ജപിച്ച ദിവസങ്ങൾ';

  @override
  String get profileStatSlokasRead => 'വായിച്ച ശ്ലോകങ്ങൾ';

  @override
  String get profileRecentFavorites => 'അടുത്തിടെയുള്ള പ്രിയപ്പെട്ടവ';

  @override
  String get profileNoFavorites =>
      'ഇതുവരെ ഒന്നും സേവ് ചെയ്തിട്ടില്ല. ഒരു ശ്ലോകം ബുക്ക്‌മാർക്ക് ചെയ്താൽ അത് ഇവിടെ ഉണ്ടാകും.';

  @override
  String get settingsTitle => 'ക്രമീകരണങ്ങൾ';

  @override
  String get settingsSectionPractice => 'സാധന';

  @override
  String get settingsSectionAccount => 'അക്കൗണ്ട്';

  @override
  String get settingsLanguage => 'ഭാഷ';

  @override
  String get settingsTheme => 'തീം';

  @override
  String get settingsDailyGoal => 'ദൈനംദിന ലക്ഷ്യം';

  @override
  String get settingsDailyGoalSubtitle =>
      'ഓരോ ദിവസവും ലക്ഷ്യമിടേണ്ട മാലകൾ. ഓരോ പുതിയ ദിവസവും ഇതിൽ നിന്ന് തുടങ്ങും.';

  @override
  String settingsDailyGoalSubmit(int rounds) {
    return 'ദൈനംദിന ലക്ഷ്യം $rounds ആക്കുക';
  }

  @override
  String get settingsPreferredMantra => 'ഇഷ്ട മന്ത്രം';

  @override
  String get settingsPreferredMantraNone => 'സജ്ജീകരിച്ചിട്ടില്ല';

  @override
  String get settingsChooseMantraTitle => 'നിങ്ങളുടെ മന്ത്രം തിരഞ്ഞെടുക്കുക';

  @override
  String get settingsChooseMantraSubtitle =>
      '“ഇപ്പോൾ ജപിക്കുക” ഏത് മന്ത്രത്തോടെ തുറക്കണം. മറ്റേത് മന്ത്രവും അതിന്റെ സ്വന്തം പേജിൽ നിന്ന് നിങ്ങൾക്ക് ജപിക്കാം.';

  @override
  String get settingsNoMantraPreference =>
      'മുൻഗണനയില്ല — ഓരോ തവണയും എന്നോട് ചോദിക്കുക';

  @override
  String get settingsPlans => 'പ്ലാനുകളും പ്രീമിയവും';

  @override
  String get plansTitle => 'പ്ലാനുകൾ';

  @override
  String get plansSubtitle =>
      'ആപ്പ് മുഴുവൻ സൗജന്യമാണ്. പണമടച്ചുള്ള ഒരു പ്ലാൻ അതിന് മുകളിൽ അല്പം കൂടി ചേർക്കുന്നു.';

  @override
  String get plansYourPlan => 'നിങ്ങളുടെ പ്ലാൻ';

  @override
  String get plansCurrent => 'നിലവിലെ പ്ലാൻ';

  @override
  String get plansFreeForEveryone => 'എല്ലാവർക്കും സൗജന്യം';

  @override
  String plansPricePer(String price, String period) {
    return '$price / $period';
  }

  @override
  String get plansPeriodWeek => 'ആഴ്ച';

  @override
  String get plansPeriodMonth => 'മാസം';

  @override
  String get plansPeriodYear => 'വർഷം';

  @override
  String plansPeriodDays(int days) {
    return '$days ദിവസം';
  }

  @override
  String plansTrial(int days) {
    return '$days ദിവസത്തെ സൗജന്യ ട്രയൽ';
  }

  @override
  String get plansSubscribe => 'സബ്‌സ്ക്രൈബ് ചെയ്യുക';

  @override
  String get plansStartTrial => 'സൗജന്യ ട്രയൽ ആരംഭിക്കുക';

  @override
  String get plansRestore => 'വാങ്ങലുകൾ പുനഃസ്ഥാപിക്കുക';

  @override
  String get plansStoreUnavailable => 'ഈ ഉപകരണത്തിൽ സ്റ്റോർ ലഭ്യമല്ല.';

  @override
  String get plansProductMissing => 'ഈ പ്ലാൻ ഇപ്പോൾ സ്റ്റോറിൽ ലഭ്യമല്ല.';

  @override
  String get plansPurchasePending => 'നിങ്ങളുടെ വാങ്ങൽ പ്രോസസ്സ് ചെയ്യുന്നു…';

  @override
  String get plansPurchaseSuccess => 'നന്ദി — നിങ്ങളുടെ പ്ലാൻ സജീവമാണ്.';

  @override
  String get plansPurchaseFailed => 'വാങ്ങൽ പൂർത്തിയായില്ല.';

  @override
  String get plansPurchaseCancelled => 'വാങ്ങൽ റദ്ദാക്കി.';

  @override
  String plansRenews(String date) {
    return 'പുതുക്കുന്ന തീയതി: $date';
  }

  @override
  String plansEnds(String date) {
    return '$date വരെ ആക്സസ്';
  }

  @override
  String get plansPermanent =>
      'എന്നെന്നേക്കുമായി നിങ്ങളുടേത് — HariHariBol-നെ പിന്തുണച്ചതിന് നന്ദി.';

  @override
  String get plansIncluded => 'ഉൾപ്പെടുന്നു';

  @override
  String get plansNotIncluded => 'ഉൾപ്പെടുന്നില്ല';

  @override
  String get plansUnlimited => 'പരിധിയില്ലാത്തത്';

  @override
  String plansLimit(int limit, String unit) {
    return '$limit $unit';
  }

  @override
  String get plansNoFeatures =>
      'ഇതുവരെ അധിക ആനുകൂല്യങ്ങളില്ല — കൂടുതൽ വരുന്നു.';

  @override
  String get plansRestoreDone => 'വാങ്ങലുകൾ പുനഃസ്ഥാപിച്ചു.';

  @override
  String get settingsPrivacy => 'സ്വകാര്യതാ നയം';

  @override
  String settingsVersion(String version) {
    return 'പതിപ്പ് $version';
  }

  @override
  String get settingsMadeWith => 'ഭക്തിയോടെ നിർമ്മിച്ചത്';

  @override
  String settingsFooter(String version, String madeWith) {
    return '$version · $madeWith';
  }

  @override
  String get themeSystem => 'ഓട്ടോ';

  @override
  String get themeLight => 'ലൈറ്റ്';

  @override
  String get themeDark => 'ഡാർക്ക്';

  @override
  String profileSignedInAs(String email) {
    return 'സൈൻ ഇൻ ചെയ്ത അക്കൗണ്ട്: $email';
  }

  @override
  String get profilePremium => 'പ്രീമിയം';

  @override
  String get profileFree => 'സൗജന്യം';

  @override
  String get signOutConfirm =>
      'നിങ്ങളുടെ സാധനാ ചരിത്രം കാണാൻ വീണ്ടും സൈൻ ഇൻ ചെയ്യേണ്ടി വരും.';

  @override
  String get deleteAccountTitle => 'നിങ്ങളുടെ അക്കൗണ്ട് ഇല്ലാതാക്കണോ?';

  @override
  String get deleteAccountBody =>
      'ഇത് നിങ്ങളുടെ സാധനാ ചരിത്രം, പ്രിയപ്പെട്ടവ, അറിയിപ്പുകൾ എന്നിവ നീക്കം ചെയ്യും. ഇത് തിരികെയെടുക്കാൻ കഴിയില്ല.';

  @override
  String get comingSoon => 'ഉടൻ വരുന്നു';

  @override
  String get libraryNoBooks =>
      'ഇതുവരെ പുസ്തകങ്ങളൊന്നും പ്രസിദ്ധീകരിച്ചിട്ടില്ല.';

  @override
  String get actionEdit => 'എഡിറ്റ് ചെയ്യുക';

  @override
  String get actionDelete => 'ഇല്ലാതാക്കുക';

  @override
  String get libraryDownloadBook => 'ഓഫ്‌ലൈനായി വായിക്കാൻ ഡൗൺലോഡ് ചെയ്യുക';

  @override
  String get libraryDownloading => 'ഡൗൺലോഡ് ചെയ്യുന്നു…';

  @override
  String get libraryDownloaded => 'ഓഫ്‌ലൈൻ വായനയ്ക്കായി ഡൗൺലോഡ് ചെയ്തു';

  @override
  String get libraryDownloadFailed =>
      'ഈ പുസ്തകം ഡൗൺലോഡ് ചെയ്യാനായില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.';

  @override
  String bookCantoCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count സ്കന്ധങ്ങൾ',
      one: '1 സ്കന്ധം',
    );
    return '$_temp0';
  }

  @override
  String bookByTranslators(String names) {
    return 'വിവർത്തനം: $names';
  }

  @override
  String get chapterPrevious => 'മുൻ അധ്യായം';

  @override
  String get chapterNext => 'അടുത്ത അധ്യായം';

  @override
  String get actionBookmark => 'ബുക്ക്‌മാർക്ക്';

  @override
  String get actionRemoveBookmark => 'ബുക്ക്‌മാർക്ക് നീക്കുക';

  @override
  String get actionHighlight => 'ഹൈലൈറ്റ്';

  @override
  String get actionRemoveHighlight => 'ഹൈലൈറ്റ് നീക്കുക';

  @override
  String get verseExplanationLabel => 'വിശദീകരണം';

  @override
  String get verseExplanationAiLabel => 'വിശദീകരണം (AI സഹായത്തോടെ)';

  @override
  String get verseWordMeanings => 'വാക്കുകളുടെ അർത്ഥം';

  @override
  String get verseCompareTranslations => 'വിവർത്തനങ്ങൾ താരതമ്യം ചെയ്യുക';

  @override
  String get verseTranslationsEmpty =>
      'മറ്റ് വിവർത്തനങ്ങൾ ഇതുവരെ പ്രസിദ്ധീകരിച്ചിട്ടില്ല.';

  @override
  String get verseRelatedTitle => 'ബന്ധപ്പെട്ട ശ്ലോകങ്ങൾ';

  @override
  String get verseRelatedEmpty => 'ബന്ധപ്പെട്ട ശ്ലോകങ്ങൾ ഇതുവരെയില്ല.';

  @override
  String get relationSameConcept => 'ഇതേ ആശയം';

  @override
  String get relationExpandsOn => 'വിപുലീകരിക്കുന്നു';

  @override
  String get relationQuotedIn => 'ഉദ്ധരിച്ചിരിക്കുന്നത്';

  @override
  String get relationContrastsWith => 'ഇതിൽ നിന്ന് വ്യത്യസ്തം';

  @override
  String get verseNotesTitle => 'എന്റെ കുറിപ്പുകൾ';

  @override
  String get verseNoteHint => 'ഒരു കുറിപ്പ് എഴുതുക…';

  @override
  String get verseNoteAdd => 'കുറിപ്പ് ചേർക്കുക';

  @override
  String get verseNoteEmpty => 'ഈ ശ്ലോകത്തിൽ ഇതുവരെ കുറിപ്പുകളില്ല.';

  @override
  String get verseNoteDeleteConfirm => 'ഈ കുറിപ്പ് ഇല്ലാതാക്കണോ?';

  @override
  String get readingSettingsTitle => 'വായനാ ക്രമീകരണങ്ങൾ';

  @override
  String get readingFontSizeLabel => 'അക്ഷര വലുപ്പം';

  @override
  String get readingFontSizeSmall => 'ചെറുത്';

  @override
  String get readingFontSizeMedium => 'ഇടത്തരം';

  @override
  String get readingFontSizeLarge => 'വലുത്';

  @override
  String get readingFontSizeExtraLarge => 'വളരെ വലുത്';

  @override
  String get readingLanguageLabel => 'വായനാ ഭാഷ';

  @override
  String get routineSubtitle => 'ഭക്തി, ജോലി, അതിനിടയിലെ സാധാരണ കാര്യങ്ങൾ.';

  @override
  String routineProgress(int done, int total) {
    return '$total-ൽ $done പൂർത്തിയായി';
  }

  @override
  String get routineEmptyBody =>
      'ഒരു മാല ജപം, ഒരു ചെറുപണി, ഒരു വീട്ടുകാര്യം ചേർക്കുക — ഇന്നത്തെ ദിവസം ലക്ഷ്യബോധത്തോടെ രൂപപ്പെടുത്തുക.';

  @override
  String get routineAddTask => 'ടാസ്ക് ചേർക്കുക';

  @override
  String get routineTaskHint => 'എന്താണ് ചെയ്യേണ്ടത്?';

  @override
  String get routineCategoryLabel => 'വിഭാഗം';

  @override
  String get routineCategoryDevotion => 'ഭക്തി';

  @override
  String get routineCategoryWork => 'ജോലി';

  @override
  String get routineCategoryHome => 'വീട്';

  @override
  String get routineCategoryErrand => 'പുറത്തെ കാര്യങ്ങൾ';

  @override
  String get routineSlotMorning => 'രാവിലെ';

  @override
  String get routineSlotAfternoon => 'ഉച്ചയ്ക്ക്';

  @override
  String get routineSlotEvening => 'വൈകുന്നേരം';

  @override
  String get routineSlotAnytime => 'ഏത് സമയത്തും';

  @override
  String get routinePresetWakeUp => 'ഉണരൽ';

  @override
  String get routinePresetMorningChant => 'പ്രഭാത ജപം';

  @override
  String get routinePresetExercise => 'വ്യായാമം';

  @override
  String get routinePresetBreakfast => 'പ്രഭാതഭക്ഷണം';

  @override
  String get routinePresetLunch => 'ഉച്ചഭക്ഷണം';

  @override
  String get routinePresetEveningChant => 'സായാഹ്ന ജപം';

  @override
  String get routinePresetDinner => 'അത്താഴം';

  @override
  String get routinePresetScriptureReading => 'ശാസ്ത്രപാരായണം';

  @override
  String get routinePresetSleep => 'ഉറക്കം';

  @override
  String get routineTaskNameLabel => 'ടാസ്കിന്റെ പേര്';

  @override
  String get routineWindowHeading => 'നിശ്ചയിച്ച സമയം';

  @override
  String get routineWindowHint =>
      'ഈ പരിധിക്കുള്ളിൽ ചെയ്താൽ കൃത്യസമയത്ത്, അതിനു മുമ്പാണെങ്കിൽ നേരത്തേ, അതിനു ശേഷമാണെങ്കിൽ വൈകി എന്നു കണക്കാക്കും.';

  @override
  String get routineWindowSet => 'സമയപരിധി നിശ്ചയിക്കുക';

  @override
  String get routineWindowClear => 'സമയപരിധി നീക്കുക';

  @override
  String get routineWindowFrom => 'മുതൽ';

  @override
  String get routineWindowTo => 'വരെ';

  @override
  String routineWindowRange(String start, String end) {
    return '$start – $end';
  }

  @override
  String get routineWindowInvalid =>
      'അവസാന സമയം ആരംഭ സമയത്തിനു ശേഷമായിരിക്കണം.';

  @override
  String get routineStatusNotDone => 'പൂർത്തിയായില്ല';

  @override
  String get routineStatusDone => 'പൂർത്തിയായി';

  @override
  String get routineStatusEarly => 'നേരത്തേ';

  @override
  String get routineStatusOnTime => 'കൃത്യസമയത്ത്';

  @override
  String get routineStatusLate => 'വൈകി';

  @override
  String routineStatusAtTime(String status, String time) {
    return '$status · $time';
  }

  @override
  String get routineChangeTime => 'സമയം മാറ്റുക';

  @override
  String get routinePickDoneTime => 'ഇത് എപ്പോഴാണ് പൂർത്തിയായത്?';

  @override
  String get routineSaveAction => 'ഈ ദിവസത്തിലേക്ക് ചേർക്കുക';

  @override
  String get routineTaskRemoved => 'ഈ ദിവസത്തിൽ നിന്ന് നീക്കി';

  @override
  String get routineUndo => 'തിരികെയെടുക്കുക';

  @override
  String get routineToday => 'ഇന്ന്';

  @override
  String get routineJumpToToday => 'ഇന്നത്തേക്ക് പോകുക';

  @override
  String get routineEkadashi => 'ഏകാദശി';

  @override
  String get routineEkadashiNote =>
      'ഏകദേശം — ക്ഷേത്രത്തിലെ പഞ്ചാംഗത്തിൽ ഒരു ദിവസത്തെ വ്യത്യാസം ഉണ്ടാകാം.';

  @override
  String routineDayLabel(String date, String ekadashi, int done, int total) {
    String _temp0 = intl.Intl.selectLogic(ekadashi, {
      'yes': ' · ഏകാദശി',
      'other': '',
    });
    String _temp1 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: ' · $total-ൽ $done പൂർത്തിയായി',
      zero: '',
    );
    return '$date$_temp0$_temp1';
  }

  @override
  String get routineNothingPlanned =>
      'ഈ ദിവസത്തേക്ക് ഒന്നും ആസൂത്രണം ചെയ്തിട്ടില്ല.';

  @override
  String get routineManageDaily => 'ദൈനംദിന ദിനചര്യ';

  @override
  String get routineDailyTitle => 'ദൈനംദിന ദിനചര്യ';

  @override
  String get routineDailyBody =>
      'ഓപ്ഷണൽ. ഇവ എല്ലാ ദിവസവും ആവർത്തിക്കും, ഓരോ ദിവസവും പുതുതായി ടിക്ക് ചെയ്യാം.';

  @override
  String get routineDailyEmpty => 'ഇതുവരെ ദൈനംദിന ദിനചര്യയില്ല.';

  @override
  String get routineDailyAdd => 'ദൈനംദിന ദിനചര്യയിലേക്ക് ചേർക്കുക';

  @override
  String get routineDailySaveAction => 'എല്ലാ ദിവസത്തേക്കും ചേർക്കുക';

  @override
  String get routineDailyBadge => 'ദിവസേന';

  @override
  String get routineDailyRemove => 'ദൈനംദിന ദിനചര്യയിൽ നിന്ന് നീക്കുക';

  @override
  String get routineDailyRemoved =>
      'നിങ്ങളുടെ ദൈനംദിന ദിനചര്യയിൽ നിന്ന് നീക്കി';

  @override
  String get reelsEmpty => 'ഇതുവരെ റീലുകളില്ല';

  @override
  String get reelsEmptyBody =>
      'ക്രിയേറ്റർമാർ പോസ്റ്റ് ചെയ്തു തുടങ്ങുമ്പോൾ, അവരുടെ റീലുകൾ ഇവിടെ കാണാം.';

  @override
  String get reelsFailed => 'റീലുകൾ ലോഡ് ചെയ്യാനായില്ല';

  @override
  String get reelsRetry => 'വീണ്ടും ശ്രമിക്കുക';

  @override
  String get reelFollow => 'ഫോളോ ചെയ്യുക';

  @override
  String get reelFollowing => 'ഫോളോ ചെയ്യുന്നു';

  @override
  String get reelLike => 'ലൈക്ക് ചെയ്യുക';

  @override
  String get reelUnlike => 'ലൈക്ക് നീക്കുക';

  @override
  String get reelComment => 'കമന്റ്';

  @override
  String get reelShare => 'പങ്കിടുക';

  @override
  String get reelSave => 'സേവ് ചെയ്യുക';

  @override
  String get reelUnsave => 'സേവ് ചെയ്തവയിൽ നിന്ന് നീക്കുക';

  @override
  String get reelSaved => 'സേവ് ചെയ്തു';

  @override
  String get reelRemovedFromSaved => 'സേവ് ചെയ്തവയിൽ നിന്ന് നീക്കി';

  @override
  String get reelMore => 'കൂടുതൽ ഓപ്ഷനുകൾ';

  @override
  String get reelMuted => 'ശബ്ദം ഓഫ്';

  @override
  String get reelUnmuted => 'ശബ്ദം ഓൺ';

  @override
  String get reelPlay => 'പ്ലേ ചെയ്യുക';

  @override
  String get reelPause => 'താൽക്കാലികമായി നിർത്തുക';

  @override
  String get reelVideoUnavailable => 'ഈ വീഡിയോ ഇപ്പോഴും പ്രോസസ്സ് ചെയ്യുകയാണ്.';

  @override
  String get reelAudioUnavailable =>
      'ഈ പാരായണം ഇപ്പോഴും പ്രോസസ്സ് ചെയ്യുകയാണ്.';

  @override
  String get reelSimilar => 'ഇതുപോലുള്ളവ കൂടുതൽ';

  @override
  String get reelSimilarEmpty => 'സമാനമായ റീലുകൾ ഇതുവരെയില്ല.';

  @override
  String reelSlideOf(int current, int total) {
    return '$current / $total';
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
  String get reelCaptionMore => 'കൂടുതൽ';

  @override
  String get reelCaptionLess => 'കുറവ്';

  @override
  String get reelCommentsTitle => 'കമന്റുകൾ';

  @override
  String reelCommentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count കമന്റുകൾ',
      one: '1 കമന്റ്',
      zero: 'ഇതുവരെ കമന്റുകളില്ല',
    );
    return '$_temp0';
  }

  @override
  String get reelCommentsEmpty => 'ആദ്യം എന്തെങ്കിലും പറയൂ.';

  @override
  String get reelCommentHint => 'ഒരു കമന്റ് ചേർക്കുക…';

  @override
  String reelReplyHint(String name) {
    return 'മറുപടി: $name…';
  }

  @override
  String get reelCommentSend => 'പോസ്റ്റ് ചെയ്യുക';

  @override
  String get reelCommentReply => 'മറുപടി';

  @override
  String get reelCommentDelete => 'ഇല്ലാതാക്കുക';

  @override
  String get reelCommentReport => 'റിപ്പോർട്ട് ചെയ്യുക';

  @override
  String get reelCommentPin => 'പിൻ ചെയ്യുക';

  @override
  String get reelCommentUnpin => 'പിൻ നീക്കുക';

  @override
  String get reelCommentPinned => 'പിൻ ചെയ്തത്';

  @override
  String get reelCommentRemoved => 'ഈ കമന്റ് നീക്കം ചെയ്തു.';

  @override
  String get reelCommentDeleted => 'കമന്റ് ഇല്ലാതാക്കി';

  @override
  String get reelCommentDeleteTitle => 'ഈ കമന്റ് ഇല്ലാതാക്കണോ?';

  @override
  String get reelCommentDeleteBody =>
      'ഇത് എല്ലാവർക്കുമായി നീക്കം ചെയ്യും, ഇതിനുള്ള മറുപടികളും ഉൾപ്പെടെ.';

  @override
  String get reelCommentCancelReply => 'മറുപടി റദ്ദാക്കുക';

  @override
  String reelViewReplies(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count മറുപടികൾ കാണുക',
      one: '1 മറുപടി കാണുക',
    );
    return '$_temp0';
  }

  @override
  String get reelHideReplies => 'മറുപടികൾ മറയ്ക്കുക';

  @override
  String get reelLoadMoreComments => 'കൂടുതൽ കമന്റുകൾ ലോഡ് ചെയ്യുക';

  @override
  String get reelReportTitle => 'ഈ റീൽ റിപ്പോർട്ട് ചെയ്യുക';

  @override
  String get reelReportCommentTitle => 'ഈ കമന്റ് റിപ്പോർട്ട് ചെയ്യുക';

  @override
  String get reelReportBody =>
      'ഇതിൽ എന്താണ് തെറ്റെന്ന് ഞങ്ങളെ അറിയിക്കുക. ഒരു മോഡറേറ്റർ ഇത് പരിശോധിക്കും.';

  @override
  String get reelReportSpam => 'സ്പാം അല്ലെങ്കിൽ തെറ്റിദ്ധരിപ്പിക്കുന്നത്';

  @override
  String get reelReportHarassment => 'ഉപദ്രവം അല്ലെങ്കിൽ അധിക്ഷേപം';

  @override
  String get reelReportNonDevotional => 'ഭക്തി ഉള്ളടക്കമല്ല';

  @override
  String get reelReportMisinformation => 'തെറ്റായ വിവരം';

  @override
  String get reelReportSexualOrViolent => 'ലൈംഗികം അല്ലെങ്കിൽ അക്രമം';

  @override
  String get reelReportOther => 'മറ്റെന്തെങ്കിലും';

  @override
  String get reelReportNoteHint => 'ഞങ്ങൾ അറിയേണ്ട മറ്റെന്തെങ്കിലും? (ഓപ്ഷണൽ)';

  @override
  String get reelReportSubmit => 'റിപ്പോർട്ട് ചെയ്യുക';

  @override
  String get reelReportThanks => 'നന്ദി. ഒരു മോഡറേറ്റർ ഇത് പരിശോധിക്കും.';

  @override
  String get reelShareTitle => 'ഈ റീൽ പങ്കിടുക';

  @override
  String reelShareMessage(String caption, String link) {
    return '$caption\n\nHariHariBol-ൽ കാണുക: $link';
  }

  @override
  String get reelCopyLink => 'ലിങ്ക് കോപ്പി ചെയ്യുക';

  @override
  String get reelLinkCopied => 'ലിങ്ക് കോപ്പി ചെയ്തു';

  @override
  String get creatorTitle => 'ക്രിയേറ്റർ';

  @override
  String creatorFollowers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ഫോളോവർമാർ',
      one: '1 ഫോളോവർ',
    );
    return '$_temp0';
  }

  @override
  String creatorReelCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count റീലുകൾ',
      one: '1 റീൽ',
    );
    return '$_temp0';
  }

  @override
  String creatorViews(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count കാഴ്ചകൾ',
      one: '1 കാഴ്ച',
    );
    return '$_temp0';
  }

  @override
  String get creatorStatFollowers => 'ഫോളോവർമാർ';

  @override
  String get creatorStatReels => 'റീലുകൾ';

  @override
  String get creatorStatViews => 'കാഴ്ചകൾ';

  @override
  String get creatorVerified => 'സ്ഥിരീകരിച്ച ക്രിയേറ്റർ';

  @override
  String get creatorNoReels => 'ഇതുവരെ ഒന്നും പോസ്റ്റ് ചെയ്തിട്ടില്ല.';

  @override
  String get creatorNotFound => 'ആ ക്രിയേറ്റർ ഇപ്പോൾ ഇവിടെയില്ല.';

  @override
  String get chantAnalyticsTooltip => 'അനലിറ്റിക്സും ചരിത്രവും';

  @override
  String get chantSittingTime => 'സെഷൻ സമയം';

  @override
  String chantMalaTime(int number) {
    return 'മാല $number സമയം';
  }

  @override
  String get chantStatCurrentMala => 'നിലവിലെ മാല';

  @override
  String get chantStatCount => 'എണ്ണം';

  @override
  String get chantStatMalasDone => 'പൂർത്തിയായ മാലകൾ';

  @override
  String get chantStatAvgMala => 'ഒരു മാലയ്ക്ക് ശരാശരി';

  @override
  String get chantStatAvgChant => 'ഒരു ജപത്തിന് ശരാശരി';

  @override
  String get chantStatTotalChants => 'ആകെ ജപങ്ങൾ';

  @override
  String get chantStatFastestMala => 'ഏറ്റവും വേഗത്തിലുള്ള മാല';

  @override
  String get chantStatTotalTime => 'ആകെ സമയം';

  @override
  String get chantNoValue => '—';

  @override
  String get chantRecentTitle => 'സമീപകാല ജപങ്ങൾ';

  @override
  String get chantRecentEmpty => 'തുടങ്ങാൻ വൃത്തത്തിൽ ടാപ്പ് ചെയ്യുക.';

  @override
  String chantTapNumber(int seq) {
    return '#$seq';
  }

  @override
  String get chantAutoBadge => 'സ്വയം';

  @override
  String get chantDetectWords => 'വാക്കുകൾ തിരിച്ചറിയുക';

  @override
  String get chantDetectWordsOff => 'ഓഫ് — വാക്കുകൾ റെക്കോർഡ് ചെയ്യില്ല';

  @override
  String get chantDetectWordsListening => 'വാക്കുകൾക്കായി കേൾക്കുന്നു…';

  @override
  String get chantDetectWordsPermission => 'മൈക്രോഫോൺ അനുമതി ആവശ്യമാണ്';

  @override
  String get chantDetectWordsStarting => 'തയ്യാറാകുന്നു…';

  @override
  String get chantDetectWordsUnavailable =>
      'ഈ ഉപകരണത്തിൽ വാക്ക് തിരിച്ചറിയൽ ലഭ്യമല്ല';

  @override
  String get chantDetectWordsNote =>
      'വാക്കുകൾ നിങ്ങളുടെ ഫോണിൽ തന്നെയാണ് തിരിച്ചറിയുന്നത്, ഓഡിയോ ഒരിക്കലും റെക്കോർഡ് ചെയ്യുന്നില്ല. ടെക്സ്റ്റ് 7 ദിവസം സൂക്ഷിക്കും, പിന്നീട് ഇല്ലാതാക്കും.';

  @override
  String get chantSetupTitle => 'ജപ സഹായികൾ';

  @override
  String get chantSetupSubtitle =>
      'ഈ സെഷൻ എങ്ങനെ എണ്ണണമെന്നും രേഖപ്പെടുത്തണമെന്നും തിരഞ്ഞെടുക്കുക. കേൾക്കുന്നത് നിങ്ങളുടെ ഫോണിൽ തന്നെയാണ്.';

  @override
  String get chantSetupButton => 'സ്വയം എണ്ണലും വാക്കുകളും';

  @override
  String get chantSetupNoneOn => 'സജ്ജീകരിക്കുക';

  @override
  String chantSetupOn(int count) {
    return '$count ഓൺ';
  }

  @override
  String chantSetupButtonState(String button, String state) {
    return '$button · $state';
  }

  @override
  String get chantSetupDone => 'പൂർത്തിയായി';

  @override
  String get chantAnalyticsTitle => 'ജപ അനലിറ്റിക്സ്';

  @override
  String get chantTabThisSitting => 'ഈ സെഷൻ';

  @override
  String get chantTabHistory => 'ചരിത്രം';

  @override
  String chantMalaTitle(int number) {
    return 'മാല $number';
  }

  @override
  String get chantMalaInProgress => 'പുരോഗമിക്കുന്നു';

  @override
  String get chantMalaStart => 'തുടക്കം';

  @override
  String get chantMalaEnd => 'അവസാനം';

  @override
  String get chantMalaDuration => 'ദൈർഘ്യം';

  @override
  String chantMalaChants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ജപങ്ങൾ',
      one: '1 ജപം',
    );
    return '$_temp0';
  }

  @override
  String get chantTapsHeader => 'ഓരോ ജപവും';

  @override
  String get chantHeardLabel => 'കേട്ടത്';

  @override
  String get chantNoMalasYet =>
      'ഈ സെഷനിൽ ഇതുവരെ ജപങ്ങളില്ല. നിങ്ങൾ പൂർത്തിയാക്കുന്ന ഓരോ മാലയും അതിന്റെ തുടക്കം, അവസാനം, എടുത്ത സമയം എന്നിവയോടൊപ്പം ഇവിടെ പട്ടികപ്പെടുത്തും.';

  @override
  String get chantHistoryEmpty => 'മുൻ സെഷനുകളൊന്നും ഇതുവരെയില്ല.';

  @override
  String chantHistorySummary(int malas, int chants) {
    return '$malas മാലകൾ · $chants ജപങ്ങൾ';
  }

  @override
  String get chantHistoryNoDetail =>
      'ജപ സമയം രേഖപ്പെടുത്തുന്നതിന് മുമ്പ് എണ്ണിയത്';

  @override
  String get chantSessionTitle => 'സെഷൻ';

  @override
  String get chantSessionNoMalas =>
      'ഈ സെഷനിൽ സമയം രേഖപ്പെടുത്തിയ മാലകളൊന്നുമില്ല.';

  @override
  String get chantHeardExpiry =>
      'കേട്ട വാക്കുകൾ സെഷൻ കഴിഞ്ഞ് 7 ദിവസത്തിനു ശേഷം നിങ്ങളുടെ അക്കൗണ്ടിൽ നിന്ന് നീക്കം ചെയ്യപ്പെടും.';

  @override
  String get chantHeardTitle => 'ഇപ്പോൾ കേട്ടത്';

  @override
  String get chantHeardHearing => 'നിങ്ങളെ കേൾക്കുന്നു…';

  @override
  String get chantHeardWaiting => 'നിങ്ങളുടെ ശബ്ദത്തിനായി കാത്തിരിക്കുന്നു';

  @override
  String get chantHeardPlaceholder =>
      'ഉറക്കെ ജപിക്കുക. നിങ്ങളുടെ ഫോൺ കേൾക്കുന്ന വാക്കുകൾ ഇവിടെ കാണും.';

  @override
  String get chantHeardLast => 'അവസാനം കേട്ടത്';

  @override
  String chantHeardCounted(int count) {
    return 'എണ്ണി +$count';
  }

  @override
  String get chantHeardNotCounted => 'എണ്ണിയില്ല';

  @override
  String chantHeardMatch(int percent, int needed) {
    return '$percent% പൊരുത്തം · വേണ്ടത് $needed%';
  }

  @override
  String chantHeardMatchShort(int percent) {
    return '$percent% പൊരുത്തം';
  }

  @override
  String get chantHeardEarlier => 'മുമ്പത്തേത്';

  @override
  String get chantAlongTitle => 'ഒപ്പം ജപിക്കുക';

  @override
  String get chantAlongCaption =>
      'കൗണ്ടർ റെക്കോർഡിംഗിനൊപ്പം എണ്ണുന്നു. ഇത് പ്ലേ ആകുമ്പോൾ സ്വയം എണ്ണലും വാക്ക് തിരിച്ചറിയലും വിശ്രമിക്കും.';

  @override
  String get chantAlongPlay => 'റെക്കോർഡിംഗ് പ്ലേ ചെയ്യുക';

  @override
  String get chantAlongPause => 'റെക്കോർഡിംഗ് താൽക്കാലികമായി നിർത്തുക';

  @override
  String get chantAlongPosition => 'റെക്കോർഡിംഗിലെ സ്ഥാനം';

  @override
  String get chantAlongLoading => 'റെക്കോർഡിംഗ് ലോഡ് ചെയ്യുന്നു…';

  @override
  String get chantAlongLoadFailed => 'റെക്കോർഡിംഗ് ലോഡ് ചെയ്യാനായില്ല.';

  @override
  String get settingsSectionLanguages => 'ഭാഷകൾ';

  @override
  String get settingsLanguageApp => 'ആപ്പ് ഭാഷ';

  @override
  String get settingsLanguageAppHint => 'മെനുകൾ, ബട്ടണുകൾ, ലേബലുകൾ';

  @override
  String get settingsLanguageReading => 'വായനാ ഭാഷ';

  @override
  String get settingsLanguageReadingHint => 'വിവർത്തനം, അർത്ഥം, ഭാവാർത്ഥം';

  @override
  String get settingsLanguageSpeaking => 'സംസാരിക്കുന്നതും കേൾക്കുന്നതുമായ ഭാഷ';

  @override
  String get settingsLanguageSpeakingHint => 'ഓഡിയോയും പറഞ്ഞുതരുന്ന അർത്ഥവും';

  @override
  String get settingsLanguagePickerApp => 'ആപ്പ് ഭാഷ തിരഞ്ഞെടുക്കുക';

  @override
  String get settingsLanguagePickerReading => 'വായനാ ഭാഷ തിരഞ്ഞെടുക്കുക';

  @override
  String get settingsLanguagePickerSpeaking => 'സംസാര ഭാഷ തിരഞ്ഞെടുക്കുക';

  @override
  String get settingsLanguageSanskritNote =>
      'സംസ്കൃത ശ്ലോകങ്ങൾ എപ്പോഴും സംസ്കൃതത്തിൽ തന്നെയായിരിക്കും.';

  @override
  String get readingAudioPlayAll => 'വായിച്ചു കേൾപ്പിക്കുക';

  @override
  String get readingAudioPlayVerse => 'ഈ ശ്ലോകം പ്ലേ ചെയ്യുക';

  @override
  String get readingAudioPause => 'താൽക്കാലികമായി നിർത്തുക';

  @override
  String get readingAudioResume => 'തുടരുക';

  @override
  String get readingAudioStop => 'നിർത്തുക';

  @override
  String get readingAudioNext => 'അടുത്ത ശ്ലോകം';

  @override
  String get readingAudioPrevious => 'മുൻ ശ്ലോകം';

  @override
  String get readingAudioFromStart => 'തുടക്കത്തിൽ നിന്ന്';

  @override
  String readingAudioResumeFrom(int number) {
    return 'ശ്ലോകം $number മുതൽ തുടരുക';
  }

  @override
  String readingAudioNowPlaying(String section, int number) {
    return '$section · ശ്ലോകം $number';
  }

  @override
  String get readingAudioLoading => 'ലോഡ് ചെയ്യുന്നു…';

  @override
  String get readingAudioChannel => 'വായിച്ചു കേൾപ്പിക്കൽ';

  @override
  String get readingSectionVerse => 'ശ്ലോകം';

  @override
  String get readingSectionMeaning => 'അർത്ഥം';

  @override
  String get readingSectionPurport => 'ഭാവാർത്ഥം';

  @override
  String get settingsVoices => 'ശബ്ദങ്ങൾ';

  @override
  String settingsVoicesValue(int count) {
    return '$count ഇൻസ്റ്റാൾ ചെയ്തു';
  }

  @override
  String get voicesTitle => 'ശബ്ദങ്ങൾ';

  @override
  String get voicesIntro =>
      'അർത്ഥവും ഭാവാർത്ഥവും നിങ്ങളുടെ സംസാര ഭാഷയിൽ വായിച്ചു കേൾപ്പിക്കുന്നു. ഒരു ശബ്ദം ഡൗൺലോഡ് ചെയ്യുന്നതുവരെ നിങ്ങളുടെ ഫോണിന്റെ സ്വന്തം ശബ്ദം ഉപയോഗിക്കും, അതിനാൽ വായന ഒരിക്കലും കാത്തിരിക്കേണ്ടി വരില്ല.';

  @override
  String voicesStorage(String size) {
    return 'ഈ ഫോണിൽ $size ഉപയോഗിക്കുന്നു';
  }

  @override
  String get voicesEmpty =>
      'ഡൗൺലോഡ് ചെയ്യാൻ ശബ്ദങ്ങളൊന്നും ഇതുവരെ ലഭ്യമല്ല. നിങ്ങളുടെ ഫോണിന്റെ സ്വന്തം ശബ്ദം ഉപയോഗിക്കുന്നു.';

  @override
  String get voiceDownload => 'ഡൗൺലോഡ് ചെയ്യുക';

  @override
  String get voiceDelete => 'ഇല്ലാതാക്കുക';

  @override
  String get voiceCancel => 'റദ്ദാക്കുക';

  @override
  String get voiceRetry => 'വീണ്ടും ശ്രമിക്കുക';

  @override
  String voiceInstalled(String size) {
    return 'ഇൻസ്റ്റാൾ ചെയ്തു · $size';
  }

  @override
  String voiceNotInstalled(String size) {
    return 'ഡൗൺലോഡ് ചെയ്തിട്ടില്ല · $size';
  }

  @override
  String voiceDownloading(int percent) {
    return 'ഡൗൺലോഡ് ചെയ്യുന്നു $percent%';
  }

  @override
  String get voiceVerifying => 'പരിശോധിക്കുന്നു…';

  @override
  String get voiceExtracting => 'ഇൻസ്റ്റാൾ ചെയ്യുന്നു…';

  @override
  String get voiceFailed => 'ഈ ശബ്ദം ഇൻസ്റ്റാൾ ചെയ്യാനായില്ല';

  @override
  String get voiceUnavailable =>
      'ഇതുവരെ ലഭ്യമല്ല · നിങ്ങളുടെ ഫോണിന്റെ ശബ്ദം ഉപയോഗിക്കുന്നു';

  @override
  String get voiceDeleteTitle => 'ഈ ശബ്ദം ഇല്ലാതാക്കണോ?';

  @override
  String get voiceDeleteBody =>
      'ഇത് വീണ്ടും ഡൗൺലോഡ് ചെയ്യാം. അതുവരെ നിങ്ങളുടെ ഫോണിന്റെ സ്വന്തം ശബ്ദം ഉപയോഗിക്കും.';

  @override
  String voiceLanguages(String languages) {
    return 'സംസാരിക്കുന്നത്: $languages';
  }

  @override
  String labelVerseWithSection(int number, String section) {
    return 'ശ്ലോകം $number · $section';
  }
}
