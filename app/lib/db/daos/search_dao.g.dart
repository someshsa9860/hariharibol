// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'search_dao.dart';

// ignore_for_file: type=lint
mixin _$SearchDaoMixin on DatabaseAccessor<AppDatabase> {
  $VersesTable get verses => attachedDatabase.verses;
  $VerseTranslationsTable get verseTranslations =>
      attachedDatabase.verseTranslations;
  SearchDaoManager get managers => SearchDaoManager(this);
}

class SearchDaoManager {
  final _$SearchDaoMixin _db;
  SearchDaoManager(this._db);
  $$VersesTableTableManager get verses =>
      $$VersesTableTableManager(_db.attachedDatabase, _db.verses);
  $$VerseTranslationsTableTableManager get verseTranslations =>
      $$VerseTranslationsTableTableManager(
        _db.attachedDatabase,
        _db.verseTranslations,
      );
}
