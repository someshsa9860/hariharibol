import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_as.dart';
import 'app_localizations_bn.dart';
import 'app_localizations_en.dart';
import 'app_localizations_gu.dart';
import 'app_localizations_hi.dart';
import 'app_localizations_kn.dart';
import 'app_localizations_ml.dart';
import 'app_localizations_mr.dart';
import 'app_localizations_or.dart';
import 'app_localizations_pa.dart';
import 'app_localizations_ta.dart';
import 'app_localizations_te.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('as'),
    Locale('bn'),
    Locale('en'),
    Locale('gu'),
    Locale('hi'),
    Locale('kn'),
    Locale('ml'),
    Locale('mr'),
    Locale('or'),
    Locale('pa'),
    Locale('ta'),
    Locale('te'),
  ];

  /// The application name.
  ///
  /// In en, this message translates to:
  /// **'HariHariBol'**
  String get appName;

  /// The line under the logo while the app opens. Shown in capitals, so write it in ordinary case.
  ///
  /// In en, this message translates to:
  /// **'Read · Chant · Practice'**
  String get splashTagline;

  /// No description provided for @actionRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get actionRetry;

  /// No description provided for @actionCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get actionCancel;

  /// No description provided for @actionOk.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get actionOk;

  /// No description provided for @actionDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get actionDone;

  /// No description provided for @actionSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get actionSave;

  /// No description provided for @actionViewAll.
  ///
  /// In en, this message translates to:
  /// **'View all'**
  String get actionViewAll;

  /// No description provided for @actionSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get actionSignOut;

  /// No description provided for @actionDeleteAccount.
  ///
  /// In en, this message translates to:
  /// **'Delete account'**
  String get actionDeleteAccount;

  /// No description provided for @actionContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get actionContinue;

  /// No description provided for @errorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorGeneric;

  /// No description provided for @errorNetwork.
  ///
  /// In en, this message translates to:
  /// **'No connection. Check your internet and try again.'**
  String get errorNetwork;

  /// No description provided for @errorTimeout.
  ///
  /// In en, this message translates to:
  /// **'That took too long. Please try again.'**
  String get errorTimeout;

  /// No description provided for @errorSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'Your session has ended. Please sign in again.'**
  String get errorSessionExpired;

  /// No description provided for @errorSignIn.
  ///
  /// In en, this message translates to:
  /// **'We could not sign you in. Please try again.'**
  String get errorSignIn;

  /// No description provided for @errorInsecureConnection.
  ///
  /// In en, this message translates to:
  /// **'The connection is not secure.'**
  String get errorInsecureConnection;

  /// No description provided for @errorCancelled.
  ///
  /// In en, this message translates to:
  /// **'Request cancelled.'**
  String get errorCancelled;

  /// No description provided for @errorEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'Nothing here yet'**
  String get errorEmptyTitle;

  /// No description provided for @errorRouteNotFound.
  ///
  /// In en, this message translates to:
  /// **'That screen does not exist.'**
  String get errorRouteNotFound;

  /// No description provided for @actionGoHome.
  ///
  /// In en, this message translates to:
  /// **'Go to home'**
  String get actionGoHome;

  /// No description provided for @signInTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get signInTitle;

  /// No description provided for @signInSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Read, chant and keep your daily practice in one place.'**
  String get signInSubtitle;

  /// No description provided for @signInWithGoogle.
  ///
  /// In en, this message translates to:
  /// **'Continue with Google'**
  String get signInWithGoogle;

  /// No description provided for @signInWithApple.
  ///
  /// In en, this message translates to:
  /// **'Continue with Apple'**
  String get signInWithApple;

  /// No description provided for @signInCancelled.
  ///
  /// In en, this message translates to:
  /// **'Sign-in was cancelled.'**
  String get signInCancelled;

  /// No description provided for @signInFailed.
  ///
  /// In en, this message translates to:
  /// **'We could not sign you in. Please try again.'**
  String get signInFailed;

  /// No description provided for @signInLegal.
  ///
  /// In en, this message translates to:
  /// **'By continuing you agree to our Terms and Privacy Policy.'**
  String get signInLegal;

  /// No description provided for @introWelcomeTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome to HariHariBol'**
  String get introWelcomeTitle;

  /// No description provided for @introWelcomeBody.
  ///
  /// In en, this message translates to:
  /// **'A quiet place to read, chant and keep your daily practice, all in one app.'**
  String get introWelcomeBody;

  /// No description provided for @introReadTitle.
  ///
  /// In en, this message translates to:
  /// **'Read the scriptures'**
  String get introReadTitle;

  /// No description provided for @introReadBody.
  ///
  /// In en, this message translates to:
  /// **'The Bhagavad Gita and Srimad Bhagavatam, verse by verse, in the language you love. Listen to the recitation, even offline.'**
  String get introReadBody;

  /// No description provided for @introChantTitle.
  ///
  /// In en, this message translates to:
  /// **'Chant with every breath'**
  String get introChantTitle;

  /// No description provided for @introChantBody.
  ///
  /// In en, this message translates to:
  /// **'Count your japa by sound or by tap, chant along with a recorded mala, and watch your practice grow day by day.'**
  String get introChantBody;

  /// No description provided for @introSakhaTitle.
  ///
  /// In en, this message translates to:
  /// **'Ask Sakha, a friend on the path'**
  String get introSakhaTitle;

  /// The line under the Ask Sakha welcome page's title. It says plainly that Sakha is a digital companion, so do not make it sound like a person.
  ///
  /// In en, this message translates to:
  /// **'Bring a question or a heavy heart. Sakha is a digital companion that answers gently, in your language, one small step at a time.'**
  String get introSakhaBody;

  /// No description provided for @introReelsTitle.
  ///
  /// In en, this message translates to:
  /// **'Reels to lift your day'**
  String get introReelsTitle;

  /// No description provided for @introReelsBody.
  ///
  /// In en, this message translates to:
  /// **'Short devotional reels from verses and creators. Watch, save and share a little inspiration whenever you pause.'**
  String get introReelsBody;

  /// No description provided for @introNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get introNext;

  /// No description provided for @introSkip.
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get introSkip;

  /// No description provided for @introStart.
  ///
  /// In en, this message translates to:
  /// **'Get started'**
  String get introStart;

  /// Read aloud by a screen reader for the page dots on the welcome pages: which page of how many. Nothing is shown.
  ///
  /// In en, this message translates to:
  /// **'Page {current} of {total}'**
  String introPageOf(int current, int total);

  /// No description provided for @languageStepOf.
  ///
  /// In en, this message translates to:
  /// **'Step {current} of {total}'**
  String languageStepOf(int current, int total);

  /// No description provided for @languageAppTitle.
  ///
  /// In en, this message translates to:
  /// **'Which language feels like home?'**
  String get languageAppTitle;

  /// No description provided for @languageAppSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You can change this anytime in settings.'**
  String get languageAppSubtitle;

  /// No description provided for @languageMantraTitle.
  ///
  /// In en, this message translates to:
  /// **'Which script do you chant in?'**
  String get languageMantraTitle;

  /// No description provided for @languageMantraSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Mantras appear in this script. Their meaning stays in your own language.'**
  String get languageMantraSubtitle;

  /// No description provided for @actionBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get actionBack;

  /// No description provided for @tabHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get tabHome;

  /// No description provided for @tabSadhana.
  ///
  /// In en, this message translates to:
  /// **'Jap'**
  String get tabSadhana;

  /// No description provided for @tabLibrary.
  ///
  /// In en, this message translates to:
  /// **'Read'**
  String get tabLibrary;

  /// No description provided for @tabRoutine.
  ///
  /// In en, this message translates to:
  /// **'Routine'**
  String get tabRoutine;

  /// No description provided for @tabSakha.
  ///
  /// In en, this message translates to:
  /// **'Sakha'**
  String get tabSakha;

  /// No description provided for @reelsTitle.
  ///
  /// In en, this message translates to:
  /// **'Reels'**
  String get reelsTitle;

  /// No description provided for @tabSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get tabSearch;

  /// No description provided for @homeGreeting.
  ///
  /// In en, this message translates to:
  /// **'Hari Bol'**
  String get homeGreeting;

  /// The dashboard greeting. The devotional greeting is the point, so it is not swapped for a time-of-day one.
  ///
  /// In en, this message translates to:
  /// **'Hari Bol, {name}'**
  String homeGreetingNamed(String name);

  /// Today's date under the greeting, e.g. "Saturday · 27 April". The pattern is fixed by the template; a translation changes only the month and weekday names, which follow the locale.
  ///
  /// In en, this message translates to:
  /// **'{date}'**
  String homeDateLine(DateTime date);

  /// No description provided for @homeMoodPrompt.
  ///
  /// In en, this message translates to:
  /// **'Where would you like to grow today?'**
  String get homeMoodPrompt;

  /// No description provided for @homeMoodAnsweredToday.
  ///
  /// In en, this message translates to:
  /// **'You\'ve chosen your focus for today. Come back tomorrow to grow in something new.'**
  String get homeMoodAnsweredToday;

  /// No description provided for @homeMoodHint.
  ///
  /// In en, this message translates to:
  /// **'Choose what to strengthen, and a verse will walk with you.'**
  String get homeMoodHint;

  /// No description provided for @homeMoodViewToday.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Read today\'s verse again} other{Read today\'s {count} verses again}}'**
  String homeMoodViewToday(int count);

  /// No description provided for @homeMoodSubmit.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Show me a verse} other{Show me {count} verses}}'**
  String homeMoodSubmit(int count);

  /// No description provided for @growthKama.
  ///
  /// In en, this message translates to:
  /// **'Self-mastery'**
  String get growthKama;

  /// No description provided for @growthKrodha.
  ///
  /// In en, this message translates to:
  /// **'Calm'**
  String get growthKrodha;

  /// No description provided for @growthLobha.
  ///
  /// In en, this message translates to:
  /// **'Contentment'**
  String get growthLobha;

  /// No description provided for @growthMoha.
  ///
  /// In en, this message translates to:
  /// **'Clarity'**
  String get growthMoha;

  /// No description provided for @growthMada.
  ///
  /// In en, this message translates to:
  /// **'Humility'**
  String get growthMada;

  /// No description provided for @growthMatsarya.
  ///
  /// In en, this message translates to:
  /// **'Goodwill'**
  String get growthMatsarya;

  /// No description provided for @growthMissedChantingTime.
  ///
  /// In en, this message translates to:
  /// **'Chanting on time'**
  String get growthMissedChantingTime;

  /// No description provided for @growthUnmetRoundTarget.
  ///
  /// In en, this message translates to:
  /// **'Finishing my rounds'**
  String get growthUnmetRoundTarget;

  /// Why the verse on the home screen was chosen: the quality the reader said they want to grow in, which is already worded in their language (growth*).
  ///
  /// In en, this message translates to:
  /// **'For your growth: {quality}'**
  String homeGrowReason(String quality);

  /// No description provided for @homeVerseOfTheDay.
  ///
  /// In en, this message translates to:
  /// **'Verse of the day'**
  String get homeVerseOfTheDay;

  /// No description provided for @homeSlokaForYou.
  ///
  /// In en, this message translates to:
  /// **'For you today'**
  String get homeSlokaForYou;

  /// No description provided for @homeTodaysSadhana.
  ///
  /// In en, this message translates to:
  /// **'Today\'s sadhana'**
  String get homeTodaysSadhana;

  /// No description provided for @homeContinueReading.
  ///
  /// In en, this message translates to:
  /// **'Continue reading'**
  String get homeContinueReading;

  /// No description provided for @homeBooks.
  ///
  /// In en, this message translates to:
  /// **'Books'**
  String get homeBooks;

  /// No description provided for @homeMantras.
  ///
  /// In en, this message translates to:
  /// **'Mantras'**
  String get homeMantras;

  /// No description provided for @homeStartYourDay.
  ///
  /// In en, this message translates to:
  /// **'Set today\'s target'**
  String get homeStartYourDay;

  /// No description provided for @homeChantMantra.
  ///
  /// In en, this message translates to:
  /// **'Chant {mantra}'**
  String homeChantMantra(String mantra);

  /// No description provided for @bookChapterCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 chapter} other{{count} chapters}}'**
  String bookChapterCount(int count);

  /// No description provided for @bookVerseCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 verse} other{{count} verses}}'**
  String bookVerseCount(int count);

  /// No description provided for @searchHint.
  ///
  /// In en, this message translates to:
  /// **'Search verses, mantras, books'**
  String get searchHint;

  /// No description provided for @searchPrompt.
  ///
  /// In en, this message translates to:
  /// **'Search across the whole library, straight from the server.'**
  String get searchPrompt;

  /// No description provided for @searchShortcutLabel.
  ///
  /// In en, this message translates to:
  /// **'Or jump straight to a verse:'**
  String get searchShortcutLabel;

  /// No description provided for @searchNoResults.
  ///
  /// In en, this message translates to:
  /// **'No results. Try a different word, or a reference like BG 2.47.'**
  String get searchNoResults;

  /// No description provided for @searchSectionVerses.
  ///
  /// In en, this message translates to:
  /// **'Verses'**
  String get searchSectionVerses;

  /// App bar title of a results page: which kind of result, then what was searched for.
  ///
  /// In en, this message translates to:
  /// **'{kind} · {query}'**
  String searchResultsTitle(String kind, String query);

  /// No description provided for @labelCanto.
  ///
  /// In en, this message translates to:
  /// **'Canto {number}'**
  String labelCanto(int number);

  /// No description provided for @labelChapter.
  ///
  /// In en, this message translates to:
  /// **'Chapter {number}'**
  String labelChapter(int number);

  /// No description provided for @labelVerse.
  ///
  /// In en, this message translates to:
  /// **'Verse {number}'**
  String labelVerse(int number);

  /// Short verse label above a verse; must stay on one line.
  ///
  /// In en, this message translates to:
  /// **'Śl. {number}'**
  String labelVerseShort(int number);

  /// No description provided for @labelCantoChapter.
  ///
  /// In en, this message translates to:
  /// **'Canto {canto} · Chapter {chapter}'**
  String labelCantoChapter(int canto, int chapter);

  /// A verse's translation set off as a quotation. Use the quotation marks of the language.
  ///
  /// In en, this message translates to:
  /// **'“{meaning}”'**
  String labelQuotedMeaning(String meaning);

  /// The line crediting whoever translated the verse, under the quotation.
  ///
  /// In en, this message translates to:
  /// **'— {name}'**
  String labelTranslatorCredit(String name);

  /// No description provided for @sadhanaRoundsProgress.
  ///
  /// In en, this message translates to:
  /// **'{done} of {target} rounds'**
  String sadhanaRoundsProgress(int done, int target);

  /// No description provided for @sadhanaTasksProgress.
  ///
  /// In en, this message translates to:
  /// **'{done} of {total} tasks done'**
  String sadhanaTasksProgress(int done, int total);

  /// No description provided for @sadhanaStreak.
  ///
  /// In en, this message translates to:
  /// **'{days, plural, =0{No streak yet} =1{1 day streak} other{{days} day streak}}'**
  String sadhanaStreak(int days);

  /// No description provided for @sadhanaGenericChant.
  ///
  /// In en, this message translates to:
  /// **'Japa'**
  String get sadhanaGenericChant;

  /// No description provided for @sadhanaRoundsShort.
  ///
  /// In en, this message translates to:
  /// **'{rounds} rounds'**
  String sadhanaRoundsShort(int rounds);

  /// No description provided for @sadhanaTodaysSessions.
  ///
  /// In en, this message translates to:
  /// **'Today\'s chanting'**
  String get sadhanaTodaysSessions;

  /// No description provided for @sadhanaNoSessionsYet.
  ///
  /// In en, this message translates to:
  /// **'Nothing logged yet today.'**
  String get sadhanaNoSessionsYet;

  /// No description provided for @sadhanaRoundsEyebrow.
  ///
  /// In en, this message translates to:
  /// **'Rounds today'**
  String get sadhanaRoundsEyebrow;

  /// No description provided for @sadhanaRoundsCaption.
  ///
  /// In en, this message translates to:
  /// **'Rounds'**
  String get sadhanaRoundsCaption;

  /// No description provided for @sadhanaChantNow.
  ///
  /// In en, this message translates to:
  /// **'Chant now'**
  String get sadhanaChantNow;

  /// No description provided for @sadhanaLogRounds.
  ///
  /// In en, this message translates to:
  /// **'Log rounds'**
  String get sadhanaLogRounds;

  /// No description provided for @sadhanaLogRoundsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Rounds chanted on your beads, added to today\'s total.'**
  String get sadhanaLogRoundsSubtitle;

  /// No description provided for @sadhanaLogRoundsSubmit.
  ///
  /// In en, this message translates to:
  /// **'Log {rounds} rounds'**
  String sadhanaLogRoundsSubmit(int rounds);

  /// No description provided for @sadhanaTargetReached.
  ///
  /// In en, this message translates to:
  /// **'Today\'s target reached'**
  String get sadhanaTargetReached;

  /// No description provided for @sadhanaUndoBead.
  ///
  /// In en, this message translates to:
  /// **'Undo last bead'**
  String get sadhanaUndoBead;

  /// No description provided for @sadhanaElapsedEyebrow.
  ///
  /// In en, this message translates to:
  /// **'Elapsed'**
  String get sadhanaElapsedEyebrow;

  /// No description provided for @sadhanaPaceEyebrow.
  ///
  /// In en, this message translates to:
  /// **'Pace'**
  String get sadhanaPaceEyebrow;

  /// No description provided for @sadhanaElapsedSeconds.
  ///
  /// In en, this message translates to:
  /// **'{seconds}s'**
  String sadhanaElapsedSeconds(String seconds);

  /// No description provided for @sadhanaPacePerMantra.
  ///
  /// In en, this message translates to:
  /// **'{seconds}s each'**
  String sadhanaPacePerMantra(String seconds);

  /// No description provided for @sadhanaAutoCount.
  ///
  /// In en, this message translates to:
  /// **'Auto count'**
  String get sadhanaAutoCount;

  /// No description provided for @sadhanaAutoCountOff.
  ///
  /// In en, this message translates to:
  /// **'Off — tap a bead yourself'**
  String get sadhanaAutoCountOff;

  /// No description provided for @sadhanaAutoCountIdle.
  ///
  /// In en, this message translates to:
  /// **'Waiting for chanting'**
  String get sadhanaAutoCountIdle;

  /// No description provided for @chantAutoCountLoading.
  ///
  /// In en, this message translates to:
  /// **'Getting auto count ready…'**
  String get chantAutoCountLoading;

  /// No description provided for @chantFullPicture.
  ///
  /// In en, this message translates to:
  /// **'Full-screen picture'**
  String get chantFullPicture;

  /// No description provided for @chantPrayerHint.
  ///
  /// In en, this message translates to:
  /// **'Chant this prayer first, then tap the ring to begin counting.'**
  String get chantPrayerHint;

  /// No description provided for @sadhanaAutoCountListening.
  ///
  /// In en, this message translates to:
  /// **'Listening…'**
  String get sadhanaAutoCountListening;

  /// No description provided for @sadhanaAutoCountCounted.
  ///
  /// In en, this message translates to:
  /// **'Counted — listening for the next one'**
  String get sadhanaAutoCountCounted;

  /// No description provided for @sadhanaAutoCountPermissionDenied.
  ///
  /// In en, this message translates to:
  /// **'Microphone access is needed for auto count'**
  String get sadhanaAutoCountPermissionDenied;

  /// No description provided for @sadhanaAutoCountUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Auto count isn\'t available right now'**
  String get sadhanaAutoCountUnavailable;

  /// No description provided for @chantModelTitle.
  ///
  /// In en, this message translates to:
  /// **'Sharper listening'**
  String get chantModelTitle;

  /// No description provided for @chantModelOffer.
  ///
  /// In en, this message translates to:
  /// **'Understands Sanskrit far better. One download of {megabytes} MB — use Wi-Fi.'**
  String chantModelOffer(int megabytes);

  /// No description provided for @chantModelDownload.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get chantModelDownload;

  /// No description provided for @chantModelDownloading.
  ///
  /// In en, this message translates to:
  /// **'Downloading… {percent}%'**
  String chantModelDownloading(int percent);

  /// No description provided for @chantModelCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get chantModelCancel;

  /// No description provided for @chantModelInstalled.
  ///
  /// In en, this message translates to:
  /// **'Downloaded — used the next time you switch auto count on'**
  String get chantModelInstalled;

  /// No description provided for @chantModelRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove'**
  String get chantModelRemove;

  /// No description provided for @chantModelFailed.
  ///
  /// In en, this message translates to:
  /// **'The download didn\'t finish'**
  String get chantModelFailed;

  /// No description provided for @chantModelRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get chantModelRetry;

  /// No description provided for @mantraAllCategories.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get mantraAllCategories;

  /// No description provided for @mantraNoneInCategory.
  ///
  /// In en, this message translates to:
  /// **'No mantras in this category yet.'**
  String get mantraNoneInCategory;

  /// A mantra category: bīja ("seed") mantras, the one-syllable sounds such as Klīm. Shown as a filter chip above the mantra list and as a small label on each mantra. Where the bare word means something else in the language, write "bīja mantra".
  ///
  /// In en, this message translates to:
  /// **'Beej'**
  String get mantraCategoryBeej;

  /// A mantra category: Gāyatrī mantras (Krishna, Vishnu and Shiva Gayatri). Shown wherever Beej is.
  ///
  /// In en, this message translates to:
  /// **'Gayatri'**
  String get mantraCategoryGayatri;

  /// A mantra category: the Hare Krishna Mahamantra and the other great mantras. Shown wherever Beej is.
  ///
  /// In en, this message translates to:
  /// **'Mahamantra'**
  String get mantraCategoryMahamantra;

  /// A mantra category: mantras that are a deity's Name (nāma), such as Rama Taraka and Nrisimha. The Divine Name, not a person's name; where the bare word could be misread, write "Name mantra". Shown wherever Beej is.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get mantraCategoryName;

  /// No description provided for @mantraStandardRounds.
  ///
  /// In en, this message translates to:
  /// **'{rounds} rounds'**
  String mantraStandardRounds(int rounds);

  /// No description provided for @mantraStandardCount.
  ///
  /// In en, this message translates to:
  /// **'{count} times'**
  String mantraStandardCount(int count);

  /// No description provided for @mantraHasAudio.
  ///
  /// In en, this message translates to:
  /// **'Recitation available'**
  String get mantraHasAudio;

  /// No description provided for @mantraPurport.
  ///
  /// In en, this message translates to:
  /// **'Purport'**
  String get mantraPurport;

  /// No description provided for @mantraMyRounds.
  ///
  /// In en, this message translates to:
  /// **'You\'ve chanted {rounds} rounds of this'**
  String mantraMyRounds(int rounds);

  /// No description provided for @mantraChantThis.
  ///
  /// In en, this message translates to:
  /// **'Chant this'**
  String get mantraChantThis;

  /// No description provided for @profileStatVersesSaved.
  ///
  /// In en, this message translates to:
  /// **'Verses saved'**
  String get profileStatVersesSaved;

  /// No description provided for @profileStatTotalRounds.
  ///
  /// In en, this message translates to:
  /// **'Total rounds'**
  String get profileStatTotalRounds;

  /// No description provided for @profileStatChantingDays.
  ///
  /// In en, this message translates to:
  /// **'Chanting days'**
  String get profileStatChantingDays;

  /// No description provided for @profileStatSlokasRead.
  ///
  /// In en, this message translates to:
  /// **'Slokas read'**
  String get profileStatSlokasRead;

  /// No description provided for @profileRecentFavorites.
  ///
  /// In en, this message translates to:
  /// **'Recent favourites'**
  String get profileRecentFavorites;

  /// No description provided for @profileNoFavorites.
  ///
  /// In en, this message translates to:
  /// **'Nothing saved yet. Bookmark a verse and it will be here.'**
  String get profileNoFavorites;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @settingsSectionPractice.
  ///
  /// In en, this message translates to:
  /// **'Practice'**
  String get settingsSectionPractice;

  /// No description provided for @settingsSectionAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get settingsSectionAccount;

  /// No description provided for @settingsLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get settingsLanguage;

  /// No description provided for @settingsTheme.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get settingsTheme;

  /// No description provided for @settingsDailyGoal.
  ///
  /// In en, this message translates to:
  /// **'Daily goal'**
  String get settingsDailyGoal;

  /// No description provided for @settingsDailyGoalSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Rounds to aim for each day. Sets what every new day starts at.'**
  String get settingsDailyGoalSubtitle;

  /// No description provided for @settingsDailyGoalSubmit.
  ///
  /// In en, this message translates to:
  /// **'Set daily goal to {rounds}'**
  String settingsDailyGoalSubmit(int rounds);

  /// No description provided for @settingsPreferredMantra.
  ///
  /// In en, this message translates to:
  /// **'Preferred mantra'**
  String get settingsPreferredMantra;

  /// No description provided for @settingsPreferredMantraNone.
  ///
  /// In en, this message translates to:
  /// **'Not set'**
  String get settingsPreferredMantraNone;

  /// No description provided for @settingsChooseMantraTitle.
  ///
  /// In en, this message translates to:
  /// **'Choose your mantra'**
  String get settingsChooseMantraTitle;

  /// No description provided for @settingsChooseMantraSubtitle.
  ///
  /// In en, this message translates to:
  /// **'What \"Chant now\" opens with. You can still chant anything else from its own page.'**
  String get settingsChooseMantraSubtitle;

  /// No description provided for @settingsNoMantraPreference.
  ///
  /// In en, this message translates to:
  /// **'No preference — ask me each time'**
  String get settingsNoMantraPreference;

  /// No description provided for @settingsPlans.
  ///
  /// In en, this message translates to:
  /// **'Plans & Premium'**
  String get settingsPlans;

  /// No description provided for @plansTitle.
  ///
  /// In en, this message translates to:
  /// **'Plans'**
  String get plansTitle;

  /// No description provided for @plansSubtitle.
  ///
  /// In en, this message translates to:
  /// **'The whole app is free. A paid plan adds a little more on top.'**
  String get plansSubtitle;

  /// No description provided for @plansYourPlan.
  ///
  /// In en, this message translates to:
  /// **'Your plan'**
  String get plansYourPlan;

  /// No description provided for @plansCurrent.
  ///
  /// In en, this message translates to:
  /// **'Current plan'**
  String get plansCurrent;

  /// No description provided for @plansFreeForEveryone.
  ///
  /// In en, this message translates to:
  /// **'Free for everyone'**
  String get plansFreeForEveryone;

  /// No description provided for @plansPricePer.
  ///
  /// In en, this message translates to:
  /// **'{price} / {period}'**
  String plansPricePer(String price, String period);

  /// No description provided for @plansPeriodWeek.
  ///
  /// In en, this message translates to:
  /// **'week'**
  String get plansPeriodWeek;

  /// No description provided for @plansPeriodMonth.
  ///
  /// In en, this message translates to:
  /// **'month'**
  String get plansPeriodMonth;

  /// No description provided for @plansPeriodYear.
  ///
  /// In en, this message translates to:
  /// **'year'**
  String get plansPeriodYear;

  /// No description provided for @plansPeriodDays.
  ///
  /// In en, this message translates to:
  /// **'{days} days'**
  String plansPeriodDays(int days);

  /// No description provided for @plansTrial.
  ///
  /// In en, this message translates to:
  /// **'{days}-day free trial'**
  String plansTrial(int days);

  /// No description provided for @plansSubscribe.
  ///
  /// In en, this message translates to:
  /// **'Subscribe'**
  String get plansSubscribe;

  /// No description provided for @plansStartTrial.
  ///
  /// In en, this message translates to:
  /// **'Start free trial'**
  String get plansStartTrial;

  /// No description provided for @plansRestore.
  ///
  /// In en, this message translates to:
  /// **'Restore purchases'**
  String get plansRestore;

  /// No description provided for @plansStoreUnavailable.
  ///
  /// In en, this message translates to:
  /// **'The store is not available on this device.'**
  String get plansStoreUnavailable;

  /// No description provided for @plansProductMissing.
  ///
  /// In en, this message translates to:
  /// **'This plan is not available in the store right now.'**
  String get plansProductMissing;

  /// No description provided for @plansPurchasePending.
  ///
  /// In en, this message translates to:
  /// **'Your purchase is being processed…'**
  String get plansPurchasePending;

  /// No description provided for @plansPurchaseSuccess.
  ///
  /// In en, this message translates to:
  /// **'Thank you — your plan is active.'**
  String get plansPurchaseSuccess;

  /// No description provided for @plansPurchaseFailed.
  ///
  /// In en, this message translates to:
  /// **'The purchase did not go through.'**
  String get plansPurchaseFailed;

  /// No description provided for @plansPurchaseCancelled.
  ///
  /// In en, this message translates to:
  /// **'Purchase cancelled.'**
  String get plansPurchaseCancelled;

  /// No description provided for @plansRenews.
  ///
  /// In en, this message translates to:
  /// **'Renews on {date}'**
  String plansRenews(String date);

  /// No description provided for @plansEnds.
  ///
  /// In en, this message translates to:
  /// **'Access until {date}'**
  String plansEnds(String date);

  /// No description provided for @plansPermanent.
  ///
  /// In en, this message translates to:
  /// **'Yours permanently — thank you for supporting HariHariBol.'**
  String get plansPermanent;

  /// No description provided for @plansIncluded.
  ///
  /// In en, this message translates to:
  /// **'Included'**
  String get plansIncluded;

  /// No description provided for @plansNotIncluded.
  ///
  /// In en, this message translates to:
  /// **'Not included'**
  String get plansNotIncluded;

  /// No description provided for @plansUnlimited.
  ///
  /// In en, this message translates to:
  /// **'Unlimited'**
  String get plansUnlimited;

  /// No description provided for @plansLimit.
  ///
  /// In en, this message translates to:
  /// **'{limit} {unit}'**
  String plansLimit(int limit, String unit);

  /// No description provided for @plansSakhaReplies.
  ///
  /// In en, this message translates to:
  /// **'About {count} replies a month'**
  String plansSakhaReplies(int count);

  /// No description provided for @plansNoFeatures.
  ///
  /// In en, this message translates to:
  /// **'No extra benefits yet — more are on the way.'**
  String get plansNoFeatures;

  /// No description provided for @plansRestoreDone.
  ///
  /// In en, this message translates to:
  /// **'Purchases restored.'**
  String get plansRestoreDone;

  /// No description provided for @settingsPrivacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy policy'**
  String get settingsPrivacy;

  /// No description provided for @settingsVersion.
  ///
  /// In en, this message translates to:
  /// **'Version {version}'**
  String settingsVersion(String version);

  /// No description provided for @settingsMadeWith.
  ///
  /// In en, this message translates to:
  /// **'Made with reverence'**
  String get settingsMadeWith;

  /// The last line of settings: the version line and the sign-off, side by side.
  ///
  /// In en, this message translates to:
  /// **'{version} · {madeWith}'**
  String settingsFooter(String version, String madeWith);

  /// No description provided for @themeSystem.
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get themeSystem;

  /// No description provided for @themeLight.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get themeLight;

  /// No description provided for @themeDark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get themeDark;

  /// No description provided for @profileSignedInAs.
  ///
  /// In en, this message translates to:
  /// **'Signed in as {email}'**
  String profileSignedInAs(String email);

  /// No description provided for @profilePremium.
  ///
  /// In en, this message translates to:
  /// **'Premium'**
  String get profilePremium;

  /// No description provided for @profileFree.
  ///
  /// In en, this message translates to:
  /// **'Free'**
  String get profileFree;

  /// No description provided for @signOutConfirm.
  ///
  /// In en, this message translates to:
  /// **'You will need to sign in again to reach your practice history.'**
  String get signOutConfirm;

  /// No description provided for @deleteAccountTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete your account?'**
  String get deleteAccountTitle;

  /// No description provided for @deleteAccountBody.
  ///
  /// In en, this message translates to:
  /// **'This removes your practice history, favourites and notifications. It cannot be undone.'**
  String get deleteAccountBody;

  /// No description provided for @comingSoon.
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get comingSoon;

  /// No description provided for @libraryNoBooks.
  ///
  /// In en, this message translates to:
  /// **'No books published yet.'**
  String get libraryNoBooks;

  /// No description provided for @libraryBookNotStarted.
  ///
  /// In en, this message translates to:
  /// **'Not started yet. Tap to begin.'**
  String get libraryBookNotStarted;

  /// No description provided for @actionEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get actionEdit;

  /// No description provided for @actionDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get actionDelete;

  /// No description provided for @libraryDownloadBook.
  ///
  /// In en, this message translates to:
  /// **'Download for offline reading'**
  String get libraryDownloadBook;

  /// No description provided for @libraryDownloading.
  ///
  /// In en, this message translates to:
  /// **'Downloading…'**
  String get libraryDownloading;

  /// No description provided for @libraryDownloaded.
  ///
  /// In en, this message translates to:
  /// **'Downloaded for offline reading'**
  String get libraryDownloaded;

  /// No description provided for @libraryDownloadFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not download this book. Please try again.'**
  String get libraryDownloadFailed;

  /// No description provided for @bookCantoCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 canto} other{{count} cantos}}'**
  String bookCantoCount(int count);

  /// e.g. "Renderings by Prabhupada, Ramanuja"
  ///
  /// In en, this message translates to:
  /// **'Renderings by {names}'**
  String bookByTranslators(String names);

  /// No description provided for @chapterPrevious.
  ///
  /// In en, this message translates to:
  /// **'Previous chapter'**
  String get chapterPrevious;

  /// No description provided for @chapterNext.
  ///
  /// In en, this message translates to:
  /// **'Next chapter'**
  String get chapterNext;

  /// No description provided for @actionBookmark.
  ///
  /// In en, this message translates to:
  /// **'Bookmark'**
  String get actionBookmark;

  /// No description provided for @actionRemoveBookmark.
  ///
  /// In en, this message translates to:
  /// **'Remove bookmark'**
  String get actionRemoveBookmark;

  /// No description provided for @actionHighlight.
  ///
  /// In en, this message translates to:
  /// **'Highlight'**
  String get actionHighlight;

  /// No description provided for @actionRemoveHighlight.
  ///
  /// In en, this message translates to:
  /// **'Remove highlight'**
  String get actionRemoveHighlight;

  /// No description provided for @verseExplanationLabel.
  ///
  /// In en, this message translates to:
  /// **'Explanation'**
  String get verseExplanationLabel;

  /// No description provided for @verseExplanationAiLabel.
  ///
  /// In en, this message translates to:
  /// **'Explanation (AI-assisted)'**
  String get verseExplanationAiLabel;

  /// No description provided for @verseWordMeanings.
  ///
  /// In en, this message translates to:
  /// **'Word meanings'**
  String get verseWordMeanings;

  /// No description provided for @verseCompareTranslations.
  ///
  /// In en, this message translates to:
  /// **'Compare translations'**
  String get verseCompareTranslations;

  /// No description provided for @verseTranslationsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No other renderings published yet.'**
  String get verseTranslationsEmpty;

  /// No description provided for @verseRelatedTitle.
  ///
  /// In en, this message translates to:
  /// **'Related verses'**
  String get verseRelatedTitle;

  /// No description provided for @verseRelatedEmpty.
  ///
  /// In en, this message translates to:
  /// **'No related verses yet.'**
  String get verseRelatedEmpty;

  /// No description provided for @relationSameConcept.
  ///
  /// In en, this message translates to:
  /// **'Same concept'**
  String get relationSameConcept;

  /// No description provided for @relationExpandsOn.
  ///
  /// In en, this message translates to:
  /// **'Expands on'**
  String get relationExpandsOn;

  /// No description provided for @relationQuotedIn.
  ///
  /// In en, this message translates to:
  /// **'Quoted in'**
  String get relationQuotedIn;

  /// No description provided for @relationContrastsWith.
  ///
  /// In en, this message translates to:
  /// **'Contrasts with'**
  String get relationContrastsWith;

  /// No description provided for @verseNotesTitle.
  ///
  /// In en, this message translates to:
  /// **'My notes'**
  String get verseNotesTitle;

  /// No description provided for @verseNoteHint.
  ///
  /// In en, this message translates to:
  /// **'Write a note…'**
  String get verseNoteHint;

  /// No description provided for @verseNoteAdd.
  ///
  /// In en, this message translates to:
  /// **'Add note'**
  String get verseNoteAdd;

  /// No description provided for @verseNoteEmpty.
  ///
  /// In en, this message translates to:
  /// **'No notes yet on this verse.'**
  String get verseNoteEmpty;

  /// No description provided for @verseNoteDeleteConfirm.
  ///
  /// In en, this message translates to:
  /// **'Delete this note?'**
  String get verseNoteDeleteConfirm;

  /// No description provided for @readingSettingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Reading settings'**
  String get readingSettingsTitle;

  /// No description provided for @readingContents.
  ///
  /// In en, this message translates to:
  /// **'Contents'**
  String get readingContents;

  /// No description provided for @readingFontSizeLabel.
  ///
  /// In en, this message translates to:
  /// **'Text size'**
  String get readingFontSizeLabel;

  /// No description provided for @readingFontSizeSmall.
  ///
  /// In en, this message translates to:
  /// **'Small'**
  String get readingFontSizeSmall;

  /// No description provided for @readingFontSizeMedium.
  ///
  /// In en, this message translates to:
  /// **'Medium'**
  String get readingFontSizeMedium;

  /// No description provided for @readingFontSizeLarge.
  ///
  /// In en, this message translates to:
  /// **'Large'**
  String get readingFontSizeLarge;

  /// No description provided for @readingFontSizeExtraLarge.
  ///
  /// In en, this message translates to:
  /// **'Extra large'**
  String get readingFontSizeExtraLarge;

  /// No description provided for @readingLanguageLabel.
  ///
  /// In en, this message translates to:
  /// **'Reading language'**
  String get readingLanguageLabel;

  /// No description provided for @readingHideLabel.
  ///
  /// In en, this message translates to:
  /// **'Hide in verses'**
  String get readingHideLabel;

  /// No description provided for @readingHideSanskrit.
  ///
  /// In en, this message translates to:
  /// **'Sanskrit'**
  String get readingHideSanskrit;

  /// No description provided for @readingHideTransliteration.
  ///
  /// In en, this message translates to:
  /// **'Transliteration'**
  String get readingHideTransliteration;

  /// No description provided for @readingModeLabel.
  ///
  /// In en, this message translates to:
  /// **'Reading style'**
  String get readingModeLabel;

  /// No description provided for @readingModeVerses.
  ///
  /// In en, this message translates to:
  /// **'Verse by verse'**
  String get readingModeVerses;

  /// No description provided for @readingModeStory.
  ///
  /// In en, this message translates to:
  /// **'Story'**
  String get readingModeStory;

  /// No description provided for @readingStoryShowLabel.
  ///
  /// In en, this message translates to:
  /// **'Story shows'**
  String get readingStoryShowLabel;

  /// No description provided for @readingStoryNumbers.
  ///
  /// In en, this message translates to:
  /// **'Verse numbers'**
  String get readingStoryNumbers;

  /// No description provided for @readingStoryHint.
  ///
  /// In en, this message translates to:
  /// **'Press and hold a verse to play it, bookmark it, highlight it or add a note.'**
  String get readingStoryHint;

  /// No description provided for @readingStoryNothing.
  ///
  /// In en, this message translates to:
  /// **'This chapter has nothing for the part you chose. Try another one above.'**
  String get readingStoryNothing;

  /// No description provided for @readingPartMeaning.
  ///
  /// In en, this message translates to:
  /// **'Meaning'**
  String get readingPartMeaning;

  /// No description provided for @routineSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Devotion, work and the ordinary in between.'**
  String get routineSubtitle;

  /// No description provided for @routineProgress.
  ///
  /// In en, this message translates to:
  /// **'{done} of {total} done'**
  String routineProgress(int done, int total);

  /// No description provided for @routineEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Add a round of japa, an errand, a chore — build today with intention.'**
  String get routineEmptyBody;

  /// No description provided for @routineAddTask.
  ///
  /// In en, this message translates to:
  /// **'Add task'**
  String get routineAddTask;

  /// No description provided for @routineTaskHint.
  ///
  /// In en, this message translates to:
  /// **'What needs doing?'**
  String get routineTaskHint;

  /// No description provided for @routineCategoryLabel.
  ///
  /// In en, this message translates to:
  /// **'Category'**
  String get routineCategoryLabel;

  /// No description provided for @routineCategoryDevotion.
  ///
  /// In en, this message translates to:
  /// **'Devotion'**
  String get routineCategoryDevotion;

  /// No description provided for @routineCategoryWork.
  ///
  /// In en, this message translates to:
  /// **'Work'**
  String get routineCategoryWork;

  /// No description provided for @routineCategoryHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get routineCategoryHome;

  /// No description provided for @routineCategoryErrand.
  ///
  /// In en, this message translates to:
  /// **'Errand'**
  String get routineCategoryErrand;

  /// No description provided for @routineSlotMorning.
  ///
  /// In en, this message translates to:
  /// **'Morning'**
  String get routineSlotMorning;

  /// No description provided for @routineSlotAfternoon.
  ///
  /// In en, this message translates to:
  /// **'Afternoon'**
  String get routineSlotAfternoon;

  /// No description provided for @routineSlotEvening.
  ///
  /// In en, this message translates to:
  /// **'Evening'**
  String get routineSlotEvening;

  /// No description provided for @routineSlotAnytime.
  ///
  /// In en, this message translates to:
  /// **'Anytime'**
  String get routineSlotAnytime;

  /// No description provided for @routinePresetWakeUp.
  ///
  /// In en, this message translates to:
  /// **'Wake up'**
  String get routinePresetWakeUp;

  /// No description provided for @routinePresetMorningChant.
  ///
  /// In en, this message translates to:
  /// **'Morning chanting'**
  String get routinePresetMorningChant;

  /// No description provided for @routinePresetExercise.
  ///
  /// In en, this message translates to:
  /// **'Exercise'**
  String get routinePresetExercise;

  /// No description provided for @routinePresetBreakfast.
  ///
  /// In en, this message translates to:
  /// **'Breakfast'**
  String get routinePresetBreakfast;

  /// No description provided for @routinePresetLunch.
  ///
  /// In en, this message translates to:
  /// **'Lunch'**
  String get routinePresetLunch;

  /// No description provided for @routinePresetEveningChant.
  ///
  /// In en, this message translates to:
  /// **'Evening chanting'**
  String get routinePresetEveningChant;

  /// No description provided for @routinePresetDinner.
  ///
  /// In en, this message translates to:
  /// **'Dinner'**
  String get routinePresetDinner;

  /// No description provided for @routinePresetScriptureReading.
  ///
  /// In en, this message translates to:
  /// **'Scripture reading'**
  String get routinePresetScriptureReading;

  /// No description provided for @routinePresetSleep.
  ///
  /// In en, this message translates to:
  /// **'Sleep'**
  String get routinePresetSleep;

  /// No description provided for @routineTaskNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Task name'**
  String get routineTaskNameLabel;

  /// No description provided for @routineWindowHeading.
  ///
  /// In en, this message translates to:
  /// **'Standard time'**
  String get routineWindowHeading;

  /// No description provided for @routineWindowHint.
  ///
  /// In en, this message translates to:
  /// **'Done inside this range counts as on time; before it is early, after it is late.'**
  String get routineWindowHint;

  /// No description provided for @routineWindowSet.
  ///
  /// In en, this message translates to:
  /// **'Set a time range'**
  String get routineWindowSet;

  /// No description provided for @routineWindowClear.
  ///
  /// In en, this message translates to:
  /// **'Remove time range'**
  String get routineWindowClear;

  /// No description provided for @routineWindowFrom.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get routineWindowFrom;

  /// No description provided for @routineWindowTo.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get routineWindowTo;

  /// No description provided for @routineWindowRange.
  ///
  /// In en, this message translates to:
  /// **'{start} – {end}'**
  String routineWindowRange(String start, String end);

  /// No description provided for @routineWindowInvalid.
  ///
  /// In en, this message translates to:
  /// **'The end must be after the start.'**
  String get routineWindowInvalid;

  /// No description provided for @routineStatusNotDone.
  ///
  /// In en, this message translates to:
  /// **'Not done'**
  String get routineStatusNotDone;

  /// No description provided for @routineStatusDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get routineStatusDone;

  /// No description provided for @routineStatusEarly.
  ///
  /// In en, this message translates to:
  /// **'Early'**
  String get routineStatusEarly;

  /// No description provided for @routineStatusOnTime.
  ///
  /// In en, this message translates to:
  /// **'On time'**
  String get routineStatusOnTime;

  /// No description provided for @routineStatusLate.
  ///
  /// In en, this message translates to:
  /// **'Late'**
  String get routineStatusLate;

  /// No description provided for @routineStatusAtTime.
  ///
  /// In en, this message translates to:
  /// **'{status} · {time}'**
  String routineStatusAtTime(String status, String time);

  /// No description provided for @routineChangeTime.
  ///
  /// In en, this message translates to:
  /// **'Change time'**
  String get routineChangeTime;

  /// No description provided for @routinePickDoneTime.
  ///
  /// In en, this message translates to:
  /// **'When was this done?'**
  String get routinePickDoneTime;

  /// No description provided for @routineSaveAction.
  ///
  /// In en, this message translates to:
  /// **'Add to this day'**
  String get routineSaveAction;

  /// No description provided for @routineTaskRemoved.
  ///
  /// In en, this message translates to:
  /// **'Removed from this day'**
  String get routineTaskRemoved;

  /// No description provided for @routineUndo.
  ///
  /// In en, this message translates to:
  /// **'Undo'**
  String get routineUndo;

  /// No description provided for @routineToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get routineToday;

  /// No description provided for @routineJumpToToday.
  ///
  /// In en, this message translates to:
  /// **'Jump to today'**
  String get routineJumpToToday;

  /// No description provided for @routineEkadashi.
  ///
  /// In en, this message translates to:
  /// **'Ekadashi'**
  String get routineEkadashi;

  /// No description provided for @routineEkadashiNote.
  ///
  /// In en, this message translates to:
  /// **'Approximate — a temple\'s almanac can differ by a day.'**
  String get routineEkadashiNote;

  /// No description provided for @routineDayLabel.
  ///
  /// In en, this message translates to:
  /// **'{date}{ekadashi, select, yes{ · Ekadashi} other{}}{total, plural, =0{} other{ · {done} of {total} done}}'**
  String routineDayLabel(String date, String ekadashi, int done, int total);

  /// No description provided for @routineNothingPlanned.
  ///
  /// In en, this message translates to:
  /// **'Nothing planned for this day.'**
  String get routineNothingPlanned;

  /// No description provided for @routineManageDaily.
  ///
  /// In en, this message translates to:
  /// **'Daily routine'**
  String get routineManageDaily;

  /// No description provided for @routineDailyTitle.
  ///
  /// In en, this message translates to:
  /// **'Daily routine'**
  String get routineDailyTitle;

  /// No description provided for @routineDailyBody.
  ///
  /// In en, this message translates to:
  /// **'Optional. These repeat every day, with a fresh check each day.'**
  String get routineDailyBody;

  /// No description provided for @routineDailyEmpty.
  ///
  /// In en, this message translates to:
  /// **'No daily routine yet.'**
  String get routineDailyEmpty;

  /// No description provided for @routineDailyAdd.
  ///
  /// In en, this message translates to:
  /// **'Add to daily routine'**
  String get routineDailyAdd;

  /// No description provided for @routineDailySaveAction.
  ///
  /// In en, this message translates to:
  /// **'Add to every day'**
  String get routineDailySaveAction;

  /// No description provided for @routineDailyBadge.
  ///
  /// In en, this message translates to:
  /// **'Daily'**
  String get routineDailyBadge;

  /// No description provided for @routineDailyRemove.
  ///
  /// In en, this message translates to:
  /// **'Remove from daily routine'**
  String get routineDailyRemove;

  /// No description provided for @routineDailyRemoved.
  ///
  /// In en, this message translates to:
  /// **'Removed from your daily routine'**
  String get routineDailyRemoved;

  /// No description provided for @reelsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No reels yet'**
  String get reelsEmpty;

  /// No description provided for @reelsEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'When creators start posting, their reels will appear here.'**
  String get reelsEmptyBody;

  /// No description provided for @reelsFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not load reels'**
  String get reelsFailed;

  /// No description provided for @reelsRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get reelsRetry;

  /// No description provided for @reelFollow.
  ///
  /// In en, this message translates to:
  /// **'Follow'**
  String get reelFollow;

  /// No description provided for @reelFollowing.
  ///
  /// In en, this message translates to:
  /// **'Following'**
  String get reelFollowing;

  /// No description provided for @reelLike.
  ///
  /// In en, this message translates to:
  /// **'Like'**
  String get reelLike;

  /// No description provided for @reelUnlike.
  ///
  /// In en, this message translates to:
  /// **'Unlike'**
  String get reelUnlike;

  /// No description provided for @reelComment.
  ///
  /// In en, this message translates to:
  /// **'Comment'**
  String get reelComment;

  /// No description provided for @reelShare.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get reelShare;

  /// No description provided for @reelSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get reelSave;

  /// No description provided for @reelUnsave.
  ///
  /// In en, this message translates to:
  /// **'Remove from saved'**
  String get reelUnsave;

  /// No description provided for @reelSaved.
  ///
  /// In en, this message translates to:
  /// **'Saved'**
  String get reelSaved;

  /// No description provided for @reelRemovedFromSaved.
  ///
  /// In en, this message translates to:
  /// **'Removed from saved'**
  String get reelRemovedFromSaved;

  /// No description provided for @reelMore.
  ///
  /// In en, this message translates to:
  /// **'More options'**
  String get reelMore;

  /// No description provided for @reelMuted.
  ///
  /// In en, this message translates to:
  /// **'Sound off'**
  String get reelMuted;

  /// No description provided for @reelUnmuted.
  ///
  /// In en, this message translates to:
  /// **'Sound on'**
  String get reelUnmuted;

  /// No description provided for @reelPlay.
  ///
  /// In en, this message translates to:
  /// **'Play'**
  String get reelPlay;

  /// No description provided for @reelPause.
  ///
  /// In en, this message translates to:
  /// **'Pause'**
  String get reelPause;

  /// No description provided for @reelVideoUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This video is still processing.'**
  String get reelVideoUnavailable;

  /// No description provided for @reelAudioUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This recitation is still processing.'**
  String get reelAudioUnavailable;

  /// No description provided for @reelSimilar.
  ///
  /// In en, this message translates to:
  /// **'More like this'**
  String get reelSimilar;

  /// No description provided for @reelSimilarEmpty.
  ///
  /// In en, this message translates to:
  /// **'No similar reels yet.'**
  String get reelSimilarEmpty;

  /// No description provided for @reelSlideOf.
  ///
  /// In en, this message translates to:
  /// **'{current} of {total}'**
  String reelSlideOf(int current, int total);

  /// No description provided for @reelBookGita.
  ///
  /// In en, this message translates to:
  /// **'BG'**
  String get reelBookGita;

  /// No description provided for @reelBookBhagavatam.
  ///
  /// In en, this message translates to:
  /// **'SB'**
  String get reelBookBhagavatam;

  /// No description provided for @reelCaptionMore.
  ///
  /// In en, this message translates to:
  /// **'more'**
  String get reelCaptionMore;

  /// No description provided for @reelCaptionLess.
  ///
  /// In en, this message translates to:
  /// **'less'**
  String get reelCaptionLess;

  /// No description provided for @reelCommentsTitle.
  ///
  /// In en, this message translates to:
  /// **'Comments'**
  String get reelCommentsTitle;

  /// No description provided for @reelCommentsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =0{No comments yet} =1{1 comment} other{{count} comments}}'**
  String reelCommentsCount(int count);

  /// No description provided for @reelCommentsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Be the first to say something.'**
  String get reelCommentsEmpty;

  /// No description provided for @reelCommentHint.
  ///
  /// In en, this message translates to:
  /// **'Add a comment…'**
  String get reelCommentHint;

  /// No description provided for @reelReplyHint.
  ///
  /// In en, this message translates to:
  /// **'Reply to {name}…'**
  String reelReplyHint(String name);

  /// No description provided for @reelCommentSend.
  ///
  /// In en, this message translates to:
  /// **'Post'**
  String get reelCommentSend;

  /// No description provided for @reelCommentReply.
  ///
  /// In en, this message translates to:
  /// **'Reply'**
  String get reelCommentReply;

  /// No description provided for @reelCommentDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get reelCommentDelete;

  /// No description provided for @reelCommentReport.
  ///
  /// In en, this message translates to:
  /// **'Report'**
  String get reelCommentReport;

  /// No description provided for @reelCommentPin.
  ///
  /// In en, this message translates to:
  /// **'Pin'**
  String get reelCommentPin;

  /// No description provided for @reelCommentUnpin.
  ///
  /// In en, this message translates to:
  /// **'Unpin'**
  String get reelCommentUnpin;

  /// No description provided for @reelCommentPinned.
  ///
  /// In en, this message translates to:
  /// **'Pinned'**
  String get reelCommentPinned;

  /// No description provided for @reelCommentRemoved.
  ///
  /// In en, this message translates to:
  /// **'This comment was removed.'**
  String get reelCommentRemoved;

  /// No description provided for @reelCommentDeleted.
  ///
  /// In en, this message translates to:
  /// **'Comment deleted'**
  String get reelCommentDeleted;

  /// No description provided for @reelCommentDeleteTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete this comment?'**
  String get reelCommentDeleteTitle;

  /// No description provided for @reelCommentDeleteBody.
  ///
  /// In en, this message translates to:
  /// **'It will be removed for everyone, along with any replies to it.'**
  String get reelCommentDeleteBody;

  /// No description provided for @reelCommentCancelReply.
  ///
  /// In en, this message translates to:
  /// **'Cancel reply'**
  String get reelCommentCancelReply;

  /// No description provided for @reelViewReplies.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{View 1 reply} other{View {count} replies}}'**
  String reelViewReplies(int count);

  /// No description provided for @reelHideReplies.
  ///
  /// In en, this message translates to:
  /// **'Hide replies'**
  String get reelHideReplies;

  /// No description provided for @reelLoadMoreComments.
  ///
  /// In en, this message translates to:
  /// **'Load more comments'**
  String get reelLoadMoreComments;

  /// No description provided for @reelReportTitle.
  ///
  /// In en, this message translates to:
  /// **'Report this reel'**
  String get reelReportTitle;

  /// No description provided for @reelReportCommentTitle.
  ///
  /// In en, this message translates to:
  /// **'Report this comment'**
  String get reelReportCommentTitle;

  /// No description provided for @reelReportBody.
  ///
  /// In en, this message translates to:
  /// **'Tell us what is wrong with it. A moderator will review it.'**
  String get reelReportBody;

  /// No description provided for @reelReportSpam.
  ///
  /// In en, this message translates to:
  /// **'Spam or misleading'**
  String get reelReportSpam;

  /// No description provided for @reelReportHarassment.
  ///
  /// In en, this message translates to:
  /// **'Harassment or abuse'**
  String get reelReportHarassment;

  /// No description provided for @reelReportNonDevotional.
  ///
  /// In en, this message translates to:
  /// **'Not devotional content'**
  String get reelReportNonDevotional;

  /// No description provided for @reelReportMisinformation.
  ///
  /// In en, this message translates to:
  /// **'Misinformation'**
  String get reelReportMisinformation;

  /// No description provided for @reelReportSexualOrViolent.
  ///
  /// In en, this message translates to:
  /// **'Sexual or violent'**
  String get reelReportSexualOrViolent;

  /// No description provided for @reelReportOther.
  ///
  /// In en, this message translates to:
  /// **'Something else'**
  String get reelReportOther;

  /// No description provided for @reelReportNoteHint.
  ///
  /// In en, this message translates to:
  /// **'Anything else we should know? (optional)'**
  String get reelReportNoteHint;

  /// No description provided for @reelReportSubmit.
  ///
  /// In en, this message translates to:
  /// **'Report'**
  String get reelReportSubmit;

  /// No description provided for @reelReportThanks.
  ///
  /// In en, this message translates to:
  /// **'Thank you. A moderator will look at this.'**
  String get reelReportThanks;

  /// No description provided for @reelShareTitle.
  ///
  /// In en, this message translates to:
  /// **'Share this reel'**
  String get reelShareTitle;

  /// No description provided for @reelShareMessage.
  ///
  /// In en, this message translates to:
  /// **'{caption}\n\nWatch on HariHariBol: {link}'**
  String reelShareMessage(String caption, String link);

  /// No description provided for @reelCopyLink.
  ///
  /// In en, this message translates to:
  /// **'Copy link'**
  String get reelCopyLink;

  /// No description provided for @reelLinkCopied.
  ///
  /// In en, this message translates to:
  /// **'Link copied'**
  String get reelLinkCopied;

  /// No description provided for @creatorTitle.
  ///
  /// In en, this message translates to:
  /// **'Creator'**
  String get creatorTitle;

  /// No description provided for @creatorFollowers.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 follower} other{{count} followers}}'**
  String creatorFollowers(int count);

  /// No description provided for @creatorReelCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 reel} other{{count} reels}}'**
  String creatorReelCount(int count);

  /// No description provided for @creatorViews.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 view} other{{count} views}}'**
  String creatorViews(int count);

  /// No description provided for @creatorStatFollowers.
  ///
  /// In en, this message translates to:
  /// **'Followers'**
  String get creatorStatFollowers;

  /// No description provided for @creatorStatReels.
  ///
  /// In en, this message translates to:
  /// **'Reels'**
  String get creatorStatReels;

  /// No description provided for @creatorStatViews.
  ///
  /// In en, this message translates to:
  /// **'Views'**
  String get creatorStatViews;

  /// No description provided for @creatorVerified.
  ///
  /// In en, this message translates to:
  /// **'Verified creator'**
  String get creatorVerified;

  /// No description provided for @creatorNoReels.
  ///
  /// In en, this message translates to:
  /// **'Nothing posted yet.'**
  String get creatorNoReels;

  /// No description provided for @creatorNotFound.
  ///
  /// In en, this message translates to:
  /// **'That creator is no longer here.'**
  String get creatorNotFound;

  /// No description provided for @chantAnalyticsTooltip.
  ///
  /// In en, this message translates to:
  /// **'Analytics and history'**
  String get chantAnalyticsTooltip;

  /// No description provided for @chantSittingTime.
  ///
  /// In en, this message translates to:
  /// **'Sitting time'**
  String get chantSittingTime;

  /// No description provided for @chantMalaTime.
  ///
  /// In en, this message translates to:
  /// **'Mala {number} time'**
  String chantMalaTime(int number);

  /// No description provided for @chantStatCurrentMala.
  ///
  /// In en, this message translates to:
  /// **'Current mala'**
  String get chantStatCurrentMala;

  /// No description provided for @chantStatCount.
  ///
  /// In en, this message translates to:
  /// **'Count'**
  String get chantStatCount;

  /// No description provided for @chantStatMalasDone.
  ///
  /// In en, this message translates to:
  /// **'Malas done'**
  String get chantStatMalasDone;

  /// No description provided for @chantStatAvgMala.
  ///
  /// In en, this message translates to:
  /// **'Avg per mala'**
  String get chantStatAvgMala;

  /// No description provided for @chantStatAvgChant.
  ///
  /// In en, this message translates to:
  /// **'Avg per chant'**
  String get chantStatAvgChant;

  /// No description provided for @chantStatTotalChants.
  ///
  /// In en, this message translates to:
  /// **'Total chants'**
  String get chantStatTotalChants;

  /// No description provided for @chantStatFastestMala.
  ///
  /// In en, this message translates to:
  /// **'Fastest mala'**
  String get chantStatFastestMala;

  /// No description provided for @chantStatTotalTime.
  ///
  /// In en, this message translates to:
  /// **'Total time'**
  String get chantStatTotalTime;

  /// No description provided for @chantNoValue.
  ///
  /// In en, this message translates to:
  /// **'—'**
  String get chantNoValue;

  /// No description provided for @chantRecentTitle.
  ///
  /// In en, this message translates to:
  /// **'Recent chants'**
  String get chantRecentTitle;

  /// No description provided for @chantRecentEmpty.
  ///
  /// In en, this message translates to:
  /// **'Tap the ring to begin.'**
  String get chantRecentEmpty;

  /// No description provided for @chantTapNumber.
  ///
  /// In en, this message translates to:
  /// **'#{seq}'**
  String chantTapNumber(int seq);

  /// No description provided for @chantAutoBadge.
  ///
  /// In en, this message translates to:
  /// **'Auto'**
  String get chantAutoBadge;

  /// No description provided for @chantDetectWords.
  ///
  /// In en, this message translates to:
  /// **'Detect words'**
  String get chantDetectWords;

  /// No description provided for @chantDetectWordsOff.
  ///
  /// In en, this message translates to:
  /// **'Off — words aren\'t recorded'**
  String get chantDetectWordsOff;

  /// No description provided for @chantDetectWordsListening.
  ///
  /// In en, this message translates to:
  /// **'Listening for words…'**
  String get chantDetectWordsListening;

  /// No description provided for @chantDetectWordsPermission.
  ///
  /// In en, this message translates to:
  /// **'Microphone access is needed'**
  String get chantDetectWordsPermission;

  /// No description provided for @chantDetectWordsStarting.
  ///
  /// In en, this message translates to:
  /// **'Getting ready…'**
  String get chantDetectWordsStarting;

  /// No description provided for @chantDetectWordsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Word detection isn\'t available on this device'**
  String get chantDetectWordsUnavailable;

  /// No description provided for @chantDetectWordsNote.
  ///
  /// In en, this message translates to:
  /// **'Words are recognised on your phone, and audio is never recorded. The text is kept for 7 days, then deleted.'**
  String get chantDetectWordsNote;

  /// No description provided for @chantSetupTitle.
  ///
  /// In en, this message translates to:
  /// **'Chanting helpers'**
  String get chantSetupTitle;

  /// No description provided for @chantSetupSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose how this sitting is counted and noted. Listening happens on your phone.'**
  String get chantSetupSubtitle;

  /// No description provided for @chantSetupButton.
  ///
  /// In en, this message translates to:
  /// **'Auto count & words'**
  String get chantSetupButton;

  /// No description provided for @chantSetupNoneOn.
  ///
  /// In en, this message translates to:
  /// **'Set up'**
  String get chantSetupNoneOn;

  /// No description provided for @chantSetupOn.
  ///
  /// In en, this message translates to:
  /// **'{count} on'**
  String chantSetupOn(int count);

  /// The setup button's label followed by how many helpers are on, e.g. "Auto count & words · 1 on".
  ///
  /// In en, this message translates to:
  /// **'{button} · {state}'**
  String chantSetupButtonState(String button, String state);

  /// No description provided for @chantSetupDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get chantSetupDone;

  /// No description provided for @chantAnalyticsTitle.
  ///
  /// In en, this message translates to:
  /// **'Chant analytics'**
  String get chantAnalyticsTitle;

  /// No description provided for @chantTabThisSitting.
  ///
  /// In en, this message translates to:
  /// **'This sitting'**
  String get chantTabThisSitting;

  /// No description provided for @chantTabHistory.
  ///
  /// In en, this message translates to:
  /// **'History'**
  String get chantTabHistory;

  /// No description provided for @chantMalaTitle.
  ///
  /// In en, this message translates to:
  /// **'Mala {number}'**
  String chantMalaTitle(int number);

  /// No description provided for @chantMalaInProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get chantMalaInProgress;

  /// No description provided for @chantMalaStart.
  ///
  /// In en, this message translates to:
  /// **'Start'**
  String get chantMalaStart;

  /// No description provided for @chantMalaEnd.
  ///
  /// In en, this message translates to:
  /// **'End'**
  String get chantMalaEnd;

  /// No description provided for @chantMalaDuration.
  ///
  /// In en, this message translates to:
  /// **'Duration'**
  String get chantMalaDuration;

  /// No description provided for @chantMalaChants.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 chant} other{{count} chants}}'**
  String chantMalaChants(int count);

  /// No description provided for @chantTapsHeader.
  ///
  /// In en, this message translates to:
  /// **'Every chant'**
  String get chantTapsHeader;

  /// No description provided for @chantHeardLabel.
  ///
  /// In en, this message translates to:
  /// **'Heard'**
  String get chantHeardLabel;

  /// No description provided for @chantNoMalasYet.
  ///
  /// In en, this message translates to:
  /// **'No chants yet this sitting. Each mala you complete will be listed here, with its start, end and time taken.'**
  String get chantNoMalasYet;

  /// No description provided for @chantHistoryEmpty.
  ///
  /// In en, this message translates to:
  /// **'No earlier sittings yet.'**
  String get chantHistoryEmpty;

  /// No description provided for @chantHistorySummary.
  ///
  /// In en, this message translates to:
  /// **'{malas} malas · {chants} chants'**
  String chantHistorySummary(int malas, int chants);

  /// No description provided for @chantHistoryNoDetail.
  ///
  /// In en, this message translates to:
  /// **'Counted before chant timing was recorded'**
  String get chantHistoryNoDetail;

  /// No description provided for @chantSessionTitle.
  ///
  /// In en, this message translates to:
  /// **'Sitting'**
  String get chantSessionTitle;

  /// No description provided for @chantSessionNoMalas.
  ///
  /// In en, this message translates to:
  /// **'No timed malas were recorded for this sitting.'**
  String get chantSessionNoMalas;

  /// No description provided for @chantHeardExpiry.
  ///
  /// In en, this message translates to:
  /// **'Words heard are removed from your account 7 days after the sitting.'**
  String get chantHeardExpiry;

  /// No description provided for @chantHeardTitle.
  ///
  /// In en, this message translates to:
  /// **'Heard live'**
  String get chantHeardTitle;

  /// No description provided for @chantHeardHearing.
  ///
  /// In en, this message translates to:
  /// **'Hearing you…'**
  String get chantHeardHearing;

  /// No description provided for @chantHeardWaiting.
  ///
  /// In en, this message translates to:
  /// **'Waiting for your voice'**
  String get chantHeardWaiting;

  /// No description provided for @chantHeardPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Chant out loud. The words your phone hears will appear here.'**
  String get chantHeardPlaceholder;

  /// No description provided for @chantHeardLast.
  ///
  /// In en, this message translates to:
  /// **'Last heard'**
  String get chantHeardLast;

  /// A stretch of chanting that was counted; the number is how many chants it added, e.g. "Counted +1".
  ///
  /// In en, this message translates to:
  /// **'Counted +{count}'**
  String chantHeardCounted(int count);

  /// No description provided for @chantHeardNotCounted.
  ///
  /// In en, this message translates to:
  /// **'Not counted'**
  String get chantHeardNotCounted;

  /// How near what was heard came to the mantra, and the least it needed, e.g. "72% match · needs 50%".
  ///
  /// In en, this message translates to:
  /// **'{percent}% match · needs {needed}%'**
  String chantHeardMatch(int percent, int needed);

  /// How near what was heard came to the mantra, e.g. "72% match".
  ///
  /// In en, this message translates to:
  /// **'{percent}% match'**
  String chantHeardMatchShort(int percent);

  /// No description provided for @chantHeardEarlier.
  ///
  /// In en, this message translates to:
  /// **'Earlier'**
  String get chantHeardEarlier;

  /// No description provided for @chantAlongTitle.
  ///
  /// In en, this message translates to:
  /// **'Chant along'**
  String get chantAlongTitle;

  /// No description provided for @chantAlongCaption.
  ///
  /// In en, this message translates to:
  /// **'The counter counts with the recording. Auto count and word detection rest while it plays.'**
  String get chantAlongCaption;

  /// No description provided for @chantAlongPlay.
  ///
  /// In en, this message translates to:
  /// **'Play recording'**
  String get chantAlongPlay;

  /// No description provided for @chantAlongPause.
  ///
  /// In en, this message translates to:
  /// **'Pause recording'**
  String get chantAlongPause;

  /// No description provided for @chantAlongPosition.
  ///
  /// In en, this message translates to:
  /// **'Position in the recording'**
  String get chantAlongPosition;

  /// No description provided for @chantAlongLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading the recording…'**
  String get chantAlongLoading;

  /// No description provided for @chantAlongLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'The recording couldn\'t be loaded.'**
  String get chantAlongLoadFailed;

  /// No description provided for @settingsSectionLanguages.
  ///
  /// In en, this message translates to:
  /// **'Languages'**
  String get settingsSectionLanguages;

  /// No description provided for @settingsLanguageApp.
  ///
  /// In en, this message translates to:
  /// **'App language'**
  String get settingsLanguageApp;

  /// No description provided for @settingsLanguageAppHint.
  ///
  /// In en, this message translates to:
  /// **'Menus, buttons and labels'**
  String get settingsLanguageAppHint;

  /// No description provided for @settingsLanguageReading.
  ///
  /// In en, this message translates to:
  /// **'Reading language'**
  String get settingsLanguageReading;

  /// No description provided for @settingsLanguageReadingHint.
  ///
  /// In en, this message translates to:
  /// **'Translation, meaning and purport'**
  String get settingsLanguageReadingHint;

  /// No description provided for @settingsLanguageSpeaking.
  ///
  /// In en, this message translates to:
  /// **'Speaking and hearing language'**
  String get settingsLanguageSpeaking;

  /// No description provided for @settingsLanguageSpeakingHint.
  ///
  /// In en, this message translates to:
  /// **'Audio and spoken meaning'**
  String get settingsLanguageSpeakingHint;

  /// No description provided for @settingsLanguagePickerApp.
  ///
  /// In en, this message translates to:
  /// **'Choose the app language'**
  String get settingsLanguagePickerApp;

  /// No description provided for @settingsLanguagePickerReading.
  ///
  /// In en, this message translates to:
  /// **'Choose the reading language'**
  String get settingsLanguagePickerReading;

  /// No description provided for @settingsLanguagePickerSpeaking.
  ///
  /// In en, this message translates to:
  /// **'Choose the speaking language'**
  String get settingsLanguagePickerSpeaking;

  /// No description provided for @settingsLanguageSanskritNote.
  ///
  /// In en, this message translates to:
  /// **'Sanskrit verses always stay in Sanskrit.'**
  String get settingsLanguageSanskritNote;

  /// No description provided for @readingAudioPlayAll.
  ///
  /// In en, this message translates to:
  /// **'Read aloud'**
  String get readingAudioPlayAll;

  /// No description provided for @readingAudioPlayVerse.
  ///
  /// In en, this message translates to:
  /// **'Play this verse'**
  String get readingAudioPlayVerse;

  /// No description provided for @readingAudioPause.
  ///
  /// In en, this message translates to:
  /// **'Pause'**
  String get readingAudioPause;

  /// No description provided for @readingAudioResume.
  ///
  /// In en, this message translates to:
  /// **'Resume'**
  String get readingAudioResume;

  /// No description provided for @readingAudioStop.
  ///
  /// In en, this message translates to:
  /// **'Stop'**
  String get readingAudioStop;

  /// No description provided for @readingAudioNext.
  ///
  /// In en, this message translates to:
  /// **'Next verse'**
  String get readingAudioNext;

  /// No description provided for @readingAudioPrevious.
  ///
  /// In en, this message translates to:
  /// **'Previous verse'**
  String get readingAudioPrevious;

  /// No description provided for @readingAudioFromStart.
  ///
  /// In en, this message translates to:
  /// **'From the beginning'**
  String get readingAudioFromStart;

  /// No description provided for @readingAudioResumeFrom.
  ///
  /// In en, this message translates to:
  /// **'Resume from verse {number}'**
  String readingAudioResumeFrom(int number);

  /// No description provided for @readingAudioNowPlaying.
  ///
  /// In en, this message translates to:
  /// **'{section} · verse {number}'**
  String readingAudioNowPlaying(String section, int number);

  /// No description provided for @readingAudioLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get readingAudioLoading;

  /// No description provided for @readingAudioChannel.
  ///
  /// In en, this message translates to:
  /// **'Reading aloud'**
  String get readingAudioChannel;

  /// Name of the Android notification channel the daily sloka and other pushes arrive on; shown in the phone's notification settings.
  ///
  /// In en, this message translates to:
  /// **'Daily sloka and updates'**
  String get pushChannelName;

  /// No description provided for @readingSectionVerse.
  ///
  /// In en, this message translates to:
  /// **'Verse'**
  String get readingSectionVerse;

  /// No description provided for @readingSectionMeaning.
  ///
  /// In en, this message translates to:
  /// **'Meaning'**
  String get readingSectionMeaning;

  /// No description provided for @readingSectionPurport.
  ///
  /// In en, this message translates to:
  /// **'Purport'**
  String get readingSectionPurport;

  /// No description provided for @settingsVoices.
  ///
  /// In en, this message translates to:
  /// **'Voices'**
  String get settingsVoices;

  /// No description provided for @settingsVoicesValue.
  ///
  /// In en, this message translates to:
  /// **'{count} installed'**
  String settingsVoicesValue(int count);

  /// No description provided for @voicesTitle.
  ///
  /// In en, this message translates to:
  /// **'Voices'**
  String get voicesTitle;

  /// No description provided for @voicesIntro.
  ///
  /// In en, this message translates to:
  /// **'Meanings and purports are read aloud in your speaking language. Until a voice is downloaded your phone\'s own voice is used, so reading never waits.'**
  String get voicesIntro;

  /// No description provided for @voicesStorage.
  ///
  /// In en, this message translates to:
  /// **'Using {size} on this phone'**
  String voicesStorage(String size);

  /// No description provided for @voicesEmpty.
  ///
  /// In en, this message translates to:
  /// **'No voices are available to download yet. Your phone\'s own voice is used.'**
  String get voicesEmpty;

  /// No description provided for @voiceDownload.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get voiceDownload;

  /// No description provided for @voiceDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get voiceDelete;

  /// No description provided for @voiceCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get voiceCancel;

  /// No description provided for @voiceRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get voiceRetry;

  /// No description provided for @voiceInstalled.
  ///
  /// In en, this message translates to:
  /// **'Installed · {size}'**
  String voiceInstalled(String size);

  /// No description provided for @voiceNotInstalled.
  ///
  /// In en, this message translates to:
  /// **'Not downloaded · {size}'**
  String voiceNotInstalled(String size);

  /// No description provided for @voiceDownloading.
  ///
  /// In en, this message translates to:
  /// **'Downloading {percent}%'**
  String voiceDownloading(int percent);

  /// No description provided for @voiceVerifying.
  ///
  /// In en, this message translates to:
  /// **'Checking…'**
  String get voiceVerifying;

  /// No description provided for @voiceExtracting.
  ///
  /// In en, this message translates to:
  /// **'Installing…'**
  String get voiceExtracting;

  /// No description provided for @voiceFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not install this voice'**
  String get voiceFailed;

  /// No description provided for @voiceUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Not available yet · uses your phone\'s voice'**
  String get voiceUnavailable;

  /// No description provided for @voiceDeleteTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete this voice?'**
  String get voiceDeleteTitle;

  /// No description provided for @voiceDeleteBody.
  ///
  /// In en, this message translates to:
  /// **'It can be downloaded again. Until then your phone\'s own voice is used.'**
  String get voiceDeleteBody;

  /// No description provided for @voiceLanguages.
  ///
  /// In en, this message translates to:
  /// **'Speaks {languages}'**
  String voiceLanguages(String languages);

  /// No description provided for @labelVerseWithSection.
  ///
  /// In en, this message translates to:
  /// **'Verse {number} · {section}'**
  String labelVerseWithSection(int number, String section);

  /// Title of the Ask Sakha screen.
  ///
  /// In en, this message translates to:
  /// **'Ask Sakha'**
  String get chatTitle;

  /// Heading of the card on Home that opens Ask Sakha.
  ///
  /// In en, this message translates to:
  /// **'Ask Sakha'**
  String get chatHomeTitle;

  /// Second line of the card on Home that opens Ask Sakha.
  ///
  /// In en, this message translates to:
  /// **'Questions on scripture, mantras and your practice'**
  String get chatHomeBody;

  /// Heading of the welcome shown when the chat has no messages yet.
  ///
  /// In en, this message translates to:
  /// **'Your friend Sakha'**
  String get chatIntroTitle;

  /// Hint under the introduction in an empty chat.
  ///
  /// In en, this message translates to:
  /// **'Ask about a verse, a mantra or your practice.'**
  String get chatIntroHint;

  /// Placeholder in the box where a question to Sakha is typed.
  ///
  /// In en, this message translates to:
  /// **'Ask a question'**
  String get chatComposerHint;

  /// Tooltip of the send button in the chat box.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get chatSend;

  /// Tooltip of the stop button that ends a reply being written.
  ///
  /// In en, this message translates to:
  /// **'Stop'**
  String get chatStop;

  /// Characters typed against the most a message may have. Shown near the limit.
  ///
  /// In en, this message translates to:
  /// **'{count} / {max}'**
  String chatCharacterCount(int count, int max);

  /// The credit meter: how much of the reader's credit is left, as a percentage.
  ///
  /// In en, this message translates to:
  /// **'{percent}% left'**
  String chatCreditsLeft(int percent);

  /// The credit meter with the reader's level name after it (the level is a name set in the admin panel).
  ///
  /// In en, this message translates to:
  /// **'{percent}% left · {level}'**
  String chatCreditsLeftLevel(int percent, String level);

  /// Hint by the credit meter when today's allowance is what limits the reader.
  ///
  /// In en, this message translates to:
  /// **'Resets at midnight'**
  String get chatCreditsResetsMidnight;

  /// Hint by the credit meter: the day the plan's credits renew.
  ///
  /// In en, this message translates to:
  /// **'Renews {date}'**
  String chatCreditsRenews(DateTime date);

  /// Heading of the card shown when the reader's plan has no Ask Sakha.
  ///
  /// In en, this message translates to:
  /// **'Chat is not part of your plan'**
  String get chatNotAvailableTitle;

  /// Body of the card shown when the reader's plan has no Ask Sakha.
  ///
  /// In en, this message translates to:
  /// **'Upgrade your plan to ask Sakha your questions.'**
  String get chatNotAvailableBody;

  /// Heading of the card shown when the daily allowance of Ask Sakha credits is used up.
  ///
  /// In en, this message translates to:
  /// **'You have used today\'s credits'**
  String get chatExhaustedDailyTitle;

  /// Body of the card shown when the daily allowance of Ask Sakha credits is used up.
  ///
  /// In en, this message translates to:
  /// **'They refill at midnight. You can carry on then, or upgrade for more.'**
  String get chatExhaustedDailyBody;

  /// Heading of the card shown when the plan's Ask Sakha credits are used up.
  ///
  /// In en, this message translates to:
  /// **'Your credits have run out'**
  String get chatExhaustedWalletTitle;

  /// Body of the card shown when the plan's Ask Sakha credits are used up.
  ///
  /// In en, this message translates to:
  /// **'They renew with your plan. You can wait, or upgrade to keep going.'**
  String get chatExhaustedWalletBody;

  /// Heading of the card shown when one conversation has used the share of credits allowed to it.
  ///
  /// In en, this message translates to:
  /// **'This chat has used its share of credits'**
  String get chatShareUsedTitle;

  /// Body of the card shown when one conversation has used the share of credits allowed to it.
  ///
  /// In en, this message translates to:
  /// **'Start a new chat and Sakha will carry on from where you were.'**
  String get chatShareUsedBody;

  /// Button on the out-of-credits card that opens the plans screen.
  ///
  /// In en, this message translates to:
  /// **'Upgrade'**
  String get chatUpgrade;

  /// Button that opens a new chat carrying the summary of the full one.
  ///
  /// In en, this message translates to:
  /// **'Start a new chat'**
  String get chatStartNewChat;

  /// Heading of the banner shown in place of the message box when a chat has reached its limit.
  ///
  /// In en, this message translates to:
  /// **'This chat has grown long'**
  String get chatFullTitle;

  /// Body of the banner shown when a chat has reached its limit.
  ///
  /// In en, this message translates to:
  /// **'Start a new chat and Sakha will carry our conversation forward.'**
  String get chatFullBody;

  /// Shown after starting a new chat when credits did not stretch to summarising the latest messages.
  ///
  /// In en, this message translates to:
  /// **'Your latest messages could not be summarised, so only the earlier part came along.'**
  String get chatContinuePartial;

  /// Shown while Sakha folds older messages into a summary.
  ///
  /// In en, this message translates to:
  /// **'Tidying our conversation…'**
  String get chatTidying;

  /// Spoken label of the three dots shown while a reply is awaited.
  ///
  /// In en, this message translates to:
  /// **'Sakha is writing'**
  String get chatTyping;

  /// Shown when the connection was cut while a reply was being written (or could not be kept), beside Try again.
  ///
  /// In en, this message translates to:
  /// **'The connection was interrupted. Please try again.'**
  String get chatConnectionLost;

  /// Shown when the server could not finish writing a reply.
  ///
  /// In en, this message translates to:
  /// **'Sakha could not finish that reply. Please try again.'**
  String get chatReplyFailed;

  /// Shown when Sakha's side is overloaded or a rate limit was reached; asking again in a moment usually works.
  ///
  /// In en, this message translates to:
  /// **'Sakha is busy right now. Please try again in a moment.'**
  String get chatOverloaded;

  /// Shown when Sakha cannot answer for now: the server could not reach its provider, or a spending limit was reached. Only waiting helps.
  ///
  /// In en, this message translates to:
  /// **'Sakha is not available right now. Please try again a little later.'**
  String get chatUnavailable;

  /// Shown when a question is sent while another reply is still being written.
  ///
  /// In en, this message translates to:
  /// **'Please wait for the current reply to finish.'**
  String get chatBusy;

  /// Shown when a question is longer than Sakha accepts.
  ///
  /// In en, this message translates to:
  /// **'That message is too long. Please shorten it.'**
  String get chatTooLong;

  /// Small note under a reply the reader stopped.
  ///
  /// In en, this message translates to:
  /// **'Stopped'**
  String get chatStopped;

  /// Small note under a reply that was cut off before it ended.
  ///
  /// In en, this message translates to:
  /// **'Interrupted'**
  String get chatInterrupted;

  /// Tooltip of the button that copies a reply.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get chatCopy;

  /// Message after a reply is copied.
  ///
  /// In en, this message translates to:
  /// **'Copied'**
  String get chatCopied;

  /// Tooltip of the button that shares a reply.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get chatShare;

  /// Tooltip of the button that asks for the last reply again.
  ///
  /// In en, this message translates to:
  /// **'Answer again'**
  String get chatRegenerate;

  /// Message after a link in a reply is tapped and copied.
  ///
  /// In en, this message translates to:
  /// **'Link copied'**
  String get chatLinkCopied;

  /// Shown in place of an image in a reply that could not be loaded.
  ///
  /// In en, this message translates to:
  /// **'Image unavailable'**
  String get chatImageUnavailable;

  /// Tooltip and label of the button that clears the whole chat with Sakha.
  ///
  /// In en, this message translates to:
  /// **'Clear chat'**
  String get chatClearTooltip;

  /// Title of the confirmation before the chat with Sakha is cleared.
  ///
  /// In en, this message translates to:
  /// **'Clear this chat?'**
  String get chatClearTitle;

  /// Body of the confirmation before the chat is cleared. Clearing also wipes what Sakha remembers of the conversation.
  ///
  /// In en, this message translates to:
  /// **'Your messages and the replies Sakha gave are removed, and Sakha will not remember what we talked about. Credits already used are not returned.'**
  String get chatClearBody;

  /// Confirm button of the clear-chat dialog.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get chatClearConfirm;

  /// Brief message shown after the chat has been cleared.
  ///
  /// In en, this message translates to:
  /// **'Chat cleared'**
  String get chatCleared;

  /// Small heading above the suggestion cards on an empty chat.
  ///
  /// In en, this message translates to:
  /// **'Try asking'**
  String get chatSuggestionsLabel;

  /// Title of the first suggestion card on an empty chat (a verse from the Gita).
  ///
  /// In en, this message translates to:
  /// **'A verse to live by'**
  String get chatStarter1Title;

  /// Question sent to Sakha when the first suggestion card is tapped. BG 2.47 is the verse on acting without attachment to results.
  ///
  /// In en, this message translates to:
  /// **'Explain Bhagavad Gita 2.47 to me, about doing my duty without worrying about the result.'**
  String get chatStarter1Prompt;

  /// Title of the second suggestion card on an empty chat.
  ///
  /// In en, this message translates to:
  /// **'Begin chanting'**
  String get chatStarter2Title;

  /// Question sent to Sakha when the second suggestion card is tapped. A round is one mala.
  ///
  /// In en, this message translates to:
  /// **'How do I begin chanting the Hare Krishna mahamantra, and how many rounds should I start with?'**
  String get chatStarter2Prompt;

  /// Title of the third suggestion card on an empty chat.
  ///
  /// In en, this message translates to:
  /// **'A daily practice'**
  String get chatStarter3Title;

  /// Question sent to Sakha when the third suggestion card is tapped. Sadhana is daily spiritual practice.
  ///
  /// In en, this message translates to:
  /// **'Suggest a simple daily sadhana I can keep, even on a busy day.'**
  String get chatStarter3Prompt;

  /// Title of the fourth suggestion card on an empty chat.
  ///
  /// In en, this message translates to:
  /// **'When the mind is restless'**
  String get chatStarter4Title;

  /// Question sent to Sakha when the fourth suggestion card is tapped.
  ///
  /// In en, this message translates to:
  /// **'My mind feels restless. What do the scriptures say about finding peace?'**
  String get chatStarter4Prompt;

  /// Title of the fifth suggestion card on an empty chat.
  ///
  /// In en, this message translates to:
  /// **'A story to hear'**
  String get chatStarter5Title;

  /// Question sent to Sakha when the fifth suggestion card is tapped.
  ///
  /// In en, this message translates to:
  /// **'Tell me the story of Prahlada and what it teaches.'**
  String get chatStarter5Prompt;

  /// Quick reply chip under Sakha's answer. Tapping it sends this text as the next message.
  ///
  /// In en, this message translates to:
  /// **'Explain simply'**
  String get chatFollowUp1;

  /// Quick reply chip under Sakha's answer. Tapping it sends this text as the next message.
  ///
  /// In en, this message translates to:
  /// **'Give an example'**
  String get chatFollowUp2;

  /// Quick reply chip under Sakha's answer. Tapping it sends this text as the next message.
  ///
  /// In en, this message translates to:
  /// **'Why does this matter?'**
  String get chatFollowUp3;

  /// Quick reply chip under Sakha's answer. Tapping it sends this text as the next message.
  ///
  /// In en, this message translates to:
  /// **'How do I practise this?'**
  String get chatFollowUp4;

  /// Tooltip of the button beside the message box that adds a picture.
  ///
  /// In en, this message translates to:
  /// **'Add a picture'**
  String get chatAttach;

  /// Option in the add-a-picture sheet that opens the camera.
  ///
  /// In en, this message translates to:
  /// **'Take a photo'**
  String get chatAttachCamera;

  /// Option in the add-a-picture sheet that opens the photo library.
  ///
  /// In en, this message translates to:
  /// **'Choose from your photos'**
  String get chatAttachGallery;

  /// Privacy note at the foot of the add-a-picture sheet.
  ///
  /// In en, this message translates to:
  /// **'The picture is shared with the service that helps write replies, and stays in this chat until you clear it.'**
  String get chatAttachNote;

  /// Tooltip of the button that removes the picture waiting in the message box.
  ///
  /// In en, this message translates to:
  /// **'Remove picture'**
  String get chatImageRemove;

  /// Shown on the picture in the message box while it is being uploaded.
  ///
  /// In en, this message translates to:
  /// **'Adding picture…'**
  String get chatImageUploading;

  /// Shown on the picture in the message box when the upload did not go through.
  ///
  /// In en, this message translates to:
  /// **'The picture could not be added. Tap to try again.'**
  String get chatImageFailed;

  /// Shown when the server cannot use the picture: not readable as a picture, or too large.
  ///
  /// In en, this message translates to:
  /// **'That picture cannot be used. Please choose another.'**
  String get chatImageRejected;

  /// Shown when the reader's plan or the settings have pictures switched off.
  ///
  /// In en, this message translates to:
  /// **'Pictures are not available on your plan.'**
  String get chatImageOff;

  /// Screen-reader label of a picture inside the reader's own message.
  ///
  /// In en, this message translates to:
  /// **'Picture you sent'**
  String get chatImageSemantics;

  /// Shown when the reader has refused camera or photo access.
  ///
  /// In en, this message translates to:
  /// **'Allow access to your camera or photos in your phone\'s Settings to add a picture.'**
  String get chatPictureDenied;

  /// Tooltip of the microphone button beside the message box.
  ///
  /// In en, this message translates to:
  /// **'Speak your question'**
  String get chatMic;

  /// Tooltip of the microphone button while the phone is listening.
  ///
  /// In en, this message translates to:
  /// **'Stop listening'**
  String get chatMicStop;

  /// Shown in the message box while the phone is listening to the reader.
  ///
  /// In en, this message translates to:
  /// **'Listening…'**
  String get chatListening;

  /// Shown when the reader has refused microphone or speech recognition access.
  ///
  /// In en, this message translates to:
  /// **'Allow the microphone and speech recognition in your phone\'s Settings to speak your question.'**
  String get chatMicDenied;

  /// Shown when the phone has no speech recogniser to use.
  ///
  /// In en, this message translates to:
  /// **'Speaking is not available on this phone.'**
  String get chatMicUnavailable;

  /// Shown when listening ended without any words.
  ///
  /// In en, this message translates to:
  /// **'Nothing was heard. Please try again.'**
  String get chatMicNoSpeech;

  /// Shown when the phone's speech recogniser gave up part-way.
  ///
  /// In en, this message translates to:
  /// **'Listening stopped. Please try again.'**
  String get chatMicFailed;

  /// Label of the button that scrolls the chat back down to the newest message.
  ///
  /// In en, this message translates to:
  /// **'Latest'**
  String get chatJumpToLatest;

  /// Tooltip of the peacock-feather button on a verse that starts book reels from that verse.
  ///
  /// In en, this message translates to:
  /// **'Watch reels from this verse'**
  String get verseStartReels;

  /// Hint on a chanting reel in the feed: each tap counts one chant.
  ///
  /// In en, this message translates to:
  /// **'Tap to chant'**
  String get reelChantTapHint;

  /// Shown on a chanting reel when the 108th chant is counted, just before the feed moves on.
  ///
  /// In en, this message translates to:
  /// **'Round complete'**
  String get reelChantDone;

  /// Hint on a chanting reel: swiping goes on to the next reel without finishing.
  ///
  /// In en, this message translates to:
  /// **'Swipe up to skip'**
  String get reelChantSkipHint;

  /// Chants counted of the round on a chanting reel, like 12 / 108.
  ///
  /// In en, this message translates to:
  /// **'{count} / {total}'**
  String reelChantCount(int count, int total);

  /// Tooltip of the button on a verse that asks Sakha to explain it.
  ///
  /// In en, this message translates to:
  /// **'Ask Sakha about this verse'**
  String get verseAskSakha;

  /// The message sent to Sakha from a verse. {reference} is like "Bhagavad Gita 2.47"; {verse} is the verse text.
  ///
  /// In en, this message translates to:
  /// **'Please explain this verse to me in simple words — {reference}:\n\n{verse}'**
  String chatExplainVerse(String reference, String verse);

  /// Asks the reader to confirm before the app opens a place Sakha suggested. {place} is its name, like "Reels".
  ///
  /// In en, this message translates to:
  /// **'Open {place}?'**
  String chatActionQuestion(String place);

  /// Button that confirms opening what Sakha suggested.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get chatActionOpen;

  /// Button that declines what Sakha suggested.
  ///
  /// In en, this message translates to:
  /// **'Not now'**
  String get chatActionNotNow;

  /// No description provided for @searchTabAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get searchTabAll;

  /// No description provided for @searchAllBooks.
  ///
  /// In en, this message translates to:
  /// **'All books'**
  String get searchAllBooks;

  /// Shown above search results when the typed words were read as a different spelling; query is the spelling used.
  ///
  /// In en, this message translates to:
  /// **'Showing results for “{query}”'**
  String searchShowingFor(String query);

  /// Empty search result while the search is limited to one book; book is its title.
  ///
  /// In en, this message translates to:
  /// **'Nothing found in {book}. Try all books, or another spelling.'**
  String searchNoResultsInBook(String book);

  /// No description provided for @searchTipsTitle.
  ///
  /// In en, this message translates to:
  /// **'Search tips'**
  String get searchTipsTitle;

  /// No description provided for @searchTipSpelling.
  ///
  /// In en, this message translates to:
  /// **'Spell it as it sounds. “krishna”, “krsna” and “kṛṣṇa” all find the same verses.'**
  String get searchTipSpelling;

  /// No description provided for @searchTipBook.
  ///
  /// In en, this message translates to:
  /// **'Start with a book — “gita karma” or “bhagavatam surrender” — to search only in it.'**
  String get searchTipBook;

  /// No description provided for @searchTipPartial.
  ///
  /// In en, this message translates to:
  /// **'Type a few words of the verse, its meaning or the purport. Small slips are forgiven.'**
  String get searchTipPartial;

  /// Settings: title of the group that holds the Sources & disclaimer row.
  ///
  /// In en, this message translates to:
  /// **'About'**
  String get settingsSectionAbout;

  /// Settings row, and the title of the screen it opens: where the texts come from, who wrote them, and the notice that other languages are AI-assisted translations.
  ///
  /// In en, this message translates to:
  /// **'Sources & disclaimer'**
  String get sourcesTitle;

  /// Sources & disclaimer: the opening paragraph.
  ///
  /// In en, this message translates to:
  /// **'HariHariBol offers the sacred texts for daily reading and chanting. We are grateful to the ācāryas, translators and scholars whose work makes this possible. This page sets out where the texts come from and how they are presented.'**
  String get sourcesIntro;

  /// Sources & disclaimer: heading over who the translations and commentaries belong to.
  ///
  /// In en, this message translates to:
  /// **'Translations and commentaries'**
  String get sourcesTextsHeading;

  /// Sources & disclaimer: Śrīla Prabhupāda's credit and the BBT copyright line. Shown only while AppConfig.showAuthorName is on. Keep the copyright holder's name in Latin.
  ///
  /// In en, this message translates to:
  /// **'The English translations and purports of Bhagavad-gītā As It Is and Śrīmad-Bhāgavatam are the work of His Divine Grace A. C. Bhaktivedanta Swami Prabhupāda, Founder-Ācārya of the International Society for Krishna Consciousness. © The Bhaktivedanta Book Trust International, Inc.'**
  String get sourcesAuthorCredit;

  /// Sources & disclaimer: rights in every translation stay with its authors and publishers.
  ///
  /// In en, this message translates to:
  /// **'Every translation, purport and commentary is the work of its author, and all rights in it remain with its authors and publishers. They are reproduced here for personal devotional study, not for redistribution.'**
  String get sourcesTextsBody;

  /// Sources & disclaimer: heading over the list of sources. Each entry has its web address under it.
  ///
  /// In en, this message translates to:
  /// **'Where the texts come from'**
  String get sourcesFromHeading;

  /// Sources & disclaimer: what was taken for the Bhagavad-gītā. Its address is shown under it.
  ///
  /// In en, this message translates to:
  /// **'Bhagavad-gītā: the Sanskrit text, the English translation and purports, and the commentaries of Śrī Rāmānujācārya, Śrī Madhvācārya and Śrīdhara Svāmī'**
  String get sourcesGita;

  /// Sources & disclaimer: what was taken for a range of Śrīmad-Bhāgavatam cantos. Its address is shown under it.
  ///
  /// In en, this message translates to:
  /// **'Śrīmad-Bhāgavatam, Cantos {from}–{to}: the Sanskrit text, the English translation and purports'**
  String sourcesBhagavatam(int from, int to);

  /// Sources & disclaimer: the Dnyāneshwarī. Its address is shown under it.
  ///
  /// In en, this message translates to:
  /// **'Dnyāneshwarī: Sant Dnyāneshwar’s Marathi ovīs on the Bhagavad-gītā'**
  String get sourcesDnyaneshwari;

  /// Sources & disclaimer: heading over the notice about AI-assisted translations.
  ///
  /// In en, this message translates to:
  /// **'Translations into other languages'**
  String get sourcesAiHeading;

  /// Sources & disclaimer: the other languages are prepared from English with AI and may contain errors.
  ///
  /// In en, this message translates to:
  /// **'Text in Hindi, Marathi and the other Indian languages — translations, purports and the app’s own wording — has been prepared from the English with the help of AI. It is not an official or authorised translation and may contain errors, which we correct as they are found. For study, the Sanskrit and the original English remain the authority.'**
  String get sourcesAiBody;

  /// Sources & disclaimer, under the "Ask Sakha" heading: Sakha is a digital companion. Do not call Sakha an AI, an assistant or a bot.
  ///
  /// In en, this message translates to:
  /// **'Sakha is a digital companion, not a teacher. Its replies are not the words of any ācārya and can be mistaken; please check anything important against the texts.'**
  String get sourcesSakhaBody;

  /// Sources & disclaimer: heading over the no-affiliation statement.
  ///
  /// In en, this message translates to:
  /// **'An independent project'**
  String get sourcesIndependentHeading;

  /// Sources & disclaimer: the app is not affiliated with any temple, organisation or publisher.
  ///
  /// In en, this message translates to:
  /// **'HariHariBol is an independent devotional project. It is not affiliated with, endorsed by or speaking for any temple, organisation or publisher.'**
  String get sourcesIndependentBody;

  /// Sources & disclaimer: heading over how to write about rights or mistakes. The email address follows.
  ///
  /// In en, this message translates to:
  /// **'Rights and corrections'**
  String get sourcesContactHeading;

  /// Sources & disclaimer: whom to write to about rights in a text, or a mistake. The email address follows.
  ///
  /// In en, this message translates to:
  /// **'If you hold rights in any text shown here, or find a mistake in one, please write to us. We will reply promptly and, where asked, correct or remove it.'**
  String get sourcesContactBody;

  /// Title of the share sheet, and the tooltip of the share buttons.
  ///
  /// In en, this message translates to:
  /// **'Share'**
  String get shareTitle;

  /// No description provided for @shareAsText.
  ///
  /// In en, this message translates to:
  /// **'Share as text'**
  String get shareAsText;

  /// No description provided for @shareCopied.
  ///
  /// In en, this message translates to:
  /// **'Copied'**
  String get shareCopied;

  /// No description provided for @shareCopyLink.
  ///
  /// In en, this message translates to:
  /// **'Copy link'**
  String get shareCopyLink;

  /// No description provided for @shareFailed.
  ///
  /// In en, this message translates to:
  /// **'We couldn’t share this. Please try again.'**
  String get shareFailed;

  /// No description provided for @shareImageTooBig.
  ///
  /// In en, this message translates to:
  /// **'That picture is too large. Please choose a smaller one.'**
  String get shareImageTooBig;

  /// No description provided for @shareLinkShare.
  ///
  /// In en, this message translates to:
  /// **'Share link'**
  String get shareLinkShare;

  /// No description provided for @shareMakeIt.
  ///
  /// In en, this message translates to:
  /// **'Create'**
  String get shareMakeIt;

  /// Makes a background picture for the share card with the reader's Ask Sakha credit.
  ///
  /// In en, this message translates to:
  /// **'Make a picture'**
  String get shareMakePicture;

  /// No description provided for @sharePickPicture.
  ///
  /// In en, this message translates to:
  /// **'Choose a picture'**
  String get sharePickPicture;

  /// How much of the day's Ask Sakha credit a picture uses. Keep the product name Sakha as it is.
  ///
  /// In en, this message translates to:
  /// **'Uses about {percent}% of your Sakha credit'**
  String sharePictureCost(int percent);

  /// No description provided for @sharePictureFailed.
  ///
  /// In en, this message translates to:
  /// **'The picture could not be made. Your credit was returned.'**
  String get sharePictureFailed;

  /// No description provided for @sharePictureNoCredit.
  ///
  /// In en, this message translates to:
  /// **'Your Sakha credit for today is used up.'**
  String get sharePictureNoCredit;

  /// No description provided for @sharePicturePrompt.
  ///
  /// In en, this message translates to:
  /// **'Describe the picture'**
  String get sharePicturePrompt;

  /// No description provided for @sharePictureShare.
  ///
  /// In en, this message translates to:
  /// **'Share picture'**
  String get sharePictureShare;

  /// No description provided for @shareRemovePicture.
  ///
  /// In en, this message translates to:
  /// **'Remove picture'**
  String get shareRemovePicture;

  /// No description provided for @shareShowMeaning.
  ///
  /// In en, this message translates to:
  /// **'Meaning'**
  String get shareShowMeaning;

  /// No description provided for @shareShowTransliteration.
  ///
  /// In en, this message translates to:
  /// **'Transliteration'**
  String get shareShowTransliteration;

  /// No description provided for @shareTextSize.
  ///
  /// In en, this message translates to:
  /// **'Text size'**
  String get shareTextSize;

  /// Shown when a shared link has been withdrawn or never existed.
  ///
  /// In en, this message translates to:
  /// **'This link is no longer available.'**
  String get shareLinkGone;

  /// No description provided for @settingsRefer.
  ///
  /// In en, this message translates to:
  /// **'Refer and earn'**
  String get settingsRefer;

  /// No description provided for @referTitle.
  ///
  /// In en, this message translates to:
  /// **'Refer and earn'**
  String get referTitle;

  /// Under the Refer and earn title. {days} is the length of the reward in days; Ārta is the name of a plan and stays in Latin letters.
  ///
  /// In en, this message translates to:
  /// **'Invite a friend. When they finish their first round of chanting, you receive {days} days of Ārta, free.'**
  String referIntro(int days);

  /// No description provided for @referYourCode.
  ///
  /// In en, this message translates to:
  /// **'Your invite code'**
  String get referYourCode;

  /// No description provided for @referInvite.
  ///
  /// In en, this message translates to:
  /// **'Invite a friend'**
  String get referInvite;

  /// The text sent with an invitation. {url} is the invitation link, placed where the sentence ends.
  ///
  /// In en, this message translates to:
  /// **'Join me on HariHariBol: verses, mantras and chanting in one place. {url}'**
  String referInviteMessage(String url);

  /// {date} is a formatted date. Ārta is the name of a plan and stays in Latin letters.
  ///
  /// In en, this message translates to:
  /// **'Ārta is yours until {date}'**
  String referActiveUntil(String date);

  /// No description provided for @referStatInvited.
  ///
  /// In en, this message translates to:
  /// **'Invited'**
  String get referStatInvited;

  /// No description provided for @referStatWaiting.
  ///
  /// In en, this message translates to:
  /// **'Waiting'**
  String get referStatWaiting;

  /// No description provided for @referStatRewarded.
  ///
  /// In en, this message translates to:
  /// **'Rewarded'**
  String get referStatRewarded;

  /// No description provided for @referNone.
  ///
  /// In en, this message translates to:
  /// **'No invitations yet.'**
  String get referNone;

  /// No description provided for @referEnterCode.
  ///
  /// In en, this message translates to:
  /// **'Have a friend’s code?'**
  String get referEnterCode;

  /// No description provided for @referUseCode.
  ///
  /// In en, this message translates to:
  /// **'Use code'**
  String get referUseCode;

  /// Shown after the reader enters a friend's code. The friend is rewarded once the reader finishes a round of chanting.
  ///
  /// In en, this message translates to:
  /// **'Code accepted. Finish a round of chanting so your friend receives their reward.'**
  String get referAccepted;

  /// No description provided for @referRefused.
  ///
  /// In en, this message translates to:
  /// **'This code can’t be used.'**
  String get referRefused;

  /// Button in the share studio that turns the card into a reel everyone can watch.
  ///
  /// In en, this message translates to:
  /// **'Make reel'**
  String get shareMakeReel;

  /// No description provided for @shareReelIntro.
  ///
  /// In en, this message translates to:
  /// **'Your card becomes a reel that everyone in Reels can watch.'**
  String get shareReelIntro;

  /// No description provided for @shareReelAddMusic.
  ///
  /// In en, this message translates to:
  /// **'Add music from your phone'**
  String get shareReelAddMusic;

  /// The music file chosen for the reel.
  ///
  /// In en, this message translates to:
  /// **'Music: {name}'**
  String shareReelMusic(String name);

  /// No description provided for @shareReelRemoveMusic.
  ///
  /// In en, this message translates to:
  /// **'Remove music'**
  String get shareReelRemoveMusic;

  /// No description provided for @shareReelPost.
  ///
  /// In en, this message translates to:
  /// **'Post reel'**
  String get shareReelPost;

  /// No description provided for @shareReelPosting.
  ///
  /// In en, this message translates to:
  /// **'Posting your reel…'**
  String get shareReelPosting;

  /// No description provided for @shareReelDone.
  ///
  /// In en, this message translates to:
  /// **'Your reel is live. Find it in Reels.'**
  String get shareReelDone;

  /// No description provided for @shareReelFailed.
  ///
  /// In en, this message translates to:
  /// **'The reel could not be posted. Please try again.'**
  String get shareReelFailed;

  /// No description provided for @shareReelTooBig.
  ///
  /// In en, this message translates to:
  /// **'That music file is too large (up to 25 MB).'**
  String get shareReelTooBig;

  /// No description provided for @calendarTitle.
  ///
  /// In en, this message translates to:
  /// **'Hindu calendar'**
  String get calendarTitle;

  /// No description provided for @calendarEmpty.
  ///
  /// In en, this message translates to:
  /// **'The calendar for this month is not filled in yet.'**
  String get calendarEmpty;

  /// No description provided for @calendarUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Ekadashi, Chaturthi and festival days'**
  String get calendarUpcoming;

  /// No description provided for @calendarVaishnavaNote.
  ///
  /// In en, this message translates to:
  /// **'Vaishnavas may keep this fast the next day.'**
  String get calendarVaishnavaNote;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) => <String>[
    'as',
    'bn',
    'en',
    'gu',
    'hi',
    'kn',
    'ml',
    'mr',
    'or',
    'pa',
    'ta',
    'te',
  ].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'as':
      return AppLocalizationsAs();
    case 'bn':
      return AppLocalizationsBn();
    case 'en':
      return AppLocalizationsEn();
    case 'gu':
      return AppLocalizationsGu();
    case 'hi':
      return AppLocalizationsHi();
    case 'kn':
      return AppLocalizationsKn();
    case 'ml':
      return AppLocalizationsMl();
    case 'mr':
      return AppLocalizationsMr();
    case 'or':
      return AppLocalizationsOr();
    case 'pa':
      return AppLocalizationsPa();
    case 'ta':
      return AppLocalizationsTa();
    case 'te':
      return AppLocalizationsTe();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
