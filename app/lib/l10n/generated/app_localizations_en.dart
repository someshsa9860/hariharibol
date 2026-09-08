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
  String get tabHome => 'Home';

  @override
  String get tabSadhana => 'Sadhana';

  @override
  String get tabLibrary => 'Library';

  @override
  String get tabProfile => 'Profile';

  @override
  String get homeGreeting => 'Hare Kṛṣṇa';

  @override
  String homeGreetingNamed(String name) {
    return 'Hare Kṛṣṇa, $name';
  }

  @override
  String get homeMoodPrompt => 'How are you today?';

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
}
