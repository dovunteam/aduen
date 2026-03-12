# Aduen case API foundation

This Node.js 24 service is the first hosted-service slice. It validates an externally issued OIDC access token, uses its opaque `sub` as the case owner, stores structured case records in PostgreSQL, enforces owner scoping in both parameterized queries and PostgreSQL row-level security, and requires an ETag revision for case updates and deletion.

## Local development

1. Copy `.env.example` at the repository root to `.env`; replace both local-only passwords with different random values and percent-encode reserved URL characters in the two database URLs.
2. Start the local database: `docker compose up -d database`.
3. Build the API image and apply the schema: `docker compose --profile tools run --build --rm migrate`. The migrator records applied SQL checksums in `aduen_schema_migrations`, rejects edited or unknown migrations, and serializes concurrent migrator runs with a PostgreSQL advisory lock. Production API startup verifies that the database has the exact migration set shipped by the image. Add a new numbered migration instead of changing an applied migration.
4. In a second terminal, run the row-policy integration check from `service/api`: set `DATABASE_URL` to the runtime-role URL and run `npm run test:postgres`.
5. Start the API: `docker compose up --build api`.
6. Check `http://127.0.0.1:8080/health/ready`.

The example identity-provider URLs deliberately use the reserved `.invalid` domain. Configure a real OIDC issuer, JWKS URI, and API audience before testing authenticated routes. The local Compose API and one-shot database jobs run with a read-only root filesystem, a restricted `/tmp`, no Linux capabilities, no privilege escalation, and a PID limit. The local Compose ports bind to loopback only. Do not place real consumer records in this development environment.

The API image exposes port `8080` and includes a container health check against `/health/ready`. It reports healthy only when the process can reach PostgreSQL; a deployment runtime should use this signal for readiness and remove unhealthy instances from traffic. Keep the API port private behind a TLS-terminating ingress and preserve the image's non-root user. The probe does not validate OIDC discovery or ingress configuration.

## Endpoints

- `GET /health/live` reports that the process is accepting requests.
- `GET /health/ready` checks database connectivity.
- `GET /v1/cases?limit=50&cursor=...` returns an owner-scoped page.
- `POST /v1/cases` creates a validated case record.
- `GET /v1/cases/:id` reads an owner-scoped case.
- `PUT /v1/cases/:id` replaces a case only with its current `If-Match: "revision"` ETag.
- `DELETE /v1/cases/:id` requires the current ETag and removes the case row.

All `/v1` routes require an `Authorization: Bearer` token signed with RS256 or ES256 by the configured issuer, with the configured audience, `sub`, and `exp`. Responses set `Cache-Control: no-store` and a random `X-Request-Id`. Structured request logs contain only that ID, the route template, method, status, and duration; they omit case IDs, query strings, IP addresses, tokens, user subjects, and request bodies. Mutation events store only the issuer subject, case UUID, action, and timestamp. Invalid tokens are rejected; an unavailable JWKS endpoint returns 503 and the case request is not processed.

## Configuration

Required environment values: `DATABASE_URL`, `AUTH_ISSUER`, `AUTH_JWKS_URL`, `AUTH_AUDIENCE`, and `CORS_ORIGINS`. `CORS_ORIGINS` is a comma-separated list of exact browser origins (scheme, host, and optional port only); wildcard origins are rejected. The API permits only the methods and headers needed by the case routes and exposes `ETag` for revision-aware browser updates. `PORT` defaults to `8080`; `HOST` defaults to `127.0.0.1`. PostgreSQL connections have a 3-second connection timeout, 10-second server-side statement and idle transaction limits, and a 12-second client query timeout. `AUTH_MAX_TOKEN_AGE_SECONDS` defaults to 3600 and accepts whole seconds from 60 through 86400; tokens must include `iat` and must not exceed that age, even when their `exp` is further in the future. Production additionally requires `HOSTED_CASE_RETENTION_DAYS` (1–3650 whole days, selected by the service operator), `NODE_ENV=production`, `DATABASE_SSL=true`, an HTTPS issuer and JWKS URL, TLS certificate validation for PostgreSQL, a trusted TLS-terminating ingress, `TRUSTED_PROXIES` containing that ingress's exact IP/CIDR allowlist, and a `RATE_LIMIT_HMAC_KEY` with at least 32 UTF-8 bytes. Keep the API port private to that ingress. Apply all four migrations with a schema-owner migrator after pre-creating the restricted `aduen_api` and `aduen_retention` roles; the API itself must never use a superuser or table-owner connection. In production, startup checks that all three protected tables exist and that the connected role has no superuser, RLS-bypass, database-creation, role-creation, or replication privileges and is not an owner or member of an owning role.

The separately scheduled audit expiry command requires `DATABASE_URL_MAINTENANCE` and `AUDIT_RETENTION_DAYS` (1–3650 whole days). The maintenance role can inspect timestamps only and can delete audit rows older than the cutoff; it cannot read case data or audit event details. Set the period and job cadence only after approving the audit retention schedule. For local development, run `npm run prune:audit` from this directory after setting the two variables. The Compose `prune-audit` service runs the same one-shot job.

CI creates a PostgreSQL custom-format dump from synthetic data, restores it into a fresh database, and reruns the ownership and retention integration suite against the restored copy. This verifies the schema and row policies survive a logical restore. Production still needs an operator-selected backup facility with encryption, access controls, retention and deletion schedules, recovery objectives, and recurring restore drills.

Hosted case content also requires an explicitly approved inactivity-retention period. Set `HOSTED_CASE_RETENTION_DAYS` from 1 to 3650 whole days in production; API startup fails when it is missing or invalid. The one-shot `npm run prune:hosted-cases` job deletes hosted cases whose last server update is older than that cutoff and emits only the deleted count and cutoff. The maintenance role can see only `updated_at` for eligible rows and cannot read case records, owner subjects, or case IDs. Schedule the Compose `prune-hosted-cases` job at a cadence approved with the retention policy; no production period or cadence is selected by this repository.

## Current limits

The web app has a tested bearer-token and ETag-aware API client plus provider-neutral OIDC sign-in. When configured, users can manually save the structured case record and list or delete account-owned hosted copies in Data Controls. No identity provider or hosting environment is configured. The client does not automatically migrate browser records; manual hosted saves explicitly send the active structured case record. The API stores only the structured `CaseRecord`; original evidence, extraction data, packs, consent, submission details, and other repositories remain in browser storage. Hosted structured copies can be copied into a new local draft only when the browser has no case-related data; the hosted copy remains unchanged. Evidence, packs, and submission details are omitted, so this is not full cross-device recovery. Audit and hosted-case retention jobs are implemented, but no legally reviewed retention periods or scheduler are configured. Production rate limits use shared PostgreSQL fixed-window counters keyed by HMAC-SHA256 client-IP digests from explicitly trusted proxies; expired rows are pruned incrementally. Health routes are exempt. Development and tests use the in-memory limiter. Authentication account lifecycle and recovery, operational HMAC key rotation, backups and restoration, malware scanning, monitoring, incident response, privacy review, and production deployment controls still need implementation and review. This foundation is for synthetic development only and does not authorize real-record intake.
