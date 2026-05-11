import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../providers/auth_provider.dart';

// ─── Provider ────────────────────────────────────────────────────────────────

final _sampradayasProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.watch(authRepositoryProvider);
  return repo.getSampradayas();
});

// ─── Page ────────────────────────────────────────────────────────────────────

class OnboardingSampradayPage extends ConsumerStatefulWidget {
  const OnboardingSampradayPage({super.key});

  @override
  ConsumerState<OnboardingSampradayPage> createState() => _OnboardingSampradayPageState();
}

class _OnboardingSampradayPageState extends ConsumerState<OnboardingSampradayPage> {
  static const _saffron = Color(0xFFC75A1A);
  static const _cream = Color(0xFFFFF8EC);

  String? _selectedId;
  bool _saving = false;

  Future<void> _confirm() async {
    if (_selectedId == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(authStateProvider.notifier).completeOnboarding(_selectedId!);
      if (mounted) context.go('/home');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not save selection: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _skip() => context.go('/home');

  @override
  Widget build(BuildContext context) {
    final sampradayasAsync = ref.watch(_sampradayasProvider);

    return Scaffold(
      backgroundColor: _cream,
      body: SafeArea(
        child: Column(
          children: [
            // ── Header ───────────────────────────────────────────────────
            Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF1A0A00), Color(0xFF3D1A00)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              padding: const EdgeInsets.fromLTRB(24, 32, 24, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: _saffron.withAlpha(51),
                          shape: BoxShape.circle,
                        ),
                        child: const Text('🙏', style: TextStyle(fontSize: 28)),
                      ),
                      const Spacer(),
                      TextButton(
                        onPressed: _skip,
                        child: const Text('Skip', style: TextStyle(color: Colors.white54, fontSize: 14)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'Choose Your Sampraday',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.3,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'We\'ll personalise your Verse of the Day and feed based on your spiritual tradition.',
                    style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.5),
                  ),
                ],
              ),
            ),

            // ── Grid ─────────────────────────────────────────────────────
            Expanded(
              child: sampradayasAsync.when(
                loading: () => const Center(child: CircularProgressIndicator(color: _saffron)),
                error: (e, _) => Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('Could not load traditions', style: TextStyle(color: Colors.black54)),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: () => ref.invalidate(_sampradayasProvider),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                ),
                data: (list) => GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 14,
                    childAspectRatio: 0.82,
                  ),
                  itemCount: list.length,
                  itemBuilder: (ctx, i) => _SampradayCard(
                    data: list[i],
                    selected: _selectedId == list[i]['id'],
                    onTap: () => setState(() => _selectedId = list[i]['id']),
                  ),
                ),
              ),
            ),

            // ── Bottom bar ────────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
              decoration: const BoxDecoration(
                color: Colors.white,
                boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, -2))],
              ),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: _selectedId == null || _saving ? null : _confirm,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _saffron,
                    disabledBackgroundColor: _saffron.withAlpha(89),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 22, height: 22,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                        )
                      : const Text(
                          'Continue',
                          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Card widget ──────────────────────────────────────────────────────────────

class _SampradayCard extends StatelessWidget {
  final Map<String, dynamic> data;
  final bool selected;
  final VoidCallback onTap;

  const _SampradayCard({required this.data, required this.selected, required this.onTap});

  static const _saffron = Color(0xFFC75A1A);

  @override
  Widget build(BuildContext context) {
    final name = (data['nameKey'] ?? data['name'] ?? 'Sampraday').toString();
    final thumb = data['thumbnailUrl'] as String?;
    final deity = (data['primaryDeityKey'] ?? '').toString();
    final followers = data['followerCount'] ?? 0;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? _saffron : Colors.transparent,
            width: 2.5,
          ),
          boxShadow: [
            BoxShadow(
              color: selected ? _saffron.withAlpha(46) : Colors.black.withAlpha(15),
              blurRadius: selected ? 12 : 6,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Thumbnail
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                child: thumb != null
                    ? CachedNetworkImage(
                        imageUrl: thumb,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => _placeholder(),
                        errorWidget: (context, url, err) => _placeholder(),
                      )
                    : _placeholder(),
              ),
            ),

            // Info
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: Color(0xFF1A1410),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (deity.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      deity,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF8B7D73)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.people_outline, size: 11, color: _saffron.withAlpha(179)),
                      const SizedBox(width: 3),
                      Text(
                        '$followers followers',
                        style: TextStyle(fontSize: 10, color: _saffron.withAlpha(204)),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Selected check
            if (selected)
              Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.only(top: 6, right: 6),
                  child: Container(
                    width: 22,
                    height: 22,
                    decoration: const BoxDecoration(color: _saffron, shape: BoxShape.circle),
                    child: const Icon(Icons.check, color: Colors.white, size: 14),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _placeholder() => Container(
        color: const Color(0xFFF5E6D3),
        child: const Center(child: Text('🕉️', style: TextStyle(fontSize: 32))),
      );
}
