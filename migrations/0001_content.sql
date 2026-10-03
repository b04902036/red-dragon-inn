-- Content identities are scoped by version so the same card ID can evolve in a new edition.
CREATE TABLE content_versions (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  published_at TEXT
) STRICT;

CREATE TABLE products (
  content_version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  release_year INTEGER CHECK (release_year BETWEEN 1900 AND 9999),
  PRIMARY KEY (content_version_id, id),
  UNIQUE (content_version_id, slug)
) STRICT;

CREATE TABLE characters (
  content_version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  villain INTEGER NOT NULL CHECK (villain IN (0, 1)),
  complexity INTEGER CHECK (complexity BETWEEN 1 AND 5),
  special_rule_key TEXT,
  rules_json TEXT NOT NULL CHECK (json_valid(rules_json) AND json_type(rules_json) = 'object'),
  PRIMARY KEY (content_version_id, id),
  UNIQUE (content_version_id, slug),
  FOREIGN KEY (content_version_id, product_id) REFERENCES products(content_version_id, id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX characters_by_product ON characters(content_version_id, product_id);

CREATE TABLE decks (
  content_version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  character_id TEXT,
  deck_type TEXT NOT NULL CHECK (deck_type IN ('CHARACTER', 'INN_DRINK', 'SPECIAL')),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (content_version_id, id),
  UNIQUE (content_version_id, slug),
  CHECK ((deck_type = 'INN_DRINK' AND character_id IS NULL) OR (deck_type <> 'INN_DRINK' AND character_id IS NOT NULL)),
  FOREIGN KEY (content_version_id, character_id) REFERENCES characters(content_version_id, id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX decks_by_character ON decks(content_version_id, character_id);

CREATE TABLE cards (
  content_version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  character_id TEXT,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  card_type TEXT NOT NULL CHECK (card_type IN ('ACTION', 'SOMETIMES', 'ANYTIME', 'GAMBLING', 'CHEATING', 'DRINK', 'DRINK_EVENT', 'SPECIAL')),
  effect_key TEXT,
  effect_params_json TEXT,
  effect_dsl_json TEXT NOT NULL CHECK (json_valid(effect_dsl_json) AND json_type(effect_dsl_json) = 'array'),
  rules_summary TEXT,
  definition_json TEXT NOT NULL CHECK (json_valid(definition_json) AND json_type(definition_json) = 'object'),
  PRIMARY KEY (content_version_id, id),
  UNIQUE (content_version_id, slug),
  CHECK ((effect_key IS NULL AND effect_params_json IS NULL) OR (effect_key IS NOT NULL AND effect_params_json IS NOT NULL AND json_valid(effect_params_json) AND json_type(effect_params_json) = 'object')),
  CHECK (json_extract(definition_json, '$.id') IS id),
  CHECK (json_extract(definition_json, '$.name') IS name),
  CHECK (json_extract(definition_json, '$.type') IS card_type),
  CHECK (json_extract(definition_json, '$.characterId') IS character_id),
  CHECK (json(effect_dsl_json) = json(json_extract(definition_json, '$.effects'))),
  FOREIGN KEY (content_version_id, character_id) REFERENCES characters(content_version_id, id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE deck_cards (
  content_version_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 64),
  PRIMARY KEY (content_version_id, deck_id, card_id),
  FOREIGN KEY (content_version_id, deck_id) REFERENCES decks(content_version_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (content_version_id, card_id) REFERENCES cards(content_version_id, id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX deck_cards_by_card ON deck_cards(content_version_id, card_id);

CREATE TABLE rule_modules (
  content_version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  summary TEXT NOT NULL,
  rules_json TEXT NOT NULL CHECK (json_valid(rules_json) AND json_type(rules_json) = 'object'),
  PRIMARY KEY (content_version_id, id),
  UNIQUE (content_version_id, rule_key)
) STRICT;

CREATE TABLE assets (
  content_version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('PRODUCT', 'CHARACTER', 'DECK', 'CARD', 'RULE_MODULE')),
  owner_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('ARTWORK', 'ICON', 'RULES_TEXT')),
  object_key TEXT NOT NULL,
  license_status TEXT NOT NULL CHECK (license_status IN ('ORIGINAL', 'USER_OWNED', 'LICENSED')),
  PRIMARY KEY (content_version_id, id),
  UNIQUE (content_version_id, owner_type, owner_id, asset_type, object_key)
) STRICT;
CREATE INDEX assets_by_owner ON assets(content_version_id, owner_type, owner_id);

-- Polymorphic asset ownership cannot use one ordinary FK. These triggers enforce its equivalent.
CREATE TRIGGER asset_owner_insert BEFORE INSERT ON assets
WHEN NOT EXISTS (
  SELECT 1 FROM products WHERE NEW.owner_type = 'PRODUCT' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
  UNION ALL SELECT 1 FROM characters WHERE NEW.owner_type = 'CHARACTER' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
  UNION ALL SELECT 1 FROM decks WHERE NEW.owner_type = 'DECK' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
  UNION ALL SELECT 1 FROM cards WHERE NEW.owner_type = 'CARD' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
  UNION ALL SELECT 1 FROM rule_modules WHERE NEW.owner_type = 'RULE_MODULE' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
)
BEGIN SELECT RAISE(ABORT, 'Invalid asset owner'); END;

CREATE TRIGGER asset_owner_update BEFORE UPDATE ON assets
WHEN NOT EXISTS (
  SELECT 1 FROM products WHERE NEW.owner_type = 'PRODUCT' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
  UNION ALL SELECT 1 FROM characters WHERE NEW.owner_type = 'CHARACTER' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
  UNION ALL SELECT 1 FROM decks WHERE NEW.owner_type = 'DECK' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
  UNION ALL SELECT 1 FROM cards WHERE NEW.owner_type = 'CARD' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
  UNION ALL SELECT 1 FROM rule_modules WHERE NEW.owner_type = 'RULE_MODULE' AND content_version_id = NEW.content_version_id AND id = NEW.owner_id
)
BEGIN SELECT RAISE(ABORT, 'Invalid asset owner'); END;
