# Provider-neutral deployment contract

This document describes how to run the Aduen case API in an OCI-compatible container environment. It does not select an infrastructure, identity, database, secret-management, or backup vendor. The current repository contains no production deployment configuration, and the service remains a synthetic-data foundation. Completing this contract is not approval to accept real consumer records.

## Runtime topology

- Build the image from `service/api/Dockerfile` and deploy the resulting immutable image digest. The image listens on port `8080`, runs as the unprivileged `node` user, and includes a container health check for `/health/ready`.
- Run API replicas as stateless processes. Provide an externally operated PostgreSQL database over TLS. Do not expose PostgreSQL to browsers or the public network.
- Expose the API only through a TLS-terminating HTTPS ingress. Restrict direct access to the container port. Set `TRUSTED_PROXIES` to the ingress addresses that the API actually receives as its network peer; do not trust the entire cluster or public address space.
- The static browser application calls the API from the user’s browser. Set `VITE_API_BASE_URL` to the public HTTPS API base URL; if it contains a path prefix, route that prefix to the API’s `/v1` endpoints. Set the browser’s exact HTTPS origin in the API’s `CORS_ORIGINS`. Build the client with the provider-neutral `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`, `VITE_OIDC_REDIRECT_URI`, `VITE_OIDC_POST_LOGOUT_REDIRECT_URI`, and `VITE_OIDC_SCOPE` values. Register those redirect URIs and the API audience with the chosen OIDC issuer before enabling sign-in.

Each API process opens a PostgreSQL pool of up to 10 connections. Account for that pool across the maximum replica count and the database connection limit. Production rate-limit counters are shared in PostgreSQL, so all replicas must use the same `RATE_LIMIT_HMAC_KEY`. For rotation, set the new active key in `RATE_LIMIT_HMAC_KEY` and the old key in `RATE_LIMIT_HMAC_KEY_PREVIOUS` on every replica before rolling them; both namespaces are incremented and the higher count enforces the limit. After every replica has used both keys for at least one 60-second window, remove `RATE_LIMIT_HMAC_KEY_PREVIOUS`.

## Database roles and migrations

Provision a database, TLS certificate validation, and four distinct roles before deploying the API:

| Role | Use | Required boundary |
|---|---|---|
| Schema owner / migrator | One-shot migration job only | Owns schema and applies the versioned migrations; never supplied to API replicas |
| `aduen_api` | API runtime | Restricted login role; not a table owner, superuser, or RLS bypass role |
| `aduen_retention` | Scheduled expiry jobs | Can expire approved records through timestamp-only policies; cannot read case content or owner identifiers |
| `aduen_backup` | Isolated backup job only | Per-database SELECT grants plus `BYPASSRLS` for complete logical dumps; no write, database-creation, role-creation, replication, or superuser privileges |

For standard PostgreSQL, `service/api/deploy/postgres-roles.sql` creates the login roles and grants the minimum connection and schema privileges used by migrations and retention jobs. It also creates the intentionally privileged but read-only `aduen_backup` login with SELECT grants only on this database’s existing and future public-schema tables and sequences. Its `BYPASSRLS` attribute permits full-row dumps where forced RLS applies; it does not receive the cluster-wide `pg_read_all_data` role. Run the script once as the database administrator against the already-created database with `ADUEN_DATABASE_NAME`, `ADUEN_MIGRATOR_PASSWORD`, `ADUEN_API_PASSWORD`, `ADUEN_RETENTION_PASSWORD`, and `ADUEN_BACKUP_PASSWORD` injected through the operator’s secret facility. Keep the migrator credential available only to migration jobs and the backup credential available only to backup jobs. Managed database services can require translating role ownership and grants to their own supported workflow; if they prohibit `BYPASSRLS`, use a verified native full-database backup facility rather than weakening case policies. `service/api/docker/init-db.sh` is only for the local Compose bootstrap.

Provide a short-lived `DATABASE_URL_MIGRATOR` only to the migration job. Run `npm run migrate` from the API image once before rolling out new replicas. The migrator serializes concurrent runs and rejects changed or unknown migration history. Take and verify a pre-change backup before a schema rollout. Migrations are not automatically reversed; recover with a forward fix or the approved restore procedure.

API replicas use only `DATABASE_URL` for the restricted runtime role. Configure `DATABASE_SSL=true`; the client validates the server certificate. When TLS is enabled, database URLs must not include SSL-related query parameters because node-postgres applies those parameters over the explicit certificate validation settings. The API accepts request bodies up to 128 KiB and closes requests that take longer than 30 seconds to arrive. Startup checks the protected tables, elevated role privileges, explicit role memberships, `CREATE` on the public schema, table privileges that bypass row-level security or create triggers/references, ownership boundaries, and exact migration ledger. The API role is expected to use direct grants only. A failed guard must stop rollout rather than trigger a permissive fallback.

## API environment

Inject these values through the runtime’s secret and configuration facilities. Do not bake credentials into the image or browser bundle.

| Variable | Required production value |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` / `PORT` | Bind to the container interface and the port exposed by the image, normally `0.0.0.0` / `8080` |
| `DATABASE_URL` | Restricted `aduen_api` login URL |
| `DATABASE_SSL` | `true` |
| `AUTH_ISSUER` | HTTPS issuer matching the access token’s `iss` claim |
| `AUTH_JWKS_URL` | HTTPS JWKS endpoint for the configured issuer |
| `AUTH_AUDIENCE` | API audience registered with the issuer |
| `AUTH_MAX_TOKEN_AGE_SECONDS` | Explicit whole-second maximum from 60 to 86400; default is 3600 |
| `CORS_ORIGINS` | Comma-separated exact HTTPS browser origins; no paths or wildcard |
| `TRUSTED_PROXIES` | Exact ingress peer IP addresses or CIDRs observed by the API |
| `RATE_LIMIT_HMAC_KEY` | Random secret with at least 32 UTF-8 bytes, identical across replicas |
| `RATE_LIMIT_HMAC_KEY_PREVIOUS` | Optional prior rate-limit key used temporarily during a coordinated rotation |
| `METRICS_BEARER_TOKEN` | Random secret with at least 32 UTF-8 bytes; keep it only in the scraper and API secret stores |
| `HOSTED_CASE_RETENTION_DAYS` | Explicit policy-approved whole number from 1 to 3650 |

The issuer does not need to be a specific vendor. Its access tokens must use RS256 or ES256, include `iss`, `sub`, `aud`, `iat`, and `exp`, and be verifiable at the configured JWKS endpoint. The API rejects identity endpoint URLs with embedded credentials or fragments. Offline refresh is disabled in the client. Account recovery, logout/session revocation, issuer registration, and the production redirect policy still need explicit review.

The migration job additionally needs `DATABASE_URL_MIGRATOR` and `DATABASE_SSL=true`. Scheduled maintenance containers need `DATABASE_URL_MAINTENANCE`, `DATABASE_SSL=true`, `AUDIT_RETENTION_DAYS`, or `HOSTED_CASE_RETENTION_DAYS` according to the command being run. Backup jobs need `DATABASE_URL_BACKUP` for `aduen_backup`, plus `BACKUP_ACTIVE_KEY_ID`, `BACKUP_ENCRYPTION_KEYRING`, and an absolute `BACKUP_SCRATCH_DIR` when opening archives. These credentials are separate from the API runtime URL and must not be provided to web clients.

## Release and operations sequence

1. Approve the data purpose, privacy notice, account lifecycle, audit and hosted-case retention periods, expiry cadence, backup expiry, recovery objectives, and incident process. Do not enable real-record intake while these decisions are open.
2. Provision the database roles, TLS, network rules, secret injection, and a production OIDC registration. Set the retention value only after policy approval.
3. Review the dependency audit and CI scan for high or critical image vulnerabilities. Download the 90-day `aduen-api-tested-image` artifact. Verify `api-image.tar` with `sha256sum -c api-image.tar.sha256`. Extract its config path from `manifest.json`, hash that config blob, and compare the result with `image_id` in `api-image-metadata.txt`; Docker engines can report different local image IDs after loading even when the archive config and layers match. Load the archive with `docker load --input api-image.tar` and confirm the per-commit `image` tag from the metadata can be inspected. This is the same content-addressed image that CI tested and scanned. Retag and push it to the selected OCI registry, record that registry's immutable digest, and scan the pushed image again under the runtime's security policy. Build the browser application with the production API base URL and OIDC public settings. Register both browser redirect URIs with the issuer.
4. Apply migrations with the separate migrator job. Verify the migration ledger and runtime role using the restricted API connection before shifting traffic.
5. Roll out the API image behind HTTPS ingress. Route readiness from `/health/ready`; use `/health/live` only to detect a failed process. Allow at least 30 seconds for graceful `SIGTERM` shutdown so in-flight requests can finish; the Compose example sets this grace period. Verify CORS and browser security headers at the deployed origins.
6. Schedule one-shot maintenance containers from the same immutable API image: run `node dist/pruneAudit.js` with `DATABASE_URL_MAINTENANCE` and approved `AUDIT_RETENTION_DAYS`; run `node dist/pruneHostedCases.js` with the maintenance URL and the same approved `HOSTED_CASE_RETENTION_DAYS` as the API. (The local npm scripts build first and are for development.) Alert on nonzero job exits without logging credentials or case data.
7. Configure encrypted PostgreSQL backups with `backupArchiveCli.js seal`, retain key IDs and prior decryption keys according to the approved recovery policy, and restore into an isolated database owned by `aduen_migrator` using `backupArchiveCli.js open` before `pg_restore` as that role. For PostgreSQL command-line tools using libpq, set `PGSSLMODE=verify-full`; set `PGSSLROOTCERT` to the trusted CA file when it is not in libpq's system trust store. Each database URL hostname must match its server certificate, and URLs must not contain SSL parameters that override these settings. Use shell `pipefail` for dump-to-encryption pipelines so failed dumps cannot be mistaken for complete archives. Run and record recurring restore drills.
8. Verify owner isolation, access/deletion/export behavior, database TLS and role restrictions, ingress proxy trust, rate limiting, secret rotation, retention jobs, backup restoration, request-log redaction, and incident response before considering real-record intake.

## Readiness signals and remaining gates

`/health/live` reports process liveness. `/health/ready` checks database connectivity. In production it also ensures that the configured OIDC JWKS has a non-empty, fresh key set; the key set is refreshed when absent or stale, and readiness returns 503 when that refresh fails. Local development can use the placeholder issuer in `.env.example` without a live OIDC service. The endpoint does not test ingress or browser configuration. Authentication requests return unavailable when JWKS retrieval fails. `/metrics` serves Prometheus text format after validating `Authorization: Bearer <METRICS_BEARER_TOKEN>`; keep the route private to the scraper network and rotate the token through the secret store. It reports route-template request counts and latency histograms, process uptime, and PostgreSQL pool total, idle, and waiting connections. Labels use registered route templates and never include case IDs, subjects, query strings, or request data. Monitor these signals, health checks, migration failures, retention-job exits, and backup/restore outcomes using infrastructure monitoring that does not capture request bodies, tokens, owner subjects, case identifiers, or query strings.

`service/api/ops/prometheus-scrape.example.yml` shows a private HTTPS scrape using a bearer-token file; replace its example target and mount the token through the Prometheus secret facility. It uses the `aduen-api` job label expected by `service/api/ops/aduen-alerts.yml`, which provides alerts for scrape outages, sustained 5xx responses, elevated request latency, and PostgreSQL pool waiters. Route alert notifications through the selected operations system; these files do not create notification channels or alerts for scheduled job outcomes.

This runbook does not provide an infrastructure-specific deployment, scheduler, monitoring integration, production OIDC registration, managed secret store, backup target, or retention schedule. Those must be selected and verified for the chosen operating environment before the service can be treated as production-ready.
