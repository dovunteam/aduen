# Tuntiva web prototype

This directory contains the first interactive Tuntiva prototype. It currently supports:

- product-boundary acknowledgement;
- urgent-risk triage that stops the ordinary flow;
- transaction, issue, remedy, promise, and merchant-contact capture;
- original evidence storage with SHA-256 integrity hashes;
- issue-specific completeness checks and a sourced chronology;
- versioned merchant-first routing;
- user-reviewed PDF complaint packs;
- submission and outcome tracking; and
- complete ZIP export and explicit local deletion.

The prototype has no server or account system. Structured case data is stored in browser `localStorage`; evidence originals and metadata use separate IndexedDB stores. Do not use it for real consumer evidence.

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
```

## Current boundary

Accounts, OCR/extraction, staff review, live official-route verification, malware scanning, external submission, notifications, and production security controls are not implemented. The governing requirements remain in [`../docs`](../docs/00_PRODUCT_INDEX.md).
