CREATE TABLE content_channels (
  name TEXT PRIMARY KEY CHECK (name IN ('production')),
  content_version_id TEXT NOT NULL REFERENCES content_versions(id)
) STRICT;

CREATE TRIGGER content_channel_published_insert BEFORE INSERT ON content_channels
WHEN NOT EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Channel requires published content'); END;
CREATE TRIGGER content_channel_published_update BEFORE UPDATE ON content_channels
WHEN NOT EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Channel requires published content'); END;

CREATE TRIGGER content_channel_playable_insert BEFORE INSERT ON content_channels
WHEN NOT EXISTS (SELECT 1 FROM cards WHERE content_version_id = NEW.content_version_id)
OR EXISTS (SELECT 1 FROM cards WHERE content_version_id = NEW.content_version_id AND COALESCE(json_extract(definition_json, '$.source'), '') NOT IN ('USER_OWNED', 'LICENSED'))
BEGIN SELECT RAISE(ABORT, 'Channel requires owned or licensed card data'); END;
CREATE TRIGGER content_channel_playable_update BEFORE UPDATE ON content_channels
WHEN NOT EXISTS (SELECT 1 FROM cards WHERE content_version_id = NEW.content_version_id)
OR EXISTS (SELECT 1 FROM cards WHERE content_version_id = NEW.content_version_id AND COALESCE(json_extract(definition_json, '$.source'), '') NOT IN ('USER_OWNED', 'LICENSED'))
BEGIN SELECT RAISE(ABORT, 'Channel requires owned or licensed card data'); END;

CREATE TABLE content_metadata (
  content_version_id TEXT PRIMARY KEY REFERENCES content_versions(id),
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json))
) STRICT;
CREATE TRIGGER content_metadata_published_insert BEFORE INSERT ON content_metadata
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published metadata is immutable'); END;
CREATE TRIGGER content_metadata_published_update BEFORE UPDATE ON content_metadata
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id IN (OLD.content_version_id, NEW.content_version_id) AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published metadata is immutable'); END;
CREATE TRIGGER content_metadata_published_delete BEFORE DELETE ON content_metadata
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published metadata is immutable'); END;
