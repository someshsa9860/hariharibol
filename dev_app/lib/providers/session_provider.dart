import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/session/app_session.dart';
import '../models/dev_user.dart';

/// The signed-in developer, mirrored from [AppSession] so widgets can watch it.
class CurrentUser extends Notifier<DevUser?> {
  @override
  DevUser? build() {
    final session = AppSession.instance;
    void onChange() => state = session.user;

    session.addListener(onChange);
    ref.onDispose(() => session.removeListener(onChange));
    return session.user;
  }
}

final currentUserProvider = NotifierProvider<CurrentUser, DevUser?>(CurrentUser.new);

/// Whether the support desk's tickets can be opened (`support.manage`).
final canManageSupportProvider = Provider<bool>((ref) => ref.watch(currentUserProvider)?.canManageSupport ?? false);
