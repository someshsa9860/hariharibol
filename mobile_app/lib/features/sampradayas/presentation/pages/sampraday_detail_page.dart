import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/sampraday_detail_model.dart';
import '../providers/sampraday_provider.dart';

// ─── Palette ──────────────────────────────────────────────────────────────────
const _saffron = Color(0xFFFF7E00);
const _saffronDeep = Color(0xFFD96100);
const _krishnaBlue = Color(0xFF1A4D8F);
const _cream = Color(0xFFFFF8EC);
const _gold = Color(0xFFD4A04C);
const _textDark = Color(0xFF1A1410);
const _textMid = Color(0xFF8B7D73);

// ─── Page ─────────────────────────────────────────────────────────────────────
class SampradayDetailPage extends ConsumerStatefulWidget {
  final String sampradayId;

  const SampradayDetailPage({super.key, required this.sampradayId});

  @override
  ConsumerState<SampradayDetailPage> createState() =>
      _SampradayDetailPageState();
}

class _SampradayDetailPageState extends ConsumerState<SampradayDetailPage> {
  @override
  void initState() {
    super.initState();
    // Pre-populate follow state from cached detail once loaded
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(sampradayDetailProvider(widget.sampradayId).future).then((d) {
        ref
            .read(sampradayFollowProvider(widget.sampradayId).notifier)
            .initialise(d.isFollowing);
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(sampradayDetailProvider(widget.sampradayId));

    return Scaffold(
      backgroundColor: _cream,
      body: async.when(
        loading: _buildLoading,
        error: (err, _) => _buildError(),
        data: _buildContent,
      ),
    );
  }

  Widget _buildLoading() {
    return const Scaffold(
      backgroundColor: _cream,
      body: Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(_saffron),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Scaffold(
      backgroundColor: _cream,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
          onPressed: () => context.pop(),
        ),
      ),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 48),
            const SizedBox(height: 12),
            const Text('Failed to load sampraday',
                style: TextStyle(color: Colors.red, fontSize: 16)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () =>
                  ref.invalidate(sampradayDetailProvider(widget.sampradayId)),
              child: const Text('Retry',
                  style: TextStyle(color: _saffron)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(SampradayDetailModel sampraday) {
    final isFollowing =
        ref.watch(sampradayFollowProvider(widget.sampradayId));

    return Stack(
      children: [
        CustomScrollView(
          slivers: [
            _SampradayHeroAppBar(
              sampraday: sampraday,
              isFollowing: isFollowing,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 20),
                    // Name & description
                    _HeaderSection(sampraday: sampraday),
                    const SizedBox(height: 20),
                    // Founder & philosophy
                    _FounderPhilosophySection(sampraday: sampraday),
                    // Disciples
                    if (sampraday.disciples.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      _DisciplesSection(disciples: sampraday.disciples),
                    ],
                    // Mantras
                    if (sampraday.mantras.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      _MantrasSection(
                        mantras: sampraday.mantras,
                        onTap: (id) => context.push('/mantra/$id'),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
        // Sticky follow/unfollow button
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: _FollowButton(
            sampradayId: widget.sampradayId,
            isFollowing: isFollowing,
            followerCount: sampraday.followerCount,
          ),
        ),
      ],
    );
  }
}

// ─── Hero App Bar ─────────────────────────────────────────────────────────────
class _SampradayHeroAppBar extends StatelessWidget {
  final SampradayDetailModel sampraday;
  final bool isFollowing;

  const _SampradayHeroAppBar({
    required this.sampraday,
    required this.isFollowing,
  });

  @override
  Widget build(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 280,
      pinned: true,
      backgroundColor: _krishnaBlue,
      leading: Padding(
        padding: const EdgeInsets.all(8),
        child: CircleAvatar(
          backgroundColor: Colors.black38,
          child: IconButton(
            icon: const Icon(Icons.arrow_back_rounded, color: Colors.white, size: 20),
            onPressed: () => context.pop(),
          ),
        ),
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: CircleAvatar(
            backgroundColor: Colors.black38,
            child: IconButton(
              icon: const Icon(Icons.share_rounded, color: Colors.white, size: 20),
              onPressed: () {},
            ),
          ),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        collapseMode: CollapseMode.parallax,
        background: Stack(
          fit: StackFit.expand,
          children: [
            // Hero image
            if (sampraday.heroImageUrl != null)
              CachedNetworkImage(
                imageUrl: sampraday.heroImageUrl!,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [_krishnaBlue, _saffronDeep],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                ),
                errorWidget: (_, __, ___) => _heroGradient(),
              )
            else
              _heroGradient(),
            // Dark overlay for readability
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.15),
                    Colors.black.withOpacity(0.65),
                  ],
                ),
              ),
            ),
            // Title at bottom of hero
            Positioned(
              left: 16,
              right: 16,
              bottom: 20,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    sampraday.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      height: 1.2,
                    ),
                  ),
                  if (sampraday.primaryDeity != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Icon(Icons.auto_awesome_rounded,
                            color: _gold, size: 14),
                        const SizedBox(width: 4),
                        Text(
                          sampraday.primaryDeity!,
                          style: const TextStyle(
                              color: _gold,
                              fontSize: 13,
                              fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.group_rounded,
                          color: Colors.white70, size: 14),
                      const SizedBox(width: 4),
                      Text(
                        '${sampraday.followerCount} followers',
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 12),
                      ),
                      if (isFollowing) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.green.withOpacity(0.3),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: Colors.green.withOpacity(0.5)),
                          ),
                          child: const Text(
                            '✓ Following',
                            style: TextStyle(
                                color: Colors.greenAccent,
                                fontSize: 11,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _heroGradient() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [_krishnaBlue, _saffronDeep],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
    );
  }
}

// ─── Header Section ───────────────────────────────────────────────────────────
class _HeaderSection extends StatelessWidget {
  final SampradayDetailModel sampraday;
  const _HeaderSection({required this.sampraday});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (sampraday.description != null)
          Text(
            sampraday.description!,
            style: const TextStyle(
              color: _textDark,
              fontSize: 15,
              height: 1.7,
            ),
          ),
        if (sampraday.foundingRegion != null) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.location_on_rounded, color: _saffron, size: 16),
              const SizedBox(width: 4),
              Text(
                'Origin: ${sampraday.foundingRegion!}',
                style: const TextStyle(
                  color: _textMid,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

// ─── Founder & Philosophy ─────────────────────────────────────────────────────
class _FounderPhilosophySection extends StatelessWidget {
  final SampradayDetailModel sampraday;
  const _FounderPhilosophySection({required this.sampraday});

  @override
  Widget build(BuildContext context) {
    final hasFounder = sampraday.founder != null;
    final hasPhilosophy = sampraday.philosophy != null;

    if (!hasFounder && !hasPhilosophy) return const SizedBox.shrink();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          if (hasFounder)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  // Founder avatar
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _saffron.withOpacity(0.1),
                      border: Border.all(
                          color: _gold.withOpacity(0.5), width: 2),
                    ),
                    child: sampraday.founderImageUrl != null
                        ? ClipOval(
                            child: CachedNetworkImage(
                              imageUrl: sampraday.founderImageUrl!,
                              fit: BoxFit.cover,
                            ),
                          )
                        : const Center(
                            child: Text('🧘', style: TextStyle(fontSize: 26))),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'FOUNDER',
                        style: TextStyle(
                          color: _textMid,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        sampraday.founder!,
                        style: const TextStyle(
                          color: _textDark,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          if (hasFounder && hasPhilosophy)
            Divider(
                height: 1,
                color: Colors.grey[100],
                indent: 16,
                endIndent: 16),
          if (hasPhilosophy)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.lightbulb_outline_rounded,
                          color: _gold, size: 16),
                      SizedBox(width: 6),
                      Text(
                        'PHILOSOPHY',
                        style: TextStyle(
                          color: _textMid,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    sampraday.philosophy!,
                    style: const TextStyle(
                      color: _textDark,
                      fontSize: 14,
                      height: 1.65,
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

// ─── Disciples ────────────────────────────────────────────────────────────────
class _DisciplesSection extends StatelessWidget {
  final List<DiscipleModel> disciples;
  const _DisciplesSection({required this.disciples});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Key Disciples',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: _textDark,
              ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 110,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: disciples.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (_, i) => _DiscipleCard(disciple: disciples[i]),
          ),
        ),
      ],
    );
  }
}

class _DiscipleCard extends StatelessWidget {
  final DiscipleModel disciple;
  const _DiscipleCard({required this.disciple});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 90,
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
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _krishnaBlue.withOpacity(0.08),
              border:
                  Border.all(color: _krishnaBlue.withOpacity(0.2), width: 2),
            ),
            child: disciple.imageUrl != null
                ? ClipOval(
                    child: CachedNetworkImage(
                      imageUrl: disciple.imageUrl!,
                      fit: BoxFit.cover,
                    ),
                  )
                : const Center(
                    child: Text('🧘', style: TextStyle(fontSize: 24))),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Text(
              disciple.name,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: _textDark,
                fontSize: 11,
                fontWeight: FontWeight.w500,
                height: 1.3,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Mantras ─────────────────────────────────────────────────────────────────
class _MantrasSection extends StatelessWidget {
  final List<SampradayMantraModel> mantras;
  final void Function(String id) onTap;

  const _MantrasSection({required this.mantras, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Sacred Mantras',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: _textDark,
              ),
        ),
        const SizedBox(height: 12),
        ...mantras.map((m) => _MantraListTile(mantra: m, onTap: onTap)),
      ],
    );
  }
}

class _MantraListTile extends StatelessWidget {
  final SampradayMantraModel mantra;
  final void Function(String) onTap;

  const _MantraListTile({required this.mantra, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => onTap(mantra.id),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _saffron.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Text('📿', style: TextStyle(fontSize: 20)),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    mantra.name,
                    style: const TextStyle(
                      color: _textDark,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  if (mantra.sanskrit != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      mantra.sanskrit!,
                      style: const TextStyle(
                        fontFamily: 'NotoSansDevanagari',
                        color: _textMid,
                        fontSize: 12,
                        height: 1.4,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (mantra.meaning != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      mantra.meaning!,
                      style: const TextStyle(
                        color: _textMid,
                        fontSize: 12,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: _textMid),
          ],
        ),
      ),
    );
  }
}

// ─── Follow Button ────────────────────────────────────────────────────────────
class _FollowButton extends ConsumerWidget {
  final String sampradayId;
  final bool isFollowing;
  final int followerCount;

  const _FollowButton({
    required this.sampradayId,
    required this.isFollowing,
    required this.followerCount,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: EdgeInsets.fromLTRB(
          16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 16,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: () => ref
                  .read(sampradayFollowProvider(sampradayId).notifier)
                  .toggle(),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                height: 52,
                decoration: BoxDecoration(
                  color: isFollowing ? Colors.white : _saffron,
                  borderRadius: BorderRadius.circular(14),
                  border: isFollowing
                      ? Border.all(color: _saffron, width: 2)
                      : null,
                  boxShadow: isFollowing
                      ? null
                      : [
                          BoxShadow(
                            color: _saffron.withOpacity(0.4),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                ),
                child: Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isFollowing
                            ? Icons.bookmark_rounded
                            : Icons.bookmark_border_rounded,
                        color: isFollowing ? _saffron : Colors.white,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isFollowing ? 'Following' : 'Follow Tradition',
                        style: TextStyle(
                          color: isFollowing ? _saffron : Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Container(
            height: 52,
            width: 52,
            decoration: BoxDecoration(
              color: _krishnaBlue.withOpacity(0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _krishnaBlue.withOpacity(0.2)),
            ),
            child: const Icon(Icons.share_rounded, color: _krishnaBlue),
          ),
        ],
      ),
    );
  }
}
