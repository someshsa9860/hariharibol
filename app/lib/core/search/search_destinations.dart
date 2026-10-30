import 'package:flutter/material.dart';

import '../../l10n/generated/app_localizations.dart';
import '../navigation/app_routes.dart';

/// One page or action the search box can open directly: "Sakha AI", "Jap",
/// "Calendar". Typed in the search box it is listed under "Go to".
///
/// [keywords] are what people type for it, in Latin script, so a reader who
/// types "sakha ai" in any app language still finds the page. Titles come from
/// the app's own strings, so they follow the app language.
class SearchDestination {
  const SearchDestination({
    required this.route,
    required this.title,
    required this.icon,
    this.keywords = const [],
  });

  /// Always an [AppRoutes] value, never a typed path.
  final String route;
  final String Function(AppLocalizations text) title;
  final IconData icon;
  final List<String> keywords;
}

/// Every page the search box can open. Keep it short: a destination is listed
/// only when it is a place a reader goes, not every screen in the app.
final List<SearchDestination> searchDestinations = [
  SearchDestination(
    route: AppRoutes.chat,
    title: (t) => t.chatTitle,
    icon: Icons.chat_bubble_outline_rounded,
    keywords: const ['sakha ai', 'sakha', 'ai', 'chat', 'ask', 'friend'],
  ),
  SearchDestination(
    route: AppRoutes.home,
    title: (t) => t.tabHome,
    icon: Icons.home_outlined,
    keywords: const ['home', 'today'],
  ),
  SearchDestination(
    route: AppRoutes.sadhana,
    title: (t) => t.tabSadhana,
    icon: Icons.self_improvement_rounded,
    keywords: const ['jap', 'japa', 'chant', 'counter', 'mala', 'rounds', 'mantra'],
  ),
  SearchDestination(
    route: AppRoutes.library,
    title: (t) => t.tabLibrary,
    icon: Icons.menu_book_outlined,
    keywords: const ['read', 'library', 'books', 'book', 'gita', 'bhagavatam', 'verses'],
  ),
  SearchDestination(
    route: AppRoutes.reels,
    title: (t) => t.reelsTitle,
    icon: Icons.play_circle_outline_rounded,
    keywords: const ['reels', 'videos', 'watch'],
  ),
  SearchDestination(
    route: AppRoutes.routine,
    title: (t) => t.tabRoutine,
    icon: Icons.checklist_rounded,
    keywords: const ['routine', 'tasks', 'todo', 'sadhana'],
  ),
  SearchDestination(
    route: AppRoutes.calendar,
    title: (t) => t.calendarTitle,
    icon: Icons.calendar_month_outlined,
    keywords: const ['calendar', 'panchang', 'tithi', 'ekadashi', 'festival', 'festivals'],
  ),
  SearchDestination(
    route: AppRoutes.etiquette,
    title: (t) => t.etiquetteTitle,
    icon: Icons.spa_outlined,
    keywords: const ['etiquette', 'manners', 'temple', 'devotee'],
  ),
  SearchDestination(
    route: AppRoutes.plans,
    title: (t) => t.plansTitle,
    icon: Icons.workspace_premium_outlined,
    keywords: const ['plans', 'premium', 'subscribe', 'upgrade', 'subscription', 'arta'],
  ),
  SearchDestination(
    route: AppRoutes.refer,
    title: (t) => t.referTitle,
    icon: Icons.card_giftcard_rounded,
    keywords: const ['refer', 'invite', 'friend', 'earn'],
  ),
  SearchDestination(
    route: AppRoutes.settings,
    title: (t) => t.settingsTitle,
    icon: Icons.settings_outlined,
    keywords: const ['settings', 'language', 'languages', 'theme', 'account'],
  ),
  SearchDestination(
    route: AppRoutes.voices,
    title: (t) => t.voicesTitle,
    icon: Icons.record_voice_over_outlined,
    keywords: const ['voice', 'voices', 'audio', 'read aloud', 'speech'],
  ),
  SearchDestination(
    route: AppRoutes.sources,
    title: (t) => t.sourcesTitle,
    icon: Icons.info_outline_rounded,
    keywords: const ['sources', 'disclaimer', 'about', 'credits'],
  ),
  SearchDestination(
    route: AppRoutes.support,
    title: (t) => t.supportTitle,
    icon: Icons.support_agent_rounded,
    keywords: const ['help', 'support', 'feedback', 'ticket', 'problem'],
  ),
];

/// Lower case, letters and digits only, one space between words, so "Sakha-AI"
/// and " sakha  ai " compare as the same words.
String normaliseSearchText(String input) => input
    .toLowerCase()
    .replaceAll(RegExp(r'[^\p{L}\p{M}\p{N}]+', unicode: true), ' ')
    .trim();

/// The destinations a typed query points at. A word the page is called by, or
/// one of its keywords, starting with what was typed counts, so "cal" finds
/// Calendar and "sakha a" finds Sakha AI. Empty for a blank query.
List<SearchDestination> matchDestinations(String query, AppLocalizations text) {
  final typed = normaliseSearchText(query);
  if (typed.isEmpty) return const [];

  bool starts(String candidate) {
    final words = normaliseSearchText(candidate);
    return words.startsWith(typed) || words.split(' ').any((w) => w.startsWith(typed));
  }

  return [
    for (final destination in searchDestinations)
      if (starts(destination.title(text)) || destination.keywords.any(starts)) destination,
  ];
}
