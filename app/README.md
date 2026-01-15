# Tuntiva web prototype

This directory contains the first interactive Tuntiva prototype. It currently supports:

- product-boundary acknowledgement;
- urgent-risk triage that stops the ordinary flow;
- transaction, issue, and remedy capture;
- automatic draft saving in the current browser; and
- explicit draft deletion.

The prototype has no server or account system. Case data is stored in browser `localStorage` under `tuntiva.case-draft.v1`. Do not use it for real consumer evidence.

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
npm run build
```

## Current boundary

Evidence upload, extraction, completeness checks, routing, complaint packs, accounts, and external submission are not implemented. The governing requirements remain in [`../docs`](../docs/00_PRODUCT_INDEX.md).
