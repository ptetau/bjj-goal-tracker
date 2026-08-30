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

-- Starter mission sets, coach-owned: seeded from the shipped defaults on
-- first read, replaced wholesale by whoever holds the admin secret.
CREATE TABLE IF NOT EXISTS templates (
  key        text PRIMARY KEY,
  name       text NOT NULL,
  type       text NOT NULL,
  lines      text NOT NULL,
  position   int  NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
