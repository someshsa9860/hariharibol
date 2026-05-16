import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../profile/presentation/providers/profile_providers.dart';
import '../providers/settings_providers.dart';

const _saffron = AppColors.saffron;
const _peacock = AppColors.peacock;
const _textDark = AppColors.textDark;
const _textMid = AppColors.textMuted;

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});

  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  final _nameController = TextEditingController();
  bool _isEditingName = false;
  bool _isSavingName = false;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _saveName() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) return;
    setState(() => _isSavingName = true);
    try {
      final dio = ApiClient.createDio();
      await dio.patch('/api/v1/users/me', data: {'name': name});
      if (mounted) {
        setState(() => _isEditingName = false);
        ref.invalidate(profileProvider);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Name updated')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update name')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSavingName = false);
    }
  }

  Future<void> _signOut() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Sign Out',
                style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      await ref.read(authStateProvider.notifier).logout();
      if (mounted) context.go('/login');
    }
  }

  Future<void> _deleteAccount() async {
    final textCtrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setDlg) => AlertDialog(
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16)),
          title: const Text('Delete Account',
              style: TextStyle(color: Colors.red)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'This is permanent and cannot be undone. '
                'All your data will be erased.',
                style: TextStyle(height: 1.5),
              ),
              const SizedBox(height: 16),
              const Text('Type DELETE to confirm:',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextField(
                controller: textCtrl,
                onChanged: (_) => setDlg(() {}),
                decoration: InputDecoration(
                  hintText: 'DELETE',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8)),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 8),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: textCtrl.text == 'DELETE'
                  ? () => Navigator.pop(ctx, true)
                  : null,
              child: const Text('Delete',
                  style: TextStyle(color: Colors.red)),
            ),
          ],
        ),
      ),
    );
    if (ok == true && mounted) {
      await ref.read(authStateProvider.notifier).deleteAccount();
      if (mounted) context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final email = authState.maybeWhen(
      data: (s) => s.user?.email,
      orElse: () => null,
    );
    final currentName = authState.maybeWhen(
      data: (s) => s.user?.name ?? 'Devotee',
      orElse: () => 'Devotee',
    );

    final themeMode = ref.watch(themeProvider);
    final notifPrefs = ref.watch(notifPrefsProvider);
    final fontSize = ref.watch(fontSizeProvider);
    final pkgInfo = ref.watch(packageInfoProvider);

    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
          onPressed: () => context.pop(),
        ),
        title: const Text(
          'Settings',
          style: TextStyle(fontWeight: FontWeight.bold, color: _textDark),
        ),
      ),
      body: ListView(
        children: [
          // ── Account ──────────────────────────────────────────────────────
          const _SectionHeader(title: 'Account'),
          _SettingsCard(
            children: [
              _isEditingName
                  ? Padding(
                      padding:
                          const EdgeInsets.fromLTRB(16, 12, 16, 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _nameController
                                ..text = currentName ?? '',
                              autofocus: true,
                              decoration: InputDecoration(
                                labelText: 'Name',
                                border: OutlineInputBorder(
                                    borderRadius:
                                        BorderRadius.circular(10)),
                                contentPadding:
                                    const EdgeInsets.symmetric(
                                        horizontal: 12, vertical: 8),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          _isSavingName
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: _saffron),
                                )
                              : IconButton(
                                  icon: const Icon(Icons.check_rounded,
                                      color: _saffron),
                                  onPressed: _saveName,
                                ),
                          IconButton(
                            icon: const Icon(Icons.close_rounded,
                                color: _textMid),
                            onPressed: () =>
                                setState(() => _isEditingName = false),
                          ),
                        ],
                      ),
                    )
                  : _SettingsTile(
                      icon: Icons.person_outline_rounded,
                      title: 'Name',
                      subtitle: currentName,
                      trailing: const Icon(Icons.edit_outlined,
                          size: 18, color: _textMid),
                      onTap: () => setState(() => _isEditingName = true),
                    ),
              const _Divider(),
              _SettingsTile(
                icon: Icons.email_outlined,
                title: 'Email',
                subtitle: email ?? '—',
              ),
              const _Divider(),
              _SettingsTile(
                icon: Icons.logout_rounded,
                title: 'Sign Out',
                titleColor: Colors.red,
                onTap: _signOut,
              ),
              const _Divider(),
              _SettingsTile(
                icon: Icons.delete_forever_rounded,
                title: 'Delete Account',
                titleColor: Colors.red,
                onTap: _deleteAccount,
              ),
            ],
          ),

          // ── Language ─────────────────────────────────────────────────────
          const _SectionHeader(title: 'Language'),
          _SettingsCard(
            children: [
              _LanguageTile(
                onSelect: (l) =>
                    ref.read(localeProvider.notifier).setLocale(l),
              ),
            ],
          ),

          // ── Appearance ───────────────────────────────────────────────────
          const _SectionHeader(title: 'Appearance'),
          _SettingsCard(
            children: [
              _ToggleTile(
                icon: themeMode == ThemeMode.dark
                    ? Icons.dark_mode_rounded
                    : Icons.light_mode_rounded,
                title: 'Dark Mode',
                subtitle: themeMode == ThemeMode.dark
                    ? 'Dark theme enabled'
                    : 'Light theme enabled',
                value: themeMode == ThemeMode.dark,
                onChanged: (on) => ref
                    .read(themeProvider.notifier)
                    .setTheme(on ? ThemeMode.dark : ThemeMode.light),
              ),
            ],
          ),

          // ── Notifications ────────────────────────────────────────────────
          const _SectionHeader(title: 'Notifications'),
          _SettingsCard(
            children: [
              _ToggleTile(
                icon: Icons.wb_sunny_outlined,
                title: 'Verse of the Day',
                subtitle: 'Daily spiritual verse notification',
                value: notifPrefs['verse'] ?? true,
                onChanged: (_) =>
                    ref.read(notifPrefsProvider.notifier).toggle('verse'),
              ),
              const _Divider(),
              _ToggleTile(
                icon: Icons.campaign_outlined,
                title: 'Announcements',
                subtitle: 'Community news and updates',
                value: notifPrefs['announcements'] ?? true,
                onChanged: (_) => ref
                    .read(notifPrefsProvider.notifier)
                    .toggle('announcements'),
              ),
            ],
          ),

          // ── Reading ──────────────────────────────────────────────────────
          const _SectionHeader(title: 'Reading'),
          _SettingsCard(
            children: [
              _FontSizeTile(
                fontSize: fontSize,
                onChanged: (v) =>
                    ref.read(fontSizeProvider.notifier).setSize(v),
              ),
            ],
          ),

          // ── About ────────────────────────────────────────────────────────
          const _SectionHeader(title: 'About'),
          _SettingsCard(
            children: [
              _SettingsTile(
                icon: Icons.privacy_tip_outlined,
                title: 'Privacy Policy',
                trailing: const Icon(Icons.open_in_new_rounded,
                    size: 16, color: _textMid),
                onTap: () {},
              ),
              const _Divider(),
              _SettingsTile(
                icon: Icons.gavel_rounded,
                title: 'Terms of Service',
                trailing: const Icon(Icons.open_in_new_rounded,
                    size: 16, color: _textMid),
                onTap: () {},
              ),
              const _Divider(),
              pkgInfo.when(
                data: (info) => _SettingsTile(
                  icon: Icons.info_outline_rounded,
                  title: 'About HariHariBol',
                  subtitle: 'Version ${info.version} (${info.buildNumber})',
                ),
                loading: () => const _SettingsTile(
                  icon: Icons.info_outline_rounded,
                  title: 'About HariHariBol',
                  subtitle: 'Loading…',
                ),
                error: (_, __) => const _SettingsTile(
                  icon: Icons.info_outline_rounded,
                  title: 'About HariHariBol',
                  subtitle: 'Version 1.0.0',
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ─── Section Header ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 6),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          color: _textMid,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

// ─── Settings Card ────────────────────────────────────────────────────────────

class _SettingsCard extends StatelessWidget {
  final List<Widget> children;
  const _SettingsCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(children: children),
    );
  }
}

// ─── Settings Tile ────────────────────────────────────────────────────────────

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final Color? titleColor;
  final Widget? trailing;
  final VoidCallback? onTap;

  const _SettingsTile({
    required this.icon,
    required this.title,
    this.subtitle,
    this.titleColor,
    this.trailing,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon,
          color: titleColor ?? _peacock, size: 22),
      title: Text(
        title,
        style: TextStyle(
          color: titleColor ?? _textDark,
          fontWeight: FontWeight.w500,
          fontSize: 15,
        ),
      ),
      subtitle: subtitle != null
          ? Text(subtitle!,
              style:
                  const TextStyle(color: _textMid, fontSize: 12))
          : null,
      trailing: trailing ??
          (onTap != null
              ? const Icon(Icons.chevron_right_rounded,
                  color: _textMid)
              : null),
      onTap: onTap,
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) =>
      const Divider(height: 1, indent: 56, endIndent: 16);
}

// ─── Toggle Tile ──────────────────────────────────────────────────────────────

class _ToggleTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  const _ToggleTile({
    required this.icon,
    required this.title,
    this.subtitle,
    required this.value,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: _peacock, size: 22),
      title: Text(
        title,
        style: const TextStyle(
            fontWeight: FontWeight.w500,
            color: _textDark,
            fontSize: 15),
      ),
      subtitle: subtitle != null
          ? Text(subtitle!,
              style:
                  const TextStyle(color: _textMid, fontSize: 12))
          : null,
      trailing: Switch(
          value: value, onChanged: onChanged, activeColor: _saffron),
    );
  }
}

// ─── Font Size Tile ───────────────────────────────────────────────────────────

class _FontSizeTile extends StatelessWidget {
  final double fontSize;
  final ValueChanged<double> onChanged;

  const _FontSizeTile(
      {required this.fontSize, required this.onChanged});

  String get _label {
    if (fontSize <= 0.88) return 'Small';
    if (fontSize >= 1.12) return 'Large';
    return 'Medium';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.format_size_rounded,
                  color: _peacock, size: 22),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Font Size',
                      style: TextStyle(
                          fontWeight: FontWeight.w500,
                          color: _textDark,
                          fontSize: 15),
                    ),
                    Text(
                      _label,
                      style: const TextStyle(
                          color: _textMid, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Slider(
            value: fontSize,
            min: 0.85,
            max: 1.15,
            divisions: 2,
            activeColor: _saffron,
            inactiveColor: _saffron.withOpacity(0.2),
            onChanged: (v) {
              final snapped = v <= 0.925 ? 0.85 : v >= 1.075 ? 1.15 : 1.0;
              onChanged(snapped);
            },
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: const [
                Text('A',
                    style:
                        TextStyle(fontSize: 11, color: _textMid)),
                Text('A',
                    style:
                        TextStyle(fontSize: 15, color: _textMid)),
                Text('A',
                    style:
                        TextStyle(fontSize: 20, color: _textMid)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Language Tile ────────────────────────────────────────────────────────────

class _LanguageTile extends ConsumerWidget {
  final void Function(Locale) onSelect;
  const _LanguageTile({required this.onSelect});

  static const _languages = [
    ('English', 'en'),
    ('हिंदी', 'hi'),
    ('বাংলা', 'bn'),
    ('తెలుగు', 'te'),
    ('मराठी', 'mr'),
    ('தமிழ்', 'ta'),
    ('Français', 'fr'),
    ('ગુજરાતી', 'gu'),
    ('ಕನ್ನಡ', 'kn'),
    ('മലയാളം', 'ml'),
    ('ਪੰਜਾਬੀ', 'pa'),
    ('Español', 'es'),
    ('Deutsch', 'de'),
    ('Português', 'pt'),
    ('Русский', 'ru'),
    ('العربية', 'ar'),
    ('中文', 'zh'),
    ('日本語', 'ja'),
    ('한국어', 'ko'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final current = ref.watch(localeProvider);
    final label = _languages.firstWhere(
      (l) => l.$2 == current.languageCode,
      orElse: () => _languages.first,
    ).$1;

    return ListTile(
      leading:
          const Icon(Icons.language_rounded, color: _peacock),
      title: const Text(
        'App Language',
        style: TextStyle(
            fontWeight: FontWeight.w500,
            color: _textDark,
            fontSize: 15),
      ),
      subtitle: Text(label,
          style: const TextStyle(color: _textMid, fontSize: 12)),
      trailing: const Icon(Icons.chevron_right_rounded,
          color: _textMid),
      onTap: () => showModalBottomSheet(
        context: context,
        shape: const RoundedRectangleBorder(
            borderRadius:
                BorderRadius.vertical(top: Radius.circular(20))),
        builder: (_) => _LanguageSheet(
          current: current,
          languages: _languages,
          onSelect: onSelect,
        ),
      ),
    );
  }
}

class _LanguageSheet extends StatelessWidget {
  final Locale current;
  final List<(String, String)> languages;
  final void Function(Locale) onSelect;

  const _LanguageSheet({
    required this.current,
    required this.languages,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 12),
          const Text('Select Language',
              style: TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          ...languages.map((l) => ListTile(
                title: Text(l.$1),
                trailing: l.$2 == current.languageCode
                    ? const Icon(Icons.check_rounded,
                        color: _saffron)
                    : null,
                onTap: () {
                  onSelect(Locale(l.$2));
                  Navigator.pop(context);
                },
              )),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
