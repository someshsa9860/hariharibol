import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/storage_keys.dart';
import '../models/chant_log.dart';
import '../models/paged.dart';
import '../models/routine_task.dart';
import '../models/sadhana.dart';
import 'api_client.dart';
import 'local_store.dart';

/// Daily practice: the round target, chanting, and the day it all rolls up
/// into. Everything here is the signed-in reader's own — there is no public
/// half, unlike mantras.
class SadhanaService {
  SadhanaService._();

  static final SadhanaService instance = SadhanaService._();

  final ApiClient _api = ApiClient.instance;

  /// The whole practice screen in one call. [date] defaults to the reader's
  /// own local today.
  ///
  /// The answer for today is also kept on the phone, for [saved].
  Future<SadhanaToday> today({String? date}) async {
    final response = await _api.get(
      ApiPaths.sadhanaToday,
      query: date == null ? null : {'date': date},
    );
    if (date == null) {
      try {
        await LocalStore.instance.write(BoxKeys.sadhanaToday, response.json);
      } catch (error) {
        // A copy that cannot be kept is no reason to fail the request.
        if (kDebugMode) debugPrint('[Sadhana] could not keep today: $error');
      }
    }
    return SadhanaToday.fromJson(response.json);
  }

  /// The last screen [today] answered, so the Jap tab draws with no
  /// connection. Carried to the current day when it was saved on an earlier
  /// one; null when nothing is saved.
  SadhanaToday? saved() {
    try {
      final json = LocalStore.instance.readJson(BoxKeys.sadhanaToday);
      if (json == null) return null;
      return SadhanaToday.fromJson(json).carriedTo(routineDayKey(DateTime.now()));
    } catch (_) {
      return null;
    }
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

  /// The rounds that changed, each as a summary (start, end, time, mean chant
  /// time) and not its taps. Rounds are replaced whole on the server, so
  /// sending one again is harmless.
  Future<void> saveChantDetail(String sessionId, List<ChantMalaLog> malas) {
    return _api.put(
      ApiPaths.chantSessionDetail(sessionId),
      body: {'malas': malas.map((mala) => mala.toJson()).toList()},
    );
  }

  /// What speech recognition heard for taps. The server keeps these for 7
  /// days and then deletes them.
  Future<void> saveChantTranscripts(String sessionId, List<ChantHeard> items) {
    return _api.post(
      ApiPaths.chantSessionTranscripts(sessionId),
      body: {'items': items.map((item) => item.toJson()).toList()},
    );
  }

  /// Past sittings of one mantra, newest first — or, with no [mantraId], of
  /// sittings that had none.
  Future<Paged<ChantSessionSummary>> chantSessions({String? mantraId, int page = 1}) async {
    final response = await _api.get(
      ApiPaths.chantSessions,
      query: {'page': page, 'mantraId': mantraId ?? 'none'},
    );
    return Paged.fromResponse(response.data, response.meta, ChantSessionSummary.fromJson);
  }

  /// One past sitting with its rounds.
  Future<ChantSessionDetail> chantSession(String id) async {
    final response = await _api.get(ApiPaths.chantSessionById(id));
    return ChantSessionDetail.fromJson(response.json);
  }
}
