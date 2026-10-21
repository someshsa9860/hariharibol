import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../core/constants/group_config.dart';
import '../models/chant_group.dart';
import 'group_service.dart';
import 'realtime_service.dart';

enum PeerState { connecting, connected, failed }

/// Another person in the room, and how the connection to them is doing.
class RoomPeer {
  const RoomPeer(this.person, this.state);

  final GroupPerson person;
  final PeerState state;
}

class _Peer {
  _Peer(this.person, this.connection, {required this.polite});

  GroupPerson person;
  final RTCPeerConnection connection;

  /// The one of two people who yields when both offer at once (the larger id).
  final bool polite;
  PeerState state = PeerState.connecting;
  bool makingOffer = false;
  final List<RTCIceCandidate> queued = [];

  /// One step of the handshake at a time, in the order the messages came.
  Future<void> _chain = Future<void>.value();

  Future<void> run(Future<void> Function() step) =>
      _chain = _chain.then((_) => step()).catchError((Object _) {});
}

/// The audio room of a chanting group: WebRTC, phone to phone, one connection
/// to each other person (a mesh — the server limits a room to eight). The API
/// only records who is in the room and relays the handshake.
///
/// Who offers: the person who just arrived offers to everyone already there;
/// the others only answer. If two arrive at once and offer to each other, the
/// polite one (the larger id) rolls its own offer back.
class GroupLiveRoom extends ChangeNotifier {
  GroupLiveRoom({required this.groupId, required this.me, GroupService? service})
      : _service = service ?? GroupService.instance;

  final String groupId;
  final String me;
  final GroupService _service;

  final Map<String, _Peer> _peers = {};
  final Map<String, GroupPerson> _known = {};
  final List<StreamSubscription<RealtimeEvent>> _listening = [];
  MediaStream? _microphone;
  List<Map<String, dynamic>> _servers = const [];
  Timer? _beat;

  bool _muted = false;
  bool _over = false;

  /// Called once when the room is over for this phone — an admin ended it, the
  /// phone was removed, or the server stopped counting it. Not on [leave].
  VoidCallback? onClosed;

  bool get muted => _muted;
  bool get isOver => _over;

  List<RoomPeer> get peers => [for (final peer in _peers.values) RoomPeer(peer.person, peer.state)];

  /// Opens the microphone, enters the room (`start` for an admin opening it,
  /// `join` for everyone else) and calls whoever is already in it. Throws the
  /// microphone's refusal or the API's failure; nothing stays open then.
  Future<void> enter({required bool start}) async {
    _microphone = await navigator.mediaDevices.getUserMedia({'audio': GroupConfig.microphone, 'video': false});

    final RoomEntry entry;
    try {
      entry = start ? await _service.startRoom(groupId) : await _service.joinRoom(groupId);
    } catch (_) {
      await _releaseMicrophone();
      rethrow;
    }
    _servers = entry.iceServers;

    RealtimeService.instance.retain();
    _listening.add(RealtimeService.instance.events.listen(_onEvent));
    _beat = Timer.periodic(GroupConfig.heartbeat, (_) => unawaited(_heartbeat()));

    // A phone's speaker is the loudspeaker for a group, not the earpiece.
    unawaited(Helper.setSpeakerphoneOn(true));

    for (final person in entry.participants) {
      _known[person.id] = person;
      unawaited(_call(person.id));
    }
    notifyListeners();
  }

  /// Mutes or unmutes the microphone (the connections stay up).
  void setMuted(bool muted) {
    _muted = muted;
    for (final track in _microphone?.getAudioTracks() ?? const <MediaStreamTrack>[]) {
      track.enabled = !muted;
    }
    notifyListeners();
  }

  /// Leaves the room and tells the server.
  Future<void> leave() async {
    if (_over) return;
    await _close(notify: false);
    try {
      await _service.leaveRoom(groupId);
    } on Object {
      // The server drops a silent phone after a minute anyway.
    }
  }

  Future<void> _heartbeat() async {
    try {
      final status = await _service.heartbeat(groupId);
      if (!status.open || !status.joined) await _close(notify: true);
    } on Object {
      // A lost connection is not the end of the room; the next beat tries again.
    }
  }

  void _onEvent(RealtimeEvent event) {
    final payload = event.payload;
    if (payload['groupId'] != groupId || _over) return;

    switch (event.name) {
      case 'group.signal':
        final from = payload['from'];
        final kind = payload['kind'];
        final data = payload['data'];
        if (from is String && kind is String && data is Map) {
          unawaited(_onSignal(from, kind, Map<String, dynamic>.from(data)));
        }
      case 'group.participant':
        final userId = payload['userId'];
        if (payload['joined'] == true) {
          final person = payload['person'];
          if (person is Map) {
            final who = GroupPerson.fromJson(Map<String, dynamic>.from(person));
            _known[who.id] = who;
            _peers[who.id]?.person = who;
            notifyListeners();
          }
        } else if (userId is String) {
          unawaited(_dropPeer(userId));
        }
      case 'group.live':
        if (payload['live'] == false) unawaited(_close(notify: true));
      case 'group.changed':
        final what = payload['what'];
        if (what == 'removed' || what == 'deleted') unawaited(_close(notify: true));
    }
  }

  // ── Connections ──────────────────────────────────────────────────────────

  Future<_Peer> _peerFor(String id) async {
    final existing = _peers[id];
    if (existing != null) return existing;

    final connection = await createPeerConnection({
      'iceServers': _servers,
      'sdpSemantics': 'unified-plan',
    });
    // Two messages for the same stranger can both get here before either is stored.
    final raced = _peers[id];
    if (raced != null) {
      await connection.close();
      return raced;
    }

    final peer = _Peer(_known[id] ?? GroupPerson(id: id, name: ''), connection, polite: me.compareTo(id) > 0);
    _peers[id] = peer;

    connection.onIceCandidate = (candidate) {
      unawaited(_send(id, 'candidate', candidate.toMap() as Map<String, dynamic>));
    };
    connection.onConnectionState = (state) {
      peer.state = switch (state) {
        RTCPeerConnectionState.RTCPeerConnectionStateConnected => PeerState.connected,
        RTCPeerConnectionState.RTCPeerConnectionStateFailed => PeerState.failed,
        _ => PeerState.connecting,
      };
      if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed) unawaited(connection.restartIce());
      if (!_over) notifyListeners();
    };

    notifyListeners();
    return peer;
  }

  /// I arrived after them: add my microphone and make the first offer.
  Future<void> _call(String id) async {
    final peer = await _peerFor(id);
    await peer.run(() async {
      await _addMicrophone(peer);
      peer.makingOffer = true;
      try {
        final offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);
        await _send(id, 'offer', {'sdp': offer.sdp});
      } finally {
        peer.makingOffer = false;
      }
    });
  }

  Future<void> _addMicrophone(_Peer peer) async {
    final stream = _microphone;
    if (stream == null) return;
    final senders = await peer.connection.getSenders();
    if (senders.any((sender) => sender.track != null)) return;
    for (final track in stream.getAudioTracks()) {
      await peer.connection.addTrack(track, stream);
    }
  }

  Future<void> _onSignal(String from, String kind, Map<String, dynamic> data) async {
    final peer = await _peerFor(from);
    await peer.run(() async {
      if (_over) return;
      final connection = peer.connection;

      if (kind == 'candidate') {
        final candidate = RTCIceCandidate(
          data['candidate'] as String?,
          data['sdpMid'] as String?,
          data['sdpMLineIndex'] as int?,
        );
        if (await connection.getRemoteDescription() != null) {
          await connection.addCandidate(candidate);
        } else {
          peer.queued.add(candidate);
        }
        return;
      }

      final sdp = data['sdp'] as String? ?? '';
      if (kind == 'offer') {
        final stable = connection.signalingState == RTCSignalingState.RTCSignalingStateStable;
        if ((peer.makingOffer || !stable) && !peer.polite) return;
        if (!stable) await connection.setLocalDescription(RTCSessionDescription('', 'rollback'));
        await connection.setRemoteDescription(RTCSessionDescription(sdp, 'offer'));
        await _addMicrophone(peer);
        final answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        await _send(from, 'answer', {'sdp': answer.sdp});
      } else if (kind == 'answer' &&
          connection.signalingState == RTCSignalingState.RTCSignalingStateHaveLocalOffer) {
        await connection.setRemoteDescription(RTCSessionDescription(sdp, 'answer'));
      }

      for (final candidate in peer.queued.toList()) {
        await connection.addCandidate(candidate);
      }
      peer.queued.clear();
    });
  }

  Future<void> _send(String to, String kind, Map<String, dynamic> data) async {
    try {
      await _service.signal(groupId, to: to, kind: kind, data: data);
    } on Object {
      // A message that does not get through shows as a connection that never completes.
    }
  }

  Future<void> _dropPeer(String id) async {
    final peer = _peers.remove(id);
    if (peer == null) return;
    await peer.connection.close();
    if (!_over) notifyListeners();
  }

  Future<void> _releaseMicrophone() async {
    final stream = _microphone;
    _microphone = null;
    if (stream == null) return;
    for (final track in stream.getTracks()) {
      await track.stop();
    }
    await stream.dispose();
  }

  Future<void> _close({required bool notify}) async {
    if (_over) return;
    _over = true;
    _beat?.cancel();
    for (final subscription in _listening) {
      await subscription.cancel();
    }
    _listening.clear();
    RealtimeService.instance.release();
    for (final peer in _peers.values) {
      await peer.connection.close();
    }
    _peers.clear();
    await _releaseMicrophone();
    notifyListeners();
    if (notify) onClosed?.call();
  }

  @override
  void dispose() {
    unawaited(_close(notify: false));
    super.dispose();
  }
}
