-- TOKUI sync store. One tracker = one shared action log (a person's
-- devices, pre-auth). The log is append-only: actions arrive validated by
-- the engine and take a dense per-tracker sequence number.

CREATE TABLE IF NOT EXISTS trackers (
  id          text PRIMARY KEY,
  secret_hash text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions (
  tracker_id  text NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
  seq         bigint NOT NULL,
  action      jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tracker_id, seq)
);

-- Idempotency belt-and-braces: the referee already dedupes inside its
-- serialized transaction, but the constraint makes double-append impossible.
CREATE UNIQUE INDEX IF NOT EXISTS actions_by_action_id
  ON actions (tracker_id, ((action->>'id')));
