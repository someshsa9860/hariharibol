import 'json.dart';

/// A page of results plus the `meta` block the API sends beside it.
class Paged<T> {
  const Paged({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
    required this.totalPages,
    required this.hasMore,
  });

  final List<T> items;
  final int page;
  final int pageSize;
  final int total;
  final int totalPages;
  final bool hasMore;

  static Paged<T> empty<T>() => Paged<T>(
        items: const [],
        page: 1,
        pageSize: 0,
        total: 0,
        totalPages: 0,
        hasMore: false,
      );

  /// [data] is the response's `data` array, [meta] its `meta` object.
  factory Paged.fromResponse(dynamic data, Json? meta, T Function(Json) parse) {
    final items = asList(data, parse);
    return Paged<T>(
      items: items,
      page: asInt(meta?['page'], 1),
      pageSize: asInt(meta?['pageSize'], items.length),
      total: asInt(meta?['total'], items.length),
      totalPages: asInt(meta?['totalPages'], 1),
      hasMore: asBool(meta?['hasMore']),
    );
  }

  Paged<T> merge(Paged<T> next) => Paged<T>(
        items: [...items, ...next.items],
        page: next.page,
        pageSize: next.pageSize,
        total: next.total,
        totalPages: next.totalPages,
        hasMore: next.hasMore,
      );
}
