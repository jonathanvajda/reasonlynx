# Promoted Function Proposal

## Capability Family

- **Capability family:** YAML, HTML, and print export
- **Package:** `packages/report-export`
- **Status:** Promoted implementation created and piloted in OCD, Ontology Tabulator, and OntoEagle ontology viewer.

## Promoted Functions

|Function|Purpose|Inputs|Outputs|Side effects|Promotion rationale|
|:---|:---|:---|:---|:---|:---|
|`serializeReportValueToYaml(value, options)`|Serialize report-oriented structured values to YAML text.|Any JSON-like JavaScript value; preserves caller-supplied keys.|YAML text, with optional trailing newline.|None.|Replaces repeated hand-rolled YAML line builders while not inventing local data-property keys.|
|`escapeHtmlText(value)`|Escape user/data text for HTML documents.|Any scalar-like value.|HTML-safe string.|None.|Centralizes escaping used by report and measures exporters.|
|`serializeReportTableToHtml(table)`|Serialize a generic table model into an HTML table fragment.|`caption`, `headers`, `rows`.|HTML table fragment.|None.|Provides a reusable table primitive for printable/exportable reports.|
|`serializeReportSectionToHtml(section, depth)`|Serialize a report section with paragraphs, metadata, tables, and child sections.|Generic section descriptor.|HTML section fragment.|None.|Keeps report-document composition out of app UI code.|
|`serializeReportDocumentToHtml(report, options)`|Serialize a report document descriptor into a complete HTML document.|Document title plus sections, tables, metadata, paragraphs, CSS options.|Complete HTML document string.|None.|Replaces bespoke HTML document skeletons for export/print.|
|`createReportTextExportDescriptor(options)`|Resolve text, filename, extension, and MIME type for a report export.|Serialized text, format key/MIME, base filename, timestamp options.|`{ text, fileName, mimeType, extension }`.|None.|Composes report export with the promoted format registry and filename utilities.|
|`appendPrintScript(html, options)`|Add browser print behavior to an HTML document or fragment.|HTML string; `closeAfterPrint` flag.|HTML string with print script.|None.|Separates print script generation from app code.|
|`openPrintableHtmlDocument(html, options)`|Open a browser print window for an HTML document.|HTML string; optional injected `windowRef`, target, features.|Opened window object.|Opens popup, writes document, focuses print window.|Replaces duplicated `window.open`/`document.write`/`window.print` code and enables Jest via injected window.|
|`ReportExportError` / `createReportValidationError`|Stable report-export error model.|Message, code, details.|Error object.|None.|Gives promoted functions predictable failure shapes.|

## Naming Decisions

- Use action-oriented names: `serialize*`, `create*`, `open*`, `append*`, and `escape*`.
- Avoid vague names such as `buildYaml`, `printReport`, or `downloadHtml`.
- Keep app-specific projection names in app code, such as `buildOntologyReportYaml`, only as app-facing wrappers during migration. Their internals should call promoted serializers.
- Do not create local constants for MIME types. Use `format-registry` format keys and descriptors.

## Data Modeling Constraint

The promoted YAML serializer preserves caller-provided keys instead of inventing report vocabulary. This is intentional:

- If the caller serializes semantic data, the caller must provide ontology-backed full IRI keys or an approved schema.
- If the caller serializes a human report, the structure is a document view and should not become a new durable data model by accident.
- Compact CURIE keys remain a serialization/display decision, not the internal canonical data model.

## App Adoption

|App|Change|
|:---|:---|
|OCD main report|Replaced hand-rolled ontology report YAML body with `serializeReportValueToYaml`; replaced local report HTML escaping with `escapeHtmlText`; replaced report download filename/MIME construction with `createReportTextExportDescriptor`; replaced print popup code with `openPrintableHtmlDocument`.|
|OCD ontology measures|Replaced hand-rolled YAML builders with `serializeReportValueToYaml`; replaced local HTML escaping with `escapeHtmlText`; replaced YAML/HTML/CSV/TSV/JSON hard-coded download descriptors with `createReportTextExportDescriptor`.|
|Ontology Tabulator|Removed bespoke printable-window implementation; print now serializes a report document with `serializeReportDocumentToHtml` and opens it with `openPrintableHtmlDocument`; CSV download now resolves filename/MIME through `createReportTextExportDescriptor`.|
|OntoEagle ontology viewer|Replaced Tabulator CSV/print delegation with promoted tabular serialization, report export descriptors, HTML document serialization, and printable-window adapter.|

## Test Expectations

Promotion coverage should include:

- YAML nested objects, arrays, booleans, numbers, nulls, quoted strings, compact keys, and full IRI keys.
- HTML escaping in titles, table headers, and table cells.
- HTML document shape with default print CSS.
- Export descriptor MIME/extension/timestamp behavior for YAML and HTML.
- Printable-window behavior with an injected window mock and blocked-popup error.

