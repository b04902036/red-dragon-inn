-- SQLite replacement inserts can delete rows without firing ordinary delete
-- triggers. Reject conflicts before insert, independent of conflict policy.
CREATE TRIGGER content_version_published_insert BEFORE INSERT ON content_versions
WHEN EXISTS (SELECT 1 FROM content_versions WHERE id = NEW.id AND published_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Published content version is immutable'); END;

CREATE TRIGGER match_events_no_replace BEFORE INSERT ON match_events
WHEN EXISTS (
  SELECT 1 FROM match_events
  WHERE event_id = NEW.event_id
     OR (match_id = NEW.match_id AND sequence = NEW.sequence)
     OR (match_id = NEW.match_id AND state_version = NEW.state_version AND event_index = NEW.event_index)
)
BEGIN SELECT RAISE(ABORT, 'Event sequence or identity already exists'); END;
