import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/data/models/gurudev_model.dart';
import '../providers/chatbot_providers.dart';

const _peacock = Color(0xFF006B6B);
const _saffron = Color(0xFFFF6B00);
const _sandstone = Color(0xFFC4A882);
const _bgLight = Color(0xFFFAF6EE);
const _textDark = Color(0xFF1C1209);
const _textMuted = Color(0xFF7A6050);

class ChatSessionPage extends ConsumerStatefulWidget {
  final String sessionId;
  final String? initialPrompt;

  const ChatSessionPage({
    super.key,
    required this.sessionId,
    this.initialPrompt,
  });

  @override
  ConsumerState<ChatSessionPage> createState() =>
      _ChatSessionPageState();
}

class _ChatSessionPageState extends ConsumerState<ChatSessionPage> {
  final _textController = TextEditingController();
  bool _disclaimerDismissed = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialPrompt != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _sendMessage(widget.initialPrompt!);
      });
    }
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  void _sendMessage(String content) {
    if (content.trim().isEmpty) return;
    _textController.clear();
    ref
        .read(chatSessionNotifierProvider(widget.sessionId).notifier)
        .sendMessage(content);
  }

  Future<void> _createNewSession() async {
    try {
      final client = ref.read(gurudevDioProvider);
      final res = await client.post('/api/v1/chatbot/sessions');
      final data = res.data['data'] ?? res.data;
      final session =
          ChatbotSessionModel.fromJson(data as Map<String, dynamic>);
      if (mounted) {
        ref.invalidate(chatSessionsProvider);
        context.pushReplacement('/gurudev/session/${session.id}');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to start new conversation')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state =
        ref.watch(chatSessionNotifierProvider(widget.sessionId));
    final notifier =
        ref.read(chatSessionNotifierProvider(widget.sessionId).notifier);

    return Scaffold(
      backgroundColor: _bgLight,
      appBar: _buildAppBar(context),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [_bgLight, Color(0xFFEEF6F6)],
          ),
        ),
        child: Column(
          children: [
            if (!_disclaimerDismissed)
              _DisclaimerBanner(
                onDismiss: () =>
                    setState(() => _disclaimerDismissed = true),
              ),
            Expanded(
              child: state.isLoading
                  ? const Center(
                      child: CircularProgressIndicator(
                        valueColor:
                            AlwaysStoppedAnimation<Color>(_peacock),
                      ),
                    )
                  : state.messages.isEmpty && !state.isStreaming
                      ? _WelcomeState(onPromptSelect: _sendMessage)
                      : _MessageList(
                          state: state,
                          onCitationTap: (verseId) =>
                              context.push('/verse/$verseId'),
                          onFollowUp: _sendMessage,
                          onRetry: () => notifier.retryLastMessage(),
                        ),
            ),
            _InputBar(
              controller: _textController,
              isStreaming: state.isStreaming,
              onSend: _sendMessage,
            ),
          ],
        ),
      ),
    );
  }

  AppBar _buildAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: _peacock,
      elevation: 0,
      leading: GestureDetector(
        onTap: () => context.pop(),
        child: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            shape: BoxShape.circle,
          ),
          child: const Center(
            child: Text('🕉️', style: TextStyle(fontSize: 18)),
          ),
        ),
      ),
      title: Text(
        'GuruDev',
        style: GoogleFonts.playfairDisplay(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 20,
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.add_comment_rounded, color: Colors.white),
          tooltip: 'New Conversation',
          onPressed: _createNewSession,
        ),
        IconButton(
          icon: const Icon(Icons.more_vert_rounded, color: Colors.white),
          onPressed: () => _showOptions(context),
        ),
      ],
    );
  }

  void _showOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded,
                  color: Colors.red),
              title: const Text('Delete Conversation',
                  style: TextStyle(color: Colors.red)),
              onTap: () async {
                Navigator.pop(context);
                try {
                  final client = ref.read(gurudevDioProvider);
                  await client.delete(
                      '/api/v1/chatbot/sessions/${widget.sessionId}');
                  ref.invalidate(chatSessionsProvider);
                  if (mounted) context.pop();
                } catch (_) {}
              },
            ),
            ListTile(
              leading: const Icon(Icons.close_rounded, color: _textMuted),
              title: const Text('Cancel'),
              onTap: () => Navigator.pop(context),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

// ─── Disclaimer Banner ────────────────────────────────────────────────────────
class _DisclaimerBanner extends StatelessWidget {
  final VoidCallback onDismiss;
  const _DisclaimerBanner({required this.onDismiss});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: _peacock.withOpacity(0.08),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded, size: 16, color: _peacock),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'GuruDev provides spiritual guidance for reflection. Always consult a qualified guru for personal decisions.',
              style: TextStyle(fontSize: 11, color: _peacock, height: 1.4),
            ),
          ),
          GestureDetector(
            onTap: onDismiss,
            child: const Icon(Icons.close_rounded, size: 16, color: _peacock),
          ),
        ],
      ),
    );
  }
}

// ─── Welcome State ────────────────────────────────────────────────────────────
class _WelcomeState extends StatelessWidget {
  final void Function(String) onPromptSelect;
  const _WelcomeState({required this.onPromptSelect});

  static const _suggestions = [
    'What is dharma?',
    'Explain verse BG 2.47',
    'How to meditate?',
  ];

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('🕉️', style: TextStyle(fontSize: 64)),
            const SizedBox(height: 20),
            Text(
              'Ask me anything about the Vedas, Bhagavad Gita, or spiritual practices',
              textAlign: TextAlign.center,
              style: GoogleFonts.playfairDisplay(
                fontSize: 18,
                color: _textDark,
                height: 1.6,
              ),
            ),
            const SizedBox(height: 28),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              alignment: WrapAlignment.center,
              children: _suggestions
                  .map((s) => GestureDetector(
                        onTap: () => onPromptSelect(s),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            color: _peacock.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                                color: _peacock.withOpacity(0.35)),
                          ),
                          child: Text(
                            s,
                            style: const TextStyle(
                              fontSize: 13,
                              color: _peacock,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ))
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Message List ─────────────────────────────────────────────────────────────
class _MessageList extends StatelessWidget {
  final ChatSessionState state;
  final void Function(String verseId) onCitationTap;
  final void Function(String) onFollowUp;
  final VoidCallback onRetry;

  const _MessageList({
    required this.state,
    required this.onCitationTap,
    required this.onFollowUp,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    // Build items in reverse chronological order (index 0 = latest = bottom with reverse: true)
    final items = <Object>[];

    if (state.isStreaming && state.streamingText.isEmpty) {
      items.add('__typing__');
    } else if (state.isStreaming && state.streamingText.isNotEmpty) {
      items.add(ChatMessage(
        id: '__streaming__',
        role: 'assistant',
        content: state.streamingText,
        createdAt: DateTime.now(),
      ));
    } else if (!state.isStreaming &&
        state.messages.isNotEmpty &&
        state.messages.last.role == 'assistant' &&
        state.error == null) {
      items.add('__followup__');
    }

    // Messages in reverse chronological order
    items.addAll(state.messages.reversed);

    return ListView.builder(
      reverse: true,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      itemCount: items.length,
      itemBuilder: (_, i) {
        final item = items[i];
        if (item == '__typing__') return _TypingIndicator();
        if (item == '__followup__') {
          return _FollowUpChips(onSelect: onFollowUp);
        }
        if (item is ChatMessage) {
          // Detect the failed user message at the bottom (index 0 in reversed list)
          final isFailedMsg = state.error != null &&
              i == 0 &&
              item.role == 'user';
          return _MessageBubble(
            message: item,
            onCitationTap: onCitationTap,
            isFailedMessage: isFailedMsg,
            onRetry: isFailedMsg ? onRetry : null,
          );
        }
        return const SizedBox.shrink();
      },
    );
  }
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
class _MessageBubble extends StatelessWidget {
  final ChatMessage message;
  final void Function(String verseId) onCitationTap;
  final bool isFailedMessage;
  final VoidCallback? onRetry;

  const _MessageBubble({
    required this.message,
    required this.onCitationTap,
    this.isFailedMessage = false,
    this.onRetry,
  });

  bool get _isUser => message.role == 'user';

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment:
            _isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!_isUser) ...[
            _LotusAvatar(),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Column(
              crossAxisAlignment: _isUser
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: _isUser ? _saffron : _sandstone,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(18),
                      topRight: const Radius.circular(18),
                      bottomLeft: Radius.circular(_isUser ? 18 : 4),
                      bottomRight: Radius.circular(_isUser ? 4 : 18),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.06),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Text(
                    message.content,
                    style: TextStyle(
                      color: _isUser ? Colors.white : _textDark,
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                ),
                if (message.citations.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: message.citations
                        .map((c) => _CitationChip(
                              citation: c,
                              onTap: () => onCitationTap(c.verseId),
                            ))
                        .toList(),
                  ),
                ],
                if (isFailedMessage && onRetry != null) ...[
                  const SizedBox(height: 6),
                  GestureDetector(
                    onTap: onRetry,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border:
                            Border.all(color: Colors.red.withOpacity(0.3)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.refresh_rounded,
                              size: 14, color: Colors.red),
                          SizedBox(width: 4),
                          Text(
                            'Failed to send · Retry',
                            style:
                                TextStyle(fontSize: 11, color: Colors.red),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 2),
                Text(
                  _formatTime(message.createdAt),
                  style: const TextStyle(fontSize: 10, color: _textMuted),
                ),
              ],
            ),
          ),
          if (_isUser) const SizedBox(width: 8),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour.toString().padLeft(2, '0');
    final m = dt.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

// ─── Lotus Avatar (GuruDev icon in chat) ─────────────────────────────────────
class _LotusAvatar extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: _peacock.withOpacity(0.15),
        border: Border.all(color: _peacock.withOpacity(0.3), width: 1),
      ),
      child: const Center(
        child: Text('🪷', style: TextStyle(fontSize: 14)),
      ),
    );
  }
}

// ─── Citation Chip ────────────────────────────────────────────────────────────
class _CitationChip extends StatelessWidget {
  final CitationModel citation;
  final VoidCallback onTap;

  const _CitationChip({required this.citation, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: _peacock.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _peacock.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.menu_book_rounded, size: 12, color: _peacock),
            const SizedBox(width: 4),
            Text(
              citation.excerpt.length > 20
                  ? '${citation.excerpt.substring(0, 20)}...'
                  : citation.excerpt,
              style: const TextStyle(fontSize: 11, color: _peacock),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
class _TypingIndicator extends StatefulWidget {
  @override
  State<_TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<_TypingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          _LotusAvatar(),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: _sandstone.withOpacity(0.6),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(18),
                topRight: Radius.circular(18),
                bottomRight: Radius.circular(18),
                bottomLeft: Radius.circular(4),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.06),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: AnimatedBuilder(
              animation: _controller,
              builder: (_, __) => Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(
                  3,
                  (i) => _Dot(delay: i * 0.3, progress: _controller.value),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  final double delay;
  final double progress;

  const _Dot({required this.delay, required this.progress});

  @override
  Widget build(BuildContext context) {
    final val = ((progress - delay) % 1.0 + 1.0) % 1.0;
    final opacity = (val < 0.5 ? val * 2 : (1 - val) * 2).clamp(0.3, 1.0);
    return Container(
      width: 7,
      height: 7,
      margin: const EdgeInsets.symmetric(horizontal: 2),
      decoration: BoxDecoration(
        color: _peacock.withOpacity(opacity),
        shape: BoxShape.circle,
      ),
    );
  }
}

// ─── Follow-up Chips ──────────────────────────────────────────────────────────
class _FollowUpChips extends StatelessWidget {
  final void Function(String) onSelect;
  const _FollowUpChips({required this.onSelect});

  static const _suggestions = [
    'Tell me more',
    'Give me an example',
    'How to practice this?',
    'What verse relates to this?',
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        children: _suggestions
            .map((s) => GestureDetector(
                  onTap: () => onSelect(s),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: _peacock.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: _peacock.withOpacity(0.25)),
                    ),
                    child: Text(
                      s,
                      style: const TextStyle(
                          fontSize: 12, color: _peacock),
                    ),
                  ),
                ))
            .toList(),
      ),
    );
  }
}

// ─── Input Bar ────────────────────────────────────────────────────────────────
class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool isStreaming;
  final void Function(String) onSend;

  const _InputBar({
    required this.controller,
    required this.isStreaming,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 12,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          child: Row(
            children: [
              // Voice input button
              GestureDetector(
                onTap: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Voice coming soon'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: _peacock.withOpacity(0.1),
                    shape: BoxShape.circle,
                    border: Border.all(color: _peacock.withOpacity(0.2)),
                  ),
                  child: const Icon(
                    Icons.mic_rounded,
                    color: _peacock,
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: _sandstone.withOpacity(0.18),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: _sandstone.withOpacity(0.45)),
                  ),
                  child: TextField(
                    controller: controller,
                    maxLines: 4,
                    minLines: 1,
                    textInputAction: TextInputAction.send,
                    onSubmitted: isStreaming ? null : onSend,
                    decoration: const InputDecoration(
                      hintText: 'Ask GuruDev about spiritual wisdom...',
                      hintStyle:
                          TextStyle(color: _textMuted, fontSize: 13),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // Send button
              GestureDetector(
                onTap: isStreaming ? null : () => onSend(controller.text),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color:
                        isStreaming ? _saffron.withOpacity(0.4) : _saffron,
                    shape: BoxShape.circle,
                  ),
                  child: isStreaming
                      ? const Center(
                          child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          ),
                        )
                      : const Icon(
                          Icons.arrow_upward_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
