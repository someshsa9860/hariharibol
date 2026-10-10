// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'app_database.dart';

// ignore_for_file: type=lint
class $BooksTable extends Books with TableInfo<$BooksTable, BookRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $BooksTable(this.attachedDatabase, [this._alias]);
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
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
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
  static const VerificationMeta _titleI18nMeta = const VerificationMeta(
    'titleI18n',
  );
  @override
  late final GeneratedColumn<String> titleI18n = GeneratedColumn<String>(
    'title_i18n',
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
  static const VerificationMeta _unitTypeMeta = const VerificationMeta(
    'unitType',
  );
  @override
  late final GeneratedColumn<String> unitType = GeneratedColumn<String>(
    'unit_type',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _totalUnitsMeta = const VerificationMeta(
    'totalUnits',
  );
  @override
  late final GeneratedColumn<int> totalUnits = GeneratedColumn<int>(
    'total_units',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    slug,
    title,
    titleI18n,
    bookNumber,
    unitType,
    totalUnits,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'books';
  @override
  VerificationContext validateIntegrity(
    Insertable<BookRecord> instance, {
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
    if (data.containsKey('title_i18n')) {
      context.handle(
        _titleI18nMeta,
        titleI18n.isAcceptableOrUnknown(data['title_i18n']!, _titleI18nMeta),
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
    if (data.containsKey('unit_type')) {
      context.handle(
        _unitTypeMeta,
        unitType.isAcceptableOrUnknown(data['unit_type']!, _unitTypeMeta),
      );
    }
    if (data.containsKey('total_units')) {
      context.handle(
        _totalUnitsMeta,
        totalUnits.isAcceptableOrUnknown(data['total_units']!, _totalUnitsMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  BookRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return BookRecord(
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
      titleI18n: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title_i18n'],
      ),
      bookNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}book_number'],
      )!,
      unitType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}unit_type'],
      ),
      totalUnits: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_units'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $BooksTable createAlias(String alias) {
    return $BooksTable(attachedDatabase, alias);
  }
}

class BookRecord extends DataClass implements Insertable<BookRecord> {
  final String id;
  final String slug;
  final String title;

  /// `{ "hi": "…" }` as JSON text, or null.
  final String? titleI18n;
  final int bookNumber;

  /// `chapter`, `canto`, or null when the book is not cut into download units
  /// (a short work, saved whole from the API).
  final String? unitType;

  /// How many units the server's manifest lists — what "n of m downloaded" is
  /// measured against.
  final int totalUnits;
  final DateTime updatedAt;
  const BookRecord({
    required this.id,
    required this.slug,
    required this.title,
    this.titleI18n,
    required this.bookNumber,
    this.unitType,
    required this.totalUnits,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['slug'] = Variable<String>(slug);
    map['title'] = Variable<String>(title);
    if (!nullToAbsent || titleI18n != null) {
      map['title_i18n'] = Variable<String>(titleI18n);
    }
    map['book_number'] = Variable<int>(bookNumber);
    if (!nullToAbsent || unitType != null) {
      map['unit_type'] = Variable<String>(unitType);
    }
    map['total_units'] = Variable<int>(totalUnits);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  BooksCompanion toCompanion(bool nullToAbsent) {
    return BooksCompanion(
      id: Value(id),
      slug: Value(slug),
      title: Value(title),
      titleI18n: titleI18n == null && nullToAbsent
          ? const Value.absent()
          : Value(titleI18n),
      bookNumber: Value(bookNumber),
      unitType: unitType == null && nullToAbsent
          ? const Value.absent()
          : Value(unitType),
      totalUnits: Value(totalUnits),
      updatedAt: Value(updatedAt),
    );
  }

  factory BookRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return BookRecord(
      id: serializer.fromJson<String>(json['id']),
      slug: serializer.fromJson<String>(json['slug']),
      title: serializer.fromJson<String>(json['title']),
      titleI18n: serializer.fromJson<String?>(json['titleI18n']),
      bookNumber: serializer.fromJson<int>(json['bookNumber']),
      unitType: serializer.fromJson<String?>(json['unitType']),
      totalUnits: serializer.fromJson<int>(json['totalUnits']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'slug': serializer.toJson<String>(slug),
      'title': serializer.toJson<String>(title),
      'titleI18n': serializer.toJson<String?>(titleI18n),
      'bookNumber': serializer.toJson<int>(bookNumber),
      'unitType': serializer.toJson<String?>(unitType),
      'totalUnits': serializer.toJson<int>(totalUnits),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  BookRecord copyWith({
    String? id,
    String? slug,
    String? title,
    Value<String?> titleI18n = const Value.absent(),
    int? bookNumber,
    Value<String?> unitType = const Value.absent(),
    int? totalUnits,
    DateTime? updatedAt,
  }) => BookRecord(
    id: id ?? this.id,
    slug: slug ?? this.slug,
    title: title ?? this.title,
    titleI18n: titleI18n.present ? titleI18n.value : this.titleI18n,
    bookNumber: bookNumber ?? this.bookNumber,
    unitType: unitType.present ? unitType.value : this.unitType,
    totalUnits: totalUnits ?? this.totalUnits,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  BookRecord copyWithCompanion(BooksCompanion data) {
    return BookRecord(
      id: data.id.present ? data.id.value : this.id,
      slug: data.slug.present ? data.slug.value : this.slug,
      title: data.title.present ? data.title.value : this.title,
      titleI18n: data.titleI18n.present ? data.titleI18n.value : this.titleI18n,
      bookNumber: data.bookNumber.present
          ? data.bookNumber.value
          : this.bookNumber,
      unitType: data.unitType.present ? data.unitType.value : this.unitType,
      totalUnits: data.totalUnits.present
          ? data.totalUnits.value
          : this.totalUnits,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('BookRecord(')
          ..write('id: $id, ')
          ..write('slug: $slug, ')
          ..write('title: $title, ')
          ..write('titleI18n: $titleI18n, ')
          ..write('bookNumber: $bookNumber, ')
          ..write('unitType: $unitType, ')
          ..write('totalUnits: $totalUnits, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    slug,
    title,
    titleI18n,
    bookNumber,
    unitType,
    totalUnits,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BookRecord &&
          other.id == this.id &&
          other.slug == this.slug &&
          other.title == this.title &&
          other.titleI18n == this.titleI18n &&
          other.bookNumber == this.bookNumber &&
          other.unitType == this.unitType &&
          other.totalUnits == this.totalUnits &&
          other.updatedAt == this.updatedAt);
}

class BooksCompanion extends UpdateCompanion<BookRecord> {
  final Value<String> id;
  final Value<String> slug;
  final Value<String> title;
  final Value<String?> titleI18n;
  final Value<int> bookNumber;
  final Value<String?> unitType;
  final Value<int> totalUnits;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const BooksCompanion({
    this.id = const Value.absent(),
    this.slug = const Value.absent(),
    this.title = const Value.absent(),
    this.titleI18n = const Value.absent(),
    this.bookNumber = const Value.absent(),
    this.unitType = const Value.absent(),
    this.totalUnits = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  BooksCompanion.insert({
    required String id,
    required String slug,
    required String title,
    this.titleI18n = const Value.absent(),
    required int bookNumber,
    this.unitType = const Value.absent(),
    this.totalUnits = const Value.absent(),
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       slug = Value(slug),
       title = Value(title),
       bookNumber = Value(bookNumber),
       updatedAt = Value(updatedAt);
  static Insertable<BookRecord> custom({
    Expression<String>? id,
    Expression<String>? slug,
    Expression<String>? title,
    Expression<String>? titleI18n,
    Expression<int>? bookNumber,
    Expression<String>? unitType,
    Expression<int>? totalUnits,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (slug != null) 'slug': slug,
      if (title != null) 'title': title,
      if (titleI18n != null) 'title_i18n': titleI18n,
      if (bookNumber != null) 'book_number': bookNumber,
      if (unitType != null) 'unit_type': unitType,
      if (totalUnits != null) 'total_units': totalUnits,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  BooksCompanion copyWith({
    Value<String>? id,
    Value<String>? slug,
    Value<String>? title,
    Value<String?>? titleI18n,
    Value<int>? bookNumber,
    Value<String?>? unitType,
    Value<int>? totalUnits,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return BooksCompanion(
      id: id ?? this.id,
      slug: slug ?? this.slug,
      title: title ?? this.title,
      titleI18n: titleI18n ?? this.titleI18n,
      bookNumber: bookNumber ?? this.bookNumber,
      unitType: unitType ?? this.unitType,
      totalUnits: totalUnits ?? this.totalUnits,
      updatedAt: updatedAt ?? this.updatedAt,
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
    if (titleI18n.present) {
      map['title_i18n'] = Variable<String>(titleI18n.value);
    }
    if (bookNumber.present) {
      map['book_number'] = Variable<int>(bookNumber.value);
    }
    if (unitType.present) {
      map['unit_type'] = Variable<String>(unitType.value);
    }
    if (totalUnits.present) {
      map['total_units'] = Variable<int>(totalUnits.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('BooksCompanion(')
          ..write('id: $id, ')
          ..write('slug: $slug, ')
          ..write('title: $title, ')
          ..write('titleI18n: $titleI18n, ')
          ..write('bookNumber: $bookNumber, ')
          ..write('unitType: $unitType, ')
          ..write('totalUnits: $totalUnits, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $UnitsTable extends Units with TableInfo<$UnitsTable, UnitRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $UnitsTable(this.attachedDatabase, [this._alias]);
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
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
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
  static const VerificationMeta _downloadUnitIdMeta = const VerificationMeta(
    'downloadUnitId',
  );
  @override
  late final GeneratedColumn<String> downloadUnitId = GeneratedColumn<String>(
    'download_unit_id',
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
  static const VerificationMeta _titleI18nMeta = const VerificationMeta(
    'titleI18n',
  );
  @override
  late final GeneratedColumn<String> titleI18n = GeneratedColumn<String>(
    'title_i18n',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
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
  static const VerificationMeta _summaryI18nMeta = const VerificationMeta(
    'summaryI18n',
  );
  @override
  late final GeneratedColumn<String> summaryI18n = GeneratedColumn<String>(
    'summary_i18n',
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
    kind,
    number,
    cantoNumber,
    downloadUnitId,
    title,
    titleI18n,
    summary,
    summaryI18n,
    totalVerses,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'units';
  @override
  VerificationContext validateIntegrity(
    Insertable<UnitRecord> instance, {
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
    if (data.containsKey('kind')) {
      context.handle(
        _kindMeta,
        kind.isAcceptableOrUnknown(data['kind']!, _kindMeta),
      );
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('number')) {
      context.handle(
        _numberMeta,
        number.isAcceptableOrUnknown(data['number']!, _numberMeta),
      );
    } else if (isInserting) {
      context.missing(_numberMeta);
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
    if (data.containsKey('download_unit_id')) {
      context.handle(
        _downloadUnitIdMeta,
        downloadUnitId.isAcceptableOrUnknown(
          data['download_unit_id']!,
          _downloadUnitIdMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_downloadUnitIdMeta);
    }
    if (data.containsKey('title')) {
      context.handle(
        _titleMeta,
        title.isAcceptableOrUnknown(data['title']!, _titleMeta),
      );
    } else if (isInserting) {
      context.missing(_titleMeta);
    }
    if (data.containsKey('title_i18n')) {
      context.handle(
        _titleI18nMeta,
        titleI18n.isAcceptableOrUnknown(data['title_i18n']!, _titleI18nMeta),
      );
    }
    if (data.containsKey('summary')) {
      context.handle(
        _summaryMeta,
        summary.isAcceptableOrUnknown(data['summary']!, _summaryMeta),
      );
    }
    if (data.containsKey('summary_i18n')) {
      context.handle(
        _summaryI18nMeta,
        summaryI18n.isAcceptableOrUnknown(
          data['summary_i18n']!,
          _summaryI18nMeta,
        ),
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
  UnitRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return UnitRecord(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      bookId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}book_id'],
      )!,
      kind: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kind'],
      )!,
      number: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}number'],
      )!,
      cantoNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}canto_number'],
      ),
      downloadUnitId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}download_unit_id'],
      )!,
      title: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title'],
      )!,
      titleI18n: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}title_i18n'],
      ),
      summary: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}summary'],
      ),
      summaryI18n: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}summary_i18n'],
      ),
      totalVerses: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total_verses'],
      )!,
    );
  }

  @override
  $UnitsTable createAlias(String alias) {
    return $UnitsTable(attachedDatabase, alias);
  }
}

class UnitRecord extends DataClass implements Insertable<UnitRecord> {
  final String id;
  final String bookId;

  /// `canto` or `chapter`.
  final String kind;
  final int number;
  final int? cantoNumber;
  final String downloadUnitId;
  final String title;
  final String? titleI18n;
  final String? summary;
  final String? summaryI18n;
  final int totalVerses;
  const UnitRecord({
    required this.id,
    required this.bookId,
    required this.kind,
    required this.number,
    this.cantoNumber,
    required this.downloadUnitId,
    required this.title,
    this.titleI18n,
    this.summary,
    this.summaryI18n,
    required this.totalVerses,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['book_id'] = Variable<String>(bookId);
    map['kind'] = Variable<String>(kind);
    map['number'] = Variable<int>(number);
    if (!nullToAbsent || cantoNumber != null) {
      map['canto_number'] = Variable<int>(cantoNumber);
    }
    map['download_unit_id'] = Variable<String>(downloadUnitId);
    map['title'] = Variable<String>(title);
    if (!nullToAbsent || titleI18n != null) {
      map['title_i18n'] = Variable<String>(titleI18n);
    }
    if (!nullToAbsent || summary != null) {
      map['summary'] = Variable<String>(summary);
    }
    if (!nullToAbsent || summaryI18n != null) {
      map['summary_i18n'] = Variable<String>(summaryI18n);
    }
    map['total_verses'] = Variable<int>(totalVerses);
    return map;
  }

  UnitsCompanion toCompanion(bool nullToAbsent) {
    return UnitsCompanion(
      id: Value(id),
      bookId: Value(bookId),
      kind: Value(kind),
      number: Value(number),
      cantoNumber: cantoNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(cantoNumber),
      downloadUnitId: Value(downloadUnitId),
      title: Value(title),
      titleI18n: titleI18n == null && nullToAbsent
          ? const Value.absent()
          : Value(titleI18n),
      summary: summary == null && nullToAbsent
          ? const Value.absent()
          : Value(summary),
      summaryI18n: summaryI18n == null && nullToAbsent
          ? const Value.absent()
          : Value(summaryI18n),
      totalVerses: Value(totalVerses),
    );
  }

  factory UnitRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return UnitRecord(
      id: serializer.fromJson<String>(json['id']),
      bookId: serializer.fromJson<String>(json['bookId']),
      kind: serializer.fromJson<String>(json['kind']),
      number: serializer.fromJson<int>(json['number']),
      cantoNumber: serializer.fromJson<int?>(json['cantoNumber']),
      downloadUnitId: serializer.fromJson<String>(json['downloadUnitId']),
      title: serializer.fromJson<String>(json['title']),
      titleI18n: serializer.fromJson<String?>(json['titleI18n']),
      summary: serializer.fromJson<String?>(json['summary']),
      summaryI18n: serializer.fromJson<String?>(json['summaryI18n']),
      totalVerses: serializer.fromJson<int>(json['totalVerses']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'bookId': serializer.toJson<String>(bookId),
      'kind': serializer.toJson<String>(kind),
      'number': serializer.toJson<int>(number),
      'cantoNumber': serializer.toJson<int?>(cantoNumber),
      'downloadUnitId': serializer.toJson<String>(downloadUnitId),
      'title': serializer.toJson<String>(title),
      'titleI18n': serializer.toJson<String?>(titleI18n),
      'summary': serializer.toJson<String?>(summary),
      'summaryI18n': serializer.toJson<String?>(summaryI18n),
      'totalVerses': serializer.toJson<int>(totalVerses),
    };
  }

  UnitRecord copyWith({
    String? id,
    String? bookId,
    String? kind,
    int? number,
    Value<int?> cantoNumber = const Value.absent(),
    String? downloadUnitId,
    String? title,
    Value<String?> titleI18n = const Value.absent(),
    Value<String?> summary = const Value.absent(),
    Value<String?> summaryI18n = const Value.absent(),
    int? totalVerses,
  }) => UnitRecord(
    id: id ?? this.id,
    bookId: bookId ?? this.bookId,
    kind: kind ?? this.kind,
    number: number ?? this.number,
    cantoNumber: cantoNumber.present ? cantoNumber.value : this.cantoNumber,
    downloadUnitId: downloadUnitId ?? this.downloadUnitId,
    title: title ?? this.title,
    titleI18n: titleI18n.present ? titleI18n.value : this.titleI18n,
    summary: summary.present ? summary.value : this.summary,
    summaryI18n: summaryI18n.present ? summaryI18n.value : this.summaryI18n,
    totalVerses: totalVerses ?? this.totalVerses,
  );
  UnitRecord copyWithCompanion(UnitsCompanion data) {
    return UnitRecord(
      id: data.id.present ? data.id.value : this.id,
      bookId: data.bookId.present ? data.bookId.value : this.bookId,
      kind: data.kind.present ? data.kind.value : this.kind,
      number: data.number.present ? data.number.value : this.number,
      cantoNumber: data.cantoNumber.present
          ? data.cantoNumber.value
          : this.cantoNumber,
      downloadUnitId: data.downloadUnitId.present
          ? data.downloadUnitId.value
          : this.downloadUnitId,
      title: data.title.present ? data.title.value : this.title,
      titleI18n: data.titleI18n.present ? data.titleI18n.value : this.titleI18n,
      summary: data.summary.present ? data.summary.value : this.summary,
      summaryI18n: data.summaryI18n.present
          ? data.summaryI18n.value
          : this.summaryI18n,
      totalVerses: data.totalVerses.present
          ? data.totalVerses.value
          : this.totalVerses,
    );
  }

  @override
  String toString() {
    return (StringBuffer('UnitRecord(')
          ..write('id: $id, ')
          ..write('bookId: $bookId, ')
          ..write('kind: $kind, ')
          ..write('number: $number, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('downloadUnitId: $downloadUnitId, ')
          ..write('title: $title, ')
          ..write('titleI18n: $titleI18n, ')
          ..write('summary: $summary, ')
          ..write('summaryI18n: $summaryI18n, ')
          ..write('totalVerses: $totalVerses')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    bookId,
    kind,
    number,
    cantoNumber,
    downloadUnitId,
    title,
    titleI18n,
    summary,
    summaryI18n,
    totalVerses,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is UnitRecord &&
          other.id == this.id &&
          other.bookId == this.bookId &&
          other.kind == this.kind &&
          other.number == this.number &&
          other.cantoNumber == this.cantoNumber &&
          other.downloadUnitId == this.downloadUnitId &&
          other.title == this.title &&
          other.titleI18n == this.titleI18n &&
          other.summary == this.summary &&
          other.summaryI18n == this.summaryI18n &&
          other.totalVerses == this.totalVerses);
}

class UnitsCompanion extends UpdateCompanion<UnitRecord> {
  final Value<String> id;
  final Value<String> bookId;
  final Value<String> kind;
  final Value<int> number;
  final Value<int?> cantoNumber;
  final Value<String> downloadUnitId;
  final Value<String> title;
  final Value<String?> titleI18n;
  final Value<String?> summary;
  final Value<String?> summaryI18n;
  final Value<int> totalVerses;
  final Value<int> rowid;
  const UnitsCompanion({
    this.id = const Value.absent(),
    this.bookId = const Value.absent(),
    this.kind = const Value.absent(),
    this.number = const Value.absent(),
    this.cantoNumber = const Value.absent(),
    this.downloadUnitId = const Value.absent(),
    this.title = const Value.absent(),
    this.titleI18n = const Value.absent(),
    this.summary = const Value.absent(),
    this.summaryI18n = const Value.absent(),
    this.totalVerses = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  UnitsCompanion.insert({
    required String id,
    required String bookId,
    required String kind,
    required int number,
    this.cantoNumber = const Value.absent(),
    required String downloadUnitId,
    required String title,
    this.titleI18n = const Value.absent(),
    this.summary = const Value.absent(),
    this.summaryI18n = const Value.absent(),
    this.totalVerses = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       bookId = Value(bookId),
       kind = Value(kind),
       number = Value(number),
       downloadUnitId = Value(downloadUnitId),
       title = Value(title);
  static Insertable<UnitRecord> custom({
    Expression<String>? id,
    Expression<String>? bookId,
    Expression<String>? kind,
    Expression<int>? number,
    Expression<int>? cantoNumber,
    Expression<String>? downloadUnitId,
    Expression<String>? title,
    Expression<String>? titleI18n,
    Expression<String>? summary,
    Expression<String>? summaryI18n,
    Expression<int>? totalVerses,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (bookId != null) 'book_id': bookId,
      if (kind != null) 'kind': kind,
      if (number != null) 'number': number,
      if (cantoNumber != null) 'canto_number': cantoNumber,
      if (downloadUnitId != null) 'download_unit_id': downloadUnitId,
      if (title != null) 'title': title,
      if (titleI18n != null) 'title_i18n': titleI18n,
      if (summary != null) 'summary': summary,
      if (summaryI18n != null) 'summary_i18n': summaryI18n,
      if (totalVerses != null) 'total_verses': totalVerses,
      if (rowid != null) 'rowid': rowid,
    });
  }

  UnitsCompanion copyWith({
    Value<String>? id,
    Value<String>? bookId,
    Value<String>? kind,
    Value<int>? number,
    Value<int?>? cantoNumber,
    Value<String>? downloadUnitId,
    Value<String>? title,
    Value<String?>? titleI18n,
    Value<String?>? summary,
    Value<String?>? summaryI18n,
    Value<int>? totalVerses,
    Value<int>? rowid,
  }) {
    return UnitsCompanion(
      id: id ?? this.id,
      bookId: bookId ?? this.bookId,
      kind: kind ?? this.kind,
      number: number ?? this.number,
      cantoNumber: cantoNumber ?? this.cantoNumber,
      downloadUnitId: downloadUnitId ?? this.downloadUnitId,
      title: title ?? this.title,
      titleI18n: titleI18n ?? this.titleI18n,
      summary: summary ?? this.summary,
      summaryI18n: summaryI18n ?? this.summaryI18n,
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
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (number.present) {
      map['number'] = Variable<int>(number.value);
    }
    if (cantoNumber.present) {
      map['canto_number'] = Variable<int>(cantoNumber.value);
    }
    if (downloadUnitId.present) {
      map['download_unit_id'] = Variable<String>(downloadUnitId.value);
    }
    if (title.present) {
      map['title'] = Variable<String>(title.value);
    }
    if (titleI18n.present) {
      map['title_i18n'] = Variable<String>(titleI18n.value);
    }
    if (summary.present) {
      map['summary'] = Variable<String>(summary.value);
    }
    if (summaryI18n.present) {
      map['summary_i18n'] = Variable<String>(summaryI18n.value);
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
    return (StringBuffer('UnitsCompanion(')
          ..write('id: $id, ')
          ..write('bookId: $bookId, ')
          ..write('kind: $kind, ')
          ..write('number: $number, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('downloadUnitId: $downloadUnitId, ')
          ..write('title: $title, ')
          ..write('titleI18n: $titleI18n, ')
          ..write('summary: $summary, ')
          ..write('summaryI18n: $summaryI18n, ')
          ..write('totalVerses: $totalVerses, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $VersesTable extends Verses with TableInfo<$VersesTable, VerseRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $VersesTable(this.attachedDatabase, [this._alias]);
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
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
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
  static const VerificationMeta _unitIdMeta = const VerificationMeta('unitId');
  @override
  late final GeneratedColumn<String> unitId = GeneratedColumn<String>(
    'unit_id',
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
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
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
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('SHLOKA'),
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
  static const VerificationMeta _audioPathMeta = const VerificationMeta(
    'audioPath',
  );
  @override
  late final GeneratedColumn<String> audioPath = GeneratedColumn<String>(
    'audio_path',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _audioUrlMeta = const VerificationMeta(
    'audioUrl',
  );
  @override
  late final GeneratedColumn<String> audioUrl = GeneratedColumn<String>(
    'audio_url',
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
    unitId,
    chapterId,
    cantoNumber,
    chapterNumber,
    verseNumber,
    verseNumberEnd,
    type,
    sanskrit,
    transliteration,
    wordMeanings,
    audioPath,
    audioUrl,
    tagsJson,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'verses';
  @override
  VerificationContext validateIntegrity(
    Insertable<VerseRecord> instance, {
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
    if (data.containsKey('unit_id')) {
      context.handle(
        _unitIdMeta,
        unitId.isAcceptableOrUnknown(data['unit_id']!, _unitIdMeta),
      );
    } else if (isInserting) {
      context.missing(_unitIdMeta);
    }
    if (data.containsKey('chapter_id')) {
      context.handle(
        _chapterIdMeta,
        chapterId.isAcceptableOrUnknown(data['chapter_id']!, _chapterIdMeta),
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
    } else if (isInserting) {
      context.missing(_verseNumberMeta);
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
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
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
    if (data.containsKey('audio_path')) {
      context.handle(
        _audioPathMeta,
        audioPath.isAcceptableOrUnknown(data['audio_path']!, _audioPathMeta),
      );
    }
    if (data.containsKey('audio_url')) {
      context.handle(
        _audioUrlMeta,
        audioUrl.isAcceptableOrUnknown(data['audio_url']!, _audioUrlMeta),
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
  VerseRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return VerseRecord(
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
      unitId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}unit_id'],
      )!,
      chapterId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}chapter_id'],
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
      )!,
      verseNumberEnd: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}verse_number_end'],
      ),
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
      )!,
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
      audioPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}audio_path'],
      ),
      audioUrl: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}audio_url'],
      ),
      tagsJson: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}tags_json'],
      ),
    );
  }

  @override
  $VersesTable createAlias(String alias) {
    return $VersesTable(attachedDatabase, alias);
  }
}

class VerseRecord extends DataClass implements Insertable<VerseRecord> {
  final String id;
  final String verseId;
  final String bookId;

  /// The download unit this verse was delivered in. For a short work saved from
  /// the API it is `short:<bookId>`.
  final String unitId;
  final String? chapterId;
  final int? cantoNumber;
  final int? chapterNumber;
  final int verseNumber;
  final int? verseNumberEnd;
  final String type;
  final String? sanskrit;
  final String? transliteration;

  /// JSON text: `[{ "word": …, "meaning": … }]`. Language-neutral.
  final String? wordMeanings;

  /// An S3 key from the offline file; a playable link needs `/audio-urls`.
  final String? audioPath;

  /// A playable link, when the verse came from an API response that had one.
  final String? audioUrl;
  final String? tagsJson;
  const VerseRecord({
    required this.id,
    required this.verseId,
    required this.bookId,
    required this.unitId,
    this.chapterId,
    this.cantoNumber,
    this.chapterNumber,
    required this.verseNumber,
    this.verseNumberEnd,
    required this.type,
    this.sanskrit,
    this.transliteration,
    this.wordMeanings,
    this.audioPath,
    this.audioUrl,
    this.tagsJson,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['verse_id'] = Variable<String>(verseId);
    map['book_id'] = Variable<String>(bookId);
    map['unit_id'] = Variable<String>(unitId);
    if (!nullToAbsent || chapterId != null) {
      map['chapter_id'] = Variable<String>(chapterId);
    }
    if (!nullToAbsent || cantoNumber != null) {
      map['canto_number'] = Variable<int>(cantoNumber);
    }
    if (!nullToAbsent || chapterNumber != null) {
      map['chapter_number'] = Variable<int>(chapterNumber);
    }
    map['verse_number'] = Variable<int>(verseNumber);
    if (!nullToAbsent || verseNumberEnd != null) {
      map['verse_number_end'] = Variable<int>(verseNumberEnd);
    }
    map['type'] = Variable<String>(type);
    if (!nullToAbsent || sanskrit != null) {
      map['sanskrit'] = Variable<String>(sanskrit);
    }
    if (!nullToAbsent || transliteration != null) {
      map['transliteration'] = Variable<String>(transliteration);
    }
    if (!nullToAbsent || wordMeanings != null) {
      map['word_meanings'] = Variable<String>(wordMeanings);
    }
    if (!nullToAbsent || audioPath != null) {
      map['audio_path'] = Variable<String>(audioPath);
    }
    if (!nullToAbsent || audioUrl != null) {
      map['audio_url'] = Variable<String>(audioUrl);
    }
    if (!nullToAbsent || tagsJson != null) {
      map['tags_json'] = Variable<String>(tagsJson);
    }
    return map;
  }

  VersesCompanion toCompanion(bool nullToAbsent) {
    return VersesCompanion(
      id: Value(id),
      verseId: Value(verseId),
      bookId: Value(bookId),
      unitId: Value(unitId),
      chapterId: chapterId == null && nullToAbsent
          ? const Value.absent()
          : Value(chapterId),
      cantoNumber: cantoNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(cantoNumber),
      chapterNumber: chapterNumber == null && nullToAbsent
          ? const Value.absent()
          : Value(chapterNumber),
      verseNumber: Value(verseNumber),
      verseNumberEnd: verseNumberEnd == null && nullToAbsent
          ? const Value.absent()
          : Value(verseNumberEnd),
      type: Value(type),
      sanskrit: sanskrit == null && nullToAbsent
          ? const Value.absent()
          : Value(sanskrit),
      transliteration: transliteration == null && nullToAbsent
          ? const Value.absent()
          : Value(transliteration),
      wordMeanings: wordMeanings == null && nullToAbsent
          ? const Value.absent()
          : Value(wordMeanings),
      audioPath: audioPath == null && nullToAbsent
          ? const Value.absent()
          : Value(audioPath),
      audioUrl: audioUrl == null && nullToAbsent
          ? const Value.absent()
          : Value(audioUrl),
      tagsJson: tagsJson == null && nullToAbsent
          ? const Value.absent()
          : Value(tagsJson),
    );
  }

  factory VerseRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return VerseRecord(
      id: serializer.fromJson<String>(json['id']),
      verseId: serializer.fromJson<String>(json['verseId']),
      bookId: serializer.fromJson<String>(json['bookId']),
      unitId: serializer.fromJson<String>(json['unitId']),
      chapterId: serializer.fromJson<String?>(json['chapterId']),
      cantoNumber: serializer.fromJson<int?>(json['cantoNumber']),
      chapterNumber: serializer.fromJson<int?>(json['chapterNumber']),
      verseNumber: serializer.fromJson<int>(json['verseNumber']),
      verseNumberEnd: serializer.fromJson<int?>(json['verseNumberEnd']),
      type: serializer.fromJson<String>(json['type']),
      sanskrit: serializer.fromJson<String?>(json['sanskrit']),
      transliteration: serializer.fromJson<String?>(json['transliteration']),
      wordMeanings: serializer.fromJson<String?>(json['wordMeanings']),
      audioPath: serializer.fromJson<String?>(json['audioPath']),
      audioUrl: serializer.fromJson<String?>(json['audioUrl']),
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
      'unitId': serializer.toJson<String>(unitId),
      'chapterId': serializer.toJson<String?>(chapterId),
      'cantoNumber': serializer.toJson<int?>(cantoNumber),
      'chapterNumber': serializer.toJson<int?>(chapterNumber),
      'verseNumber': serializer.toJson<int>(verseNumber),
      'verseNumberEnd': serializer.toJson<int?>(verseNumberEnd),
      'type': serializer.toJson<String>(type),
      'sanskrit': serializer.toJson<String?>(sanskrit),
      'transliteration': serializer.toJson<String?>(transliteration),
      'wordMeanings': serializer.toJson<String?>(wordMeanings),
      'audioPath': serializer.toJson<String?>(audioPath),
      'audioUrl': serializer.toJson<String?>(audioUrl),
      'tagsJson': serializer.toJson<String?>(tagsJson),
    };
  }

  VerseRecord copyWith({
    String? id,
    String? verseId,
    String? bookId,
    String? unitId,
    Value<String?> chapterId = const Value.absent(),
    Value<int?> cantoNumber = const Value.absent(),
    Value<int?> chapterNumber = const Value.absent(),
    int? verseNumber,
    Value<int?> verseNumberEnd = const Value.absent(),
    String? type,
    Value<String?> sanskrit = const Value.absent(),
    Value<String?> transliteration = const Value.absent(),
    Value<String?> wordMeanings = const Value.absent(),
    Value<String?> audioPath = const Value.absent(),
    Value<String?> audioUrl = const Value.absent(),
    Value<String?> tagsJson = const Value.absent(),
  }) => VerseRecord(
    id: id ?? this.id,
    verseId: verseId ?? this.verseId,
    bookId: bookId ?? this.bookId,
    unitId: unitId ?? this.unitId,
    chapterId: chapterId.present ? chapterId.value : this.chapterId,
    cantoNumber: cantoNumber.present ? cantoNumber.value : this.cantoNumber,
    chapterNumber: chapterNumber.present
        ? chapterNumber.value
        : this.chapterNumber,
    verseNumber: verseNumber ?? this.verseNumber,
    verseNumberEnd: verseNumberEnd.present
        ? verseNumberEnd.value
        : this.verseNumberEnd,
    type: type ?? this.type,
    sanskrit: sanskrit.present ? sanskrit.value : this.sanskrit,
    transliteration: transliteration.present
        ? transliteration.value
        : this.transliteration,
    wordMeanings: wordMeanings.present ? wordMeanings.value : this.wordMeanings,
    audioPath: audioPath.present ? audioPath.value : this.audioPath,
    audioUrl: audioUrl.present ? audioUrl.value : this.audioUrl,
    tagsJson: tagsJson.present ? tagsJson.value : this.tagsJson,
  );
  VerseRecord copyWithCompanion(VersesCompanion data) {
    return VerseRecord(
      id: data.id.present ? data.id.value : this.id,
      verseId: data.verseId.present ? data.verseId.value : this.verseId,
      bookId: data.bookId.present ? data.bookId.value : this.bookId,
      unitId: data.unitId.present ? data.unitId.value : this.unitId,
      chapterId: data.chapterId.present ? data.chapterId.value : this.chapterId,
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
      type: data.type.present ? data.type.value : this.type,
      sanskrit: data.sanskrit.present ? data.sanskrit.value : this.sanskrit,
      transliteration: data.transliteration.present
          ? data.transliteration.value
          : this.transliteration,
      wordMeanings: data.wordMeanings.present
          ? data.wordMeanings.value
          : this.wordMeanings,
      audioPath: data.audioPath.present ? data.audioPath.value : this.audioPath,
      audioUrl: data.audioUrl.present ? data.audioUrl.value : this.audioUrl,
      tagsJson: data.tagsJson.present ? data.tagsJson.value : this.tagsJson,
    );
  }

  @override
  String toString() {
    return (StringBuffer('VerseRecord(')
          ..write('id: $id, ')
          ..write('verseId: $verseId, ')
          ..write('bookId: $bookId, ')
          ..write('unitId: $unitId, ')
          ..write('chapterId: $chapterId, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('chapterNumber: $chapterNumber, ')
          ..write('verseNumber: $verseNumber, ')
          ..write('verseNumberEnd: $verseNumberEnd, ')
          ..write('type: $type, ')
          ..write('sanskrit: $sanskrit, ')
          ..write('transliteration: $transliteration, ')
          ..write('wordMeanings: $wordMeanings, ')
          ..write('audioPath: $audioPath, ')
          ..write('audioUrl: $audioUrl, ')
          ..write('tagsJson: $tagsJson')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    verseId,
    bookId,
    unitId,
    chapterId,
    cantoNumber,
    chapterNumber,
    verseNumber,
    verseNumberEnd,
    type,
    sanskrit,
    transliteration,
    wordMeanings,
    audioPath,
    audioUrl,
    tagsJson,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is VerseRecord &&
          other.id == this.id &&
          other.verseId == this.verseId &&
          other.bookId == this.bookId &&
          other.unitId == this.unitId &&
          other.chapterId == this.chapterId &&
          other.cantoNumber == this.cantoNumber &&
          other.chapterNumber == this.chapterNumber &&
          other.verseNumber == this.verseNumber &&
          other.verseNumberEnd == this.verseNumberEnd &&
          other.type == this.type &&
          other.sanskrit == this.sanskrit &&
          other.transliteration == this.transliteration &&
          other.wordMeanings == this.wordMeanings &&
          other.audioPath == this.audioPath &&
          other.audioUrl == this.audioUrl &&
          other.tagsJson == this.tagsJson);
}

class VersesCompanion extends UpdateCompanion<VerseRecord> {
  final Value<String> id;
  final Value<String> verseId;
  final Value<String> bookId;
  final Value<String> unitId;
  final Value<String?> chapterId;
  final Value<int?> cantoNumber;
  final Value<int?> chapterNumber;
  final Value<int> verseNumber;
  final Value<int?> verseNumberEnd;
  final Value<String> type;
  final Value<String?> sanskrit;
  final Value<String?> transliteration;
  final Value<String?> wordMeanings;
  final Value<String?> audioPath;
  final Value<String?> audioUrl;
  final Value<String?> tagsJson;
  final Value<int> rowid;
  const VersesCompanion({
    this.id = const Value.absent(),
    this.verseId = const Value.absent(),
    this.bookId = const Value.absent(),
    this.unitId = const Value.absent(),
    this.chapterId = const Value.absent(),
    this.cantoNumber = const Value.absent(),
    this.chapterNumber = const Value.absent(),
    this.verseNumber = const Value.absent(),
    this.verseNumberEnd = const Value.absent(),
    this.type = const Value.absent(),
    this.sanskrit = const Value.absent(),
    this.transliteration = const Value.absent(),
    this.wordMeanings = const Value.absent(),
    this.audioPath = const Value.absent(),
    this.audioUrl = const Value.absent(),
    this.tagsJson = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  VersesCompanion.insert({
    required String id,
    required String verseId,
    required String bookId,
    required String unitId,
    this.chapterId = const Value.absent(),
    this.cantoNumber = const Value.absent(),
    this.chapterNumber = const Value.absent(),
    required int verseNumber,
    this.verseNumberEnd = const Value.absent(),
    this.type = const Value.absent(),
    this.sanskrit = const Value.absent(),
    this.transliteration = const Value.absent(),
    this.wordMeanings = const Value.absent(),
    this.audioPath = const Value.absent(),
    this.audioUrl = const Value.absent(),
    this.tagsJson = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       verseId = Value(verseId),
       bookId = Value(bookId),
       unitId = Value(unitId),
       verseNumber = Value(verseNumber);
  static Insertable<VerseRecord> custom({
    Expression<String>? id,
    Expression<String>? verseId,
    Expression<String>? bookId,
    Expression<String>? unitId,
    Expression<String>? chapterId,
    Expression<int>? cantoNumber,
    Expression<int>? chapterNumber,
    Expression<int>? verseNumber,
    Expression<int>? verseNumberEnd,
    Expression<String>? type,
    Expression<String>? sanskrit,
    Expression<String>? transliteration,
    Expression<String>? wordMeanings,
    Expression<String>? audioPath,
    Expression<String>? audioUrl,
    Expression<String>? tagsJson,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (verseId != null) 'verse_id': verseId,
      if (bookId != null) 'book_id': bookId,
      if (unitId != null) 'unit_id': unitId,
      if (chapterId != null) 'chapter_id': chapterId,
      if (cantoNumber != null) 'canto_number': cantoNumber,
      if (chapterNumber != null) 'chapter_number': chapterNumber,
      if (verseNumber != null) 'verse_number': verseNumber,
      if (verseNumberEnd != null) 'verse_number_end': verseNumberEnd,
      if (type != null) 'type': type,
      if (sanskrit != null) 'sanskrit': sanskrit,
      if (transliteration != null) 'transliteration': transliteration,
      if (wordMeanings != null) 'word_meanings': wordMeanings,
      if (audioPath != null) 'audio_path': audioPath,
      if (audioUrl != null) 'audio_url': audioUrl,
      if (tagsJson != null) 'tags_json': tagsJson,
      if (rowid != null) 'rowid': rowid,
    });
  }

  VersesCompanion copyWith({
    Value<String>? id,
    Value<String>? verseId,
    Value<String>? bookId,
    Value<String>? unitId,
    Value<String?>? chapterId,
    Value<int?>? cantoNumber,
    Value<int?>? chapterNumber,
    Value<int>? verseNumber,
    Value<int?>? verseNumberEnd,
    Value<String>? type,
    Value<String?>? sanskrit,
    Value<String?>? transliteration,
    Value<String?>? wordMeanings,
    Value<String?>? audioPath,
    Value<String?>? audioUrl,
    Value<String?>? tagsJson,
    Value<int>? rowid,
  }) {
    return VersesCompanion(
      id: id ?? this.id,
      verseId: verseId ?? this.verseId,
      bookId: bookId ?? this.bookId,
      unitId: unitId ?? this.unitId,
      chapterId: chapterId ?? this.chapterId,
      cantoNumber: cantoNumber ?? this.cantoNumber,
      chapterNumber: chapterNumber ?? this.chapterNumber,
      verseNumber: verseNumber ?? this.verseNumber,
      verseNumberEnd: verseNumberEnd ?? this.verseNumberEnd,
      type: type ?? this.type,
      sanskrit: sanskrit ?? this.sanskrit,
      transliteration: transliteration ?? this.transliteration,
      wordMeanings: wordMeanings ?? this.wordMeanings,
      audioPath: audioPath ?? this.audioPath,
      audioUrl: audioUrl ?? this.audioUrl,
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
    if (unitId.present) {
      map['unit_id'] = Variable<String>(unitId.value);
    }
    if (chapterId.present) {
      map['chapter_id'] = Variable<String>(chapterId.value);
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
    if (type.present) {
      map['type'] = Variable<String>(type.value);
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
    if (audioPath.present) {
      map['audio_path'] = Variable<String>(audioPath.value);
    }
    if (audioUrl.present) {
      map['audio_url'] = Variable<String>(audioUrl.value);
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
    return (StringBuffer('VersesCompanion(')
          ..write('id: $id, ')
          ..write('verseId: $verseId, ')
          ..write('bookId: $bookId, ')
          ..write('unitId: $unitId, ')
          ..write('chapterId: $chapterId, ')
          ..write('cantoNumber: $cantoNumber, ')
          ..write('chapterNumber: $chapterNumber, ')
          ..write('verseNumber: $verseNumber, ')
          ..write('verseNumberEnd: $verseNumberEnd, ')
          ..write('type: $type, ')
          ..write('sanskrit: $sanskrit, ')
          ..write('transliteration: $transliteration, ')
          ..write('wordMeanings: $wordMeanings, ')
          ..write('audioPath: $audioPath, ')
          ..write('audioUrl: $audioUrl, ')
          ..write('tagsJson: $tagsJson, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $VerseTranslationsTable extends VerseTranslations
    with TableInfo<$VerseTranslationsTable, TranslationRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $VerseTranslationsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
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
  static const VerificationMeta _typeMeta = const VerificationMeta('type');
  @override
  late final GeneratedColumn<String> type = GeneratedColumn<String>(
    'type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('TRANSLATION'),
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
  static const VerificationMeta _audioPathMeta = const VerificationMeta(
    'audioPath',
  );
  @override
  late final GeneratedColumn<String> audioPath = GeneratedColumn<String>(
    'audio_path',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _displayOrderMeta = const VerificationMeta(
    'displayOrder',
  );
  @override
  late final GeneratedColumn<int> displayOrder = GeneratedColumn<int>(
    'display_order',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    verseRowId,
    languageCode,
    type,
    translatorId,
    translatorSlug,
    translatorName,
    meaning,
    purport,
    sourceRef,
    audioPath,
    displayOrder,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'verse_translations';
  @override
  VerificationContext validateIntegrity(
    Insertable<TranslationRecord> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
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
    if (data.containsKey('type')) {
      context.handle(
        _typeMeta,
        type.isAcceptableOrUnknown(data['type']!, _typeMeta),
      );
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
    if (data.containsKey('audio_path')) {
      context.handle(
        _audioPathMeta,
        audioPath.isAcceptableOrUnknown(data['audio_path']!, _audioPathMeta),
      );
    }
    if (data.containsKey('display_order')) {
      context.handle(
        _displayOrderMeta,
        displayOrder.isAcceptableOrUnknown(
          data['display_order']!,
          _displayOrderMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  TranslationRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return TranslationRecord(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      verseRowId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}verse_row_id'],
      )!,
      languageCode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}language_code'],
      )!,
      type: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}type'],
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
      audioPath: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}audio_path'],
      ),
      displayOrder: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}display_order'],
      )!,
    );
  }

  @override
  $VerseTranslationsTable createAlias(String alias) {
    return $VerseTranslationsTable(attachedDatabase, alias);
  }
}

class TranslationRecord extends DataClass
    implements Insertable<TranslationRecord> {
  final String id;
  final String verseRowId;
  final String languageCode;

  /// `TRANSLATION`, `COMMENTARY` or `POETIC_EXPANSION`.
  final String type;
  final String? translatorId;
  final String? translatorSlug;
  final String? translatorName;
  final String? meaning;
  final String? purport;
  final String? sourceRef;
  final String? audioPath;
  final int displayOrder;
  const TranslationRecord({
    required this.id,
    required this.verseRowId,
    required this.languageCode,
    required this.type,
    this.translatorId,
    this.translatorSlug,
    this.translatorName,
    this.meaning,
    this.purport,
    this.sourceRef,
    this.audioPath,
    required this.displayOrder,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['verse_row_id'] = Variable<String>(verseRowId);
    map['language_code'] = Variable<String>(languageCode);
    map['type'] = Variable<String>(type);
    if (!nullToAbsent || translatorId != null) {
      map['translator_id'] = Variable<String>(translatorId);
    }
    if (!nullToAbsent || translatorSlug != null) {
      map['translator_slug'] = Variable<String>(translatorSlug);
    }
    if (!nullToAbsent || translatorName != null) {
      map['translator_name'] = Variable<String>(translatorName);
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
    if (!nullToAbsent || audioPath != null) {
      map['audio_path'] = Variable<String>(audioPath);
    }
    map['display_order'] = Variable<int>(displayOrder);
    return map;
  }

  VerseTranslationsCompanion toCompanion(bool nullToAbsent) {
    return VerseTranslationsCompanion(
      id: Value(id),
      verseRowId: Value(verseRowId),
      languageCode: Value(languageCode),
      type: Value(type),
      translatorId: translatorId == null && nullToAbsent
          ? const Value.absent()
          : Value(translatorId),
      translatorSlug: translatorSlug == null && nullToAbsent
          ? const Value.absent()
          : Value(translatorSlug),
      translatorName: translatorName == null && nullToAbsent
          ? const Value.absent()
          : Value(translatorName),
      meaning: meaning == null && nullToAbsent
          ? const Value.absent()
          : Value(meaning),
      purport: purport == null && nullToAbsent
          ? const Value.absent()
          : Value(purport),
      sourceRef: sourceRef == null && nullToAbsent
          ? const Value.absent()
          : Value(sourceRef),
      audioPath: audioPath == null && nullToAbsent
          ? const Value.absent()
          : Value(audioPath),
      displayOrder: Value(displayOrder),
    );
  }

  factory TranslationRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return TranslationRecord(
      id: serializer.fromJson<String>(json['id']),
      verseRowId: serializer.fromJson<String>(json['verseRowId']),
      languageCode: serializer.fromJson<String>(json['languageCode']),
      type: serializer.fromJson<String>(json['type']),
      translatorId: serializer.fromJson<String?>(json['translatorId']),
      translatorSlug: serializer.fromJson<String?>(json['translatorSlug']),
      translatorName: serializer.fromJson<String?>(json['translatorName']),
      meaning: serializer.fromJson<String?>(json['meaning']),
      purport: serializer.fromJson<String?>(json['purport']),
      sourceRef: serializer.fromJson<String?>(json['sourceRef']),
      audioPath: serializer.fromJson<String?>(json['audioPath']),
      displayOrder: serializer.fromJson<int>(json['displayOrder']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'verseRowId': serializer.toJson<String>(verseRowId),
      'languageCode': serializer.toJson<String>(languageCode),
      'type': serializer.toJson<String>(type),
      'translatorId': serializer.toJson<String?>(translatorId),
      'translatorSlug': serializer.toJson<String?>(translatorSlug),
      'translatorName': serializer.toJson<String?>(translatorName),
      'meaning': serializer.toJson<String?>(meaning),
      'purport': serializer.toJson<String?>(purport),
      'sourceRef': serializer.toJson<String?>(sourceRef),
      'audioPath': serializer.toJson<String?>(audioPath),
      'displayOrder': serializer.toJson<int>(displayOrder),
    };
  }

  TranslationRecord copyWith({
    String? id,
    String? verseRowId,
    String? languageCode,
    String? type,
    Value<String?> translatorId = const Value.absent(),
    Value<String?> translatorSlug = const Value.absent(),
    Value<String?> translatorName = const Value.absent(),
    Value<String?> meaning = const Value.absent(),
    Value<String?> purport = const Value.absent(),
    Value<String?> sourceRef = const Value.absent(),
    Value<String?> audioPath = const Value.absent(),
    int? displayOrder,
  }) => TranslationRecord(
    id: id ?? this.id,
    verseRowId: verseRowId ?? this.verseRowId,
    languageCode: languageCode ?? this.languageCode,
    type: type ?? this.type,
    translatorId: translatorId.present ? translatorId.value : this.translatorId,
    translatorSlug: translatorSlug.present
        ? translatorSlug.value
        : this.translatorSlug,
    translatorName: translatorName.present
        ? translatorName.value
        : this.translatorName,
    meaning: meaning.present ? meaning.value : this.meaning,
    purport: purport.present ? purport.value : this.purport,
    sourceRef: sourceRef.present ? sourceRef.value : this.sourceRef,
    audioPath: audioPath.present ? audioPath.value : this.audioPath,
    displayOrder: displayOrder ?? this.displayOrder,
  );
  TranslationRecord copyWithCompanion(VerseTranslationsCompanion data) {
    return TranslationRecord(
      id: data.id.present ? data.id.value : this.id,
      verseRowId: data.verseRowId.present
          ? data.verseRowId.value
          : this.verseRowId,
      languageCode: data.languageCode.present
          ? data.languageCode.value
          : this.languageCode,
      type: data.type.present ? data.type.value : this.type,
      translatorId: data.translatorId.present
          ? data.translatorId.value
          : this.translatorId,
      translatorSlug: data.translatorSlug.present
          ? data.translatorSlug.value
          : this.translatorSlug,
      translatorName: data.translatorName.present
          ? data.translatorName.value
          : this.translatorName,
      meaning: data.meaning.present ? data.meaning.value : this.meaning,
      purport: data.purport.present ? data.purport.value : this.purport,
      sourceRef: data.sourceRef.present ? data.sourceRef.value : this.sourceRef,
      audioPath: data.audioPath.present ? data.audioPath.value : this.audioPath,
      displayOrder: data.displayOrder.present
          ? data.displayOrder.value
          : this.displayOrder,
    );
  }

  @override
  String toString() {
    return (StringBuffer('TranslationRecord(')
          ..write('id: $id, ')
          ..write('verseRowId: $verseRowId, ')
          ..write('languageCode: $languageCode, ')
          ..write('type: $type, ')
          ..write('translatorId: $translatorId, ')
          ..write('translatorSlug: $translatorSlug, ')
          ..write('translatorName: $translatorName, ')
          ..write('meaning: $meaning, ')
          ..write('purport: $purport, ')
          ..write('sourceRef: $sourceRef, ')
          ..write('audioPath: $audioPath, ')
          ..write('displayOrder: $displayOrder')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    verseRowId,
    languageCode,
    type,
    translatorId,
    translatorSlug,
    translatorName,
    meaning,
    purport,
    sourceRef,
    audioPath,
    displayOrder,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TranslationRecord &&
          other.id == this.id &&
          other.verseRowId == this.verseRowId &&
          other.languageCode == this.languageCode &&
          other.type == this.type &&
          other.translatorId == this.translatorId &&
          other.translatorSlug == this.translatorSlug &&
          other.translatorName == this.translatorName &&
          other.meaning == this.meaning &&
          other.purport == this.purport &&
          other.sourceRef == this.sourceRef &&
          other.audioPath == this.audioPath &&
          other.displayOrder == this.displayOrder);
}

class VerseTranslationsCompanion extends UpdateCompanion<TranslationRecord> {
  final Value<String> id;
  final Value<String> verseRowId;
  final Value<String> languageCode;
  final Value<String> type;
  final Value<String?> translatorId;
  final Value<String?> translatorSlug;
  final Value<String?> translatorName;
  final Value<String?> meaning;
  final Value<String?> purport;
  final Value<String?> sourceRef;
  final Value<String?> audioPath;
  final Value<int> displayOrder;
  final Value<int> rowid;
  const VerseTranslationsCompanion({
    this.id = const Value.absent(),
    this.verseRowId = const Value.absent(),
    this.languageCode = const Value.absent(),
    this.type = const Value.absent(),
    this.translatorId = const Value.absent(),
    this.translatorSlug = const Value.absent(),
    this.translatorName = const Value.absent(),
    this.meaning = const Value.absent(),
    this.purport = const Value.absent(),
    this.sourceRef = const Value.absent(),
    this.audioPath = const Value.absent(),
    this.displayOrder = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  VerseTranslationsCompanion.insert({
    required String id,
    required String verseRowId,
    required String languageCode,
    this.type = const Value.absent(),
    this.translatorId = const Value.absent(),
    this.translatorSlug = const Value.absent(),
    this.translatorName = const Value.absent(),
    this.meaning = const Value.absent(),
    this.purport = const Value.absent(),
    this.sourceRef = const Value.absent(),
    this.audioPath = const Value.absent(),
    this.displayOrder = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       verseRowId = Value(verseRowId),
       languageCode = Value(languageCode);
  static Insertable<TranslationRecord> custom({
    Expression<String>? id,
    Expression<String>? verseRowId,
    Expression<String>? languageCode,
    Expression<String>? type,
    Expression<String>? translatorId,
    Expression<String>? translatorSlug,
    Expression<String>? translatorName,
    Expression<String>? meaning,
    Expression<String>? purport,
    Expression<String>? sourceRef,
    Expression<String>? audioPath,
    Expression<int>? displayOrder,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (verseRowId != null) 'verse_row_id': verseRowId,
      if (languageCode != null) 'language_code': languageCode,
      if (type != null) 'type': type,
      if (translatorId != null) 'translator_id': translatorId,
      if (translatorSlug != null) 'translator_slug': translatorSlug,
      if (translatorName != null) 'translator_name': translatorName,
      if (meaning != null) 'meaning': meaning,
      if (purport != null) 'purport': purport,
      if (sourceRef != null) 'source_ref': sourceRef,
      if (audioPath != null) 'audio_path': audioPath,
      if (displayOrder != null) 'display_order': displayOrder,
      if (rowid != null) 'rowid': rowid,
    });
  }

  VerseTranslationsCompanion copyWith({
    Value<String>? id,
    Value<String>? verseRowId,
    Value<String>? languageCode,
    Value<String>? type,
    Value<String?>? translatorId,
    Value<String?>? translatorSlug,
    Value<String?>? translatorName,
    Value<String?>? meaning,
    Value<String?>? purport,
    Value<String?>? sourceRef,
    Value<String?>? audioPath,
    Value<int>? displayOrder,
    Value<int>? rowid,
  }) {
    return VerseTranslationsCompanion(
      id: id ?? this.id,
      verseRowId: verseRowId ?? this.verseRowId,
      languageCode: languageCode ?? this.languageCode,
      type: type ?? this.type,
      translatorId: translatorId ?? this.translatorId,
      translatorSlug: translatorSlug ?? this.translatorSlug,
      translatorName: translatorName ?? this.translatorName,
      meaning: meaning ?? this.meaning,
      purport: purport ?? this.purport,
      sourceRef: sourceRef ?? this.sourceRef,
      audioPath: audioPath ?? this.audioPath,
      displayOrder: displayOrder ?? this.displayOrder,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (verseRowId.present) {
      map['verse_row_id'] = Variable<String>(verseRowId.value);
    }
    if (languageCode.present) {
      map['language_code'] = Variable<String>(languageCode.value);
    }
    if (type.present) {
      map['type'] = Variable<String>(type.value);
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
    if (meaning.present) {
      map['meaning'] = Variable<String>(meaning.value);
    }
    if (purport.present) {
      map['purport'] = Variable<String>(purport.value);
    }
    if (sourceRef.present) {
      map['source_ref'] = Variable<String>(sourceRef.value);
    }
    if (audioPath.present) {
      map['audio_path'] = Variable<String>(audioPath.value);
    }
    if (displayOrder.present) {
      map['display_order'] = Variable<int>(displayOrder.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('VerseTranslationsCompanion(')
          ..write('id: $id, ')
          ..write('verseRowId: $verseRowId, ')
          ..write('languageCode: $languageCode, ')
          ..write('type: $type, ')
          ..write('translatorId: $translatorId, ')
          ..write('translatorSlug: $translatorSlug, ')
          ..write('translatorName: $translatorName, ')
          ..write('meaning: $meaning, ')
          ..write('purport: $purport, ')
          ..write('sourceRef: $sourceRef, ')
          ..write('audioPath: $audioPath, ')
          ..write('displayOrder: $displayOrder, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $DownloadStatesTable extends DownloadStates
    with TableInfo<$DownloadStatesTable, DownloadStateRecord> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $DownloadStatesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _bookIdMeta = const VerificationMeta('bookId');
  @override
  late final GeneratedColumn<String> bookId = GeneratedColumn<String>(
    'book_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitIdMeta = const VerificationMeta('unitId');
  @override
  late final GeneratedColumn<String> unitId = GeneratedColumn<String>(
    'unit_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitTypeMeta = const VerificationMeta(
    'unitType',
  );
  @override
  late final GeneratedColumn<String> unitType = GeneratedColumn<String>(
    'unit_type',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _unitNumberMeta = const VerificationMeta(
    'unitNumber',
  );
  @override
  late final GeneratedColumn<int> unitNumber = GeneratedColumn<int>(
    'unit_number',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _versionMeta = const VerificationMeta(
    'version',
  );
  @override
  late final GeneratedColumn<int> version = GeneratedColumn<int>(
    'version',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _hashMeta = const VerificationMeta('hash');
  @override
  late final GeneratedColumn<String> hash = GeneratedColumn<String>(
    'hash',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _downloadedAtMeta = const VerificationMeta(
    'downloadedAt',
  );
  @override
  late final GeneratedColumn<DateTime> downloadedAt = GeneratedColumn<DateTime>(
    'downloaded_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _retryCountMeta = const VerificationMeta(
    'retryCount',
  );
  @override
  late final GeneratedColumn<int> retryCount = GeneratedColumn<int>(
    'retry_count',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    bookId,
    unitId,
    unitType,
    unitNumber,
    status,
    version,
    hash,
    downloadedAt,
    retryCount,
    lastError,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'download_state';
  @override
  VerificationContext validateIntegrity(
    Insertable<DownloadStateRecord> instance, {
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
    if (data.containsKey('unit_id')) {
      context.handle(
        _unitIdMeta,
        unitId.isAcceptableOrUnknown(data['unit_id']!, _unitIdMeta),
      );
    } else if (isInserting) {
      context.missing(_unitIdMeta);
    }
    if (data.containsKey('unit_type')) {
      context.handle(
        _unitTypeMeta,
        unitType.isAcceptableOrUnknown(data['unit_type']!, _unitTypeMeta),
      );
    } else if (isInserting) {
      context.missing(_unitTypeMeta);
    }
    if (data.containsKey('unit_number')) {
      context.handle(
        _unitNumberMeta,
        unitNumber.isAcceptableOrUnknown(data['unit_number']!, _unitNumberMeta),
      );
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('version')) {
      context.handle(
        _versionMeta,
        version.isAcceptableOrUnknown(data['version']!, _versionMeta),
      );
    }
    if (data.containsKey('hash')) {
      context.handle(
        _hashMeta,
        hash.isAcceptableOrUnknown(data['hash']!, _hashMeta),
      );
    }
    if (data.containsKey('downloaded_at')) {
      context.handle(
        _downloadedAtMeta,
        downloadedAt.isAcceptableOrUnknown(
          data['downloaded_at']!,
          _downloadedAtMeta,
        ),
      );
    }
    if (data.containsKey('retry_count')) {
      context.handle(
        _retryCountMeta,
        retryCount.isAcceptableOrUnknown(data['retry_count']!, _retryCountMeta),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {bookId, unitId};
  @override
  DownloadStateRecord map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return DownloadStateRecord(
      bookId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}book_id'],
      )!,
      unitId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}unit_id'],
      )!,
      unitType: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}unit_type'],
      )!,
      unitNumber: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}unit_number'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      version: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}version'],
      )!,
      hash: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}hash'],
      ),
      downloadedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}downloaded_at'],
      ),
      retryCount: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}retry_count'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
    );
  }

  @override
  $DownloadStatesTable createAlias(String alias) {
    return $DownloadStatesTable(attachedDatabase, alias);
  }
}

class DownloadStateRecord extends DataClass
    implements Insertable<DownloadStateRecord> {
  final String bookId;
  final String unitId;

  /// `chapter` or `canto`.
  final String unitType;
  final int unitNumber;

  /// `pending`, `downloading`, `done` or `failed` — see [UnitStatus].
  final String status;
  final int version;
  final String? hash;
  final DateTime? downloadedAt;
  final int retryCount;
  final String? lastError;
  const DownloadStateRecord({
    required this.bookId,
    required this.unitId,
    required this.unitType,
    required this.unitNumber,
    required this.status,
    required this.version,
    this.hash,
    this.downloadedAt,
    required this.retryCount,
    this.lastError,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['book_id'] = Variable<String>(bookId);
    map['unit_id'] = Variable<String>(unitId);
    map['unit_type'] = Variable<String>(unitType);
    map['unit_number'] = Variable<int>(unitNumber);
    map['status'] = Variable<String>(status);
    map['version'] = Variable<int>(version);
    if (!nullToAbsent || hash != null) {
      map['hash'] = Variable<String>(hash);
    }
    if (!nullToAbsent || downloadedAt != null) {
      map['downloaded_at'] = Variable<DateTime>(downloadedAt);
    }
    map['retry_count'] = Variable<int>(retryCount);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    return map;
  }

  DownloadStatesCompanion toCompanion(bool nullToAbsent) {
    return DownloadStatesCompanion(
      bookId: Value(bookId),
      unitId: Value(unitId),
      unitType: Value(unitType),
      unitNumber: Value(unitNumber),
      status: Value(status),
      version: Value(version),
      hash: hash == null && nullToAbsent ? const Value.absent() : Value(hash),
      downloadedAt: downloadedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(downloadedAt),
      retryCount: Value(retryCount),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
    );
  }

  factory DownloadStateRecord.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return DownloadStateRecord(
      bookId: serializer.fromJson<String>(json['bookId']),
      unitId: serializer.fromJson<String>(json['unitId']),
      unitType: serializer.fromJson<String>(json['unitType']),
      unitNumber: serializer.fromJson<int>(json['unitNumber']),
      status: serializer.fromJson<String>(json['status']),
      version: serializer.fromJson<int>(json['version']),
      hash: serializer.fromJson<String?>(json['hash']),
      downloadedAt: serializer.fromJson<DateTime?>(json['downloadedAt']),
      retryCount: serializer.fromJson<int>(json['retryCount']),
      lastError: serializer.fromJson<String?>(json['lastError']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'bookId': serializer.toJson<String>(bookId),
      'unitId': serializer.toJson<String>(unitId),
      'unitType': serializer.toJson<String>(unitType),
      'unitNumber': serializer.toJson<int>(unitNumber),
      'status': serializer.toJson<String>(status),
      'version': serializer.toJson<int>(version),
      'hash': serializer.toJson<String?>(hash),
      'downloadedAt': serializer.toJson<DateTime?>(downloadedAt),
      'retryCount': serializer.toJson<int>(retryCount),
      'lastError': serializer.toJson<String?>(lastError),
    };
  }

  DownloadStateRecord copyWith({
    String? bookId,
    String? unitId,
    String? unitType,
    int? unitNumber,
    String? status,
    int? version,
    Value<String?> hash = const Value.absent(),
    Value<DateTime?> downloadedAt = const Value.absent(),
    int? retryCount,
    Value<String?> lastError = const Value.absent(),
  }) => DownloadStateRecord(
    bookId: bookId ?? this.bookId,
    unitId: unitId ?? this.unitId,
    unitType: unitType ?? this.unitType,
    unitNumber: unitNumber ?? this.unitNumber,
    status: status ?? this.status,
    version: version ?? this.version,
    hash: hash.present ? hash.value : this.hash,
    downloadedAt: downloadedAt.present ? downloadedAt.value : this.downloadedAt,
    retryCount: retryCount ?? this.retryCount,
    lastError: lastError.present ? lastError.value : this.lastError,
  );
  DownloadStateRecord copyWithCompanion(DownloadStatesCompanion data) {
    return DownloadStateRecord(
      bookId: data.bookId.present ? data.bookId.value : this.bookId,
      unitId: data.unitId.present ? data.unitId.value : this.unitId,
      unitType: data.unitType.present ? data.unitType.value : this.unitType,
      unitNumber: data.unitNumber.present
          ? data.unitNumber.value
          : this.unitNumber,
      status: data.status.present ? data.status.value : this.status,
      version: data.version.present ? data.version.value : this.version,
      hash: data.hash.present ? data.hash.value : this.hash,
      downloadedAt: data.downloadedAt.present
          ? data.downloadedAt.value
          : this.downloadedAt,
      retryCount: data.retryCount.present
          ? data.retryCount.value
          : this.retryCount,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
    );
  }

  @override
  String toString() {
    return (StringBuffer('DownloadStateRecord(')
          ..write('bookId: $bookId, ')
          ..write('unitId: $unitId, ')
          ..write('unitType: $unitType, ')
          ..write('unitNumber: $unitNumber, ')
          ..write('status: $status, ')
          ..write('version: $version, ')
          ..write('hash: $hash, ')
          ..write('downloadedAt: $downloadedAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastError: $lastError')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    bookId,
    unitId,
    unitType,
    unitNumber,
    status,
    version,
    hash,
    downloadedAt,
    retryCount,
    lastError,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DownloadStateRecord &&
          other.bookId == this.bookId &&
          other.unitId == this.unitId &&
          other.unitType == this.unitType &&
          other.unitNumber == this.unitNumber &&
          other.status == this.status &&
          other.version == this.version &&
          other.hash == this.hash &&
          other.downloadedAt == this.downloadedAt &&
          other.retryCount == this.retryCount &&
          other.lastError == this.lastError);
}

class DownloadStatesCompanion extends UpdateCompanion<DownloadStateRecord> {
  final Value<String> bookId;
  final Value<String> unitId;
  final Value<String> unitType;
  final Value<int> unitNumber;
  final Value<String> status;
  final Value<int> version;
  final Value<String?> hash;
  final Value<DateTime?> downloadedAt;
  final Value<int> retryCount;
  final Value<String?> lastError;
  final Value<int> rowid;
  const DownloadStatesCompanion({
    this.bookId = const Value.absent(),
    this.unitId = const Value.absent(),
    this.unitType = const Value.absent(),
    this.unitNumber = const Value.absent(),
    this.status = const Value.absent(),
    this.version = const Value.absent(),
    this.hash = const Value.absent(),
    this.downloadedAt = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastError = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  DownloadStatesCompanion.insert({
    required String bookId,
    required String unitId,
    required String unitType,
    this.unitNumber = const Value.absent(),
    this.status = const Value.absent(),
    this.version = const Value.absent(),
    this.hash = const Value.absent(),
    this.downloadedAt = const Value.absent(),
    this.retryCount = const Value.absent(),
    this.lastError = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : bookId = Value(bookId),
       unitId = Value(unitId),
       unitType = Value(unitType);
  static Insertable<DownloadStateRecord> custom({
    Expression<String>? bookId,
    Expression<String>? unitId,
    Expression<String>? unitType,
    Expression<int>? unitNumber,
    Expression<String>? status,
    Expression<int>? version,
    Expression<String>? hash,
    Expression<DateTime>? downloadedAt,
    Expression<int>? retryCount,
    Expression<String>? lastError,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (bookId != null) 'book_id': bookId,
      if (unitId != null) 'unit_id': unitId,
      if (unitType != null) 'unit_type': unitType,
      if (unitNumber != null) 'unit_number': unitNumber,
      if (status != null) 'status': status,
      if (version != null) 'version': version,
      if (hash != null) 'hash': hash,
      if (downloadedAt != null) 'downloaded_at': downloadedAt,
      if (retryCount != null) 'retry_count': retryCount,
      if (lastError != null) 'last_error': lastError,
      if (rowid != null) 'rowid': rowid,
    });
  }

  DownloadStatesCompanion copyWith({
    Value<String>? bookId,
    Value<String>? unitId,
    Value<String>? unitType,
    Value<int>? unitNumber,
    Value<String>? status,
    Value<int>? version,
    Value<String?>? hash,
    Value<DateTime?>? downloadedAt,
    Value<int>? retryCount,
    Value<String?>? lastError,
    Value<int>? rowid,
  }) {
    return DownloadStatesCompanion(
      bookId: bookId ?? this.bookId,
      unitId: unitId ?? this.unitId,
      unitType: unitType ?? this.unitType,
      unitNumber: unitNumber ?? this.unitNumber,
      status: status ?? this.status,
      version: version ?? this.version,
      hash: hash ?? this.hash,
      downloadedAt: downloadedAt ?? this.downloadedAt,
      retryCount: retryCount ?? this.retryCount,
      lastError: lastError ?? this.lastError,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (bookId.present) {
      map['book_id'] = Variable<String>(bookId.value);
    }
    if (unitId.present) {
      map['unit_id'] = Variable<String>(unitId.value);
    }
    if (unitType.present) {
      map['unit_type'] = Variable<String>(unitType.value);
    }
    if (unitNumber.present) {
      map['unit_number'] = Variable<int>(unitNumber.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (version.present) {
      map['version'] = Variable<int>(version.value);
    }
    if (hash.present) {
      map['hash'] = Variable<String>(hash.value);
    }
    if (downloadedAt.present) {
      map['downloaded_at'] = Variable<DateTime>(downloadedAt.value);
    }
    if (retryCount.present) {
      map['retry_count'] = Variable<int>(retryCount.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('DownloadStatesCompanion(')
          ..write('bookId: $bookId, ')
          ..write('unitId: $unitId, ')
          ..write('unitType: $unitType, ')
          ..write('unitNumber: $unitNumber, ')
          ..write('status: $status, ')
          ..write('version: $version, ')
          ..write('hash: $hash, ')
          ..write('downloadedAt: $downloadedAt, ')
          ..write('retryCount: $retryCount, ')
          ..write('lastError: $lastError, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $BooksTable books = $BooksTable(this);
  late final $UnitsTable units = $UnitsTable(this);
  late final $VersesTable verses = $VersesTable(this);
  late final $VerseTranslationsTable verseTranslations =
      $VerseTranslationsTable(this);
  late final $DownloadStatesTable downloadStates = $DownloadStatesTable(this);
  late final Index versesByUnit = Index(
    'verses_by_unit',
    'CREATE INDEX verses_by_unit ON verses (book_id, unit_id, verse_number)',
  );
  late final Index versesByChapter = Index(
    'verses_by_chapter',
    'CREATE INDEX verses_by_chapter ON verses (chapter_id, verse_number)',
  );
  late final Index translationsByVerseLanguage = Index(
    'translations_by_verse_language',
    'CREATE INDEX translations_by_verse_language ON verse_translations (verse_row_id, language_code)',
  );
  late final Index translationsByLanguage = Index(
    'translations_by_language',
    'CREATE INDEX translations_by_language ON verse_translations (language_code)',
  );
  late final BookDao bookDao = BookDao(this as AppDatabase);
  late final DownloadStateDao downloadStateDao = DownloadStateDao(
    this as AppDatabase,
  );
  late final SearchDao searchDao = SearchDao(this as AppDatabase);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    books,
    units,
    verses,
    verseTranslations,
    downloadStates,
    versesByUnit,
    versesByChapter,
    translationsByVerseLanguage,
    translationsByLanguage,
  ];
}

typedef $$BooksTableCreateCompanionBuilder =
    BooksCompanion Function({
      required String id,
      required String slug,
      required String title,
      Value<String?> titleI18n,
      required int bookNumber,
      Value<String?> unitType,
      Value<int> totalUnits,
      required DateTime updatedAt,
      Value<int> rowid,
    });
typedef $$BooksTableUpdateCompanionBuilder =
    BooksCompanion Function({
      Value<String> id,
      Value<String> slug,
      Value<String> title,
      Value<String?> titleI18n,
      Value<int> bookNumber,
      Value<String?> unitType,
      Value<int> totalUnits,
      Value<DateTime> updatedAt,
      Value<int> rowid,
    });

class $$BooksTableFilterComposer extends Composer<_$AppDatabase, $BooksTable> {
  $$BooksTableFilterComposer({
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

  ColumnFilters<String> get titleI18n => $composableBuilder(
    column: $table.titleI18n,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get bookNumber => $composableBuilder(
    column: $table.bookNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get unitType => $composableBuilder(
    column: $table.unitType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get totalUnits => $composableBuilder(
    column: $table.totalUnits,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$BooksTableOrderingComposer
    extends Composer<_$AppDatabase, $BooksTable> {
  $$BooksTableOrderingComposer({
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

  ColumnOrderings<String> get titleI18n => $composableBuilder(
    column: $table.titleI18n,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get bookNumber => $composableBuilder(
    column: $table.bookNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get unitType => $composableBuilder(
    column: $table.unitType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get totalUnits => $composableBuilder(
    column: $table.totalUnits,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$BooksTableAnnotationComposer
    extends Composer<_$AppDatabase, $BooksTable> {
  $$BooksTableAnnotationComposer({
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

  GeneratedColumn<String> get titleI18n =>
      $composableBuilder(column: $table.titleI18n, builder: (column) => column);

  GeneratedColumn<int> get bookNumber => $composableBuilder(
    column: $table.bookNumber,
    builder: (column) => column,
  );

  GeneratedColumn<String> get unitType =>
      $composableBuilder(column: $table.unitType, builder: (column) => column);

  GeneratedColumn<int> get totalUnits => $composableBuilder(
    column: $table.totalUnits,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$BooksTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $BooksTable,
          BookRecord,
          $$BooksTableFilterComposer,
          $$BooksTableOrderingComposer,
          $$BooksTableAnnotationComposer,
          $$BooksTableCreateCompanionBuilder,
          $$BooksTableUpdateCompanionBuilder,
          (BookRecord, BaseReferences<_$AppDatabase, $BooksTable, BookRecord>),
          BookRecord,
          PrefetchHooks Function()
        > {
  $$BooksTableTableManager(_$AppDatabase db, $BooksTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$BooksTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$BooksTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$BooksTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> slug = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String?> titleI18n = const Value.absent(),
                Value<int> bookNumber = const Value.absent(),
                Value<String?> unitType = const Value.absent(),
                Value<int> totalUnits = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => BooksCompanion(
                id: id,
                slug: slug,
                title: title,
                titleI18n: titleI18n,
                bookNumber: bookNumber,
                unitType: unitType,
                totalUnits: totalUnits,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String slug,
                required String title,
                Value<String?> titleI18n = const Value.absent(),
                required int bookNumber,
                Value<String?> unitType = const Value.absent(),
                Value<int> totalUnits = const Value.absent(),
                required DateTime updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => BooksCompanion.insert(
                id: id,
                slug: slug,
                title: title,
                titleI18n: titleI18n,
                bookNumber: bookNumber,
                unitType: unitType,
                totalUnits: totalUnits,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$BooksTable, BookRecord>(table),
                  BaseReferences<_$AppDatabase, $BooksTable, BookRecord>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$BooksTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $BooksTable,
      BookRecord,
      $$BooksTableFilterComposer,
      $$BooksTableOrderingComposer,
      $$BooksTableAnnotationComposer,
      $$BooksTableCreateCompanionBuilder,
      $$BooksTableUpdateCompanionBuilder,
      (BookRecord, BaseReferences<_$AppDatabase, $BooksTable, BookRecord>),
      BookRecord,
      PrefetchHooks Function()
    >;
typedef $$UnitsTableCreateCompanionBuilder =
    UnitsCompanion Function({
      required String id,
      required String bookId,
      required String kind,
      required int number,
      Value<int?> cantoNumber,
      required String downloadUnitId,
      required String title,
      Value<String?> titleI18n,
      Value<String?> summary,
      Value<String?> summaryI18n,
      Value<int> totalVerses,
      Value<int> rowid,
    });
typedef $$UnitsTableUpdateCompanionBuilder =
    UnitsCompanion Function({
      Value<String> id,
      Value<String> bookId,
      Value<String> kind,
      Value<int> number,
      Value<int?> cantoNumber,
      Value<String> downloadUnitId,
      Value<String> title,
      Value<String?> titleI18n,
      Value<String?> summary,
      Value<String?> summaryI18n,
      Value<int> totalVerses,
      Value<int> rowid,
    });

class $$UnitsTableFilterComposer extends Composer<_$AppDatabase, $UnitsTable> {
  $$UnitsTableFilterComposer({
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

  ColumnFilters<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get number => $composableBuilder(
    column: $table.number,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get downloadUnitId => $composableBuilder(
    column: $table.downloadUnitId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get titleI18n => $composableBuilder(
    column: $table.titleI18n,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get summary => $composableBuilder(
    column: $table.summary,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get summaryI18n => $composableBuilder(
    column: $table.summaryI18n,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get totalVerses => $composableBuilder(
    column: $table.totalVerses,
    builder: (column) => ColumnFilters(column),
  );
}

class $$UnitsTableOrderingComposer
    extends Composer<_$AppDatabase, $UnitsTable> {
  $$UnitsTableOrderingComposer({
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

  ColumnOrderings<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get number => $composableBuilder(
    column: $table.number,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get downloadUnitId => $composableBuilder(
    column: $table.downloadUnitId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get title => $composableBuilder(
    column: $table.title,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get titleI18n => $composableBuilder(
    column: $table.titleI18n,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get summary => $composableBuilder(
    column: $table.summary,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get summaryI18n => $composableBuilder(
    column: $table.summaryI18n,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get totalVerses => $composableBuilder(
    column: $table.totalVerses,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$UnitsTableAnnotationComposer
    extends Composer<_$AppDatabase, $UnitsTable> {
  $$UnitsTableAnnotationComposer({
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

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<int> get number =>
      $composableBuilder(column: $table.number, builder: (column) => column);

  GeneratedColumn<int> get cantoNumber => $composableBuilder(
    column: $table.cantoNumber,
    builder: (column) => column,
  );

  GeneratedColumn<String> get downloadUnitId => $composableBuilder(
    column: $table.downloadUnitId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get title =>
      $composableBuilder(column: $table.title, builder: (column) => column);

  GeneratedColumn<String> get titleI18n =>
      $composableBuilder(column: $table.titleI18n, builder: (column) => column);

  GeneratedColumn<String> get summary =>
      $composableBuilder(column: $table.summary, builder: (column) => column);

  GeneratedColumn<String> get summaryI18n => $composableBuilder(
    column: $table.summaryI18n,
    builder: (column) => column,
  );

  GeneratedColumn<int> get totalVerses => $composableBuilder(
    column: $table.totalVerses,
    builder: (column) => column,
  );
}

class $$UnitsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $UnitsTable,
          UnitRecord,
          $$UnitsTableFilterComposer,
          $$UnitsTableOrderingComposer,
          $$UnitsTableAnnotationComposer,
          $$UnitsTableCreateCompanionBuilder,
          $$UnitsTableUpdateCompanionBuilder,
          (UnitRecord, BaseReferences<_$AppDatabase, $UnitsTable, UnitRecord>),
          UnitRecord,
          PrefetchHooks Function()
        > {
  $$UnitsTableTableManager(_$AppDatabase db, $UnitsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$UnitsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$UnitsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$UnitsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> bookId = const Value.absent(),
                Value<String> kind = const Value.absent(),
                Value<int> number = const Value.absent(),
                Value<int?> cantoNumber = const Value.absent(),
                Value<String> downloadUnitId = const Value.absent(),
                Value<String> title = const Value.absent(),
                Value<String?> titleI18n = const Value.absent(),
                Value<String?> summary = const Value.absent(),
                Value<String?> summaryI18n = const Value.absent(),
                Value<int> totalVerses = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => UnitsCompanion(
                id: id,
                bookId: bookId,
                kind: kind,
                number: number,
                cantoNumber: cantoNumber,
                downloadUnitId: downloadUnitId,
                title: title,
                titleI18n: titleI18n,
                summary: summary,
                summaryI18n: summaryI18n,
                totalVerses: totalVerses,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String bookId,
                required String kind,
                required int number,
                Value<int?> cantoNumber = const Value.absent(),
                required String downloadUnitId,
                required String title,
                Value<String?> titleI18n = const Value.absent(),
                Value<String?> summary = const Value.absent(),
                Value<String?> summaryI18n = const Value.absent(),
                Value<int> totalVerses = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => UnitsCompanion.insert(
                id: id,
                bookId: bookId,
                kind: kind,
                number: number,
                cantoNumber: cantoNumber,
                downloadUnitId: downloadUnitId,
                title: title,
                titleI18n: titleI18n,
                summary: summary,
                summaryI18n: summaryI18n,
                totalVerses: totalVerses,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$UnitsTable, UnitRecord>(table),
                  BaseReferences<_$AppDatabase, $UnitsTable, UnitRecord>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$UnitsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $UnitsTable,
      UnitRecord,
      $$UnitsTableFilterComposer,
      $$UnitsTableOrderingComposer,
      $$UnitsTableAnnotationComposer,
      $$UnitsTableCreateCompanionBuilder,
      $$UnitsTableUpdateCompanionBuilder,
      (UnitRecord, BaseReferences<_$AppDatabase, $UnitsTable, UnitRecord>),
      UnitRecord,
      PrefetchHooks Function()
    >;
typedef $$VersesTableCreateCompanionBuilder =
    VersesCompanion Function({
      required String id,
      required String verseId,
      required String bookId,
      required String unitId,
      Value<String?> chapterId,
      Value<int?> cantoNumber,
      Value<int?> chapterNumber,
      required int verseNumber,
      Value<int?> verseNumberEnd,
      Value<String> type,
      Value<String?> sanskrit,
      Value<String?> transliteration,
      Value<String?> wordMeanings,
      Value<String?> audioPath,
      Value<String?> audioUrl,
      Value<String?> tagsJson,
      Value<int> rowid,
    });
typedef $$VersesTableUpdateCompanionBuilder =
    VersesCompanion Function({
      Value<String> id,
      Value<String> verseId,
      Value<String> bookId,
      Value<String> unitId,
      Value<String?> chapterId,
      Value<int?> cantoNumber,
      Value<int?> chapterNumber,
      Value<int> verseNumber,
      Value<int?> verseNumberEnd,
      Value<String> type,
      Value<String?> sanskrit,
      Value<String?> transliteration,
      Value<String?> wordMeanings,
      Value<String?> audioPath,
      Value<String?> audioUrl,
      Value<String?> tagsJson,
      Value<int> rowid,
    });

class $$VersesTableFilterComposer
    extends Composer<_$AppDatabase, $VersesTable> {
  $$VersesTableFilterComposer({
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

  ColumnFilters<String> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get chapterId => $composableBuilder(
    column: $table.chapterId,
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

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
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

  ColumnFilters<String> get audioPath => $composableBuilder(
    column: $table.audioPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get audioUrl => $composableBuilder(
    column: $table.audioUrl,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get tagsJson => $composableBuilder(
    column: $table.tagsJson,
    builder: (column) => ColumnFilters(column),
  );
}

class $$VersesTableOrderingComposer
    extends Composer<_$AppDatabase, $VersesTable> {
  $$VersesTableOrderingComposer({
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

  ColumnOrderings<String> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get chapterId => $composableBuilder(
    column: $table.chapterId,
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

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
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

  ColumnOrderings<String> get audioPath => $composableBuilder(
    column: $table.audioPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get audioUrl => $composableBuilder(
    column: $table.audioUrl,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get tagsJson => $composableBuilder(
    column: $table.tagsJson,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$VersesTableAnnotationComposer
    extends Composer<_$AppDatabase, $VersesTable> {
  $$VersesTableAnnotationComposer({
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

  GeneratedColumn<String> get unitId =>
      $composableBuilder(column: $table.unitId, builder: (column) => column);

  GeneratedColumn<String> get chapterId =>
      $composableBuilder(column: $table.chapterId, builder: (column) => column);

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

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

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

  GeneratedColumn<String> get audioPath =>
      $composableBuilder(column: $table.audioPath, builder: (column) => column);

  GeneratedColumn<String> get audioUrl =>
      $composableBuilder(column: $table.audioUrl, builder: (column) => column);

  GeneratedColumn<String> get tagsJson =>
      $composableBuilder(column: $table.tagsJson, builder: (column) => column);
}

class $$VersesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $VersesTable,
          VerseRecord,
          $$VersesTableFilterComposer,
          $$VersesTableOrderingComposer,
          $$VersesTableAnnotationComposer,
          $$VersesTableCreateCompanionBuilder,
          $$VersesTableUpdateCompanionBuilder,
          (
            VerseRecord,
            BaseReferences<_$AppDatabase, $VersesTable, VerseRecord>,
          ),
          VerseRecord,
          PrefetchHooks Function()
        > {
  $$VersesTableTableManager(_$AppDatabase db, $VersesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$VersesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$VersesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$VersesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> verseId = const Value.absent(),
                Value<String> bookId = const Value.absent(),
                Value<String> unitId = const Value.absent(),
                Value<String?> chapterId = const Value.absent(),
                Value<int?> cantoNumber = const Value.absent(),
                Value<int?> chapterNumber = const Value.absent(),
                Value<int> verseNumber = const Value.absent(),
                Value<int?> verseNumberEnd = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<String?> sanskrit = const Value.absent(),
                Value<String?> transliteration = const Value.absent(),
                Value<String?> wordMeanings = const Value.absent(),
                Value<String?> audioPath = const Value.absent(),
                Value<String?> audioUrl = const Value.absent(),
                Value<String?> tagsJson = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VersesCompanion(
                id: id,
                verseId: verseId,
                bookId: bookId,
                unitId: unitId,
                chapterId: chapterId,
                cantoNumber: cantoNumber,
                chapterNumber: chapterNumber,
                verseNumber: verseNumber,
                verseNumberEnd: verseNumberEnd,
                type: type,
                sanskrit: sanskrit,
                transliteration: transliteration,
                wordMeanings: wordMeanings,
                audioPath: audioPath,
                audioUrl: audioUrl,
                tagsJson: tagsJson,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String verseId,
                required String bookId,
                required String unitId,
                Value<String?> chapterId = const Value.absent(),
                Value<int?> cantoNumber = const Value.absent(),
                Value<int?> chapterNumber = const Value.absent(),
                required int verseNumber,
                Value<int?> verseNumberEnd = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<String?> sanskrit = const Value.absent(),
                Value<String?> transliteration = const Value.absent(),
                Value<String?> wordMeanings = const Value.absent(),
                Value<String?> audioPath = const Value.absent(),
                Value<String?> audioUrl = const Value.absent(),
                Value<String?> tagsJson = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VersesCompanion.insert(
                id: id,
                verseId: verseId,
                bookId: bookId,
                unitId: unitId,
                chapterId: chapterId,
                cantoNumber: cantoNumber,
                chapterNumber: chapterNumber,
                verseNumber: verseNumber,
                verseNumberEnd: verseNumberEnd,
                type: type,
                sanskrit: sanskrit,
                transliteration: transliteration,
                wordMeanings: wordMeanings,
                audioPath: audioPath,
                audioUrl: audioUrl,
                tagsJson: tagsJson,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$VersesTable, VerseRecord>(table),
                  BaseReferences<_$AppDatabase, $VersesTable, VerseRecord>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$VersesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $VersesTable,
      VerseRecord,
      $$VersesTableFilterComposer,
      $$VersesTableOrderingComposer,
      $$VersesTableAnnotationComposer,
      $$VersesTableCreateCompanionBuilder,
      $$VersesTableUpdateCompanionBuilder,
      (VerseRecord, BaseReferences<_$AppDatabase, $VersesTable, VerseRecord>),
      VerseRecord,
      PrefetchHooks Function()
    >;
typedef $$VerseTranslationsTableCreateCompanionBuilder =
    VerseTranslationsCompanion Function({
      required String id,
      required String verseRowId,
      required String languageCode,
      Value<String> type,
      Value<String?> translatorId,
      Value<String?> translatorSlug,
      Value<String?> translatorName,
      Value<String?> meaning,
      Value<String?> purport,
      Value<String?> sourceRef,
      Value<String?> audioPath,
      Value<int> displayOrder,
      Value<int> rowid,
    });
typedef $$VerseTranslationsTableUpdateCompanionBuilder =
    VerseTranslationsCompanion Function({
      Value<String> id,
      Value<String> verseRowId,
      Value<String> languageCode,
      Value<String> type,
      Value<String?> translatorId,
      Value<String?> translatorSlug,
      Value<String?> translatorName,
      Value<String?> meaning,
      Value<String?> purport,
      Value<String?> sourceRef,
      Value<String?> audioPath,
      Value<int> displayOrder,
      Value<int> rowid,
    });

class $$VerseTranslationsTableFilterComposer
    extends Composer<_$AppDatabase, $VerseTranslationsTable> {
  $$VerseTranslationsTableFilterComposer({
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

  ColumnFilters<String> get verseRowId => $composableBuilder(
    column: $table.verseRowId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get type => $composableBuilder(
    column: $table.type,
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

  ColumnFilters<String> get audioPath => $composableBuilder(
    column: $table.audioPath,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get displayOrder => $composableBuilder(
    column: $table.displayOrder,
    builder: (column) => ColumnFilters(column),
  );
}

class $$VerseTranslationsTableOrderingComposer
    extends Composer<_$AppDatabase, $VerseTranslationsTable> {
  $$VerseTranslationsTableOrderingComposer({
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

  ColumnOrderings<String> get verseRowId => $composableBuilder(
    column: $table.verseRowId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get type => $composableBuilder(
    column: $table.type,
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

  ColumnOrderings<String> get audioPath => $composableBuilder(
    column: $table.audioPath,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get displayOrder => $composableBuilder(
    column: $table.displayOrder,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$VerseTranslationsTableAnnotationComposer
    extends Composer<_$AppDatabase, $VerseTranslationsTable> {
  $$VerseTranslationsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get verseRowId => $composableBuilder(
    column: $table.verseRowId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get languageCode => $composableBuilder(
    column: $table.languageCode,
    builder: (column) => column,
  );

  GeneratedColumn<String> get type =>
      $composableBuilder(column: $table.type, builder: (column) => column);

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

  GeneratedColumn<String> get meaning =>
      $composableBuilder(column: $table.meaning, builder: (column) => column);

  GeneratedColumn<String> get purport =>
      $composableBuilder(column: $table.purport, builder: (column) => column);

  GeneratedColumn<String> get sourceRef =>
      $composableBuilder(column: $table.sourceRef, builder: (column) => column);

  GeneratedColumn<String> get audioPath =>
      $composableBuilder(column: $table.audioPath, builder: (column) => column);

  GeneratedColumn<int> get displayOrder => $composableBuilder(
    column: $table.displayOrder,
    builder: (column) => column,
  );
}

class $$VerseTranslationsTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $VerseTranslationsTable,
          TranslationRecord,
          $$VerseTranslationsTableFilterComposer,
          $$VerseTranslationsTableOrderingComposer,
          $$VerseTranslationsTableAnnotationComposer,
          $$VerseTranslationsTableCreateCompanionBuilder,
          $$VerseTranslationsTableUpdateCompanionBuilder,
          (
            TranslationRecord,
            BaseReferences<
              _$AppDatabase,
              $VerseTranslationsTable,
              TranslationRecord
            >,
          ),
          TranslationRecord,
          PrefetchHooks Function()
        > {
  $$VerseTranslationsTableTableManager(
    _$AppDatabase db,
    $VerseTranslationsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$VerseTranslationsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$VerseTranslationsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$VerseTranslationsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> verseRowId = const Value.absent(),
                Value<String> languageCode = const Value.absent(),
                Value<String> type = const Value.absent(),
                Value<String?> translatorId = const Value.absent(),
                Value<String?> translatorSlug = const Value.absent(),
                Value<String?> translatorName = const Value.absent(),
                Value<String?> meaning = const Value.absent(),
                Value<String?> purport = const Value.absent(),
                Value<String?> sourceRef = const Value.absent(),
                Value<String?> audioPath = const Value.absent(),
                Value<int> displayOrder = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VerseTranslationsCompanion(
                id: id,
                verseRowId: verseRowId,
                languageCode: languageCode,
                type: type,
                translatorId: translatorId,
                translatorSlug: translatorSlug,
                translatorName: translatorName,
                meaning: meaning,
                purport: purport,
                sourceRef: sourceRef,
                audioPath: audioPath,
                displayOrder: displayOrder,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String verseRowId,
                required String languageCode,
                Value<String> type = const Value.absent(),
                Value<String?> translatorId = const Value.absent(),
                Value<String?> translatorSlug = const Value.absent(),
                Value<String?> translatorName = const Value.absent(),
                Value<String?> meaning = const Value.absent(),
                Value<String?> purport = const Value.absent(),
                Value<String?> sourceRef = const Value.absent(),
                Value<String?> audioPath = const Value.absent(),
                Value<int> displayOrder = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => VerseTranslationsCompanion.insert(
                id: id,
                verseRowId: verseRowId,
                languageCode: languageCode,
                type: type,
                translatorId: translatorId,
                translatorSlug: translatorSlug,
                translatorName: translatorName,
                meaning: meaning,
                purport: purport,
                sourceRef: sourceRef,
                audioPath: audioPath,
                displayOrder: displayOrder,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$VerseTranslationsTable, TranslationRecord>(
                    table,
                  ),
                  BaseReferences<
                    _$AppDatabase,
                    $VerseTranslationsTable,
                    TranslationRecord
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$VerseTranslationsTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $VerseTranslationsTable,
      TranslationRecord,
      $$VerseTranslationsTableFilterComposer,
      $$VerseTranslationsTableOrderingComposer,
      $$VerseTranslationsTableAnnotationComposer,
      $$VerseTranslationsTableCreateCompanionBuilder,
      $$VerseTranslationsTableUpdateCompanionBuilder,
      (
        TranslationRecord,
        BaseReferences<
          _$AppDatabase,
          $VerseTranslationsTable,
          TranslationRecord
        >,
      ),
      TranslationRecord,
      PrefetchHooks Function()
    >;
typedef $$DownloadStatesTableCreateCompanionBuilder =
    DownloadStatesCompanion Function({
      required String bookId,
      required String unitId,
      required String unitType,
      Value<int> unitNumber,
      Value<String> status,
      Value<int> version,
      Value<String?> hash,
      Value<DateTime?> downloadedAt,
      Value<int> retryCount,
      Value<String?> lastError,
      Value<int> rowid,
    });
typedef $$DownloadStatesTableUpdateCompanionBuilder =
    DownloadStatesCompanion Function({
      Value<String> bookId,
      Value<String> unitId,
      Value<String> unitType,
      Value<int> unitNumber,
      Value<String> status,
      Value<int> version,
      Value<String?> hash,
      Value<DateTime?> downloadedAt,
      Value<int> retryCount,
      Value<String?> lastError,
      Value<int> rowid,
    });

class $$DownloadStatesTableFilterComposer
    extends Composer<_$AppDatabase, $DownloadStatesTable> {
  $$DownloadStatesTableFilterComposer({
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

  ColumnFilters<String> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get unitType => $composableBuilder(
    column: $table.unitType,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get unitNumber => $composableBuilder(
    column: $table.unitNumber,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get hash => $composableBuilder(
    column: $table.hash,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );
}

class $$DownloadStatesTableOrderingComposer
    extends Composer<_$AppDatabase, $DownloadStatesTable> {
  $$DownloadStatesTableOrderingComposer({
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

  ColumnOrderings<String> get unitId => $composableBuilder(
    column: $table.unitId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get unitType => $composableBuilder(
    column: $table.unitType,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get unitNumber => $composableBuilder(
    column: $table.unitNumber,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get version => $composableBuilder(
    column: $table.version,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get hash => $composableBuilder(
    column: $table.hash,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$DownloadStatesTableAnnotationComposer
    extends Composer<_$AppDatabase, $DownloadStatesTable> {
  $$DownloadStatesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get bookId =>
      $composableBuilder(column: $table.bookId, builder: (column) => column);

  GeneratedColumn<String> get unitId =>
      $composableBuilder(column: $table.unitId, builder: (column) => column);

  GeneratedColumn<String> get unitType =>
      $composableBuilder(column: $table.unitType, builder: (column) => column);

  GeneratedColumn<int> get unitNumber => $composableBuilder(
    column: $table.unitNumber,
    builder: (column) => column,
  );

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get version =>
      $composableBuilder(column: $table.version, builder: (column) => column);

  GeneratedColumn<String> get hash =>
      $composableBuilder(column: $table.hash, builder: (column) => column);

  GeneratedColumn<DateTime> get downloadedAt => $composableBuilder(
    column: $table.downloadedAt,
    builder: (column) => column,
  );

  GeneratedColumn<int> get retryCount => $composableBuilder(
    column: $table.retryCount,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);
}

class $$DownloadStatesTableTableManager
    extends
        RootTableManager<
          _$AppDatabase,
          $DownloadStatesTable,
          DownloadStateRecord,
          $$DownloadStatesTableFilterComposer,
          $$DownloadStatesTableOrderingComposer,
          $$DownloadStatesTableAnnotationComposer,
          $$DownloadStatesTableCreateCompanionBuilder,
          $$DownloadStatesTableUpdateCompanionBuilder,
          (
            DownloadStateRecord,
            BaseReferences<
              _$AppDatabase,
              $DownloadStatesTable,
              DownloadStateRecord
            >,
          ),
          DownloadStateRecord,
          PrefetchHooks Function()
        > {
  $$DownloadStatesTableTableManager(
    _$AppDatabase db,
    $DownloadStatesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$DownloadStatesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$DownloadStatesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$DownloadStatesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> bookId = const Value.absent(),
                Value<String> unitId = const Value.absent(),
                Value<String> unitType = const Value.absent(),
                Value<int> unitNumber = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> version = const Value.absent(),
                Value<String?> hash = const Value.absent(),
                Value<DateTime?> downloadedAt = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DownloadStatesCompanion(
                bookId: bookId,
                unitId: unitId,
                unitType: unitType,
                unitNumber: unitNumber,
                status: status,
                version: version,
                hash: hash,
                downloadedAt: downloadedAt,
                retryCount: retryCount,
                lastError: lastError,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String bookId,
                required String unitId,
                required String unitType,
                Value<int> unitNumber = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> version = const Value.absent(),
                Value<String?> hash = const Value.absent(),
                Value<DateTime?> downloadedAt = const Value.absent(),
                Value<int> retryCount = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => DownloadStatesCompanion.insert(
                bookId: bookId,
                unitId: unitId,
                unitType: unitType,
                unitNumber: unitNumber,
                status: status,
                version: version,
                hash: hash,
                downloadedAt: downloadedAt,
                retryCount: retryCount,
                lastError: lastError,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$DownloadStatesTable, DownloadStateRecord>(table),
                  BaseReferences<
                    _$AppDatabase,
                    $DownloadStatesTable,
                    DownloadStateRecord
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$DownloadStatesTableProcessedTableManager =
    ProcessedTableManager<
      _$AppDatabase,
      $DownloadStatesTable,
      DownloadStateRecord,
      $$DownloadStatesTableFilterComposer,
      $$DownloadStatesTableOrderingComposer,
      $$DownloadStatesTableAnnotationComposer,
      $$DownloadStatesTableCreateCompanionBuilder,
      $$DownloadStatesTableUpdateCompanionBuilder,
      (
        DownloadStateRecord,
        BaseReferences<
          _$AppDatabase,
          $DownloadStatesTable,
          DownloadStateRecord
        >,
      ),
      DownloadStateRecord,
      PrefetchHooks Function()
    >;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$BooksTableTableManager get books =>
      $$BooksTableTableManager(_db, _db.books);
  $$UnitsTableTableManager get units =>
      $$UnitsTableTableManager(_db, _db.units);
  $$VersesTableTableManager get verses =>
      $$VersesTableTableManager(_db, _db.verses);
  $$VerseTranslationsTableTableManager get verseTranslations =>
      $$VerseTranslationsTableTableManager(_db, _db.verseTranslations);
  $$DownloadStatesTableTableManager get downloadStates =>
      $$DownloadStatesTableTableManager(_db, _db.downloadStates);
}
