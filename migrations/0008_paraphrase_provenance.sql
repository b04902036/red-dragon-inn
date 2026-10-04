-- Provenance is not a distribution license. Artwork license rules remain unchanged.
DROP TRIGGER content_channel_playable_insert;
DROP TRIGGER content_channel_playable_update;
CREATE TRIGGER content_channel_playable_insert BEFORE INSERT ON content_channels
WHEN NOT EXISTS (SELECT 1 FROM cards WHERE content_version_id = NEW.content_version_id)
OR EXISTS (SELECT 1 FROM cards WHERE content_version_id = NEW.content_version_id AND COALESCE(json_extract(definition_json, '$.source'), '') NOT IN ('USER_OWNED', 'LICENSED', 'PUBLIC_RULES_PARAPHRASE'))
BEGIN SELECT RAISE(ABORT, 'Channel requires owned or licensed card data, or public-rules paraphrases'); END;
CREATE TRIGGER content_channel_playable_update BEFORE UPDATE ON content_channels
WHEN NOT EXISTS (SELECT 1 FROM cards WHERE content_version_id = NEW.content_version_id)
OR EXISTS (SELECT 1 FROM cards WHERE content_version_id = NEW.content_version_id AND COALESCE(json_extract(definition_json, '$.source'), '') NOT IN ('USER_OWNED', 'LICENSED', 'PUBLIC_RULES_PARAPHRASE'))
BEGIN SELECT RAISE(ABORT, 'Channel requires owned or licensed card data, or public-rules paraphrases'); END;
