# Side-Effect Boundaries

## Capability Family

- **Capability family:** Browser File I/O and Downloads
- **Boundary review date:** 2026-07-26

## Boundary Categories

|Category|Description|Allowed examples|
|:---|:---|:---|
|Pure core|Deterministic transformation of explicit inputs into explicit outputs.|Normalize filename, choose charset suffix, build accept string from descriptors.|
|Browser adapter|Thin wrapper around browser APIs.|`FileReader`, `File.text`, `File.arrayBuffer`, `Blob`, `URL.createObjectURL`, anchor click.|
|Storage adapter|Controlled persistence boundary.|IndexedDB, localStorage, File System Access API, OPFS.|
|DOM adapter|Rendering or event collection boundary.|Read file input event, attach click listener, update status text.|
|Vendor adapter|Stable wrapper around third-party library APIs.|JSZip, SheetJS, N3, jsonld, rdflib.|
|Node adapter|Optional server-side processing boundary.|Node `fs`, streams, Buffer.|

## Boundary Table

|ID|Function|Current category|Target category|Side effects|Reads from|Writes to|Adapter needed?|Worker-safe?|Node-safe?|Notes|
|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---|
|BOUND-001|BFI-001 `downloadTextFile`|Browser adapter|Browser adapter composed from pure Blob and DOM download helpers|Creates Blob, object URL, anchor, DOM append/click/remove, URL revoke|Explicit text args and optional MIME from caller or format registry|Browser download prompt|No|No|No|Canonical owner is browser-file-io.|
|BOUND-002|Canonical `createTextBlob`|Not yet present|Pure core / browser primitive factory|Creates a `Blob` object but no DOM or URL mutation|Explicit text/options|Return value only|No|Yes if `Blob` exists|No, unless Node Blob baseline is declared|Useful testable layer under `downloadTextFile`.|
|BOUND-003|Canonical `downloadBlob`|Not yet present|Browser adapter|Object URL lifecycle and anchor click|Blob and filename|Browser download prompt|No|No|No|Central side-effect boundary for text and binary files.|
|BOUND-004|BFI-003/BFI-010/BFI-014/BFI-024 `readFileAsText`|Browser adapter|Browser adapter|Reads user-selected file|Browser File/Blob|Promise result only|No|Maybe, in workers with FileReader/File API|No|Canonical should not touch DOM or app state.|
|BOUND-005|BFI-025/BFI-027 `readFileAsArrayBuffer`|Browser adapter|Browser adapter|Reads user-selected file|Browser File/Blob|Promise result only|No|Maybe, in workers with File API|No|Prefer native File API with fallback if baseline allows.|
|BOUND-006|BFI-002 `getAcceptExtensions` / `createAcceptAttribute`|Pure browser-adjacent adapter helper|Pure browser-adjacent adapter helper|None|Format descriptors, extensions, or MIME strings|String return|No|Yes|Yes|Canonical owner is browser-file-io as `createAcceptAttribute`; descriptors come from format-registry.|
|BOUND-007|BFI-007/BFI-008/BFI-012/BFI-018/BFI-020/BFI-023 mixed read+parse flows|DOM/browser/vendor/storage mix|App adapter plus downstream domain packages|File reads, parser execution, logging, state/storage mutation|Files, DOM state, IndexedDB/local app state|App state/storage/UI|Yes|No|No|Do not promote whole functions. Split at file read boundary.|
|BOUND-008|BFI-021/BFI-022 run download workflows|Storage adapter plus browser adapter|App adapter|Reads stored run, serializes text, downloads|IndexedDB/app storage|Download prompt/status UI|Yes|No|No|Shared package only owns final download call.|
|BOUND-009|BFI-013/inline Blob exports|DOM/browser adapter inside UI function|Browser adapter through canonical helper|Blob/object URL/anchor click|App object/text|Download prompt|Yes|No|No|Replace inline code with `downloadTextFile` or `downloadBlob`.|

## Side-Effect Rules

- Pure helpers in this capability may build strings and option objects, but must not reference `window`, `document`, DOM nodes, `localStorage`, IndexedDB, File System Access API, OPFS, network APIs, or Node globals.
- Browser adapters may reference `File`, `FileReader`, `Blob`, `URL.createObjectURL`, and `document`, but they must not parse ontology/tabular data or mutate app state.
- Download helpers must own object URL cleanup and anchor element cleanup.
- File-read helpers must return data only. They must not log, toast, parse, or write storage.
- Vendor parsing libraries such as JSZip, SheetJS, N3, jsonld, and rdflib belong to later or adjacent capability packages, not the browser-file-io package.
- App adapters may preserve old function names temporarily, but should call canonical helpers at the browser boundary.

## Refactor Plan

|Refactor ID|Problem|Target boundary|Affected functions|Required tests|Migration notes|
|:---|:---|:---|:---|:---|:---|
|REF-001|Promoted download helper previously lived under `format-registry`|Completed: `packages/browser-file-io/src/download-text-file.js` owns the helper and app shared package copies import it there|BFI-001 and all wrappers|Mock `Blob`, `URL.createObjectURL`, anchor append/click/remove, MIME/charset behavior|Do not re-export download helpers from format-registry.|
|REF-002|Multiple FileReader text readers with slightly different error behavior|Canonical `readFileAsText` browser adapter|BFI-003, BFI-010, BFI-014, BFI-024|Mock successful read, empty result, native error, setup throw|Use Table Nova error model.|
|REF-003|ArrayBuffer readers split between FileReader and `file.arrayBuffer()`|Canonical `readFileAsArrayBuffer` with selected baseline/fallback|BFI-025, BFI-027|Mock native File API success/failure and FileReader fallback if included|Document browser baseline.|
|REF-004|App workflows mix file read with parsing/storage|Thin app adapters calling canonical read functions|BFI-007, BFI-008, BFI-009, BFI-012, BFI-018, BFI-020, BFI-023|App adapter tests only where behavior differs|Do not move parser logic in this cycle.|
|REF-005|Argument-order divergence for downloads|Canonical filename-first API plus temporary adapters|BFI-015, BFI-017, BFI-019, BFI-026, BFI-028|Adapter tests for old order where retained|Migration docs should list old-to-new signatures.|
|REF-006|Inline Blob downloads remain in some UI files|Replace with canonical `downloadTextFile` or `downloadBlob`|BFI-006, BFI-013|One smoke test per adapter or manual verification if UI-only|Low-risk cleanup after package extraction.|

## Package and Vendor Notes

- No vendor code should be stored in `browser-file-io`. Browser APIs are platform dependencies, not vendored libraries.
- JSZip and SheetJS remain in app or later tabular/document packages.
- MIME/extension knowledge should continue to come from `format-registry`; browser-file-io can accept a MIME string or consume descriptor objects but should not define a second registry.
