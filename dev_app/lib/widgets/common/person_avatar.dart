import 'package:flutter/material.dart';

import '../../models/dev_message.dart';

/// The reader's picture, or their initial.
class PersonAvatar extends StatelessWidget {
  const PersonAvatar({super.key, required this.person, this.radius = 22});

  final ChatPerson person;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final url = person.avatarUrl;
    return CircleAvatar(
      radius: radius,
      backgroundImage: url == null ? null : NetworkImage(url),
      child: url == null ? Text(person.initial) : null,
    );
  }
}
