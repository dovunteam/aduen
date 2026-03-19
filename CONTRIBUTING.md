# Contributing to Aduen

Thanks for helping improve Aduen. Contributions should keep the project useful as a local-first, synthetic-data prototype and preserve the boundaries described in the [README](README.md).

## Before making a change

- For a substantial feature or behavior change, open an issue or discussion first so its scope and product impact can be agreed with maintainers.
- Keep changes focused and explain the user problem they address.
- Do not include real consumer records, evidence, credentials, access tokens, or personal data in code, issues, pull requests, screenshots, fixtures, or logs. Use synthetic examples only.
- Preserve the distinction between original evidence, user statements, Aduen-derived data, and official outcomes. Do not add claims of legal eligibility, guaranteed recovery, or automatic external filing.
- Keep English and Bahasa Malaysia interface support in sync when changing user-facing text.

## Development setup

The browser app requires Node.js 24 and npm:

```sh
cd app
npm ci
npm run dev
```

The separate API setup, including its synthetic local database, is documented in [service/api/README.md](service/api/README.md). Do not connect it to real consumer records.

## Checks

From `app`, run the checks relevant to your change:

```sh
npm run check:encoding
npm run check:docs
npm run lint
npm test
npm run build
npm run test:e2e
```

For API changes, from `service/api`, run:

```sh
npm test
```

Database policy changes also need the PostgreSQL integration suite described in the API README. Report checks you could not run and why.

## Pull requests

- Describe the problem, the change, and any user-visible behavior or data-handling impact.
- Include focused tests or update existing tests for behavior changes.
- Call out migration, configuration, retention, privacy, and security implications where relevant.
- Keep generated output, dependency lockfile changes, and unrelated formatting out of the pull request unless required by the change.
- Do not claim production readiness. Production deployment and real-record intake remain outside the current project boundary.

By submitting a contribution, you agree that it may be distributed under the repository's [MIT License](LICENSE). No separate contributor license agreement is currently required.
