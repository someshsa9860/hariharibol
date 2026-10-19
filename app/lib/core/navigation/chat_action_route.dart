import '../../models/chat.dart';
import 'app_routes.dart';

/// Where an offer from Sakha leads. [isTab] says the place is one of the bar's tabs, which is switched to rather
/// than stacked on the chat.
({String path, bool isTab}) chatActionRoute(ChatAction action) {
  switch (action.type) {
    case ChatActionType.page:
      return switch (action.page!) {
        ChatActionPage.home => (path: AppRoutes.home, isTab: true),
        ChatActionPage.jap => (path: AppRoutes.sadhana, isTab: true),
        ChatActionPage.reels => (path: AppRoutes.reels, isTab: true),
        ChatActionPage.read => (path: AppRoutes.library, isTab: true),
        ChatActionPage.routine => (path: AppRoutes.routine, isTab: false),
        ChatActionPage.settings => (path: AppRoutes.settings, isTab: false),
        ChatActionPage.plans => (path: AppRoutes.plans, isTab: false),
        ChatActionPage.search => (path: AppRoutes.search, isTab: false),
      };
    case ChatActionType.mantra:
      return (path: AppRoutes.mantraPath(action.slug!), isTab: false);
    case ChatActionType.verse:
      return (
        path: AppRoutes.chapterPath(action.bookSlug!, action.chapter!, canto: action.canto, verse: action.verse),
        isTab: false,
      );
  }
}
