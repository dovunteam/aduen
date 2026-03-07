CREATE INDEX IF NOT EXISTS aduen_cases_retention_updated_idx ON aduen_cases (updated_at);

DROP POLICY IF EXISTS aduen_cases_owner_policy ON aduen_cases;
CREATE POLICY aduen_cases_owner_policy ON aduen_cases
  FOR ALL TO aduen_api
  USING (owner_subject = current_setting('aduen.user_sub', true))
  WITH CHECK (owner_subject = current_setting('aduen.user_sub', true));

DROP POLICY IF EXISTS aduen_case_audit_owner_policy ON aduen_case_audit_events;
CREATE POLICY aduen_case_audit_owner_policy ON aduen_case_audit_events
  FOR INSERT TO aduen_api
  WITH CHECK (owner_subject = current_setting('aduen.user_sub', true));

DROP POLICY IF EXISTS aduen_cases_retention_select_policy ON aduen_cases;
CREATE POLICY aduen_cases_retention_select_policy ON aduen_cases
  FOR SELECT TO aduen_retention
  USING (updated_at < current_setting('aduen.case_cutoff', true)::timestamptz);

DROP POLICY IF EXISTS aduen_cases_retention_delete_policy ON aduen_cases;
CREATE POLICY aduen_cases_retention_delete_policy ON aduen_cases
  FOR DELETE TO aduen_retention
  USING (updated_at < current_setting('aduen.case_cutoff', true)::timestamptz);

GRANT SELECT (updated_at), DELETE ON aduen_cases TO aduen_retention;
