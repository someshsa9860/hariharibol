import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';

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
  static const List<Locale> supportedLocales = <Locale>[Locale('en')];

  /// The application name.
  ///
  /// In en, this message translates to:
  /// **'HariHariBol'**
  String get appName;

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

  /// No description provided for @homeMoodPrompt.
  ///
  /// In en, this message translates to:
  /// **'How are you today?'**
  String get homeMoodPrompt;

  /// No description provided for @homeMoodAnsweredToday.
  ///
  /// In en, this message translates to:
  /// **'You\'ve shared how you\'re feeling today. Come back tomorrow to share something new.'**
  String get homeMoodAnsweredToday;

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

  /// No description provided for @routineSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Devotion, work and the ordinary in between.'**
  String get routineSubtitle;

  /// No description provided for @routineProgress.
  ///
  /// In en, this message translates to:
  /// **'{done} of {total} done today'**
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

  /// No description provided for @routineSlotLabel.
  ///
  /// In en, this message translates to:
  /// **'Time of day'**
  String get routineSlotLabel;

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

  /// No description provided for @routineSaveAction.
  ///
  /// In en, this message translates to:
  /// **'Add to today'**
  String get routineSaveAction;

  /// No description provided for @routineTaskRemoved.
  ///
  /// In en, this message translates to:
  /// **'Removed from today\'s list'**
  String get routineTaskRemoved;

  /// No description provided for @routineUndo.
  ///
  /// In en, this message translates to:
  /// **'Undo'**
  String get routineUndo;

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

  /// No description provided for @reelSlideOf.
  ///
  /// In en, this message translates to:
  /// **'{current} of {total}'**
  String reelSlideOf(int current, int total);

  /// A verse reference on a reel, e.g. BG 2.47
  ///
  /// In en, this message translates to:
  /// **'{book} {chapter}.{verse}'**
  String reelVerseRef(String book, int chapter, int verse);

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
  /// **'Microphone and speech access are needed'**
  String get chantDetectWordsPermission;

  /// No description provided for @chantDetectWordsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Word detection isn\'t available on this device'**
  String get chantDetectWordsUnavailable;

  /// No description provided for @chantDetectWordsNote.
  ///
  /// In en, this message translates to:
  /// **'What is heard is kept for 7 days, then deleted.'**
  String get chantDetectWordsNote;

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
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
