CREATE TABLE matches (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  content_version_id TEXT NOT NULL REFERENCES content_versions(id) ON DELETE RESTRICT,
  rng_seed INTEGER NOT NULL CHECK (rng_seed BETWEEN 0 AND 4294967295),
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('LOBBY', 'SETUP', 'PLAYING', 'FINISHED')),
  state_version INTEGER NOT NULL CHECK (state_version BETWEEN 0 AND 9007199254740991),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at TEXT,
  UNIQUE (id, content_version_id)
) STRICT;
CREATE INDEX matches_by_room ON matches(room_id, created_at, id);

CREATE TRIGGER match_requires_published_content BEFORE INSERT ON matches
WHEN NOT EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.content_version_id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Match content version must be published'); END;
CREATE TRIGGER match_content_and_seed_locked BEFORE UPDATE ON matches
WHEN NEW.content_version_id <> OLD.content_version_id OR NEW.rng_seed <> OLD.rng_seed OR NEW.room_id <> OLD.room_id OR NEW.id <> OLD.id
BEGIN SELECT RAISE(ABORT, 'Match content, identity and RNG seed are locked'); END;
CREATE TRIGGER match_version_monotonic BEFORE UPDATE ON matches
WHEN NEW.state_version < OLD.state_version
BEGIN SELECT RAISE(ABORT, 'Match version cannot decrease'); END;

CREATE TABLE match_players (
  match_id TEXT NOT NULL,
  content_version_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  seat INTEGER NOT NULL CHECK (seat BETWEEN 0 AND 3),
  display_name TEXT NOT NULL,
  PRIMARY KEY (match_id, player_id),
  UNIQUE (match_id, seat),
  FOREIGN KEY (match_id, content_version_id) REFERENCES matches(id, content_version_id) ON DELETE RESTRICT,
  FOREIGN KEY (content_version_id, character_id) REFERENCES characters(content_version_id, id) ON DELETE RESTRICT
) STRICT;
CREATE INDEX match_players_by_character ON match_players(content_version_id, character_id);

CREATE TABLE match_events (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 9007199254740991),
  event_id TEXT NOT NULL UNIQUE,
  command_id TEXT NOT NULL,
  state_version INTEGER NOT NULL CHECK (state_version BETWEEN 0 AND 9007199254740991),
  event_index INTEGER NOT NULL CHECK (event_index BETWEEN 0 AND 9007199254740991),
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL CHECK (json_valid(event_json) AND json_type(event_json) = 'object'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (match_id, sequence),
  UNIQUE (match_id, state_version, event_index),
  CHECK (json_extract(event_json, '$.matchId') IS match_id),
  CHECK (json_extract(event_json, '$.eventId') IS event_id),
  CHECK (json_extract(event_json, '$.commandId') IS command_id),
  CHECK (json_extract(event_json, '$.stateVersion') IS state_version),
  CHECK (json_extract(event_json, '$.eventIndex') IS event_index),
  CHECK (json_extract(event_json, '$.type') IS event_type)
) STRICT;
CREATE INDEX match_events_by_command ON match_events(match_id, command_id);
CREATE TRIGGER match_events_no_update BEFORE UPDATE ON match_events
BEGIN SELECT RAISE(ABORT, 'Match events are append-only'); END;
CREATE TRIGGER match_events_no_delete BEFORE DELETE ON match_events
BEGIN SELECT RAISE(ABORT, 'Match events are append-only'); END;
CREATE TRIGGER match_event_room BEFORE INSERT ON match_events
WHEN NOT EXISTS (SELECT 1 FROM matches WHERE id = NEW.match_id AND room_id = json_extract(NEW.event_json, '$.roomId'))
BEGIN SELECT RAISE(ABORT, 'Event belongs to another room'); END;

CREATE TABLE match_snapshots (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
  sequence INTEGER NOT NULL CHECK (sequence BETWEEN 0 AND 9007199254740991),
  state_version INTEGER NOT NULL CHECK (state_version BETWEEN 0 AND 9007199254740991),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json) AND json_type(snapshot_json) = 'object'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (match_id, sequence),
  CHECK (json_extract(snapshot_json, '$.matchId') IS match_id),
  CHECK (json_extract(snapshot_json, '$.version') IS state_version)
) STRICT;
CREATE INDEX snapshots_by_version ON match_snapshots(match_id, state_version);
CREATE TRIGGER match_snapshot_room_insert BEFORE INSERT ON match_snapshots
WHEN NOT EXISTS (SELECT 1 FROM matches WHERE id = NEW.match_id AND room_id = json_extract(NEW.snapshot_json, '$.roomId'))
BEGIN SELECT RAISE(ABORT, 'Snapshot belongs to another room'); END;
CREATE TRIGGER match_snapshot_room_update BEFORE UPDATE ON match_snapshots
WHEN NOT EXISTS (SELECT 1 FROM matches WHERE id = NEW.match_id AND room_id = json_extract(NEW.snapshot_json, '$.roomId'))
BEGIN SELECT RAISE(ABORT, 'Snapshot belongs to another room'); END;
