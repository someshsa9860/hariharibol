// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Marathi (`mr`).
class AppLocalizationsMr extends AppLocalizations {
  AppLocalizationsMr([String locale = 'mr']) : super(locale);

  @override
  String get appName => 'HariHariBol';

  @override
  String get splashTagline => 'वाचा · जप करा · साधना करा';

  @override
  String get actionRetry => 'पुन्हा प्रयत्न करा';

  @override
  String get actionCancel => 'रद्द करा';

  @override
  String get actionOk => 'ठीक आहे';

  @override
  String get actionDone => 'झाले';

  @override
  String get actionSave => 'जतन करा';

  @override
  String get actionViewAll => 'सर्व पहा';

  @override
  String get actionSignOut => 'साइन आउट करा';

  @override
  String get actionDeleteAccount => 'खाते हटवा';

  @override
  String get actionContinue => 'पुढे जा';

  @override
  String get errorGeneric => 'काहीतरी चुकले. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get errorNetwork =>
      'कनेक्शन नाही. तुमचे इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.';

  @override
  String get errorTimeout => 'यास खूप वेळ लागला. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get errorSessionExpired =>
      'तुमचे सत्र संपले आहे. कृपया पुन्हा साइन इन करा.';

  @override
  String get errorSignIn =>
      'आम्ही तुम्हाला साइन इन करू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get errorInsecureConnection => 'कनेक्शन सुरक्षित नाही.';

  @override
  String get errorCancelled => 'विनंती रद्द केली.';

  @override
  String get errorEmptyTitle => 'इथे अजून काही नाही';

  @override
  String get errorRouteNotFound => 'ती स्क्रीन अस्तित्वात नाही.';

  @override
  String get actionGoHome => 'होमवर जा';

  @override
  String get signInTitle => 'स्वागत आहे';

  @override
  String get signInSubtitle =>
      'वाचा, जप करा आणि तुमची दैनंदिन साधना एकाच ठिकाणी ठेवा.';

  @override
  String get signInWithGoogle => 'Google सह सुरू ठेवा';

  @override
  String get signInWithApple => 'Apple सह सुरू ठेवा';

  @override
  String get signInCancelled => 'साइन-इन रद्द केले.';

  @override
  String get signInFailed =>
      'आम्ही तुम्हाला साइन इन करू शकलो नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String get signInLegal =>
      'सुरू ठेवून तुम्ही आमच्या अटी आणि गोपनीयता धोरणाशी सहमत होता.';

  @override
  String languageStepOf(int current, int total) {
    return '$total पैकी पायरी $current';
  }

  @override
  String get languageAppTitle => 'कोणती भाषा आपलीशी वाटते?';

  @override
  String get languageAppSubtitle =>
      'तुम्ही हे केव्हाही सेटिंग्जमध्ये बदलू शकता.';

  @override
  String get languageMantraTitle => 'तुम्ही कोणत्या लिपीत जप करता?';

  @override
  String get languageMantraSubtitle =>
      'मंत्र याच लिपीत दिसतील. त्यांचा अर्थ तुमच्या स्वतःच्या भाषेतच राहील.';

  @override
  String get actionBack => 'मागे';

  @override
  String get tabHome => 'होम';

  @override
  String get tabSadhana => 'जप';

  @override
  String get tabLibrary => 'वाचा';

  @override
  String get tabRoutine => 'दिनचर्या';

  @override
  String get reelsTitle => 'रील्स';

  @override
  String get tabSearch => 'शोधा';

  @override
  String get homeGreeting => 'हरी बोल';

  @override
  String homeGreetingNamed(String name) {
    return 'हरी बोल, $name';
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
  String get homeMoodPrompt => 'आज तुम्ही कसे आहात?';

  @override
  String get homeMoodAnsweredToday =>
      'आज तुम्हाला कसे वाटते आहे ते तुम्ही सांगितले आहे. काहीतरी नवीन सांगण्यासाठी उद्या पुन्हा या.';

  @override
  String homeMoodViewToday(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'आजचे $count श्लोक पुन्हा वाचा',
      one: 'आजचा श्लोक पुन्हा वाचा',
    );
    return '$_temp0';
  }

  @override
  String homeMoodSubmit(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'मला $count श्लोक दाखवा',
      one: 'मला एक श्लोक दाखवा',
    );
    return '$_temp0';
  }

  @override
  String get homeVerseOfTheDay => 'आजचा श्लोक';

  @override
  String get homeSlokaForYou => 'आज तुमच्यासाठी';

  @override
  String get homeTodaysSadhana => 'आजची साधना';

  @override
  String get homeContinueReading => 'वाचन सुरू ठेवा';

  @override
  String get homeBooks => 'ग्रंथ';

  @override
  String get homeMantras => 'मंत्र';

  @override
  String get homeStartYourDay => 'आजचे लक्ष्य ठरवा';

  @override
  String homeChantMantra(String mantra) {
    return '$mantra चा जप करा';
  }

  @override
  String bookChapterCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count अध्याय',
      one: '1 अध्याय',
    );
    return '$_temp0';
  }

  @override
  String bookVerseCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count श्लोक',
      one: '1 श्लोक',
    );
    return '$_temp0';
  }

  @override
  String get searchHint => 'श्लोक, मंत्र, ग्रंथ शोधा';

  @override
  String get searchPrompt => 'संपूर्ण ग्रंथालयात शोधा, थेट सर्व्हरवरून.';

  @override
  String get searchShortcutLabel => 'किंवा थेट एखाद्या श्लोकावर जा:';

  @override
  String get searchNoResults =>
      'निकाल नाही. दुसरा शब्द वापरून पहा, किंवा BG 2.47 सारखा संदर्भ लिहा.';

  @override
  String get searchSectionVerses => 'श्लोक';

  @override
  String searchResultsTitle(String kind, String query) {
    return '$kind · $query';
  }

  @override
  String labelCanto(int number) {
    return 'स्कंध $number';
  }

  @override
  String labelChapter(int number) {
    return 'अध्याय $number';
  }

  @override
  String labelVerse(int number) {
    return 'श्लोक $number';
  }

  @override
  String labelCantoChapter(int canto, int chapter) {
    return 'स्कंध $canto · अध्याय $chapter';
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
    return '$target पैकी $done माळा';
  }

  @override
  String sadhanaTasksProgress(int done, int total) {
    return '$total पैकी $done कामे पूर्ण';
  }

  @override
  String sadhanaStreak(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days दिवसांचे सातत्य',
      one: '1 दिवसाचे सातत्य',
      zero: 'अजून सातत्य नाही',
    );
    return '$_temp0';
  }

  @override
  String get sadhanaGenericChant => 'जप';

  @override
  String sadhanaRoundsShort(int rounds) {
    return '$rounds माळा';
  }

  @override
  String get sadhanaTodaysSessions => 'आजचा जप';

  @override
  String get sadhanaNoSessionsYet => 'आज अजून काही नोंदवले नाही.';

  @override
  String get sadhanaRoundsEyebrow => 'आजच्या माळा';

  @override
  String get sadhanaRoundsCaption => 'माळा';

  @override
  String get sadhanaChantNow => 'आता जप करा';

  @override
  String get sadhanaLogRounds => 'माळा नोंदवा';

  @override
  String get sadhanaLogRoundsSubtitle =>
      'तुमच्या माळेवर केलेला जप, आजच्या एकूण संख्येत जोडला जाईल.';

  @override
  String sadhanaLogRoundsSubmit(int rounds) {
    return '$rounds माळा नोंदवा';
  }

  @override
  String get sadhanaTargetReached => 'आजचे लक्ष्य पूर्ण झाले';

  @override
  String get sadhanaUndoBead => 'शेवटचा मणी मागे घ्या';

  @override
  String get sadhanaElapsedEyebrow => 'गेलेला वेळ';

  @override
  String get sadhanaPaceEyebrow => 'गती';

  @override
  String sadhanaElapsedSeconds(String seconds) {
    return '$seconds सेकंद';
  }

  @override
  String sadhanaPacePerMantra(String seconds) {
    return 'प्रत्येकी $seconds सेकंद';
  }

  @override
  String get sadhanaAutoCount => 'स्वयंचलित मोजणी';

  @override
  String get sadhanaAutoCountOff => 'बंद — मणी स्वतः टॅप करा';

  @override
  String get sadhanaAutoCountIdle => 'जपाची प्रतीक्षा आहे';

  @override
  String get chantAutoCountLoading => 'स्वयंचलित मोजणी तयार होत आहे…';

  @override
  String get chantFullPicture => 'पूर्ण स्क्रीन चित्र';

  @override
  String get chantPrayerHint =>
      'आधी ही प्रार्थना करा, मग गणना सुरू करण्यासाठी वर्तुळावर टॅप करा.';

  @override
  String get sadhanaAutoCountListening => 'ऐकत आहे…';

  @override
  String get sadhanaAutoCountCounted => 'मोजले — पुढच्याची प्रतीक्षा आहे';

  @override
  String get sadhanaAutoCountPermissionDenied =>
      'स्वयंचलित मोजणीसाठी मायक्रोफोनची परवानगी हवी आहे';

  @override
  String get sadhanaAutoCountUnavailable => 'स्वयंचलित मोजणी सध्या उपलब्ध नाही';

  @override
  String get chantModelTitle => 'अधिक चांगले ऐकणे';

  @override
  String chantModelOffer(int megabytes) {
    return 'संस्कृत खूप चांगले समजते. $megabytes MB चे एकदाच डाउनलोड — Wi-Fi वापरा.';
  }

  @override
  String get chantModelDownload => 'डाउनलोड करा';

  @override
  String chantModelDownloading(int percent) {
    return 'डाउनलोड होत आहे… $percent%';
  }

  @override
  String get chantModelCancel => 'रद्द करा';

  @override
  String get chantModelInstalled =>
      'डाउनलोड झाले — पुढच्या वेळी स्वयंचलित मोजणी सुरू केल्यावर वापरले जाईल';

  @override
  String get chantModelRemove => 'काढून टाका';

  @override
  String get chantModelFailed => 'डाउनलोड पूर्ण झाले नाही';

  @override
  String get chantModelRetry => 'पुन्हा प्रयत्न करा';

  @override
  String get mantraAllCategories => 'सर्व';

  @override
  String get mantraNoneInCategory => 'या वर्गात अजून एकही मंत्र नाही.';

  @override
  String get mantraCategoryBeej => 'बीजमंत्र';

  @override
  String get mantraCategoryGayatri => 'गायत्री';

  @override
  String get mantraCategoryMahamantra => 'महामंत्र';

  @override
  String get mantraCategoryName => 'नाममंत्र';

  @override
  String mantraStandardRounds(int rounds) {
    return '$rounds माळा';
  }

  @override
  String mantraStandardCount(int count) {
    return '$count वेळा';
  }

  @override
  String get mantraHasAudio => 'पठण उपलब्ध आहे';

  @override
  String get mantraPurport => 'तात्पर्य';

  @override
  String mantraMyRounds(int rounds) {
    return 'तुम्ही याच्या $rounds माळा जप केला आहे';
  }

  @override
  String get mantraChantThis => 'याचा जप करा';

  @override
  String get profileStatVersesSaved => 'जतन केलेले श्लोक';

  @override
  String get profileStatTotalRounds => 'एकूण माळा';

  @override
  String get profileStatChantingDays => 'जपाचे दिवस';

  @override
  String get profileStatSlokasRead => 'वाचलेले श्लोक';

  @override
  String get profileRecentFavorites => 'अलीकडील आवडते';

  @override
  String get profileNoFavorites =>
      'अजून काही जतन केलेले नाही. एखादा श्लोक बुकमार्क करा, तो इथे दिसेल.';

  @override
  String get settingsTitle => 'सेटिंग्ज';

  @override
  String get settingsSectionPractice => 'साधना';

  @override
  String get settingsSectionAccount => 'खाते';

  @override
  String get settingsLanguage => 'भाषा';

  @override
  String get settingsTheme => 'थीम';

  @override
  String get settingsDailyGoal => 'दैनंदिन लक्ष्य';

  @override
  String get settingsDailyGoalSubtitle =>
      'दररोज किती माळांचे लक्ष्य ठेवायचे. प्रत्येक नवीन दिवस यापासूनच सुरू होतो.';

  @override
  String settingsDailyGoalSubmit(int rounds) {
    return 'दैनंदिन लक्ष्य $rounds करा';
  }

  @override
  String get settingsPreferredMantra => 'आवडता मंत्र';

  @override
  String get settingsPreferredMantraNone => 'ठरवलेला नाही';

  @override
  String get settingsChooseMantraTitle => 'तुमचा मंत्र निवडा';

  @override
  String get settingsChooseMantraSubtitle =>
      '“आता जप करा” यानेच उघडते. बाकी काहीही तुम्ही त्याच्या स्वतःच्या पानावरून जपू शकता.';

  @override
  String get settingsNoMantraPreference =>
      'कोणतीही पसंती नाही — प्रत्येक वेळी मला विचारा';

  @override
  String get settingsPlans => 'प्लॅन आणि प्रीमियम';

  @override
  String get plansTitle => 'प्लॅन';

  @override
  String get plansSubtitle =>
      'संपूर्ण अ‍ॅप मोफत आहे. सशुल्क प्लॅन त्यावर थोडे अधिक जोडतो.';

  @override
  String get plansYourPlan => 'तुमचा प्लॅन';

  @override
  String get plansCurrent => 'सध्याचा प्लॅन';

  @override
  String get plansFreeForEveryone => 'सर्वांसाठी मोफत';

  @override
  String plansPricePer(String price, String period) {
    return '$price / $period';
  }

  @override
  String get plansPeriodWeek => 'आठवडा';

  @override
  String get plansPeriodMonth => 'महिना';

  @override
  String get plansPeriodYear => 'वर्ष';

  @override
  String plansPeriodDays(int days) {
    return '$days दिवस';
  }

  @override
  String plansTrial(int days) {
    return '$days दिवसांची मोफत चाचणी';
  }

  @override
  String get plansSubscribe => 'सबस्क्राइब करा';

  @override
  String get plansStartTrial => 'मोफत चाचणी सुरू करा';

  @override
  String get plansRestore => 'खरेदी पुनर्संचयित करा';

  @override
  String get plansStoreUnavailable => 'या डिव्हाइसवर स्टोअर उपलब्ध नाही.';

  @override
  String get plansProductMissing => 'हा प्लॅन सध्या स्टोअरमध्ये उपलब्ध नाही.';

  @override
  String get plansPurchasePending => 'तुमची खरेदी प्रक्रियेत आहे…';

  @override
  String get plansPurchaseSuccess => 'धन्यवाद — तुमचा प्लॅन सुरू झाला आहे.';

  @override
  String get plansPurchaseFailed => 'खरेदी पूर्ण झाली नाही.';

  @override
  String get plansPurchaseCancelled => 'खरेदी रद्द केली.';

  @override
  String plansRenews(String date) {
    return '$date रोजी नूतनीकरण होईल';
  }

  @override
  String plansEnds(String date) {
    return '$date पर्यंत प्रवेश';
  }

  @override
  String get plansPermanent =>
      'हे कायमचे तुमचे आहे — HariHariBol ला साथ दिल्याबद्दल धन्यवाद.';

  @override
  String get plansIncluded => 'समाविष्ट';

  @override
  String get plansNotIncluded => 'समाविष्ट नाही';

  @override
  String get plansUnlimited => 'अमर्याद';

  @override
  String plansLimit(int limit, String unit) {
    return '$limit $unit';
  }

  @override
  String get plansNoFeatures =>
      'अजून अतिरिक्त फायदे नाहीत — आणखी लवकरच येत आहेत.';

  @override
  String get plansRestoreDone => 'खरेदी पुनर्संचयित झाली.';

  @override
  String get settingsPrivacy => 'गोपनीयता धोरण';

  @override
  String settingsVersion(String version) {
    return 'आवृत्ती $version';
  }

  @override
  String get settingsMadeWith => 'श्रद्धेने बनवलेले';

  @override
  String settingsFooter(String version, String madeWith) {
    return '$version · $madeWith';
  }

  @override
  String get themeSystem => 'स्वयंचलित';

  @override
  String get themeLight => 'लाइट';

  @override
  String get themeDark => 'डार्क';

  @override
  String profileSignedInAs(String email) {
    return '$email म्हणून साइन इन केले';
  }

  @override
  String get profilePremium => 'प्रीमियम';

  @override
  String get profileFree => 'मोफत';

  @override
  String get signOutConfirm =>
      'तुमचा साधनेचा इतिहास पाहण्यासाठी तुम्हाला पुन्हा साइन इन करावे लागेल.';

  @override
  String get deleteAccountTitle => 'तुमचे खाते हटवायचे?';

  @override
  String get deleteAccountBody =>
      'यामुळे तुमचा साधनेचा इतिहास, आवडते आणि सूचना काढून टाकल्या जातील. हे पूर्ववत करता येत नाही.';

  @override
  String get comingSoon => 'लवकरच येत आहे';

  @override
  String get libraryNoBooks => 'अजून कोणताही ग्रंथ प्रकाशित झालेला नाही.';

  @override
  String get actionEdit => 'संपादित करा';

  @override
  String get actionDelete => 'हटवा';

  @override
  String get libraryDownloadBook => 'ऑफलाइन वाचनासाठी डाउनलोड करा';

  @override
  String get libraryDownloading => 'डाउनलोड होत आहे…';

  @override
  String get libraryDownloaded => 'ऑफलाइन वाचनासाठी डाउनलोड झाले';

  @override
  String get libraryDownloadFailed =>
      'हा ग्रंथ डाउनलोड करता आला नाही. कृपया पुन्हा प्रयत्न करा.';

  @override
  String bookCantoCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count स्कंध',
      one: '1 स्कंध',
    );
    return '$_temp0';
  }

  @override
  String bookByTranslators(String names) {
    return '$names यांचे भाषांतर';
  }

  @override
  String get chapterPrevious => 'मागील अध्याय';

  @override
  String get chapterNext => 'पुढील अध्याय';

  @override
  String get actionBookmark => 'बुकमार्क करा';

  @override
  String get actionRemoveBookmark => 'बुकमार्क काढा';

  @override
  String get actionHighlight => 'हायलाइट करा';

  @override
  String get actionRemoveHighlight => 'हायलाइट काढा';

  @override
  String get verseExplanationLabel => 'स्पष्टीकरण';

  @override
  String get verseExplanationAiLabel => 'स्पष्टीकरण (AI च्या मदतीने)';

  @override
  String get verseWordMeanings => 'शब्दार्थ';

  @override
  String get verseCompareTranslations => 'भाषांतरांची तुलना करा';

  @override
  String get verseTranslationsEmpty =>
      'अजून इतर भाषांतरे प्रकाशित झालेली नाहीत.';

  @override
  String get verseRelatedTitle => 'संबंधित श्लोक';

  @override
  String get verseRelatedEmpty => 'अजून संबंधित श्लोक नाहीत.';

  @override
  String get relationSameConcept => 'समान संकल्पना';

  @override
  String get relationExpandsOn => 'याचा विस्तार';

  @override
  String get relationQuotedIn => 'यात उद्धृत';

  @override
  String get relationContrastsWith => 'याच्या विरुद्ध';

  @override
  String get verseNotesTitle => 'माझ्या नोंदी';

  @override
  String get verseNoteHint => 'नोंद लिहा…';

  @override
  String get verseNoteAdd => 'नोंद जोडा';

  @override
  String get verseNoteEmpty => 'या श्लोकावर अजून नोंदी नाहीत.';

  @override
  String get verseNoteDeleteConfirm => 'ही नोंद हटवायची?';

  @override
  String get readingSettingsTitle => 'वाचन सेटिंग्ज';

  @override
  String get readingFontSizeLabel => 'अक्षरांचा आकार';

  @override
  String get readingFontSizeSmall => 'लहान';

  @override
  String get readingFontSizeMedium => 'मध्यम';

  @override
  String get readingFontSizeLarge => 'मोठा';

  @override
  String get readingFontSizeExtraLarge => 'खूप मोठा';

  @override
  String get readingLanguageLabel => 'वाचनाची भाषा';

  @override
  String get routineSubtitle => 'भक्ती, काम आणि मधले रोजचे क्षण.';

  @override
  String routineProgress(int done, int total) {
    return '$total पैकी $done पूर्ण';
  }

  @override
  String get routineEmptyBody =>
      'एक माळ, एखादे काम, एखादे घरचे काम जोडा — आजचा दिवस संकल्पाने घडवा.';

  @override
  String get routineAddTask => 'काम जोडा';

  @override
  String get routineTaskHint => 'काय करायचे आहे?';

  @override
  String get routineCategoryLabel => 'वर्ग';

  @override
  String get routineCategoryDevotion => 'भक्ती';

  @override
  String get routineCategoryWork => 'काम';

  @override
  String get routineCategoryHome => 'घर';

  @override
  String get routineCategoryErrand => 'बाहेरचे काम';

  @override
  String get routineSlotMorning => 'सकाळ';

  @override
  String get routineSlotAfternoon => 'दुपार';

  @override
  String get routineSlotEvening => 'संध्याकाळ';

  @override
  String get routineSlotAnytime => 'कधीही';

  @override
  String get routinePresetWakeUp => 'उठणे';

  @override
  String get routinePresetMorningChant => 'सकाळचा जप';

  @override
  String get routinePresetExercise => 'व्यायाम';

  @override
  String get routinePresetBreakfast => 'न्याहारी';

  @override
  String get routinePresetLunch => 'दुपारचे जेवण';

  @override
  String get routinePresetEveningChant => 'संध्याकाळचा जप';

  @override
  String get routinePresetDinner => 'रात्रीचे जेवण';

  @override
  String get routinePresetScriptureReading => 'शास्त्र वाचन';

  @override
  String get routinePresetSleep => 'झोप';

  @override
  String get routineTaskNameLabel => 'कामाचे नाव';

  @override
  String get routineWindowHeading => 'ठरलेली वेळ';

  @override
  String get routineWindowHint =>
      'या कालावधीत केले तर वेळेवर, त्याआधी केले तर लवकर आणि त्यानंतर केले तर उशिरा मोजले जाते.';

  @override
  String get routineWindowSet => 'वेळेची मर्यादा ठरवा';

  @override
  String get routineWindowClear => 'वेळेची मर्यादा काढा';

  @override
  String get routineWindowFrom => 'पासून';

  @override
  String get routineWindowTo => 'पर्यंत';

  @override
  String routineWindowRange(String start, String end) {
    return '$start – $end';
  }

  @override
  String get routineWindowInvalid => 'शेवटची वेळ सुरुवातीनंतरची असली पाहिजे.';

  @override
  String get routineStatusNotDone => 'पूर्ण झाले नाही';

  @override
  String get routineStatusDone => 'पूर्ण झाले';

  @override
  String get routineStatusEarly => 'लवकर';

  @override
  String get routineStatusOnTime => 'वेळेवर';

  @override
  String get routineStatusLate => 'उशिरा';

  @override
  String routineStatusAtTime(String status, String time) {
    return '$status · $time';
  }

  @override
  String get routineChangeTime => 'वेळ बदला';

  @override
  String get routinePickDoneTime => 'हे केव्हा पूर्ण झाले?';

  @override
  String get routineSaveAction => 'या दिवसात जोडा';

  @override
  String get routineTaskRemoved => 'या दिवसातून काढले';

  @override
  String get routineUndo => 'पूर्ववत करा';

  @override
  String get routineToday => 'आज';

  @override
  String get routineJumpToToday => 'आजवर जा';

  @override
  String get routineEkadashi => 'एकादशी';

  @override
  String get routineEkadashiNote =>
      'अंदाजे — मंदिराचे पंचांग एका दिवसाने वेगळे असू शकते.';

  @override
  String routineDayLabel(String date, String ekadashi, int done, int total) {
    String _temp0 = intl.Intl.selectLogic(ekadashi, {
      'yes': ' · एकादशी',
      'other': '',
    });
    String _temp1 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: ' · $total पैकी $done पूर्ण',
      zero: '',
    );
    return '$date$_temp0$_temp1';
  }

  @override
  String get routineNothingPlanned => 'या दिवसासाठी काही ठरवलेले नाही.';

  @override
  String get routineManageDaily => 'दैनंदिन दिनचर्या';

  @override
  String get routineDailyTitle => 'दैनंदिन दिनचर्या';

  @override
  String get routineDailyBody =>
      'ऐच्छिक. हे दररोज पुन्हा येतात, आणि प्रत्येक दिवशी नवीन टिक असते.';

  @override
  String get routineDailyEmpty => 'अजून दैनंदिन दिनचर्या नाही.';

  @override
  String get routineDailyAdd => 'दैनंदिन दिनचर्येत जोडा';

  @override
  String get routineDailySaveAction => 'प्रत्येक दिवसात जोडा';

  @override
  String get routineDailyBadge => 'दैनंदिन';

  @override
  String get routineDailyRemove => 'दैनंदिन दिनचर्येतून काढा';

  @override
  String get routineDailyRemoved => 'तुमच्या दैनंदिन दिनचर्येतून काढले';

  @override
  String get reelsEmpty => 'अजून एकही रील नाही';

  @override
  String get reelsEmptyBody =>
      'क्रिएटर्सनी पोस्ट करायला सुरुवात केली की त्यांच्या रील्स इथे दिसतील.';

  @override
  String get reelsFailed => 'रील्स लोड करता आल्या नाहीत';

  @override
  String get reelsRetry => 'पुन्हा प्रयत्न करा';

  @override
  String get reelFollow => 'फॉलो करा';

  @override
  String get reelFollowing => 'फॉलो करत आहात';

  @override
  String get reelLike => 'लाइक करा';

  @override
  String get reelUnlike => 'लाइक काढा';

  @override
  String get reelComment => 'कमेंट';

  @override
  String get reelShare => 'शेअर करा';

  @override
  String get reelSave => 'जतन करा';

  @override
  String get reelUnsave => 'जतन केलेल्यातून काढा';

  @override
  String get reelSaved => 'जतन केले';

  @override
  String get reelRemovedFromSaved => 'जतन केलेल्यातून काढले';

  @override
  String get reelMore => 'आणखी पर्याय';

  @override
  String get reelMuted => 'आवाज बंद';

  @override
  String get reelUnmuted => 'आवाज सुरू';

  @override
  String get reelPlay => 'चालू करा';

  @override
  String get reelPause => 'थांबवा';

  @override
  String get reelVideoUnavailable => 'हा व्हिडिओ अजून प्रक्रियेत आहे.';

  @override
  String get reelAudioUnavailable => 'हे पठण अजून प्रक्रियेत आहे.';

  @override
  String get reelSimilar => 'यासारख्या आणखी रील्स';

  @override
  String get reelSimilarEmpty => 'अजून अशा रील्स नाहीत.';

  @override
  String reelSlideOf(int current, int total) {
    return '$total पैकी $current';
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
  String get reelCaptionMore => 'आणखी';

  @override
  String get reelCaptionLess => 'कमी';

  @override
  String get reelCommentsTitle => 'कमेंट्स';

  @override
  String reelCommentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count कमेंट्स',
      one: '1 कमेंट',
      zero: 'अजून कमेंट नाही',
    );
    return '$_temp0';
  }

  @override
  String get reelCommentsEmpty => 'सर्वात आधी काहीतरी सांगा.';

  @override
  String get reelCommentHint => 'कमेंट जोडा…';

  @override
  String reelReplyHint(String name) {
    return '$name यांना उत्तर द्या…';
  }

  @override
  String get reelCommentSend => 'पोस्ट करा';

  @override
  String get reelCommentReply => 'उत्तर द्या';

  @override
  String get reelCommentDelete => 'हटवा';

  @override
  String get reelCommentReport => 'रिपोर्ट करा';

  @override
  String get reelCommentPin => 'पिन करा';

  @override
  String get reelCommentUnpin => 'पिन काढा';

  @override
  String get reelCommentPinned => 'पिन केले';

  @override
  String get reelCommentRemoved => 'ही कमेंट काढून टाकली आहे.';

  @override
  String get reelCommentDeleted => 'कमेंट हटवली';

  @override
  String get reelCommentDeleteTitle => 'ही कमेंट हटवायची?';

  @override
  String get reelCommentDeleteBody =>
      'ती सर्वांसाठी, तिच्या सर्व उत्तरांसह काढून टाकली जाईल.';

  @override
  String get reelCommentCancelReply => 'उत्तर रद्द करा';

  @override
  String reelViewReplies(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count उत्तरे पहा',
      one: '1 उत्तर पहा',
    );
    return '$_temp0';
  }

  @override
  String get reelHideReplies => 'उत्तरे लपवा';

  @override
  String get reelLoadMoreComments => 'आणखी कमेंट्स लोड करा';

  @override
  String get reelReportTitle => 'या रीलचा रिपोर्ट करा';

  @override
  String get reelReportCommentTitle => 'या कमेंटचा रिपोर्ट करा';

  @override
  String get reelReportBody =>
      'यात काय चुकीचे आहे ते सांगा. एक मॉडरेटर त्याचे पुनरावलोकन करेल.';

  @override
  String get reelReportSpam => 'स्पॅम किंवा दिशाभूल करणारे';

  @override
  String get reelReportHarassment => 'छळ किंवा अपमानास्पद';

  @override
  String get reelReportNonDevotional => 'भक्तिपर मजकूर नाही';

  @override
  String get reelReportMisinformation => 'चुकीची माहिती';

  @override
  String get reelReportSexualOrViolent => 'लैंगिक किंवा हिंसक';

  @override
  String get reelReportOther => 'आणखी काही';

  @override
  String get reelReportNoteHint =>
      'आम्हाला आणखी काही माहीत असायला हवे का? (ऐच्छिक)';

  @override
  String get reelReportSubmit => 'रिपोर्ट करा';

  @override
  String get reelReportThanks => 'धन्यवाद. एक मॉडरेटर हे पाहील.';

  @override
  String get reelShareTitle => 'ही रील शेअर करा';

  @override
  String reelShareMessage(String caption, String link) {
    return '$caption\n\nHariHariBol वर पहा: $link';
  }

  @override
  String get reelCopyLink => 'लिंक कॉपी करा';

  @override
  String get reelLinkCopied => 'लिंक कॉपी झाली';

  @override
  String get creatorTitle => 'क्रिएटर';

  @override
  String creatorFollowers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count फॉलोअर्स',
      one: '1 फॉलोअर',
    );
    return '$_temp0';
  }

  @override
  String creatorReelCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count रील्स',
      one: '1 रील',
    );
    return '$_temp0';
  }

  @override
  String creatorViews(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count व्ह्यूज',
      one: '1 व्ह्यू',
    );
    return '$_temp0';
  }

  @override
  String get creatorStatFollowers => 'फॉलोअर्स';

  @override
  String get creatorStatReels => 'रील्स';

  @override
  String get creatorStatViews => 'व्ह्यूज';

  @override
  String get creatorVerified => 'सत्यापित क्रिएटर';

  @override
  String get creatorNoReels => 'अजून काही पोस्ट केलेले नाही.';

  @override
  String get creatorNotFound => 'तो क्रिएटर आता इथे नाही.';

  @override
  String get chantAnalyticsTooltip => 'विश्लेषण आणि इतिहास';

  @override
  String get chantSittingTime => 'बैठकीचा वेळ';

  @override
  String chantMalaTime(int number) {
    return 'माळा $number चा वेळ';
  }

  @override
  String get chantStatCurrentMala => 'सध्याची माळा';

  @override
  String get chantStatCount => 'मोजणी';

  @override
  String get chantStatMalasDone => 'पूर्ण माळा';

  @override
  String get chantStatAvgMala => 'प्रति माळा सरासरी';

  @override
  String get chantStatAvgChant => 'प्रति जप सरासरी';

  @override
  String get chantStatTotalChants => 'एकूण जप';

  @override
  String get chantStatFastestMala => 'सर्वात जलद माळा';

  @override
  String get chantStatTotalTime => 'एकूण वेळ';

  @override
  String get chantNoValue => '—';

  @override
  String get chantRecentTitle => 'अलीकडील जप';

  @override
  String get chantRecentEmpty => 'सुरू करण्यासाठी वर्तुळावर टॅप करा.';

  @override
  String chantTapNumber(int seq) {
    return '#$seq';
  }

  @override
  String get chantAutoBadge => 'स्वयंचलित';

  @override
  String get chantDetectWords => 'शब्द ओळखा';

  @override
  String get chantDetectWordsOff => 'बंद — शब्द नोंदवले जात नाहीत';

  @override
  String get chantDetectWordsListening => 'शब्द ऐकत आहे…';

  @override
  String get chantDetectWordsPermission => 'मायक्रोफोनची परवानगी हवी आहे';

  @override
  String get chantDetectWordsStarting => 'तयार होत आहे…';

  @override
  String get chantDetectWordsUnavailable =>
      'या डिव्हाइसवर शब्द ओळख उपलब्ध नाही';

  @override
  String get chantDetectWordsNote =>
      'शब्द तुमच्या फोनवरच ओळखले जातात, आणि ऑडिओ कधीही रेकॉर्ड केला जात नाही. मजकूर 7 दिवस ठेवला जातो, नंतर हटवला जातो.';

  @override
  String get chantSetupTitle => 'जपाचे सहाय्यक';

  @override
  String get chantSetupSubtitle =>
      'ही बैठक कशी मोजली आणि नोंदवली जावी ते निवडा. ऐकणे तुमच्या फोनवरच होते.';

  @override
  String get chantSetupButton => 'स्वयंचलित मोजणी आणि शब्द';

  @override
  String get chantSetupNoneOn => 'सेट अप करा';

  @override
  String chantSetupOn(int count) {
    return '$count सुरू';
  }

  @override
  String chantSetupButtonState(String button, String state) {
    return '$button · $state';
  }

  @override
  String get chantSetupDone => 'झाले';

  @override
  String get chantAnalyticsTitle => 'जप विश्लेषण';

  @override
  String get chantTabThisSitting => 'ही बैठक';

  @override
  String get chantTabHistory => 'इतिहास';

  @override
  String chantMalaTitle(int number) {
    return 'माळा $number';
  }

  @override
  String get chantMalaInProgress => 'सुरू आहे';

  @override
  String get chantMalaStart => 'सुरुवात';

  @override
  String get chantMalaEnd => 'समाप्ती';

  @override
  String get chantMalaDuration => 'कालावधी';

  @override
  String chantMalaChants(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count जप',
      one: '1 जप',
    );
    return '$_temp0';
  }

  @override
  String get chantTapsHeader => 'प्रत्येक जप';

  @override
  String get chantHeardLabel => 'ऐकले';

  @override
  String get chantNoMalasYet =>
      'या बैठकीत अजून जप झालेला नाही. तुम्ही पूर्ण केलेली प्रत्येक माळा तिची सुरुवात, समाप्ती आणि लागलेल्या वेळेसह इथे दिसेल.';

  @override
  String get chantHistoryEmpty => 'अजून आधीच्या बैठका नाहीत.';

  @override
  String chantHistorySummary(int malas, int chants) {
    return '$malas माळा · $chants जप';
  }

  @override
  String get chantHistoryNoDetail => 'जपाचा वेळ नोंदवण्यापूर्वी मोजलेले';

  @override
  String get chantSessionTitle => 'बैठक';

  @override
  String get chantSessionNoMalas =>
      'या बैठकीसाठी वेळेसह नोंदवलेली कोणतीही माळा नाही.';

  @override
  String get chantHeardExpiry =>
      'ऐकलेले शब्द बैठकीनंतर 7 दिवसांनी तुमच्या खात्यातून काढून टाकले जातात.';

  @override
  String get chantHeardTitle => 'आत्ता ऐकलेले';

  @override
  String get chantHeardHearing => 'तुम्हाला ऐकत आहे…';

  @override
  String get chantHeardWaiting => 'तुमच्या आवाजाची प्रतीक्षा आहे';

  @override
  String get chantHeardPlaceholder =>
      'मोठ्याने जप करा. तुमच्या फोनला जे शब्द ऐकू येतील ते येथे दिसतील.';

  @override
  String get chantHeardLast => 'शेवटचे ऐकलेले';

  @override
  String chantHeardCounted(int count) {
    return 'मोजले +$count';
  }

  @override
  String get chantHeardNotCounted => 'मोजले नाही';

  @override
  String chantHeardMatch(int percent, int needed) {
    return '$percent% जुळणी · आवश्यक $needed%';
  }

  @override
  String chantHeardMatchShort(int percent) {
    return '$percent% जुळणी';
  }

  @override
  String get chantHeardEarlier => 'आधीचे';

  @override
  String get chantAlongTitle => 'सोबत जप करा';

  @override
  String get chantAlongCaption =>
      'काउंटर रेकॉर्डिंगसोबत मोजतो. ते चालू असताना स्वयंचलित मोजणी आणि शब्द ओळख विश्रांती घेतात.';

  @override
  String get chantAlongPlay => 'रेकॉर्डिंग चालू करा';

  @override
  String get chantAlongPause => 'रेकॉर्डिंग थांबवा';

  @override
  String get chantAlongPosition => 'रेकॉर्डिंगमधील जागा';

  @override
  String get chantAlongLoading => 'रेकॉर्डिंग लोड होत आहे…';

  @override
  String get chantAlongLoadFailed => 'रेकॉर्डिंग लोड करता आले नाही.';

  @override
  String get settingsSectionLanguages => 'भाषा';

  @override
  String get settingsLanguageApp => 'अ‍ॅपची भाषा';

  @override
  String get settingsLanguageAppHint => 'मेनू, बटणे आणि लेबल';

  @override
  String get settingsLanguageReading => 'वाचनाची भाषा';

  @override
  String get settingsLanguageReadingHint => 'भाषांतर, अर्थ आणि तात्पर्य';

  @override
  String get settingsLanguageSpeaking => 'बोलण्याची आणि ऐकण्याची भाषा';

  @override
  String get settingsLanguageSpeakingHint => 'ऑडिओ आणि बोललेला अर्थ';

  @override
  String get settingsLanguagePickerApp => 'अ‍ॅपची भाषा निवडा';

  @override
  String get settingsLanguagePickerReading => 'वाचनाची भाषा निवडा';

  @override
  String get settingsLanguagePickerSpeaking => 'बोलण्याची भाषा निवडा';

  @override
  String get settingsLanguageSanskritNote =>
      'संस्कृत श्लोक नेहमी संस्कृतमध्येच राहतात.';

  @override
  String get readingAudioPlayAll => 'वाचून दाखवा';

  @override
  String get readingAudioPlayVerse => 'हा श्लोक ऐका';

  @override
  String get readingAudioPause => 'थांबवा';

  @override
  String get readingAudioResume => 'पुन्हा सुरू करा';

  @override
  String get readingAudioStop => 'बंद करा';

  @override
  String get readingAudioNext => 'पुढील श्लोक';

  @override
  String get readingAudioPrevious => 'मागील श्लोक';

  @override
  String get readingAudioFromStart => 'सुरुवातीपासून';

  @override
  String readingAudioResumeFrom(int number) {
    return 'श्लोक $number पासून पुढे चालू ठेवा';
  }

  @override
  String readingAudioNowPlaying(String section, int number) {
    return '$section · श्लोक $number';
  }

  @override
  String get readingAudioLoading => 'लोड होत आहे…';

  @override
  String get readingAudioChannel => 'वाचून दाखवणे';

  @override
  String get pushChannelName => 'दैनिक श्लोक आणि सूचना';

  @override
  String get readingSectionVerse => 'श्लोक';

  @override
  String get readingSectionMeaning => 'अर्थ';

  @override
  String get readingSectionPurport => 'तात्पर्य';

  @override
  String get settingsVoices => 'आवाज';

  @override
  String settingsVoicesValue(int count) {
    return '$count इन्स्टॉल केले';
  }

  @override
  String get voicesTitle => 'आवाज';

  @override
  String get voicesIntro =>
      'अर्थ आणि तात्पर्य तुमच्या बोलण्याच्या भाषेत वाचून दाखवले जातात. आवाज डाउनलोड होईपर्यंत तुमच्या फोनचा स्वतःचा आवाज वापरला जातो, त्यामुळे वाचन कधीही थांबत नाही.';

  @override
  String voicesStorage(String size) {
    return 'या फोनवर $size वापरले आहे';
  }

  @override
  String get voicesEmpty =>
      'डाउनलोडसाठी अजून कोणताही आवाज उपलब्ध नाही. तुमच्या फोनचा स्वतःचा आवाज वापरला जातो.';

  @override
  String get voiceDownload => 'डाउनलोड करा';

  @override
  String get voiceDelete => 'हटवा';

  @override
  String get voiceCancel => 'रद्द करा';

  @override
  String get voiceRetry => 'पुन्हा प्रयत्न करा';

  @override
  String voiceInstalled(String size) {
    return 'इन्स्टॉल केले · $size';
  }

  @override
  String voiceNotInstalled(String size) {
    return 'डाउनलोड केलेले नाही · $size';
  }

  @override
  String voiceDownloading(int percent) {
    return 'डाउनलोड होत आहे $percent%';
  }

  @override
  String get voiceVerifying => 'तपासत आहे…';

  @override
  String get voiceExtracting => 'इन्स्टॉल होत आहे…';

  @override
  String get voiceFailed => 'हा आवाज इन्स्टॉल करता आला नाही';

  @override
  String get voiceUnavailable =>
      'अजून उपलब्ध नाही · तुमच्या फोनचा आवाज वापरला जाईल';

  @override
  String get voiceDeleteTitle => 'हा आवाज हटवायचा?';

  @override
  String get voiceDeleteBody =>
      'तो पुन्हा डाउनलोड करता येतो. तोपर्यंत तुमच्या फोनचा स्वतःचा आवाज वापरला जाईल.';

  @override
  String voiceLanguages(String languages) {
    return '$languages बोलतो';
  }

  @override
  String labelVerseWithSection(int number, String section) {
    return 'श्लोक $number · $section';
  }
}
