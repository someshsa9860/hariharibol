import 'package:flutter/material.dart';

class SampradayTile extends StatelessWidget {
  final String name;
  final String description;
  final VoidCallback onTap;

  const SampradayTile({
    super.key,
    required this.name,
    required this.description,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(name),
      subtitle: Text(description),
      onTap: onTap,
    );
  }
}