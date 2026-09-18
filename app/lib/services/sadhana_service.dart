import '../core/constants/api_paths.dart';
import '../models/sadhana.dart';
import 'api_client.dart';

/// Daily practice: the round target, chanting, and the day it all rolls up
/// into. Everything here is the signed-in reader's own — there is no public
/// half, unlike mantras.
class SadhanaService {
  SadhanaService._();

  static final SadhanaService instance = SadhanaService._();

  final ApiClient _api = ApiClient.instance;

  /// The whole practice screen in one call. [date] defaults to the reader's
  /// own local today.
  Future<SadhanaToday> today({String? date}) async {
    final response = await _api.get(
      ApiPaths.sadhanaToday,
      query: date == null ? null : {'date': date},
    );
    return SadhanaToday.fromJson(response.json);
  }

  /// Sets today's round target or note. The standing target that prefills
  /// future days lives on the profile, not here.
  Future<SadhanaDay> setTodayTarget(int roundTarget) async {
    final response = await _api.patch(
      ApiPaths.sadhanaToday,
      body: {'roundTarget': roundTarget},
    );
    return SadhanaDay.fromJson(response.json);
  }

  /// The standing daily goal — what prefills [SadhanaDay.roundTarget] on
  /// every new day, distinct from [setTodayTarget] which only touches the
  /// day already open.
  Future<SadhanaProfile> updateDailyGoal(int dailyRoundTarget) async {
    final response = await _api.patch(
      ApiPaths.meSadhanaProfile,
      body: {'dailyRoundTarget': dailyRoundTarget},
    );
    return SadhanaProfile.fromJson(response.json);
  }

  /// Sets or clears the mantra "Chant now" opens with. `null` clears it —
  /// sent as a literal JSON null, not omitted, so the server knows to unset
  /// rather than leave the existing choice alone.
  Future<SadhanaProfile> setPreferredMantra(String? mantraId) async {
    final response = await _api.patch(
      ApiPaths.meSadhanaProfile,
      body: {'preferredMantraId': mantraId},
    );
    return SadhanaProfile.fromJson(response.json);
  }

  /// Rounds chanted away from the phone, entered afterwards. Lands in the same
  /// table as an in-app session, so a day's total is never split across two
  /// places.
  Future<void> logManualRounds({required int rounds, String? mantraId}) {
    return _api.post(
      ApiPaths.chantManual,
      body: {'rounds': rounds, 'mantraId': ?mantraId},
    );
  }

  /// Opens a session for bead-by-bead counting. [mantraId] is optional — a
  /// sitting does not have to be chanting any one named mantra.
  Future<ChantSession> startSession({String? mantraId}) async {
    final response = await _api.post(
      ApiPaths.chantSession,
      body: {'mantraId': ?mantraId},
    );
    return ChantSession.fromJson(response.json);
  }

  /// Writes progress as it happens, and closes the session with [finish].
  /// Counts only ever move forward — the counter screen always sends its
  /// running totals, never a delta, so a request that lands out of order
  /// cannot roll them back.
  Future<void> updateSession(
    String id, {
    required int rounds,
    required int beads,
    bool finish = false,
  }) {
    return _api.patch(
      ApiPaths.chantSessionById(id),
      body: {'rounds': rounds, 'beads': beads, 'finish': ?(finish ? true : null)},
    );
  }
}
