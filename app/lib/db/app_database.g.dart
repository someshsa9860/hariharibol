// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $DownloadedBooksTable extends DownloadedBooks
    with TableInfo<$DownloadedBooksTable, DownloadedBook> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DownloadedBooksTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _slugMeta = const VerificationMeta('slug');
  @override
  late final GeneratedColumn<String> slug = GeneratedColumn<String>(
    'slug',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _bookNumberMeta = const VerificationMeta(
    'bookNumber',
  );
  @override
  late final GeneratedColumn<int> bookNumber = GeneratedColumn<int>(
    'book_number',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [id, slug, title, bookNumber];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'downloaded_books';
  @override
  VerificationContext validateIntegrity(
    Insertable<DownloadedBook> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('slug')) {
      context.handle(
        _slugMeta,
        slug.isAcceptableOrUnknown(data['slug']!, _slugMeta),
      );
    } else if (isInserting) {
      context.missing(_slugMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('book_number')) {
      context.handle(
        _bookNumberMeta,
        bookNumber.isAcceptableOrUnknown(data['book_number']!, _bookNumberMeta),
      );
    } else if (isInserting) {
      context.missing(_bookNumberMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DownloadedBook map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DownloadedBook(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      slug: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}slug'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      bookNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}book_number'],
      )!,
    );
  }

  @override
  $DownloadedBooksTable createAlias(String alias) {
    return $DownloadedBooksTable(attachedDatabase, alias);
  }
}

class DownloadedBook extends DataClass implements Insertable<DownloadedBook> {
  final String id;
  final String slug;
  final String title;
  final int bookNumber;
  const DownloadedBook({
    required this.id,
    required this.slug,
    required this.title,
    required this.bookNumber,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['slug'] = Variable<String>(slug);
    map['title'] = Variable<String>(title);
    map['book_number'] = Variable<int>(bookNumber);
    return map;
  }

  DownloadedBooksCompanion toCompanion(bool nullToAbsent) {
    return DownloadedBooksCompanion(
      id: Value(id),
      slug: Value(slug),
      title: Value(title),
      bookNumber: Value(bookNumber),
    );
  }

  factory DownloadedBook.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DownloadedBook(
      id: serializer.fromJson<String>(json['id']),
      slug: serializer.fromJson<String>(json['slug']),
      title: serializer.fromJson<String>(json['title']),
      bookNumber: serializer.fromJson<int>(json['bookNumber']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'slug': serializer.toJson<String>(slug),
      'title': serializer.toJson<String>(title),
      'bookNumber': serializer.toJson<int>(bookNumber),
    };
  }

  DownloadedBook copyWith({
    String? id,
    String? slug,
    String? title,
    int? bookNumber,
  }) => DownloadedBook(
    id: id ?? this.id,
    slug: slug ?? this.slug,
    title: title ?? this.title,
    bookNumber: bookNumber ?? this.bookNumber,
  );
  DownloadedBook copyWithCompanion(DownloadedBooksCompanion data) {
    return DownloadedBook(
      id: data.id.present ? data.id.value : this.id,
      slug: data.slug.present ? data.slug.value : this.slug,
      title: data.title.present ? data.title.value : this.title,
      bookNumber: data.bookNumber.present
          ? data.bookNumber.value
          : this.bookNumber,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DownloadedBook(')
          ..write('id: $id, ')
          ..write('slug: $slug, ')
          ..write('title: $title, ')
          ..write('bookNumber: $bookNumber')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, slug, title, bookNumber);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DownloadedBook &&
          other.id == this.id &&
          other.slug == this.slug &&
          other.title == this.title &&
          other.bookNumber == this.bookNumber);
}

class DownloadedBooksCompanion extends UpdateCompanion<DownloadedBook> {
  final Value<String> id;
  final Value<String> slug;
  final Value<String> title;
  final Value<int> bookNumber;
  final Value<int> rowid;
  const DownloadedBooksCompanion({
    this.id = const Value.absent(),
    this.slug = const Value.absent(),
    this.title = const Value.absent(),
    this.bookNumber = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DownloadedBooksCompanion.insert({
    required String id,
    required String slug,
    required String title,
    required int bookNumber,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       slug = Value(slug),
       title = Value(title),
       bookNumber = Value(bookNumber);
  static Insertable<DownloadedBook> custom({
    Expression<String>? id,
    Expression<String>? slug,
    Expression<String>? title,
    Expression<int>? bookNumber,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (slug != null) 'slug': slug,
      if (title != null) 'title': title,
      if (bookNumber != null) 'book_number': bookNumber,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DownloadedBooksCompanion copyWith({
    Value<String>? id,
    Value<String>? slug,
    Value<String>? title,
    Value<int>? bookNumber,
    Value<int>? rowid,
  }) {
    return DownloadedBooksCompanion(
      id: id ?? this.id,
      slug: slug ?? this.slug,
      title: title ?? this.title,
      bookNumber: bookNumber ?? this.bookNumber,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (slug.present) {
      map['slug'] = Variable<String>(slug.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (bookNumber.present) {
      map['book_number'] = Variable<int>(bookNumber.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DownloadedBooksCompanion(')
          ..write('id: $id, ')
          ..write('slug: $slug, ')
          ..write('title: $title, ')
          ..write('bookNumber: $bookNumber, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DownloadedChaptersTable extends DownloadedChapters
    with TableInfo<$DownloadedChaptersTable, DownloadedChapter> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DownloadedChaptersTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _bookIdMeta = const VerificationMeta('bookId');
  @override
  late final GeneratedColumn<String> bookId = GeneratedColumn<String>(
    'book_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cantoNumberMeta = const VerificationMeta(
    'cantoNumber',
  );
  @override
  late final GeneratedColumn<int> cantoNumber = GeneratedColumn<int>(
    'canto_number',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _numberMeta = const VerificationMeta('number');
  @override
  late final GeneratedColumn<int> number = GeneratedColumn<int>(
    'number',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _titleMeta = const VerificationMeta('title');
  @override
  late final GeneratedColumn<String> title = GeneratedColumn<String>(
    'title',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _summaryMeta = const VerificationMeta(
    'summary',
  );
  @override
  late final GeneratedColumn<String> summary = GeneratedColumn<String>(
    'summary',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _totalVersesMeta = const VerificationMeta(
    'totalVerses',
  );
  @override
  late final GeneratedColumn<int> totalVerses = GeneratedColumn<int>(
    'total_verses',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    bookId,
    cantoNumber,
    number,
    title,
    summary,
    totalVerses,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'downloaded_chapters';
  @override
  VerificationContext validateIntegrity(
    Insertable<DownloadedChapter> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('book_id')) {
      context.handle(
        _bookIdMeta,
        bookId.isAcceptableOrUnknown(data['book_id']!, _bookIdMeta),
      );
    } else if (isInserting) {
      context.missing(_bookIdMeta);
    }
    if (data.containsKey('canto_number')) {
      context.handle(
        _cantoNumberMeta,
        cantoNumber.isAcceptableOrUnknown(
          data['canto_number']!,
          _cantoNumberMeta,
        ),
      );
    }
    if (data.containsKey('number')) {
      context.handle(
        _numberMeta,
        number.isAcceptableOrUnknown(data['number']!, _numberMeta),
      );
    } else if (isInserting) {
      context.missing(_numberMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('summary')) {
      context.handle(
        _summaryMeta,
        summary.isAcceptableOrUnknown(data['summary']!, _summaryMeta),
      );
    }
    if (data.containsKey('total_verses')) {
      context.handle(
        _totalVersesMeta,
        totalVerses.isAcceptableOrUnknown(
          data['total_verses']!,
          _totalVersesMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DownloadedChapter map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DownloadedChapter(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      bookId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}book_id'],
      )!,
      cantoNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}canto_number'],
      ),
      number: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}number'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      summary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}summary'],
      ),
      totalVerses: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_verses'],
      )!,
    );
  }

  @override
  $DownloadedChaptersTable createAlias(String alias) {
    return $DownloadedChaptersTable(attachedDatabase, alias);
  }
}

class DownloadedChapter extends DataClass
    implements Insertable<DownloadedChapter> {
  final String id;
  final String bookId;
  final int? cantoNumber;
  final int number;
  final String title;
  final String? summary;
  final int totalVerses;
  const DownloadedChapter({
    required this.id,
    required this.bookId,
    this.cantoNumber,
    required this.number,
    required this.title,
    this.summary,
    required this.totalVerses,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['book_id'] = Variable<String>(bookId);
    if (!nullToAbsent || cantoNumber != null) {
      map['canto_number'] = Variable<int>(cantoNumber);
    }
    map['number'] = Variable<int>(number);
    map['title'] = Variable<String>(title);
    if (!nullToAbsent || summary != null) {
      map['summary'] = Variable<String>(summary);
    }
    map['total_verses'] = Variable<int>(totalVerses);
    return map;
  }

  DownloadedChaptersCompanion toCompanion(bool nullToAbsent) {
    return DownloadedChaptersCompanion(
      id: Value(id),
      bookId: Value(bookId),
      cantoNumber: cantoNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(cantoNumber),
      number: Value(number),
      title: Value(title),
      summary: summary == null && nullToAbsent
          ? const Value.absent()
          : Value(summary),
      totalVerses: Value(totalVerses),
    );
  }

  factory DownloadedChapter.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DownloadedChapter(
      id: serializer.fromJson<String>(json['id']),
      bookId: serializer.fromJson<String>(json['bookId']),
      cantoNumber: serializer.fromJson<int?>(json['cantoNumber']),
      number: serializer.fromJson<int>(json['number']),
      title: serializer.fromJson<String>(json['title']),
      summary: serializer.fromJson<String?>(json['summary']),
      totalVerses: serializer.fromJson<int>(json['totalVerses']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'bookId': serializer.toJson<String>(bookId),
      'cantoNumber': serializer.toJson<int?>(cantoNumber),
      'number': serializer.toJson<int>(number),
      'title': serializer.toJson<String>(title),
      'summary': serializer.toJson<String?>(summary),
      'totalVerses': serializer.toJson<int>(totalVerses),
    };
  }

  DownloadedChapter copyWith({
    String? id,
    String? bookId,
    Value<int?> cantoNumber = const Value.absent(),
    int? number,
    String? title,
    Value<String?> summary = const Value.absent(),
    int? totalVerses,
  }) => DownloadedChapter(
    id: id ?? this.id,
    bookId: bookId ?? this.bookId,
    cantoNumber: cantoNumber.present ? cantoNumber.value : this.cantoNumber,
    number: number ?? this.number,
    title: title ?? this.title,
    summary: summary.present ? summary.value : this.summary,
    totalVerses: totalVerses ?? this.totalVerses,
  );
  DownloadedChapter copyWithCompanion(DownloadedChaptersCompanion data) {
    return DownloadedChapter(
      id: data.id.present ? data.id.value : this.id,
      bookId: data.bookId.present ? data.bookId.value : this.bookId,
      cantoNumber: data.cantoNumber.present
          ? data.cantoNumber.value
          : this.cantoNumber,
      number: data.number.present ? data.number.value : this.number,
      title: data.title.present ? data.title.value : this.title,
      summary: data.summary.present ? data.summary.value : this.summary,
      totalVerses: data.totalVerses.present
          ? data.totalVerses.value
          : this.totalVerses,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DownloadedChapter(')
          ..write('id: $id, ')
          ..write('bookId: $bookId, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('number: $number, ')
          ..write('title: $title, ')
          ..write('summary: $summary, ')
          ..write('totalVerses: $totalVerses')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, bookId, cantoNumber, number, title, summary, totalVerses);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DownloadedChapter &&
          other.id == this.id &&
          other.bookId == this.bookId &&
          other.cantoNumber == this.cantoNumber &&
          other.number == this.number &&
          other.title == this.title &&
          other.summary == this.summary &&
          other.totalVerses == this.totalVerses);
}

class DownloadedChaptersCompanion extends UpdateCompanion<DownloadedChapter> {
  final Value<String> id;
  final Value<String> bookId;
  final Value<int?> cantoNumber;
  final Value<int> number;
  final Value<String> title;
  final Value<String?> summary;
  final Value<int> totalVerses;
  final Value<int> rowid;
  const DownloadedChaptersCompanion({
    this.id = const Value.absent(),
    this.bookId = const Value.absent(),
    this.cantoNumber = const Value.absent(),
    this.number = const Value.absent(),
    this.title = const Value.absent(),
    this.summary = const Value.absent(),
    this.totalVerses = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DownloadedChaptersCompanion.insert({
    required String id,
    required String bookId,
    this.cantoNumber = const Value.absent(),
    required int number,
    required String title,
    this.summary = const Value.absent(),
    this.totalVerses = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       bookId = Value(bookId),
       number = Value(number),
       title = Value(title);
  static Insertable<DownloadedChapter> custom({
    Expression<String>? id,
    Expression<String>? bookId,
    Expression<int>? cantoNumber,
    Expression<int>? number,
    Expression<String>? title,
    Expression<String>? summary,
    Expression<int>? totalVerses,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (bookId != null) 'book_id': bookId,
      if (cantoNumber != null) 'canto_number': cantoNumber,
      if (number != null) 'number': number,
      if (title != null) 'title': title,
      if (summary != null) 'summary': summary,
      if (totalVerses != null) 'total_verses': totalVerses,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DownloadedChaptersCompanion copyWith({
    Value<String>? id,
    Value<String>? bookId,
    Value<int?>? cantoNumber,
    Value<int>? number,
    Value<String>? title,
    Value<String?>? summary,
    Value<int>? totalVerses,
    Value<int>? rowid,
  }) {
    return DownloadedChaptersCompanion(
      id: id ?? this.id,
      bookId: bookId ?? this.bookId,
      cantoNumber: cantoNumber ?? this.cantoNumber,
      number: number ?? this.number,
      title: title ?? this.title,
      summary: summary ?? this.summary,
      totalVerses: totalVerses ?? this.totalVerses,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (bookId.present) {
      map['book_id'] = Variable<String>(bookId.value);
    }
    if (cantoNumber.present) {
      map['canto_number'] = Variable<int>(cantoNumber.value);
    }
    if (number.present) {
      map['number'] = Variable<int>(number.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (summary.present) {
      map['summary'] = Variable<String>(summary.value);
    }
    if (totalVerses.present) {
      map['total_verses'] = Variable<int>(totalVerses.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DownloadedChaptersCompanion(')
          ..write('id: $id, ')
          ..write('bookId: $bookId, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('number: $number, ')
          ..write('title: $title, ')
          ..write('summary: $summary, ')
          ..write('totalVerses: $totalVerses, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DownloadedVersesTable extends DownloadedVerses
    with TableInfo<$DownloadedVersesTable, DownloadedVerse> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DownloadedVersesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _verseIdMeta = const VerificationMeta(
    'verseId',
  );
  @override
  late final GeneratedColumn<String> verseId = GeneratedColumn<String>(
    'verse_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _bookIdMeta = const VerificationMeta('bookId');
  @override
  late final GeneratedColumn<String> bookId = GeneratedColumn<String>(
    'book_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _chapterIdMeta = const VerificationMeta(
    'chapterId',
  );
  @override
  late final GeneratedColumn<String> chapterId = GeneratedColumn<String>(
    'chapter_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _bookNumberMeta = const VerificationMeta(
    'bookNumber',
  );
  @override
  late final GeneratedColumn<int> bookNumber = GeneratedColumn<int>(
    'book_number',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _cantoNumberMeta = const VerificationMeta(
    'cantoNumber',
  );
  @override
  late final GeneratedColumn<int> cantoNumber = GeneratedColumn<int>(
    'canto_number',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _chapterNumberMeta = const VerificationMeta(
    'chapterNumber',
  );
  @override
  late final GeneratedColumn<int> chapterNumber = GeneratedColumn<int>(
    'chapter_number',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _verseNumberMeta = const VerificationMeta(
    'verseNumber',
  );
  @override
  late final GeneratedColumn<int> verseNumber = GeneratedColumn<int>(
    'verse_number',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _verseNumberEndMeta = const VerificationMeta(
    'verseNumberEnd',
  );
  @override
  late final GeneratedColumn<int> verseNumberEnd = GeneratedColumn<int>(
    'verse_number_end',
    aliasedName,
    true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sanskritMeta = const VerificationMeta(
    'sanskrit',
  );
  @override
  late final GeneratedColumn<String> sanskrit = GeneratedColumn<String>(
    'sanskrit',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _transliterationMeta = const VerificationMeta(
    'transliteration',
  );
  @override
  late final GeneratedColumn<String> transliteration = GeneratedColumn<String>(
    'transliteration',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _wordMeaningsMeta = const VerificationMeta(
    'wordMeanings',
  );
  @override
  late final GeneratedColumn<String> wordMeanings = GeneratedColumn<String>(
    'word_meanings',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _tagsJsonMeta = const VerificationMeta(
    'tagsJson',
  );
  @override
  late final GeneratedColumn<String> tagsJson = GeneratedColumn<String>(
    'tags_json',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    verseId,
    bookId,
    chapterId,
    bookNumber,
    type,
    cantoNumber,
    chapterNumber,
    verseNumber,
    verseNumberEnd,
    sanskrit,
    transliteration,
    wordMeanings,
    tagsJson,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'downloaded_verses';
  @override
  VerificationContext validateIntegrity(
    Insertable<DownloadedVerse> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('verse_id')) {
      context.handle(
        _verseIdMeta,
        verseId.isAcceptableOrUnknown(data['verse_id']!, _verseIdMeta),
      );
    } else if (isInserting) {
      context.missing(_verseIdMeta);
    }
    if (data.containsKey('book_id')) {
      context.handle(
        _bookIdMeta,
        bookId.isAcceptableOrUnknown(data['book_id']!, _bookIdMeta),
      );
    } else if (isInserting) {
      context.missing(_bookIdMeta);
    }
    if (data.containsKey('chapter_id')) {
      context.handle(
        _chapterIdMeta,
        chapterId.isAcceptableOrUnknown(data['chapter_id']!, _chapterIdMeta),
      );
    }
    if (data.containsKey('book_number')) {
      context.handle(
        _bookNumberMeta,
        bookNumber.isAcceptableOrUnknown(data['book_number']!, _bookNumberMeta),
      );
    } else if (isInserting) {
      context.missing(_bookNumberMeta);
    }
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
    }
    if (data.containsKey('canto_number')) {
      context.handle(
        _cantoNumberMeta,
        cantoNumber.isAcceptableOrUnknown(
          data['canto_number']!,
          _cantoNumberMeta,
        ),
      );
    }
    if (data.containsKey('chapter_number')) {
      context.handle(
        _chapterNumberMeta,
        chapterNumber.isAcceptableOrUnknown(
          data['chapter_number']!,
          _chapterNumberMeta,
        ),
      );
    }
    if (data.containsKey('verse_number')) {
      context.handle(
        _verseNumberMeta,
        verseNumber.isAcceptableOrUnknown(
          data['verse_number']!,
          _verseNumberMeta,
        ),
      );
    }
    if (data.containsKey('verse_number_end')) {
      context.handle(
        _verseNumberEndMeta,
        verseNumberEnd.isAcceptableOrUnknown(
          data['verse_number_end']!,
          _verseNumberEndMeta,
        ),
      );
    }
    if (data.containsKey('sanskrit')) {
      context.handle(
        _sanskritMeta,
        sanskrit.isAcceptableOrUnknown(data['sanskrit']!, _sanskritMeta),
      );
    }
    if (data.containsKey('transliteration')) {
      context.handle(
        _transliterationMeta,
        transliteration.isAcceptableOrUnknown(
          data['transliteration']!,
          _transliterationMeta,
        ),
      );
    }
    if (data.containsKey('word_meanings')) {
      context.handle(
        _wordMeaningsMeta,
        wordMeanings.isAcceptableOrUnknown(
          data['word_meanings']!,
          _wordMeaningsMeta,
        ),
      );
    }
    if (data.containsKey('tags_json')) {
      context.handle(
        _tagsJsonMeta,
        tagsJson.isAcceptableOrUnknown(data['tags_json']!, _tagsJsonMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  DownloadedVerse map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DownloadedVerse(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      verseId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}verse_id'],
      )!,
      bookId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}book_id'],
      )!,
      chapterId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}chapter_id'],
      ),
      bookNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}book_number'],
      )!,
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      ),
      cantoNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}canto_number'],
      ),
      chapterNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}chapter_number'],
      ),
      verseNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}verse_number'],
      ),
      verseNumberEnd: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}verse_number_end'],
      ),
      sanskrit: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sanskrit'],
      ),
      transliteration: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}transliteration'],
      ),
      wordMeanings: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}word_meanings'],
      ),
      tagsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}tags_json'],
      ),
    );
  }

  @override
  $DownloadedVersesTable createAlias(String alias) {
    return $DownloadedVersesTable(attachedDatabase, alias);
  }
}

class DownloadedVerse extends DataClass implements Insertable<DownloadedVerse> {
  final String id;
  final String verseId;
  final String bookId;
  final String? chapterId;
  final int bookNumber;
  final String? type;
  final int? cantoNumber;
  final int? chapterNumber;
  final int? verseNumber;
  final int? verseNumberEnd;
  final String? sanskrit;
  final String? transliteration;
  final String? wordMeanings;
  final String? tagsJson;
  const DownloadedVerse({
    required this.id,
    required this.verseId,
    required this.bookId,
    this.chapterId,
    required this.bookNumber,
    this.type,
    this.cantoNumber,
    this.chapterNumber,
    this.verseNumber,
    this.verseNumberEnd,
    this.sanskrit,
    this.transliteration,
    this.wordMeanings,
    this.tagsJson,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['verse_id'] = Variable<String>(verseId);
    map['book_id'] = Variable<String>(bookId);
    if (!nullToAbsent || chapterId != null) {
      map['chapter_id'] = Variable<String>(chapterId);
    }
    map['book_number'] = Variable<int>(bookNumber);
    if (!nullToAbsent || type != null) {
      map['type'] = Variable<String>(type);
    }
    if (!nullToAbsent || cantoNumber != null) {
      map['canto_number'] = Variable<int>(cantoNumber);
    }
    if (!nullToAbsent || chapterNumber != null) {
      map['chapter_number'] = Variable<int>(chapterNumber);
    }
    if (!nullToAbsent || verseNumber != null) {
      map['verse_number'] = Variable<int>(verseNumber);
    }
    if (!nullToAbsent || verseNumberEnd != null) {
      map['verse_number_end'] = Variable<int>(verseNumberEnd);
    }
    if (!nullToAbsent || sanskrit != null) {
      map['sanskrit'] = Variable<String>(sanskrit);
    }
    if (!nullToAbsent || transliteration != null) {
      map['transliteration'] = Variable<String>(transliteration);
    }
    if (!nullToAbsent || wordMeanings != null) {
      map['word_meanings'] = Variable<String>(wordMeanings);
    }
    if (!nullToAbsent || tagsJson != null) {
      map['tags_json'] = Variable<String>(tagsJson);
    }
    return map;
  }

  DownloadedVersesCompanion toCompanion(bool nullToAbsent) {
    return DownloadedVersesCompanion(
      id: Value(id),
      verseId: Value(verseId),
      bookId: Value(bookId),
      chapterId: chapterId == null && nullToAbsent
          ? const Value.absent()
          : Value(chapterId),
      bookNumber: Value(bookNumber),
      type: type == null && nullToAbsent ? const Value.absent() : Value(type),
      cantoNumber: cantoNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(cantoNumber),
      chapterNumber: chapterNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(chapterNumber),
      verseNumber: verseNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(verseNumber),
      verseNumberEnd: verseNumberEnd == null && nullToAbsent
          ? const Value.absent()
          : Value(verseNumberEnd),
      sanskrit: sanskrit == null && nullToAbsent
          ? const Value.absent()
          : Value(sanskrit),
      transliteration: transliteration == null && nullToAbsent
          ? const Value.absent()
          : Value(transliteration),
      wordMeanings: wordMeanings == null && nullToAbsent
          ? const Value.absent()
          : Value(wordMeanings),
      tagsJson: tagsJson == null && nullToAbsent
          ? const Value.absent()
          : Value(tagsJson),
    );
  }

  factory DownloadedVerse.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DownloadedVerse(
      id: serializer.fromJson<String>(json['id']),
      verseId: serializer.fromJson<String>(json['verseId']),
      bookId: serializer.fromJson<String>(json['bookId']),
      chapterId: serializer.fromJson<String?>(json['chapterId']),
      bookNumber: serializer.fromJson<int>(json['bookNumber']),
      type: serializer.fromJson<String?>(json['type']),
      cantoNumber: serializer.fromJson<int?>(json['cantoNumber']),
      chapterNumber: serializer.fromJson<int?>(json['chapterNumber']),
      verseNumber: serializer.fromJson<int?>(json['verseNumber']),
      verseNumberEnd: serializer.fromJson<int?>(json['verseNumberEnd']),
      sanskrit: serializer.fromJson<String?>(json['sanskrit']),
      transliteration: serializer.fromJson<String?>(json['transliteration']),
      wordMeanings: serializer.fromJson<String?>(json['wordMeanings']),
      tagsJson: serializer.fromJson<String?>(json['tagsJson']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'verseId': serializer.toJson<String>(verseId),
      'bookId': serializer.toJson<String>(bookId),
      'chapterId': serializer.toJson<String?>(chapterId),
      'bookNumber': serializer.toJson<int>(bookNumber),
      'type': serializer.toJson<String?>(type),
      'cantoNumber': serializer.toJson<int?>(cantoNumber),
      'chapterNumber': serializer.toJson<int?>(chapterNumber),
      'verseNumber': serializer.toJson<int?>(verseNumber),
      'verseNumberEnd': serializer.toJson<int?>(verseNumberEnd),
      'sanskrit': serializer.toJson<String?>(sanskrit),
      'transliteration': serializer.toJson<String?>(transliteration),
      'wordMeanings': serializer.toJson<String?>(wordMeanings),
      'tagsJson': serializer.toJson<String?>(tagsJson),
    };
  }

  DownloadedVerse copyWith({
    String? id,
    String? verseId,
    String? bookId,
    Value<String?> chapterId = const Value.absent(),
    int? bookNumber,
    Value<String?> type = const Value.absent(),
    Value<int?> cantoNumber = const Value.absent(),
    Value<int?> chapterNumber = const Value.absent(),
    Value<int?> verseNumber = const Value.absent(),
    Value<int?> verseNumberEnd = const Value.absent(),
    Value<String?> sanskrit = const Value.absent(),
    Value<String?> transliteration = const Value.absent(),
    Value<String?> wordMeanings = const Value.absent(),
    Value<String?> tagsJson = const Value.absent(),
  }) => DownloadedVerse(
    id: id ?? this.id,
    verseId: verseId ?? this.verseId,
    bookId: bookId ?? this.bookId,
    chapterId: chapterId.present ? chapterId.value : this.chapterId,
    bookNumber: bookNumber ?? this.bookNumber,
    type: type.present ? type.value : this.type,
    cantoNumber: cantoNumber.present ? cantoNumber.value : this.cantoNumber,
    chapterNumber: chapterNumber.present
        ? chapterNumber.value
        : this.chapterNumber,
    verseNumber: verseNumber.present ? verseNumber.value : this.verseNumber,
    verseNumberEnd: verseNumberEnd.present
        ? verseNumberEnd.value
        : this.verseNumberEnd,
    sanskrit: sanskrit.present ? sanskrit.value : this.sanskrit,
    transliteration: transliteration.present
        ? transliteration.value
        : this.transliteration,
    wordMeanings: wordMeanings.present ? wordMeanings.value : this.wordMeanings,
    tagsJson: tagsJson.present ? tagsJson.value : this.tagsJson,
  );
  DownloadedVerse copyWithCompanion(DownloadedVersesCompanion data) {
    return DownloadedVerse(
      id: data.id.present ? data.id.value : this.id,
      verseId: data.verseId.present ? data.verseId.value : this.verseId,
      bookId: data.bookId.present ? data.bookId.value : this.bookId,
      chapterId: data.chapterId.present ? data.chapterId.value : this.chapterId,
      bookNumber: data.bookNumber.present
          ? data.bookNumber.value
          : this.bookNumber,
      type: data.type.present ? data.type.value : this.type,
      cantoNumber: data.cantoNumber.present
          ? data.cantoNumber.value
          : this.cantoNumber,
      chapterNumber: data.chapterNumber.present
          ? data.chapterNumber.value
          : this.chapterNumber,
      verseNumber: data.verseNumber.present
          ? data.verseNumber.value
          : this.verseNumber,
      verseNumberEnd: data.verseNumberEnd.present
          ? data.verseNumberEnd.value
          : this.verseNumberEnd,
      sanskrit: data.sanskrit.present ? data.sanskrit.value : this.sanskrit,
      transliteration: data.transliteration.present
          ? data.transliteration.value
          : this.transliteration,
      wordMeanings: data.wordMeanings.present
          ? data.wordMeanings.value
          : this.wordMeanings,
      tagsJson: data.tagsJson.present ? data.tagsJson.value : this.tagsJson,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DownloadedVerse(')
          ..write('id: $id, ')
          ..write('verseId: $verseId, ')
          ..write('bookId: $bookId, ')
          ..write('chapterId: $chapterId, ')
          ..write('bookNumber: $bookNumber, ')
          ..write('type: $type, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('chapterNumber: $chapterNumber, ')
          ..write('verseNumber: $verseNumber, ')
          ..write('verseNumberEnd: $verseNumberEnd, ')
          ..write('sanskrit: $sanskrit, ')
          ..write('transliteration: $transliteration, ')
          ..write('wordMeanings: $wordMeanings, ')
          ..write('tagsJson: $tagsJson')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    verseId,
    bookId,
    chapterId,
    bookNumber,
    type,
    cantoNumber,
    chapterNumber,
    verseNumber,
    verseNumberEnd,
    sanskrit,
    transliteration,
    wordMeanings,
    tagsJson,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DownloadedVerse &&
          other.id == this.id &&
          other.verseId == this.verseId &&
          other.bookId == this.bookId &&
          other.chapterId == this.chapterId &&
          other.bookNumber == this.bookNumber &&
          other.type == this.type &&
          other.cantoNumber == this.cantoNumber &&
          other.chapterNumber == this.chapterNumber &&
          other.verseNumber == this.verseNumber &&
          other.verseNumberEnd == this.verseNumberEnd &&
          other.sanskrit == this.sanskrit &&
          other.transliteration == this.transliteration &&
          other.wordMeanings == this.wordMeanings &&
          other.tagsJson == this.tagsJson);
}

class DownloadedVersesCompanion extends UpdateCompanion<DownloadedVerse> {
  final Value<String> id;
  final Value<String> verseId;
  final Value<String> bookId;
  final Value<String?> chapterId;
  final Value<int> bookNumber;
  final Value<String?> type;
  final Value<int?> cantoNumber;
  final Value<int?> chapterNumber;
  final Value<int?> verseNumber;
  final Value<int?> verseNumberEnd;
  final Value<String?> sanskrit;
  final Value<String?> transliteration;
  final Value<String?> wordMeanings;
  final Value<String?> tagsJson;
  final Value<int> rowid;
  const DownloadedVersesCompanion({
    this.id = const Value.absent(),
    this.verseId = const Value.absent(),
    this.bookId = const Value.absent(),
    this.chapterId = const Value.absent(),
    this.bookNumber = const Value.absent(),
    this.type = const Value.absent(),
    this.cantoNumber = const Value.absent(),
    this.chapterNumber = const Value.absent(),
    this.verseNumber = const Value.absent(),
    this.verseNumberEnd = const Value.absent(),
    this.sanskrit = const Value.absent(),
    this.transliteration = const Value.absent(),
    this.wordMeanings = const Value.absent(),
    this.tagsJson = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DownloadedVersesCompanion.insert({
    required String id,
    required String verseId,
    required String bookId,
    this.chapterId = const Value.absent(),
    required int bookNumber,
    this.type = const Value.absent(),
    this.cantoNumber = const Value.absent(),
    this.chapterNumber = const Value.absent(),
    this.verseNumber = const Value.absent(),
    this.verseNumberEnd = const Value.absent(),
    this.sanskrit = const Value.absent(),
    this.transliteration = const Value.absent(),
    this.wordMeanings = const Value.absent(),
    this.tagsJson = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       verseId = Value(verseId),
       bookId = Value(bookId),
       bookNumber = Value(bookNumber);
  static Insertable<DownloadedVerse> custom({
    Expression<String>? id,
    Expression<String>? verseId,
    Expression<String>? bookId,
    Expression<String>? chapterId,
    Expression<int>? bookNumber,
    Expression<String>? type,
    Expression<int>? cantoNumber,
    Expression<int>? chapterNumber,
    Expression<int>? verseNumber,
    Expression<int>? verseNumberEnd,
    Expression<String>? sanskrit,
    Expression<String>? transliteration,
    Expression<String>? wordMeanings,
    Expression<String>? tagsJson,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (verseId != null) 'verse_id': verseId,
      if (bookId != null) 'book_id': bookId,
      if (chapterId != null) 'chapter_id': chapterId,
      if (bookNumber != null) 'book_number': bookNumber,
      if (type != null) 'type': type,
      if (cantoNumber != null) 'canto_number': cantoNumber,
      if (chapterNumber != null) 'chapter_number': chapterNumber,
      if (verseNumber != null) 'verse_number': verseNumber,
      if (verseNumberEnd != null) 'verse_number_end': verseNumberEnd,
      if (sanskrit != null) 'sanskrit': sanskrit,
      if (transliteration != null) 'transliteration': transliteration,
      if (wordMeanings != null) 'word_meanings': wordMeanings,
      if (tagsJson != null) 'tags_json': tagsJson,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DownloadedVersesCompanion copyWith({
    Value<String>? id,
    Value<String>? verseId,
    Value<String>? bookId,
    Value<String?>? chapterId,
    Value<int>? bookNumber,
    Value<String?>? type,
    Value<int?>? cantoNumber,
    Value<int?>? chapterNumber,
    Value<int?>? verseNumber,
    Value<int?>? verseNumberEnd,
    Value<String?>? sanskrit,
    Value<String?>? transliteration,
    Value<String?>? wordMeanings,
    Value<String?>? tagsJson,
    Value<int>? rowid,
  }) {
    return DownloadedVersesCompanion(
      id: id ?? this.id,
      verseId: verseId ?? this.verseId,
      bookId: bookId ?? this.bookId,
      chapterId: chapterId ?? this.chapterId,
      bookNumber: bookNumber ?? this.bookNumber,
      type: type ?? this.type,
      cantoNumber: cantoNumber ?? this.cantoNumber,
      chapterNumber: chapterNumber ?? this.chapterNumber,
      verseNumber: verseNumber ?? this.verseNumber,
      verseNumberEnd: verseNumberEnd ?? this.verseNumberEnd,
      sanskrit: sanskrit ?? this.sanskrit,
      transliteration: transliteration ?? this.transliteration,
      wordMeanings: wordMeanings ?? this.wordMeanings,
      tagsJson: tagsJson ?? this.tagsJson,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (verseId.present) {
      map['verse_id'] = Variable<String>(verseId.value);
    }
    if (bookId.present) {
      map['book_id'] = Variable<String>(bookId.value);
    }
    if (chapterId.present) {
      map['chapter_id'] = Variable<String>(chapterId.value);
    }
    if (bookNumber.present) {
      map['book_number'] = Variable<int>(bookNumber.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (cantoNumber.present) {
      map['canto_number'] = Variable<int>(cantoNumber.value);
    }
    if (chapterNumber.present) {
      map['chapter_number'] = Variable<int>(chapterNumber.value);
    }
    if (verseNumber.present) {
      map['verse_number'] = Variable<int>(verseNumber.value);
    }
    if (verseNumberEnd.present) {
      map['verse_number_end'] = Variable<int>(verseNumberEnd.value);
    }
    if (sanskrit.present) {
      map['sanskrit'] = Variable<String>(sanskrit.value);
    }
    if (transliteration.present) {
      map['transliteration'] = Variable<String>(transliteration.value);
    }
    if (wordMeanings.present) {
      map['word_meanings'] = Variable<String>(wordMeanings.value);
    }
    if (tagsJson.present) {
      map['tags_json'] = Variable<String>(tagsJson.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DownloadedVersesCompanion(')
          ..write('id: $id, ')
          ..write('verseId: $verseId, ')
          ..write('bookId: $bookId, ')
          ..write('chapterId: $chapterId, ')
          ..write('bookNumber: $bookNumber, ')
          ..write('type: $type, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('chapterNumber: $chapterNumber, ')
          ..write('verseNumber: $verseNumber, ')
          ..write('verseNumberEnd: $verseNumberEnd, ')
          ..write('sanskrit: $sanskrit, ')
          ..write('transliteration: $transliteration, ')
          ..write('wordMeanings: $wordMeanings, ')
          ..write('tagsJson: $tagsJson, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DownloadedVerseTextsTable extends DownloadedVerseTexts
    with TableInfo<$DownloadedVerseTextsTable, DownloadedVerseText> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DownloadedVerseTextsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _verseRowIdMeta = const VerificationMeta(
    'verseRowId',
  );
  @override
  late final GeneratedColumn<String> verseRowId = GeneratedColumn<String>(
    'verse_row_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _languageCodeMeta = const VerificationMeta(
    'languageCode',
  );
  @override
  late final GeneratedColumn<String> languageCode = GeneratedColumn<String>(
    'language_code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _translatorIdMeta = const VerificationMeta(
    'translatorId',
  );
  @override
  late final GeneratedColumn<String> translatorId = GeneratedColumn<String>(
    'translator_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _translatorSlugMeta = const VerificationMeta(
    'translatorSlug',
  );
  @override
  late final GeneratedColumn<String> translatorSlug = GeneratedColumn<String>(
    'translator_slug',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _translatorNameMeta = const VerificationMeta(
    'translatorName',
  );
  @override
  late final GeneratedColumn<String> translatorName = GeneratedColumn<String>(
    'translator_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _translatorImageUrlMeta =
      const VerificationMeta('translatorImageUrl');
  @override
  late final GeneratedColumn<String> translatorImageUrl =
      GeneratedColumn<String>(
        'translator_image_url',
        aliasedName,
        true,
        type: DriftSqlType.string,
        requiredDuringInsert: false,
      );
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _meaningMeta = const VerificationMeta(
    'meaning',
  );
  @override
  late final GeneratedColumn<String> meaning = GeneratedColumn<String>(
    'meaning',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _purportMeta = const VerificationMeta(
    'purport',
  );
  @override
  late final GeneratedColumn<String> purport = GeneratedColumn<String>(
    'purport',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _sourceRefMeta = const VerificationMeta(
    'sourceRef',
  );
  @override
  late final GeneratedColumn<String> sourceRef = GeneratedColumn<String>(
    'source_ref',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    verseRowId,
    languageCode,
    translatorId,
    translatorSlug,
    translatorName,
    translatorImageUrl,
    type,
    meaning,
    purport,
    sourceRef,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'downloaded_verse_texts';
  @override
  VerificationContext validateIntegrity(
    Insertable<DownloadedVerseText> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('verse_row_id')) {
      context.handle(
        _verseRowIdMeta,
        verseRowId.isAcceptableOrUnknown(
          data['verse_row_id']!,
          _verseRowIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_verseRowIdMeta);
    }
    if (data.containsKey('language_code')) {
      context.handle(
        _languageCodeMeta,
        languageCode.isAcceptableOrUnknown(
          data['language_code']!,
          _languageCodeMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_languageCodeMeta);
    }
    if (data.containsKey('translator_id')) {
      context.handle(
        _translatorIdMeta,
        translatorId.isAcceptableOrUnknown(
          data['translator_id']!,
          _translatorIdMeta,
        ),
      );
    }
    if (data.containsKey('translator_slug')) {
      context.handle(
        _translatorSlugMeta,
        translatorSlug.isAcceptableOrUnknown(
          data['translator_slug']!,
          _translatorSlugMeta,
        ),
      );
    }
    if (data.containsKey('translator_name')) {
      context.handle(
        _translatorNameMeta,
        translatorName.isAcceptableOrUnknown(
          data['translator_name']!,
          _translatorNameMeta,
        ),
      );
    }
    if (data.containsKey('translator_image_url')) {
      context.handle(
        _translatorImageUrlMeta,
        translatorImageUrl.isAcceptableOrUnknown(
          data['translator_image_url']!,
          _translatorImageUrlMeta,
        ),
      );
    }
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
    }
    if (data.containsKey('meaning')) {
      context.handle(
        _meaningMeta,
        meaning.isAcceptableOrUnknown(data['meaning']!, _meaningMeta),
      );
    }
    if (data.containsKey('purport')) {
      context.handle(
        _purportMeta,
        purport.isAcceptableOrUnknown(data['purport']!, _purportMeta),
      );
    }
    if (data.containsKey('source_ref')) {
      context.handle(
        _sourceRefMeta,
        sourceRef.isAcceptableOrUnknown(data['source_ref']!, _sourceRefMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {verseRowId, languageCode};
  @override
  DownloadedVerseText map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DownloadedVerseText(
      verseRowId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}verse_row_id'],
      )!,
      languageCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}language_code'],
      )!,
      translatorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}translator_id'],
      ),
      translatorSlug: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}translator_slug'],
      ),
      translatorName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}translator_name'],
      ),
      translatorImageUrl: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}translator_image_url'],
      ),
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      ),
      meaning: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}meaning'],
      ),
      purport: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}purport'],
      ),
      sourceRef: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}source_ref'],
      ),
    );
  }

  @override
  $DownloadedVerseTextsTable createAlias(String alias) {
    return $DownloadedVerseTextsTable(attachedDatabase, alias);
  }
}

class DownloadedVerseText extends DataClass
    implements Insertable<DownloadedVerseText> {
  final String verseRowId;
  final String languageCode;
  final String? translatorId;
  final String? translatorSlug;
  final String? translatorName;
  final String? translatorImageUrl;
  final String? type;
  final String? meaning;
  final String? purport;
  final String? sourceRef;
  const DownloadedVerseText({
    required this.verseRowId,
    required this.languageCode,
    this.translatorId,
    this.translatorSlug,
    this.translatorName,
    this.translatorImageUrl,
    this.type,
    this.meaning,
    this.purport,
    this.sourceRef,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['verse_row_id'] = Variable<String>(verseRowId);
    map['language_code'] = Variable<String>(languageCode);
    if (!nullToAbsent || translatorId != null) {
      map['translator_id'] = Variable<String>(translatorId);
    }
    if (!nullToAbsent || translatorSlug != null) {
      map['translator_slug'] = Variable<String>(translatorSlug);
    }
    if (!nullToAbsent || translatorName != null) {
      map['translator_name'] = Variable<String>(translatorName);
    }
    if (!nullToAbsent || translatorImageUrl != null) {
      map['translator_image_url'] = Variable<String>(translatorImageUrl);
    }
    if (!nullToAbsent || type != null) {
      map['type'] = Variable<String>(type);
    }
    if (!nullToAbsent || meaning != null) {
      map['meaning'] = Variable<String>(meaning);
    }
    if (!nullToAbsent || purport != null) {
      map['purport'] = Variable<String>(purport);
    }
    if (!nullToAbsent || sourceRef != null) {
      map['source_ref'] = Variable<String>(sourceRef);
    }
    return map;
  }

  DownloadedVerseTextsCompanion toCompanion(bool nullToAbsent) {
    return DownloadedVerseTextsCompanion(
      verseRowId: Value(verseRowId),
      languageCode: Value(languageCode),
      translatorId: translatorId == null && nullToAbsent
          ? const Value.absent()
          : Value(translatorId),
      translatorSlug: translatorSlug == null && nullToAbsent
          ? const Value.absent()
          : Value(translatorSlug),
      translatorName: translatorName == null && nullToAbsent
          ? const Value.absent()
          : Value(translatorName),
      translatorImageUrl: translatorImageUrl == null && nullToAbsent
          ? const Value.absent()
          : Value(translatorImageUrl),
      type: type == null && nullToAbsent ? const Value.absent() : Value(type),
      meaning: meaning == null && nullToAbsent
          ? const Value.absent()
          : Value(meaning),
      purport: purport == null && nullToAbsent
          ? const Value.absent()
          : Value(purport),
      sourceRef: sourceRef == null && nullToAbsent
          ? const Value.absent()
          : Value(sourceRef),
    );
  }

  factory DownloadedVerseText.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DownloadedVerseText(
      verseRowId: serializer.fromJson<String>(json['verseRowId']),
      languageCode: serializer.fromJson<String>(json['languageCode']),
      translatorId: serializer.fromJson<String?>(json['translatorId']),
      translatorSlug: serializer.fromJson<String?>(json['translatorSlug']),
      translatorName: serializer.fromJson<String?>(json['translatorName']),
      translatorImageUrl: serializer.fromJson<String?>(
        json['translatorImageUrl'],
      ),
      type: serializer.fromJson<String?>(json['type']),
      meaning: serializer.fromJson<String?>(json['meaning']),
      purport: serializer.fromJson<String?>(json['purport']),
      sourceRef: serializer.fromJson<String?>(json['sourceRef']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'verseRowId': serializer.toJson<String>(verseRowId),
      'languageCode': serializer.toJson<String>(languageCode),
      'translatorId': serializer.toJson<String?>(translatorId),
      'translatorSlug': serializer.toJson<String?>(translatorSlug),
      'translatorName': serializer.toJson<String?>(translatorName),
      'translatorImageUrl': serializer.toJson<String?>(translatorImageUrl),
      'type': serializer.toJson<String?>(type),
      'meaning': serializer.toJson<String?>(meaning),
      'purport': serializer.toJson<String?>(purport),
      'sourceRef': serializer.toJson<String?>(sourceRef),
    };
  }

  DownloadedVerseText copyWith({
    String? verseRowId,
    String? languageCode,
    Value<String?> translatorId = const Value.absent(),
    Value<String?> translatorSlug = const Value.absent(),
    Value<String?> translatorName = const Value.absent(),
    Value<String?> translatorImageUrl = const Value.absent(),
    Value<String?> type = const Value.absent(),
    Value<String?> meaning = const Value.absent(),
    Value<String?> purport = const Value.absent(),
    Value<String?> sourceRef = const Value.absent(),
  }) => DownloadedVerseText(
    verseRowId: verseRowId ?? this.verseRowId,
    languageCode: languageCode ?? this.languageCode,
    translatorId: translatorId.present ? translatorId.value : this.translatorId,
    translatorSlug: translatorSlug.present
        ? translatorSlug.value
        : this.translatorSlug,
    translatorName: translatorName.present
        ? translatorName.value
        : this.translatorName,
    translatorImageUrl: translatorImageUrl.present
        ? translatorImageUrl.value
        : this.translatorImageUrl,
    type: type.present ? type.value : this.type,
    meaning: meaning.present ? meaning.value : this.meaning,
    purport: purport.present ? purport.value : this.purport,
    sourceRef: sourceRef.present ? sourceRef.value : this.sourceRef,
  );
  DownloadedVerseText copyWithCompanion(DownloadedVerseTextsCompanion data) {
    return DownloadedVerseText(
      verseRowId: data.verseRowId.present
          ? data.verseRowId.value
          : this.verseRowId,
      languageCode: data.languageCode.present
          ? data.languageCode.value
          : this.languageCode,
      translatorId: data.translatorId.present
          ? data.translatorId.value
          : this.translatorId,
      translatorSlug: data.translatorSlug.present
          ? data.translatorSlug.value
          : this.translatorSlug,
      translatorName: data.translatorName.present
          ? data.translatorName.value
          : this.translatorName,
      translatorImageUrl: data.translatorImageUrl.present
          ? data.translatorImageUrl.value
          : this.translatorImageUrl,
      type: data.type.present ? data.type.value : this.type,
      meaning: data.meaning.present ? data.meaning.value : this.meaning,
      purport: data.purport.present ? data.purport.value : this.purport,
      sourceRef: data.sourceRef.present ? data.sourceRef.value : this.sourceRef,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DownloadedVerseText(')
          ..write('verseRowId: $verseRowId, ')
          ..write('languageCode: $languageCode, ')
          ..write('translatorId: $translatorId, ')
          ..write('translatorSlug: $translatorSlug, ')
          ..write('translatorName: $translatorName, ')
          ..write('translatorImageUrl: $translatorImageUrl, ')
          ..write('type: $type, ')
          ..write('meaning: $meaning, ')
          ..write('purport: $purport, ')
          ..write('sourceRef: $sourceRef')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    verseRowId,
    languageCode,
    translatorId,
    translatorSlug,
    translatorName,
    translatorImageUrl,
    type,
    meaning,
    purport,
    sourceRef,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DownloadedVerseText &&
          other.verseRowId == this.verseRowId &&
          other.languageCode == this.languageCode &&
          other.translatorId == this.translatorId &&
          other.translatorSlug == this.translatorSlug &&
          other.translatorName == this.translatorName &&
          other.translatorImageUrl == this.translatorImageUrl &&
          other.type == this.type &&
          other.meaning == this.meaning &&
          other.purport == this.purport &&
          other.sourceRef == this.sourceRef);
}

class DownloadedVerseTextsCompanion
    extends UpdateCompanion<DownloadedVerseText> {
  final Value<String> verseRowId;
  final Value<String> languageCode;
  final Value<String?> translatorId;
  final Value<String?> translatorSlug;
  final Value<String?> translatorName;
  final Value<String?> translatorImageUrl;
  final Value<String?> type;
  final Value<String?> meaning;
  final Value<String?> purport;
  final Value<String?> sourceRef;
  final Value<int> rowid;
  const DownloadedVerseTextsCompanion({
    this.verseRowId = const Value.absent(),
    this.languageCode = const Value.absent(),
    this.translatorId = const Value.absent(),
    this.translatorSlug = const Value.absent(),
    this.translatorName = const Value.absent(),
    this.translatorImageUrl = const Value.absent(),
    this.type = const Value.absent(),
    this.meaning = const Value.absent(),
    this.purport = const Value.absent(),
    this.sourceRef = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DownloadedVerseTextsCompanion.insert({
    required String verseRowId,
    required String languageCode,
    this.translatorId = const Value.absent(),
    this.translatorSlug = const Value.absent(),
    this.translatorName = const Value.absent(),
    this.translatorImageUrl = const Value.absent(),
    this.type = const Value.absent(),
    this.meaning = const Value.absent(),
    this.purport = const Value.absent(),
    this.sourceRef = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : verseRowId = Value(verseRowId),
       languageCode = Value(languageCode);
  static Insertable<DownloadedVerseText> custom({
    Expression<String>? verseRowId,
    Expression<String>? languageCode,
    Expression<String>? translatorId,
    Expression<String>? translatorSlug,
    Expression<String>? translatorName,
    Expression<String>? translatorImageUrl,
    Expression<String>? type,
    Expression<String>? meaning,
    Expression<String>? purport,
    Expression<String>? sourceRef,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (verseRowId != null) 'verse_row_id': verseRowId,
      if (languageCode != null) 'language_code': languageCode,
      if (translatorId != null) 'translator_id': translatorId,
      if (translatorSlug != null) 'translator_slug': translatorSlug,
      if (translatorName != null) 'translator_name': translatorName,
      if (translatorImageUrl != null)
        'translator_image_url': translatorImageUrl,
      if (type != null) 'type': type,
      if (meaning != null) 'meaning': meaning,
      if (purport != null) 'purport': purport,
      if (sourceRef != null) 'source_ref': sourceRef,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DownloadedVerseTextsCompanion copyWith({
    Value<String>? verseRowId,
    Value<String>? languageCode,
    Value<String?>? translatorId,
    Value<String?>? translatorSlug,
    Value<String?>? translatorName,
    Value<String?>? translatorImageUrl,
    Value<String?>? type,
    Value<String?>? meaning,
    Value<String?>? purport,
    Value<String?>? sourceRef,
    Value<int>? rowid,
  }) {
    return DownloadedVerseTextsCompanion(
      verseRowId: verseRowId ?? this.verseRowId,
      languageCode: languageCode ?? this.languageCode,
      translatorId: translatorId ?? this.translatorId,
      translatorSlug: translatorSlug ?? this.translatorSlug,
      translatorName: translatorName ?? this.translatorName,
      translatorImageUrl: translatorImageUrl ?? this.translatorImageUrl,
      type: type ?? this.type,
      meaning: meaning ?? this.meaning,
      purport: purport ?? this.purport,
      sourceRef: sourceRef ?? this.sourceRef,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (verseRowId.present) {
      map['verse_row_id'] = Variable<String>(verseRowId.value);
    }
    if (languageCode.present) {
      map['language_code'] = Variable<String>(languageCode.value);
    }
    if (translatorId.present) {
      map['translator_id'] = Variable<String>(translatorId.value);
    }
    if (translatorSlug.present) {
      map['translator_slug'] = Variable<String>(translatorSlug.value);
    }
    if (translatorName.present) {
      map['translator_name'] = Variable<String>(translatorName.value);
    }
    if (translatorImageUrl.present) {
      map['translator_image_url'] = Variable<String>(translatorImageUrl.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
    }
    if (meaning.present) {
      map['meaning'] = Variable<String>(meaning.value);
    }
    if (purport.present) {
      map['purport'] = Variable<String>(purport.value);
    }
    if (sourceRef.present) {
      map['source_ref'] = Variable<String>(sourceRef.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DownloadedVerseTextsCompanion(')
          ..write('verseRowId: $verseRowId, ')
          ..write('languageCode: $languageCode, ')
          ..write('translatorId: $translatorId, ')
          ..write('translatorSlug: $translatorSlug, ')
          ..write('translatorName: $translatorName, ')
          ..write('translatorImageUrl: $translatorImageUrl, ')
          ..write('type: $type, ')
          ..write('meaning: $meaning, ')
          ..write('purport: $purport, ')
          ..write('sourceRef: $sourceRef, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $CantoDownloadsTable extends CantoDownloads
    with TableInfo<$CantoDownloadsTable, CantoDownload> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $CantoDownloadsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _bookIdMeta = const VerificationMeta('bookId');
  @override
  late final GeneratedColumn<String> bookId = GeneratedColumn<String>(
    'book_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _cantoNumberMeta = const VerificationMeta(
    'cantoNumber',
  );
  @override
  late final GeneratedColumn<int> cantoNumber = GeneratedColumn<int>(
    'canto_number',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _languageCodeMeta = const VerificationMeta(
    'languageCode',
  );
  @override
  late final GeneratedColumn<String> languageCode = GeneratedColumn<String>(
    'language_code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _downloadedAtMeta = const VerificationMeta(
    'downloadedAt',
  );
  @override
  late final GeneratedColumn<DateTime> downloadedAt = GeneratedColumn<DateTime>(
    'downloaded_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    bookId,
    cantoNumber,
    languageCode,
    downloadedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'canto_downloads';
  @override
  VerificationContext validateIntegrity(
    Insertable<CantoDownload> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('book_id')) {
      context.handle(
        _bookIdMeta,
        bookId.isAcceptableOrUnknown(data['book_id']!, _bookIdMeta),
      );
    } else if (isInserting) {
      context.missing(_bookIdMeta);
    }
    if (data.containsKey('canto_number')) {
      context.handle(
        _cantoNumberMeta,
        cantoNumber.isAcceptableOrUnknown(
          data['canto_number']!,
          _cantoNumberMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_cantoNumberMeta);
    }
    if (data.containsKey('language_code')) {
      context.handle(
        _languageCodeMeta,
        languageCode.isAcceptableOrUnknown(
          data['language_code']!,
          _languageCodeMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_languageCodeMeta);
    }
    if (data.containsKey('downloaded_at')) {
      context.handle(
        _downloadedAtMeta,
        downloadedAt.isAcceptableOrUnknown(
          data['downloaded_at']!,
          _downloadedAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_downloadedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {bookId, cantoNumber, languageCode};
  @override
  CantoDownload map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return CantoDownload(
      bookId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}book_id'],
      )!,
      cantoNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}canto_number'],
      )!,
      languageCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}language_code'],
      )!,
      downloadedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}downloaded_at'],
      )!,
    );
  }

  @override
  $CantoDownloadsTable createAlias(String alias) {
    return $CantoDownloadsTable(attachedDatabase, alias);
  }
}

class CantoDownload extends DataClass implements Insertable<CantoDownload> {
  final String bookId;
  final int cantoNumber;
  final String languageCode;
  final DateTime downloadedAt;
  const CantoDownload({
    required this.bookId,
    required this.cantoNumber,
    required this.languageCode,
    required this.downloadedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['book_id'] = Variable<String>(bookId);
    map['canto_number'] = Variable<int>(cantoNumber);
    map['language_code'] = Variable<String>(languageCode);
    map['downloaded_at'] = Variable<DateTime>(downloadedAt);
    return map;
  }

  CantoDownloadsCompanion toCompanion(bool nullToAbsent) {
    return CantoDownloadsCompanion(
      bookId: Value(bookId),
      cantoNumber: Value(cantoNumber),
      languageCode: Value(languageCode),
      downloadedAt: Value(downloadedAt),
    );
  }

  factory CantoDownload.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return CantoDownload(
      bookId: serializer.fromJson<String>(json['bookId']),
      cantoNumber: serializer.fromJson<int>(json['cantoNumber']),
      languageCode: serializer.fromJson<String>(json['languageCode']),
      downloadedAt: serializer.fromJson<DateTime>(json['downloadedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'bookId': serializer.toJson<String>(bookId),
      'cantoNumber': serializer.toJson<int>(cantoNumber),
      'languageCode': serializer.toJson<String>(languageCode),
      'downloadedAt': serializer.toJson<DateTime>(downloadedAt),
    };
  }

  CantoDownload copyWith({
    String? bookId,
    int? cantoNumber,
    String? languageCode,
    DateTime? downloadedAt,
  }) => CantoDownload(
    bookId: bookId ?? this.bookId,
    cantoNumber: cantoNumber ?? this.cantoNumber,
    languageCode: languageCode ?? this.languageCode,
    downloadedAt: downloadedAt ?? this.downloadedAt,
  );
  CantoDownload copyWithCompanion(CantoDownloadsCompanion data) {
    return CantoDownload(
      bookId: data.bookId.present ? data.bookId.value : this.bookId,
      cantoNumber: data.cantoNumber.present
          ? data.cantoNumber.value
          : this.cantoNumber,
      languageCode: data.languageCode.present
          ? data.languageCode.value
          : this.languageCode,
      downloadedAt: data.downloadedAt.present
          ? data.downloadedAt.value
          : this.downloadedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('CantoDownload(')
          ..write('bookId: $bookId, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('languageCode: $languageCode, ')
          ..write('downloadedAt: $downloadedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(bookId, cantoNumber, languageCode, downloadedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is CantoDownload &&
          other.bookId == this.bookId &&
          other.cantoNumber == this.cantoNumber &&
          other.languageCode == this.languageCode &&
          other.downloadedAt == this.downloadedAt);
}

class CantoDownloadsCompanion extends UpdateCompanion<CantoDownload> {
  final Value<String> bookId;
  final Value<int> cantoNumber;
  final Value<String> languageCode;
  final Value<DateTime> downloadedAt;
  final Value<int> rowid;
  const CantoDownloadsCompanion({
    this.bookId = const Value.absent(),
    this.cantoNumber = const Value.absent(),
    this.languageCode = const Value.absent(),
    this.downloadedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  CantoDownloadsCompanion.insert({
    required String bookId,
    required int cantoNumber,
    required String languageCode,
    required DateTime downloadedAt,
    this.rowid = const Value.absent(),
  }) : bookId = Value(bookId),
       cantoNumber = Value(cantoNumber),
       languageCode = Value(languageCode),
       downloadedAt = Value(downloadedAt);
  static Insertable<CantoDownload> custom({
    Expression<String>? bookId,
    Expression<int>? cantoNumber,
    Expression<String>? languageCode,
    Expression<DateTime>? downloadedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (bookId != null) 'book_id': bookId,
      if (cantoNumber != null) 'canto_number': cantoNumber,
      if (languageCode != null) 'language_code': languageCode,
      if (downloadedAt != null) 'downloaded_at': downloadedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  CantoDownloadsCompanion copyWith({
    Value<String>? bookId,
    Value<int>? cantoNumber,
    Value<String>? languageCode,
    Value<DateTime>? downloadedAt,
    Value<int>? rowid,
  }) {
    return CantoDownloadsCompanion(
      bookId: bookId ?? this.bookId,
      cantoNumber: cantoNumber ?? this.cantoNumber,
      languageCode: languageCode ?? this.languageCode,
      downloadedAt: downloadedAt ?? this.downloadedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (bookId.present) {
      map['book_id'] = Variable<String>(bookId.value);
    }
    if (cantoNumber.present) {
      map['canto_number'] = Variable<int>(cantoNumber.value);
    }
    if (languageCode.present) {
      map['language_code'] = Variable<String>(languageCode.value);
    }
    if (downloadedAt.present) {
      map['downloaded_at'] = Variable<DateTime>(downloadedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('CantoDownloadsCompanion(')
          ..write('bookId: $bookId, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('languageCode: $languageCode, ')
          ..write('downloadedAt: $downloadedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $BookDownloadsTable extends BookDownloads
    with TableInfo<$BookDownloadsTable, BookDownload> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $BookDownloadsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _bookIdMeta = const VerificationMeta('bookId');
  @override
  late final GeneratedColumn<String> bookId = GeneratedColumn<String>(
    'book_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _languageCodeMeta = const VerificationMeta(
    'languageCode',
  );
  @override
  late final GeneratedColumn<String> languageCode = GeneratedColumn<String>(
    'language_code',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _downloadedAtMeta = const VerificationMeta(
    'downloadedAt',
  );
  @override
  late final GeneratedColumn<DateTime> downloadedAt = GeneratedColumn<DateTime>(
    'downloaded_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [bookId, languageCode, downloadedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'book_downloads';
  @override
  VerificationContext validateIntegrity(
    Insertable<BookDownload> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('book_id')) {
      context.handle(
        _bookIdMeta,
        bookId.isAcceptableOrUnknown(data['book_id']!, _bookIdMeta),
      );
    } else if (isInserting) {
      context.missing(_bookIdMeta);
    }
    if (data.containsKey('language_code')) {
      context.handle(
        _languageCodeMeta,
        languageCode.isAcceptableOrUnknown(
          data['language_code']!,
          _languageCodeMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_languageCodeMeta);
    }
    if (data.containsKey('downloaded_at')) {
      context.handle(
        _downloadedAtMeta,
        downloadedAt.isAcceptableOrUnknown(
          data['downloaded_at']!,
          _downloadedAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_downloadedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {bookId, languageCode};
  @override
  BookDownload map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return BookDownload(
      bookId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}book_id'],
      )!,
      languageCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}language_code'],
      )!,
      downloadedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}downloaded_at'],
      )!,
    );
  }

  @override
  $BookDownloadsTable createAlias(String alias) {
    return $BookDownloadsTable(attachedDatabase, alias);
  }
}

class BookDownload extends DataClass implements Insertable<BookDownload> {
  final String bookId;
  final String languageCode;
  final DateTime downloadedAt;
  const BookDownload({
    required this.bookId,
    required this.languageCode,
    required this.downloadedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['book_id'] = Variable<String>(bookId);
    map['language_code'] = Variable<String>(languageCode);
    map['downloaded_at'] = Variable<DateTime>(downloadedAt);
    return map;
  }

  BookDownloadsCompanion toCompanion(bool nullToAbsent) {
    return BookDownloadsCompanion(
      bookId: Value(bookId),
      languageCode: Value(languageCode),
      downloadedAt: Value(downloadedAt),
    );
  }

  factory BookDownload.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return BookDownload(
      bookId: serializer.fromJson<String>(json['bookId']),
      languageCode: serializer.fromJson<String>(json['languageCode']),
      downloadedAt: serializer.fromJson<DateTime>(json['downloadedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'bookId': serializer.toJson<String>(bookId),
      'languageCode': serializer.toJson<String>(languageCode),
      'downloadedAt': serializer.toJson<DateTime>(downloadedAt),
    };
  }

  BookDownload copyWith({
    String? bookId,
    String? languageCode,
    DateTime? downloadedAt,
  }) => BookDownload(
    bookId: bookId ?? this.bookId,
    languageCode: languageCode ?? this.languageCode,
    downloadedAt: downloadedAt ?? this.downloadedAt,
  );
  BookDownload copyWithCompanion(BookDownloadsCompanion data) {
    return BookDownload(
      bookId: data.bookId.present ? data.bookId.value : this.bookId,
      languageCode: data.languageCode.present
          ? data.languageCode.value
          : this.languageCode,
      downloadedAt: data.downloadedAt.present
          ? data.downloadedAt.value
          : this.downloadedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('BookDownload(')
          ..write('bookId: $bookId, ')
          ..write('languageCode: $languageCode, ')
          ..write('downloadedAt: $downloadedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(bookId, languageCode, downloadedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BookDownload &&
          other.bookId == this.bookId &&
          other.languageCode == this.languageCode &&
          other.downloadedAt == this.downloadedAt);
}

class BookDownloadsCompanion extends UpdateCompanion<BookDownload> {
  final Value<String> bookId;
  final Value<String> languageCode;
  final Value<DateTime> downloadedAt;
  final Value<int> rowid;
  const BookDownloadsCompanion({
    this.bookId = const Value.absent(),
    this.languageCode = const Value.absent(),
    this.downloadedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  BookDownloadsCompanion.insert({
    required String bookId,
    required String languageCode,
    required DateTime downloadedAt,
    this.rowid = const Value.absent(),
  }) : bookId = Value(bookId),
       languageCode = Value(languageCode),
       downloadedAt = Value(downloadedAt);
  static Insertable<BookDownload> custom({
    Expression<String>? bookId,
    Expression<String>? languageCode,
    Expression<DateTime>? downloadedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (bookId != null) 'book_id': bookId,
      if (languageCode != null) 'language_code': languageCode,
      if (downloadedAt != null) 'downloaded_at': downloadedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  BookDownloadsCompanion copyWith({
    Value<String>? bookId,
    Value<String>? languageCode,
    Value<DateTime>? downloadedAt,
    Value<int>? rowid,
  }) {
    return BookDownloadsCompanion(
      bookId: bookId ?? this.bookId,
      languageCode: languageCode ?? this.languageCode,
      downloadedAt: downloadedAt ?? this.downloadedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (bookId.present) {
      map['book_id'] = Variable<String>(bookId.value);
    }
    if (languageCode.present) {
      map['language_code'] = Variable<String>(languageCode.value);
    }
    if (downloadedAt.present) {
      map['downloaded_at'] = Variable<DateTime>(downloadedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('BookDownloadsCompanion(')
          ..write('bookId: $bookId, ')
          ..write('languageCode: $languageCode, ')
          ..write('downloadedAt: $downloadedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $DownloadedBooksTable downloadedBooks = $DownloadedBooksTable(
    this,
  );
  late final $DownloadedChaptersTable downloadedChapters =
      $DownloadedChaptersTable(this);
  late final $DownloadedVersesTable downloadedVerses = $DownloadedVersesTable(
    this,
  );
  late final $DownloadedVerseTextsTable downloadedVerseTexts =
      $DownloadedVerseTextsTable(this);
  late final $CantoDownloadsTable cantoDownloads = $CantoDownloadsTable(this);
  late final $BookDownloadsTable bookDownloads = $BookDownloadsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    downloadedBooks,
    downloadedChapters,
    downloadedVerses,
    downloadedVerseTexts,
    cantoDownloads,
    bookDownloads,
  ];
}

typedef $$DownloadedBooksTableCreateCompanionBuilder =
    DownloadedBooksCompanion Function({
      required String id,
      required String slug,
      required String title,
      required int bookNumber,
      Value<int> rowid,
    });
typedef $$DownloadedBooksTableUpdateCompanionBuilder =
    DownloadedBooksCompanion Function({
      Value<String> id,
      Value<String> slug,
      Value<String> title,
      Value<int> bookNumber,
      Value<int> rowid,
    });

class $$DownloadedBooksTableFilterComposer
    extends Composer<_$AppDatabase, $DownloadedBooksTable> {
  $$DownloadedBooksTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get slug => $composableBuilder(
    column: $table.slug,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get bookNumber => $composableBuilder(
    column: $table.bookNumber,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DownloadedBooksTableOrderingComposer
    extends Composer<_$AppDatabase, $DownloadedBooksTable> {
  $$DownloadedBooksTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get slug => $composableBuilder(
    column: $table.slug,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get bookNumber => $composableBuilder(
    column: $table.bookNumber,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DownloadedBooksTableAnnotationComposer
    extends Composer<_$AppDatabase, $DownloadedBooksTable> {
  $$DownloadedBooksTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get slug =>
      $composableBuilder(column: $table.slug, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<int> get bookNumber => $composableBuilder(
    column: $table.bookNumber,
    builder: (column) => column,
  );
}

class $$DownloadedBooksTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DownloadedBooksTable,
          DownloadedBook,
          $$DownloadedBooksTableFilterComposer,
          $$DownloadedBooksTableOrderingComposer,
          $$DownloadedBooksTableAnnotationComposer,
          $$DownloadedBooksTableCreateCompanionBuilder,
          $$DownloadedBooksTableUpdateCompanionBuilder,
          (
            DownloadedBook,
            BaseReferences<
              _$AppDatabase,
              $DownloadedBooksTable,
              DownloadedBook
            >,
          ),
          DownloadedBook,
          PrefetchHooks Function()
        > {
  $$DownloadedBooksTableTableManager(
    _$AppDatabase db,
    $DownloadedBooksTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DownloadedBooksTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DownloadedBooksTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DownloadedBooksTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> slug = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<int> bookNumber = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DownloadedBooksCompanion(
                id: id,
                slug: slug,
                title: title,
                bookNumber: bookNumber,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String slug,
                required String title,
                required int bookNumber,
                Value<int> rowid = const Value.absent(),
              }) => DownloadedBooksCompanion.insert(
                id: id,
                slug: slug,
                title: title,
                bookNumber: bookNumber,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$DownloadedBooksTable, DownloadedBook>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $DownloadedBooksTable,
                    DownloadedBook
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DownloadedBooksTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DownloadedBooksTable,
      DownloadedBook,
      $$DownloadedBooksTableFilterComposer,
      $$DownloadedBooksTableOrderingComposer,
      $$DownloadedBooksTableAnnotationComposer,
      $$DownloadedBooksTableCreateCompanionBuilder,
      $$DownloadedBooksTableUpdateCompanionBuilder,
      (
        DownloadedBook,
        BaseReferences<_$AppDatabase, $DownloadedBooksTable, DownloadedBook>,
      ),
      DownloadedBook,
      PrefetchHooks Function()
    >;
typedef $$DownloadedChaptersTableCreateCompanionBuilder =
    DownloadedChaptersCompanion Function({
      required String id,
      required String bookId,
      Value<int?> cantoNumber,
      required int number,
      required String title,
      Value<String?> summary,
      Value<int> totalVerses,
      Value<int> rowid,
    });
typedef $$DownloadedChaptersTableUpdateCompanionBuilder =
    DownloadedChaptersCompanion Function({
      Value<String> id,
      Value<String> bookId,
      Value<int?> cantoNumber,
      Value<int> number,
      Value<String> title,
      Value<String?> summary,
      Value<int> totalVerses,
      Value<int> rowid,
    });

class $$DownloadedChaptersTableFilterComposer
    extends Composer<_$AppDatabase, $DownloadedChaptersTable> {
  $$DownloadedChaptersTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get bookId => $composableBuilder(
    column: $table.bookId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get number => $composableBuilder(
    column: $table.number,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get summary => $composableBuilder(
    column: $table.summary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get totalVerses => $composableBuilder(
    column: $table.totalVerses,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DownloadedChaptersTableOrderingComposer
    extends Composer<_$AppDatabase, $DownloadedChaptersTable> {
  $$DownloadedChaptersTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get bookId => $composableBuilder(
    column: $table.bookId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get number => $composableBuilder(
    column: $table.number,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get summary => $composableBuilder(
    column: $table.summary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get totalVerses => $composableBuilder(
    column: $table.totalVerses,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DownloadedChaptersTableAnnotationComposer
    extends Composer<_$AppDatabase, $DownloadedChaptersTable> {
  $$DownloadedChaptersTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get bookId =>
      $composableBuilder(column: $table.bookId, builder: (column) => column);

  GeneratedColumn<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => column,
  );

  GeneratedColumn<int> get number =>
      $composableBuilder(column: $table.number, builder: (column) => column);

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get summary =>
      $composableBuilder(column: $table.summary, builder: (column) => column);

  GeneratedColumn<int> get totalVerses => $composableBuilder(
    column: $table.totalVerses,
    builder: (column) => column,
  );
}

class $$DownloadedChaptersTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DownloadedChaptersTable,
          DownloadedChapter,
          $$DownloadedChaptersTableFilterComposer,
          $$DownloadedChaptersTableOrderingComposer,
          $$DownloadedChaptersTableAnnotationComposer,
          $$DownloadedChaptersTableCreateCompanionBuilder,
          $$DownloadedChaptersTableUpdateCompanionBuilder,
          (
            DownloadedChapter,
            BaseReferences<
              _$AppDatabase,
              $DownloadedChaptersTable,
              DownloadedChapter
            >,
          ),
          DownloadedChapter,
          PrefetchHooks Function()
        > {
  $$DownloadedChaptersTableTableManager(
    _$AppDatabase db,
    $DownloadedChaptersTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DownloadedChaptersTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DownloadedChaptersTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DownloadedChaptersTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> bookId = const Value.absent(),
                Value<int?> cantoNumber = const Value.absent(),
                Value<int> number = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String?> summary = const Value.absent(),
                Value<int> totalVerses = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DownloadedChaptersCompanion(
                id: id,
                bookId: bookId,
                cantoNumber: cantoNumber,
                number: number,
                title: title,
                summary: summary,
                totalVerses: totalVerses,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String bookId,
                Value<int?> cantoNumber = const Value.absent(),
                required int number,
                required String title,
                Value<String?> summary = const Value.absent(),
                Value<int> totalVerses = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DownloadedChaptersCompanion.insert(
                id: id,
                bookId: bookId,
                cantoNumber: cantoNumber,
                number: number,
                title: title,
                summary: summary,
                totalVerses: totalVerses,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$DownloadedChaptersTable, DownloadedChapter>(
                    table,
                  ),
                  BaseReferences<
                    _$AppDatabase,
                    $DownloadedChaptersTable,
                    DownloadedChapter
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DownloadedChaptersTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DownloadedChaptersTable,
      DownloadedChapter,
      $$DownloadedChaptersTableFilterComposer,
      $$DownloadedChaptersTableOrderingComposer,
      $$DownloadedChaptersTableAnnotationComposer,
      $$DownloadedChaptersTableCreateCompanionBuilder,
      $$DownloadedChaptersTableUpdateCompanionBuilder,
      (
        DownloadedChapter,
        BaseReferences<
          _$AppDatabase,
          $DownloadedChaptersTable,
          DownloadedChapter
        >,
      ),
      DownloadedChapter,
      PrefetchHooks Function()
    >;
typedef $$DownloadedVersesTableCreateCompanionBuilder =
    DownloadedVersesCompanion Function({
      required String id,
      required String verseId,
      required String bookId,
      Value<String?> chapterId,
      required int bookNumber,
      Value<String?> type,
      Value<int?> cantoNumber,
      Value<int?> chapterNumber,
      Value<int?> verseNumber,
      Value<int?> verseNumberEnd,
      Value<String?> sanskrit,
      Value<String?> transliteration,
      Value<String?> wordMeanings,
      Value<String?> tagsJson,
      Value<int> rowid,
    });
typedef $$DownloadedVersesTableUpdateCompanionBuilder =
    DownloadedVersesCompanion Function({
      Value<String> id,
      Value<String> verseId,
      Value<String> bookId,
      Value<String?> chapterId,
      Value<int> bookNumber,
      Value<String?> type,
      Value<int?> cantoNumber,
      Value<int?> chapterNumber,
      Value<int?> verseNumber,
      Value<int?> verseNumberEnd,
      Value<String?> sanskrit,
      Value<String?> transliteration,
      Value<String?> wordMeanings,
      Value<String?> tagsJson,
      Value<int> rowid,
    });

class $$DownloadedVersesTableFilterComposer
    extends Composer<_$AppDatabase, $DownloadedVersesTable> {
  $$DownloadedVersesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get verseId => $composableBuilder(
    column: $table.verseId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get bookId => $composableBuilder(
    column: $table.bookId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get chapterId => $composableBuilder(
    column: $table.chapterId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get bookNumber => $composableBuilder(
    column: $table.bookNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get chapterNumber => $composableBuilder(
    column: $table.chapterNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get verseNumber => $composableBuilder(
    column: $table.verseNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get verseNumberEnd => $composableBuilder(
    column: $table.verseNumberEnd,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sanskrit => $composableBuilder(
    column: $table.sanskrit,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get transliteration => $composableBuilder(
    column: $table.transliteration,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get wordMeanings => $composableBuilder(
    column: $table.wordMeanings,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get tagsJson => $composableBuilder(
    column: $table.tagsJson,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DownloadedVersesTableOrderingComposer
    extends Composer<_$AppDatabase, $DownloadedVersesTable> {
  $$DownloadedVersesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get verseId => $composableBuilder(
    column: $table.verseId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get bookId => $composableBuilder(
    column: $table.bookId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get chapterId => $composableBuilder(
    column: $table.chapterId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get bookNumber => $composableBuilder(
    column: $table.bookNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get chapterNumber => $composableBuilder(
    column: $table.chapterNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get verseNumber => $composableBuilder(
    column: $table.verseNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get verseNumberEnd => $composableBuilder(
    column: $table.verseNumberEnd,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sanskrit => $composableBuilder(
    column: $table.sanskrit,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get transliteration => $composableBuilder(
    column: $table.transliteration,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get wordMeanings => $composableBuilder(
    column: $table.wordMeanings,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get tagsJson => $composableBuilder(
    column: $table.tagsJson,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DownloadedVersesTableAnnotationComposer
    extends Composer<_$AppDatabase, $DownloadedVersesTable> {
  $$DownloadedVersesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get verseId =>
      $composableBuilder(column: $table.verseId, builder: (column) => column);

  GeneratedColumn<String> get bookId =>
      $composableBuilder(column: $table.bookId, builder: (column) => column);

  GeneratedColumn<String> get chapterId =>
      $composableBuilder(column: $table.chapterId, builder: (column) => column);

  GeneratedColumn<int> get bookNumber => $composableBuilder(
    column: $table.bookNumber,
    builder: (column) => column,
  );

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => column,
  );

  GeneratedColumn<int> get chapterNumber => $composableBuilder(
    column: $table.chapterNumber,
    builder: (column) => column,
  );

  GeneratedColumn<int> get verseNumber => $composableBuilder(
    column: $table.verseNumber,
    builder: (column) => column,
  );

  GeneratedColumn<int> get verseNumberEnd => $composableBuilder(
    column: $table.verseNumberEnd,
    builder: (column) => column,
  );

  GeneratedColumn<String> get sanskrit =>
      $composableBuilder(column: $table.sanskrit, builder: (column) => column);

  GeneratedColumn<String> get transliteration => $composableBuilder(
    column: $table.transliteration,
    builder: (column) => column,
  );

  GeneratedColumn<String> get wordMeanings => $composableBuilder(
    column: $table.wordMeanings,
    builder: (column) => column,
  );

  GeneratedColumn<String> get tagsJson =>
      $composableBuilder(column: $table.tagsJson, builder: (column) => column);
}

class $$DownloadedVersesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DownloadedVersesTable,
          DownloadedVerse,
          $$DownloadedVersesTableFilterComposer,
          $$DownloadedVersesTableOrderingComposer,
          $$DownloadedVersesTableAnnotationComposer,
          $$DownloadedVersesTableCreateCompanionBuilder,
          $$DownloadedVersesTableUpdateCompanionBuilder,
          (
            DownloadedVerse,
            BaseReferences<
              _$AppDatabase,
              $DownloadedVersesTable,
              DownloadedVerse
            >,
          ),
          DownloadedVerse,
          PrefetchHooks Function()
        > {
  $$DownloadedVersesTableTableManager(
    _$AppDatabase db,
    $DownloadedVersesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DownloadedVersesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DownloadedVersesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DownloadedVersesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> verseId = const Value.absent(),
                Value<String> bookId = const Value.absent(),
                Value<String?> chapterId = const Value.absent(),
                Value<int> bookNumber = const Value.absent(),
                Value<String?> type = const Value.absent(),
                Value<int?> cantoNumber = const Value.absent(),
                Value<int?> chapterNumber = const Value.absent(),
                Value<int?> verseNumber = const Value.absent(),
                Value<int?> verseNumberEnd = const Value.absent(),
                Value<String?> sanskrit = const Value.absent(),
                Value<String?> transliteration = const Value.absent(),
                Value<String?> wordMeanings = const Value.absent(),
                Value<String?> tagsJson = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DownloadedVersesCompanion(
                id: id,
                verseId: verseId,
                bookId: bookId,
                chapterId: chapterId,
                bookNumber: bookNumber,
                type: type,
                cantoNumber: cantoNumber,
                chapterNumber: chapterNumber,
                verseNumber: verseNumber,
                verseNumberEnd: verseNumberEnd,
                sanskrit: sanskrit,
                transliteration: transliteration,
                wordMeanings: wordMeanings,
                tagsJson: tagsJson,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String verseId,
                required String bookId,
                Value<String?> chapterId = const Value.absent(),
                required int bookNumber,
                Value<String?> type = const Value.absent(),
                Value<int?> cantoNumber = const Value.absent(),
                Value<int?> chapterNumber = const Value.absent(),
                Value<int?> verseNumber = const Value.absent(),
                Value<int?> verseNumberEnd = const Value.absent(),
                Value<String?> sanskrit = const Value.absent(),
                Value<String?> transliteration = const Value.absent(),
                Value<String?> wordMeanings = const Value.absent(),
                Value<String?> tagsJson = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DownloadedVersesCompanion.insert(
                id: id,
                verseId: verseId,
                bookId: bookId,
                chapterId: chapterId,
                bookNumber: bookNumber,
                type: type,
                cantoNumber: cantoNumber,
                chapterNumber: chapterNumber,
                verseNumber: verseNumber,
                verseNumberEnd: verseNumberEnd,
                sanskrit: sanskrit,
                transliteration: transliteration,
                wordMeanings: wordMeanings,
                tagsJson: tagsJson,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$DownloadedVersesTable, DownloadedVerse>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $DownloadedVersesTable,
                    DownloadedVerse
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DownloadedVersesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DownloadedVersesTable,
      DownloadedVerse,
      $$DownloadedVersesTableFilterComposer,
      $$DownloadedVersesTableOrderingComposer,
      $$DownloadedVersesTableAnnotationComposer,
      $$DownloadedVersesTableCreateCompanionBuilder,
      $$DownloadedVersesTableUpdateCompanionBuilder,
      (
        DownloadedVerse,
        BaseReferences<_$AppDatabase, $DownloadedVersesTable, DownloadedVerse>,
      ),
      DownloadedVerse,
      PrefetchHooks Function()
    >;
typedef $$DownloadedVerseTextsTableCreateCompanionBuilder =
    DownloadedVerseTextsCompanion Function({
      required String verseRowId,
      required String languageCode,
      Value<String?> translatorId,
      Value<String?> translatorSlug,
      Value<String?> translatorName,
      Value<String?> translatorImageUrl,
      Value<String?> type,
      Value<String?> meaning,
      Value<String?> purport,
      Value<String?> sourceRef,
      Value<int> rowid,
    });
typedef $$DownloadedVerseTextsTableUpdateCompanionBuilder =
    DownloadedVerseTextsCompanion Function({
      Value<String> verseRowId,
      Value<String> languageCode,
      Value<String?> translatorId,
      Value<String?> translatorSlug,
      Value<String?> translatorName,
      Value<String?> translatorImageUrl,
      Value<String?> type,
      Value<String?> meaning,
      Value<String?> purport,
      Value<String?> sourceRef,
      Value<int> rowid,
    });

class $$DownloadedVerseTextsTableFilterComposer
    extends Composer<_$AppDatabase, $DownloadedVerseTextsTable> {
  $$DownloadedVerseTextsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get verseRowId => $composableBuilder(
    column: $table.verseRowId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get translatorId => $composableBuilder(
    column: $table.translatorId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get translatorSlug => $composableBuilder(
    column: $table.translatorSlug,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get translatorName => $composableBuilder(
    column: $table.translatorName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get translatorImageUrl => $composableBuilder(
    column: $table.translatorImageUrl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get meaning => $composableBuilder(
    column: $table.meaning,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get purport => $composableBuilder(
    column: $table.purport,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get sourceRef => $composableBuilder(
    column: $table.sourceRef,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DownloadedVerseTextsTableOrderingComposer
    extends Composer<_$AppDatabase, $DownloadedVerseTextsTable> {
  $$DownloadedVerseTextsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get verseRowId => $composableBuilder(
    column: $table.verseRowId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get translatorId => $composableBuilder(
    column: $table.translatorId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get translatorSlug => $composableBuilder(
    column: $table.translatorSlug,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get translatorName => $composableBuilder(
    column: $table.translatorName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get translatorImageUrl => $composableBuilder(
    column: $table.translatorImageUrl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get meaning => $composableBuilder(
    column: $table.meaning,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get purport => $composableBuilder(
    column: $table.purport,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get sourceRef => $composableBuilder(
    column: $table.sourceRef,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DownloadedVerseTextsTableAnnotationComposer
    extends Composer<_$AppDatabase, $DownloadedVerseTextsTable> {
  $$DownloadedVerseTextsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get verseRowId => $composableBuilder(
    column: $table.verseRowId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => column,
  );

  GeneratedColumn<String> get translatorId => $composableBuilder(
    column: $table.translatorId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get translatorSlug => $composableBuilder(
    column: $table.translatorSlug,
    builder: (column) => column,
  );

  GeneratedColumn<String> get translatorName => $composableBuilder(
    column: $table.translatorName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get translatorImageUrl => $composableBuilder(
    column: $table.translatorImageUrl,
    builder: (column) => column,
  );

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

  GeneratedColumn<String> get meaning =>
      $composableBuilder(column: $table.meaning, builder: (column) => column);

  GeneratedColumn<String> get purport =>
      $composableBuilder(column: $table.purport, builder: (column) => column);

  GeneratedColumn<String> get sourceRef =>
      $composableBuilder(column: $table.sourceRef, builder: (column) => column);
}

class $$DownloadedVerseTextsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DownloadedVerseTextsTable,
          DownloadedVerseText,
          $$DownloadedVerseTextsTableFilterComposer,
          $$DownloadedVerseTextsTableOrderingComposer,
          $$DownloadedVerseTextsTableAnnotationComposer,
          $$DownloadedVerseTextsTableCreateCompanionBuilder,
          $$DownloadedVerseTextsTableUpdateCompanionBuilder,
          (
            DownloadedVerseText,
            BaseReferences<
              _$AppDatabase,
              $DownloadedVerseTextsTable,
              DownloadedVerseText
            >,
          ),
          DownloadedVerseText,
          PrefetchHooks Function()
        > {
  $$DownloadedVerseTextsTableTableManager(
    _$AppDatabase db,
    $DownloadedVerseTextsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DownloadedVerseTextsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DownloadedVerseTextsTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$DownloadedVerseTextsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> verseRowId = const Value.absent(),
                Value<String> languageCode = const Value.absent(),
                Value<String?> translatorId = const Value.absent(),
                Value<String?> translatorSlug = const Value.absent(),
                Value<String?> translatorName = const Value.absent(),
                Value<String?> translatorImageUrl = const Value.absent(),
                Value<String?> type = const Value.absent(),
                Value<String?> meaning = const Value.absent(),
                Value<String?> purport = const Value.absent(),
                Value<String?> sourceRef = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DownloadedVerseTextsCompanion(
                verseRowId: verseRowId,
                languageCode: languageCode,
                translatorId: translatorId,
                translatorSlug: translatorSlug,
                translatorName: translatorName,
                translatorImageUrl: translatorImageUrl,
                type: type,
                meaning: meaning,
                purport: purport,
                sourceRef: sourceRef,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String verseRowId,
                required String languageCode,
                Value<String?> translatorId = const Value.absent(),
                Value<String?> translatorSlug = const Value.absent(),
                Value<String?> translatorName = const Value.absent(),
                Value<String?> translatorImageUrl = const Value.absent(),
                Value<String?> type = const Value.absent(),
                Value<String?> meaning = const Value.absent(),
                Value<String?> purport = const Value.absent(),
                Value<String?> sourceRef = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DownloadedVerseTextsCompanion.insert(
                verseRowId: verseRowId,
                languageCode: languageCode,
                translatorId: translatorId,
                translatorSlug: translatorSlug,
                translatorName: translatorName,
                translatorImageUrl: translatorImageUrl,
                type: type,
                meaning: meaning,
                purport: purport,
                sourceRef: sourceRef,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$DownloadedVerseTextsTable, DownloadedVerseText>(
                    table,
                  ),
                  BaseReferences<
                    _$AppDatabase,
                    $DownloadedVerseTextsTable,
                    DownloadedVerseText
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DownloadedVerseTextsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DownloadedVerseTextsTable,
      DownloadedVerseText,
      $$DownloadedVerseTextsTableFilterComposer,
      $$DownloadedVerseTextsTableOrderingComposer,
      $$DownloadedVerseTextsTableAnnotationComposer,
      $$DownloadedVerseTextsTableCreateCompanionBuilder,
      $$DownloadedVerseTextsTableUpdateCompanionBuilder,
      (
        DownloadedVerseText,
        BaseReferences<
          _$AppDatabase,
          $DownloadedVerseTextsTable,
          DownloadedVerseText
        >,
      ),
      DownloadedVerseText,
      PrefetchHooks Function()
    >;
typedef $$CantoDownloadsTableCreateCompanionBuilder =
    CantoDownloadsCompanion Function({
      required String bookId,
      required int cantoNumber,
      required String languageCode,
      required DateTime downloadedAt,
      Value<int> rowid,
    });
typedef $$CantoDownloadsTableUpdateCompanionBuilder =
    CantoDownloadsCompanion Function({
      Value<String> bookId,
      Value<int> cantoNumber,
      Value<String> languageCode,
      Value<DateTime> downloadedAt,
      Value<int> rowid,
    });

class $$CantoDownloadsTableFilterComposer
    extends Composer<_$AppDatabase, $CantoDownloadsTable> {
  $$CantoDownloadsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get bookId => $composableBuilder(
    column: $table.bookId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$CantoDownloadsTableOrderingComposer
    extends Composer<_$AppDatabase, $CantoDownloadsTable> {
  $$CantoDownloadsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get bookId => $composableBuilder(
    column: $table.bookId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$CantoDownloadsTableAnnotationComposer
    extends Composer<_$AppDatabase, $CantoDownloadsTable> {
  $$CantoDownloadsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get bookId =>
      $composableBuilder(column: $table.bookId, builder: (column) => column);

  GeneratedColumn<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => column,
  );

  GeneratedColumn<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => column,
  );
}

class $$CantoDownloadsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $CantoDownloadsTable,
          CantoDownload,
          $$CantoDownloadsTableFilterComposer,
          $$CantoDownloadsTableOrderingComposer,
          $$CantoDownloadsTableAnnotationComposer,
          $$CantoDownloadsTableCreateCompanionBuilder,
          $$CantoDownloadsTableUpdateCompanionBuilder,
          (
            CantoDownload,
            BaseReferences<_$AppDatabase, $CantoDownloadsTable, CantoDownload>,
          ),
          CantoDownload,
          PrefetchHooks Function()
        > {
  $$CantoDownloadsTableTableManager(
    _$AppDatabase db,
    $CantoDownloadsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$CantoDownloadsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$CantoDownloadsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$CantoDownloadsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> bookId = const Value.absent(),
                Value<int> cantoNumber = const Value.absent(),
                Value<String> languageCode = const Value.absent(),
                Value<DateTime> downloadedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => CantoDownloadsCompanion(
                bookId: bookId,
                cantoNumber: cantoNumber,
                languageCode: languageCode,
                downloadedAt: downloadedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String bookId,
                required int cantoNumber,
                required String languageCode,
                required DateTime downloadedAt,
                Value<int> rowid = const Value.absent(),
              }) => CantoDownloadsCompanion.insert(
                bookId: bookId,
                cantoNumber: cantoNumber,
                languageCode: languageCode,
                downloadedAt: downloadedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$CantoDownloadsTable, CantoDownload>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $CantoDownloadsTable,
                    CantoDownload
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$CantoDownloadsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $CantoDownloadsTable,
      CantoDownload,
      $$CantoDownloadsTableFilterComposer,
      $$CantoDownloadsTableOrderingComposer,
      $$CantoDownloadsTableAnnotationComposer,
      $$CantoDownloadsTableCreateCompanionBuilder,
      $$CantoDownloadsTableUpdateCompanionBuilder,
      (
        CantoDownload,
        BaseReferences<_$AppDatabase, $CantoDownloadsTable, CantoDownload>,
      ),
      CantoDownload,
      PrefetchHooks Function()
    >;
typedef $$BookDownloadsTableCreateCompanionBuilder =
    BookDownloadsCompanion Function({
      required String bookId,
      required String languageCode,
      required DateTime downloadedAt,
      Value<int> rowid,
    });
typedef $$BookDownloadsTableUpdateCompanionBuilder =
    BookDownloadsCompanion Function({
      Value<String> bookId,
      Value<String> languageCode,
      Value<DateTime> downloadedAt,
      Value<int> rowid,
    });

class $$BookDownloadsTableFilterComposer
    extends Composer<_$AppDatabase, $BookDownloadsTable> {
  $$BookDownloadsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get bookId => $composableBuilder(
    column: $table.bookId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$BookDownloadsTableOrderingComposer
    extends Composer<_$AppDatabase, $BookDownloadsTable> {
  $$BookDownloadsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get bookId => $composableBuilder(
    column: $table.bookId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$BookDownloadsTableAnnotationComposer
    extends Composer<_$AppDatabase, $BookDownloadsTable> {
  $$BookDownloadsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get bookId =>
      $composableBuilder(column: $table.bookId, builder: (column) => column);

  GeneratedColumn<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => column,
  );
}

class $$BookDownloadsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $BookDownloadsTable,
          BookDownload,
          $$BookDownloadsTableFilterComposer,
          $$BookDownloadsTableOrderingComposer,
          $$BookDownloadsTableAnnotationComposer,
          $$BookDownloadsTableCreateCompanionBuilder,
          $$BookDownloadsTableUpdateCompanionBuilder,
          (
            BookDownload,
            BaseReferences<_$AppDatabase, $BookDownloadsTable, BookDownload>,
          ),
          BookDownload,
          PrefetchHooks Function()
        > {
  $$BookDownloadsTableTableManager(_$AppDatabase db, $BookDownloadsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$BookDownloadsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$BookDownloadsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$BookDownloadsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> bookId = const Value.absent(),
                Value<String> languageCode = const Value.absent(),
                Value<DateTime> downloadedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => BookDownloadsCompanion(
                bookId: bookId,
                languageCode: languageCode,
                downloadedAt: downloadedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String bookId,
                required String languageCode,
                required DateTime downloadedAt,
                Value<int> rowid = const Value.absent(),
              }) => BookDownloadsCompanion.insert(
                bookId: bookId,
                languageCode: languageCode,
                downloadedAt: downloadedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$BookDownloadsTable, BookDownload>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $BookDownloadsTable,
                    BookDownload
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$BookDownloadsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $BookDownloadsTable,
      BookDownload,
      $$BookDownloadsTableFilterComposer,
      $$BookDownloadsTableOrderingComposer,
      $$BookDownloadsTableAnnotationComposer,
      $$BookDownloadsTableCreateCompanionBuilder,
      $$BookDownloadsTableUpdateCompanionBuilder,
      (
        BookDownload,
        BaseReferences<_$AppDatabase, $BookDownloadsTable, BookDownload>,
      ),
      BookDownload,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$DownloadedBooksTableTableManager get downloadedBooks =>
      $$DownloadedBooksTableTableManager(_db, _db.downloadedBooks);
  $$DownloadedChaptersTableTableManager get downloadedChapters =>
      $$DownloadedChaptersTableTableManager(_db, _db.downloadedChapters);
  $$DownloadedVersesTableTableManager get downloadedVerses =>
      $$DownloadedVersesTableTableManager(_db, _db.downloadedVerses);
  $$DownloadedVerseTextsTableTableManager get downloadedVerseTexts =>
      $$DownloadedVerseTextsTableTableManager(_db, _db.downloadedVerseTexts);
  $$CantoDownloadsTableTableManager get cantoDownloads =>
      $$CantoDownloadsTableTableManager(_db, _db.cantoDownloads);
  $$BookDownloadsTableTableManager get bookDownloads =>
      $$BookDownloadsTableTableManager(_db, _db.bookDownloads);
}
