import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';

// ─── Models ──────────────────────────────────────────────────────────────────

class _Book {
  final String id;
  final String title;
  final String? coverUrl;
  final String? description;
  final bool isFeatured;
  final String? category; // 'SB', 'BG', 'DNYAN', 'other'
  final int chapterCount;
  final String? translatorName;

  _Book({
    required this.id,
    required this.title,
    this.coverUrl,
    this.description,
    this.isFeatured = false,
    this.category,
    this.chapterCount = 0,
    this.translatorName,
  });

  factory _Book.fromJson(Map<String, dynamic> j) => _Book(
        id: j['id'] as String,
        title: (j['titleKey'] ?? j['title'] ?? 'Unknown').toString(),
        coverUrl: j['coverUrl'] as String?,
        description: (j['descriptionKey'] ?? j['description'] ?? '').toString(),
        isFeatured: j['isFeatured'] as bool? ?? false,
        category: _detectCategory(j),
        chapterCount: j['totalChapters'] as int? ??
            (j['_count']?['chapters'] as int? ?? 0),
        translatorName: _parseTranslator(j),
      );

  static String? _detectCategory(Map<String, dynamic> j) {
    final slug = (j['slug'] ?? '').toString().toLowerCase();
    final title = (j['titleKey'] ?? j['title'] ?? '').toString().toLowerCase();
    if (slug.contains('bhagavat') || title.contains('bhagavat') || title.contains('srimad')) return 'SB';
    if (slug.contains('gita') || title.contains('gita')) return 'BG';
    if (slug.contains('dnyaneshwar') || slug.contains('jnaneshwar') || title.contains('dnyaneshwari')) return 'DNYAN';
    return 'other';
  }

  static String? _parseTranslator(Map<String, dynamic> j) {
    final list = j['translators'] as List?;
    if (list != null && list.isNotEmpty) {
      final t = list.first as Map<String, dynamic>;
      final name = (t['nameKey'] ?? t['name'] ?? '').toString();
      return name.isNotEmpty ? name : null;
    }
    return null;
  }
}

class _Translator {
  final String id;
  final String name;
  final String? sampradaySlug;

  _Translator({required this.id, required this.name, this.sampradaySlug});

  factory _Translator.fromJson(Map<String, dynamic> j) => _Translator(
        id: j['id'] as String,
        name: (j['nameKey'] ?? j['name'] ?? '').toString(),
        sampradaySlug: j['sampradaySlug'] as String?,
      );
}

// ─── Providers ────────────────────────────────────────────────────────────────

final _dioProvider = Provider((ref) => Dio(BaseOptions(baseUrl: 'https://api.hariharibol.com')));

final _booksProvider = FutureProvider<List<_Book>>((ref) async {
  final dio = ref.watch(_dioProvider);
  final res = await dio.get('/api/v1/books?take=100');
  final data = res.data;
  final list = (data is Map ? data['data'] : data) as List? ?? [];
  return list.map((e) => _Book.fromJson(e as Map<String, dynamic>)).toList();
});

final _translatorsProvider = FutureProvider<List<_Translator>>((ref) async {
  final dio = ref.watch(_dioProvider);
  try {
    final res = await dio.get('/api/v1/translators?take=100');
    final data = res.data;
    final list = (data is Map ? data['data'] : data) as List? ?? [];
    return list.map((e) => _Translator.fromJson(e as Map<String, dynamic>)).toList();
  } catch (_) {
    return _defaultTranslators;
  }
});

// Known approved translators (shown even if API not seeded yet)
final _defaultTranslators = [
  _Translator(id: 'prabhupada', name: 'A.C. Bhaktivedanta Swami Prabhupada', sampradaySlug: 'gaudiya-vaishnava'),
  _Translator(id: 'vishvanath', name: 'Vishvanath Chakravarti Thakur', sampradaySlug: 'gaudiya-vaishnava'),
  _Translator(id: 'jiva-goswami', name: 'Jiva Goswami', sampradaySlug: 'gaudiya-vaishnava'),
  _Translator(id: 'ramanuja', name: 'Ramanujacharya', sampradaySlug: 'sri-vaishnava'),
  _Translator(id: 'madhva', name: 'Madhvacharya', sampradaySlug: 'madhva'),
  _Translator(id: 'dnyaneshwar', name: 'Sant Dnyaneshwar', sampradaySlug: 'warkari'),
  _Translator(id: 'tukaram', name: 'Sant Tukaram', sampradaySlug: 'warkari'),
  _Translator(id: 'eknath', name: 'Sant Eknath', sampradaySlug: 'warkari'),
  _Translator(id: 'vallabha', name: 'Vallabhacharya', sampradaySlug: 'pushti-marg'),
  _Translator(id: 'nimbarka', name: 'Nimbarkacharya', sampradaySlug: 'nimbarka'),
];

// ─── Filter state ─────────────────────────────────────────────────────────────

class _FilterState {
  final String? languageCode;
  final String? translatorId;
  final String? category; // null = all, 'SB', 'BG', 'DNYAN', 'other'
  final String search;

  const _FilterState({
    this.languageCode,
    this.translatorId,
    this.category,
    this.search = '',
  });

  _FilterState copyWith({
    Object? languageCode = _sentinel,
    Object? translatorId = _sentinel,
    Object? category = _sentinel,
    String? search,
  }) =>
      _FilterState(
        languageCode: languageCode == _sentinel ? this.languageCode : languageCode as String?,
        translatorId: translatorId == _sentinel ? this.translatorId : translatorId as String?,
        category: category == _sentinel ? this.category : category as String?,
        search: search ?? this.search,
      );

  static const _sentinel = Object();
}

final _filterProvider = StateProvider((ref) => const _FilterState());

// ─── Page ─────────────────────────────────────────────────────────────────────

class ReadingPage extends ConsumerStatefulWidget {
  const ReadingPage({super.key});

  @override
  ConsumerState<ReadingPage> createState() => _ReadingPageState();
}

class _ReadingPageState extends ConsumerState<ReadingPage> with SingleTickerProviderStateMixin {
  static const _saffron = Color(0xFFC75A1A);
  static const _cream = Color(0xFFFFF8EC);
  static const _dark = Color(0xFF1A1410);

  late TabController _tabController;
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filter = ref.watch(_filterProvider);

    return Scaffold(
      backgroundColor: _cream,
      body: NestedScrollView(
        headerSliverBuilder: (ctx, inner) => [
          SliverAppBar(
            backgroundColor: Colors.white,
            elevation: 0,
            pinned: true,
            expandedHeight: 0,
            title: const Row(
              children: [
                Text('📖', style: TextStyle(fontSize: 22)),
                SizedBox(width: 8),
                Text('Read', style: TextStyle(fontWeight: FontWeight.bold, color: _dark, fontSize: 20)),
              ],
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.filter_list, color: _saffron),
                onPressed: () => _showFilterSheet(context, filter),
              ),
            ],
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(96),
              child: Column(
                children: [
                  // Search bar
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                    child: TextField(
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: 'Search books, verses…',
                        hintStyle: const TextStyle(color: Color(0xFF8B7D73), fontSize: 14),
                        prefixIcon: const Icon(Icons.search, color: _saffron, size: 20),
                        suffixIcon: filter.search.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                  ref.read(_filterProvider.notifier).state =
                                      filter.copyWith(search: '');
                                },
                              )
                            : null,
                        filled: true,
                        fillColor: const Color(0xFFF5EDE4),
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                      ),
                      onChanged: (v) => ref.read(_filterProvider.notifier).state =
                          filter.copyWith(search: v),
                    ),
                  ),
                  // Category tabs
                  TabBar(
                    controller: _tabController,
                    labelColor: _saffron,
                    unselectedLabelColor: const Color(0xFF8B7D73),
                    indicatorColor: _saffron,
                    indicatorWeight: 2.5,
                    labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    unselectedLabelStyle: const TextStyle(fontSize: 13),
                    tabs: const [
                      Tab(text: 'All'),
                      Tab(text: 'SB'),
                      Tab(text: 'BG'),
                      Tab(text: 'Dnyaneshwari'),
                    ],
                    onTap: (i) {
                      final cats = [null, 'SB', 'BG', 'DNYAN'];
                      ref.read(_filterProvider.notifier).state =
                          filter.copyWith(category: cats[i]);
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _BooksGrid(category: null),
            _BooksGrid(category: 'SB'),
            _BooksGrid(category: 'BG'),
            _DnyaneshwariSection(),
          ],
        ),
      ),
    );
  }

  void _showFilterSheet(BuildContext context, _FilterState filter) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _FilterSheet(filter: filter),
    );
  }
}

// ─── Books grid ───────────────────────────────────────────────────────────────

class _BooksGrid extends ConsumerWidget {
  final String? category;
  const _BooksGrid({this.category});

  static const _saffron = Color(0xFFC75A1A);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(_booksProvider);
    final filter = ref.watch(_filterProvider);

    return booksAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: _saffron)),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Could not load books', style: TextStyle(color: Colors.black54)),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => ref.invalidate(_booksProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (books) {
        var filtered = books.where((b) {
          final matchCat = category == null || b.category == category;
          final matchSearch = filter.search.isEmpty ||
              b.title.toLowerCase().contains(filter.search.toLowerCase());
          return matchCat && matchSearch;
        }).toList();

        if (filtered.isEmpty) {
          return const Center(child: Text('No books found', style: TextStyle(color: Color(0xFF8B7D73))));
        }

        // Featured books first for SB/BG
        final featured = filtered.where((b) => b.isFeatured || b.category == category).toList();
        final rest = filtered.where((b) => !featured.contains(b)).toList();
        final ordered = [...featured, ...rest];

        return RefreshIndicator(
          color: _saffron,
          onRefresh: () async => ref.invalidate(_booksProvider),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              if (featured.isNotEmpty && category != null)
                SliverToBoxAdapter(child: _FeaturedBanner(book: featured.first)),
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverLayoutBuilder(
                  builder: (ctx, constraints) {
                    final cols = constraints.crossAxisExtent > 600 ? 3 : 2;
                    return SliverGrid(
                      delegate: SliverChildBuilderDelegate(
                        (ctx, i) => _BookCard(book: ordered[i]),
                        childCount: ordered.length,
                      ),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: cols,
                        mainAxisSpacing: 14,
                        crossAxisSpacing: 14,
                        childAspectRatio: 0.68,
                      ),
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

// ─── Featured banner ──────────────────────────────────────────────────────────

class _FeaturedBanner extends StatelessWidget {
  final _Book book;
  const _FeaturedBanner({required this.book});

  static const _saffron = Color(0xFFC75A1A);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/book/${book.id}'),
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        height: 160,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: const LinearGradient(
            colors: [Color(0xFF3D1A00), Color(0xFF8B3A00)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Row(
          children: [
            if (book.coverUrl != null)
              ClipRRect(
                borderRadius: const BorderRadius.horizontal(left: Radius.circular(16)),
                child: CachedNetworkImage(
                  imageUrl: book.coverUrl!,
                  width: 110,
                  height: 160,
                  fit: BoxFit.cover,
                  errorWidget: (_, __, ___) => _coverPlaceholder(110),
                ),
              )
            else
              _coverPlaceholder(110),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: _saffron,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text('FEATURED', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      book.title,
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    if (book.description != null && book.description!.isNotEmpty)
                      Text(
                        book.description!,
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    const Spacer(),
                    const Row(
                      children: [
                        Text('Read now', style: TextStyle(color: Color(0xFFD4A017), fontSize: 13, fontWeight: FontWeight.bold)),
                        SizedBox(width: 4),
                        Icon(Icons.arrow_forward, color: Color(0xFFD4A017), size: 14),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _coverPlaceholder(double w) => Container(
        width: w,
        color: const Color(0xFF5A2D00),
        child: const Center(child: Text('📜', style: TextStyle(fontSize: 40))),
      );
}

// ─── Book card ────────────────────────────────────────────────────────────────

class _BookCard extends StatelessWidget {
  final _Book book;
  const _BookCard({required this.book});

  static const _saffron = Color(0xFFC75A1A);
  static const _gold = Color(0xFFD4A055);
  static const _dark = Color(0xFF1A1410);
  static const _mid = Color(0xFF8B7D73);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/book/${book.id}'),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: const [BoxShadow(color: Color(0x0F000000), blurRadius: 8, offset: Offset(0, 3))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              flex: 3,
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
                child: book.coverUrl != null
                    ? CachedNetworkImage(
                        imageUrl: book.coverUrl!,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => _placeholder(),
                      )
                    : _placeholder(),
              ),
            ),
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (book.category != null && book.category != 'other') ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: _saffron.withAlpha(25),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              book.category!,
                              style: const TextStyle(color: _saffron, fontSize: 9, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 4),
                        ],
                        if (book.chapterCount > 0)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: _gold.withAlpha(30),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: _gold.withAlpha(80)),
                            ),
                            child: Text(
                              '${book.chapterCount} ch',
                              style: const TextStyle(color: _gold, fontSize: 9, fontWeight: FontWeight.bold),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      book.title,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: _dark),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (book.translatorName != null && book.translatorName!.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        book.translatorName!,
                        style: const TextStyle(color: _mid, fontSize: 10),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _placeholder() => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF7B1C1C), Color(0xFFC75A1A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: const Center(child: Text('📜', style: TextStyle(fontSize: 36))),
      );
}

// ─── Dnyaneshwari section ─────────────────────────────────────────────────────

class _DnyaneshwariSection extends ConsumerWidget {
  static const _saffron = Color(0xFFC75A1A);
  static const _gold = Color(0xFFD4A017);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booksAsync = ref.watch(_booksProvider);

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Container(
            margin: const EdgeInsets.all(16),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF1A0A00), Color(0xFF4A1800)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('🪔', style: TextStyle(fontSize: 32)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Dnyaneshwari',
                            style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            'Sant Dnyaneshwar\'s Marathi commentary on the Bhagavad Gita',
                            style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const Text(
                  'Written in the 13th century by Sant Dnyaneshwar at age 16, the Dnyaneshwari (Bhavartha Deepika) illuminates the Bhagavad Gita in the Marathi language — making the Gita accessible to common people for the first time.',
                  style: TextStyle(color: Colors.white60, fontSize: 13, height: 1.6),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _infoPill('18 Chapters'),
                    const SizedBox(width: 8),
                    _infoPill('9,032 Ovis'),
                    const SizedBox(width: 8),
                    _infoPill('Warkari Tradition'),
                  ],
                ),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: Row(
              children: const [
                Text('Chapters', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1A1410))),
              ],
            ),
          ),
        ),
        // 18 chapters of Dnyaneshwari
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (ctx, i) => _DnyanChapterTile(
                chapter: i + 1,
                bookId: booksAsync.whenOrNull(
                  data: (books) {
                    final dnyan =
                        books.where((b) => b.category == 'DNYAN').toList();
                    return dnyan.isNotEmpty ? dnyan.first.id : null;
                  },
                ),
              ),
              childCount: 18,
            ),
          ),
        ),
        // Other Dnyaneshwar books from DB
        booksAsync.when(
          loading: () => const SliverToBoxAdapter(child: SizedBox()),
          error: (_, __) => const SliverToBoxAdapter(child: SizedBox()),
          data: (books) {
            final dnyan = books.where((b) => b.category == 'DNYAN').toList();
            if (dnyan.isEmpty) return const SliverToBoxAdapter(child: SizedBox());
            return SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 20, 16, 12),
                    child: Text('Related Texts', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1A1410))),
                  ),
                  SizedBox(
                    height: 160,
                    child: ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      scrollDirection: Axis.horizontal,
                      itemCount: dnyan.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 12),
                      itemBuilder: (ctx, i) => _SmallBookCard(book: dnyan[i]),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _infoPill(String text) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(25),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white24),
        ),
        child: Text(text, style: const TextStyle(color: Colors.white70, fontSize: 11)),
      );
}

class _DnyanChapterTile extends StatelessWidget {
  final int chapter;
  final String? bookId;
  const _DnyanChapterTile({required this.chapter, this.bookId});

  static const _saffron = Color(0xFFC75A1A);

  static const _chapterNames = [
    'Arjuna Vishada Yoga', 'Sankhya Yoga', 'Karma Yoga', 'Jnana Karma Sannyasa Yoga',
    'Karma Sannyasa Yoga', 'Dhyana Yoga', 'Jnana Vijnana Yoga', 'Aksara Brahma Yoga',
    'Raja Vidya Raja Guhya Yoga', 'Vibhuti Yoga', 'Vishvarupa Darshana Yoga',
    'Bhakti Yoga', 'Kshetra Kshetrajna Vibhaga Yoga', 'Gunatraya Vibhaga Yoga',
    'Purushottama Yoga', 'Daivasura Sampad Vibhaga Yoga', 'Shraddhatraya Vibhaga Yoga',
    'Moksha Sannyasa Yoga',
  ];

  @override
  Widget build(BuildContext context) {
    final name = chapter <= _chapterNames.length ? _chapterNames[chapter - 1] : 'Chapter $chapter';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 4, offset: Offset(0, 2))],
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: _saffron.withAlpha(25),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(
              '$chapter',
              style: const TextStyle(color: _saffron, fontWeight: FontWeight.bold, fontSize: 15),
            ),
          ),
        ),
        title: Text('Chapter $chapter', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1A1410))),
        subtitle: Text(name, style: const TextStyle(fontSize: 11, color: Color(0xFF8B7D73))),
        trailing: const Icon(Icons.chevron_right, color: Color(0xFF8B7D73), size: 20),
        onTap: () {
          if (bookId != null) {
            context.push('/book/$bookId/chapter/$chapter');
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Dnyaneshwari not yet available')),
            );
          }
        },
      ),
    );
  }
}

class _SmallBookCard extends StatelessWidget {
  final _Book book;
  const _SmallBookCard({required this.book});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/book/${book.id}'),
      child: Container(
        width: 110,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [BoxShadow(color: Color(0x0A000000), blurRadius: 6, offset: Offset(0, 2))],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                child: book.coverUrl != null
                    ? CachedNetworkImage(imageUrl: book.coverUrl!, fit: BoxFit.cover, errorWidget: (_, __, ___) => _ph())
                    : _ph(),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(book.title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold), maxLines: 2, overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
      ),
    );
  }

  Widget _ph() => Container(color: const Color(0xFFF5E6D3), child: const Center(child: Text('📜', style: TextStyle(fontSize: 28))));
}

// ─── Filter bottom sheet ──────────────────────────────────────────────────────

class _FilterSheet extends ConsumerStatefulWidget {
  final _FilterState filter;
  const _FilterSheet({required this.filter});

  @override
  ConsumerState<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<_FilterSheet> {
  static const _saffron = Color(0xFFC75A1A);

  late String? _lang;
  late String? _translatorId;

  static const _languages = <String, String>{
    'en': 'English', 'hi': 'Hindi', 'mr': 'Marathi',
    'sa': 'Sanskrit', 'bn': 'Bengali', 'te': 'Telugu',
    'ta': 'Tamil', 'gu': 'Gujarati', 'kn': 'Kannada',
  };

  @override
  void initState() {
    super.initState();
    _lang = widget.filter.languageCode;
    _translatorId = widget.filter.translatorId;
  }

  @override
  Widget build(BuildContext context) {
    final transAsync = ref.watch(_translatorsProvider);

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      minChildSize: 0.4,
      builder: (ctx, scroll) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            const SizedBox(height: 8),
            Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Text('Filters', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  TextButton(
                    onPressed: () {
                      setState(() { _lang = null; _translatorId = null; });
                    },
                    child: const Text('Reset', style: TextStyle(color: _saffron)),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                controller: scroll,
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                children: [
                  // Language
                  const Text('Language', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _languages.entries.map((e) {
                      final code = e.key;
                      final label = e.value;
                      final selected = _lang == code;
                      return FilterChip(
                        label: Text(label),
                        selected: selected,
                        onSelected: (v) => setState(() => _lang = v ? code : null),
                        selectedColor: _saffron.withAlpha(40),
                        checkmarkColor: _saffron,
                        labelStyle: TextStyle(
                          color: selected ? _saffron : Colors.black87,
                          fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                          fontSize: 13,
                        ),
                        side: BorderSide(color: selected ? _saffron : Colors.grey[300]!),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 20),
                  const Text('Commentator / Translator', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 10),
                  transAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator(color: _saffron)),
                    error: (_, __) => const Text('Could not load translators', style: TextStyle(color: Colors.black45)),
                    data: (translators) => Column(
                      children: translators.map((t) {
                        final sel = _translatorId == t.id;
                        return RadioListTile<String?>(
                          value: t.id,
                          groupValue: _translatorId,
                          onChanged: (v) => setState(() => _translatorId = sel ? null : v),
                          title: Text(t.name, style: TextStyle(fontSize: 13, fontWeight: sel ? FontWeight.bold : FontWeight.normal)),
                          subtitle: t.sampradaySlug != null
                              ? Text(t.sampradaySlug!, style: const TextStyle(fontSize: 11, color: Color(0xFF8B7D73)))
                              : null,
                          activeColor: _saffron,
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                        );
                      }).toList(),
                    ),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _saffron,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    elevation: 0,
                  ),
                  onPressed: () {
                    ref.read(_filterProvider.notifier).state = widget.filter.copyWith(
                      languageCode: _lang,
                      translatorId: _translatorId,
                    );
                    Navigator.pop(ctx);
                  },
                  child: const Text('Apply Filters', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
