CREATE TABLE IF NOT EXISTS aduen_cases (
  id uuid PRIMARY KEY,
  owner_subject text NOT NULL CHECK (length(owner_subject) BETWEEN 1 AND 255),
  record jsonb NOT NULL CHECK (jsonb_typeof(record) = 'object' AND record->>'id' = id::text),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS aduen_cases_owner_updated_idx ON aduen_cases (owner_subject, updated_at DESC, id DESC);
ALTER TABLE aduen_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE aduen_cases FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aduen_cases_owner_policy ON aduen_cases;
CREATE POLICY aduen_cases_owner_policy ON aduen_cases
  USING (owner_subject = current_setting('aduen.user_sub', true))
  WITH CHECK (owner_subject = current_setting('aduen.user_sub', true));

CREATE TABLE IF NOT EXISTS aduen_case_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_subject text NOT NULL CHECK (length(owner_subject) BETWEEN 1 AND 255),
  case_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('case_created', 'case_updated', 'case_deleted')),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aduen_case_audit_owner_time_idx ON aduen_case_audit_events (owner_subject, occurred_at DESC);
ALTER TABLE aduen_case_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE aduen_case_audit_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aduen_case_audit_owner_policy ON aduen_case_audit_events;
CREATE POLICY aduen_case_audit_owner_policy ON aduen_case_audit_events
  WITH CHECK (owner_subject = current_setting('aduen.user_sub', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON aduen_cases TO aduen_api;
GRANT INSERT ON aduen_case_audit_events TO aduen_api;
GRANT USAGE ON SEQUENCE aduen_case_audit_events_id_seq TO aduen_api;
