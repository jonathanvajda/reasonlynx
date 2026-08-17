# Maturity Assessment

## Capability Family

- **Capability family:** YAML, HTML, and print export
- **Survey date:** 2026-08-10
- **Assessment date:** 2026-08-15
- **Survey owner:** Codex

## Maturity Summary

|Area|Current level|Target level|Assessment|
|:---|:---:|:---:|:---|
|YAML serialization|5|5|Promoted serializer exists, replaces OCD hand-rolled YAML paths, and now has a documented report-oriented YAML emitter subset. Full arbitrary YAML parser round-trip is intentionally out of scope unless a later runtime-injected YAML adapter is added.|
|HTML document serialization|5|5|Promoted document/table/section serializer exists and is piloted. OCD measures uses the shared serializer. OCD main still has a rich app-specific HTML projection, but escaping and print mechanics are shared.|
|Print adapter|5|5|Duplicated popup/print code has been replaced in OCD and Ontology Tabulator. OntoEagle ontology viewer no longer delegates print to Tabulator directly. Cross-repo search found no remaining app-local direct print-window implementation outside shared `report-export`.|
|Export descriptors|5|5|Report downloads compose with `format-registry`, `browser-file-io`, and `normalization-utils`. YAML and HTML are registered in `format-registry`.|

## Replacement Status

|Old implementation|Replacement|Status|
|:---|:---|:---|
|OCD `buildOntologyReportYaml` hand-built YAML lines|`serializeReportValueToYaml`|Rewired; wrapper retained as app-specific projection.|
|OCD measures `buildMeasuresYaml` and `buildAllMeasuresYaml` hand-built YAML lines|`serializeReportValueToYaml`|Rewired; wrappers retained as app-specific projections.|
|OCD measures hand-built HTML document strings|`serializeReportDocumentToHtml`|Rewired; wrappers retained as app-specific projections.|
|OCD report/measures local HTML escaping|`escapeHtmlText`|Rewired.|
|OCD `handlePrintReport` inline popup/print script|`openPrintableHtmlDocument`|Rewired.|
|Ontology Tabulator `printTableOnly` popup/document writer|`serializeReportDocumentToHtml` plus `openPrintableHtmlDocument`|Deleted and rewired.|
|OntoEagle ontology viewer Tabulator CSV/print direct calls|`serializeDelimitedRows`, `createReportTextExportDescriptor`, `serializeReportDocumentToHtml`, `openPrintableHtmlDocument`|Rewired.|
|Hard-coded `text/yaml;charset=utf-8` / `text/html;charset=utf-8` report download descriptors|`createReportTextExportDescriptor` plus `format-registry` YAML/HTML descriptors|Rewired in active app code.|

## 2026-08-15 Headless API Audit

**Current package rating: 5 - Canonical for report-oriented YAML/HTML export descriptors and print adapter reuse, with explicit qualifications.**

Qualification:

- YAML support is a deterministic report-oriented emitter subset, not a full YAML parser, schema engine, or arbitrary parser round-trip guarantee.
- HTML serialization is headless and escapes report content; custom CSS is treated as trusted stylesheet text.
- `appendPrintScript` is headless string transformation.
- `openPrintableHtmlDocument` is a browser adapter because it owns `window.open`, document writing, focus, and popup-blocker behavior.
- Browser downloads remain in `browser-file-io`; report-export returns text descriptors and printable HTML.

Evidence:

- The supported YAML subset is documented in `headless-api-audit.md`.
- Focused Jest coverage now includes empty YAML arrays/objects, optional trailing newline behavior, blank printable HTML validation, and no-close print script behavior.
- Existing coverage preserves HTML escaping, complete report document serialization, YAML/HTML descriptor construction, mocked print-window writes, and stable print-window errors.

Remaining non-blocking work:

- Consider replacing OCD main report's remaining bespoke HTML string assembly with `serializeReportDocumentToHtml` after a full inspection-report document projection is defined. This is a report-layout refactor, not a remaining duplicated print/download adapter.
- Add manual browser validation for OCD report HTML/YAML download, OCD print, Ontology Tabulator print, and OntoEagle ontology viewer CSV/print when doing the next browser QA pass.
