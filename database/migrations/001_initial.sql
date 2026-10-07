CREATE TABLE players (
  id UUID PRIMARY KEY,
  display_name VARCHAR(32) NOT NULL,
  state JSONB NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only a SHA-256 digest of the high-entropy bearer cookie is stored.
CREATE TABLE guest_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX guest_sessions_player_idx ON guest_sessions(player_id);
CREATE INDEX guest_sessions_expiry_idx ON guest_sessions(expires_at);

-- The unique composite key prevents concurrent duplicate actions for one player.
CREATE TABLE action_receipts (
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  action_hash CHAR(64) NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, idempotency_key)
);
