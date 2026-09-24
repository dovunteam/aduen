CREATE TABLE IF NOT EXISTS aduen_api_rate_limits (
  key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key_hash, window_start),
  CHECK (expires_at > window_start)
);

CREATE INDEX IF NOT EXISTS aduen_api_rate_limits_expiry_idx ON aduen_api_rate_limits (expires_at);
ALTER TABLE aduen_api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE aduen_api_rate_limits FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aduen_api_rate_limits_select_policy ON aduen_api_rate_limits;
CREATE POLICY aduen_api_rate_limits_select_policy ON aduen_api_rate_limits
  FOR SELECT TO aduen_api USING (true);
DROP POLICY IF EXISTS aduen_api_rate_limits_insert_policy ON aduen_api_rate_limits;
CREATE POLICY aduen_api_rate_limits_insert_policy ON aduen_api_rate_limits
  FOR INSERT TO aduen_api WITH CHECK (true);
DROP POLICY IF EXISTS aduen_api_rate_limits_update_policy ON aduen_api_rate_limits;
CREATE POLICY aduen_api_rate_limits_update_policy ON aduen_api_rate_limits
  FOR UPDATE TO aduen_api USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS aduen_api_rate_limits_delete_policy ON aduen_api_rate_limits;
CREATE POLICY aduen_api_rate_limits_delete_policy ON aduen_api_rate_limits
  FOR DELETE TO aduen_api USING (expires_at <= now());
DROP POLICY IF EXISTS aduen_api_rate_limits_retention_policy ON aduen_api_rate_limits;
CREATE POLICY aduen_api_rate_limits_retention_policy ON aduen_api_rate_limits
  FOR DELETE TO aduen_retention
  USING (expires_at <= now());

GRANT SELECT (key_hash, window_start, request_count, expires_at), INSERT, UPDATE, DELETE ON aduen_api_rate_limits TO aduen_api;
GRANT SELECT (expires_at), DELETE ON aduen_api_rate_limits TO aduen_retention;
