// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'book_dao.dart';

// ignore_for_file: type=lint
mixin _$BookDaoMixin on DatabaseAccessor<AppDatabase> {
  $BooksTable get books => attachedDatabase.books;
  $UnitsTable get units => attachedDatabase.units;
  $VersesTable get verses => attachedDatabase.verses;
  $VerseTranslationsTable get verseTranslations =>
      attachedDatabase.verseTranslations;
  $DownloadStatesTable get downloadStates => attachedDatabase.downloadStates;
  BookDaoManager get managers => BookDaoManager(this);
}

class BookDaoManager {
  final _$BookDaoMixin _db;
  BookDaoManager(this._db);
  $$BooksTableTableManager get books =>
      $$BooksTableTableManager(_db.attachedDatabase, _db.books);
  $$UnitsTableTableManager get units =>
      $$UnitsTableTableManager(_db.attachedDatabase, _db.units);
  $$VersesTableTableManager get verses =>
      $$VersesTableTableManager(_db.attachedDatabase, _db.verses);
  $$VerseTranslationsTableTableManager get verseTranslations =>
      $$VerseTranslationsTableTableManager(
        _db.attachedDatabase,
        _db.verseTranslations,
      );
  $$DownloadStatesTableTableManager get downloadStates =>
      $$DownloadStatesTableTableManager(
        _db.attachedDatabase,
        _db.downloadStates,
      );
}
