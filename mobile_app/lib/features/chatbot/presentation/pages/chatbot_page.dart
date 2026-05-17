import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shimmer/shimmer.dart';
import '../../../../core/data/models/gurudev_model.dart';
import '../providers/chatbot_providers.dart';

const _saffron = Color(0xFFFF6B00);
const _peacock = Color(0xFF006B6B);
const _peacockDark = Color(0xFF004F4F);
const _bgLight = Color(0xFFFAF6EE);
const _textDark = Color(0xFF1C1209);
const _textMid = Color(0xFF7A6050);

class ChatbotPage extends ConsumerStatefulWidget {
  const ChatbotPage({super.key});

  @override
  ConsumerState<ChatbotPage> createState() => _ChatbotPageState();
}

class _ChatbotPageState extends ConsumerState<ChatbotPage> {
  bool _isCreating = false;

  Future<void> _createNewSession() async {
    setState(() => _isCreating = true);
    try {
      final client = ref.read(gurudevDioProvider);
      final response =
          await client.post('/api/v1/chatbot/sessions');
      final data = response.data['data'] ?? response.data;
      final session = ChatbotSessionModel.fromJson(
          data as Map<String, dynamic>);
      if (mounted) {
        context.push('/gurudev/session/${session.id}');
        ref.invalidate(chatSessionsProvider);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to start conversation')),
        );
      }
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sessionsAsync = ref.watch(chatSessionsProvider);
    final prompts = ref.watch(suggestedPromptsProvider);

    return Scaffold(
      backgroundColor: _bgLight,
      body: CustomScrollView(
        slivers: [
          _buildAppBar(context),
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _GuruHeader(
                  onNewChat: _isCreating ? null : _createNewSession,
                  isCreating: _isCreating,
                ),
                _SuggestedPromptsRow(
                  prompts: prompts,
                  onSelect: (p) async {
                    setState(() => _isCreating = true);
                    try {
                      final client = ref.read(gurudevDioProvider);
                      final res =
                          await client.post('/api/v1/chatbot/sessions');
                      final data = res.data['data'] ?? res.data;
                      final session = ChatbotSessionModel.fromJson(
                          data as Map<String, dynamic>);
                      if (mounted) {
                        context.push('/gurudev/session/${session.id}',
                            extra: {'initialPrompt': p});
                        ref.invalidate(chatSessionsProvider);
                      }
                    } catch (_) {
                    } finally {
                      if (mounted) setState(() => _isCreating = false);
                    }
                  },
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                  child: Text(
                    'Recent Conversations',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: _textDark,
                        ),
                  ),
                ),
              ],
            ),
          ),
          sessionsAsync.when(
            loading: () => SliverList(
              delegate: SliverChildBuilderDelegate(
                (_, __) => _SessionShimmer(),
                childCount: 4,
              ),
            ),
            error: (_, __) => const SliverToBoxAdapter(
              child: Center(
                child: Padding(
                  padding: EdgeInsets.all(32),
                  child: Text('Could not load conversations',
                      style: TextStyle(color: _textMid)),
                ),
              ),
            ),
            data: (sessions) => sessions.isEmpty
                ? SliverToBoxAdapter(
                    child: _EmptyState(onStart: _createNewSession),
                  )
                : SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => _SessionTile(
                        session: sessions[i],
                        onTap: () => context
                            .push('/gurudev/session/${sessions[i].id}'),
                        onDelete: () async {
                          try {
                            final client = ref.read(gurudevDioProvider);
                            await client.delete(
                                '/api/v1/chatbot/sessions/${sessions[i].id}');
                            ref.invalidate(chatSessionsProvider);
                          } catch (_) {}
                        },
                      ),
                      childCount: sessions.length,
                    ),
                  ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }

  SliverAppBar _buildAppBar(BuildContext context) {
    return SliverAppBar(
      backgroundColor: _peacock,
      elevation: 0,
      floating: true,
      snap: true,
      leading: Container(
        margin: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.15),
          shape: BoxShape.circle,
        ),
        child: const Center(
          child: Text('🕉️', style: TextStyle(fontSize: 18)),
        ),
      ),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'GuruDev',
            style: GoogleFonts.playfairDisplay(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 20,
            ),
          ),
          const Text(
            'Your AI spiritual guide',
            style: TextStyle(fontSize: 11, color: Colors.white70),
          ),
        ],
      ),
    );
  }
}

// ─── Guru Header ──────────────────────────────────────────────────────────────
class _GuruHeader extends StatelessWidget {
  final VoidCallback? onNewChat;
  final bool isCreating;

  const _GuruHeader({required this.onNewChat, required this.isCreating});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [_peacock, _peacockDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(
            color: _peacock.withOpacity(0.35),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          _GuruAvatar(size: 64, showGlow: true),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'GuruDev',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Ask anything about Vedic wisdom, mantras, spiritual practice, or find guidance for your journey.',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 12,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 36,
                  child: ElevatedButton(
                    onPressed: onNewChat,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _saffron,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(18),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    child: isCreating
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.add_rounded, size: 16),
                              SizedBox(width: 4),
                              Text(
                                'New Conversation',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Guru Avatar ──────────────────────────────────────────────────────────────
class _GuruAvatar extends StatelessWidget {
  final double size;
  final bool showGlow;

  const _GuruAvatar({required this.size, this.showGlow = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [_peacock, _peacockDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: showGlow
            ? [
                BoxShadow(
                  color: _peacock.withOpacity(0.5),
                  blurRadius: 12,
                  spreadRadius: 2,
                ),
              ]
            : null,
        border: Border.all(
          color: Colors.white.withOpacity(0.3),
          width: 2,
        ),
      ),
      child: Center(
        child: Text(
          '🕉️',
          style: TextStyle(fontSize: size * 0.45),
        ),
      ),
    );
  }
}

// ─── Suggested Prompts Row ─────────────────────────────────────────────────────
class _SuggestedPromptsRow extends StatelessWidget {
  final List<String> prompts;
  final void Function(String) onSelect;

  const _SuggestedPromptsRow(
      {required this.prompts, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Text(
            'Suggested questions',
            style: TextStyle(
              color: _textMid,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        SizedBox(
          height: 40,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: prompts.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (_, i) => GestureDetector(
              onTap: () => onSelect(prompts[i]),
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                      color: _peacock.withOpacity(0.2)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Text(
                  prompts[i],
                  style: const TextStyle(
                    fontSize: 12,
                    color: _peacock,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Session Tile ─────────────────────────────────────────────────────────────
class _SessionTile extends StatelessWidget {
  final ChatbotSessionModel session;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  const _SessionTile({
    required this.session,
    required this.onTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final timeAgo = _formatTime(session.updatedAt);
    return Dismissible(
      key: Key(session.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: Colors.red[100],
        child: const Icon(Icons.delete_rounded, color: Colors.red),
      ),
      onDismissed: (_) => onDelete(),
      child: InkWell(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _peacock.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: const Center(
                  child: Text('💬', style: TextStyle(fontSize: 18)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      session.title.isEmpty
                          ? 'Spiritual Conversation'
                          : session.title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: _textDark,
                        fontSize: 14,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${session.messageCount} messages',
                      style: const TextStyle(
                          color: _textMid, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                timeAgo,
                style:
                    const TextStyle(color: _textMid, fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${diff.inDays}d ago';
  }
}

// ─── Session Shimmer ──────────────────────────────────────────────────────────
class _SessionShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey[200]!,
      highlightColor: Colors.grey[50]!,
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        height: 76,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}

// ─── Empty State ──────────────────────────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  final VoidCallback onStart;
  const _EmptyState({required this.onStart});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(40),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const _GuruAvatar(size: 72),
          const SizedBox(height: 20),
          const Text(
            'No conversations yet',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _textDark,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Start a spiritual journey with GuruDev — your AI guide through Vedic wisdom.',
            textAlign: TextAlign.center,
            style: TextStyle(color: _textMid, height: 1.5),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: onStart,
            style: ElevatedButton.styleFrom(
              backgroundColor: _saffron,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              padding: const EdgeInsets.symmetric(
                  horizontal: 24, vertical: 12),
            ),
            child: const Text(
              'Begin a Conversation',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
