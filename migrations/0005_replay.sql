-- Accepted command history supplements immutable domain events for deterministic replay.
CREATE TABLE match_manifests (
 match_id TEXT PRIMARY KEY NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
 manifest_json TEXT NOT NULL CHECK(json_valid(manifest_json) AND json_extract(manifest_json,'$.schemaVersion') IS 1),
 CHECK(json_extract(manifest_json,'$.setup.matchId') IS match_id)
) STRICT;
CREATE TABLE match_commands (
 match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
 command_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 state_version INTEGER NOT NULL CHECK(state_version BETWEEN 1 AND 9007199254740991),
 first_sequence INTEGER NOT NULL CHECK(first_sequence BETWEEN 1 AND 9007199254740991),
 last_sequence INTEGER NOT NULL CHECK(last_sequence BETWEEN first_sequence AND 9007199254740991),
 entry_json TEXT NOT NULL CHECK(json_valid(entry_json)),
 accepted_at TEXT NOT NULL,
 PRIMARY KEY(match_id,command_id),
 UNIQUE(match_id,state_version),
 UNIQUE(match_id,first_sequence),
 CHECK(json_extract(entry_json,'$.command.commandId') IS command_id),
 CHECK(json_extract(entry_json,'$.actorId') IS actor_id),
 CHECK(json_extract(entry_json,'$.firstSequence') IS first_sequence),
 CHECK(json_extract(entry_json,'$.lastSequence') IS last_sequence),
 CHECK(json_extract(entry_json,'$.acceptedAt') IS accepted_at),
 FOREIGN KEY(match_id,actor_id) REFERENCES match_players(match_id,player_id) ON DELETE RESTRICT
) STRICT;
CREATE TRIGGER command_sequence_monotonic BEFORE INSERT ON match_commands
WHEN NEW.first_sequence <> COALESCE((SELECT MAX(last_sequence) FROM match_commands WHERE match_id=NEW.match_id),0)+1
BEGIN SELECT RAISE(ABORT,'Command sequence gap or duplicate'); END;
CREATE TRIGGER command_version_monotonic BEFORE INSERT ON match_commands
WHEN NEW.state_version <> (SELECT state_version+1 FROM matches WHERE id=NEW.match_id)
BEGIN SELECT RAISE(ABORT,'Command version is not the next match version'); END;
CREATE TRIGGER match_commands_no_update BEFORE UPDATE ON match_commands
BEGIN SELECT RAISE(ABORT,'Match commands are append-only'); END;
CREATE TRIGGER match_commands_no_delete BEFORE DELETE ON match_commands
BEGIN SELECT RAISE(ABORT,'Match commands are append-only'); END;
CREATE TRIGGER match_commands_no_replace BEFORE INSERT ON match_commands
WHEN EXISTS(SELECT 1 FROM match_commands WHERE match_id=NEW.match_id AND (command_id=NEW.command_id OR state_version=NEW.state_version OR first_sequence=NEW.first_sequence))
BEGIN SELECT RAISE(ABORT,'Match command already exists'); END;
CREATE TRIGGER match_manifests_no_update BEFORE UPDATE ON match_manifests
BEGIN SELECT RAISE(ABORT,'Match manifest is immutable'); END;
CREATE TRIGGER match_manifests_no_delete BEFORE DELETE ON match_manifests
BEGIN SELECT RAISE(ABORT,'Match manifest is immutable'); END;
CREATE TRIGGER match_manifests_no_replace BEFORE INSERT ON match_manifests
WHEN EXISTS(SELECT 1 FROM match_manifests WHERE match_id=NEW.match_id)
BEGIN SELECT RAISE(ABORT,'Match manifest already exists'); END;
CREATE TABLE match_results (
 match_id TEXT PRIMARY KEY NOT NULL REFERENCES matches(id) ON DELETE RESTRICT,
 final_sequence INTEGER NOT NULL CHECK(final_sequence BETWEEN 1 AND 9007199254740991),
 state_version INTEGER NOT NULL CHECK(state_version BETWEEN 1 AND 9007199254740991),
 winners_json TEXT NOT NULL CHECK(json_valid(winners_json) AND json_type(winners_json)='array'),
 players_json TEXT NOT NULL CHECK(json_valid(players_json) AND json_type(players_json)='array'),
 ended_at TEXT NOT NULL
) STRICT;
CREATE TRIGGER match_results_no_update BEFORE UPDATE ON match_results
BEGIN SELECT RAISE(ABORT,'Match results are immutable'); END;
CREATE TRIGGER match_results_no_delete BEFORE DELETE ON match_results
BEGIN SELECT RAISE(ABORT,'Match results are immutable'); END;
CREATE TRIGGER match_results_no_replace BEFORE INSERT ON match_results
WHEN EXISTS(SELECT 1 FROM match_results WHERE match_id=NEW.match_id)
BEGIN SELECT RAISE(ABORT,'Match result already exists'); END;
CREATE TRIGGER finished_match_locked BEFORE UPDATE ON matches WHEN OLD.lifecycle='FINISHED'
BEGIN SELECT RAISE(ABORT,'Finished match is immutable'); END;
