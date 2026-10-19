// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Hindi (`hi`).
class AppLocalizationsHi extends AppLocalizations {
  AppLocalizationsHi([String locale = 'hi']) : super(locale);

  @override
  String get appName => 'HariHariBol';

  @override
  String get splashTagline => 'पढ़ें · जप करें · साधना करें';

  @override
  String get actionRetry => 'फिर कोशिश करें';

  @override
  String get actionCancel => 'रद्द करें';

  @override
  String get actionOk => 'ठीक है';

  @override
  String get actionDone => 'हो गया';

  @override
  String get actionSave => 'सहेजें';

  @override
  String get actionViewAll => 'सभी देखें';

  @override
  String get actionSignOut => 'साइन आउट करें';

  @override
  String get actionDeleteAccount => 'खाता हटाएँ';

  @override
  String get actionContinue => 'आगे बढ़ें';

  @override
  String get errorGeneric => 'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।';

  @override
  String get errorNetwork =>
      'कनेक्शन नहीं है। अपना इंटरनेट जाँचें और फिर कोशिश करें।';

  @override
  String get errorTimeout => 'इसमें बहुत देर लग गई। कृपया फिर कोशिश करें।';

  @override
  String get errorSessionExpired =>
      'आपका सत्र समाप्त हो गया है। कृपया फिर से साइन इन करें।';

  @override
  String get errorSignIn =>
      'हम आपको साइन इन नहीं कर सके। कृपया फिर कोशिश करें।';

  @override
  String get errorInsecureConnection => 'कनेक्शन सुरक्षित नहीं है।';

  @override
  String get errorCancelled => 'अनुरोध रद्द किया गया।';

  @override
  String get errorEmptyTitle => 'यहाँ अभी कुछ नहीं है';

  @override
  String get errorRouteNotFound => 'वह स्क्रीन मौजूद नहीं है।';

  @override
  String get actionGoHome => 'होम पर जाएँ';

  @override
  String get signInTitle => 'स्वागत है';

  @override
  String get signInSubtitle =>
      'पढ़ें, जप करें और अपनी दैनिक साधना एक ही जगह रखें।';

  @override
  String get signInWithGoogle => 'Google के साथ जारी रखें';

  @override
  String get signInWithApple => 'Apple के साथ जारी रखें';

  @override
  String get signInCancelled => 'साइन-इन रद्द कर दिया गया।';

  @override
  String get signInFailed =>
      'हम आपको साइन इन नहीं कर सके। कृपया फिर कोशिश करें।';

  @override
  String get signInLegal =>
      'जारी रखकर आप हमारी सेवा की शर्तों और गोपनीयता नीति से सहमत होते हैं।';

  @override
  String languageStepOf(int current, int total) {
    return '$total में से चरण $current';
  }

  @override
  String get languageAppTitle => 'कौन-सी भाषा अपनी-सी लगती है?';

  @override
  String get languageAppSubtitle => 'आप इसे कभी भी सेटिंग्स में बदल सकते हैं।';

  @override
  String get languageMantraTitle => 'आप किस लिपि में जप करते हैं?';

  @override
  String get languageMantraSubtitle =>
      'मंत्र इसी लिपि में दिखेंगे। उनका अर्थ आपकी अपनी भाषा में ही रहेगा।';

  @override
  String get actionBack => 'वापस';

  @override
  String get tabHome => 'होम';

  @override
  String get tabSadhana => 'जप';

  @override
  String get tabLibrary => 'पढ़ें';

  @override
  String get tabRoutine => 'दिनचर्या';

  @override
  String get tabSakha => 'Sakha';

  @override
  String get reelsTitle => 'रील्स';

  @override
  String get tabSearch => 'खोजें';

  @override
  String get homeGreeting => 'हरि बोल';

  @override
  String homeGreetingNamed(String name) {
    return 'हरि बोल, $name';
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
  String get homeMoodPrompt => 'आज आप कैसे हैं?';

  @override
  String get homeMoodAnsweredToday =>
      'आपने आज बता दिया कि आप कैसा महसूस कर रहे हैं। कुछ नया बताने के लिए कल फिर आइए।';

  @override
  String homeMoodViewToday(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'आज के $count श्लोक फिर से पढ़ें',
      one: 'आज का श्लोक फिर से पढ़ें',
    );
    return '$_temp0';
  }

  @override
  String homeMoodSubmit(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'मुझे $count श्लोक दिखाएँ',
      one: 'मुझे एक श्लोक दिखाएँ',
    );
    return '$_temp0';
  }

  @override
  String get homeVerseOfTheDay => 'आज का श्लोक';

  @override
  String get homeSlokaForYou => 'आज आपके लिए';

  @override
  String get homeTodaysSadhana => 'आज की साधना';

  @override
  String get homeContinueReading => 'पढ़ना जारी रखें';

  @override
  String get homeBooks => 'ग्रंथ';

  @override
  String get homeMantras => 'मंत्र';

  @override
  String get homeStartYourDay => 'आज का लक्ष्य तय करें';

  @override
  String homeChantMantra(String mantra) {
    return '$mantra का जप करें';
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
  String get searchHint => 'श्लोक, मंत्र, ग्रंथ खोजें';

  @override
  String get searchPrompt => 'पूरे पुस्तकालय में खोजें, सीधे सर्वर से।';

  @override
  String get searchShortcutLabel => 'या सीधे किसी श्लोक पर जाएँ:';

  @override
  String get searchNoResults =>
      'कोई परिणाम नहीं। कोई दूसरा शब्द आज़माएँ, या BG 2.47 जैसा संदर्भ लिखें।';

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
    return '$target में से $done माला';
  }

  @override
  String sadhanaTasksProgress(int done, int total) {
    return '$total में से $done कार्य पूरे';
  }

  @override
  String sadhanaStreak(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: '$days दिन का सिलसिला',
      one: '1 दिन का सिलसिला',
      zero: 'अभी कोई सिलसिला नहीं',
    );
    return '$_temp0';
  }

  @override
  String get sadhanaGenericChant => 'जप';

  @override
  String sadhanaRoundsShort(int rounds) {
    return '$rounds माला';
  }

  @override
  String get sadhanaTodaysSessions => 'आज का जप';

  @override
  String get sadhanaNoSessionsYet => 'आज अभी कुछ दर्ज नहीं हुआ।';

  @override
  String get sadhanaRoundsEyebrow => 'आज की माला';

  @override
  String get sadhanaRoundsCaption => 'माला';

  @override
  String get sadhanaChantNow => 'अभी जप करें';

  @override
  String get sadhanaLogRounds => 'माला दर्ज करें';

  @override
  String get sadhanaLogRoundsSubtitle =>
      'आपकी माला पर किया गया जप, आज के कुल में जुड़ेगा।';

  @override
  String sadhanaLogRoundsSubmit(int rounds) {
    return '$rounds माला दर्ज करें';
  }

  @override
  String get sadhanaTargetReached => 'आज का लक्ष्य पूरा हुआ';

  @override
  String get sadhanaUndoBead => 'आख़िरी मनका वापस लें';

  @override
  String get sadhanaElapsedEyebrow => 'बीता समय';

  @override
  String get sadhanaPaceEyebrow => 'गति';

  @override
  String sadhanaElapsedSeconds(String seconds) {
    return '$seconds सेकंड';
  }

  @override
  String sadhanaPacePerMantra(String seconds) {
    return 'हर बार $seconds सेकंड';
  }

  @override
  String get sadhanaAutoCount => 'स्वचालित गिनती';

  @override
  String get sadhanaAutoCountOff => 'बंद — मनका खुद टैप करें';

  @override
  String get sadhanaAutoCountIdle => 'जप की प्रतीक्षा है';

  @override
  String get chantAutoCountLoading => 'स्वचालित गिनती तैयार हो रही है…';

  @override
  String get chantFullPicture => 'पूरी स्क्रीन की तस्वीर';

  @override
  String get chantPrayerHint =>
      'पहले यह प्रार्थना करें, फिर गिनती शुरू करने के लिए घेरे पर टैप करें।';

  @override
  String get sadhanaAutoCountListening => 'सुन रहा है…';

  @override
  String get sadhanaAutoCountCounted => 'गिना गया — अगले की प्रतीक्षा है';

  @override
  String get sadhanaAutoCountPermissionDenied =>
      'स्वचालित गिनती के लिए माइक्रोफ़ोन की अनुमति चाहिए';

  @override
  String get sadhanaAutoCountUnavailable => 'स्वचालित गिनती अभी उपलब्ध नहीं है';

  @override
  String get chantModelTitle => 'बेहतर सुनना';

  @override
  String chantModelOffer(int megabytes) {
    return 'संस्कृत कहीं बेहतर समझता है। $megabytes MB का एक डाउनलोड — Wi-Fi का उपयोग करें।';
  }

  @override
  String get chantModelDownload => 'डाउनलोड करें';

  @override
  String chantModelDownloading(int percent) {
    return 'डाउनलोड हो रहा है… $percent%';
  }

  @override
  String get chantModelCancel => 'रद्द करें';

  @override
  String get chantModelInstalled =>
      'डाउनलोड हो गया — अगली बार स्वचालित गिनती चालू करने पर उपयोग होगा';

  @override
  String get chantModelRemove => 'हटाएँ';

  @override
  String get chantModelFailed => 'डाउनलोड पूरा नहीं हुआ';

  @override
  String get chantModelRetry => 'फिर कोशिश करें';

  @override
  String get mantraAllCategories => 'सभी';

  @override
  String get mantraNoneInCategory => 'इस श्रेणी में अभी कोई मंत्र नहीं है।';

  @override
  String get mantraCategoryBeej => 'बीज मंत्र';

  @override
  String get mantraCategoryGayatri => 'गायत्री';

  @override
  String get mantraCategoryMahamantra => 'महामंत्र';

  @override
  String get mantraCategoryName => 'नाम मंत्र';

  @override
  String mantraStandardRounds(int rounds) {
    return '$rounds माला';
  }

  @override
  String mantraStandardCount(int count) {
    return '$count बार';
  }

  @override
  String get mantraHasAudio => 'पाठ उपलब्ध है';

  @override
  String get mantraPurport => 'तात्पर्य';

  @override
  String mantraMyRounds(int rounds) {
    return 'आप इसकी $rounds माला जप चुके हैं';
  }

  @override
  String get mantraChantThis => 'इसका जप करें';

  @override
  String get profileStatVersesSaved => 'सहेजे गए श्लोक';

  @override
  String get profileStatTotalRounds => 'कुल माला';

  @override
  String get profileStatChantingDays => 'जप के दिन';

  @override
  String get profileStatSlokasRead => 'पढ़े गए श्लोक';

  @override
  String get profileRecentFavorites => 'हाल के पसंदीदा';

  @override
  String get profileNoFavorites =>
      'अभी कुछ सहेजा नहीं गया। किसी श्लोक को बुकमार्क करें, वह यहाँ दिखेगा।';

  @override
  String get settingsTitle => 'सेटिंग्स';

  @override
  String get settingsSectionPractice => 'साधना';

  @override
  String get settingsSectionAccount => 'खाता';

  @override
  String get settingsLanguage => 'भाषा';

  @override
  String get settingsTheme => 'थीम';

  @override
  String get settingsDailyGoal => 'दैनिक लक्ष्य';

  @override
  String get settingsDailyGoalSubtitle =>
      'हर दिन कितनी माला का लक्ष्य रखना है। हर नया दिन इसी से शुरू होगा।';

  @override
  String settingsDailyGoalSubmit(int rounds) {
    return 'दैनिक लक्ष्य $rounds करें';
  }

  @override
  String get settingsPreferredMantra => 'पसंदीदा मंत्र';

  @override
  String get settingsPreferredMantraNone => 'तय नहीं है';

  @override
  String get settingsChooseMantraTitle => 'अपना मंत्र चुनें';

  @override
  String get settingsChooseMantraSubtitle =>
      '“अभी जप करें” इसी से खुलेगा। बाकी कुछ भी आप उसके अपने पेज से जप सकते हैं।';

  @override
  String get settingsNoMantraPreference => 'कोई पसंद नहीं — हर बार मुझसे पूछें';

  @override
  String get settingsPlans => 'प्लान और प्रीमियम';

  @override
  String get plansTitle => 'प्लान';

  @override
  String get plansSubtitle =>
      'पूरा ऐप मुफ़्त है। सशुल्क प्लान उसके ऊपर थोड़ा और जोड़ता है।';

  @override
  String get plansYourPlan => 'आपका प्लान';

  @override
  String get plansCurrent => 'मौजूदा प्लान';

  @override
  String get plansFreeForEveryone => 'सबके लिए मुफ़्त';

  @override
  String plansPricePer(String price, String period) {
    return '$price / $period';
  }

  @override
  String get plansPeriodWeek => 'सप्ताह';

  @override
  String get plansPeriodMonth => 'माह';

  @override
  String get plansPeriodYear => 'वर्ष';

  @override
  String plansPeriodDays(int days) {
    return '$days दिन';
  }

  @override
  String plansTrial(int days) {
    return '$days दिन का निःशुल्क ट्रायल';
  }

  @override
  String get plansSubscribe => 'सब्सक्राइब करें';

  @override
  String get plansStartTrial => 'निःशुल्क ट्रायल शुरू करें';

  @override
  String get plansRestore => 'खरीदारी बहाल करें';

  @override
  String get plansStoreUnavailable => 'इस डिवाइस पर स्टोर उपलब्ध नहीं है।';

  @override
  String get plansProductMissing => 'यह प्लान अभी स्टोर में उपलब्ध नहीं है।';

  @override
  String get plansPurchasePending => 'आपकी खरीदारी प्रोसेस हो रही है…';

  @override
  String get plansPurchaseSuccess => 'धन्यवाद — आपका प्लान चालू हो गया है।';

  @override
  String get plansPurchaseFailed => 'खरीदारी पूरी नहीं हो सकी।';

  @override
  String get plansPurchaseCancelled => 'खरीदारी रद्द की गई।';

  @override
  String plansRenews(String date) {
    return '$date को नवीनीकृत होगा';
  }

  @override
  String plansEnds(String date) {
    return '$date तक पहुँच';
  }

  @override
  String get plansPermanent =>
      'यह हमेशा के लिए आपका है — HariHariBol का सहयोग करने के लिए धन्यवाद।';

  @override
  String get plansIncluded => 'शामिल है';

  @override
  String get plansNotIncluded => 'शामिल नहीं है';

  @override
  String get plansUnlimited => 'असीमित';

  @override
  String plansLimit(int limit, String unit) {
    return '$limit $unit';
  }

  @override
  String plansSakhaReplies(int count) {
    return 'लगभग $count उत्तर प्रति माह';
  }

  @override
  String get plansNoFeatures =>
      'अभी कोई अतिरिक्त लाभ नहीं — और जल्द आ रहे हैं।';

  @override
  String get plansRestoreDone => 'खरीदारी बहाल हो गई।';

  @override
  String get settingsPrivacy => 'गोपनीयता नीति';

  @override
  String settingsVersion(String version) {
    return 'संस्करण $version';
  }

  @override
  String get settingsMadeWith => 'श्रद्धा के साथ बनाया गया';

  @override
  String settingsFooter(String version, String madeWith) {
    return '$version · $madeWith';
  }

  @override
  String get themeSystem => 'स्वचालित';

  @override
  String get themeLight => 'लाइट';

  @override
  String get themeDark => 'डार्क';

  @override
  String profileSignedInAs(String email) {
    return '$email के रूप में साइन इन';
  }

  @override
  String get profilePremium => 'प्रीमियम';

  @override
  String get profileFree => 'मुफ़्त';

  @override
  String get signOutConfirm =>
      'अपना साधना इतिहास देखने के लिए आपको फिर से साइन इन करना होगा।';

  @override
  String get deleteAccountTitle => 'अपना खाता हटाएँ?';

  @override
  String get deleteAccountBody =>
      'इससे आपका साधना इतिहास, पसंदीदा और सूचनाएँ हट जाएँगी। इसे वापस नहीं किया जा सकता।';

  @override
  String get comingSoon => 'जल्द आ रहा है';

  @override
  String get libraryNoBooks => 'अभी कोई ग्रंथ प्रकाशित नहीं हुआ।';

  @override
  String get libraryBookNotStarted =>
      'अभी शुरू नहीं किया। शुरू करने के लिए टैप करें।';

  @override
  String get actionEdit => 'संपादित करें';

  @override
  String get actionDelete => 'हटाएँ';

  @override
  String get libraryDownloadBook => 'ऑफ़लाइन पढ़ने के लिए डाउनलोड करें';

  @override
  String get libraryDownloading => 'डाउनलोड हो रहा है…';

  @override
  String get libraryDownloaded => 'ऑफ़लाइन पढ़ने के लिए डाउनलोड हो गया';

  @override
  String get libraryDownloadFailed =>
      'यह ग्रंथ डाउनलोड नहीं हो सका। कृपया फिर कोशिश करें।';

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
    return '$names द्वारा अनुवाद';
  }

  @override
  String get chapterPrevious => 'पिछला अध्याय';

  @override
  String get chapterNext => 'अगला अध्याय';

  @override
  String get actionBookmark => 'बुकमार्क करें';

  @override
  String get actionRemoveBookmark => 'बुकमार्क हटाएँ';

  @override
  String get actionHighlight => 'हाइलाइट करें';

  @override
  String get actionRemoveHighlight => 'हाइलाइट हटाएँ';

  @override
  String get verseExplanationLabel => 'व्याख्या';

  @override
  String get verseExplanationAiLabel => 'व्याख्या (AI की सहायता से)';

  @override
  String get verseWordMeanings => 'शब्दार्थ';

  @override
  String get verseCompareTranslations => 'अनुवादों की तुलना करें';

  @override
  String get verseTranslationsEmpty => 'अभी कोई और अनुवाद प्रकाशित नहीं हुआ।';

  @override
  String get verseRelatedTitle => 'संबंधित श्लोक';

  @override
  String get verseRelatedEmpty => 'अभी कोई संबंधित श्लोक नहीं है।';

  @override
  String get relationSameConcept => 'वही विषय';

  @override
  String get relationExpandsOn => 'इसका विस्तार';

  @override
  String get relationQuotedIn => 'इसमें उद्धृत';

  @override
  String get relationContrastsWith => 'इसके विपरीत';

  @override
  String get verseNotesTitle => 'मेरे नोट्स';

  @override
  String get verseNoteHint => 'नोट लिखें…';

  @override
  String get verseNoteAdd => 'नोट जोड़ें';

  @override
  String get verseNoteEmpty => 'इस श्लोक पर अभी कोई नोट नहीं है।';

  @override
  String get verseNoteDeleteConfirm => 'यह नोट हटाएँ?';

  @override
  String get readingSettingsTitle => 'पढ़ने की सेटिंग्स';

  @override
  String get readingContents => 'विषय-सूची';

  @override
  String get readingFontSizeLabel => 'अक्षर का आकार';

  @override
  String get readingFontSizeSmall => 'छोटा';

  @override
  String get readingFontSizeMedium => 'मध्यम';

  @override
  String get readingFontSizeLarge => 'बड़ा';

  @override
  String get readingFontSizeExtraLarge => 'बहुत बड़ा';

  @override
  String get readingLanguageLabel => 'पढ़ने की भाषा';

  @override
  String get readingHideLabel => 'श्लोकों में छिपाएँ';

  @override
  String get readingHideSanskrit => 'संस्कृत';

  @override
  String get readingHideTransliteration => 'लिप्यंतरण';

  @override
  String get readingModeLabel => 'पढ़ने का ढंग';

  @override
  String get readingModeVerses => 'श्लोक-दर-श्लोक';

  @override
  String get readingModeStory => 'कथा';

  @override
  String get readingStoryShowLabel => 'कथा में दिखाएँ';

  @override
  String get readingStoryNumbers => 'श्लोक संख्या';

  @override
  String get readingStoryHint =>
      'किसी श्लोक को दबाए रखें — उसे सुनने, बुकमार्क करने, हाइलाइट करने या नोट जोड़ने के लिए।';

  @override
  String get readingStoryNothing =>
      'इस अध्याय में चुने हुए भाग के लिए कुछ नहीं है। ऊपर से कोई दूसरा चुनें।';

  @override
  String get readingPartMeaning => 'अर्थ';

  @override
  String get routineSubtitle => 'भक्ति, काम और बीच के साधारण पल।';

  @override
  String routineProgress(int done, int total) {
    return '$total में से $done पूरे';
  }

  @override
  String get routineEmptyBody =>
      'एक माला, कोई काम, कोई घरेलू कार्य जोड़ें — आज का दिन संकल्प के साथ बनाएँ।';

  @override
  String get routineAddTask => 'कार्य जोड़ें';

  @override
  String get routineTaskHint => 'क्या करना है?';

  @override
  String get routineCategoryLabel => 'श्रेणी';

  @override
  String get routineCategoryDevotion => 'भक्ति';

  @override
  String get routineCategoryWork => 'काम';

  @override
  String get routineCategoryHome => 'घर';

  @override
  String get routineCategoryErrand => 'बाहर का काम';

  @override
  String get routineSlotMorning => 'सुबह';

  @override
  String get routineSlotAfternoon => 'दोपहर';

  @override
  String get routineSlotEvening => 'शाम';

  @override
  String get routineSlotAnytime => 'कभी भी';

  @override
  String get routinePresetWakeUp => 'जागना';

  @override
  String get routinePresetMorningChant => 'सुबह का जप';

  @override
  String get routinePresetExercise => 'व्यायाम';

  @override
  String get routinePresetBreakfast => 'नाश्ता';

  @override
  String get routinePresetLunch => 'दोपहर का भोजन';

  @override
  String get routinePresetEveningChant => 'शाम का जप';

  @override
  String get routinePresetDinner => 'रात का भोजन';

  @override
  String get routinePresetScriptureReading => 'शास्त्र पाठ';

  @override
  String get routinePresetSleep => 'सोना';

  @override
  String get routineTaskNameLabel => 'कार्य का नाम';

  @override
  String get routineWindowHeading => 'निर्धारित समय';

  @override
  String get routineWindowHint =>
      'इस अवधि में किया तो समय पर, उससे पहले जल्दी और उसके बाद देर से गिना जाता है।';

  @override
  String get routineWindowSet => 'समय-सीमा तय करें';

  @override
  String get routineWindowClear => 'समय-सीमा हटाएँ';

  @override
  String get routineWindowFrom => 'से';

  @override
  String get routineWindowTo => 'तक';

  @override
  String routineWindowRange(String start, String end) {
    return '$start – $end';
  }

  @override
  String get routineWindowInvalid =>
      'समाप्ति का समय आरंभ के बाद का होना चाहिए।';

  @override
  String get routineStatusNotDone => 'पूरा नहीं हुआ';

  @override
  String get routineStatusDone => 'पूरा हुआ';

  @override
  String get routineStatusEarly => 'जल्दी';

  @override
  String get routineStatusOnTime => 'समय पर';

  @override
  String get routineStatusLate => 'देर से';

  @override
  String routineStatusAtTime(String status, String time) {
    return '$status · $time';
  }

  @override
  String get routineChangeTime => 'समय बदलें';

  @override
  String get routinePickDoneTime => 'यह कब पूरा हुआ?';

  @override
  String get routineSaveAction => 'इस दिन में जोड़ें';

  @override
  String get routineTaskRemoved => 'इस दिन से हटाया गया';

  @override
  String get routineUndo => 'पूर्ववत करें';

  @override
  String get routineToday => 'आज';

  @override
  String get routineJumpToToday => 'आज पर जाएँ';

  @override
  String get routineEkadashi => 'एकादशी';

  @override
  String get routineEkadashiNote =>
      'अनुमानित — किसी मंदिर का पंचांग एक दिन अलग हो सकता है।';

  @override
  String routineDayLabel(String date, String ekadashi, int done, int total) {
    String _temp0 = intl.Intl.selectLogic(ekadashi, {
      'yes': ' · एकादशी',
      'other': '',
    });
    String _temp1 = intl.Intl.pluralLogic(
      total,
      locale: localeName,
      other: ' · $total में से $done पूरे',
      zero: '',
    );
    return '$date$_temp0$_temp1';
  }

  @override
  String get routineNothingPlanned => 'इस दिन के लिए कुछ तय नहीं है।';

  @override
  String get routineManageDaily => 'दैनिक दिनचर्या';

  @override
  String get routineDailyTitle => 'दैनिक दिनचर्या';

  @override
  String get routineDailyBody =>
      'वैकल्पिक। ये हर दिन दोहराए जाते हैं, और हर दिन नया टिक होता है।';

  @override
  String get routineDailyEmpty => 'अभी कोई दैनिक दिनचर्या नहीं है।';

  @override
  String get routineDailyAdd => 'दैनिक दिनचर्या में जोड़ें';

  @override
  String get routineDailySaveAction => 'हर दिन में जोड़ें';

  @override
  String get routineDailyBadge => 'दैनिक';

  @override
  String get routineDailyRemove => 'दैनिक दिनचर्या से हटाएँ';

  @override
  String get routineDailyRemoved => 'आपकी दैनिक दिनचर्या से हटाया गया';

  @override
  String get reelsEmpty => 'अभी कोई रील नहीं';

  @override
  String get reelsEmptyBody =>
      'जब क्रिएटर पोस्ट करना शुरू करेंगे, उनकी रील्स यहाँ दिखेंगी।';

  @override
  String get reelsFailed => 'रील्स लोड नहीं हो सकीं';

  @override
  String get reelsRetry => 'फिर कोशिश करें';

  @override
  String get reelFollow => 'फ़ॉलो करें';

  @override
  String get reelFollowing => 'फ़ॉलो कर रहे हैं';

  @override
  String get reelLike => 'पसंद करें';

  @override
  String get reelUnlike => 'पसंद हटाएँ';

  @override
  String get reelComment => 'टिप्पणी';

  @override
  String get reelShare => 'साझा करें';

  @override
  String get reelSave => 'सहेजें';

  @override
  String get reelUnsave => 'सहेजे हुए से हटाएँ';

  @override
  String get reelSaved => 'सहेजा गया';

  @override
  String get reelRemovedFromSaved => 'सहेजे हुए से हटाया गया';

  @override
  String get reelMore => 'अन्य विकल्प';

  @override
  String get reelMuted => 'आवाज़ बंद';

  @override
  String get reelUnmuted => 'आवाज़ चालू';

  @override
  String get reelPlay => 'चलाएँ';

  @override
  String get reelPause => 'रोकें';

  @override
  String get reelVideoUnavailable => 'यह वीडियो अभी प्रोसेस हो रहा है।';

  @override
  String get reelAudioUnavailable => 'यह पाठ अभी प्रोसेस हो रहा है।';

  @override
  String get reelSimilar => 'इसी तरह की और रील्स';

  @override
  String get reelSimilarEmpty => 'अभी कोई मिलती-जुलती रील नहीं है।';

  @override
  String reelSlideOf(int current, int total) {
    return '$total में से $current';
  }

  @override
  String get reelBookGita => 'BG';

  @override
  String get reelBookBhagavatam => 'SB';

  @override
  String get reelCaptionMore => 'और देखें';

  @override
  String get reelCaptionLess => 'कम देखें';

  @override
  String get reelCommentsTitle => 'टिप्पणियाँ';

  @override
  String reelCommentsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count टिप्पणियाँ',
      one: '1 टिप्पणी',
      zero: 'अभी कोई टिप्पणी नहीं',
    );
    return '$_temp0';
  }

  @override
  String get reelCommentsEmpty => 'सबसे पहले कुछ कहिए।';

  @override
  String get reelCommentHint => 'टिप्पणी जोड़ें…';

  @override
  String reelReplyHint(String name) {
    return '$name को जवाब दें…';
  }

  @override
  String get reelCommentSend => 'पोस्ट करें';

  @override
  String get reelCommentReply => 'जवाब दें';

  @override
  String get reelCommentDelete => 'हटाएँ';

  @override
  String get reelCommentReport => 'रिपोर्ट करें';

  @override
  String get reelCommentPin => 'पिन करें';

  @override
  String get reelCommentUnpin => 'पिन हटाएँ';

  @override
  String get reelCommentPinned => 'पिन किया गया';

  @override
  String get reelCommentRemoved => 'यह टिप्पणी हटा दी गई।';

  @override
  String get reelCommentDeleted => 'टिप्पणी हटा दी गई';

  @override
  String get reelCommentDeleteTitle => 'यह टिप्पणी हटाएँ?';

  @override
  String get reelCommentDeleteBody =>
      'यह सबके लिए, इसके सभी जवाबों के साथ हट जाएगी।';

  @override
  String get reelCommentCancelReply => 'जवाब रद्द करें';

  @override
  String reelViewReplies(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count जवाब देखें',
      one: '1 जवाब देखें',
    );
    return '$_temp0';
  }

  @override
  String get reelHideReplies => 'जवाब छिपाएँ';

  @override
  String get reelLoadMoreComments => 'और टिप्पणियाँ लोड करें';

  @override
  String get reelReportTitle => 'इस रील की रिपोर्ट करें';

  @override
  String get reelReportCommentTitle => 'इस टिप्पणी की रिपोर्ट करें';

  @override
  String get reelReportBody =>
      'बताइए इसमें क्या गलत है। एक मॉडरेटर इसकी समीक्षा करेगा।';

  @override
  String get reelReportSpam => 'स्पैम या भ्रामक';

  @override
  String get reelReportHarassment => 'उत्पीड़न या अपमानजनक';

  @override
  String get reelReportNonDevotional => 'भक्ति से जुड़ी सामग्री नहीं';

  @override
  String get reelReportMisinformation => 'गलत जानकारी';

  @override
  String get reelReportSexualOrViolent => 'यौन या हिंसक';

  @override
  String get reelReportOther => 'कुछ और';

  @override
  String get reelReportNoteHint => 'और कुछ जो हमें जानना चाहिए? (वैकल्पिक)';

  @override
  String get reelReportSubmit => 'रिपोर्ट करें';

  @override
  String get reelReportThanks => 'धन्यवाद। एक मॉडरेटर इसे देखेगा।';

  @override
  String get reelShareTitle => 'इस रील को साझा करें';

  @override
  String reelShareMessage(String caption, String link) {
    return '$caption\n\nHariHariBol पर देखें: $link';
  }

  @override
  String get reelCopyLink => 'लिंक कॉपी करें';

  @override
  String get reelLinkCopied => 'लिंक कॉपी हो गया';

  @override
  String get creatorTitle => 'क्रिएटर';

  @override
  String creatorFollowers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count फ़ॉलोअर',
      one: '1 फ़ॉलोअर',
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
      other: '$count व्यू',
      one: '1 व्यू',
    );
    return '$_temp0';
  }

  @override
  String get creatorStatFollowers => 'फ़ॉलोअर';

  @override
  String get creatorStatReels => 'रील्स';

  @override
  String get creatorStatViews => 'व्यू';

  @override
  String get creatorVerified => 'सत्यापित क्रिएटर';

  @override
  String get creatorNoReels => 'अभी कुछ पोस्ट नहीं हुआ।';

  @override
  String get creatorNotFound => 'वह क्रिएटर अब यहाँ नहीं है।';

  @override
  String get chantAnalyticsTooltip => 'विश्लेषण और इतिहास';

  @override
  String get chantSittingTime => 'बैठक का समय';

  @override
  String chantMalaTime(int number) {
    return 'माला $number का समय';
  }

  @override
  String get chantStatCurrentMala => 'वर्तमान माला';

  @override
  String get chantStatCount => 'गिनती';

  @override
  String get chantStatMalasDone => 'पूरी हुई माला';

  @override
  String get chantStatAvgMala => 'प्रति माला औसत';

  @override
  String get chantStatAvgChant => 'प्रति जप औसत';

  @override
  String get chantStatTotalChants => 'कुल जप';

  @override
  String get chantStatFastestMala => 'सबसे तेज़ माला';

  @override
  String get chantStatTotalTime => 'कुल समय';

  @override
  String get chantNoValue => '—';

  @override
  String get chantRecentTitle => 'हाल के जप';

  @override
  String get chantRecentEmpty => 'शुरू करने के लिए घेरे पर टैप करें।';

  @override
  String chantTapNumber(int seq) {
    return '#$seq';
  }

  @override
  String get chantAutoBadge => 'स्वचालित';

  @override
  String get chantDetectWords => 'शब्द पहचानें';

  @override
  String get chantDetectWordsOff => 'बंद — शब्द दर्ज नहीं होते';

  @override
  String get chantDetectWordsListening => 'शब्द सुन रहा है…';

  @override
  String get chantDetectWordsPermission => 'माइक्रोफ़ोन की अनुमति चाहिए';

  @override
  String get chantDetectWordsStarting => 'तैयार हो रहा है…';

  @override
  String get chantDetectWordsUnavailable =>
      'इस डिवाइस पर शब्द पहचान उपलब्ध नहीं है';

  @override
  String get chantDetectWordsNote =>
      'शब्द आपके फ़ोन पर ही पहचाने जाते हैं, और ऑडियो कभी रिकॉर्ड नहीं होता। टेक्स्ट 7 दिन रखा जाता है, फिर हटा दिया जाता है।';

  @override
  String get chantSetupTitle => 'जप के सहायक';

  @override
  String get chantSetupSubtitle =>
      'चुनें कि यह बैठक कैसे गिनी और दर्ज की जाए। सुनना आपके फ़ोन पर ही होता है।';

  @override
  String get chantSetupButton => 'स्वचालित गिनती और शब्द';

  @override
  String get chantSetupNoneOn => 'सेट अप करें';

  @override
  String chantSetupOn(int count) {
    return '$count चालू';
  }

  @override
  String chantSetupButtonState(String button, String state) {
    return '$button · $state';
  }

  @override
  String get chantSetupDone => 'हो गया';

  @override
  String get chantAnalyticsTitle => 'जप विश्लेषण';

  @override
  String get chantTabThisSitting => 'यह बैठक';

  @override
  String get chantTabHistory => 'इतिहास';

  @override
  String chantMalaTitle(int number) {
    return 'माला $number';
  }

  @override
  String get chantMalaInProgress => 'जारी है';

  @override
  String get chantMalaStart => 'आरंभ';

  @override
  String get chantMalaEnd => 'समाप्त';

  @override
  String get chantMalaDuration => 'अवधि';

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
  String get chantTapsHeader => 'हर जप';

  @override
  String get chantHeardLabel => 'सुना गया';

  @override
  String get chantNoMalasYet =>
      'इस बैठक में अभी कोई जप नहीं हुआ। आप जो भी माला पूरी करेंगे, वह उसके आरंभ, समाप्ति और लगे समय के साथ यहाँ दिखेगी।';

  @override
  String get chantHistoryEmpty => 'अभी कोई पिछली बैठक नहीं है।';

  @override
  String chantHistorySummary(int malas, int chants) {
    return '$malas माला · $chants जप';
  }

  @override
  String get chantHistoryNoDetail => 'जप का समय दर्ज होने से पहले गिना गया';

  @override
  String get chantSessionTitle => 'बैठक';

  @override
  String get chantSessionNoMalas =>
      'इस बैठक में कोई समयबद्ध माला दर्ज नहीं हुई।';

  @override
  String get chantHeardExpiry =>
      'सुने गए शब्द बैठक के 7 दिन बाद आपके खाते से हटा दिए जाते हैं।';

  @override
  String get chantHeardTitle => 'अभी सुना गया';

  @override
  String get chantHeardHearing => 'आपको सुन रहा है…';

  @override
  String get chantHeardWaiting => 'आपकी आवाज़ की प्रतीक्षा है';

  @override
  String get chantHeardPlaceholder =>
      'ज़ोर से जप करें। आपके फ़ोन को जो शब्द सुनाई देंगे, वे यहाँ दिखेंगे।';

  @override
  String get chantHeardLast => 'आख़िरी बार सुना';

  @override
  String chantHeardCounted(int count) {
    return 'गिना गया +$count';
  }

  @override
  String get chantHeardNotCounted => 'नहीं गिना गया';

  @override
  String chantHeardMatch(int percent, int needed) {
    return '$percent% मेल · ज़रूरी $needed%';
  }

  @override
  String chantHeardMatchShort(int percent) {
    return '$percent% मेल';
  }

  @override
  String get chantHeardEarlier => 'पहले का';

  @override
  String get chantAlongTitle => 'साथ में जप करें';

  @override
  String get chantAlongCaption =>
      'काउंटर रिकॉर्डिंग के साथ गिनता है। इसके चलने तक स्वचालित गिनती और शब्द पहचान विश्राम में रहते हैं।';

  @override
  String get chantAlongPlay => 'रिकॉर्डिंग चलाएँ';

  @override
  String get chantAlongPause => 'रिकॉर्डिंग रोकें';

  @override
  String get chantAlongPosition => 'रिकॉर्डिंग में स्थान';

  @override
  String get chantAlongLoading => 'रिकॉर्डिंग लोड हो रही है…';

  @override
  String get chantAlongLoadFailed => 'रिकॉर्डिंग लोड नहीं हो सकी।';

  @override
  String get settingsSectionLanguages => 'भाषाएँ';

  @override
  String get settingsLanguageApp => 'ऐप की भाषा';

  @override
  String get settingsLanguageAppHint => 'मेन्यू, बटन और लेबल';

  @override
  String get settingsLanguageReading => 'पढ़ने की भाषा';

  @override
  String get settingsLanguageReadingHint => 'अनुवाद, अर्थ और तात्पर्य';

  @override
  String get settingsLanguageSpeaking => 'बोलने और सुनने की भाषा';

  @override
  String get settingsLanguageSpeakingHint => 'ऑडियो और बोला गया अर्थ';

  @override
  String get settingsLanguagePickerApp => 'ऐप की भाषा चुनें';

  @override
  String get settingsLanguagePickerReading => 'पढ़ने की भाषा चुनें';

  @override
  String get settingsLanguagePickerSpeaking => 'बोलने की भाषा चुनें';

  @override
  String get settingsLanguageSanskritNote =>
      'संस्कृत श्लोक हमेशा संस्कृत में ही रहते हैं।';

  @override
  String get readingAudioPlayAll => 'पढ़कर सुनाएँ';

  @override
  String get readingAudioPlayVerse => 'यह श्लोक सुनें';

  @override
  String get readingAudioPause => 'रोकें';

  @override
  String get readingAudioResume => 'फिर शुरू करें';

  @override
  String get readingAudioStop => 'बंद करें';

  @override
  String get readingAudioNext => 'अगला श्लोक';

  @override
  String get readingAudioPrevious => 'पिछला श्लोक';

  @override
  String get readingAudioFromStart => 'शुरुआत से';

  @override
  String readingAudioResumeFrom(int number) {
    return 'श्लोक $number से जारी रखें';
  }

  @override
  String readingAudioNowPlaying(String section, int number) {
    return '$section · श्लोक $number';
  }

  @override
  String get readingAudioLoading => 'लोड हो रहा है…';

  @override
  String get readingAudioChannel => 'पढ़कर सुनाना';

  @override
  String get pushChannelName => 'दैनिक श्लोक और सूचनाएँ';

  @override
  String get readingSectionVerse => 'श्लोक';

  @override
  String get readingSectionMeaning => 'अर्थ';

  @override
  String get readingSectionPurport => 'तात्पर्य';

  @override
  String get settingsVoices => 'आवाज़ें';

  @override
  String settingsVoicesValue(int count) {
    return '$count इंस्टॉल';
  }

  @override
  String get voicesTitle => 'आवाज़ें';

  @override
  String get voicesIntro =>
      'अर्थ और तात्पर्य आपकी बोलने की भाषा में पढ़कर सुनाए जाते हैं। आवाज़ डाउनलोड होने तक आपके फ़ोन की अपनी आवाज़ इस्तेमाल होती है, इसलिए पढ़ना कभी रुकता नहीं।';

  @override
  String voicesStorage(String size) {
    return 'इस फ़ोन पर $size उपयोग में';
  }

  @override
  String get voicesEmpty =>
      'डाउनलोड के लिए अभी कोई आवाज़ उपलब्ध नहीं है। आपके फ़ोन की अपनी आवाज़ इस्तेमाल होती है।';

  @override
  String get voiceDownload => 'डाउनलोड करें';

  @override
  String get voiceDelete => 'हटाएँ';

  @override
  String get voiceCancel => 'रद्द करें';

  @override
  String get voiceRetry => 'फिर कोशिश करें';

  @override
  String voiceInstalled(String size) {
    return 'इंस्टॉल है · $size';
  }

  @override
  String voiceNotInstalled(String size) {
    return 'डाउनलोड नहीं है · $size';
  }

  @override
  String voiceDownloading(int percent) {
    return 'डाउनलोड हो रहा है $percent%';
  }

  @override
  String get voiceVerifying => 'जाँच हो रही है…';

  @override
  String get voiceExtracting => 'इंस्टॉल हो रहा है…';

  @override
  String get voiceFailed => 'यह आवाज़ इंस्टॉल नहीं हो सकी';

  @override
  String get voiceUnavailable =>
      'अभी उपलब्ध नहीं · आपके फ़ोन की आवाज़ इस्तेमाल होगी';

  @override
  String get voiceDeleteTitle => 'यह आवाज़ हटाएँ?';

  @override
  String get voiceDeleteBody =>
      'इसे फिर से डाउनलोड किया जा सकता है। तब तक आपके फ़ोन की अपनी आवाज़ इस्तेमाल होगी।';

  @override
  String voiceLanguages(String languages) {
    return '$languages बोलती है';
  }

  @override
  String labelVerseWithSection(int number, String section) {
    return 'श्लोक $number · $section';
  }

  @override
  String get chatTitle => 'Sakha से पूछें';

  @override
  String get chatHomeTitle => 'Sakha से पूछें';

  @override
  String get chatHomeBody => 'शास्त्र, मंत्र और आपकी साधना पर प्रश्न';

  @override
  String get chatIntroTitle => 'आपका मित्र Sakha';

  @override
  String get chatIntroHint =>
      'किसी श्लोक, मंत्र या अपनी साधना के बारे में पूछें।';

  @override
  String get chatComposerHint => 'प्रश्न पूछें';

  @override
  String get chatSend => 'भेजें';

  @override
  String get chatStop => 'रोकें';

  @override
  String chatCharacterCount(int count, int max) {
    return '$count / $max';
  }

  @override
  String chatCreditsLeft(int percent) {
    return '$percent% शेष';
  }

  @override
  String chatCreditsLeftLevel(int percent, String level) {
    return '$percent% शेष · $level';
  }

  @override
  String get chatCreditsResetsMidnight => 'आधी रात को रीसेट होगा';

  @override
  String chatCreditsRenews(DateTime date) {
    final intl.DateFormat dateDateFormat = intl.DateFormat('d MMM', localeName);
    final String dateString = dateDateFormat.format(date);

    return 'नवीनीकरण: $dateString';
  }

  @override
  String get chatNotAvailableTitle => 'चैट आपके प्लान में शामिल नहीं है';

  @override
  String get chatNotAvailableBody =>
      'Sakha से प्रश्न पूछने के लिए अपना प्लान अपग्रेड करें।';

  @override
  String get chatExhaustedDailyTitle => 'आज के क्रेडिट समाप्त हो गए हैं';

  @override
  String get chatExhaustedDailyBody =>
      'वे आधी रात को फिर भर जाएँगे। तब आप आगे बढ़ सकते हैं, या और के लिए अपग्रेड करें।';

  @override
  String get chatExhaustedWalletTitle => 'आपके क्रेडिट समाप्त हो गए हैं';

  @override
  String get chatExhaustedWalletBody =>
      'वे आपके प्लान के साथ नवीनीकृत होते हैं। आप प्रतीक्षा कर सकते हैं, या जारी रखने के लिए अपग्रेड करें।';

  @override
  String get chatShareUsedTitle =>
      'इस चैट ने अपने हिस्से के क्रेडिट उपयोग कर लिए हैं';

  @override
  String get chatShareUsedBody =>
      'नई चैट शुरू करें, Sakha वहीं से आगे बढ़ेगा जहाँ आप थे।';

  @override
  String get chatUpgrade => 'अपग्रेड करें';

  @override
  String get chatStartNewChat => 'नई चैट शुरू करें';

  @override
  String get chatFullTitle => 'यह चैट बहुत लंबी हो गई है';

  @override
  String get chatFullBody =>
      'नई चैट शुरू करें, Sakha हमारी बातचीत को आगे ले जाएगा।';

  @override
  String get chatContinuePartial =>
      'आपके हाल के संदेशों का सार नहीं बनाया जा सका, इसलिए केवल पहले का भाग साथ आया।';

  @override
  String get chatTidying => 'हमारी बातचीत समेटी जा रही है…';

  @override
  String get chatTyping => 'Sakha लिख रहा है';

  @override
  String get chatConnectionLost =>
      'कनेक्शन बीच में टूट गया। कृपया फिर कोशिश करें।';

  @override
  String get chatReplyFailed =>
      'Sakha वह उत्तर पूरा नहीं कर सका। कृपया फिर कोशिश करें।';

  @override
  String get chatOverloaded =>
      'Sakha अभी व्यस्त है। कृपया थोड़ी देर में फिर कोशिश करें।';

  @override
  String get chatUnavailable =>
      'Sakha अभी उपलब्ध नहीं है। कृपया कुछ देर बाद फिर कोशिश करें।';

  @override
  String get chatBusy => 'कृपया वर्तमान उत्तर पूरा होने तक प्रतीक्षा करें।';

  @override
  String get chatTooLong => 'यह संदेश बहुत लंबा है। कृपया इसे छोटा करें।';

  @override
  String get chatStopped => 'रोका गया';

  @override
  String get chatInterrupted => 'बाधित';

  @override
  String get chatCopy => 'कॉपी करें';

  @override
  String get chatCopied => 'कॉपी हो गया';

  @override
  String get chatShare => 'साझा करें';

  @override
  String get chatRegenerate => 'फिर से उत्तर दें';

  @override
  String get chatLinkCopied => 'लिंक कॉपी हो गया';

  @override
  String get chatImageUnavailable => 'चित्र उपलब्ध नहीं है';

  @override
  String get chatClearTooltip => 'चैट साफ़ करें';

  @override
  String get chatClearTitle => 'यह चैट साफ़ करें?';

  @override
  String get chatClearBody =>
      'आपके संदेश और Sakha के दिए उत्तर हट जाएँगे, और Sakha को हमारी बातचीत याद नहीं रहेगी। उपयोग हो चुके क्रेडिट वापस नहीं मिलते।';

  @override
  String get chatClearConfirm => 'साफ़ करें';

  @override
  String get chatCleared => 'चैट साफ़ हो गई';

  @override
  String get chatSuggestionsLabel => 'ये पूछकर देखें';

  @override
  String get chatStarter1Title => 'जीवन के लिए एक श्लोक';

  @override
  String get chatStarter1Prompt =>
      'मुझे भगवद्गीता 2.47 समझाइए — फल की चिंता किए बिना अपना कर्तव्य निभाना।';

  @override
  String get chatStarter2Title => 'जप की शुरुआत';

  @override
  String get chatStarter2Prompt =>
      'हरे कृष्ण महामंत्र का जप कैसे शुरू करूँ, और शुरुआत में कितनी माला करनी चाहिए?';

  @override
  String get chatStarter3Title => 'रोज़ की साधना';

  @override
  String get chatStarter3Prompt =>
      'कोई सरल दैनिक साधना सुझाइए, जो व्यस्त दिन में भी निभाई जा सके।';

  @override
  String get chatStarter4Title => 'जब मन बेचैन हो';

  @override
  String get chatStarter4Prompt =>
      'मेरा मन बेचैन है। शांति पाने के बारे में शास्त्र क्या कहते हैं?';

  @override
  String get chatStarter5Title => 'सुनने योग्य एक कथा';

  @override
  String get chatStarter5Prompt =>
      'मुझे प्रह्लाद की कथा सुनाइए और बताइए कि उससे क्या शिक्षा मिलती है।';

  @override
  String get chatFollowUp1 => 'सरल शब्दों में समझाएँ';

  @override
  String get chatFollowUp2 => 'एक उदाहरण दें';

  @override
  String get chatFollowUp3 => 'यह क्यों महत्त्वपूर्ण है?';

  @override
  String get chatFollowUp4 => 'इसका अभ्यास कैसे करूँ?';

  @override
  String get chatAttach => 'तस्वीर जोड़ें';

  @override
  String get chatAttachCamera => 'फ़ोटो खींचें';

  @override
  String get chatAttachGallery => 'अपनी फ़ोटो में से चुनें';

  @override
  String get chatAttachNote =>
      'तस्वीर उत्तर लिखने में मदद करने वाली सेवा को भेजी जाती है, और चैट साफ़ करने तक यहीं रहती है।';

  @override
  String get chatImageRemove => 'तस्वीर हटाएँ';

  @override
  String get chatImageUploading => 'तस्वीर जोड़ी जा रही है…';

  @override
  String get chatImageFailed =>
      'तस्वीर जोड़ी नहीं जा सकी। दोबारा कोशिश करने के लिए छुएँ।';

  @override
  String get chatImageRejected =>
      'यह तस्वीर उपयोग नहीं की जा सकती। कृपया कोई दूसरी चुनें।';

  @override
  String get chatImageOff => 'आपके प्लान में तस्वीरें उपलब्ध नहीं हैं।';

  @override
  String get chatImageSemantics => 'आपकी भेजी तस्वीर';

  @override
  String get chatPictureDenied =>
      'तस्वीर जोड़ने के लिए फ़ोन की सेटिंग में कैमरा या फ़ोटो की अनुमति दें।';

  @override
  String get chatMic => 'बोलकर प्रश्न पूछें';

  @override
  String get chatMicStop => 'सुनना रोकें';

  @override
  String get chatListening => 'बोलिए…';

  @override
  String get chatMicDenied =>
      'बोलने के लिए फ़ोन की सेटिंग में माइक्रोफ़ोन और स्पीच रिकग्निशन की अनुमति दें।';

  @override
  String get chatMicUnavailable => 'इस फ़ोन पर बोलकर लिखना उपलब्ध नहीं है।';

  @override
  String get chatMicNoSpeech => 'कुछ सुनाई नहीं दिया। कृपया फिर कोशिश करें।';

  @override
  String get chatMicFailed => 'सुनना रुक गया। कृपया फिर कोशिश करें।';

  @override
  String get chatJumpToLatest => 'नवीनतम';
}
