import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import '../../../../core/data/models/groups_model.dart';
import '../providers/groups_providers.dart';

const _peacock = Color(0xFF006B6B);
const _forest = Color(0xFF2D5A27);
const _saffron = Color(0xFFFF6B00);
const _cream = Color(0xFFFFF8EC);
const _textDark = Color(0xFF1C1209);
const _textMid = Color(0xFF7A6050);

class GroupsPage extends ConsumerStatefulWidget {
  const GroupsPage({super.key});

  @override
  ConsumerState<GroupsPage> createState() => _GroupsPageState();
}

class _GroupsPageState extends ConsumerState<GroupsPage> {
  bool _initialised = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _initJoinSet());
  }

  Future<void> _initJoinSet() async {
    if (_initialised) return;
    try {
      final joined = await ref.read(myGroupsProvider.future);
      final ids = joined.map((g) => g.id).toList();
      ref.read(groupJoinSetProvider.notifier).initialise(ids);
      _initialised = true;
    } catch (_) {}
  }

  Future<void> _refresh() async {
    _initialised = false;
    ref.invalidate(myGroupsProvider);
    ref.invalidate(allGroupsProvider);
    await Future.wait([
      ref.read(myGroupsProvider.future),
      ref.read(allGroupsProvider.future),
    ]);
    await _initJoinSet();
  }

  @override
  Widget build(BuildContext context) {
    final myGroupsAsync = ref.watch(myGroupsProvider);
    final allGroupsAsync = ref.watch(allGroupsProvider);
    final joinedIds = ref.watch(groupJoinSetProvider);

    return Scaffold(
      backgroundColor: _cream,
      body: RefreshIndicator(
        color: _saffron,
        onRefresh: _refresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            _buildHero(context),
            myGroupsAsync.when(
              loading: () =>
                  const SliverToBoxAdapter(child: SizedBox.shrink()),
              error: (_, __) =>
                  const SliverToBoxAdapter(child: SizedBox.shrink()),
              data: (myGroups) {
                if (myGroups.isEmpty) {
                  return const SliverToBoxAdapter(
                      child: SizedBox.shrink());
                }
                return SliverToBoxAdapter(
                  child: _MyGroupsSection(groups: myGroups),
                );
              },
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
                child: Text(
                  'All Communities',
                  style:
                      Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: _textDark,
                          ),
                ),
              ),
            ),
            allGroupsAsync.when(
              loading: () => SliverPadding(
                padding:
                    const EdgeInsets.fromLTRB(16, 0, 16, 32),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, __) => Shimmer.fromColors(
                      baseColor: Colors.grey[200]!,
                      highlightColor: Colors.grey[50]!,
                      child: Container(
                        height: 100,
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                    childCount: 5,
                  ),
                ),
              ),
              error: (_, __) => SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          color: Colors.red, size: 48),
                      const SizedBox(height: 12),
                      const Text('Failed to load communities',
                          style: TextStyle(color: Colors.red)),
                      TextButton(
                        onPressed: _refresh,
                        child: const Text('Retry',
                            style: TextStyle(color: _saffron)),
                      ),
                    ],
                  ),
                ),
              ),
              data: (groups) {
                if (groups.isEmpty) {
                  return const SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('🏛️',
                              style: TextStyle(fontSize: 48)),
                          SizedBox(height: 16),
                          Text('No communities yet',
                              style: TextStyle(
                                  color: _textMid, fontSize: 15)),
                        ],
                      ),
                    ),
                  );
                }
                return SliverPadding(
                  padding:
                      const EdgeInsets.fromLTRB(16, 0, 16, 32),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (_, i) => _GroupCard(
                        group: groups[i],
                        isJoined:
                            joinedIds.contains(groups[i].id),
                        onTap: () => context
                            .push('/groups/${groups[i].id}'),
                        onJoinToggle: () => ref
                            .read(groupJoinSetProvider.notifier)
                            .toggle(groups[i].id),
                      ),
                      childCount: groups.length,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  SliverAppBar _buildHero(BuildContext context) {
    return SliverAppBar(
      expandedHeight: 160,
      pinned: true,
      backgroundColor: _forest,
      leading: context.canPop()
          ? Padding(
              padding: const EdgeInsets.all(8),
              child: CircleAvatar(
                backgroundColor: Colors.black26,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back_rounded,
                      color: Colors.white, size: 20),
                  onPressed: () => context.pop(),
                ),
              ),
            )
          : null,
      flexibleSpace: FlexibleSpaceBar(
        background: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_forest, _peacock],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  const Text('🏛️',
                      style: TextStyle(fontSize: 32)),
                  const SizedBox(height: 8),
                  const Text(
                    'Communities',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Join spiritual communities & share wisdom',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.8),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── My Groups Section ────────────────────────────────────────────────────────
class _MyGroupsSection extends StatelessWidget {
  final List<GroupModel> groups;
  const _MyGroupsSection({required this.groups});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
          child: Text(
            'My Communities',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: _textDark,
                ),
          ),
        ),
        SizedBox(
          height: 100,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: groups.length,
            separatorBuilder: (_, __) =>
                const SizedBox(width: 12),
            itemBuilder: (_, i) => _MyGroupChip(
              group: groups[i],
              onTap: () =>
                  context.push('/groups/${groups[i].id}'),
            ),
          ),
        ),
      ],
    );
  }
}

class _MyGroupChip extends StatelessWidget {
  final GroupModel group;
  final VoidCallback onTap;
  const _MyGroupChip({required this.group, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 120,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border:
              Border.all(color: _peacock.withOpacity(0.3)),
          boxShadow: [
            BoxShadow(
              color: _peacock.withOpacity(0.1),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: _peacock.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Center(
                  child: Text('🏛️',
                      style: TextStyle(fontSize: 18))),
            ),
            const SizedBox(height: 8),
            Text(
              group.name,
              style: const TextStyle(
                color: _textDark,
                fontWeight: FontWeight.bold,
                fontSize: 11,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Group Card ───────────────────────────────────────────────────────────────
class _GroupCard extends StatelessWidget {
  final GroupModel group;
  final bool isJoined;
  final VoidCallback onTap;
  final VoidCallback onJoinToggle;

  const _GroupCard({
    required this.group,
    required this.isJoined,
    required this.onTap,
    required this.onJoinToggle,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: _peacock.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Center(
                  child:
                      Text('🏛️', style: TextStyle(fontSize: 24))),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    group.name,
                    style: const TextStyle(
                      color: _textDark,
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    group.description,
                    style: const TextStyle(
                        color: _textMid, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.group_rounded,
                          color: _textMid, size: 13),
                      const SizedBox(width: 3),
                      Text(
                        '${group.memberCount} members',
                        style: const TextStyle(
                            color: _textMid, fontSize: 11),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            GestureDetector(
              onTap: onJoinToggle,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isJoined ? Colors.white : _saffron,
                  borderRadius: BorderRadius.circular(20),
                  border: isJoined
                      ? Border.all(color: _saffron, width: 1.5)
                      : null,
                ),
                child: Text(
                  isJoined ? 'Joined' : 'Join',
                  style: TextStyle(
                    color: isJoined ? _saffron : Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
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
