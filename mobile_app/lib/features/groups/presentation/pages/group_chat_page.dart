import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../../core/data/models/groups_model.dart';
import '../../../../core/config/endpoints.dart';
import '../providers/groups_providers.dart';

const _saffron = Color(0xFFFF7E00);
const _krishnaBlue = Color(0xFF1A4D8F);
const _cream = Color(0xFFFFF8EC);
const _textDark = Color(0xFF1A1410);
const _textMid = Color(0xFF8B7D73);

class GroupChatPage extends ConsumerStatefulWidget {
  final String groupId;

  const GroupChatPage({super.key, required this.groupId});

  @override
  ConsumerState<GroupChatPage> createState() =>
      _GroupChatPageState();
}

class _GroupChatPageState extends ConsumerState<GroupChatPage> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();
  io.Socket? _socket;
  Timer? _pollTimer;
  String _currentUserId = '';

  @override
  void initState() {
    super.initState();
    _connectSocket();
    // Poll every 30 seconds as fallback for non-real-time environments.
    _pollTimer = Timer.periodic(
      const Duration(seconds: 30),
      (_) => ref
          .read(groupChatNotifierProvider(widget.groupId).notifier)
          .refresh(),
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _socket?.emit('leave', {'groupId': widget.groupId});
    _socket?.disconnect();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _connectSocket() {
    _socket = io.io(
      Endpoints.baseUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      ref
          .read(groupChatNotifierProvider(widget.groupId).notifier)
          .setConnected(true);
      _socket!.emit('join', {'groupId': widget.groupId});
    });

    _socket!.onDisconnect((_) {
      ref
          .read(groupChatNotifierProvider(widget.groupId).notifier)
          .setConnected(false);
    });

    _socket!.on('message', (data) {
      try {
        final msg = MessageModel.fromJson(
            (data is Map<String, dynamic>) ? data : {});
        ref
            .read(groupChatNotifierProvider(widget.groupId).notifier)
            .addSocketMessage(msg);
        _scrollToBottom();
      } catch (_) {}
    });

    _socket!.on('userJoined', (data) {});
    _socket!.on('userLeft', (data) {});
    _socket!.connect();
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

  void _sendMessage() {
    final content = _textController.text.trim();
    if (content.isEmpty) return;
    _textController.clear();
    ref
        .read(groupChatNotifierProvider(widget.groupId).notifier)
        .sendMessage(content);
    _scrollToBottom();
  }

  @override
  Widget build(BuildContext context) {
    final groupAsync =
        ref.watch(groupDetailProvider(widget.groupId));
    final chatState =
        ref.watch(groupChatNotifierProvider(widget.groupId));

    return Scaffold(
      backgroundColor: _cream,
      appBar: groupAsync.when(
        loading: () => AppBar(
          backgroundColor: Colors.white,
          elevation: 0.5,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded,
                color: _textDark),
            onPressed: () => context.pop(),
          ),
          title: const Text('Group Chat',
              style: TextStyle(
                  color: _textDark, fontWeight: FontWeight.bold)),
        ),
        error: (_, __) => AppBar(
          leading: BackButton(color: _textDark),
          title: const Text('Group Chat'),
        ),
        data: (group) => _GroupAppBar(
          group: group,
          isConnected: chatState.isConnected,
          onMembersTap: () => _showMembers(context, group),
          onInfoTap: () => _showGroupInfo(context, group),
        ),
      ) as PreferredSizeWidget,
      body: Column(
        children: [
          Expanded(
            child: chatState.messages.isEmpty
                ? const _EmptyGroupChat()
                : _MessageList(
                    messages: chatState.messages,
                    currentUserId: _currentUserId,
                    scrollController: _scrollController,
                    onReport: (msgId) =>
                        ref
                            .read(groupChatNotifierProvider(
                                    widget.groupId)
                                .notifier)
                            .reportMessage(msgId),
                  ),
          ),
          _GlassInputBar(
            controller: _textController,
            isSending: chatState.isSending,
            onSend: _sendMessage,
          ),
        ],
      ),
    );
  }

  void _showMembers(BuildContext context, GroupModel group) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius:
            BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _MembersSheet(
        group: group,
        groupId: widget.groupId,
      ),
    );
  }

  void _showGroupInfo(BuildContext context, GroupModel group) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16)),
        title: Text(group.name),
        content: Text(group.description),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close',
                style: TextStyle(color: _saffron)),
          ),
        ],
      ),
    );
  }
}

// ─── Group AppBar ─────────────────────────────────────────────────────────────
class _GroupAppBar extends StatelessWidget implements PreferredSizeWidget {
  final GroupModel group;
  final bool isConnected;
  final VoidCallback onMembersTap;
  final VoidCallback onInfoTap;

  const _GroupAppBar({
    required this.group,
    required this.isConnected,
    required this.onMembersTap,
    required this.onInfoTap,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 24);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: Colors.white,
      elevation: 0.5,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
        onPressed: () => context.pop(),
      ),
      title: GestureDetector(
        onTap: onInfoTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              group.name,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: _textDark,
                fontSize: 15,
              ),
            ),
            Row(
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isConnected ? Colors.green : Colors.grey,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  isConnected
                      ? '${group.memberCount} members'
                      : 'Connecting...',
                  style:
                      const TextStyle(fontSize: 11, color: _textMid),
                ),
              ],
            ),
          ],
        ),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.group_rounded, color: _textDark),
          onPressed: onMembersTap,
          tooltip: 'Members',
        ),
        IconButton(
          icon: const Icon(Icons.info_outline_rounded,
              color: _textDark),
          onPressed: onInfoTap,
          tooltip: 'Info',
        ),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(24),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
              horizontal: 16, vertical: 4),
          color: _krishnaBlue.withOpacity(0.06),
          child: Text(
            group.description,
            style: const TextStyle(
                fontSize: 11, color: _textMid, height: 1.3),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ),
    );
  }
}

// ─── Message List ─────────────────────────────────────────────────────────────
class _MessageList extends StatelessWidget {
  final List<MessageModel> messages;
  final String currentUserId;
  final ScrollController scrollController;
  final void Function(String) onReport;

  const _MessageList({
    required this.messages,
    required this.currentUserId,
    required this.scrollController,
    required this.onReport,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      itemCount: messages.length,
      itemBuilder: (_, i) {
        final msg = messages[i];
        final isMe = msg.userId == currentUserId;
        return _MessageTile(
          message: msg,
          isMe: isMe,
          onLongPress: () =>
              _showReportSheet(context, msg.id),
        );
      },
    );
  }

  void _showReportSheet(BuildContext context, String msgId) {
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
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text(
                'Message Options',
                style: TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.flag_outlined,
                  color: Colors.red),
              title: const Text('Report Message',
                  style: TextStyle(color: Colors.red)),
              onTap: () {
                Navigator.pop(context);
                onReport(msgId);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Message reported')),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.close_rounded,
                  color: _textMid),
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

// ─── Message Tile ─────────────────────────────────────────────────────────────
class _MessageTile extends StatelessWidget {
  final MessageModel message;
  final bool isMe;
  final VoidCallback onLongPress;

  const _MessageTile({
    required this.message,
    required this.isMe,
    required this.onLongPress,
  });

  bool get _isHidden => message.status == 'hidden';

  @override
  Widget build(BuildContext context) {
    if (_isHidden && !isMe) {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment:
            isMe ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMe) ...[
            _UserAvatar(userId: message.userId),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: GestureDetector(
              onLongPress: onLongPress,
              child: Column(
                crossAxisAlignment: isMe
                    ? CrossAxisAlignment.end
                    : CrossAxisAlignment.start,
                children: [
                  if (!isMe)
                    Padding(
                      padding: const EdgeInsets.only(
                          left: 4, bottom: 2),
                      child: Text(
                        message.userId.substring(0, 8),
                        style: const TextStyle(
                          fontSize: 11,
                          color: _textMid,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: _isHidden
                          ? Colors.grey[100]
                          : isMe
                              ? _saffron
                              : Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(16),
                        topRight: const Radius.circular(16),
                        bottomLeft:
                            Radius.circular(isMe ? 16 : 4),
                        bottomRight:
                            Radius.circular(isMe ? 4 : 16),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.05),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: _isHidden
                        ? const Text(
                            'This message is under review',
                            style: TextStyle(
                              color: _textMid,
                              fontStyle: FontStyle.italic,
                              fontSize: 13,
                            ),
                          )
                        : Text(
                            message.content,
                            style: TextStyle(
                              color: isMe ? Colors.white : _textDark,
                              fontSize: 14,
                              height: 1.4,
                            ),
                          ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatTime(message.createdAt),
                    style: const TextStyle(
                        fontSize: 10, color: _textMid),
                  ),
                ],
              ),
            ),
          ),
          if (isMe) const SizedBox(width: 8),
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

// ─── User Avatar ──────────────────────────────────────────────────────────────
class _UserAvatar extends StatelessWidget {
  final String userId;
  const _UserAvatar({required this.userId});

  @override
  Widget build(BuildContext context) {
    final colors = [
      _krishnaBlue,
      _saffron,
      Colors.teal,
      Colors.purple,
      Colors.green,
    ];
    final colorIndex = userId.codeUnits.fold(0, (a, b) => a + b) %
        colors.length;
    return CircleAvatar(
      radius: 16,
      backgroundColor: colors[colorIndex].withOpacity(0.15),
      child: Text(
        userId.isNotEmpty ? userId[0].toUpperCase() : '?',
        style: TextStyle(
          color: colors[colorIndex],
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
    );
  }
}

// ─── Glass Input Bar ──────────────────────────────────────────────────────────
class _GlassInputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool isSending;
  final VoidCallback onSend;

  const _GlassInputBar({
    required this.controller,
    required this.isSending,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.85),
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
                          color: Colors.grey.withOpacity(0.2)),
                    ),
                    child: TextField(
                      controller: controller,
                      maxLines: 4,
                      minLines: 1,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => onSend(),
                      decoration: const InputDecoration(
                        hintText: 'Message the group...',
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
                  onTap: isSending ? null : onSend,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: isSending
                          ? _saffron.withOpacity(0.4)
                          : _saffron,
                      shape: BoxShape.circle,
                    ),
                    child: isSending
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
      ),
    );
  }
}

// ─── Members Sheet ────────────────────────────────────────────────────────────
class _MembersSheet extends ConsumerWidget {
  final GroupModel group;
  final String groupId;

  const _MembersSheet({required this.group, required this.groupId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${group.memberCount} Members',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: _textDark,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Flexible(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.group_rounded,
                      size: 48, color: _textMid),
                  const SizedBox(height: 12),
                  Text(
                    '${group.memberCount} members in this group',
                    style: const TextStyle(color: _textMid),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

// ─── Empty Group Chat ─────────────────────────────────────────────────────────
class _EmptyGroupChat extends StatelessWidget {
  const _EmptyGroupChat();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text('🙏', style: TextStyle(fontSize: 48)),
          SizedBox(height: 16),
          Text(
            'No messages yet',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: _textDark,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Be the first to share wisdom\nwith this community!',
            textAlign: TextAlign.center,
            style: TextStyle(color: _textMid, height: 1.5),
          ),
        ],
      ),
    );
  }
}
