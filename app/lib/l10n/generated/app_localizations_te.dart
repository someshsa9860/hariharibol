// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Telugu (`te`).
class AppLocalizationsTe extends AppLocalizations {
  AppLocalizationsTe([String locale = 'te']) : super(locale);

  @override
  String get appName => 'HariHariBol';

  @override
  String get splashTagline => 'చదవండి · జపించండి · సాధన చేయండి';

  @override
  String get actionRetry => 'మళ్లీ ప్రయత్నించండి';

  @override
  String get actionCancel => 'రద్దు చేయి';

  @override
  String get actionOk => 'సరే';

  @override
  String get actionDone => 'పూర్తయింది';

  @override
  String get actionSave => 'సేవ్ చేయి';

  @override
  String get actionViewAll => 'అన్నీ చూడండి';

  @override
  String get actionSignOut => 'సైన్ అవుట్';

  @override
  String get actionDeleteAccount => 'ఖాతాను తొలగించు';

  @override
  String get actionContinue => 'కొనసాగించు';

  @override
  String get errorGeneric => 'ఏదో తప్పు జరిగింది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get errorNetwork =>
      'కనెక్షన్ లేదు. మీ ఇంటర్నెట్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get errorTimeout => 'చాలా సమయం పట్టింది. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get errorSessionExpired =>
      'మీ సెషన్ ముగిసింది. దయచేసి మళ్లీ సైన్ ఇన్ చేయండి.';

  @override
  String get errorSignIn =>
      'మిమ్మల్ని సైన్ ఇన్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get errorInsecureConnection => 'కనెక్షన్ సురక్షితంగా లేదు.';

  @override
  String get errorCancelled => 'అభ్యర్థన రద్దు చేయబడింది.';

  @override
  String get errorEmptyTitle => 'ఇక్కడ ఇంకా ఏమీ లేదు';

  @override
  String get errorRouteNotFound => 'ఆ స్క్రీన్ లేదు.';

  @override
  String get actionGoHome => 'హోమ్ పేజీకి వెళ్లు';

  @override
  String get signInTitle => 'స్వాగతం';

  @override
  String get signInSubtitle =>
      'చదవండి, జపించండి, మీ దైనిక సాధనను ఒకే చోట ఉంచుకోండి.';

  @override
  String get signInWithGoogle => 'Googleతో కొనసాగించండి';

  @override
  String get signInWithApple => 'Appleతో కొనసాగించండి';

  @override
  String get signInCancelled => 'సైన్ ఇన్ రద్దు చేయబడింది.';

  @override
  String get signInFailed =>
      'మిమ్మల్ని సైన్ ఇన్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String get signInLegal =>
      'కొనసాగించడం ద్వారా మీరు మా నిబంధనలు మరియు గోప్యతా విధానానికి అంగీకరిస్తున్నారు.';

  @override
  String languageStepOf(int current, int total) {
    return 'దశ $current / $total';
  }

  @override
  String get languageAppTitle => 'ఏ భాష మీకు ఇంటిలా అనిపిస్తుంది?';

  @override
  String get languageAppSubtitle =>
      'దీన్ని ఎప్పుడైనా సెట్టింగ్‌లలో మార్చుకోవచ్చు.';

  @override
  String get languageMantraTitle => 'మీరు ఏ లిపిలో జపిస్తారు?';

  @override
  String get languageMantraSubtitle =>
      'మంత్రాలు ఈ లిపిలో కనిపిస్తాయి. వాటి అర్థం మీ స్వంత భాషలోనే ఉంటుంది.';

  @override
  String get actionBack => 'వెనుకకు';

  @override
  String get tabHome => 'హోమ్';

  @override
  String get tabSadhana => 'జపం';

  @override
  String get tabLibrary => 'చదవండి';

  @override
  String get tabRoutine => 'దినచర్య';

  @override
  String get reelsTitle => 'రీల్స్';

  @override
  String get tabSearch => 'శోధన';

  @override
  String get homeGreeting => 'హరి బోల్';

  @override
  String homeGreetingNamed(String name) {
    return 'హరి బోల్, $name';
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
  String get homeMoodPrompt => 'ఈ రోజు మీరు ఎలా ఉన్నారు?';

  @override
  String get homeMoodAnsweredToday =>
      'ఈ రోజు మీ అనుభూతిని పంచుకున్నారు. కొత్తది పంచుకోవడానికి రేపు మళ్లీ రండి.';

  @override
  String homeMoodViewToday(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'ఈ రోజు $count శ్లోకాలను మళ్లీ చదవండి',
      one: 'ఈ రోజు శ్లోకాన్ని మళ్లీ చదవండి',
    );
    return '$_temp0';
  }

  @override
  String homeMoodSubmit(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'నాకు $count శ్లోకాలు చూపించు',
      one: 'నాకు ఒక శ్లోకం చూపించు',
    );
    return '$_temp0';
  }

  @override
  String get homeVerseOfTheDay => 'నేటి శ్లోకం';

  @override
  String get homeSlokaForYou => 'ఈ రోజు మీ కోసం';

  @override
  String get homeTodaysSadhana => 'నేటి సాధన';

  @override
  String get homeContinueReading => 'చదవడం కొనసాగించండి';

  @override
  String get homeBooks => 'పుస్తకాలు';

  @override
  String get homeMantras => 'మంత్రాలు';

  @override
  String get homeStartYourDay => 'ఈ రోజు లక్ష్యాన్ని నిర్ణయించండి';

  @override
  String homeChantMantra(String mantra) {
    return '$mantra జపించండి';
  }

  @override
  String bookChapterCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count అధ్యాయాలు',
      one: '1 అధ్యాయం',
    );
    return '$_temp0';
  }

  @override
  String bookVerseCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count శ్లోకాలు',
      one: '1 శ్లోకం',
    );
    return '$_temp0';
  }

  @override
  String get searchHint => 'శ్లోకాలు, మంత్రాలు, పుస్తకాలను శోధించండి';

  @override
  String get searchPrompt =>
      'మొత్తం గ్రంథాలయంలో, నేరుగా సర్వర్ నుండి శోధించండి.';

  @override
  String get searchShortcutLabel => 'లేదా నేరుగా ఒక శ్లోకానికి వెళ్లండి:';

  @override
  String get searchNoResults =>
      'ఫలితాలు లేవు. వేరే పదాన్ని ప్రయత్నించండి, లేదా BG 2.47 వంటి సూచనను ఇవ్వండి.';

  @override
  String get searchSectionVerses => 'శ్లోకాలు';

  @override
  String searchResultsTitle(String kind, String query) {
    return '$kind · $query';
  }

  @override
  String labelCanto(int number) {
    return 'స్కంధం $number';
  }

  @override
  String labelChapter(int number) {
    return 'అధ్యాయం $number';
  }

  @override
  String labelVerse(int number) {
    return 'శ్లోకం $number';
  }

  @override
  String labelCantoChapter(int canto, int chapter) {
    return 'స్కంధం $canto · అధ్యాయం $chapter';
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
    return '$done / $target మాలలు';
  }

  @override
  String sadhanaTasksProgress(int done, int total) {
    return '$total పనుల్లో $done పూర్తయ్యాయి';
  }

  @override
  String sadhanaStreak(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days రోజుల నిరంతరత',
      one: '1 రోజు నిరంతరత',
      zero: 'ఇంకా నిరంతరత లేదు',
    );
    return '$_temp0';
  }

  @override
  String get sadhanaGenericChant => 'జపం';

  @override
  String sadhanaRoundsShort(int rounds) {
    return '$rounds మాలలు';
  }

  @override
  String get sadhanaTodaysSessions => 'నేటి జపం';

  @override
  String get sadhanaNoSessionsYet => 'ఈ రోజు ఇంకా ఏమీ నమోదు కాలేదు.';

  @override
  String get sadhanaRoundsEyebrow => 'నేటి మాలలు';

  @override
  String get sadhanaRoundsCaption => 'మాలలు';

  @override
  String get sadhanaChantNow => 'ఇప్పుడు జపించండి';

  @override
  String get sadhanaLogRounds => 'మాలలను నమోదు చేయండి';

  @override
  String get sadhanaLogRoundsSubtitle =>
      'మీ జపమాలపై జపించిన మాలలు, నేటి మొత్తానికి జోడించబడతాయి.';

  @override
  String sadhanaLogRoundsSubmit(int rounds) {
    return '$rounds మాలలను నమోదు చేయండి';
  }

  @override
  String get sadhanaTargetReached => 'నేటి లక్ష్యం చేరుకున్నారు';

  @override
  String get sadhanaUndoBead => 'చివరి పూసను రద్దు చేయండి';

  @override
  String get sadhanaElapsedEyebrow => 'గడిచిన సమయం';

  @override
  String get sadhanaPaceEyebrow => 'వేగం';

  @override
  String sadhanaElapsedSeconds(String seconds) {
    return '$seconds సె';
  }

  @override
  String sadhanaPacePerMantra(String seconds) {
    return 'ఒక్కొక్కటికి $seconds సె';
  }

  @override
  String get sadhanaAutoCount => 'ఆటో లెక్కింపు';

  @override
  String get sadhanaAutoCountOff => 'ఆఫ్ — పూసను మీరే తట్టండి';

  @override
  String get sadhanaAutoCountIdle => 'జపం కోసం వేచి ఉంది';

  @override
  String get chantAutoCountLoading => 'ఆటో కౌంట్ సిద్ధమవుతోంది…';

  @override
  String get chantFullPicture => 'పూర్తి స్క్రీన్ చిత్రం';

  @override
  String get sadhanaAutoCountListening => 'వింటోంది…';

  @override
  String get sadhanaAutoCountCounted =>
      'లెక్కించబడింది — తదుపరి దాని కోసం వింటోంది';

  @override
  String get sadhanaAutoCountPermissionDenied =>
      'ఆటో లెక్కింపునకు మైక్రోఫోన్ అనుమతి అవసరం';

  @override
  String get sadhanaAutoCountUnavailable =>
      'ఆటో లెక్కింపు ప్రస్తుతం అందుబాటులో లేదు';

  @override
  String get chantModelTitle => 'మరింత స్పష్టమైన శ్రవణం';

  @override
  String chantModelOffer(int megabytes) {
    return 'సంస్కృతాన్ని చాలా బాగా అర్థం చేసుకుంటుంది. ఒకసారి $megabytes MB డౌన్‌లోడ్ — Wi-Fi ఉపయోగించండి.';
  }

  @override
  String get chantModelDownload => 'డౌన్‌లోడ్';

  @override
  String chantModelDownloading(int percent) {
    return 'డౌన్‌లోడ్ అవుతోంది… $percent%';
  }

  @override
  String get chantModelCancel => 'రద్దు చేయి';

  @override
  String get chantModelInstalled =>
      'డౌన్‌లోడ్ అయింది — మీరు ఆటో లెక్కింపును తదుపరిసారి ఆన్ చేసినప్పుడు ఉపయోగించబడుతుంది';

  @override
  String get chantModelRemove => 'తొలగించు';

  @override
  String get chantModelFailed => 'డౌన్‌లోడ్ పూర్తికాలేదు';

  @override
  String get chantModelRetry => 'మళ్లీ ప్రయత్నించండి';

  @override
  String get mantraAllCategories => 'అన్నీ';

  @override
  String get mantraNoneInCategory => 'ఈ వర్గంలో ఇంకా మంత్రాలు లేవు.';

  @override
  String get mantraCategoryBeej => 'బీజ మంత్రం';

  @override
  String get mantraCategoryGayatri => 'గాయత్రీ';

  @override
  String get mantraCategoryMahamantra => 'మహామంత్రం';

  @override
  String get mantraCategoryName => 'నామ మంత్రం';

  @override
  String mantraStandardRounds(int rounds) {
    return '$rounds మాలలు';
  }

  @override
  String mantraStandardCount(int count) {
    return '$count సార్లు';
  }

  @override
  String get mantraHasAudio => 'పారాయణ అందుబాటులో ఉంది';

  @override
  String get mantraPurport => 'భాష్యం';

  @override
  String mantraMyRounds(int rounds) {
    return 'దీన్ని మీరు $rounds మాలలు జపించారు';
  }

  @override
  String get mantraChantThis => 'దీన్ని జపించండి';

  @override
  String get profileStatVersesSaved => 'సేవ్ చేసిన శ్లోకాలు';

  @override
  String get profileStatTotalRounds => 'మొత్తం మాలలు';

  @override
  String get profileStatChantingDays => 'జప దినాలు';

  @override
  String get profileStatSlokasRead => 'చదివిన శ్లోకాలు';

  @override
  String get profileRecentFavorites => 'ఇటీవలి ఇష్టమైనవి';

  @override
  String get profileNoFavorites =>
      'ఇంకా ఏదీ సేవ్ చేయలేదు. ఒక శ్లోకాన్ని బుక్‌మార్క్ చేస్తే అది ఇక్కడ ఉంటుంది.';

  @override
  String get settingsTitle => 'సెట్టింగ్‌లు';

  @override
  String get settingsSectionPractice => 'సాధన';

  @override
  String get settingsSectionAccount => 'ఖాతా';

  @override
  String get settingsLanguage => 'భాష';

  @override
  String get settingsTheme => 'థీమ్';

  @override
  String get settingsDailyGoal => 'దైనిక లక్ష్యం';

  @override
  String get settingsDailyGoalSubtitle =>
      'ప్రతిరోజూ లక్ష్యంగా పెట్టుకునే మాలలు. ప్రతి కొత్త రోజూ దీనితోనే మొదలవుతుంది.';

  @override
  String settingsDailyGoalSubmit(int rounds) {
    return 'దైనిక లక్ష్యాన్ని $roundsగా సెట్ చేయండి';
  }

  @override
  String get settingsPreferredMantra => 'ఇష్టమైన మంత్రం';

  @override
  String get settingsPreferredMantraNone => 'సెట్ చేయలేదు';

  @override
  String get settingsChooseMantraTitle => 'మీ మంత్రాన్ని ఎంచుకోండి';

  @override
  String get settingsChooseMantraSubtitle =>
      '“ఇప్పుడు జపించండి” దేనితో తెరుచుకుంటుందో అది. మరేదైనా దాని స్వంత పేజీ నుండి జపించవచ్చు.';

  @override
  String get settingsNoMantraPreference =>
      'ప్రాధాన్యత లేదు — ప్రతిసారీ నన్ను అడగండి';

  @override
  String get settingsPlans => 'ప్లాన్‌లు & ప్రీమియం';

  @override
  String get plansTitle => 'ప్లాన్‌లు';

  @override
  String get plansSubtitle =>
      'యాప్ మొత్తం ఉచితం. చెల్లింపు ప్లాన్ దానిపై కొంచెం ఎక్కువ జోడిస్తుంది.';

  @override
  String get plansYourPlan => 'మీ ప్లాన్';

  @override
  String get plansCurrent => 'ప్రస్తుత ప్లాన్';

  @override
  String get plansFreeForEveryone => 'అందరికీ ఉచితం';

  @override
  String plansPricePer(String price, String period) {
    return '$price / $period';
  }

  @override
  String get plansPeriodWeek => 'వారం';

  @override
  String get plansPeriodMonth => 'నెల';

  @override
  String get plansPeriodYear => 'సంవత్సరం';

  @override
  String plansPeriodDays(int days) {
    return '$days రోజులు';
  }

  @override
  String plansTrial(int days) {
    return '$days రోజుల ఉచిత ట్రయల్';
  }

  @override
  String get plansSubscribe => 'సబ్‌స్క్రైబ్ చేయండి';

  @override
  String get plansStartTrial => 'ఉచిత ట్రయల్ ప్రారంభించండి';

  @override
  String get plansRestore => 'కొనుగోళ్లను పునరుద్ధరించండి';

  @override
  String get plansStoreUnavailable => 'ఈ పరికరంలో స్టోర్ అందుబాటులో లేదు.';

  @override
  String get plansProductMissing =>
      'ఈ ప్లాన్ ప్రస్తుతం స్టోర్‌లో అందుబాటులో లేదు.';

  @override
  String get plansPurchasePending => 'మీ కొనుగోలు ప్రాసెస్ అవుతోంది…';

  @override
  String get plansPurchaseSuccess => 'ధన్యవాదాలు — మీ ప్లాన్ సక్రియంగా ఉంది.';

  @override
  String get plansPurchaseFailed => 'కొనుగోలు పూర్తికాలేదు.';

  @override
  String get plansPurchaseCancelled => 'కొనుగోలు రద్దు చేయబడింది.';

  @override
  String plansRenews(String date) {
    return '$dateన పునరుద్ధరించబడుతుంది';
  }

  @override
  String plansEnds(String date) {
    return '$date వరకు ప్రాప్యత';
  }

  @override
  String get plansPermanent =>
      'శాశ్వతంగా మీదే — HariHariBolకు మద్దతు ఇచ్చినందుకు ధన్యవాదాలు.';

  @override
  String get plansIncluded => 'చేర్చబడింది';

  @override
  String get plansNotIncluded => 'చేర్చబడలేదు';

  @override
  String get plansUnlimited => 'అపరిమితం';

  @override
  String plansLimit(int limit, String unit) {
    return '$limit $unit';
  }

  @override
  String get plansNoFeatures =>
      'అదనపు ప్రయోజనాలు ఇంకా లేవు — మరిన్ని రానున్నాయి.';

  @override
  String get plansRestoreDone => 'కొనుగోళ్లు పునరుద్ధరించబడ్డాయి.';

  @override
  String get settingsPrivacy => 'గోప్యతా విధానం';

  @override
  String settingsVersion(String version) {
    return 'వెర్షన్ $version';
  }

  @override
  String get settingsMadeWith => 'భక్తితో రూపొందించబడింది';

  @override
  String settingsFooter(String version, String madeWith) {
    return '$version · $madeWith';
  }

  @override
  String get themeSystem => 'ఆటో';

  @override
  String get themeLight => 'లైట్';

  @override
  String get themeDark => 'డార్క్';

  @override
  String profileSignedInAs(String email) {
    return 'సైన్ ఇన్ అయిన ఖాతా: $email';
  }

  @override
  String get profilePremium => 'ప్రీమియం';

  @override
  String get profileFree => 'ఉచితం';

  @override
  String get signOutConfirm =>
      'మీ సాధన చరిత్రను చూడడానికి మీరు మళ్లీ సైన్ ఇన్ చేయాలి.';

  @override
  String get deleteAccountTitle => 'మీ ఖాతాను తొలగించాలా?';

  @override
  String get deleteAccountBody =>
      'ఇది మీ సాధన చరిత్ర, ఇష్టమైనవి మరియు నోటిఫికేషన్లను తొలగిస్తుంది. దీన్ని రద్దు చేయలేరు.';

  @override
  String get comingSoon => 'త్వరలో వస్తోంది';

  @override
  String get libraryNoBooks => 'ఇంకా పుస్తకాలు ప్రచురించబడలేదు.';

  @override
  String get actionEdit => 'సవరించు';

  @override
  String get actionDelete => 'తొలగించు';

  @override
  String get libraryDownloadBook => 'ఆఫ్‌లైన్ పఠనం కోసం డౌన్‌లోడ్ చేయండి';

  @override
  String get libraryDownloading => 'డౌన్‌లోడ్ అవుతోంది…';

  @override
  String get libraryDownloaded => 'ఆఫ్‌లైన్ పఠనం కోసం డౌన్‌లోడ్ అయింది';

  @override
  String get libraryDownloadFailed =>
      'ఈ పుస్తకాన్ని డౌన్‌లోడ్ చేయలేకపోయాము. దయచేసి మళ్లీ ప్రయత్నించండి.';

  @override
  String bookCantoCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count స్కంధాలు',
      one: '1 స్కంధం',
    );
    return '$_temp0';
  }

  @override
  String bookByTranslators(String names) {
    return '$names అందించిన అనువాదాలు';
  }

  @override
  String get chapterPrevious => 'మునుపటి అధ్యాయం';

  @override
  String get chapterNext => 'తదుపరి అధ్యాయం';

  @override
  String get actionBookmark => 'బుక్‌మార్క్';

  @override
  String get actionRemoveBookmark => 'బుక్‌మార్క్ తొలగించు';

  @override
  String get actionHighlight => 'హైలైట్';

  @override
  String get actionRemoveHighlight => 'హైలైట్ తొలగించు';

  @override
  String get verseExplanationLabel => 'వివరణ';

  @override
  String get verseExplanationAiLabel => 'వివరణ (AI సహాయంతో)';

  @override
  String get verseWordMeanings => 'పదార్థాలు';

  @override
  String get verseCompareTranslations => 'అనువాదాలను పోల్చండి';

  @override
  String get verseTranslationsEmpty => 'ఇతర అనువాదాలు ఇంకా ప్రచురించబడలేదు.';

  @override
  String get verseRelatedTitle => 'సంబంధిత శ్లోకాలు';

  @override
  String get verseRelatedEmpty => 'సంబంధిత శ్లోకాలు ఇంకా లేవు.';

  @override
  String get relationSameConcept => 'అదే భావన';

  @override
  String get relationExpandsOn => 'విస్తరిస్తుంది';

  @override
  String get relationQuotedIn => 'ఉటంకించిన చోటు';

  @override
  String get relationContrastsWith => 'భిన్నంగా ఉంటుంది';

  @override
  String get verseNotesTitle => 'నా గమనికలు';

  @override
  String get verseNoteHint => 'గమనిక రాయండి…';

  @override
  String get verseNoteAdd => 'గమనికను జోడించు';

  @override
  String get verseNoteEmpty => 'ఈ శ్లోకంపై ఇంకా గమనికలు లేవు.';

  @override
  String get verseNoteDeleteConfirm => 'ఈ గమనికను తొలగించాలా?';

  @override
  String get readingSettingsTitle => 'పఠన సెట్టింగ్‌లు';

  @override
  String get readingFontSizeLabel => 'అక్షరాల పరిమాణం';

  @override
  String get readingFontSizeSmall => 'చిన్నది';

  @override
  String get readingFontSizeMedium => 'మధ్యస్థం';

  @override
  String get readingFontSizeLarge => 'పెద్దది';

  @override
  String get readingFontSizeExtraLarge => 'చాలా పెద్దది';

  @override
  String get readingLanguageLabel => 'పఠన భాష';

  @override
  String get routineSubtitle => 'భక్తి, పని, మధ్యలో ఉండే సాధారణ విషయాలు.';

  @override
  String routineProgress(int done, int total) {
    return '$totalలో $done పూర్తయ్యాయి';
  }

  @override
  String get routineEmptyBody =>
      'ఒక మాల జపం, ఒక పని, ఒక బాధ్యత జోడించండి — ఈ రోజును ఉద్దేశ్యంతో నిర్మించండి.';

  @override
  String get routineAddTask => 'పనిని జోడించు';

  @override
  String get routineTaskHint => 'ఏమి చేయాలి?';

  @override
  String get routineCategoryLabel => 'వర్గం';

  @override
  String get routineCategoryDevotion => 'భక్తి';

  @override
  String get routineCategoryWork => 'పని';

  @override
  String get routineCategoryHome => 'ఇల్లు';

  @override
  String get routineCategoryErrand => 'బయటి పని';

  @override
  String get routineSlotMorning => 'ఉదయం';

  @override
  String get routineSlotAfternoon => 'మధ్యాహ్నం';

  @override
  String get routineSlotEvening => 'సాయంత్రం';

  @override
  String get routineSlotAnytime => 'ఎప్పుడైనా';

  @override
  String get routinePresetWakeUp => 'నిద్ర లేవడం';

  @override
  String get routinePresetMorningChant => 'ఉదయం జపం';

  @override
  String get routinePresetExercise => 'వ్యాయామం';

  @override
  String get routinePresetBreakfast => 'అల్పాహారం';

  @override
  String get routinePresetLunch => 'మధ్యాహ్న భోజనం';

  @override
  String get routinePresetEveningChant => 'సాయంత్రం జపం';

  @override
  String get routinePresetDinner => 'రాత్రి భోజనం';

  @override
  String get routinePresetScriptureReading => 'శాస్త్ర పఠనం';

  @override
  String get routinePresetSleep => 'నిద్ర';

  @override
  String get routineTaskNameLabel => 'పని పేరు';

  @override
  String get routineWindowHeading => 'నిర్ణీత సమయం';

  @override
  String get routineWindowHint =>
      'ఈ పరిధిలో చేస్తే సమయానికి, దానికి ముందు చేస్తే ముందుగా, తర్వాత చేస్తే ఆలస్యంగా పరిగణిస్తారు.';

  @override
  String get routineWindowSet => 'సమయ పరిధిని ఏర్పాటు చేయి';

  @override
  String get routineWindowClear => 'సమయ పరిధిని తొలగించు';

  @override
  String get routineWindowFrom => 'నుండి';

  @override
  String get routineWindowTo => 'వరకు';

  @override
  String routineWindowRange(String start, String end) {
    return '$start – $end';
  }

  @override
  String get routineWindowInvalid => 'ముగింపు సమయం ప్రారంభ సమయం తర్వాత ఉండాలి.';

  @override
  String get routineStatusNotDone => 'పూర్తి కాలేదు';

  @override
  String get routineStatusDone => 'పూర్తయింది';

  @override
  String get routineStatusEarly => 'ముందుగా';

  @override
  String get routineStatusOnTime => 'సమయానికి';

  @override
  String get routineStatusLate => 'ఆలస్యంగా';

  @override
  String routineStatusAtTime(String status, String time) {
    return '$status · $time';
  }

  @override
  String get routineChangeTime => 'సమయం మార్చు';

  @override
  String get routinePickDoneTime => 'ఇది ఎప్పుడు పూర్తయింది?';

  @override
  String get routineSaveAction => 'ఈ రోజుకు జోడించు';

  @override
  String get routineTaskRemoved => 'ఈ రోజు నుండి తొలగించబడింది';

  @override
  String get routineUndo => 'చర్య రద్దు';

  @override
  String get routineToday => 'ఈ రోజు';

  @override
  String get routineJumpToToday => 'ఈ రోజుకు వెళ్లు';

  @override
  String get routineEkadashi => 'ఏకాదశి';

  @override
  String get routineEkadashiNote =>
      'సుమారు తేదీ — ఆలయ పంచాంగంలో ఒక రోజు తేడా ఉండవచ్చు.';

  @override
  String routineDayLabel(String date, String ekadashi, int done, int total) {
    String _temp0 = intl.Intl.selectLogic(ekadashi, {
      'yes': ' · ఏకాదశి',
      'other': '',
    });
    String _temp1 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: ' · $totalలో $done పూర్తయ్యాయి',
      zero: '',
    );
    return '$date$_temp0$_temp1';
  }

  @override
  String get routineNothingPlanned => 'ఈ రోజుకు ఏమీ ప్రణాళిక చేయలేదు.';

  @override
  String get routineManageDaily => 'దైనిక దినచర్య';

  @override
  String get routineDailyTitle => 'దైనిక దినచర్య';

  @override
  String get routineDailyBody =>
      'ఐచ్ఛికం. ఇవి ప్రతిరోజూ పునరావృతమవుతాయి, ప్రతిరోజూ కొత్తగా టిక్ చేయవచ్చు.';

  @override
  String get routineDailyEmpty => 'దైనిక దినచర్య ఇంకా లేదు.';

  @override
  String get routineDailyAdd => 'దైనిక దినచర్యకు జోడించు';

  @override
  String get routineDailySaveAction => 'ప్రతిరోజుకు జోడించు';

  @override
  String get routineDailyBadge => 'ప్రతిరోజూ';

  @override
  String get routineDailyRemove => 'దైనిక దినచర్య నుండి తొలగించు';

  @override
  String get routineDailyRemoved => 'మీ దైనిక దినచర్య నుండి తొలగించబడింది';

  @override
  String get reelsEmpty => 'రీల్స్ ఇంకా లేవు';

  @override
  String get reelsEmptyBody =>
      'క్రియేటర్లు పోస్ట్ చేయడం ప్రారంభించగానే వారి రీల్స్ ఇక్కడ కనిపిస్తాయి.';

  @override
  String get reelsFailed => 'రీల్స్‌ను లోడ్ చేయలేకపోయాము';

  @override
  String get reelsRetry => 'మళ్లీ ప్రయత్నించండి';

  @override
  String get reelFollow => 'ఫాలో';

  @override
  String get reelFollowing => 'ఫాలో అవుతున్నారు';

  @override
  String get reelLike => 'ఇష్టం';

  @override
  String get reelUnlike => 'ఇష్టం తొలగించు';

  @override
  String get reelComment => 'వ్యాఖ్య';

  @override
  String get reelShare => 'షేర్';

  @override
  String get reelSave => 'సేవ్';

  @override
  String get reelUnsave => 'సేవ్ చేసినవాటి నుండి తొలగించు';

  @override
  String get reelSaved => 'సేవ్ చేయబడింది';

  @override
  String get reelRemovedFromSaved => 'సేవ్ చేసినవాటి నుండి తొలగించబడింది';

  @override
  String get reelMore => 'మరిన్ని ఎంపికలు';

  @override
  String get reelMuted => 'ధ్వని ఆఫ్';

  @override
  String get reelUnmuted => 'ధ్వని ఆన్';

  @override
  String get reelPlay => 'ప్లే';

  @override
  String get reelPause => 'పాజ్';

  @override
  String get reelVideoUnavailable => 'ఈ వీడియో ఇంకా ప్రాసెస్ అవుతోంది.';

  @override
  String get reelAudioUnavailable => 'ఈ పారాయణ ఇంకా ప్రాసెస్ అవుతోంది.';

  @override
  String get reelSimilar => 'ఇలాంటివి మరిన్ని';

  @override
  String get reelSimilarEmpty => 'ఇలాంటి రీల్స్ ఇంకా లేవు.';

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
  String get reelCaptionMore => 'మరింత';

  @override
  String get reelCaptionLess => 'తక్కువ';

  @override
  String get reelCommentsTitle => 'వ్యాఖ్యలు';

  @override
  String reelCommentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count వ్యాఖ్యలు',
      one: '1 వ్యాఖ్య',
      zero: 'ఇంకా వ్యాఖ్యలు లేవు',
    );
    return '$_temp0';
  }

  @override
  String get reelCommentsEmpty => 'మొదట మీరే ఏదైనా చెప్పండి.';

  @override
  String get reelCommentHint => 'వ్యాఖ్యను జోడించండి…';

  @override
  String reelReplyHint(String name) {
    return 'ప్రత్యుత్తరం: $name…';
  }

  @override
  String get reelCommentSend => 'పోస్ట్';

  @override
  String get reelCommentReply => 'ప్రత్యుత్తరం';

  @override
  String get reelCommentDelete => 'తొలగించు';

  @override
  String get reelCommentReport => 'రిపోర్ట్';

  @override
  String get reelCommentPin => 'పిన్';

  @override
  String get reelCommentUnpin => 'అన్‌పిన్';

  @override
  String get reelCommentPinned => 'పిన్ చేయబడింది';

  @override
  String get reelCommentRemoved => 'ఈ వ్యాఖ్య తొలగించబడింది.';

  @override
  String get reelCommentDeleted => 'వ్యాఖ్య తొలగించబడింది';

  @override
  String get reelCommentDeleteTitle => 'ఈ వ్యాఖ్యను తొలగించాలా?';

  @override
  String get reelCommentDeleteBody =>
      'ఇది అందరికీ తొలగించబడుతుంది, దానికి వచ్చిన ప్రత్యుత్తరాలతో సహా.';

  @override
  String get reelCommentCancelReply => 'ప్రత్యుత్తరం రద్దు';

  @override
  String reelViewReplies(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ప్రత్యుత్తరాలు చూడండి',
      one: '1 ప్రత్యుత్తరం చూడండి',
    );
    return '$_temp0';
  }

  @override
  String get reelHideReplies => 'ప్రత్యుత్తరాలను దాచు';

  @override
  String get reelLoadMoreComments => 'మరిన్ని వ్యాఖ్యలను లోడ్ చేయండి';

  @override
  String get reelReportTitle => 'ఈ రీల్‌ను రిపోర్ట్ చేయండి';

  @override
  String get reelReportCommentTitle => 'ఈ వ్యాఖ్యను రిపోర్ట్ చేయండి';

  @override
  String get reelReportBody =>
      'ఇందులో ఏమి తప్పు ఉందో మాకు చెప్పండి. ఒక మోడరేటర్ దీన్ని సమీక్షిస్తారు.';

  @override
  String get reelReportSpam => 'స్పామ్ లేదా తప్పుదారి పట్టించేది';

  @override
  String get reelReportHarassment => 'వేధింపు లేదా దూషణ';

  @override
  String get reelReportNonDevotional => 'భక్తి సంబంధిత కంటెంట్ కాదు';

  @override
  String get reelReportMisinformation => 'తప్పుడు సమాచారం';

  @override
  String get reelReportSexualOrViolent => 'లైంగిక లేదా హింసాత్మకం';

  @override
  String get reelReportOther => 'మరేదైనా';

  @override
  String get reelReportNoteHint =>
      'మేము తెలుసుకోవలసినది ఇంకేమైనా ఉందా? (ఐచ్ఛికం)';

  @override
  String get reelReportSubmit => 'రిపోర్ట్';

  @override
  String get reelReportThanks =>
      'ధన్యవాదాలు. ఒక మోడరేటర్ దీన్ని పరిశీలిస్తారు.';

  @override
  String get reelShareTitle => 'ఈ రీల్‌ను షేర్ చేయండి';

  @override
  String reelShareMessage(String caption, String link) {
    return '$caption\n\nHariHariBolలో చూడండి: $link';
  }

  @override
  String get reelCopyLink => 'లింక్ కాపీ చేయండి';

  @override
  String get reelLinkCopied => 'లింక్ కాపీ అయింది';

  @override
  String get creatorTitle => 'క్రియేటర్';

  @override
  String creatorFollowers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count ఫాలోయర్లు',
      one: '1 ఫాలోయర్',
    );
    return '$_temp0';
  }

  @override
  String creatorReelCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count రీల్స్',
      one: '1 రీల్',
    );
    return '$_temp0';
  }

  @override
  String creatorViews(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count వీక్షణలు',
      one: '1 వీక్షణ',
    );
    return '$_temp0';
  }

  @override
  String get creatorStatFollowers => 'ఫాలోయర్లు';

  @override
  String get creatorStatReels => 'రీల్స్';

  @override
  String get creatorStatViews => 'వీక్షణలు';

  @override
  String get creatorVerified => 'ధృవీకరించబడిన క్రియేటర్';

  @override
  String get creatorNoReels => 'ఇంకా ఏమీ పోస్ట్ చేయలేదు.';

  @override
  String get creatorNotFound => 'ఆ క్రియేటర్ ఇప్పుడు ఇక్కడ లేరు.';

  @override
  String get chantAnalyticsTooltip => 'విశ్లేషణ మరియు చరిత్ర';

  @override
  String get chantSittingTime => 'సెషన్ సమయం';

  @override
  String chantMalaTime(int number) {
    return 'మాల $number సమయం';
  }

  @override
  String get chantStatCurrentMala => 'ప్రస్తుత మాల';

  @override
  String get chantStatCount => 'లెక్క';

  @override
  String get chantStatMalasDone => 'పూర్తయిన మాలలు';

  @override
  String get chantStatAvgMala => 'మాలకు సగటు';

  @override
  String get chantStatAvgChant => 'జపానికి సగటు';

  @override
  String get chantStatTotalChants => 'మొత్తం జపాలు';

  @override
  String get chantStatFastestMala => 'అత్యంత వేగవంతమైన మాల';

  @override
  String get chantStatTotalTime => 'మొత్తం సమయం';

  @override
  String get chantNoValue => '—';

  @override
  String get chantRecentTitle => 'ఇటీవలి జపాలు';

  @override
  String get chantRecentEmpty => 'ప్రారంభించడానికి వలయాన్ని తట్టండి.';

  @override
  String chantTapNumber(int seq) {
    return '#$seq';
  }

  @override
  String get chantAutoBadge => 'ఆటో';

  @override
  String get chantDetectWords => 'పదాలను గుర్తించు';

  @override
  String get chantDetectWordsOff => 'ఆఫ్ — పదాలు రికార్డ్ చేయబడవు';

  @override
  String get chantDetectWordsListening => 'పదాల కోసం వింటోంది…';

  @override
  String get chantDetectWordsPermission => 'మైక్రోఫోన్ అనుమతి అవసరం';

  @override
  String get chantDetectWordsStarting => 'సిద్ధమవుతోంది…';

  @override
  String get chantDetectWordsUnavailable =>
      'ఈ పరికరంలో పద గుర్తింపు అందుబాటులో లేదు';

  @override
  String get chantDetectWordsNote =>
      'పదాలు మీ ఫోన్‌లోనే గుర్తించబడతాయి, ఆడియో ఎప్పుడూ రికార్డ్ చేయబడదు. టెక్స్ట్ 7 రోజులు ఉంచబడి, ఆపై తొలగించబడుతుంది.';

  @override
  String get chantSetupTitle => 'జప సహాయకాలు';

  @override
  String get chantSetupSubtitle =>
      'ఈ సెషన్ ఎలా లెక్కించబడాలో, నమోదు చేయబడాలో ఎంచుకోండి. వినడం మీ ఫోన్‌లోనే జరుగుతుంది.';

  @override
  String get chantSetupButton => 'ఆటో లెక్కింపు & పదాలు';

  @override
  String get chantSetupNoneOn => 'సెటప్';

  @override
  String chantSetupOn(int count) {
    return '$count ఆన్‌లో';
  }

  @override
  String chantSetupButtonState(String button, String state) {
    return '$button · $state';
  }

  @override
  String get chantSetupDone => 'పూర్తయింది';

  @override
  String get chantAnalyticsTitle => 'జప విశ్లేషణ';

  @override
  String get chantTabThisSitting => 'ఈ సెషన్';

  @override
  String get chantTabHistory => 'చరిత్ర';

  @override
  String chantMalaTitle(int number) {
    return 'మాల $number';
  }

  @override
  String get chantMalaInProgress => 'కొనసాగుతోంది';

  @override
  String get chantMalaStart => 'ప్రారంభం';

  @override
  String get chantMalaEnd => 'ముగింపు';

  @override
  String get chantMalaDuration => 'వ్యవధి';

  @override
  String chantMalaChants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count జపాలు',
      one: '1 జపం',
    );
    return '$_temp0';
  }

  @override
  String get chantTapsHeader => 'ప్రతి జపం';

  @override
  String get chantHeardLabel => 'వినబడింది';

  @override
  String get chantNoMalasYet =>
      'ఈ సెషన్‌లో ఇంకా జపాలు లేవు. మీరు పూర్తి చేసే ప్రతి మాల దాని ప్రారంభం, ముగింపు, పట్టిన సమయంతో ఇక్కడ జాబితా చేయబడుతుంది.';

  @override
  String get chantHistoryEmpty => 'ఇంతకు ముందు సెషన్లు ఇంకా లేవు.';

  @override
  String chantHistorySummary(int malas, int chants) {
    return '$malas మాలలు · $chants జపాలు';
  }

  @override
  String get chantHistoryNoDetail =>
      'జప సమయం నమోదు చేయడానికి ముందు లెక్కించబడింది';

  @override
  String get chantSessionTitle => 'సెషన్';

  @override
  String get chantSessionNoMalas => 'ఈ సెషన్‌కు సమయం నమోదైన మాలలు ఏవీ లేవు.';

  @override
  String get chantHeardExpiry =>
      'వినబడిన పదాలు సెషన్ తర్వాత 7 రోజులకు మీ ఖాతా నుండి తొలగించబడతాయి.';

  @override
  String get chantHeardTitle => 'ఇప్పుడు విన్నది';

  @override
  String get chantHeardHearing => 'మిమ్మల్ని వింటోంది…';

  @override
  String get chantHeardWaiting => 'మీ స్వరం కోసం ఎదురుచూస్తోంది';

  @override
  String get chantHeardPlaceholder =>
      'బిగ్గరగా జపించండి. మీ ఫోన్ విన్న పదాలు ఇక్కడ కనిపిస్తాయి.';

  @override
  String get chantHeardLast => 'చివరిగా విన్నది';

  @override
  String chantHeardCounted(int count) {
    return 'లెక్కించబడింది +$count';
  }

  @override
  String get chantHeardNotCounted => 'లెక్కించబడలేదు';

  @override
  String chantHeardMatch(int percent, int needed) {
    return '$percent% సరిపోలిక · కావాల్సింది $needed%';
  }

  @override
  String chantHeardMatchShort(int percent) {
    return '$percent% సరిపోలిక';
  }

  @override
  String get chantHeardEarlier => 'ముందుగా';

  @override
  String get chantAlongTitle => 'కలిసి జపించండి';

  @override
  String get chantAlongCaption =>
      'రికార్డింగ్‌తో పాటు కౌంటర్ లెక్కిస్తుంది. ఇది ప్లే అవుతున్నప్పుడు ఆటో లెక్కింపు, పద గుర్తింపు విశ్రాంతి తీసుకుంటాయి.';

  @override
  String get chantAlongPlay => 'రికార్డింగ్ ప్లే చేయండి';

  @override
  String get chantAlongPause => 'రికార్డింగ్ పాజ్ చేయండి';

  @override
  String get chantAlongPosition => 'రికార్డింగ్‌లో స్థానం';

  @override
  String get chantAlongLoading => 'రికార్డింగ్ లోడ్ అవుతోంది…';

  @override
  String get chantAlongLoadFailed => 'రికార్డింగ్‌ను లోడ్ చేయలేకపోయాము.';

  @override
  String get settingsSectionLanguages => 'భాషలు';

  @override
  String get settingsLanguageApp => 'యాప్ భాష';

  @override
  String get settingsLanguageAppHint => 'మెనూలు, బటన్లు, లేబుల్స్';

  @override
  String get settingsLanguageReading => 'పఠన భాష';

  @override
  String get settingsLanguageReadingHint => 'అనువాదం, అర్థం, భాష్యం';

  @override
  String get settingsLanguageSpeaking => 'మాట్లాడే మరియు వినే భాష';

  @override
  String get settingsLanguageSpeakingHint =>
      'ఆడియో మరియు చదివి వినిపించే అర్థం';

  @override
  String get settingsLanguagePickerApp => 'యాప్ భాషను ఎంచుకోండి';

  @override
  String get settingsLanguagePickerReading => 'పఠన భాషను ఎంచుకోండి';

  @override
  String get settingsLanguagePickerSpeaking => 'మాట్లాడే భాషను ఎంచుకోండి';

  @override
  String get settingsLanguageSanskritNote =>
      'సంస్కృత శ్లోకాలు ఎల్లప్పుడూ సంస్కృతంలోనే ఉంటాయి.';

  @override
  String get readingAudioPlayAll => 'చదివి వినిపించు';

  @override
  String get readingAudioPlayVerse => 'ఈ శ్లోకాన్ని ప్లే చేయండి';

  @override
  String get readingAudioPause => 'పాజ్';

  @override
  String get readingAudioResume => 'కొనసాగించు';

  @override
  String get readingAudioStop => 'ఆపు';

  @override
  String get readingAudioNext => 'తదుపరి శ్లోకం';

  @override
  String get readingAudioPrevious => 'మునుపటి శ్లోకం';

  @override
  String get readingAudioFromStart => 'మొదటి నుండి';

  @override
  String readingAudioResumeFrom(int number) {
    return 'శ్లోకం $number నుండి కొనసాగించండి';
  }

  @override
  String readingAudioNowPlaying(String section, int number) {
    return '$section · శ్లోకం $number';
  }

  @override
  String get readingAudioLoading => 'లోడ్ అవుతోంది…';

  @override
  String get readingAudioChannel => 'చదివి వినిపించడం';

  @override
  String get readingSectionVerse => 'శ్లోకం';

  @override
  String get readingSectionMeaning => 'అర్థం';

  @override
  String get readingSectionPurport => 'భాష్యం';

  @override
  String get settingsVoices => 'స్వరాలు';

  @override
  String settingsVoicesValue(int count) {
    return '$count ఇన్‌స్టాల్ చేయబడ్డాయి';
  }

  @override
  String get voicesTitle => 'స్వరాలు';

  @override
  String get voicesIntro =>
      'అర్థాలు మరియు భాష్యాలు మీ మాట్లాడే భాషలో చదివి వినిపించబడతాయి. స్వరం డౌన్‌లోడ్ అయ్యే వరకు మీ ఫోన్ స్వంత స్వరం ఉపయోగించబడుతుంది, కాబట్టి పఠనం ఎప్పుడూ ఆగదు.';

  @override
  String voicesStorage(String size) {
    return 'ఈ ఫోన్‌లో $size ఉపయోగిస్తోంది';
  }

  @override
  String get voicesEmpty =>
      'డౌన్‌లోడ్ చేసుకోడానికి స్వరాలు ఇంకా అందుబాటులో లేవు. మీ ఫోన్ స్వంత స్వరం ఉపయోగించబడుతుంది.';

  @override
  String get voiceDownload => 'డౌన్‌లోడ్';

  @override
  String get voiceDelete => 'తొలగించు';

  @override
  String get voiceCancel => 'రద్దు చేయి';

  @override
  String get voiceRetry => 'మళ్లీ ప్రయత్నించండి';

  @override
  String voiceInstalled(String size) {
    return 'ఇన్‌స్టాల్ చేయబడింది · $size';
  }

  @override
  String voiceNotInstalled(String size) {
    return 'డౌన్‌లోడ్ చేయలేదు · $size';
  }

  @override
  String voiceDownloading(int percent) {
    return 'డౌన్‌లోడ్ అవుతోంది $percent%';
  }

  @override
  String get voiceVerifying => 'తనిఖీ చేస్తోంది…';

  @override
  String get voiceExtracting => 'ఇన్‌స్టాల్ అవుతోంది…';

  @override
  String get voiceFailed => 'ఈ స్వరాన్ని ఇన్‌స్టాల్ చేయలేకపోయాము';

  @override
  String get voiceUnavailable =>
      'ఇంకా అందుబాటులో లేదు · మీ ఫోన్ స్వరాన్ని ఉపయోగిస్తుంది';

  @override
  String get voiceDeleteTitle => 'ఈ స్వరాన్ని తొలగించాలా?';

  @override
  String get voiceDeleteBody =>
      'దీన్ని మళ్లీ డౌన్‌లోడ్ చేసుకోవచ్చు. అప్పటివరకు మీ ఫోన్ స్వంత స్వరం ఉపయోగించబడుతుంది.';

  @override
  String voiceLanguages(String languages) {
    return '$languages మాట్లాడుతుంది';
  }

  @override
  String labelVerseWithSection(int number, String section) {
    return 'శ్లోకం $number · $section';
  }
}
