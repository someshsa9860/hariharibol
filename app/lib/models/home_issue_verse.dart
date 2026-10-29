import 'json.dart';
import 'sloka.dart';
import 'verse.dart';

/// A verse for a vikara the reader reported lately, with that vikara.
/// Served by `GET /api/app/home/issue-verses` (`backend/controllers/app/home.js`).
class HomeIssueVerse {
  const HomeIssueVerse({required this.issue, required this.verse});

  factory HomeIssueVerse.fromJson(Json json) => HomeIssueVerse(
        issue: SlokaIssue.fromJson(asJson(json['issue']) ?? const {}),
        verse: Verse.fromJson(asJson(json['verse']) ?? const {}),
      );

  final SlokaIssue issue;
  final Verse verse;
}
