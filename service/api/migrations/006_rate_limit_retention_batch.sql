DROP POLICY IF EXISTS aduen_api_rate_limits_migrator_select_policy ON aduen_api_rate_limits;
CREATE POLICY aduen_api_rate_limits_migrator_select_policy ON aduen_api_rate_limits
  FOR SELECT TO aduen_migrator USING (expires_at <= now());
DROP POLICY IF EXISTS aduen_api_rate_limits_migrator_delete_policy ON aduen_api_rate_limits;
CREATE POLICY aduen_api_rate_limits_migrator_delete_policy ON aduen_api_rate_limits
  FOR DELETE TO aduen_migrator USING (expires_at <= now());

CREATE FUNCTION aduen_prune_expired_rate_limit_batch()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  WITH expired AS (
    SELECT ctid
    FROM public.aduen_api_rate_limits
    WHERE expires_at <= now()
    ORDER BY expires_at
    LIMIT 500
  ), deleted AS (
    DELETE FROM public.aduen_api_rate_limits AS stored
    USING expired
    WHERE stored.ctid = expired.ctid
    RETURNING 1
  )
  SELECT count(*)::integer FROM deleted;
$$;

REVOKE ALL ON FUNCTION aduen_prune_expired_rate_limit_batch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION aduen_prune_expired_rate_limit_batch() TO aduen_retention;
