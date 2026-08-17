# Format and MIME Registry Equivalence Matrix

## How to Fill This Out

Use this matrix to compare leading candidates before defining the canonical API. This first version captures the behavior visible from code reading. Replace assumptions with fixture results during characterization.

## Capability Family

- **Capability family:** Format and MIME Registry
- **Candidate groups:** GRP-RDF-MIME-FILENAME, GRP-MIME-NORMALIZATION, GRP-MIME-EXTENSION, GRP-SUPPORTED-CONVERSIONS, GRP-TABULAR-FORMAT
- **Related inventory IDs:** FMT-001 through FMT-022
- **Comparison date:** 2026-07-24

## Behavior Matrix

|Candidate ID|App|Function or registry|Core behavior|Input shape|Output shape|Formats|Options|Error model|Warning model|Side effects|Dependencies|Worker-safe|Node-safe|Browser-only assumptions|Known bugs or risks|Legitimate variations|Test fixtures|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---|:---|:---|:---|
|FMT-012|Visual Lynx|`normalizeMimeType`, `guessInputMimeFromFilename`, `getDownloadExtension`, `supportedConversions`|General RDF/graph MIME normalization and conversion registry|String MIME/token or filename|Normalized MIME, extension, or supported MIME list|RDF plus Mermaid and D3 JSON|None|Unknown normalize returns original input; filename miss returns `null`; extension fallback `txt`|None|None|None|Yes|Likely yes|None in registry module|May mix RDF format registry with graph visualization outputs|Visualization output support is legitimate for Linked Data Transformer|None found|
|FMT-014|Ontology Curation Manager|`normalizeRdfFormat`, `detectRdfFormat`, `isSupportedRdfFileName`|RDF-only MIME normalization, filename detection, support predicate|String token or filename|RDF MIME, boolean, or `null`|RDF serializations including `.nq`, `.n3`, `.json-ld`, `.ntriples`|None|Unknown normalize returns `null`; filename miss defaults Turtle|None|None|None|Yes|Likely yes|None in registry functions|Turtle fallback can hide unsupported files if used without support check|RDF-only focus is desirable for core RDF package|None found|
|FMT-001|OntoEagle|`detectRdfFormat` and constants|RDF filename extension to MIME|Filename|string MIME|RDF serializations including `.nq`, `.n3`, `.json-ld`, `.ntriples`|None|Unknown defaults Turtle|None|None|None|Yes|Likely yes|None in detector|No normalizer or support predicate|Small baseline is easy to reason about|None found|
|FMT-018|IRI Swapper|`detectOntologyFormat`|RDF filename extension to descriptor|Filename|`{ contentType, label }`|RDF serializations; `.json` treated JSON-LD|None|Unknown returns octet-stream descriptor|None|None|None|Yes|Likely yes|None in detector|Maps `.trig` to `text/turtle`, which may be parser-oriented rather than MIME-canonical|Descriptor shape is useful for user-facing adapters|None found|
|FMT-007|Axiolotl|`detectRdfMimeByName`|RDF filename extension to MIME|Filename|string MIME|TTL, NT, N3, JSON-LD, RDF/XML, TriG|None|Unknown defaults Turtle|Optional debug warning|Optional console warning|Debug global|Mostly|Likely with global removed|Uses global debug flag|Missing `.nq`, `.json`, `.json-ld`, `.turtle`, `.ntriples`|Turtle fallback may match existing import behavior|None found|
|FMT-009|Axiolotl|`workspaceExportExtension`|MIME to extension|MIME string|Extension string|TTL, NT, NQ, TriG, JSON-LD|None|Unknown fallback `rdf`|None|None|None|Yes|Likely yes|None|No MIME normalization|Fallback choice may be app-specific|None found|
|FMT-003|TOM|`detectFormatByExtension`|Extension to broad input kind|Extension string|`spreadsheet`, `ontology`, `unsupported`|CSV, TSV, XLS, XLSX, TTL, NT, RDF, JSON-LD, TriG|None|Invalid/unknown returns unsupported|None|None|None|Yes|Yes|None|Broad type loses exact format|Useful UI intake adapter|None found|
|FMT-019|Table Nova|`detectTabularType`|Filename to tabular kind|Filename|`csv`, `tsv`, `xlsx`, `unknown`|CSV, TSV, XLS, XLSX, TXT-as-CSV|None|Unknown returns unknown|None|None|None|Yes|Likely yes|None|XLS and XLSX both return `xlsx`|Useful for tabular registry|None found|

## Difference Classification

|Difference ID|Candidates affected|Description|Classification|Decision|Rationale|
|:---|:---|:---|:---|:---|:---|
|DIFF-001|FMT-001, FMT-007, FMT-011, FMT-014, FMT-018|Unknown filename fallback varies between Turtle, `auto`, octet-stream descriptor, and support predicate handling.|Legitimate option plus accidental divergence|Canonical core should return `null` or explicit unknown descriptor; app adapters may default to Turtle or auto.|A pure registry should not silently imply unsupported files are Turtle unless an adapter deliberately chooses that fallback.|
|DIFF-002|FMT-012, FMT-014|Visual Lynx includes Mermaid/D3 output MIME types; OCM is RDF-only.|Legitimate option|Split RDF registry from graph/report visualization output registry or include a category field.|Linked Data Transformer needs visual outputs, but RDF parsing packages should not need them.|
|DIFF-003|FMT-018 versus most RDF registries|`.trig` maps to `text/turtle` in IRI Swapper descriptor.|Potential bug or parser adapter choice|Investigate before canonicalizing; canonical MIME should likely be `application/trig`.|TriG is distinct from Turtle at MIME/format registry level even if a parser adapter can handle both.|
|DIFF-004|FMT-005|TOM has `mimeTypes.nquads` but no matching `extensions.nquads` in inspected map.|Potential bug|Verify during TOM migration; canonical extension lookup should cover N-Quads.|Could affect download filename for N-Quads if selected.|
|DIFF-005|FMT-012, FMT-014, FMT-018|`.json` handling differs or is absent.|Legitimate option|Decide whether `.json` should be accepted as JSON-LD only in app adapters, not core RDF registry.|Plain JSON is ambiguous; JSON-LD detection may require content heuristic.|
|DIFF-006|FMT-004|Content-based MIME guessing exists only in TOM candidates.|Improvement candidate|Keep as separate heuristic function with explicit confidence/fallback.|Filename registry and content sniffing should be different functions.|

## Canonical Behavior Recommendation

- **Recommended leading candidates:** FMT-014 for RDF-only normalization/detection; FMT-012 for MIME-to-extension and supported conversion matrix patterns.
- **Behavior to preserve as options:** App-level fallback to Turtle or `auto`; descriptor output with label; graph-scope export options.
- **Behavior to reject in core:** DOM reads, console logging, silent unknown-as-Turtle default without explicit adapter choice.
- **Behavior requiring migration notes:** `.trig` MIME handling, `.json` as JSON-LD, unknown extension fallback, N-Quads extension key spelling (`nq` vs `nquads`).
- **Open questions:** Should canonical format IDs use MIME strings as primary keys, short tokens as aliases, or structured records with both?

