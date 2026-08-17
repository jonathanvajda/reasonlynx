# Namespace Prefix Registry Equivalence Matrix

## How to Fill This Out

Use this matrix to compare namespace-prefix behavior before choosing a canonical API. Keep registry data, compaction, expansion, extraction, and serializer injection in separate comparisons. They are related, but they have different contracts and different error models.

## Capability Family

- **Capability family:** Namespace prefix registry
- **Candidate groups:** Registry maps, compaction/expansion helpers, syntax prefix extraction, serializer adapters, namespace-stem utilities
- **Related inventory IDs:** NS-001 through NS-036
- **Comparison date:** 2026-07-24

## Behavior Matrix

|Candidate ID|App|Function/data|Core behavior|Input shape|Output shape|Formats/syntax|Options|Error model|Warning model|Side effects|Dependencies|Worker-safe|Node-safe|Browser-only assumptions|Known bugs or gaps|Legitimate variations|Test fixtures|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---:|:---:|:---|:---|:---|:---|
|NS-001|OntoEagle|`COMMON_PREFIXES`|Prefix-to-IRI registry.|None.|Object.|RDF/OWL/SKOS/DC/OBO/CCO.|None.|None.|None.|None.|None.|Yes|Yes|None.|Needs canonical source/alias decisions.|Broader common ontology defaults.|No direct fixture found.|
|NS-002|OntoEagle|`shortIri`|Compact known prefixes, else local-name fallback.|String IRI.|String.|Display/CURIE-ish.|Uses internal registry only.|No throws for non-string.|None.|None.|None.|Yes|Yes|None.|Does not use longest-prefix sort explicitly.|Display fallback may be desirable outside strict CURIE APIs.|No direct fixture found.|
|NS-004|OntoEagle|`computeNamespace`|Split namespace stem at last `#` or `/`.|IRI string.|Namespace string.|IRI namespace.|None.|Not fully compared.|None.|None.|None.|Yes|Yes|None.|Need invalid input behavior check.|Can be shared with namespace discovery.|`tests\rdf_extract.test.js`.|
|NS-007|TOM|`to_curie`|Use rdflib namespace manager, then manual longest-prefix fallback.|rdflib URIRef and graph.|QName/CURIE or full IRI.|CURIE/QName.|Graph namespace bindings.|Catches and falls back.|None.|None.|rdflib.|No|Python only|Python.|Not browser-native.|Excellent behavior evidence.|No fixture found.|
|NS-008|TOM|`iriPrefixes`|Mutable app prefix store.|None, then UI mutation.|Object.|Turtle/RDF/SPARQL-ish app workflows.|User-added prefixes.|Invalid UI add alerts.|Console info on save.|Global mutation.|N3 in callers.|No|No|Browser DOM app.|Coupled to UI and app global state.|Good demanding pilot case.|No focused fixture found.|
|NS-009|TOM|`iriToCurie`, `curieToIri`|Compact/expand with global prefix map.|String token.|CURIE/null or IRI/null.|Generic CURIE-ish.|None.|Silent null fallback.|None.|Reads mutable global.|None.|Maybe|Maybe|Global script.|Colon split likely simplistic for some CURIE local forms.|App-specific null behavior may be useful.|No focused fixture found.|
|NS-014|axiolotl|`bestPrefixForIri`, `compactIri`, `termLabel`|Longest-prefix compaction and RDF/JS term labels.|IRI or RDF/JS term plus prefix map.|String or best-match object.|Generic CURIE labels.|None.|Fallbacks for unknown/invalid terms.|None.|None.|None.|Yes|Yes|None.|No strict local-name validation in inspected helper.|Strong core candidate.|No focused fixture found.|
|NS-016|Visual Lynx|`extractRdfXmlPrefixes`|Regex extract XMLNS from root tag.|XML text.|Prefix map.|XML/RDF/XML.|None.|Skips suspicious relative namespace strings.|None.|None.|None.|Yes|Yes|None.|Regex may miss complex XML declarations; root-only.|Good pure fallback when DOMParser unavailable.|No focused fixture found.|
|NS-017|Visual Lynx|`parseWithN3` prefix capture|Capture N3 parser `_prefixes` while parsing RDF.|Text, format, base IRI, logger.|`{ store, prefixes }`.|Turtle/TriG/N-Triples/N-Quads.|N3 format/base.|Logs and throws parse errors.|Warns if zero quads.|Creates store; logs.|N3.|Maybe|Maybe|Direct `window.N3`.|Uses private `_prefixes` property.|Practical adapter behavior.|Conversion tests likely.|
|NS-018|Visual Lynx|`extractPrefixes`, `getPrefixes`, `prefixEntries`, `namedNodeToText`|Extract Turtle/TriG prefixes, merge defaults, sort by longest namespace, format named nodes.|Text/mime, parsed prefixes, IRI.|Prefix map, entries, CURIE/text.|Turtle/TriG/N3 terms.|Defaults.|Silent fallback to `<IRI>`.|None.|None.|None for pure helpers.|Yes|Yes|IIFE currently.|Internal only; no module export.|Strongest all-around compaction/extraction cluster.|No focused fixture found.|
|NS-020|OCM|N3 prefix capture in RDF IO|N3 parser callback captures prefixes.|Text, format, runtime.|Parsed object with prefixes.|N3-supported RDF.|Runtime injection, base IRI.|Throws missing parser/parse errors.|None.|Creates store.|N3 runtime.|Maybe|Maybe|Browser app runtime expected, but injected.|Vendor adapter only.|Cleaner dependency injection than direct globals.|RDF IO tests likely.|
|NS-022|OCM|`getNamespaceFromIri`, `extractNamespacesFromStore`|Derive namespace stems and list namespace candidates from store terms.|IRI string or RDF/JS store.|Namespace/null or sorted array.|IRI namespace.|None.|Invalid IRI returns null.|None.|None.|None.|Yes|Yes|None.|HTTP/URN validation differs from OntoEagle.|Adjacent utility, not prefix registry core.|No namespace fixture noted.|
|NS-023|Ontology Tabulator|`NS`|Prefix-to-IRI constants.|None.|Object.|Ontology terms.|None.|None.|None.|None.|None.|Yes|Yes|None.|Not frozen.|Test-used namespace constants.|`__tests__\core.test.js`.|
|NS-025|Ontology Tabulator|`iriToCurieIfCommon`|Reverse-map IRI compaction.|String IRI.|CURIE or original IRI.|Common namespace display.|None.|Logs and rethrows.|Log start/error.|Logging side effects.|Logger helpers.|No|Maybe|ESM app logging.|Reverse map duplicates canonical data; no longest-prefix logic.|Existing app behavior may need migration note.|No direct fixture found.|
|NS-026|IRI Swapper|`parseTurtlePrefixes`|Regex extract `@prefix` and `PREFIX` declarations.|Text.|Prefix map.|Turtle/TriG/SPARQL-like.|None.|No throws.|None.|None.|None.|Yes|Yes|None.|Prefix grammar is simplified.|Useful core extraction adapter.|No focused fixture found.|
|NS-027|IRI Swapper|`parseXmlnsPrefixes`|DOMParser root-attribute extraction.|XML text.|Prefix map.|XML/RDF/XML.|None.|Returns `{}` on caught errors; parsererror not checked.|None.|Creates DOM document.|DOMParser.|No|No|Browser DOMParser.|Malformed XML may produce parsererror document, not throw.|Useful browser adapter.|No focused fixture found.|
|NS-028|IRI Swapper|`parseJsonLdPrefixes`|Parse JSON-LD and extract simple string context terms.|JSON text.|Parsed JSON plus prefix map.|JSON-LD.|Simple object context only.|JSON parse throws.|None.|None.|JSON.parse.|Yes|Yes|None.|No array context/object term handling.|Good minimum adapter.|No focused fixture found.|
|NS-029|IRI Swapper|`prefixesToJsonLdContext`|Create JSON-LD context from prefixes; skip default prefix.|Prefix map.|JSON-LD context object.|JSON-LD.|None.|Assumes object entries.|None.|None.|None.|Yes|Yes|None.|Needs invalid input handling.|Small pure candidate.|No focused fixture found.|
|NS-030|IRI Swapper|`parsePrefixesAndBase`, `expandPrefixedName`|Parse SPARQL prologue and expand prefixed names.|SPARQL text; token plus prefix map.|`{ prefixes, baseIri }`; expanded IRI string.|SPARQL.|None.|Unknown prefix returns empty string.|None.|None.|None.|Yes|Yes|None.|SPARQL grammar simplified.|Best SPARQL adapter seed.|No focused fixture found.|
|NS-033|Table Nova|`compactIri`, `buildOntologyTurtle`|Compact IRIs for Turtle and emit prefix header.|IRI, prefix map, column schemas.|Turtle text or compacted IRI.|Turtle.|Defaults merged by caller/function.|No throw for missing value.|None.|None.|None for compact helper.|Yes|Yes|None.|No longest-prefix sorting; local grammar narrower than full Turtle.|Test-backed app behavior.|`tests\ontology.test.js`.|
|NS-034|Table Nova|`writeWithN3` prefix pass-through|Pass prefixes to N3 Writer for Turtle/TriG.|Store and writer options.|Serialized string promise.|Turtle/TriG/N3 formats.|N3 format.|Rejects errors.|None.|Creates writer output.|N3.|Maybe|Maybe|Global `N3`.|Vendor adapter only.|Good serializer adapter fixture.|`tests\serialize.test.js`.|

## Difference Classification

|Difference ID|Candidates affected|Description|Classification|Decision|Rationale|
|:---|:---|:---|:---|:---|:---|
|DIFF-001|NS-001, NS-011, NS-023, NS-024|Registry orientation differs: prefix-to-IRI, IRI-to-prefix, or SPARQL declaration text.|Accidental divergence|Canonical core should store prefix-to-IRI only.|Reverse maps and SPARQL declarations can be derived deterministically.|
|DIFF-002|NS-002, NS-014, NS-018, NS-025, NS-033|Fallback differs: original IRI, `<IRI>`, local name, or empty/null.|Legitimate option|Create separate functions for strict compaction, Turtle/SPARQL formatting, and display label fallback.|One fallback cannot serve RDF syntax and human display equally well.|
|DIFF-003|NS-007, NS-014, NS-018 vs NS-002, NS-025, NS-033|Some implementations prefer longest namespace match; others depend on object iteration order.|Improvement|Canonical compaction should prefer longest namespace match.|Avoids overly broad prefixes and matches TOM fallback/Axiolotl/Visual Lynx behavior.|
|DIFF-004|NS-026, NS-030|Turtle and SPARQL prefix regexes overlap but are not identical.|Legitimate option|Keep syntax-specific extraction functions.|Turtle `@prefix` and SPARQL `PREFIX`/`BASE` have different grammar and downstream meaning.|
|DIFF-005|NS-016, NS-027|XMLNS extraction uses pure regex vs DOMParser.|Legitimate option|Prefer pure parser-independent core extraction only if fixtures prove adequate; otherwise provide DOMParser adapter.|DOMParser is browser-only; regex is portable but potentially fragile.|
|DIFF-006|NS-028|JSON-LD prefix extraction only supports simple object contexts with string values.|Known gap|Document MVP support and add fixtures before broad adoption.|JSON-LD contexts can be arrays or objects with `@id`, `@prefix`, etc.|
|DIFF-007|NS-012, NS-025|Some prefix helpers log, alert, mutate DOM/localStorage, or read mutable globals.|App-specific adapter|Do not promote these as core.|Shared package should remain pure; adapters stay app-local or in explicit browser adapter modules.|

## Canonical Behavior Recommendation

- **Recommended canonical behavior:** Define an immutable `COMMON_NAMESPACE_PREFIXES` prefix-to-IRI registry, derive reverse maps from it, use longest-prefix matching for compaction, and keep syntax-specific adapters for Turtle, SPARQL, XMLNS, JSON-LD, N3 writer, jsonld.js, and rdflib.js.
- **Behavior to preserve as options:** Display local-name fallback; Turtle/SPARQL `<IRI>` fallback; unknown-prefix returns `null` or empty string depending adapter; app-specific prefix extensions.
- **Behavior to reject:** Mutable shared global prefix registries, hard-coded reverse maps as source of truth, formatter functions that depend on DOM/localStorage, and SPARQL declaration strings as canonical data.
- **Behavior requiring migration notes:** TOM `iriPrefixes` UI mutation, Axiolotl active prefix localStorage keys, Ontology Tabulator logging in `iriToCurieIfCommon`, Table Nova app-specific `tablenova` and `tablenovaid` defaults.
- **Open questions:** Should `cco` and `cceo` both map to `http://www.ontologyrepository.com/CommonCoreOntologies/` in canonical defaults? Should CCO2 be canonicalized as `cco2`, or should an app-specific alias be kept?
