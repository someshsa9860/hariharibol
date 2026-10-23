// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'HariHariBol Dev';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionRetry => 'Try again';

  @override
  String get tabLive => 'Live';

  @override
  String get tabChats => 'Chats';

  @override
  String get tabTickets => 'Tickets';

  @override
  String get tabSettings => 'Settings';

  @override
  String get signInTitle => 'Owner sign-in';

  @override
  String get signInBody =>
      'Server alerts, new sign-ups, feedback and chat with readers. Only accounts with developer access can sign in.';

  @override
  String get signInGoogle => 'Continue with Google';

  @override
  String get signInBusy => 'Signing in…';

  @override
  String get errorGeneric => 'Something went wrong. Please try again.';

  @override
  String get errorNetwork => 'No connection. Check the internet and try again.';

  @override
  String get errorTimeout => 'The server took too long to answer. Try again.';

  @override
  String get errorSessionExpired =>
      'You were signed out. Please sign in again.';

  @override
  String get errorSignIn => 'Could not sign in with Google.';

  @override
  String get errorInsecureConnection =>
      'The connection is not secure, so it was refused.';

  @override
  String get errorCancelled => 'Cancelled.';

  @override
  String get errorNotAllowed => 'This account does not have developer access.';

  @override
  String get statOnline => 'Online now';

  @override
  String get statUsers => 'Readers';

  @override
  String get statSignupsToday => 'Sign-ups today';

  @override
  String get statErrorsHour => 'Errors, last hour';

  @override
  String get statCriticalHour => 'Critical alerts, last hour';

  @override
  String get statUnreadChats => 'Unread chats';

  @override
  String get filterAll => 'All';

  @override
  String get filterErrors => 'Errors';

  @override
  String get filterServer => 'Server';

  @override
  String get filterSignups => 'Sign-ups';

  @override
  String get filterTickets => 'Tickets';

  @override
  String get filterFeedback => 'Feedback';

  @override
  String get filterChats => 'Chats';

  @override
  String get feedEmpty =>
      'Nothing yet. Events appear here the moment they happen.';

  @override
  String feedNewEvents(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count new',
      one: '1 new',
    );
    return '$_temp0';
  }

  @override
  String get eventDetails => 'Details';

  @override
  String get socketLive => 'Live';

  @override
  String get socketConnecting => 'Connecting…';

  @override
  String get socketOffline => 'Offline, retrying';

  @override
  String get socketForbidden => 'No access to the live feed';

  @override
  String get socketIdle => 'Not connected';

  @override
  String get typeErrorNew => 'New error';

  @override
  String get typeErrorSpike => 'Error spike';

  @override
  String get typeHealth => 'Server alert';

  @override
  String get typeSignup => 'New sign-up';

  @override
  String get typeTicket => 'New ticket';

  @override
  String get typeTicketReply => 'Ticket reply';

  @override
  String get typeFeedback => 'New feedback';

  @override
  String get typeChat => 'Chat message';

  @override
  String get chatsEmpty =>
      'No conversations yet. Readers can write to you from the reader app.';

  @override
  String get chatNew => 'New message';

  @override
  String get chatSearchHint => 'Find a reader by name or email';

  @override
  String get chatSearchPrompt => 'Type at least two letters.';

  @override
  String get chatNoResults => 'No readers found.';

  @override
  String chatFirstMessageTitle(String name) {
    return 'Message to $name';
  }

  @override
  String get chatSend => 'Send';

  @override
  String get chatComposerHint => 'Write a message';

  @override
  String get chatSending => 'Sending…';

  @override
  String get chatNotSent => 'Not sent. Tap to try again.';

  @override
  String get ticketFilterOpen => 'Open';

  @override
  String get ticketFilterProgress => 'In progress';

  @override
  String get ticketFilterResolved => 'Resolved';

  @override
  String get ticketFilterFeedback => 'Feedback';

  @override
  String get ticketsEmpty => 'Nothing here.';

  @override
  String get ticketsNoAccess =>
      'This account can read the live feed and chats, but not support tickets (it needs the support.manage permission).';

  @override
  String ticketFeedbackTitle(int rating) {
    String _temp0 = intl.Intl.pluralLogic(
      rating,
      locale: localeName,
      other: 'Feedback: $rating stars',
      one: 'Feedback: 1 star',
    );
    return '$_temp0';
  }

  @override
  String get ticketSetStatus => 'Set status';

  @override
  String get settingsPush => 'Push notifications';

  @override
  String get settingsPushHelp =>
      'Used only when the app is closed or in the background. While it is open, everything arrives live.';

  @override
  String get settingsMuted => 'Leave out of pushes';

  @override
  String get settingsMutedHelp =>
      'These still appear in the feed. Server alerts always push.';

  @override
  String get settingsServer => 'Server';

  @override
  String get settingsVersion => 'Version';

  @override
  String get settingsSignOut => 'Sign out';

  @override
  String get settingsSignOutBody =>
      'You will stop receiving alerts on this phone.';

  @override
  String get timeJustNow => 'Just now';

  @override
  String get timeYesterday => 'Yesterday';
}
