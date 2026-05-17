import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_colors.dart';

const _saffron = Color(0xFFFF6B00);
const _maroon = Color(0xFF7B1C1C);
const _peacock = Color(0xFF006B6B);
const _textMuted = Color(0xFF7A6050);

// ─── State ────────────────────────────────────────────────────────────────────

class _SearchState {
  final List<dynamic> verses;
  final List<dynamic> mantras;
  final bool loading;
  final String? error;

  const _SearchState({
    this.verses = const [],
    this.mantras = const [],
    this.loading = false,
    this.error,
  });

  _SearchState copyWith({
    List<dynamic>? verses,
    List<dynamic>? mantras,
    bool? loading,
    String? error,
  }) =>
      _SearchState(
        verses: verses ?? this.verses,
        mantras: mantras ?? this.mantras,
        loading: loading ?? this.loading,
        error: error,
      );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage>
    with SingleTickerProviderStateMixin {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();
  late final TabController _tabController;
  late final Dio _dio;

  String _query = '';
  _SearchState _state = const _SearchState();
  List<String> _recentSearches = [];
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _dio = ApiClient.createDio();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    _tabController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onQueryChanged(String q) {
    final trimmed = q.trim();
    _debounce?.cancel();
    if (trimmed.isEmpty) {
      setState(() {
        _query = '';
        _state = const _SearchState();
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () => _search(trimmed));
  }

  Future<void> _search(String q) async {
    setState(() {
      _query = q;
      _state = _state.copyWith(loading: true, error: null);
    });

    try {
      final results = await Future.wait([
        _dio.get('/api/v1/verses',
            queryParameters: {'search': q, 'take': 20}),
        _dio.get('/api/v1/mantras',
            queryParameters: {'search': q, 'take': 20}),
      ]);

      final verses =
          (results[0].data['data'] as List?) ?? [];
      final mantras =
          (results[1].data['data'] as List?) ?? [];

      if (!mounted) return;
      setState(() {
        _state = _SearchState(verses: verses, mantras: mantras);
        if (!_recentSearches.contains(q)) {
          _recentSearches = [q, ..._recentSearches.take(9)];
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _state = _state.copyWith(
          loading: false,
          error: 'Search failed. Check your connection.',
        );
      });
    }
  }

  void _selectRecent(String q) {
    _controller.text = q;
    _search(q);
  }

  void _clearRecent() {
    setState(() => _recentSearches = []);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgLight,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        shadowColor: Colors.black12,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              color: _maroon, size: 20),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/home'),
        ),
        title: _SearchBar(
          controller: _controller,
          focusNode: _focusNode,
          onChanged: _onQueryChanged,
          onSubmitted: (q) {
            if (q.trim().isNotEmpty) _search(q.trim());
          },
        ),
        titleSpacing: 0,
      ),
      body: _query.isEmpty
          ? _RecentSearches(
              searches: _recentSearches,
              onSelect: _selectRecent,
              onClear: _clearRecent,
            )
          : _ResultsView(
              tabController: _tabController,
              state: _state,
              query: _query,
            ),
    );
  }
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

class _SearchBar extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;

  const _SearchBar({
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      focusNode: focusNode,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      textInputAction: TextInputAction.search,
      style: GoogleFonts.inter(fontSize: 15, color: const Color(0xFF1C1209)),
      decoration: InputDecoration(
        hintText: 'Search verses, mantras…',
        hintStyle:
            GoogleFonts.inter(fontSize: 15, color: _textMuted.withOpacity(0.7)),
        border: InputBorder.none,
        suffixIcon: ListenableBuilder(
          listenable: controller,
          builder: (context, _) => controller.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear_rounded,
                      size: 18, color: _textMuted),
                  onPressed: () {
                    controller.clear();
                    onChanged('');
                  },
                )
              : const SizedBox.shrink(),
        ),
      ),
    );
  }
}

// ─── Recent Searches ──────────────────────────────────────────────────────────

class _RecentSearches extends StatelessWidget {
  final List<String> searches;
  final ValueChanged<String> onSelect;
  final VoidCallback onClear;

  const _RecentSearches({
    required this.searches,
    required this.onSelect,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    if (searches.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_rounded, size: 56, color: _saffron.withOpacity(0.4)),
            const SizedBox(height: 14),
            Text(
              'Search for verses or mantras',
              style: GoogleFonts.inter(fontSize: 15, color: _textMuted),
            ),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 8, 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Recent Searches',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: _textMuted,
                  letterSpacing: 0.5,
                ),
              ),
              TextButton(
                onPressed: onClear,
                child: Text(
                  'Clear all',
                  style: GoogleFonts.inter(fontSize: 12, color: _peacock),
                ),
              ),
            ],
          ),
        ),
        ...searches.map(
          (q) => ListTile(
            leading: const Icon(Icons.history_rounded, color: _textMuted, size: 20),
            title: Text(q,
                style: GoogleFonts.inter(fontSize: 14, color: const Color(0xFF1C1209))),
            trailing: const Icon(Icons.north_west_rounded,
                size: 16, color: _textMuted),
            onTap: () => onSelect(q),
          ),
        ),
      ],
    );
  }
}

// ─── Results View ─────────────────────────────────────────────────────────────

class _ResultsView extends StatelessWidget {
  final TabController tabController;
  final _SearchState state;
  final String query;

  const _ResultsView({
    required this.tabController,
    required this.state,
    required this.query,
  });

  @override
  Widget build(BuildContext context) {
    if (state.loading) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation(_saffron),
        ),
      );
    }

    if (state.error != null) {
      return Center(
        child: Text(state.error!,
            style: GoogleFonts.inter(fontSize: 14, color: Colors.redAccent)),
      );
    }

    return Column(
      children: [
        // Tab bar
        Container(
          color: Colors.white,
          child: TabBar(
            controller: tabController,
            labelColor: _saffron,
            unselectedLabelColor: _textMuted,
            labelStyle:
                GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
            unselectedLabelStyle: GoogleFonts.inter(fontSize: 13),
            indicatorColor: _saffron,
            indicatorWeight: 2.5,
            tabs: [
              Tab(text: 'Verses (${state.verses.length})'),
              Tab(text: 'Mantras (${state.mantras.length})'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: tabController,
            children: [
              _VerseList(verses: state.verses, query: query),
              _MantraList(mantras: state.mantras, query: query),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── Verse List ───────────────────────────────────────────────────────────────

class _VerseList extends StatelessWidget {
  final List<dynamic> verses;
  final String query;

  const _VerseList({required this.verses, required this.query});

  @override
  Widget build(BuildContext context) {
    if (verses.isEmpty) {
      return _EmptyResult(label: 'No verses found for "$query"');
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: verses.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final v = verses[i] as Map<String, dynamic>;
        return _ResultCard(
          title: v['reference'] as String? ?? 'Verse',
          subtitle: v['meaning'] as String? ??
              v['originalText'] as String? ?? '',
          onTap: () => context.push('/verse/${v['id']}'),
        );
      },
    );
  }
}

// ─── Mantra List ──────────────────────────────────────────────────────────────

class _MantraList extends StatelessWidget {
  final List<dynamic> mantras;
  final String query;

  const _MantraList({required this.mantras, required this.query});

  @override
  Widget build(BuildContext context) {
    if (mantras.isEmpty) {
      return _EmptyResult(label: 'No mantras found for "$query"');
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: mantras.length,
      separatorBuilder: (_, __) => const SizedBox(height: 10),
      itemBuilder: (context, i) {
        final m = mantras[i] as Map<String, dynamic>;
        return _ResultCard(
          title: m['name'] as String? ?? 'Mantra',
          subtitle: m['meaning'] as String? ?? m['text'] as String? ?? '',
          onTap: () => context.push('/mantra/${m['id']}'),
        );
      },
    );
  }
}

// ─── Shared Widgets ───────────────────────────────────────────────────────────

class _ResultCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ResultCard({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      elevation: 0,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border:
                Border.all(color: const Color(0xFFE8D8C0).withOpacity(0.8)),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.playfairDisplay(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: _maroon,
                ),
              ),
              if (subtitle.isNotEmpty) ...[
                const SizedBox(height: 5),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                      fontSize: 13, color: _textMuted, height: 1.4),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyResult extends StatelessWidget {
  final String label;
  const _EmptyResult({required this.label});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.search_off_rounded,
              size: 48, color: _saffron.withOpacity(0.35)),
          const SizedBox(height: 12),
          Text(label,
              style: GoogleFonts.inter(fontSize: 14, color: _textMuted),
              textAlign: TextAlign.center),
        ],
      ),
    );
  }
}
