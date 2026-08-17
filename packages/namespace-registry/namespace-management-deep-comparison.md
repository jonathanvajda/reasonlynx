# Namespace Management Deep Comparison

## Purpose

This note refines the namespace-prefix inventory into nine distinct JavaScript capability groups. The goal is to avoid a single overloaded namespace utility and instead define small, mature functions with clear domains, ranges, error behavior, and side-effect boundaries.

RDF and SPARQL prefix handling stay distinct. RDF prefix handling should primarily use RDF parser/serializer support where available. SPARQL prefix handling is text/prologue handling and will remain regex/token-heuristic based unless a SPARQL parser is intentionally introduced.

## Nine Capability Groups

|Group|Canonical function|Domain|Range|Boundary|
|:---:|:---|:---|:---|:---|
|1|`extractRdfPrefixesFromText(text, options)`|RDF source text plus syntax/MIME/runtime options.|Result containing prefix map, optional base IRI, warnings.|RDF parser/vendor adapter or syntax adapter.|
|2|`extractSparqlPrefixesFromText(queryText)`|SPARQL query/update text.|Result containing prefix map, base IRI, warnings.|Pure SPARQL text adapter.|
|3|`COMMON_NAMESPACE_REGISTRY`|None.|Immutable registry of common prefixes, namespace IRIs, and known IDs within those namespaces.|Pure data.|
|4|`saveProjectPrefixes(prefixes, options)` / `mergeProjectPrefixes(...prefixMaps)`|User-entered, file-extracted, or project-stored prefix maps.|Validated/merged prefix store update or merged map.|Pure merge plus storage adapter.|
|5|`applyPrefixesToRdfSerializationTarget(target, prefixes, options)`|RDF serializer/writer/store plus prefix map.|Serializer configured with prefixes, or serialized text through adapter.|RDF vendor adapter.|
|6|`prependSparqlPrefixes(queryText, prefixes, options)`|SPARQL body/query text and stored prefix map.|SPARQL query blob with prefix prologue.|Pure SPARQL text adapter.|
|7|`compactIriToCurie(iri, prefixes, options)`|IRI string and prefix map.|CURIE string or structured unknown result.|Pure core.|
|8|`expandCurieToIri(curie, prefixes, options)`|CURIE string and prefix map.|IRI string or structured unknown result.|Pure core.|
|9|`discoverBaseIriOrNamespaceStem(input, options)`|IRI string, RDF store, RDF text, SPARQL text, or parsed summary.|Base IRI / namespace stem result with source evidence.|Pure helper plus RDF/SPARQL adapters.|

## Candidate Comparison by Group

### 1. Extract Prefixes From RDF File

|Candidate|Current behavior|Strength|Concern|Decision|
|:---|:---|:---|:---|:---|
|Visual Lynx `parseWithN3` prefix capture|Uses N3 parser and captures parser `_prefixes`.|Uses RDF parser knowledge; returns prefixes with parsed store.|Uses private `_prefixes`; direct `window.N3`; logging mixed in.|Good adapter behavior, not pure core.|
|OCM N3 parse callback prefix capture|Uses N3 parser callback `parsedPrefixes` and runtime injection.|Cleaner dependency injection; less global coupling.|Tied to RDF parse pipeline, not standalone extraction.|Strongest RDF adapter pattern.|
|IRI Swapper `parseTurtlePrefixes`|Regex extraction of `@prefix`/`PREFIX`.|Pure and simple.|Does not rely on RDF parser; grammar is partial.|Useful fallback for Turtle/TriG text, but not canonical RDF extraction alone.|
|IRI Swapper/Visual Lynx XMLNS extraction|Extracts `xmlns` declarations from RDF/XML/XML.|Covers RDF/XML prefixes.|DOMParser vs regex tradeoff.|Provide syntax-specific helper under RDF extraction.|
|IRI Swapper `parseJsonLdPrefixes`|Extracts simple string terms from JSON-LD `@context`.|Useful for JSON-LD source prefixes.|Incomplete for array contexts and object term definitions.|MVP adapter with documented limitations.|

Recommended API:

```js
export function extractRdfPrefixesFromText(text, options = {}) {
  const source = String(text || '');
  const mimeType = options.mimeType || '';

  if (isTurtleLikeMime(mimeType)) {
    return okPrefixResult(extractTurtlePrefixDeclarations(source), { source: 'turtle-text' });
  }
  if (isRdfXmlLikeMime(mimeType)) {
    return okPrefixResult(extractXmlNamespacePrefixes(source), { source: 'xml-namespace' });
  }
  if (isJsonLdLikeMime(mimeType)) {
    return extractJsonLdContextPrefixes(source);
  }
  if (options.n3Parser) {
    return extractPrefixesWithN3Parser(source, options);
  }
  return { ok: true, prefixes: {}, warnings: ['No RDF prefix extractor matched the provided MIME type.'] };
}
```

Error model: return `{ ok: false, error, warnings }` only for malformed JSON-LD or parser errors when parser extraction is requested. No logging.

### 2. Extract Prefixes From SPARQL File

|Candidate|Current behavior|Strength|Concern|Decision|
|:---|:---|:---|:---|:---|
|IRI Swapper `parsePrefixesAndBase`|Regex parses `PREFIX` and `BASE` lines.|Pure, clear, handles default prefix.|Line-oriented and heuristic.|Best seed.|
|IRI Swapper `extractTokens`/`expandPrefixedName`|Uses parsed prefixes to expand SPARQL prefixed names outside comments/strings.|More complete SPARQL use case.|Token scanner is larger than prefix extraction.|Keep prefix extraction separate from token extraction.|
|Axiolotl `buildQuery`|Prepends chosen prefix declaration strings.|Simple.|Stores declarations as strings, not prefix map.|Use only as migration target.|

Recommended API:

```js
export function extractSparqlPrefixesFromText(queryText) {
  const text = String(queryText || '');
  const prefixes = {};
  const warnings = [];
  let baseIri = '';

  const prefixRe = /^\s*PREFIX\s+([A-Za-z_][\w.-]*)?:\s*<([^>]+)>\s*$/gmi;
  const baseRe = /^\s*BASE\s+<([^>]+)>\s*$/gmi;

  for (let match; (match = prefixRe.exec(text)); ) {
    const prefix = String(match[1] || '').trim();
    const iri = String(match[2] || '').trim();
    if (!iri) {
      warnings.push(`Ignored empty namespace IRI for prefix "${prefix}".`);
      continue;
    }
    prefixes[prefix] = iri;
  }

  const bases = [...text.matchAll(baseRe)].map((match) => String(match[1] || '').trim()).filter(Boolean);
  if (bases.length > 1) warnings.push('Multiple BASE declarations found; using the first one.');
  baseIri = bases[0] || '';

  return { ok: true, prefixes, baseIri, warnings };
}
```

Error model: no throws for ordinary text. Warnings for duplicate or multiple base declarations. No logging.

### 3. Common Namespace Registry

|Candidate|Current behavior|Strength|Concern|Decision|
|:---|:---|:---|:---|:---|
|OntoEagle `COMMON_PREFIXES`|Frozen prefix-to-IRI registry with broad ontology defaults.|Strong app lineage and immutability.|No known IDs inside namespaces.|Best data seed.|
|Ontology Tabulator `NS`|Prefix-to-IRI constants used heavily in tests.|Good evidence of actual ontology terms.|Not frozen; reverse map maintained separately.|Use as coverage evidence.|
|Table Nova defaults|App-specific prefixes plus common ones.|Shows extension pattern.|Contains app placeholder IRIs.|App extension map only.|
|Axiolotl `commonSPARQLPrefixes`|SPARQL declaration strings.|Useful UI requirement evidence.|Wrong canonical shape.|Derive declarations from prefix-to-IRI registry.|

Recommended shape:

```js
export const COMMON_NAMESPACE_REGISTRY = Object.freeze({
  rdf: Object.freeze({
    prefix: 'rdf',
    namespaceIri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    ids: Object.freeze({ type: 'type', first: 'first', rest: 'rest', nil: 'nil' })
  }),
  rdfs: Object.freeze({
    prefix: 'rdfs',
    namespaceIri: 'http://www.w3.org/2000/01/rdf-schema#',
    ids: Object.freeze({ label: 'label', comment: 'comment', subClassOf: 'subClassOf', subPropertyOf: 'subPropertyOf' })
  }),
  owl: Object.freeze({
    prefix: 'owl',
    namespaceIri: 'http://www.w3.org/2002/07/owl#',
    ids: Object.freeze({ Class: 'Class', Ontology: 'Ontology', imports: 'imports', versionIRI: 'versionIRI' })
  }),
  xsd: Object.freeze({
    prefix: 'xsd',
    namespaceIri: 'http://www.w3.org/2001/XMLSchema#',
    ids: Object.freeze({ string: 'string', integer: 'integer', decimal: 'decimal', boolean: 'boolean', date: 'date', dateTime: 'dateTime' })
  }),
  skos: Object.freeze({
    prefix: 'skos',
    namespaceIri: 'http://www.w3.org/2004/02/skos/core#',
    ids: Object.freeze({ prefLabel: 'prefLabel', altLabel: 'altLabel', definition: 'definition' })
  }),
  dcterms: Object.freeze({
    prefix: 'dcterms',
    namespaceIri: 'http://purl.org/dc/terms/',
    ids: Object.freeze({ title: 'title', description: 'description', license: 'license', rights: 'rights' })
  }),
  dc: Object.freeze({
    prefix: 'dc',
    namespaceIri: 'http://purl.org/dc/elements/1.1/',
    ids: Object.freeze({ title: 'title', description: 'description', rights: 'rights' })
  }),
  obo: Object.freeze({
    prefix: 'obo',
    namespaceIri: 'http://purl.obolibrary.org/obo/',
    ids: Object.freeze({})
  }),
  cceo: Object.freeze({
    prefix: 'cceo',
    namespaceIri: 'http://www.ontologyrepository.com/CommonCoreOntologies/',
    ids: Object.freeze({})
  }),
  cco2: Object.freeze({
    prefix: 'cco2',
    namespaceIri: 'https://www.commoncoreontologies.org/',
    ids: Object.freeze({})
  })
});

export function namespacePrefixMapFromRegistry(registry = COMMON_NAMESPACE_REGISTRY) {
  return Object.freeze(Object.fromEntries(
    Object.values(registry).map((entry) => [entry.prefix, entry.namespaceIri])
  ));
}
```

Error model: data has no error behavior. Validation should happen in tests.

### 4. Accept and Store User-Defined Prefixes

|Candidate|Current behavior|Strength|Concern|Decision|
|:---|:---|:---|:---|:---|
|TOM prefix manager|Lets users add prefixes into mutable `iriPrefixes`.|Proves UI need.|Mutates global state and uses DOM/alerts.|Adapter only.|
|Axiolotl active prefix manager|Stores active prefix keys in localStorage.|Proves persistence need.|Stores selected keys, not arbitrary prefix map; DOM/localStorage coupling.|Adapter only.|
|IRI Swapper session prefixes|Stores extracted ontology prefixes in session state.|Good extracted-prefix use case.|App session coupling.|Use as state-shape evidence.|

Recommended pure core:

```js
export function normalizePrefixMap(prefixes) {
  const out = {};
  const warnings = [];

  for (const [rawPrefix, rawIri] of Object.entries(prefixes || {})) {
    const prefix = String(rawPrefix || '').trim();
    const namespaceIri = String(rawIri || '').trim();

    if (prefix && !/^[A-Za-z_][\w.-]*$/.test(prefix)) {
      warnings.push(`Ignored invalid prefix "${prefix}".`);
      continue;
    }
    if (!isAbsoluteIri(namespaceIri)) {
      warnings.push(`Ignored prefix "${prefix}" with invalid namespace IRI.`);
      continue;
    }
    out[prefix] = namespaceIri;
  }

  return { ok: true, prefixes: Object.freeze(out), warnings };
}

export function mergeProjectPrefixes(...prefixMaps) {
  const merged = {};
  const warnings = [];
  for (const map of prefixMaps) {
    const normalized = normalizePrefixMap(map);
    Object.assign(merged, normalized.prefixes);
    warnings.push(...normalized.warnings);
  }
  return { ok: true, prefixes: Object.freeze(merged), warnings };
}
```

Storage adapter should be separate:

```js
export async function saveProjectPrefixes(storageAdapter, projectId, prefixes) {
  const normalized = normalizePrefixMap(prefixes);
  if (!normalized.ok) return normalized;
  await storageAdapter.saveProjectPrefixes(projectId, normalized.prefixes);
  return normalized;
}
```

Error model: pure functions return warnings for rejected entries. Storage adapter returns/rethrows storage errors according to the project storage convention.

### 5. Leverage Stored Prefixes Into RDF Serialization

|Candidate|Current behavior|Strength|Concern|Decision|
|:---|:---|:---|:---|:---|
|OCM `serializeRdfStore`|Passes prefixes into N3/jsonld serializers.|Clean runtime injection.|Serializer-specific behavior mixed in RDF IO.|Good adapter pattern.|
|Table Nova `writeWithN3`|Passes prefixes into N3 Writer; tests show output.|Test-backed.|Global `N3` dependency.|Good N3 adapter seed.|
|Visual Lynx serializer pipeline|Carries parsed prefixes into output serializers.|Strong conversion workflow.|Direct globals/logging.|Good workflow evidence.|
|IRI Swapper RDF/XML serializer|Sets rdflib prefixes when available.|Covers RDF/XML.|Vendor-specific mutation.|Adapter only.|

Recommended API:

```js
export function createN3WriterOptionsWithPrefixes(options = {}) {
  const normalized = normalizePrefixMap(options.prefixes || {});
  return {
    ok: true,
    value: {
      ...options,
      prefixes: normalized.prefixes
    },
    warnings: normalized.warnings
  };
}

export function applyPrefixesToRdflibStore(store, prefixes) {
  const normalized = normalizePrefixMap(prefixes);
  if (typeof store?.setPrefixForURI !== 'function') {
    return { ok: false, error: 'unsupported prefix target', warnings: normalized.warnings };
  }
  for (const [prefix, namespaceIri] of Object.entries(normalized.prefixes)) {
    if (prefix) store.setPrefixForURI(prefix, namespaceIri);
  }
  return { ok: true, value: store, warnings: normalized.warnings };
}
```

Error model: no logging. Unsupported serializer targets return structured errors. Actual serializer failures remain in RDF IO adapters.

### 6. Leverage Stored Prefixes Into a SPARQL Query Blob

|Candidate|Current behavior|Strength|Concern|Decision|
|:---|:---|:---|:---|:---|
|Axiolotl `buildQuery`|Prepends declaration strings by active keys.|Simple and used.|Registry stores declaration text.|Migrate to prefix map input.|
|IRI Swapper SPARQL rewrite|Parses and rewrites query prologue/body.|Rich SPARQL handling.|More than prefix prepending.|Use only the prologue-formatting subset.|

Recommended API:

```js
export function formatSparqlPrefixDeclarations(prefixes) {
  const normalized = normalizePrefixMap(prefixes);
  const lines = Object.entries(normalized.prefixes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([prefix, namespaceIri]) => `PREFIX ${prefix}: <${namespaceIri}>`);

  return { ok: true, value: lines.join('\n'), warnings: normalized.warnings };
}

export function prependSparqlPrefixes(queryText, prefixes, options = {}) {
  const body = String(queryText || '');
  const declarationResult = formatSparqlPrefixDeclarations(prefixes);
  const separator = declarationResult.value && body.trim() ? '\n\n' : '';
  const baseLine = options.baseIri ? `BASE <${String(options.baseIri).trim()}>\n` : '';

  return {
    ok: true,
    value: `${baseLine}${declarationResult.value}${separator}${body}`,
    warnings: declarationResult.warnings
  };
}
```

Error model: invalid prefix map entries become warnings. No logging. Existing prefixes in the query body are not removed unless a separate replace/update function is requested.

### 7. IRI to CURIE Compaction

|Candidate|Current behavior|Strength|Concern|Decision|
|:---|:---|:---|:---|:---|
|Axiolotl `bestPrefixForIri`/`compactIri`|Longest-prefix match.|Strong pure core.|No local-name grammar validation.|Best seed.|
|Visual Lynx `prefixEntries`/`namedNodeToText`|Longest-prefix sort and local-name validation.|Strong syntax awareness.|Currently internal.|Use for validation decisions.|
|OntoEagle `shortIri`|Known-prefix compaction plus local fallback.|Useful display behavior.|Mixes CURIE and display label.|Split.|
|Table Nova `compactIri`|Turtle-friendly `<IRI>` fallback.|Test-backed.|No longest-prefix sort.|Use fallback option.|

Recommended API:

```js
export function compactIriToCurie(iri, prefixes, options = {}) {
  const value = String(iri || '').trim();
  if (!isAbsoluteIri(value)) {
    return { ok: false, error: 'invalid iri', input: iri };
  }

  const entries = Object.entries(prefixes || {})
    .filter(([, namespaceIri]) => namespaceIri && value.startsWith(namespaceIri))
    .sort((a, b) => String(b[1]).length - String(a[1]).length || a[0].localeCompare(b[0]));

  const match = entries[0];
  if (!match) return { ok: false, error: 'unknown namespace', input: value };

  const [prefix, namespaceIri] = match;
  const localName = value.slice(String(namespaceIri).length);
  const localPattern = options.allowTurtleLocalName === false
    ? /^[A-Za-z_][A-Za-z0-9._-]*$/
    : /^[A-Za-z_][A-Za-z0-9._-]*$/;

  if (!localName || !localPattern.test(localName)) {
    return { ok: false, error: 'invalid curie local name', input: value, prefix, namespaceIri, localName };
  }

  return { ok: true, value: `${prefix}:${localName}`, prefix, namespaceIri, localName };
}
```

Error model: invalid IRI, unknown namespace, invalid local name are explicit result errors. Display wrappers may fall back to local name or full IRI.

### 8. CURIE to IRI Expansion

|Candidate|Current behavior|Strength|Concern|Decision|
|:---|:---|:---|:---|:---|
|TOM `curieToIri`|Expands app tokens using global prefix map.|Useful app behavior.|Reads mutable global; simple split.|Migrate to explicit prefix map.|
|IRI Swapper `expandPrefixedName`|Expands SPARQL prefixed names.|Pure and simple.|Returns empty string for unknown prefix.|Use as seed with structured errors.|

Recommended API:

```js
export function expandCurieToIri(curie, prefixes, options = {}) {
  const token = String(curie || '').trim();
  const colonIndex = token.indexOf(':');
  if (colonIndex < 0) return { ok: false, error: 'invalid curie', input: curie };

  const prefix = token.slice(0, colonIndex);
  const localName = token.slice(colonIndex + 1);
  if (!localName && !options.allowEmptyLocalName) {
    return { ok: false, error: 'empty curie local name', input: curie, prefix };
  }

  const namespaceIri = prefixes?.[prefix];
  if (!namespaceIri) {
    return { ok: false, error: 'unknown prefix', input: curie, prefix };
  }

  return { ok: true, value: `${namespaceIri}${localName}`, prefix, namespaceIri, localName };
}
```

Error model: structured errors. No logging. Callers choose whether unknown prefixes are fatal.

### 9. Discover Base IRI or Namespace Stem

|Candidate|Current behavior|Strength|Concern|Decision|
|:---|:---|:---|:---|:---|
|OntoEagle `computeNamespace`|Splits IRI by hash/slash; tested.|Simple pure helper.|Invalid input behavior needs review.|Strong namespace-stem seed.|
|OCM `getNamespaceFromIri`|Returns null for invalid/non-IRI; splits hash/slash.|Clearer invalid handling.|Only HTTP/URN accepted.|Strong seed.|
|OCM `extractNamespacesFromStore`|Discovers namespaces from RDF store terms.|Useful higher-level discovery.|Depends on RDF/JS store shape.|Keep as adjacent helper.|
|IRI Swapper `parsePrefixesAndBase`|Finds SPARQL `BASE`.|Good SPARQL base extraction.|SPARQL-specific.|Keep in SPARQL adapter.|

Recommended API:

```js
export function deriveNamespaceStemFromIri(iri) {
  const value = String(iri || '').trim();
  if (!isAbsoluteIri(value)) return { ok: false, error: 'invalid iri', input: iri };

  const hashIndex = value.lastIndexOf('#');
  if (hashIndex >= 0) return { ok: true, value: value.slice(0, hashIndex + 1), source: 'hash' };

  const slashIndex = value.lastIndexOf('/');
  if (slashIndex >= 0) return { ok: true, value: value.slice(0, slashIndex + 1), source: 'slash' };

  return { ok: false, error: 'namespace stem not found', input: value };
}

export function listNamespaceStemsInStore(store) {
  const namespaces = new Set();
  const quads = store?.getQuads ? store.getQuads(null, null, null, null) : [];

  for (const quad of quads) {
    for (const term of [quad.subject, quad.predicate, quad.object]) {
      if (term?.termType !== 'NamedNode') continue;
      const result = deriveNamespaceStemFromIri(term.value);
      if (result.ok) namespaces.add(result.value);
    }
  }

  return { ok: true, value: Object.freeze([...namespaces].sort()) };
}
```

Error model: invalid input is an explicit result. Store scanning ignores non-IRI terms.

## Shared Helper Primitives

```js
function isAbsoluteIri(value) {
  return /^[A-Za-z][A-Za-z0-9+.-]*:[^\s]*$/.test(String(value || ''));
}

function okPrefixResult(prefixes, extra = {}) {
  const normalized = normalizePrefixMap(prefixes);
  return {
    ok: true,
    prefixes: normalized.prefixes,
    warnings: [...(extra.warnings || []), ...normalized.warnings],
    ...extra
  };
}

function isTurtleLikeMime(mimeType) {
  return ['text/turtle', 'application/trig', 'text/n3'].includes(String(mimeType || '').toLowerCase());
}

function isRdfXmlLikeMime(mimeType) {
  return String(mimeType || '').toLowerCase() === 'application/rdf+xml';
}

function isJsonLdLikeMime(mimeType) {
  return String(mimeType || '').toLowerCase() === 'application/ld+json';
}
```

## App Migration Notes

|App|Current candidates|Adoption change if promoted|
|:---|:---|:---|
|OntoEagle|`COMMON_PREFIXES`, `shortIri`, namespace filters, `computeNamespace`.|Replace `COMMON_PREFIXES` with `namespacePrefixMapFromRegistry()`. Replace `shortIri` with `compactIriToCurie` plus display fallback. Replace `computeNamespace` with `deriveNamespaceStemFromIri`. Keep namespace search filters app-local.|
|tabular-ontology-maker|Mutable `iriPrefixes`, `iriToCurie`, `curieToIri`, axiom-builder `iriToDisplay` and `termToTurtle`.|Store project/user prefixes separately from canonical registry. Pass merged prefix map into compaction/expansion helpers. Keep prefix UI as adapter. Replace axiom display formatting with syntax/display-specific wrappers.|
|axiolotl|`commonSPARQLPrefixes`, active prefix UI/localStorage, `buildQuery`, SPARQL visualizer `compactIri`.|Derive SPARQL declaration lines from prefix maps instead of storing declaration strings. Keep active-prefix selection in app storage. Promote visualizer longest-prefix compaction semantics.|
|visual-lynx|RDF prefix capture in linked-data transformer, XMLNS extraction, `n3-sugar-serial` prefix helpers.|Use RDF extraction adapters for source prefixes. Promote longest-prefix sorting and valid-local-name behavior into pure core. Keep conversion-supported outputs app-local.|
|ontology-curation-manager|RDF IO prefix capture/serialization, namespace-stem discovery.|Use OCM runtime-injection pattern for RDF parser/serializer adapters. Replace namespace helpers with canonical stem helpers after tests align.|
|ontology-tabulator|`NS`, reverse `COMMON_PREFIXES`, `iriToCurieIfCommon`.|Replace `NS` with registry-derived map or app alias. Derive reverse lookup. Remove logging from pure compaction and log at caller if desired.|
|iri-swapper|RDF prefix extractors, SPARQL prologue parser, SPARQL expansion/formatting helpers, session prefix state.|Use RDF and SPARQL extraction functions distinctly. Store extracted prefixes in session/project prefix store. Keep rewrite engine app-specific but call canonical SPARQL expansion/formatting helpers.|
|table-nova|Default prefixes, ontology `compactIri`, N3 writer prefix pass-through, XSD datatype labels.|Extend canonical registry with Table Nova prefixes. Replace local compact helpers with `compactIriToCurie` or Turtle formatter. Keep N3 writer adapter and export workflows local.|

## Decision Summary

- The nine groups are valid and should remain distinct.
- RDF prefix extraction should favor RDF parser/vendor support where available, with syntax helpers for Turtle/RDF/XML/JSON-LD.
- SPARQL prefix extraction should be a separate text/prologue utility with documented heuristic limits.
- Common namespace data should be immutable registry data, not mutable app state.
- User/file prefixes should be normalized and merged into project/session prefix stores through pure helpers and storage adapters.
- RDF serialization and SPARQL query generation should consume stored prefixes through separate adapter functions.
- CURIE compaction and expansion should be pure, explicit, longest-prefix aware, and free of logging.
- Base IRI and namespace-stem discovery should be explicit, evidence-bearing functions rather than hidden fallbacks.
