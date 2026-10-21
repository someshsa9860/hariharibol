import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/share.dart';
import '../services/share_service.dart';

/// The signed-in person's code, link, totals and invitations. Re-read each time
/// the screen opens: a friend may have finished a round since.
final referralProvider = FutureProvider.autoDispose<ReferralSummary>((ref) {
  return ShareService.instance.referral();
});
