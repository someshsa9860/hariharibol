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

  /// The app's name
  ///
  /// In en, this message translates to:
  /// **'HariHariBol Dev'**
  String get appName;

  /// No description provided for @actionCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get actionCancel;

  /// No description provided for @actionRetry.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get actionRetry;

  /// No description provided for @tabLive.
  ///
  /// In en, this message translates to:
  /// **'Live'**
  String get tabLive;

  /// No description provided for @tabChats.
  ///
  /// In en, this message translates to:
  /// **'Chats'**
  String get tabChats;

  /// No description provided for @tabTickets.
  ///
  /// In en, this message translates to:
  /// **'Tickets'**
  String get tabTickets;

  /// No description provided for @tabSettings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get tabSettings;

  /// No description provided for @signInTitle.
  ///
  /// In en, this message translates to:
  /// **'Owner sign-in'**
  String get signInTitle;

  /// No description provided for @signInBody.
  ///
  /// In en, this message translates to:
  /// **'Server alerts, new sign-ups, feedback and chat with readers. Only accounts with developer access can sign in.'**
  String get signInBody;

  /// No description provided for @signInGoogle.
  ///
  /// In en, this message translates to:
  /// **'Continue with Google'**
  String get signInGoogle;

  /// No description provided for @signInBusy.
  ///
  /// In en, this message translates to:
  /// **'Signing in…'**
  String get signInBusy;

  /// No description provided for @errorGeneric.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get errorGeneric;

  /// No description provided for @errorNetwork.
  ///
  /// In en, this message translates to:
  /// **'No connection. Check the internet and try again.'**
  String get errorNetwork;

  /// No description provided for @errorTimeout.
  ///
  /// In en, this message translates to:
  /// **'The server took too long to answer. Try again.'**
  String get errorTimeout;

  /// No description provided for @errorSessionExpired.
  ///
  /// In en, this message translates to:
  /// **'You were signed out. Please sign in again.'**
  String get errorSessionExpired;

  /// No description provided for @errorSignIn.
  ///
  /// In en, this message translates to:
  /// **'Could not sign in with Google.'**
  String get errorSignIn;

  /// No description provided for @errorInsecureConnection.
  ///
  /// In en, this message translates to:
  /// **'The connection is not secure, so it was refused.'**
  String get errorInsecureConnection;

  /// No description provided for @errorCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled.'**
  String get errorCancelled;

  /// No description provided for @errorNotAllowed.
  ///
  /// In en, this message translates to:
  /// **'This account does not have developer access.'**
  String get errorNotAllowed;

  /// No description provided for @statOnline.
  ///
  /// In en, this message translates to:
  /// **'Online now'**
  String get statOnline;

  /// No description provided for @statUsers.
  ///
  /// In en, this message translates to:
  /// **'Readers'**
  String get statUsers;

  /// No description provided for @statSignupsToday.
  ///
  /// In en, this message translates to:
  /// **'Sign-ups today'**
  String get statSignupsToday;

  /// No description provided for @statErrorsHour.
  ///
  /// In en, this message translates to:
  /// **'Errors, last hour'**
  String get statErrorsHour;

  /// No description provided for @statCriticalHour.
  ///
  /// In en, this message translates to:
  /// **'Critical alerts, last hour'**
  String get statCriticalHour;

  /// No description provided for @statUnreadChats.
  ///
  /// In en, this message translates to:
  /// **'Unread chats'**
  String get statUnreadChats;

  /// No description provided for @filterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get filterAll;

  /// No description provided for @filterErrors.
  ///
  /// In en, this message translates to:
  /// **'Errors'**
  String get filterErrors;

  /// No description provided for @filterServer.
  ///
  /// In en, this message translates to:
  /// **'Server'**
  String get filterServer;

  /// No description provided for @filterSignups.
  ///
  /// In en, this message translates to:
  /// **'Sign-ups'**
  String get filterSignups;

  /// No description provided for @filterTickets.
  ///
  /// In en, this message translates to:
  /// **'Tickets'**
  String get filterTickets;

  /// No description provided for @filterFeedback.
  ///
  /// In en, this message translates to:
  /// **'Feedback'**
  String get filterFeedback;

  /// No description provided for @filterChats.
  ///
  /// In en, this message translates to:
  /// **'Chats'**
  String get filterChats;

  /// No description provided for @feedEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing yet. Events appear here the moment they happen.'**
  String get feedEmpty;

  /// The chip above the feed when events arrived live
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{1 new} other{{count} new}}'**
  String feedNewEvents(int count);

  /// No description provided for @eventDetails.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get eventDetails;

  /// No description provided for @socketLive.
  ///
  /// In en, this message translates to:
  /// **'Live'**
  String get socketLive;

  /// No description provided for @socketConnecting.
  ///
  /// In en, this message translates to:
  /// **'Connecting…'**
  String get socketConnecting;

  /// No description provided for @socketOffline.
  ///
  /// In en, this message translates to:
  /// **'Offline, retrying'**
  String get socketOffline;

  /// No description provided for @socketForbidden.
  ///
  /// In en, this message translates to:
  /// **'No access to the live feed'**
  String get socketForbidden;

  /// No description provided for @socketIdle.
  ///
  /// In en, this message translates to:
  /// **'Not connected'**
  String get socketIdle;

  /// No description provided for @typeErrorNew.
  ///
  /// In en, this message translates to:
  /// **'New error'**
  String get typeErrorNew;

  /// No description provided for @typeErrorSpike.
  ///
  /// In en, this message translates to:
  /// **'Error spike'**
  String get typeErrorSpike;

  /// No description provided for @typeHealth.
  ///
  /// In en, this message translates to:
  /// **'Server alert'**
  String get typeHealth;

  /// No description provided for @typeSignup.
  ///
  /// In en, this message translates to:
  /// **'New sign-up'**
  String get typeSignup;

  /// No description provided for @typeTicket.
  ///
  /// In en, this message translates to:
  /// **'New ticket'**
  String get typeTicket;

  /// No description provided for @typeTicketReply.
  ///
  /// In en, this message translates to:
  /// **'Ticket reply'**
  String get typeTicketReply;

  /// No description provided for @typeFeedback.
  ///
  /// In en, this message translates to:
  /// **'New feedback'**
  String get typeFeedback;

  /// No description provided for @typeChat.
  ///
  /// In en, this message translates to:
  /// **'Chat message'**
  String get typeChat;

  /// No description provided for @chatsEmpty.
  ///
  /// In en, this message translates to:
  /// **'No conversations yet. Readers can write to you from the reader app.'**
  String get chatsEmpty;

  /// No description provided for @chatNew.
  ///
  /// In en, this message translates to:
  /// **'New message'**
  String get chatNew;

  /// No description provided for @chatSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Find a reader by name or email'**
  String get chatSearchHint;

  /// No description provided for @chatSearchPrompt.
  ///
  /// In en, this message translates to:
  /// **'Type at least two letters.'**
  String get chatSearchPrompt;

  /// No description provided for @chatNoResults.
  ///
  /// In en, this message translates to:
  /// **'No readers found.'**
  String get chatNoResults;

  /// Title of the dialog for the first message to a reader
  ///
  /// In en, this message translates to:
  /// **'Message to {name}'**
  String chatFirstMessageTitle(String name);

  /// No description provided for @chatSend.
  ///
  /// In en, this message translates to:
  /// **'Send'**
  String get chatSend;

  /// No description provided for @chatComposerHint.
  ///
  /// In en, this message translates to:
  /// **'Write a message'**
  String get chatComposerHint;

  /// No description provided for @chatSending.
  ///
  /// In en, this message translates to:
  /// **'Sending…'**
  String get chatSending;

  /// No description provided for @chatNotSent.
  ///
  /// In en, this message translates to:
  /// **'Not sent. Tap to try again.'**
  String get chatNotSent;

  /// No description provided for @ticketFilterOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get ticketFilterOpen;

  /// No description provided for @ticketFilterProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get ticketFilterProgress;

  /// No description provided for @ticketFilterResolved.
  ///
  /// In en, this message translates to:
  /// **'Resolved'**
  String get ticketFilterResolved;

  /// No description provided for @ticketFilterFeedback.
  ///
  /// In en, this message translates to:
  /// **'Feedback'**
  String get ticketFilterFeedback;

  /// No description provided for @ticketsEmpty.
  ///
  /// In en, this message translates to:
  /// **'Nothing here.'**
  String get ticketsEmpty;

  /// No description provided for @ticketsNoAccess.
  ///
  /// In en, this message translates to:
  /// **'This account can read the live feed and chats, but not support tickets (it needs the support.manage permission).'**
  String get ticketsNoAccess;

  /// Title of a feedback row
  ///
  /// In en, this message translates to:
  /// **'{rating, plural, one{Feedback: 1 star} other{Feedback: {rating} stars}}'**
  String ticketFeedbackTitle(int rating);

  /// No description provided for @ticketSetStatus.
  ///
  /// In en, this message translates to:
  /// **'Set status'**
  String get ticketSetStatus;

  /// No description provided for @settingsPush.
  ///
  /// In en, this message translates to:
  /// **'Push notifications'**
  String get settingsPush;

  /// No description provided for @settingsPushHelp.
  ///
  /// In en, this message translates to:
  /// **'Used only when the app is closed or in the background. While it is open, everything arrives live.'**
  String get settingsPushHelp;

  /// No description provided for @settingsMuted.
  ///
  /// In en, this message translates to:
  /// **'Leave out of pushes'**
  String get settingsMuted;

  /// No description provided for @settingsMutedHelp.
  ///
  /// In en, this message translates to:
  /// **'These still appear in the feed. Server alerts always push.'**
  String get settingsMutedHelp;

  /// No description provided for @settingsServer.
  ///
  /// In en, this message translates to:
  /// **'Server'**
  String get settingsServer;

  /// No description provided for @settingsVersion.
  ///
  /// In en, this message translates to:
  /// **'Version'**
  String get settingsVersion;

  /// No description provided for @settingsSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get settingsSignOut;

  /// No description provided for @settingsSignOutBody.
  ///
  /// In en, this message translates to:
  /// **'You will stop receiving alerts on this phone.'**
  String get settingsSignOutBody;

  /// No description provided for @timeJustNow.
  ///
  /// In en, this message translates to:
  /// **'Just now'**
  String get timeJustNow;

  /// No description provided for @timeYesterday.
  ///
  /// In en, this message translates to:
  /// **'Yesterday'**
  String get timeYesterday;
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
