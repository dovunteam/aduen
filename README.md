# Aduen

> Turn a failed purchase into a clear recovery path.

**Aduen** is a consumer case-preparation and recovery-routing product by DOVUN. It helps Malaysian consumers organise transaction evidence, understand the appropriate next step, prepare accurate complaint material, and track a case from merchant contact to an eligible external channel.

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

## Documentation

Start with [the documentation index](docs/00_PRODUCT_INDEX.md).

## Research status

The underlying consumer problem is documented. KPDN's national e-commerce review reports 10,488 online-transaction complaints in 2024, including 5,422 complaints for goods or services not received and 2,019 for goods or services not as advertised.

The Aduen product proposition is not yet validated. There is no evidence in this repository that consumers will pay for Aduen, that its complaint packs improve recovery rates, or that a sustainable institutional payer exists. Those questions must be tested with real, consented cases.

## Product status

An early local-first web prototype is available in [`app`](app/README.md). It now covers the core workflow from consent and urgent triage through evidence capture, local previews and supported redacted copies, completeness checks, merchant-first routing, operator-reviewed user-approved PDF packs, outcome tracking, local audit history, configurable local retention expiry, and data export or deletion. A separate synthetic-data [case API foundation](service/api/README.md) adds OIDC-protected structured-case storage with PostgreSQL ownership policies, but the browser app is not connected to it, no identity provider or hosting environment is configured, and it is not approved for real consumer records. Aduen still has no regulator integration, legal review, account lifecycle, server-side evidence storage, or payment handling.

## Quick run and verify

On Windows, double-click [`run-aduen.bat`](run-aduen.bat) to start the development server and open the local page. To run a specific command from Command Prompt, use `run-aduen.bat test`, `run-aduen.bat lint`, `run-aduen.bat build`, `run-aduen.bat e2e`, or `run-aduen.bat verify`. Verification checks the tracked tree for em dashes and validates the product-document index. The batch file's browser checks use Chromium; run `npm run test:e2e` from `app` when you want the full configured browser matrix.
