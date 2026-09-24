DROP POLICY IF EXISTS aduen_case_audit_owner_delete_policy ON aduen_case_audit_events;
CREATE POLICY aduen_case_audit_owner_delete_policy ON aduen_case_audit_events
  FOR DELETE TO aduen_api
  USING (owner_subject = current_setting('aduen.user_sub', true));

GRANT DELETE ON aduen_case_audit_events TO aduen_api;
