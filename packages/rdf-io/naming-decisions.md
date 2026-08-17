# RDF Parsing and Serialization Naming Decisions

## Naming Principles Applied

- Use action-oriented names that identify the domain and range.
- Avoid app names, UI names, workflow names, and download/export wording in core APIs.
- Keep browser File, IndexedDB run/workspace state, graph mutation, and domain ontology builders out of core names.
- Prefer `RdfDataset` in public names for RDF/JS dataset-like inputs and outputs. Internally, adapters can support N3 Store while the contract remains RDF/JS-oriented.

## Proposed Canonical Public Functions

|Canonical name|Purpose|Inputs|Output|Notes|
|:---|:---|:---|:---|:---|
|`parseRdfText(text, options = {})`|Parse RDF text in any supported RDF syntax.|`text`; `{ format, mimeType, fileName, baseIri, runtime, strict = true, repairRdfXml = false }`|Promise resolving to `{ dataset, prefixes, sourceFormat, baseIri, warnings }`|Primary parser. Replaces most app-local dispatchers.|
|`serializeRdfDataset(dataset, options = {})`|Serialize RDF/JS dataset-like data into one requested RDF syntax.|`dataset`; `{ format, mimeType, prefixes, baseIri, runtime, jsonLdContext, fallback }`|Promise resolving to `{ text, format, mimeType, warnings }`|Primary serializer. Batch exporters compose this.|
|`convertRdfTextFormat(text, options = {})`|Parse RDF text and serialize it to another RDF syntax.|`text`; `{ inputFormat/inputMimeType/inputFileName, outputFormat/outputMimeType, baseIri, prefixes, runtime }`|Promise resolving to `{ text, sourceFormat, targetFormat, prefixes, warnings }`|Visual Lynx transformer workflow after core parser/serializer stabilizes.|
|`parseRdfFile(file, options = {})`|Browser adapter that reads a File and parses it.|Browser `File`; parser options|Promise resolving to the same result as `parseRdfText`|Should live in browser adapter and call browser-file-io for reading.|
|`serializeRdfDatasetToFormats(dataset, formats, options = {})`|Convenience batch serializer.|Dataset, array of formats, serializer options|Promise resolving to `Record<format, SerializeRdfResult>`|Table Nova-style wrapper, not core primitive.|

## Proposed Internal Adapter Names

|Adapter name|Purpose|Public?|
|:---|:---|:---:|
|`parseRdfTextWithN3(text, options)`|Parse Turtle/TriG/N3/N-Triples/N-Quads using N3.|No, unless consumers need low-level control.|
|`serializeRdfDatasetWithN3(dataset, options)`|Serialize Turtle/TriG/N-Triples/N-Quads using N3.Writer.|No.|
|`parseJsonLdTextToRdfDataset(text, options)`|Parse JSON-LD through jsonld.toRDF and N-Quads bridge.|No.|
|`serializeRdfDatasetToJsonLd(dataset, options)`|Serialize dataset through N-Quads and jsonld.fromRDF.|No.|
|`parseRdfXmlTextToRdfDataset(text, options)`|Parse RDF/XML through rdflib and convert to RDF/JS.|No.|
|`serializeRdfDatasetToRdfXml(dataset, options)`|Serialize RDF/JS dataset through rdflib.|No.|
|`convertRdfJsTermToRdflibTerm(term, runtime)`|Bridge RDF/JS terms to rdflib terms.|No.|
|`convertRdflibTermToRdfJsTerm(term, runtime, targetStore)`|Bridge rdflib terms to RDF/JS terms.|No.|
|`createRdfIoRuntime(overrides = {})`|Resolve or validate N3/jsonld/rdflib dependencies.|Maybe, if package supports browser globals and test injection.|

## Rejected Or App-Local Names

|Existing name|Decision|Reason|
|:---|:---|:---|
|`parseRdfInput`|Rename public API to `parseRdfText`.|`Input` is vague; the actual domain is RDF text.|
|`parseRdfToStore`|Rename public API to `parseRdfText`.|Output should be contract-shaped rather than exposing current N3 Store as the whole API.|
|`parseOntologyText`|Keep as app adapter if needed.|Ontology import is a caller workflow; parser should accept any RDF text.|
|`parseOntologyToNQuads`|Keep as IRI Swapper adapter.|Reads File and assigns named graph/run id; not pure parsing.|
|`serializeRun`|Keep app-local.|Reads IndexedDB/app state and applies workflow export behavior.|
|`generateRdfString`|Keep or rename inside TOM domain layer.|Builds ontology quads from TOM rows before serialization.|
|`buildOntologyTurtle`|Replace long-term with dataset builder plus `serializeRdfDataset`.|Manual Turtle string generation is domain serialization, not generic RDF I/O.|
|`downloadRDF` / `exportRDF` patterns|Do not use in core.|Download/export naming mixes RDF serialization with browser download side effects.|

## Result Shape Decision

Use result objects instead of returning bare strings/stores from public functions.

```js
/**
 * @typedef {object} ParseRdfResult
 * @property {object} dataset RDF/JS dataset-like object, initially compatible with N3.Store.
 * @property {Record<string, string>} prefixes Prefixes discovered from source text or parser metadata.
 * @property {string} sourceFormat Normalized RDF format id such as "turtle" or "jsonld".
 * @property {string|null} baseIri Base IRI used during parse.
 * @property {Array<RdfIoWarning>} warnings Non-fatal parse observations.
 */
```

```js
/**
 * @typedef {object} SerializeRdfResult
 * @property {string} text Serialized RDF text.
 * @property {string} format Normalized RDF format id.
 * @property {string} mimeType Preferred MIME type for the format.
 * @property {Array<RdfIoWarning>} warnings Non-fatal serializer observations.
 */
```

This preserves OCM's structured contract while incorporating Visual Lynx's warning/logging needs and Table Nova's serializer usage.
