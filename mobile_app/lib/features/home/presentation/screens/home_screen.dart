import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/home_provider.dart';
import '../widgets/verse_of_day_card.dart';
import '../widgets/sampraday_section.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final verseOfDay = ref.watch(verseOfDayProvider);
    final sampradayList = ref.watch(sampradayListProvider);
    final followedList = ref.watch(followedSampradayListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFFBF7EF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'HariHariBol',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: const Color(0xFF1A1410),
            fontWeight: FontWeight.bold,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: Color(0xFF1A1410)),
            onPressed: () {
              // TODO: Implement search
            },
          ),
          IconButton(
            icon: const Icon(Icons.person, color: Color(0xFF1A1410)),
            onPressed: () {
              // TODO: Navigate to profile
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.refresh(verseOfDayProvider);
          ref.refresh(sampradayListProvider);
          ref.refresh(followedSampradayListProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Verse of the Day
              verseOfDay.when(
                data: (verse) => VerseOfDayCard(
                  verse: verse,
                  onTap: () {
                    // TODO: Navigate to verse detail
                  },
                ),
                loading: () => Container(
                  margin: const EdgeInsets.all(16),
                  height: 200,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(
                        Color(0xFFC75A1A),
                      ),
                    ),
                  ),
                ),
                error: (err, stack) => Container(
                  margin: const EdgeInsets.all(16),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.red[50],
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Failed to load verse: $err',
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              ),
              // Followed Sampradayas section
              followedList.when(
                data: (sampradayas) => sampradayas.isNotEmpty
                    ? SampradaySection(
                  sampradayas: sampradayas,
                  title: 'Your Traditions',
                )
                    : const SizedBox.shrink(),
                loading: () => const SizedBox.shrink(),
                error: (err, stack) => const SizedBox.shrink(),
              ),
              // All Sampradayas section
              sampradayList.when(
                data: (sampradayas) => SampradaySection(
                  sampradayas: sampradayas,
                  title: 'Explore Traditions',
                  onViewAll: () {
                    // TODO: Navigate to all sampradayas
                  },
                ),
                loading: () => Container(
                  margin: const EdgeInsets.all(16),
                  height: 180,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(
                        Color(0xFFC75A1A),
                      ),
                    ),
                  ),
                ),
                error: (err, stack) => Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Failed to load traditions: $err',
                    style: const TextStyle(color: Colors.red),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}