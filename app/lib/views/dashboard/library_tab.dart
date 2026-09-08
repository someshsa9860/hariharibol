import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../widgets/common/empty_state.dart';

/// Books, chapters and verses.
///
/// Not built yet. This is where the reader lands from the library tab and from
/// "continue reading" on the dashboard.
class LibraryTab extends ConsumerWidget {
  const LibraryTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(text.tabLibrary)),
      body: Center(
        child: EmptyState(
          message: text.comingSoon,
          icon: Icons.menu_book_outlined,
        ),
      ),
    );
  }
}
