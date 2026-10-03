CREATE TABLE content_translations (
  content_version_id TEXT NOT NULL REFERENCES content_versions(id),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('PRODUCT','CHARACTER','CARD','RULE_MODULE','MECHANIC','CHOICE_OPTION')),
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL CHECK(field IN ('name','rulesText','summary','label')),
  locale TEXT NOT NULL CHECK(locale IN ('en-US','zh-TW')),
  text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 5000),
  source_kind TEXT NOT NULL CHECK(source_kind IN ('OFFICIAL','AUTHORIZED','COMMUNITY','USER_OWNED','MANUAL','MACHINE')),
  source_ref TEXT,
  status TEXT NOT NULL CHECK(status IN ('VERIFIED','COMMUNITY_REFERENCE','MACHINE_DRAFT','MANUAL_DRAFT','MANUAL_REVIEWED')),
  PRIMARY KEY(content_version_id,entity_type,entity_id,field,locale)
) STRICT;
INSERT INTO content_translations SELECT m.content_version_id,
 json_extract(t.value,'$.entityType'),json_extract(t.value,'$.entityId'),json_extract(t.value,'$.field'),json_extract(t.value,'$.locale'),
 json_extract(t.value,'$.text'),json_extract(t.value,'$.sourceKind'),json_extract(t.value,'$.sourceRef'),json_extract(t.value,'$.status')
 FROM content_metadata m,json_each(m.metadata_json,'$.translations') t;
CREATE TRIGGER content_translations_published_insert BEFORE INSERT ON content_translations
WHEN EXISTS(SELECT 1 FROM content_versions WHERE id=NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Published translations are immutable'); END;
CREATE TRIGGER content_translations_published_update BEFORE UPDATE ON content_translations
WHEN EXISTS(SELECT 1 FROM content_versions WHERE id IN (OLD.content_version_id,NEW.content_version_id) AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Published translations are immutable'); END;
CREATE TRIGGER content_translations_published_delete BEFORE DELETE ON content_translations
WHEN EXISTS(SELECT 1 FROM content_versions WHERE id=OLD.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'Published translations are immutable'); END;
