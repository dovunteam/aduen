# Aduen

> Turn a failed purchase into a clear recovery path.

**Aduen** is a consumer case-preparation and recovery-routing prototype. It helps Malaysian consumers organise transaction evidence, understand the appropriate next step, prepare accurate complaint material, and track a case from merchant contact to an eligible external channel.

Aduen is designed for cases such as:

- goods or services not received;
- goods or services materially different from what was advertised;
- an agreed refund that has not arrived;
- an unresolved cancellation or billing dispute; and
- a merchant or platform that has stopped responding.

Aduen does not guarantee recovery, decide legal rights, file without the user's approval, act as a lawyer, or replace KPDN, the Tribunal for Consumer Claims Malaysia (TTPM), Bank Negara Malaysia, CAAM, MCMC, the police, or another competent authority.

## Core workflow

**Transaction record -> evidence timeline -> missing-information check -> channel recommendation -> user-approved complaint pack -> outcome tracking**

The initial product is deliberately narrow: ordinary Malaysian consumer purchases where the buyer has a receipt or payment record, can identify the seller, and seeks a concrete remedy such as delivery, replacement, repair, cancellation, or refund.

## Evidence standard

Aduen distinguishes four kinds of information:

1. **Original evidence** - receipts, invoices, order confirmations, payment records, policies, screenshots, messages, delivery records, and merchant responses.
2. **User statements** - the consumer's account of events and requested remedy.
3. **Aduen-derived data** - extracted dates, amounts, entities, deadlines, and a generated chronology.
4. **Official outcome** - a merchant response, platform decision, regulator communication, tribunal order, bank decision, or other external result.

Derived data never silently replaces original evidence.

## Research status

The Aduen product proposition is not yet validated. There is no evidence in this repository that consumers will pay for Aduen, that its complaint packs improve recovery rates, or that a sustainable institutional payer exists. Those questions must be tested with real, consented cases.

## Product status

An early local-first web prototype is available in [`app`](app/README.md). It covers consent and urgent triage, evidence capture, local previews and supported redacted copies, completeness checks, merchant-first routing, operator-reviewed complaint packs, outcome tracking, local audit history, retention expiry, and data export or deletion.

A separate synthetic-data [case API foundation](service/api/README.md) adds OIDC-protected structured-case storage with PostgreSQL ownership policies. The browser app is not connected to it by default; no identity provider or hosting environment is configured, and neither component is approved for real consumer records.

Regulator integration, legal review, account lifecycle, server-side evidence storage, and payment handling are not implemented.

## Run locally

Requires Node.js 24 and npm. From the repository root:

```sh
cd app
npm ci
npm run dev
```

Open the local URL printed by Vite. The API foundation has separate setup instructions in [`service/api/README.md`](service/api/README.md); it is synthetic-data infrastructure and is not connected to the browser app by default.

## Verify

Run these commands from `app`:

```sh
npm run lint
npm test
npm run build
npx playwright install chromium # required once for browser tests
npm run test:e2e
```

The repository also includes [`run-aduen.bat`](run-aduen.bat) for Windows. Its `verify` command runs the text and documentation checks, lint, unit tests, build, and Chromium end-to-end tests. The full CI workflow additionally verifies the PostgreSQL API setup and ownership policies with Docker.

## License

No license file is included. Public visibility does not grant permission to reuse or redistribute the code.
