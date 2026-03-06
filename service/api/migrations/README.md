# Case API database migration

Run `npm run build` then `DATABASE_URL_MIGRATOR=... npm run migrate` from this directory. The migration role must own the schema and must be able to grant table privileges to the pre-created, non-superuser `aduen_api` role. The API itself must use `DATABASE_URL` for that restricted runtime role.

The migration enables and forces PostgreSQL row-level security on both tables. The API starts a transaction and sets `aduen.user_sub` locally for each request. Never run the API as a table owner or superuser; PostgreSQL bypasses row policies for superusers. A `case_deleted` security event intentionally contains only the opaque identity-provider subject, case UUID, action, and time; define and apply a reviewed retention schedule before storing real user data.
