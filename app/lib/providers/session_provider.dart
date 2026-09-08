import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/session/app_session.dart';
import '../models/app_user.dart';

/// The signed-in user, as a provider.
///
/// [AppSession] is the owner — this only mirrors it into Riverpod so widgets
/// can watch it. Nothing writes through here; changes go to the session, and
/// arrive back through its listener.
class CurrentUser extends Notifier<AppUser?> {
  @override
  AppUser? build() {
    final session = AppSession.instance;
    void onChange() => state = session.user;

    session.addListener(onChange);
    ref.onDispose(() => session.removeListener(onChange));

    return session.user;
  }
}

final currentUserProvider = NotifierProvider<CurrentUser, AppUser?>(CurrentUser.new);

/// Convenience reads, so widgets do not each re-derive the same thing.
final isPremiumProvider = Provider<bool>((ref) {
  return ref.watch(currentUserProvider)?.isPremium ?? false;
});

final canAccessAdminProvider = Provider<bool>((ref) {
  return ref.watch(currentUserProvider)?.canAccessAdmin ?? false;
});
