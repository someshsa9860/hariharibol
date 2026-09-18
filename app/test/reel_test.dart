import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/models/reel.dart';
import 'package:hariharibol/models/reel_comment.dart';

/// The reel model's job is to survive a response that is missing things, and
/// to give the player an answer before any media has loaded. Both are easy to
/// break and neither shows up until a feed is actually scrolling.
void main() {
  group('Reel.fromJson', () {
    test('reads a video reel whole', () {
      final reel = Reel.fromJson({
        'id': 'r1',
        'mediaType': 'VIDEO',
        'videoUrl': 'https://example.invalid/r1.mp4',
        'thumbnailUrl': 'https://example.invalid/r1.jpg',
        'durationMs': 8000,
        'width': 1080,
        'height': 1920,
        'caption': 'Hare Krishna',
        'tags': ['japa', 'mahamantra'],
        'likeCount': 12,
        'commentCount': 3,
        'isLiked': true,
        'isFollowingCreator': true,
        'creator': {'id': 'c1', 'displayName': 'Gopal Das', 'isVerified': true},
      });

      expect(reel.isVideo, isTrue);
      expect(reel.hasPlayableVideo, isTrue);
      expect(reel.duration, const Duration(seconds: 8));
      expect(reel.aspectRatio, closeTo(0.5625, 0.0001));
      expect(reel.tags, ['japa', 'mahamantra']);
      expect(reel.isLiked, isTrue);
      expect(reel.isFollowingCreator, isTrue);
      expect(reel.creator.displayName, 'Gopal Das');
    });

    test('treats a video with no file as not playable', () {
      final reel = Reel.fromJson({
        'id': 'r2',
        'mediaType': 'VIDEO',
        'creator': {'id': 'c1', 'displayName': 'Gopal Das'},
      });

      // The player shows the poster instead of a spinner that never resolves.
      expect(reel.isVideo, isTrue);
      expect(reel.hasPlayableVideo, isFalse);
    });

    test('reads a recitation as AUDIO, not the video fallback', () {
      final reel = Reel.fromJson({
        'id': 'r2b',
        'mediaType': 'AUDIO',
        'audioUrl': 'https://example.invalid/verse-2-65.mp3',
        'thumbnailUrl': 'https://example.invalid/cover.png',
        'creator': {'id': 'c1', 'displayName': 'HariHariBol'},
      });

      // Before AUDIO was a recognised type this fell through to `video`,
      // which has no player for a null videoUrl — a silent, blank reel.
      expect(reel.isAudio, isTrue);
      expect(reel.isVideo, isFalse);
      expect(reel.hasPlayableAudio, isTrue);
      expect(reel.hasPlayableVideo, isFalse);
    });

    test('treats a recitation with no track yet as not playable', () {
      final reel = Reel.fromJson({
        'id': 'r2c',
        'mediaType': 'AUDIO',
        'creator': {'id': 'c1', 'displayName': 'HariHariBol'},
      });

      expect(reel.isAudio, isTrue);
      expect(reel.hasPlayableAudio, isFalse);
    });

    test('falls back to portrait when the media carries no size', () {
      final reel = Reel.fromJson({
        'id': 'r3',
        'mediaType': 'IMAGE',
        'creator': {'id': 'c1', 'displayName': 'Gopal Das'},
      });

      // Has to have an answer before anything has loaded, or the first frame
      // of every reel is laid out at the wrong ratio and then jumps.
      expect(reel.aspectRatio, closeTo(9 / 16, 0.0001));
    });

    test('puts a slideshow into display order whatever order it arrives in', () {
      final reel = Reel.fromJson({
        'id': 'r4',
        'mediaType': 'IMAGE',
        'creator': {'id': 'c1', 'displayName': 'Radhika Devi'},
        'media': [
          {'id': 'm3', 'imageUrl': 'c.jpg', 'displayOrder': 2},
          {'id': 'm1', 'imageUrl': 'a.jpg', 'displayOrder': 0},
          {'id': 'm2', 'imageUrl': 'b.jpg', 'displayOrder': 1},
        ],
      });

      expect(reel.media.map((m) => m.id), ['m1', 'm2', 'm3']);
    });

    test('survives a response with almost nothing in it', () {
      final reel = Reel.fromJson({'id': 'r5'});

      expect(reel.id, 'r5');
      expect(reel.mediaType, ReelMediaType.video);
      expect(reel.creator.displayName, isEmpty);
      expect(reel.likeCount, 0);
      expect(reel.media, isEmpty);
      expect(reel.verse, isNull);
    });

    test('names the share label after the creator when there is no caption', () {
      final reel = Reel.fromJson({
        'id': 'r6',
        'creator': {'id': 'c1', 'displayName': 'Jagannath Seva'},
      });
      expect(reel.shareLabel, 'Jagannath Seva');
    });
  });

  group('Reel.copyWith', () {
    test('moves only what the optimistic tap changed', () {
      final reel = Reel.fromJson({
        'id': 'r7',
        'mediaType': 'VIDEO',
        'likeCount': 4,
        'commentCount': 9,
        'caption': 'Jai Sri Krishna',
        'creator': {'id': 'c1', 'displayName': 'Gopal Das'},
      });

      final liked = reel.copyWith(isLiked: true, likeCount: 5);

      expect(liked.isLiked, isTrue);
      expect(liked.likeCount, 5);
      // Everything else has to come through untouched, or an optimistic like
      // quietly blanks the caption.
      expect(liked.commentCount, 9);
      expect(liked.caption, 'Jai Sri Krishna');
      expect(liked.creator.displayName, 'Gopal Das');
      expect(liked.id, reel.id);
    });
  });

  group('ReelVerseRef', () {
    test('keeps the numbers apart so the label can go through l10n', () {
      final reel = Reel.fromJson({
        'id': 'r8',
        'creator': {'id': 'c1', 'displayName': 'Gopal Das'},
        'verse': {
          'id': 'v1',
          'verseId': '1.2.47',
          'bookNumber': 1,
          'chapterNumber': 2,
          'verseNumber': 47,
        },
      });

      expect(reel.verse, isNotNull);
      expect(reel.verse!.bookNumber, 1);
      expect(reel.verse!.chapterNumber, 2);
      expect(reel.verse!.verseNumber, 47);
      expect(reel.verse!.verseId, '1.2.47');
    });
  });

  group('ReelComment', () {
    test('reads a top-level comment', () {
      final comment = ReelComment.fromJson({
        'id': 'c1',
        'reelId': 'r1',
        'text': 'Hari bol',
        'likeCount': 2,
        'replyCount': 1,
        'isMine': true,
        'author': {'id': 'u1', 'name': 'Someone'},
      });

      expect(comment.isReply, isFalse);
      expect(comment.hasReplies, isTrue);
      expect(comment.isMine, isTrue);
      expect(comment.author?.name, 'Someone');
    });

    test('keeps a hidden comment as a row with no text', () {
      final comment = ReelComment.fromJson({
        'id': 'c2',
        'reelId': 'r1',
        'text': null,
        'isHidden': true,
      });

      // Kept rather than dropped, so replies under it still make sense.
      expect(comment.isHidden, isTrue);
      expect(comment.text, isNull);
    });

    test('knows a reply from its parent', () {
      final reply = ReelComment.fromJson({
        'id': 'c3',
        'reelId': 'r1',
        'parentId': 'c1',
        'text': 'Jai',
      });

      expect(reply.isReply, isTrue);
      expect(reply.parentId, 'c1');
    });
  });

  group('wire enums', () {
    test('send the values the API validates against', () {
      // These strings are checked by zod on the way in — a rename here is a
      // 400 at runtime, so they are asserted rather than trusted.
      expect(SharePlatform.copyLink.wire, 'COPY_LINK');
      expect(SharePlatform.whatsapp.wire, 'WHATSAPP');
      expect(ReportReason.nonDevotional.wire, 'NON_DEVOTIONAL');
      expect(ReportReason.sexualOrViolent.wire, 'SEXUAL_OR_VIOLENT');
    });
  });
}
