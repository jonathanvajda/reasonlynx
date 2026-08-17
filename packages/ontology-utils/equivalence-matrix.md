# Equivalence Matrix

## Capability Family

- **Capability family:** Ontology-related utilities
- **Candidate groups:** GRP-001 through GRP-007
- **Related inventory IDs:** ONT-001 through ONT-023
- **Comparison date:** 2026-08-05

## Behavior Matrix

|Candidate ID|App|Function|Core behavior|Input shape|Output shape|Formats|Options|Error model|Warning model|Side effects|Dependencies|Worker-safe|Node-safe|Browser-only assumptions|Known bugs|Legitimate variations|Test fixtures|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---|:---|:---|:---|
|ONT-001|Shared|`isAbsoluteIri`|Broad scheme-like absolute IRI check.|String-like value.|Boolean.|Any scheme pattern.|None.|Never throws.|None.|None.|None.|Yes.|Yes.|None.|May accept schemes not wanted in RDF named-node contexts.|Good for namespace/prefix validation.|Namespace registry tests.|
|ONT-002|Axiolotl|`isAbsoluteIri`|Strict semantic-web-ish absolute IRI check that rejects CURIEs.|String.|Boolean.|HTTP(S), WS(S), FTP, file, URN, tag, mailto, data, IPFS/IPNS.|None.|Never throws.|None.|None.|None.|Yes.|Yes.|None.|Scheme allowlist may need extension.|Good for data validation before term creation.|None direct.|
|ONT-003|OntoEagle|`isNamedIri`|HTTP(S)/URN-only named IRI filter.|String.|Boolean.|HTTP(S), URN.|None.|Never throws.|None.|None.|None.|Yes.|Yes.|None.|Too narrow as general IRI utility.|Valid for seed/slim traversal policy.|Slim tests indirect.|
|ONT-004|TOM|predicate IRI regex|Normalize/accept predicate input token.|String token.|IRI string or null.|HTTP(S), URN, angle-bracket token.|Implicit.|Never throws in local path.|None.|None.|Vocab maps, CURIE expansion.|Yes.|Yes.|None.|Embedded in larger workflow.|Display-token stripping is TOM-specific but useful as option.|TOM tests indirect.|
|ONT-005|Shared tabular IO|`normalizeIriCell`|Normalize mapping-table IRI cells.|Unknown cell value.|String.|CSV/TSV/XLSX cells containing IRIs.|Options object.|Never throws.|Skipped rows reported by caller.|None.|None.|Yes.|Yes.|None.|Private, not reusable outside mapping.|Tabular cell context is legitimate.|IRI Swapper tests.|
|ONT-006|OntoEagle|`isBlankId`|Detect `_:` blank node IDs.|String.|Boolean.|JSON-LD/RDF blank node IDs.|None.|Never throws.|None.|None.|None.|Yes.|Yes.|None.|String-only.|Needed for JSON-LD object traversal.|Slim tests indirect.|
|ONT-007|Ontology Tabulator|`isBlankNode`|Detect RDF/JS term blank node.|RDF term.|Boolean.|RDF/JS terms.|None.|Logs and rethrows unlikely errors.|None.|Console logs.|Logger.|Yes.|Yes.|None.|Logging makes it less pure.|Useful UI debugging pattern, not core behavior.|Core tests indirect.|
|ONT-008|Axiolotl|`quadHasBlankNode`|Detect blank node anywhere in quad.|RDF/JS quad.|Boolean.|RDF/JS quad.|None.|Can throw if malformed quad lacks nested terms.|None.|None.|None.|Yes.|Yes.|None.|Should guard malformed quads in canonical version.|Needed for inference loose comparison.|Inference tests indirect.|
|ONT-009|Axiolotl|term role predicates|Validate legal RDF term role by subject/predicate/object/graph.|RDF/JS term.|Boolean.|RDF/JS terms.|None.|Never throws for falsey term except field access is guarded.|None.|None.|None.|Yes.|Yes.|None.|Private local functions.|Role-specific predicates are legitimate core utilities.|Inference tests indirect.|
|ONT-010|Shared RDF IO|RDF term normalizers|Normalize/create RDF/JS terms and throw when role invalid.|Term or string.|Term or `TypeError`.|RDF/JS terms.|None.|Throws `TypeError` for invalid term role.|None.|None.|None.|Yes.|Yes.|None.|No exported non-throwing role predicates yet.|Throwing normalizers are appropriate for constructors.|RDF IO tests.|
|ONT-012|Visual Lynx|`normalizeNamespaceIri`|Trim and append `#` if missing `/` or `#`.|String.|String.|Namespace IRIs.|None.|Never throws.|None.|None.|None.|Yes.|Yes.|None.|May be too opinionated for slash-based REST namespaces without caller intent.|Useful when repairing RDF/XML prefixes.|None direct.|
|ONT-013|TOM|`isValidOntology`|Regex sniff RDF/ontology-looking text.|String.|Boolean.|RDF/XML, Turtle, JSON-LD snippets.|None.|Never throws.|None.|None.|None.|Yes.|Yes.|None.|Can false-positive or false-negative.|Useful as quick preflight only.|TOM tests indirect.|
|ONT-014|IRI Swapper|`detectOntologyFormat`|Classify ontology file by extension.|Filename.|MIME/format string.|RDF extensions.|None.|Likely fallback behavior local.|None.|None.|Format registry adjacent.|Yes.|Yes.|File name only.|Mostly duplicate of format-registry.|Ontology-specific label can be layered over format result.|IRI Swapper tests indirect.|
|ONT-015|OCD|`isBuiltInIri`|Filter built-in vocabulary IRIs.|IRI string.|Boolean.|Ontology metric IRIs.|Built-in list.|Can throw if non-string passed.|None.|None.|Local namespace list.|Yes.|Yes.|None.|Needs non-string guard and registry-backed list.|Useful for metrics/signature logic.|OCD tests indirect.|
|ONT-016|OCD|`isInOntologyNamespace`|Namespace containment check.|IRI and namespace strings.|Boolean.|Any IRI namespace.|None.|Never throws for null namespace, may throw if IRI non-string.|None.|None.|None.|Yes.|Yes.|None.|Needs non-string guard.|Simple useful pure helper.|OCD tests indirect.|
|ONT-018|Table Nova|`mapXsdDatatypeToJsonSchema`|Map XSD datatype to JSON Schema fragment.|Datatype IRI.|Object.|XSD datatypes.|None.|Never throws.|None.|None.|Namespace registry via local-name helper.|Yes.|Yes.|None.|XSD coverage incomplete but practical.|Legitimate mapping should be intentionally scoped.|None direct.|
|ONT-019|Table Nova|`coerceExampleValue`|Coerce lexical example to JS value for JSON Schema examples.|Value and XSD datatype IRI.|Primitive or undefined.|XSD numeric/boolean/string.|None.|Never throws.|None.|None.|Datatype local helper.|Yes.|Yes.|None.|Date/time are not parsed, intentionally remain strings.|Correct for JSON Schema examples.|None direct.|
|ONT-021|Axiolotl|`makeGuidLike`|Generate compact no-hyphen GUID-like ID.|None.|String.|Identifier.|None.|Never throws unless `window` absent.|None.|Randomness/time.|`window.crypto`, `Math.random`.|No.|No.|`window`.|Not worker/Node safe.|No-hyphen output needed by existing IRI pattern.|None direct.|
|ONT-022|Axiolotl|`uuid`|Generate UUID with crypto or RFC4122-like fallback.|None.|UUID string.|Identifier.|None.|Potential `crypto` ReferenceError in strict non-browser contexts.|None.|Randomness.|`crypto`, `Math.random`.|Maybe.|Maybe.|Implicit global.|Needs `globalThis.crypto` guard.|Hyphenated UUID is normal default.|None direct.|
|ONT-023|Axiolotl|`makeNamedGraphIRI`|Build base/timestamp/uuid graph IRI.|Base IRI.|IRI string.|Named graph IRIs.|Base option.|Never throws.|None.|Time/randomness.|Date, UUID helper.|Yes.|Yes.|None.|Does not validate base IRI.|Useful pattern but graph-specific.|None direct.|

## Difference Classification

|Difference ID|Candidates affected|Description|Classification|Decision|Rationale|
|:---|:---|:---|:---|:---|:---|
|DIFF-001|ONT-001, ONT-002, ONT-003, ONT-004|Absolute IRI validation ranges from broad scheme-like to HTTP(S)/URN-only.|Legitimate option plus accidental divergence|Canonical API should expose strict default suitable for RDF named nodes and optional broad mode for namespace maps.|Namespace prefix validation and RDF term validation do not have identical risk profiles.|
|DIFF-002|ONT-004, ONT-005, ONT-011|Some helpers strip angle brackets; others only validate.|Accidental divergence|Canonical `normalizeIriToken` should trim and optionally strip angle brackets, then callers validate separately.|Normalization and validation are separate operations.|
|DIFF-003|ONT-006, ONT-007, ONT-008, ONT-009, ONT-010|Blank-node string IDs, blank-node terms, and quad-level blank-node detection are mixed.|Legitimate option|Promote separate predicates for each level: ID string, term, quad.|Combining these into one function would create unclear input contracts.|
|DIFF-004|ONT-013, ONT-014|Ontology file recognition may use filename, MIME, content sniff, or parse probe.|Improvement needed|Canonical function should return structured confidence and reason fields.|A boolean hides whether the evidence came from filename, MIME, content, or successful parse.|
|DIFF-005|ONT-018, ONT-019, ONT-020|Datatype mapping and lexical coercion are only in Table Nova.|Improvement|Promote as package with direct tests before other apps need it.|This is a clean pure utility with obvious cross-app demand.|
|DIFF-006|ONT-021, ONT-022, ONT-023|UUID helpers differ on global access, hyphen policy, and fallback shape.|Bug plus legitimate option|Canonical `createUuid` should default to hyphenated UUID and support `{ removeHyphens: true }`; tests should inject UUID source.|Browser-specific `window` usage is unnecessary and less reusable.|

## Canonical Behavior Recommendation

- **Recommended canonical behavior:** Create `packages/ontology-utils` with pure modules for IRI tokens, RDF term predicates, ontology input classification, XSD datatype helpers, and identifier generation. Reuse `namespace-registry`, `format-registry`, and `rdf-io` instead of duplicating registry or RDF model code.
- **Behavior to preserve as options:** Strict vs broad IRI validation, angle-bracket stripping, GUID hyphen removal, parse-probe vs sniff-only ontology file classification.
- **Behavior to reject:** Local regex-only ontology validation as a final answer; browser-only `window.crypto` UUID generation; new local RDF/RDFS/OWL/XSD constants where registry entries exist.
- **Behavior requiring migration notes:** TOM's `isValidOntology`, Axiolotl's graph IRI/UUID helpers, Table Nova's JSON Schema datatype mapping, OCD's built-in IRI filters.
- **Open questions:** Whether `normalizeNamespaceIri` should land in `namespace-registry` rather than `ontology-utils`; whether UUID/GUID belongs here or in the next normalization-utils family.
