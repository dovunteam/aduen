# Aduen web prototype

This directory contains the first interactive Aduen prototype. It currently supports:

- product-boundary acknowledgement;
- urgent-risk triage that stops the ordinary flow;
- transaction, issue, remedy, promise, and merchant-contact capture;
- original evidence storage with SHA-256 integrity hashes;
- local text, image, and PDF previews with original-download controls;
- text and image redacted-copy workflows that leave originals unchanged;
- on-device PDF page redaction with flattened, image-only copies that leave originals unchanged;
- bounded plain-text and searchable-PDF extraction plus on-device OCR for images and scanned PDFs, with user confirmation or correction;
- issue-specific completeness checks and a sourced chronology;
- versioned merchant-first routing;
- structured manual-review brief export for uncertain routes, without original evidence bytes;
- user-reviewed PDF complaint packs;
- separate local operator review checklist for pilot release before pack export;
- submission and outcome tracking;
- a returning-user case workspace with guided resumption, progress, purchase summary, searchable evidence, missing-item counts, pack version history, and recent case activity;
- local follow-up reminders on the workspace, using the user's chosen date and hidden after a recorded outcome;
- complete ZIP export, local activity history, operator release review, configurable local retention expiry, and explicit local deletion; and
- recovery of the previous valid case autosave if the latest local case record becomes unreadable, with a visible notice and activity entry.

The app stores structured case data in `localStorage`; evidence originals and metadata use separate IndexedDB stores. Evidence, extracted text, and complaint packs stay on the user's device. The app has no sign-in, account, API, analytics, or upload path for case data. The static site can be hosted without running an Aduen server. Clearing browser data or changing devices can remove access to a case, so users can export a complete copy for backup.

## Deploy to Vercel

The repository-root `vercel.json` configures this Vite app as a static Vercel project. Import the repository into Vercel and keep the project root set to the repository root. Vercel installs from `app/package-lock.json`, runs the app's production build (including copying the on-device OCR engine and language files), and publishes `app/dist`. The configuration also provides the single-page-app fallback, browser security headers, and static asset caching. No environment variables or Aduen API service are required.

The deployment serves only the browser app; the separate `service/api` experiment is not deployed or connected. Case data remains in each user's browser storage, so it is not shared between devices or browser origins. Use synthetic case information while evaluating the prototype.

Development, screenshots, and demonstrations use synthetic case details and files only. Do not enter real consumer case information as test data.

The separate synthetic-data case API in [`service/api`](../service/api/README.md) is not used or bundled by the app. It is an isolated future scaling experiment and requires separate review and deployment work before it could become a product feature. Static hosts that support the `_headers` convention can apply the baseline browser security headers in `public/_headers`.

Returning users with a saved case and accepted consent open directly into their workspace. Use **My case / Kes saya** to return from the workflow. Evidence counts use the existing completeness rules; they do not replace the full fact, scope, and route review. Pack history describes saved versions, including older approvals, without treating them as approval of subsequent edits. Follow-up reminders appear when the app is open; they are not background notifications or official deadlines.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Verify

```sh
npm run lint
npm test
npm run build
npx playwright install chromium # required once for browser tests
npm run test:e2e
```

`npm run test:e2e` runs the local Chromium suite. Use `npm run test:e2e:all` for the full configured browser matrix or `npm run test:e2e:firefox` for Firefox only.

## Pilot scorecard

The `score:pilot` command reads an anonymised CSV from the private pilot workspace; it does not read browser storage or evidence files. Include every started case, the final-ten denominator decision, and actual case revenue, operator time, and other variable costs such as acquisition, payment processing, extraction, and storage. Revenue should be net of refunds. The economics gate allocates revenue and costs across all started cases, so excluded or withdrawn cases still affect the result.

Required columns are `caseId,packApproved,merchantDecisionOrValidHandoff,preparationMinutesBefore,preparationMinutesWithAduen,clarificationEventsBefore,clarificationEventsWithAduen,paymentEvidence,materialError,finalCountDecision,operatorMinutes,revenue,otherVariableCosts`. Run the scorer from the repository root with an explicit labour rate:

```sh
run-aduen.bat pilot-score "C:\private-pilot\aduen-cases.csv" --operator-rate=120
```

Use `--institution-commitment=yes` only when a documented paid-pilot commitment exists in the private pilot register. Keep completed logs and payment records out of the repository.

## Current boundary

Accounts, staff review, live route verification beyond merchant-first, malware scanning, external submission, notifications, and production security controls are not implemented. The static-hosting header policy needs to be adopted and verified by a deployment host.

Local retention offers automatic deletion after 30 days, 90 days, or 12 months. Expiry is enforced the next time the app opens. Image and scanned-PDF OCR runs on-device with bundled English and Bahasa Malaysia models; every extracted candidate needs review, and every page still needs manual inspection for sensitive content. The OCR engine and language data are copied from locked npm dependencies during development startup and production builds.

PDF redaction renders pages locally and creates an image-only copy; inspect each page because text selection and vector detail are lost. The interface supports English and Bahasa Malaysia; source evidence and generated material keep their original language.
