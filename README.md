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

This repository focuses on completing a local-first app using synthetic development and demo data. It does not claim that consumers will pay for Aduen or that its complaint packs improve recovery rates.

## Product status

The local-first web app is available in [`app`](app/README.md). Case records and evidence remain in the user's browser storage on their device. The app requires no account, hosted case service, or backend deployment.

The repository includes a root-level [`vercel.json`](vercel.json) for deploying the Vite app from `app/` as a static Vercel project. See the [Vercel deployment instructions](app/README.md#deploy-to-vercel).

Use synthetic case details and files for development, screenshots, and demonstrations. Do not use real consumer case information as test data.

A separate synthetic-data [case API experiment](service/api/README.md) is isolated from the browser app and is not needed to build, run, or use it. It can inform a future scaling phase if the product direction changes.

Regulator integration, legal review, account lifecycle, server-side evidence storage, and payment handling are not implemented.

## Run locally

Requires Node.js 24 and npm. From the repository root:

```sh
cd app
npm ci
npm run dev
```

Open the local URL printed by Vite. No server setup or account configuration is needed.

## Verify

Run these commands from `app`:

```sh
npm run lint
npm test
npm run build
npx playwright install chrome # required once for browser tests
npm run test:e2e
```

The repository also includes [`run-aduen.bat`](run-aduen.bat) for Windows. Its `verify` command runs the text and documentation checks, lint, unit tests, build, and Chrome end-to-end tests. The full CI workflow additionally verifies the PostgreSQL API setup and ownership policies with Docker.

## Contributing and security

Contribution guidance is in [CONTRIBUTING.md](CONTRIBUTING.md), and project participation follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report security issues privately using the process in [SECURITY.md](SECURITY.md).

## License

This repository's original code and documentation are provided under the [MIT License](LICENSE). Third-party dependencies and assets remain subject to their own licenses and notices.
