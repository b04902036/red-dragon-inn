-- Published content is immutable. New content must use a new version ID.
CREATE TRIGGER products_published_insert BEFORE INSERT ON products
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER products_published_update BEFORE UPDATE ON products
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL) OR EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER products_published_delete BEFORE DELETE ON products
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER characters_published_insert BEFORE INSERT ON characters
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER characters_published_update BEFORE UPDATE ON characters
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL) OR EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER characters_published_delete BEFORE DELETE ON characters
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER decks_published_insert BEFORE INSERT ON decks
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER decks_published_update BEFORE UPDATE ON decks
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL) OR EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER decks_published_delete BEFORE DELETE ON decks
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER cards_published_insert BEFORE INSERT ON cards
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER cards_published_update BEFORE UPDATE ON cards
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL) OR EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER cards_published_delete BEFORE DELETE ON cards
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER deck_cards_published_insert BEFORE INSERT ON deck_cards
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER deck_cards_published_update BEFORE UPDATE ON deck_cards
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL) OR EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER deck_cards_published_delete BEFORE DELETE ON deck_cards
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER rule_modules_published_insert BEFORE INSERT ON rule_modules
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER rule_modules_published_update BEFORE UPDATE ON rule_modules
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL) OR EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER rule_modules_published_delete BEFORE DELETE ON rule_modules
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER assets_published_insert BEFORE INSERT ON assets
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER assets_published_update BEFORE UPDATE ON assets
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL) OR EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER assets_published_delete BEFORE DELETE ON assets
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = OLD.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER published_version_no_update BEFORE UPDATE ON content_versions
WHEN OLD.published_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER published_version_no_delete BEFORE DELETE ON content_versions
WHEN OLD.published_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Published content is immutable'); END;

CREATE TRIGGER products_asset_owner_delete BEFORE DELETE ON products
WHEN EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'PRODUCT' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;

CREATE TRIGGER products_asset_owner_update BEFORE UPDATE OF id, content_version_id ON products
WHEN (NEW.id <> OLD.id OR NEW.content_version_id <> OLD.content_version_id) AND EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'PRODUCT' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;

CREATE TRIGGER characters_asset_owner_delete BEFORE DELETE ON characters
WHEN EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'CHARACTER' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;

CREATE TRIGGER characters_asset_owner_update BEFORE UPDATE OF id, content_version_id ON characters
WHEN (NEW.id <> OLD.id OR NEW.content_version_id <> OLD.content_version_id) AND EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'CHARACTER' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;

CREATE TRIGGER decks_asset_owner_delete BEFORE DELETE ON decks
WHEN EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'DECK' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;

CREATE TRIGGER decks_asset_owner_update BEFORE UPDATE OF id, content_version_id ON decks
WHEN (NEW.id <> OLD.id OR NEW.content_version_id <> OLD.content_version_id) AND EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'DECK' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;

CREATE TRIGGER cards_asset_owner_delete BEFORE DELETE ON cards
WHEN EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'CARD' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;

CREATE TRIGGER cards_asset_owner_update BEFORE UPDATE OF id, content_version_id ON cards
WHEN (NEW.id <> OLD.id OR NEW.content_version_id <> OLD.content_version_id) AND EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'CARD' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;

CREATE TRIGGER rule_modules_asset_owner_delete BEFORE DELETE ON rule_modules
WHEN EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'RULE_MODULE' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;

CREATE TRIGGER rule_modules_asset_owner_update BEFORE UPDATE OF id, content_version_id ON rule_modules
WHEN (NEW.id <> OLD.id OR NEW.content_version_id <> OLD.content_version_id) AND EXISTS (SELECT 1 FROM assets WHERE content_version_id = OLD.content_version_id AND owner_type = 'RULE_MODULE' AND owner_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Asset owner is referenced'); END;
