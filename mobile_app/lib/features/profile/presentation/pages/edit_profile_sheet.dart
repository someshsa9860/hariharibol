import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../home/presentation/providers/home_provider.dart';
import '../providers/profile_providers.dart';

class EditProfileSheet extends ConsumerStatefulWidget {
  final String currentName;
  final VoidCallback onSaved;

  const EditProfileSheet({
    super.key,
    required this.currentName,
    required this.onSaved,
  });

  @override
  ConsumerState<EditProfileSheet> createState() =>
      _EditProfileSheetState();
}

class _EditProfileSheetState extends ConsumerState<EditProfileSheet> {
  late final TextEditingController _nameCtrl;
  String? _selectedLang;
  Uint8List? _avatarBytes;
  String? _avatarFilename;
  bool _saving = false;

  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.currentName);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1024,
        maxHeight: 1024,
        imageQuality: 85,
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      setState(() {
        _avatarBytes = bytes;
        _avatarFilename = file.name;
      });
    } catch (_) {}
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) return;

    setState(() => _saving = true);
    try {
      final client = ref.read(dioProvider);

      if (_avatarBytes != null) {
        final formData = FormData.fromMap({
          'file': MultipartFile.fromBytes(
            _avatarBytes!,
            filename: _avatarFilename ?? 'avatar.jpg',
          ),
        });
        await client.post('/api/v1/users/me/avatar', data: formData);
      }

      await client.patch('/api/v1/users/me', data: {
        'name': name,
        if (_selectedLang != null) 'languagePreference': _selectedLang,
      });

      widget.onSaved();
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle_rounded, color: Colors.white),
                SizedBox(width: 8),
                Text('Profile updated'),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to save profile'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final langsAsync = ref.watch(languagesProvider);
    final bottom = MediaQuery.viewInsetsOf(context).bottom;

    return Container(
      padding:
          EdgeInsets.fromLTRB(24, 20, 24, 24 + bottom),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Edit Profile',
              style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textDark),
            ),
            const SizedBox(height: 24),

            // Avatar picker
            Center(
              child: GestureDetector(
                onTap: _pickAvatar,
                child: Stack(
                  children: [
                    Container(
                      width: 92,
                      height: 92,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border:
                            Border.all(color: AppColors.gold, width: 3),
                        color: AppColors.sandstone.withOpacity(0.2),
                      ),
                      child: ClipOval(
                        child: _avatarBytes != null
                            ? Image.memory(_avatarBytes!,
                                fit: BoxFit.cover)
                            : const Center(
                                child: Icon(Icons.person_rounded,
                                    size: 44,
                                    color: AppColors.sandstone),
                              ),
                      ),
                    ),
                    Positioned(
                      right: 0,
                      bottom: 0,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: const BoxDecoration(
                          color: AppColors.saffron,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.camera_alt_rounded,
                            size: 16, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Name field
            TextField(
              controller: _nameCtrl,
              decoration: InputDecoration(
                labelText: 'Display Name',
                prefixIcon:
                    const Icon(Icons.person_outline_rounded),
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
              ),
            ),
            const SizedBox(height: 16),

            // Language selector
            langsAsync.when(
              loading: () =>
                  const LinearProgressIndicator(minHeight: 2),
              error: (_, __) => const SizedBox.shrink(),
              data: (langs) => DropdownButtonFormField<String>(
                value: _selectedLang,
                decoration: InputDecoration(
                  labelText: 'Content Language',
                  prefixIcon: const Icon(Icons.language_rounded),
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                ),
                hint: const Text('Select language'),
                isExpanded: true,
                items: langs
                    .map((l) => DropdownMenuItem(
                          value: l.code,
                          child: Text(l.name),
                        ))
                    .toList(),
                onChanged: (v) =>
                    setState(() => _selectedLang = v),
              ),
            ),
            const SizedBox(height: 24),

            // Save button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.saffron,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24)),
                  disabledBackgroundColor:
                      AppColors.saffron.withOpacity(0.5),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white),
                      )
                    : const Text(
                        'Save Changes',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
