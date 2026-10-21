// Chanting groups: what the API sends is read as it should be, and the member
// list offers an admin only what the server would accept.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/chant_group.dart';
import 'package:hariharibol/widgets/groups/member_tile.dart';

Widget _host(Widget child) => MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    );

GroupMember _member(String id, GroupRole role, {bool invited = false}) =>
    GroupMember(id: id, name: 'Member $id', role: role, isInvited: invited);

Future<List<String>> _offered(WidgetTester tester, GroupMember member, GroupRole mine, {bool isMe = false}) async {
  await tester.pumpWidget(_host(MemberTile(member: member, myRole: mine, isMe: isMe, onAction: (_) {})));
  if (find.byType(PopupMenuButton<MemberAction>).evaluate().isEmpty) return const [];
  await tester.tap(find.byType(PopupMenuButton<MemberAction>));
  await tester.pumpAndSettle();
  return [for (final item in tester.widgetList<PopupMenuItem<MemberAction>>(find.byType(PopupMenuItem<MemberAction>))) item.value!.name];
}

void main() {
  group('reading the API', () {
    test('a group with a live room and its members', () {
      final group = ChantGroup.fromJson({
        'id': 'g1',
        'name': 'Morning japa',
        'description': null,
        'myRole': 'ADMIN',
        'memberCount': 3,
        'mantra': {'id': 'm', 'slug': 'hare', 'name': 'Hare Krishna'},
        'live': {
          'sessionId': 's1',
          'participants': [
            {'id': 'u1', 'name': 'Asha', 'avatarUrl': null},
          ],
        },
        'members': [
          {'id': 'u1', 'name': 'Asha', 'role': 'OWNER', 'status': 'ACTIVE'},
          {'id': 'u2', 'name': 'Bhanu', 'role': 'MEMBER', 'status': 'INVITED'},
        ],
      });

      expect(group.myRole, GroupRole.admin);
      expect(group.myRole.isAdmin, isTrue);
      expect(group.mantraName, 'Hare Krishna');
      expect(group.live?.participants.single.name, 'Asha');
      expect(group.members.map((m) => m.role), [GroupRole.owner, GroupRole.member]);
      expect(group.members.map((m) => m.isInvited), [false, true]);
    });

    test('a group with no room is not live, and an unknown role is a member', () {
      final group = ChantGroup.fromJson({'id': 'g', 'name': 'x', 'myRole': 'SOMETHING', 'memberCount': 1});

      expect(group.live, isNull);
      expect(group.myRole, GroupRole.member);
      expect(group.members, isEmpty);
    });

    test('the list and the room entry', () {
      final list = GroupList.fromJson({
        'groups': [
          {'id': 'g', 'name': 'x', 'myRole': 'OWNER', 'memberCount': 1},
        ],
        'invitations': [
          {'groupId': 'h', 'name': 'y', 'invitedBy': {'id': 'u', 'name': 'Asha'}},
        ],
      });
      expect(list.groups.single.myRole, GroupRole.owner);
      expect(list.invitations.single.invitedBy, 'Asha');

      final entry = RoomEntry.fromJson({
        'iceServers': [
          {'urls': ['stun:a'], 'username': 'u', 'credential': 'c'},
        ],
        'participants': [
          {'id': 'u1', 'name': 'Asha'},
        ],
      });
      expect(entry.iceServers.single['username'], 'u');
      expect(entry.participants.single.id, 'u1');
    });
  });

  group('who may do what to a member', () {
    testWidgets('an admin can make a member an admin or remove them', (tester) async {
      expect(await _offered(tester, _member('a', GroupRole.member), GroupRole.admin), ['makeAdmin', 'remove']);
    });

    testWidgets('an admin cannot touch another admin or the owner', (tester) async {
      expect(await _offered(tester, _member('a', GroupRole.admin), GroupRole.admin), isEmpty);
      expect(await _offered(tester, _member('a', GroupRole.owner), GroupRole.admin), isEmpty);
    });

    testWidgets('the owner can take admin away and remove an admin', (tester) async {
      expect(await _offered(tester, _member('a', GroupRole.admin), GroupRole.owner), ['removeAdmin', 'remove']);
    });

    testWidgets('an invitation can be taken back, but not made an admin', (tester) async {
      expect(await _offered(tester, _member('a', GroupRole.member, invited: true), GroupRole.admin), ['remove']);
    });

    testWidgets('a member is offered nothing, and nobody acts on themselves', (tester) async {
      expect(await _offered(tester, _member('a', GroupRole.member), GroupRole.member), isEmpty);
      expect(await _offered(tester, _member('a', GroupRole.member), GroupRole.owner, isMe: true), isEmpty);
    });
  });
}
