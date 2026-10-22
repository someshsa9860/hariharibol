import '../../l10n/generated/app_localizations.dart';
import '../../models/support.dart';

/// The reader's words for a ticket's topic. An unknown wire value (a newer
/// server) reads as "something else".
String supportCategoryLabel(AppLocalizations text, String category) => switch (category) {
      'bug' => text.supportCategoryBug,
      'payment' => text.supportCategoryPayment,
      'account' => text.supportCategoryAccount,
      'content' => text.supportCategoryContent,
      'suggestion' => text.supportCategorySuggestion,
      _ => text.supportCategoryOther,
    };

String supportStatusLabel(AppLocalizations text, SupportStatus status) => switch (status) {
      SupportStatus.open => text.supportStatusOpen,
      SupportStatus.inProgress => text.supportStatusInProgress,
      SupportStatus.resolved => text.supportStatusResolved,
    };
