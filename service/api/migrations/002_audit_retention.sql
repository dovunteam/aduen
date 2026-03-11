CREATE INDEX IF NOT EXISTS aduen_case_audit_occurred_idx ON aduen_case_audit_events (occurred_at);

DROP POLICY IF EXISTS aduen_case_audit_retention_delete_policy ON aduen_case_audit_events;
CREATE POLICY aduen_case_audit_retention_delete_policy ON aduen_case_audit_events
  FOR DELETE TO aduen_retention
  USING (occurred_at < NULLIF(current_setting('aduen.audit_cutoff', true), '')::timestamptz);

DROP POLICY IF EXISTS aduen_case_audit_retention_select_policy ON aduen_case_audit_events;
CREATE POLICY aduen_case_audit_retention_select_policy ON aduen_case_audit_events
  FOR SELECT TO aduen_retention
  USING (true);

GRANT SELECT (occurred_at), DELETE ON aduen_case_audit_events TO aduen_retention;
