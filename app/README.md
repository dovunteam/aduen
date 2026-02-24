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
- complete ZIP export, local activity history, and explicit local deletion; and
- recovery of the previous valid case autosave if the latest local case record becomes unreadable, with a visible notice and activity entry.

The prototype has no server or account system. Structured case data is stored in browser `localStorage`; evidence originals and metadata use separate IndexedDB stores. Do not use it for real consumer evidence.

Returning users with a saved case and accepted consent open directly into their workspace. Use **My case / Kes saya** to return from the workflow. Evidence counts use the existing completeness rules; they do not replace the full fact, scope, and route review. Pack history describes saved versions, including older approvals, without treating them as approval of subsequent edits. Follow-up reminders appear when the app is open; they are not background notifications or official deadlines.

## Run locally

Requires Node.js 24 or a compatible current Node.js release.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite.

## Verify

```sh
npm run lint
npm test
npm run build
npm run test:e2e
```

`npm run test:e2e` runs the local Chromium suite. Use `npm run test:e2e:all` for the full configured browser matrix or `npm run test:e2e:firefox` for Firefox only.

## Current boundary

Accounts, staff review, live official-route verification beyond merchant-first, malware scanning, external submission, notifications, and production security controls are not implemented. Image and scanned-PDF OCR runs on-device with bundled English and Bahasa Malaysia models; OCR can misread or miss content, so every extracted candidate requires review and every page still needs manual inspection for sensitive content. The OCR engine and language data are copied from locked npm dependencies during development startup and production builds. PDF redaction renders pages locally and produces an image-only copy; inspect every page because text selection and vector detail are lost. English and Bahasa Malaysia are available for the prototype interface; source evidence and generated material retain their original language. See the [implementation ledger](../docs/Aduen_Implementation_Status.md) and governing [product documentation](../docs/00_PRODUCT_INDEX.md).
