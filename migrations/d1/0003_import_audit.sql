CREATE TABLE migration_import_parts (
  part_name TEXT PRIMARY KEY NOT NULL,
  content_sha256 TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000Z')
);
