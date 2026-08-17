# RDF Parsing and Serialization Equivalence Matrix

## Deep Comparison Summary

|Behavior group|Best current candidates|Naming convention|Inputs|Outputs|Error / warning model|Logging|Side effects|Dependencies|Test posture|Canonical decision|
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
|Parse RDF text by format|OCM RDF-024; Visual Lynx RDF-020; OntoEagle RDF-004|OCM and Visual Lynx are action-oriented enough; OntoEagle is acceptable but narrower.|Text plus file name/MIME/format/base IRI/runtime|OCM returns structured parsed ontology; Visual Lynx returns store plus prefixes; OntoEagle returns bare store.|OCM has clearest thrown errors; Visual Lynx adds logger warnings for empty graph.|Visual Lynx logs; OCM mostly throws.|None in core candidates.|N3, jsonld, rdflib.|OCM has focused tests; Visual Lynx has transformer tests.|Canonical `parseRdfText(text, options)` should return `{ dataset, prefixes, sourceFormat, baseIri, warnings }`.|
|Parse browser RDF file|TOM RDF-014; IRI Swapper RDF-028|Names are workflow-specific; both include file reading.|Browser File plus app options|TOM returns quads; IRI Swapper returns N-Quads/prefixes/stats.|Both throw parser errors; IRI Swapper attempts fallback.|Local UI/caller handles messages.|Reads file; IRI Swapper rehomes graph.|Browser File, N3, jsonld, rdflib.|No focused shared fixtures found.|Canonical browser adapter should be `parseRdfFile(file, options)` and delegate file reading to browser-file-io.|
|Parse N3-like RDF|OCM internal N3 parser; Visual Lynx internal `parseWithN3`; TOM/IRI Swapper helpers|Most names are adapter-specific and reasonable if private.|Text, N3 parser format, base IRI|Store or quads array; some preserve prefixes.|N3 errors propagate; TOM adds line context; Visual Lynx warns on zero quads.|Visual Lynx logger optional.|None.|N3.|Sparse direct tests outside OCM/Table Nova.|Keep private adapter `parseRdfTextWithN3`; expose only if tests prove consumer need.|
|Parse JSON-LD to RDF|OCM internal JSON-LD parser; Visual Lynx internal parser; TOM helper|Names vary between parse and convert.|JSON-LD text/object, base IRI|N3 Store or quads via N-Quads bridge.|Invalid JSON and JSON-LD expansion errors are not consistently separated.|Visual Lynx optional logger.|None.|jsonld and N3.|Needs fixtures for compacted, expanded, context, invalid JSON.|Canonical adapter should distinguish `invalid-json` from `invalid-jsonld`.|
|Parse RDF/XML|OCM internal rdflib parser; Visual Lynx repair-aware parser|OCM name is cleaner; Visual Lynx behavior is richer.|RDF/XML text, base IRI, optional repair mode|N3 Store/RDFJS quads plus prefixes.|rdflib callback errors; Visual Lynx repairs some malformed/unqualified XML.|Visual Lynx logger optional.|DOMParser may be used in repair path.|rdflib, N3, DOMParser for repair.|Needs dedicated RDF/XML fixtures.|Canonical RDF/XML adapter should default to strict parse and provide opt-in repair.|
|Serialize RDF dataset/store|OCM RDF-025; Visual Lynx RDF-021; Table Nova RDF-034/RDF-035|OCM and Visual Lynx names are good; Table Nova batch name is narrower.|RDF/JS store/dataset or iterable quads, target format, prefixes, base IRI, runtime|Serialized RDF text|OCM validates store and target format; Visual Lynx throws unsupported MIME; Table Nova writer rejects.|Visual Lynx logs; others do not.|None.|N3, jsonld, rdflib.|OCM and Table Nova have tests.|Canonical `serializeRdfDataset(dataset, options)` should be single-format; batch helpers can compose it.|
|Serialize JSON-LD|OCM internal JSON-LD serializer; Visual Lynx internal serializer; Table Nova RDF-036; Axiolotl RDF-019|Names vary between serialize and convert.|Dataset/store or N-Quads text|JSON-LD string|Axiolotl has fallback simple JSON-LD; others fail when jsonld fails.|Usually none.|None.|jsonld, often N3 for N-Quads bridge.|Needs fixtures for named graph and compact context.|Canonical should use jsonld by default; simplified fallback should be `fallback: "simple-jsonld"` option if kept.|
|Serialize RDF/XML|OCM internal RDF/XML serializer; Visual Lynx serializer; IRI Swapper RDF-033; Axiolotl RDF-017|Names are adapter-specific.|Dataset/store or N-Triples bridge, base IRI, prefixes|RDF/XML text|rdflib errors propagate.|Usually none.|None in core; IRI Swapper caller reads storage.|rdflib and term conversion.|Needs fixtures for prefixes, blank nodes, lists.|Canonical rdflib adapter should consume RDF/JS dataset and isolate term conversion.|
|Transform RDF text format|Visual Lynx RDF-022|Clear action/domain/range name if renamed.|Text, input format, output format|Serialized RDF text|Composed parser/serializer errors.|Optional logger.|None.|N3, jsonld, rdflib.|Existing transformer tests.|Expose as `convertRdfTextFormat(text, options)` only after parse/serialize core is stable.|
|App-domain RDF build/export|TOM RDF-011; Table Nova RDF-037|Names should mention source domain model.|Rows/schemas plus prefixes|RDF text or RDF dataset|App validation, not generic RDF parser errors.|UI-level.|May read app state in TOM.|N3/jsonld for TOM; string builder in Table Nova.|App-specific tests only.|Keep outside RDF I/O. Refactor to build dataset/quads, then call shared serializer.|
|Named graph ingest/export|IRI Swapper RDF-028/RDF-031; Axiolotl RDF-015|Names should mention named graph or run/workspace.|File/text/store plus graph IRI/run id|N-Quads or serialized graph|Workflow errors plus parser errors.|UI-level.|File read, storage read, graph mutation.|N3/jsonld/rdflib/IndexedDB.|No focused shared tests.|Graph assignment belongs in RDF graph operations or app adapter; parser stays core.|

## Format Support Matrix

|Candidate|TTL|TriG|N-Triples|N-Quads|JSON-LD|RDF/XML|Notes|
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---|
|OntoEagle RDF-004|Yes|Yes|Yes|Yes|Yes|Yes|Compact parser dispatcher; bare store output.|
|TOM RDF-014|Yes|Yes|Yes|Yes|Yes|No clear support|Import parser uses N3-like and JSON-LD paths.|
|Axiolotl RDF-016/RDF-018|Partial|Partial|Yes|Yes|Partial|Partial|Coverage split between rdflib graph parser and N3 workspace serializer.|
|Visual Lynx RDF-020/RDF-021|Yes|Yes|Yes|Yes|Yes|Yes|Broadest transform behavior.|
|OCM RDF-024/RDF-025|Yes|Yes|Yes|Yes|Yes|Yes|Cleanest reusable API.|
|Ontology Tabulator RDF-027|Yes|Likely|Yes|Likely|Yes|Yes|Parse-only.|
|IRI Swapper RDF-028/RDF-031|Yes|Yes|Yes|Yes|Yes|Yes|Workflow-coupled named graph behavior.|
|Table Nova RDF-034|Yes|Yes|Yes|Yes|Yes|No|Serialize-only; RDF/XML not present in focused serializer module.|

## Key Differences To Preserve As Options

- RDF/XML repair from Visual Lynx should be optional, defaulting to strict parse.
- Axiolotl's simplified JSON-LD fallback may be useful for degraded export, but it should be opt-in and reported as a warning.
- IRI Swapper's named graph assignment is legitimate behavior, but it is graph transformation, not parsing.
- Table Nova's multi-format export is useful as a convenience wrapper over `serializeRdfDataset`, not as the canonical serializer contract.
- TOM's enhanced N-Quads line context is worth preserving in parser errors.

## Recommended Characterization Fixtures

- `simple.ttl`
- `prefixes.ttl`
- `named-graph.trig`
- `simple.nt`
- `named-graph.nq`
- `compacted.jsonld`
- `expanded.jsonld`
- `simple.rdf`
- `rdfxml-with-default-namespace.rdf`
- `rdf-list.ttl`
- `blank-nodes.ttl`
- `empty.ttl`
- `malformed.ttl`
- `malformed.jsonld`
- `malformed.rdf`
