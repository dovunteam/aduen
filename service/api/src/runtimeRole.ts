import type { Pool } from 'pg'
import { readMigrations } from './migrationManifest.js'

const protectedTables = ['aduen_cases', 'aduen_case_audit_events', 'aduen_api_rate_limits']

type RuntimeRoleRow = {
  rolsuper: boolean
  rolbypassrls: boolean
  rolcreatedb: boolean
  rolcreaterole: boolean
  rolreplication: boolean
  role_membership_count: number
  can_create_in_public_schema: boolean
  protected_table_count: number
  has_unsafe_protected_table_privileges: boolean
  owns_protected_table: boolean
}

export class ProductionDatabaseGuardError extends Error {
  constructor(message: string) { super(message); this.name = 'ProductionDatabaseGuardError' }
}

export async function assertRestrictedRuntimeRole(pool: Pick<Pool, 'query'>): Promise<void> {
  const result = await pool.query<RuntimeRoleRow>(`
    SELECT role.rolsuper,
           role.rolbypassrls,
           role.rolcreatedb,
           role.rolcreaterole,
           role.rolreplication,
           (SELECT count(*)::int
              FROM pg_auth_members AS membership
             WHERE membership.member = role.oid) AS role_membership_count,
           has_schema_privilege(role.oid, 'public', 'CREATE') AS can_create_in_public_schema,
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
                AND (has_table_privilege(role.oid, relation.oid, 'TRUNCATE')
                  OR has_table_privilege(role.oid, relation.oid, 'TRIGGER')
                  OR has_table_privilege(role.oid, relation.oid, 'REFERENCES'))
           ) AS has_unsafe_protected_table_privileges,
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
  if (!role || role.protected_table_count !== protectedTables.length || role.rolsuper || role.rolbypassrls || role.rolcreatedb || role.rolcreaterole || role.rolreplication || role.role_membership_count !== 0 || role.can_create_in_public_schema || role.has_unsafe_protected_table_privileges || role.owns_protected_table) {
    throw new ProductionDatabaseGuardError('The production API database role must be restricted and must not own protected tables.')
  }
}

export async function assertCurrentMigrations(pool: Pick<Pool, 'query'>): Promise<void> {
  const [recorded, expected] = await Promise.all([
    pool.query<{ name: string; checksum: string }>('SELECT name, checksum FROM aduen_schema_migrations'),
    readMigrations(),
  ])
  const actualChecksums = new Map(recorded.rows.map((row) => [row.name, row.checksum]))
  if (actualChecksums.size !== expected.length || expected.some((migration) => actualChecksums.get(migration.name) !== migration.checksum)) {
    throw new ProductionDatabaseGuardError('The production API database schema does not match this service. Apply the database migrations before startup.')
  }
}
