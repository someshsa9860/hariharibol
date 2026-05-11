import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/chatbot_providers.dart';

const _saffron = Color(0xFFFF7E00);
const _krishnaBlue = Color(0xFF1A4D8F);
const _cream = Color(0xFFFFF8EC);
const _textDark = Color(0xFF1A1410);
const _textMid = Color(0xFF8B7D73);

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
  final _scrollController = ScrollController();
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
    _scrollController.dispose();
    super.dispose();
  }

  void _sendMessage(String content) {
    if (content.trim().isEmpty) return;
    _textController.clear();
    ref
        .read(chatSessionNotifierProvider(widget.sessionId).notifier)
        .sendMessage(content);
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state =
        ref.watch(chatSessionNotifierProvider(widget.sessionId));

    ref.listen(
      chatSessionNotifierProvider(widget.sessionId),
      (prev, next) {
        if (next.messages.length != (prev?.messages.length ?? 0) ||
            next.isStreaming) {
          _scrollToBottom();
        }
      },
    );

    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0.5,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
          onPressed: () => context.pop(),
        ),
        title: Row(
          children: [
            _GuruAvatarSmall(),
            const SizedBox(width: 10),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'GuruDev',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: _textDark,
                    fontSize: 15,
                  ),
                ),
                Text(
                  'AI Spiritual Guide',
                  style: TextStyle(fontSize: 11, color: _textMid),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert_rounded, color: _textDark),
            onPressed: () => _showOptions(context),
          ),
        ],
      ),
      body: Column(
        children: [
          if (!_disclaimerDismissed) _DisclaimerBanner(
            onDismiss: () => setState(() => _disclaimerDismissed = true),
          ),
          Expanded(
            child: state.isLoading
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor:
                          AlwaysStoppedAnimation<Color>(_saffron),
                    ),
                  )
                : state.messages.isEmpty && !state.isStreaming
                    ? _WelcomeState()
                    : _MessageList(
                        state: state,
                        scrollController: _scrollController,
                        onCitationTap: (verseId) =>
                            context.push('/verse/$verseId'),
                        onFollowUp: _sendMessage,
                      ),
          ),
          _InputBar(
            controller: _textController,
            isStreaming: state.isStreaming,
            onSend: _sendMessage,
          ),
        ],
      ),
    );
  }

  void _showOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            ListTile(
              leading:
                  const Icon(Icons.delete_outline_rounded, color: Colors.red),
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
              leading:
                  const Icon(Icons.close_rounded, color: _textMid),
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
      padding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: _krishnaBlue.withOpacity(0.08),
      child: Row(
        children: [
          const Icon(Icons.info_outline_rounded,
              size: 16, color: _krishnaBlue),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'GuruDev provides spiritual guidance for reflection. Always consult a qualified guru for personal decisions.',
              style: TextStyle(
                  fontSize: 11, color: _krishnaBlue, height: 1.4),
            ),
          ),
          GestureDetector(
            onTap: onDismiss,
            child: const Icon(Icons.close_rounded,
                size: 16, color: _krishnaBlue),
          ),
        ],
      ),
    );
  }
}

// ─── Welcome State ────────────────────────────────────────────────────────────
class _WelcomeState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('🕉️', style: TextStyle(fontSize: 48)),
          SizedBox(height: 16),
          Text(
            'Namaste! I am GuruDev.',
            style: TextStyle(
                fontWeight: FontWeight.bold,
                color: _textDark,
                fontSize: 18),
          ),
          SizedBox(height: 8),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              'Ask me about Vedic wisdom, mantras, meditation, or any spiritual question.',
              textAlign: TextAlign.center,
              style: TextStyle(color: _textMid, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Message List ─────────────────────────────────────────────────────────────
class _MessageList extends StatelessWidget {
  final ChatSessionState state;
  final ScrollController scrollController;
  final void Function(String verseId) onCitationTap;
  final void Function(String) onFollowUp;

  const _MessageList({
    required this.state,
    required this.scrollController,
    required this.onCitationTap,
    required this.onFollowUp,
  });

  @override
  Widget build(BuildContext context) {
    final allMessages = [
      ...state.messages,
      if (state.isStreaming && state.streamingText.isNotEmpty)
        ChatMessage(
          id: '__streaming__',
          role: 'assistant',
          content: state.streamingText,
          createdAt: DateTime.now(),
        ),
    ];

    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      itemCount: allMessages.length +
          (state.isStreaming && state.streamingText.isEmpty ? 1 : 0) +
          (allMessages.isNotEmpty &&
                  allMessages.last.role == 'assistant' &&
                  !state.isStreaming
              ? 1
              : 0),
      itemBuilder: (_, i) {
        // Typing indicator
        if (state.isStreaming &&
            state.streamingText.isEmpty &&
            i == allMessages.length) {
          return _TypingIndicator();
        }

        // Follow-up suggestions after last assistant message
        if (!state.isStreaming &&
            allMessages.isNotEmpty &&
            allMessages.last.role == 'assistant' &&
            i == allMessages.length) {
          return _FollowUpChips(onSelect: onFollowUp);
        }

        if (i >= allMessages.length) return const SizedBox.shrink();
        final msg = allMessages[i];
        return _MessageBubble(
          message: msg,
          onCitationTap: onCitationTap,
        );
      },
    );
  }
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
class _MessageBubble extends StatelessWidget {
  final ChatMessage message;
  final void Function(String verseId) onCitationTap;

  const _MessageBubble({
    required this.message,
    required this.onCitationTap,
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
            _GuruAvatarSmall(),
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
                    color: _isUser ? _saffron : Colors.white,
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
                    children: message.citations
                        .map((c) => _CitationChip(
                              citation: c,
                              onTap: () => onCitationTap(c.verseId),
                            ))
                        .toList(),
                  ),
                ],
                const SizedBox(height: 2),
                Text(
                  _formatTime(message.createdAt),
                  style: const TextStyle(
                      fontSize: 10, color: _textMid),
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

// ─── Citation Chip ────────────────────────────────────────────────────────────
class _CitationChip extends StatelessWidget {
  final dynamic citation;
  final VoidCallback onTap;

  const _CitationChip({required this.citation, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: _krishnaBlue.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _krishnaBlue.withOpacity(0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.menu_book_rounded,
                size: 12, color: _krishnaBlue),
            const SizedBox(width: 4),
            Text(
              citation.excerpt.length > 20
                  ? '${citation.excerpt.substring(0, 20)}...'
                  : citation.excerpt,
              style: const TextStyle(
                  fontSize: 11, color: _krishnaBlue),
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
          _GuruAvatarSmall(),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: Colors.white,
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
                  (i) => _Dot(
                    delay: i * 0.3,
                    progress: _controller.value,
                  ),
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
        color: _krishnaBlue.withOpacity(opacity),
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
                      color: _saffron.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                      border:
                          Border.all(color: _saffron.withOpacity(0.3)),
                    ),
                    child: Text(
                      s,
                      style: const TextStyle(
                          fontSize: 12, color: _saffron),
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
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: _cream,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(
                        color: _saffron.withOpacity(0.2)),
                  ),
                  child: TextField(
                    controller: controller,
                    maxLines: 4,
                    minLines: 1,
                    textInputAction: TextInputAction.send,
                    onSubmitted: isStreaming ? null : onSend,
                    decoration: const InputDecoration(
                      hintText: 'Ask GuruDev...',
                      hintStyle: TextStyle(color: _textMid),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(
                          horizontal: 16, vertical: 10),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              GestureDetector(
                onTap: isStreaming
                    ? null
                    : () => onSend(controller.text),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: isStreaming
                        ? _saffron.withOpacity(0.4)
                        : _saffron,
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
                          Icons.send_rounded,
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

// ─── Guru Avatar Small ────────────────────────────────────────────────────────
class _GuruAvatarSmall extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          colors: [_krishnaBlue, Color(0xFF0D3566)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.white, width: 1.5),
      ),
      child: const Center(
        child: Text('🕉️', style: TextStyle(fontSize: 14)),
      ),
    );
  }
}
