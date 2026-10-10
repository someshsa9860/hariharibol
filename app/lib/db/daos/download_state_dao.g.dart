// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'download_state_dao.dart';

// ignore_for_file: type=lint
mixin _$DownloadStateDaoMixin on DatabaseAccessor<AppDatabase> {
  $DownloadStatesTable get downloadStates => attachedDatabase.downloadStates;
  $BooksTable get books => attachedDatabase.books;
  DownloadStateDaoManager get managers => DownloadStateDaoManager(this);
}

class DownloadStateDaoManager {
  final _$DownloadStateDaoMixin _db;
  DownloadStateDaoManager(this._db);
  $$DownloadStatesTableTableManager get downloadStates =>
      $$DownloadStatesTableTableManager(
        _db.attachedDatabase,
        _db.downloadStates,
      );
  $$BooksTableTableManager get books =>
      $$BooksTableTableManager(_db.attachedDatabase, _db.books);
}
