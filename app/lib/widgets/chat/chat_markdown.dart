import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:markdown/markdown.dart' as md;

import '../../core/constants/chat_config.dart';
import '../../core/format/streaming_markdown.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import 'chat_markdown_style.dart';
import 'shloka_card.dart';

/// An answer, drawn from markdown: headings, bold and italic, lists, tables,
/// fenced code, links, images, and block quotes as verse cards.
///
/// While the answer is still being written ([streaming]) the text goes through
/// [streamingSafeMarkdown] first, so a half-typed `**` or code fence does not
/// show as raw marks for a moment and then snap into place — and the text is
/// not selectable then, because a selection cannot survive the tree being
/// rebuilt every fifty milliseconds. It becomes selectable the moment the
/// answer is complete.
class ChatMarkdown extends StatelessWidget {
  const ChatMarkdown({super.key, required this.data, this.streaming = false});

  final String data;
  final bool streaming;

  static final MarkdownElementBuilder _shloka = _ShlokaBuilder();

  @override
  Widget build(BuildContext context) {
    final text = streaming ? streamingSafeMarkdown(data) : data;

    return MarkdownBody(
      // The markdown widget re-reads its text when it changes, not when it
      // becomes selectable; a new key makes the finished answer selectable even
      // when its words are exactly what was already on screen.
      key: ValueKey<bool>(streaming),
      data: text,
      selectable: !streaming,
      styleSheet: chatMarkdownStyle(context),
      extensionSet: md.ExtensionSet.gitHubFlavored,
      builders: {'blockquote': _shloka},
      imageBuilder: (uri, title, alt) => ChatMarkdownImage(uri: uri, alt: alt),
      onTapLink: (label, href, title) => _copyLink(context, href),
    );
  }

  /// There is no link launcher in the app, and adding a dependency to open a
  /// link is a decision for later — so a tapped link is copied, with a note,
  /// and can be pasted into a browser.
  Future<void> _copyLink(BuildContext context, String? href) async {
    if (href == null || href.isEmpty) return;
    final message = AppLocalizations.of(context).chatLinkCopied;
    await Clipboard.setData(ClipboardData(text: href));
    AppNavigator.instance.showMessage(message);
  }
}

/// A `>` quote as a verse card.
class _ShlokaBuilder extends MarkdownElementBuilder {
  @override
  bool isBlockElement() => true;

  @override
  Widget? visitElementAfterWithContext(
    BuildContext context,
    md.Element element,
    TextStyle? preferredStyle,
    TextStyle? parentStyle,
  ) {
    return ShlokaCard(text: _plain(element).trim());
  }

  /// The quote's words with its paragraph and line breaks kept.
  String _plain(md.Node node) {
    if (node is md.Text) return node.text;
    if (node is! md.Element) return '';
    if (node.tag == 'br') return '\n';

    final inner = (node.children ?? const <md.Node>[]).map(_plain).join();
    const blocks = {'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'};
    return blocks.contains(node.tag) ? '$inner\n\n' : inner;
  }
}

/// An image in an answer. Only `https` addresses are fetched; anything else, or
/// an image that fails to load, becomes a small framed note with its alt text.
class ChatMarkdownImage extends StatelessWidget {
  const ChatMarkdownImage({super.key, required this.uri, this.alt});

  final Uri uri;
  final String? alt;

  @override
  Widget build(BuildContext context) {
    if (uri.scheme != 'https') return _Unavailable(alt: alt);

    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: ChatConfig.imageMaxHeight),
      child: ClipRRect(
        borderRadius: AppRadius.smAll,
        child: CachedNetworkImage(
          imageUrl: uri.toString(),
          fit: BoxFit.contain,
          fadeInDuration: AppDurations.fast,
          placeholder: (context, _) => const SizedBox(height: AppSizes.avatarLg),
          errorWidget: (context, _, _) => _Unavailable(alt: alt),
        ),
      ),
    );
  }
}

class _Unavailable extends StatelessWidget {
  const _Unavailable({this.alt});

  final String? alt;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final label = (alt == null || alt!.isEmpty) ? text.chatImageUnavailable : alt!;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerHighest,
        borderRadius: AppRadius.smAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.broken_image_outlined, size: AppSizes.iconMd, color: context.colors.onSurfaceVariant),
          const SizedBox(width: AppSpacing.sm),
          Flexible(child: Text(label, style: context.texts.bodySmall)),
        ],
      ),
    );
  }
}
