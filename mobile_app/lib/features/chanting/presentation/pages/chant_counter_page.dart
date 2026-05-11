import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/chanting_providers.dart';
import '../widgets/streak_badge.dart';

// ─── Palette ──────────────────────────────────────────────────────────────────
const _darkBg = Color(0xFF0A0A0F);
const _darkSurface = Color(0xFF15151E);
const _saffron = Color(0xFFFF7E00);
const _saffronDeep = Color(0xFFD96100);
const _saffronDim = Color(0xFF7A3800);
const _gold = Color(0xFFD4A04C);

// ─── Page ─────────────────────────────────────────────────────────────────────
class ChantCounterPage extends ConsumerStatefulWidget {
  final String mantraId;
  final String mantraName;
  final int goal;

  const ChantCounterPage({
    super.key,
    required this.mantraId,
    required this.mantraName,
    required this.goal,
  });

  @override
  ConsumerState<ChantCounterPage> createState() => _ChantCounterPageState();
}

class _ChantCounterPageState extends ConsumerState<ChantCounterPage>
    with TickerProviderStateMixin {
  late final ChantParams _params;
  late final AnimationController _pulseCtrl;
  late final Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _params = ChantParams(
      mantraId: widget.mantraId,
      mantraName: widget.mantraName,
      goal: widget.goal,
    );
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 120),
    );
    _pulseAnim = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  void _onTap() {
    final notifier = ref.read(chantCounterProvider(_params).notifier);
    notifier.increment();
    HapticFeedback.lightImpact();
    _pulseCtrl.forward().then((_) => _pulseCtrl.reverse());
  }

  Future<void> _done() async {
    final notifier = ref.read(chantCounterProvider(_params).notifier);
    final state = ref.read(chantCounterProvider(_params));

    if (state.count == 0) {
      context.pop();
      return;
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _SavingDialog(),
    );

    final success = await notifier.done();
    if (mounted) {
      Navigator.of(context).pop(); // close dialog
      if (success) {
        _showDoneSnack('Session saved — ${state.count} chants logged 🙏');
      } else {
        _showDoneSnack('Saved locally — will sync when online');
      }
      context.pop();
    }
  }

  void _showDoneSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: _saffron,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chantCounterProvider(_params));
    final malas = state.count ~/ 108;
    final beadsFilled = state.count % 108;

    return Scaffold(
      backgroundColor: _darkBg,
      body: GestureDetector(
        onTap: state.isPaused ? null : _onTap,
        behavior: HitTestBehavior.opaque,
        child: SafeArea(
          child: Column(
            children: [
              _TopBar(
                mantraName: state.mantraName,
                malas: malas,
                onClose: () => context.pop(),
              ),
              // Mala + count
              Expanded(
                child: ScaleTransition(
                  scale: _pulseAnim,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Mala ring
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: AspectRatio(
                          aspectRatio: 1,
                          child: CustomPaint(
                            painter: _MalaPainter(
                              filled: beadsFilled,
                              isPaused: state.isPaused,
                            ),
                          ),
                        ),
                      ),
                      // Center count display
                      _CountDisplay(
                        count: state.count,
                        goal: state.goal,
                        isPaused: state.isPaused,
                      ),
                    ],
                  ),
                ),
              ),
              // Tap hint
              if (!state.isPaused)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(
                    'Tap anywhere to chant',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.3),
                      fontSize: 13,
                    ),
                  ),
                ),
              // Bottom controls
              _BottomControls(
                params: _params,
                onDone: _done,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────
class _TopBar extends StatelessWidget {
  final String mantraName;
  final int malas;
  final VoidCallback onClose;

  const _TopBar({
    required this.mantraName,
    required this.malas,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.close_rounded, color: Colors.white54),
            onPressed: onClose,
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  mantraName,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: _saffron,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.3,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (malas > 0)
                  Text(
                    '$malas mala${malas > 1 ? 's' : ''} completed',
                    style: TextStyle(
                      color: _gold.withOpacity(0.8),
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

// ─── Count Display ────────────────────────────────────────────────────────────
class _CountDisplay extends StatelessWidget {
  final int count;
  final int goal;
  final bool isPaused;

  const _CountDisplay({
    required this.count,
    required this.goal,
    required this.isPaused,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isPaused)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.pause_rounded, color: Colors.white54, size: 14),
                SizedBox(width: 6),
                Text(
                  'Paused',
                  style: TextStyle(color: Colors.white54, fontSize: 13),
                ),
              ],
            ),
          ),
        Text(
          '$count',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 72,
            fontWeight: FontWeight.w200,
            letterSpacing: -2,
          ),
        ),
        Text(
          '${count % 108} / $goal',
          style: TextStyle(
            color: Colors.white.withOpacity(0.45),
            fontSize: 16,
          ),
        ),
      ],
    );
  }
}

// ─── Bottom Controls ──────────────────────────────────────────────────────────
class _BottomControls extends ConsumerWidget {
  final ChantParams params;
  final Future<void> Function() onDone;

  const _BottomControls({required this.params, required this.onDone});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(chantCounterProvider(params));
    final notifier = ref.read(chantCounterProvider(params).notifier);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Row(
        children: [
          // Pause / Resume
          Expanded(
            child: _ControlButton(
              icon: state.isPaused
                  ? Icons.play_arrow_rounded
                  : Icons.pause_rounded,
              label: state.isPaused ? 'Resume' : 'Pause',
              color: Colors.white24,
              textColor: Colors.white70,
              onTap: () {
                HapticFeedback.selectionClick();
                notifier.togglePause();
              },
            ),
          ),
          const SizedBox(width: 12),
          // Reset
          Expanded(
            child: _ControlButton(
              icon: Icons.refresh_rounded,
              label: 'Reset',
              color: Colors.white10,
              textColor: Colors.white54,
              onTap: () => _confirmReset(context, notifier),
            ),
          ),
          const SizedBox(width: 12),
          // Done
          Expanded(
            child: _ControlButton(
              icon: Icons.check_rounded,
              label: 'Done',
              color: _saffron,
              textColor: Colors.white,
              onTap: onDone,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmReset(
      BuildContext context, ChantCounterNotifier notifier) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: _darkSurface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Reset session?',
            style: TextStyle(color: Colors.white)),
        content: const Text('Your current count will be lost.',
            style: TextStyle(color: Colors.white54)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel',
                style: TextStyle(color: Colors.white54)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Reset',
                style: TextStyle(color: _saffron)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      HapticFeedback.mediumImpact();
      notifier.reset();
    }
  }
}

class _ControlButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final Color textColor;
  final dynamic onTap;

  const _ControlButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.textColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onTap(),
      child: Container(
        height: 56,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: textColor, size: 22),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: textColor,
                fontSize: 11,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Saving Dialog ────────────────────────────────────────────────────────────
class _SavingDialog extends StatelessWidget {
  const _SavingDialog();

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: _darkSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: const Padding(
        padding: EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(_saffron),
            ),
            SizedBox(height: 16),
            Text(
              'Saving session...',
              style: TextStyle(color: Colors.white70, fontSize: 15),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Mala Painter ─────────────────────────────────────────────────────────────
class _MalaPainter extends CustomPainter {
  final int filled;
  final bool isPaused;

  const _MalaPainter({required this.filled, required this.isPaused});

  static const _totalBeads = 108;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final ringRadius = min(size.width, size.height) / 2 - 18;
    const beadRadius = 5.5;
    const markerRadius = 8.0;

    for (int i = 0; i < _totalBeads; i++) {
      final angle = (i * 2 * pi / _totalBeads) - pi / 2;
      final x = center.dx + ringRadius * cos(angle);
      final y = center.dy + ringRadius * sin(angle);
      final pos = Offset(x, y);

      final isFilled = i < filled;
      final isMaru = i == 0; // the meru/marker bead

      if (isMaru) {
        // Meru bead — slightly larger, gold ring
        canvas.drawCircle(
          pos,
          markerRadius,
          Paint()
            ..color = filled == 0
                ? Colors.white.withOpacity(0.12)
                : _gold.withOpacity(0.9)
            ..style = PaintingStyle.fill,
        );
      } else if (isFilled) {
        // Filled saffron bead
        canvas.drawCircle(
          pos,
          beadRadius,
          Paint()
            ..color = isPaused
                ? _saffron.withOpacity(0.5)
                : _saffron
            ..style = PaintingStyle.fill,
        );
        // Glow
        if (!isPaused) {
          canvas.drawCircle(
            pos,
            beadRadius + 2,
            Paint()
              ..color = _saffron.withOpacity(0.18)
              ..style = PaintingStyle.fill,
          );
        }
      } else {
        // Empty bead
        canvas.drawCircle(
          pos,
          beadRadius,
          Paint()
            ..color = Colors.white.withOpacity(0.1)
            ..style = PaintingStyle.fill,
        );
        canvas.drawCircle(
          pos,
          beadRadius,
          Paint()
            ..color = Colors.white.withOpacity(0.15)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1,
        );
      }
    }

    // Connecting thread (subtle ring behind beads)
    canvas.drawCircle(
      center,
      ringRadius,
      Paint()
        ..color = Colors.white.withOpacity(0.06)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
  }

  @override
  bool shouldRepaint(_MalaPainter old) =>
      old.filled != filled || old.isPaused != isPaused;
}
