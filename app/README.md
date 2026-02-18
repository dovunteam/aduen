# Aduen web prototype

This directory contains the first interactive Aduen prototype. It currently supports:

- product-boundary acknowledgement;
- urgent-risk triage that stops the ordinary flow;
- transaction, issue, remedy, promise, and merchant-contact capture;
- original evidence storage with SHA-256 integrity hashes;
- local text, image, and PDF previews with original-download controls;
- text and image redacted-copy workflows that leave originals unchanged;
- on-device PDF page redaction with flattened, image-only copies that leave originals unchanged;
- bounded plain-text and searchable-PDF text extraction with user confirmation or correction (scanned PDFs remain manual-review only);
- issue-specific completeness checks and a sourced chronology;
- versioned merchant-first routing;
- user-reviewed PDF complaint packs;
- submission and outcome tracking;
- complete ZIP export, local activity history, and explicit local deletion; and
- recovery of the previous valid case autosave if the latest local case record becomes unreadable, with a visible notice and activity entry.

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
npm run test:e2e
```

## Current boundary

Accounts, image OCR, staff review, live official-route verification beyond merchant-first, malware scanning, external submission, notifications, and production security controls are not implemented. Searchable PDF text can be extracted locally; scanned PDFs and images are not OCR processed. PDF redaction renders pages locally and produces an image-only copy; inspect every page because text selection and vector detail are lost, and the tool cannot detect sensitive content automatically. English and Bahasa Malaysia are available for the prototype interface; source evidence and generated material retain their original language. See the [implementation ledger](../docs/Aduen_Implementation_Status.md) and governing [product documentation](../docs/00_PRODUCT_INDEX.md).
