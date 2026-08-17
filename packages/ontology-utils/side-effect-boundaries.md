# Side-Effect Boundaries

## Boundary Table

|ID|Function|Current category|Target category|Side effects|Reads from|Writes to|Adapter needed?|Worker-safe?|Node-safe?|Notes|
|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---:|:---|
|BOUND-001|`isAbsoluteIri`|Pure core|Pure core|None|Explicit value|Nothing|No|Yes|Yes|May remain in namespace-registry and be re-exported if ontology-utils package exists.|
|BOUND-002|`normalizeIriToken`|Pure core|Pure core|None|Explicit value/options|Nothing|No|Yes|Yes|Should not expand CURIEs; expansion belongs to namespace-registry.|
|BOUND-003|`isBlankNodeId`|Pure core|Pure core|None|Explicit value|Nothing|No|Yes|Yes|String-level check only.|
|BOUND-004|`isBlankNodeTerm` and RDF role predicates|Pure core|Pure core|None|RDF/JS term object|Nothing|No|Yes|Yes|Should avoid console logging in promoted utility.|
|BOUND-005|`classifyOntologyInput`|Pure core with optional parser adapter|Pure core plus optional adapter boundary|None if sniff-only; optional parse probe may call RDF parser adapter|Filename, MIME, content, parser result|Nothing|Yes for parse probe|Yes if parser adapter works|Yes if parser adapter works|Format registry handles MIME/extension; RDF IO handles parse validity.|
|BOUND-006|`isRegisteredVocabularyIri`|Pure core|Pure core|None|Registry namespace IRIs and explicit IRI|Nothing|No|Yes|Yes|Built-in vocabulary list must be derived from namespace-registry.|
|BOUND-007|`isIriInNamespace`|Pure core|Pure core|None|Explicit IRI and namespace|Nothing|No|Yes|Yes|Needs non-string-safe behavior.|
|BOUND-008|XSD datatype helpers|Pure core|Pure core|None|Explicit datatype IRI/value and namespace registry|Nothing|No|Yes|Yes|No DOM, storage, or parser dependency.|
|BOUND-009|`createUuid`|Runtime entropy adapter|Pure core with injectable entropy|Uses crypto/random fallback unless injected|`globalThis.crypto`, optional injected UUID source|Nothing|Yes for deterministic tests|Yes|Yes|Default implementation is side-effect-light but nondeterministic.|
|BOUND-010|`createTimestampedGraphIri`|Runtime clock/entropy adapter|Pure core with injectable clock/UUID|Uses clock and UUID unless injected|Date/UUID source, base IRI|Nothing|Yes for deterministic tests|Yes|Yes|Should validate base with `isAbsoluteIri` or return structured error.|

## Side-Effect Rules

- Ontology-utils core functions must not reference `window`, `document`, DOM nodes, IndexedDB, File System Access, OPFS, `localStorage`, or UI logging.
- Format decisions must reuse `format-registry`; ontology-utils may classify ontology suitability but must not maintain parallel MIME/extension tables.
- Prefix and CURIE decisions must reuse `namespace-registry`; ontology-utils may validate IRI strings but must not create a second prefix registry.
- RDF term construction and dataset normalization must reuse `rdf-io`; ontology-utils may expose non-throwing predicates where apps need preflight checks.
- UUID and timestamp helpers must accept injectable sources in tests so generated IDs are deterministic.

## Refactor Plan

|Refactor ID|Problem|Target boundary|Affected functions|Required tests|Migration notes|
|:---|:---|:---|:---|:---|:---|
|REF-001|IRI validation/normalization split across namespace-registry, TOM, Axiolotl, and tabular-io.|Pure IRI token module.|`isAbsoluteIri`, `isNamedIri`, `normalizeIriString`, `normalizeIriCell`, `normalizeIriishToken`.|Whitespace, angle brackets, CURIE rejection, allowed schemes, non-string values.|Adopt first in Axiolotl and TOM because they have duplicate local helpers.|
|REF-002|Blank-node and RDF role checks are private/local.|Pure RDF term predicates module or RDF IO export.|`isBlankId`, `isBlankNode`, `quadHasBlankNode`, `canBe*`.|Null, malformed term, named node, blank node, literal, default graph, malformed quad.|Prefer adding predicates to RDF IO if this keeps term logic together.|
|REF-003|Ontology file validation is heuristic and duplicated.|Pure classifier composed with format-registry and optional RDF IO parse probe.|`isValidOntology`, `detectOntologyFormat`.|Filename-only, MIME-only, content-sniff, unsupported file, JSON-LD object, Turtle prefix, RDF/XML root.|Boolean helpers should become app adapters over structured result.|
|REF-004|XSD datatype helpers are useful but local to Table Nova.|Pure XSD datatype module.|`formatDatatypeLabel`, `mapXsdDatatypeToJsonSchema`, `coerceExampleValue`, `datatypeLocalName`.|Integer, decimal, double, boolean, date, dateTime, time, anyURI, unknown datatype, empty value.|Use registry IRIs directly; do not define local XSD namespace constants.|
|REF-005|UUID and graph IRI generation are local and nondeterministic.|Identifier module with injected clock/UUID.|`makeGuidLike`, `uuid`, `makeNamedGraphIRI`.|Crypto path, fallback path, remove-hyphen option, deterministic timestamped graph IRI, invalid base IRI.|Adopt in Axiolotl saved query and graph overlay paths.|

## Notes

- This capability should be implemented as pure utilities first, then migrated into apps. Browser/UI adapters should be unnecessary except for current callers that show validation messages.
