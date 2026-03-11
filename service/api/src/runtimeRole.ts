import type { Pool } from 'pg'

const protectedTables = ['aduen_cases', 'aduen_case_audit_events', 'aduen_api_rate_limits']

type RuntimeRoleRow = {
  rolsuper: boolean
  rolbypassrls: boolean
  rolcreatedb: boolean
  rolcreaterole: boolean
  rolreplication: boolean
  protected_table_count: number
  owns_protected_table: boolean
}

export async function assertRestrictedRuntimeRole(pool: Pick<Pool, 'query'>): Promise<void> {
  const result = await pool.query<RuntimeRoleRow>(`
    SELECT role.rolsuper,
           role.rolbypassrls,
           role.rolcreatedb,
           role.rolcreaterole,
           role.rolreplication,
           (SELECT count(*)::int
              FROM pg_class AS relation
              JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
             WHERE namespace.nspname = 'public'
               AND relation.relname = ANY($1::text[])
               AND relation.relkind IN ('r', 'p')) AS protected_table_count,
           EXISTS (
             SELECT 1
               FROM pg_class AS relation
               JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
              WHERE namespace.nspname = 'public'
                AND relation.relname = ANY($1::text[])
                AND relation.relkind IN ('r', 'p')
                AND (relation.relowner = role.oid OR pg_has_role(role.oid, relation.relowner, 'MEMBER'))
           ) AS owns_protected_table
      FROM pg_roles AS role
     WHERE role.rolname = current_user
  `, [protectedTables])

  const role = result.rows[0]
  if (!role || role.protected_table_count !== protectedTables.length || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole || role.rolreplication || role.owns_protected_table) {
    throw new Error('The production API database role must be restricted and must not own protected tables.')
  }
}
