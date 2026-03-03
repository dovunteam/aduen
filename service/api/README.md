# Aduen case API foundation

This Node.js 24 service is the first hosted-service slice. It validates an externally issued OIDC access token, uses its opaque `sub` as the case owner, stores structured case records in PostgreSQL, enforces owner scoping in both parameterized queries and PostgreSQL row-level security, and requires an ETag revision for case updates and deletion.

## Local development

1. Copy `.env.example` at the repository root to `.env`; replace both local-only passwords with different random values and percent-encode reserved URL characters in the two database URLs.
2. Start the local database: `docker compose up -d database`.
3. Build the API image and apply the schema: `docker compose --profile tools run --build --rm migrate`.
4. In a second terminal, run the row-policy integration check from `service/api`: set `DATABASE_URL` to the runtime-role URL and run `npm run test:postgres`.
5. Start the API: `docker compose up --build api`.
6. Check `http://127.0.0.1:8080/health/ready`.

The example identity-provider URLs deliberately use the reserved `.invalid` domain. Configure a real OIDC issuer, JWKS URI, and API audience before testing authenticated routes. The local Compose ports bind to loopback only. Do not place real consumer records in this development environment.

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

Required environment values: `DATABASE_URL`, `AUTH_ISSUER`, `AUTH_JWKS_URL`, `AUTH_AUDIENCE`, and `CORS_ORIGINS`. `CORS_ORIGINS` is a comma-separated list of exact browser origins (scheme, host, and optional port only); wildcard origins are rejected. The API permits only the methods and headers needed by the case routes and exposes `ETag` for revision-aware browser updates. `PORT` defaults to `8080`; `HOST` defaults to `127.0.0.1`. Production additionally requires `NODE_ENV=production`, `DATABASE_SSL=true`, an HTTPS issuer and JWKS URL, TLS certificate validation for PostgreSQL, and a trusted TLS-terminating ingress. Keep the API port private to that ingress. Apply `migrations/001_case_records.sql` with a schema-owner migrator after pre-creating the restricted `aduen_api` database role; the service must never use a superuser or table-owner connection.

## Current limits

The app now has a tested bearer-token and ETag-aware API client, but it is not wired into the workflow; no identity provider or hosting environment is configured. The client intentionally does not migrate or upload local browser records. The API stores only the structured `CaseRecord`; original evidence, extraction data, packs, consent, and other repositories remain in browser storage. The API rate limiter is per process and memory backed. The audit-event retention schedule, authentication account lifecycle and recovery, operational key rotation, backups and restoration, malware scanning, monitoring, incident response, privacy review, and production deployment controls still need implementation and review. This foundation is for synthetic development only and does not authorize real-record intake.
