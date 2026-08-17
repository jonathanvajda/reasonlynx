# Namespace Prefix Registry Naming Decisions

## How to Fill This Out

Use this file before defining the canonical API. Namespace prefix names should reveal whether a function reads registry data, compacts an IRI, expands a CURIE, extracts declarations from source text, formats an RDF syntax token, or adapts a vendor library.

Avoid names that imply one app owns the behavior. Also avoid names that hide syntax boundaries. `compactIriWithPrefixes` and `formatIriForTurtle` are different actions even if both sometimes return `prefix:local`.

## Naming Principles

- Use `prefixes` for prefix-to-namespace maps.
- Use `namespace` for namespace IRI stems.
- Use `CURIE` only for generic compact IRI behavior.
- Use `QName` only when XML/SPARQL/Turtle grammar is the real concern.
- Use `extract` for reading declarations from text and `format` for creating syntax text.
- Keep vendor names out of pure helpers; include vendor names in adapter wrappers when useful.

## Decision Table

|Decision ID|Old name(s)|Proposed canonical name|Accepted?|Reason|Rejected alternatives|Migration notes|
|:---|:---|:---|:---:|:---|:---|:---|
|NAME-001|`COMMON_PREFIXES`, `NS`, `iriPrefixes`, `PREFIXES`, `DEFAULT_PREFIXES`|`COMMON_NAMESPACE_PREFIXES`|Proposed|States that the object maps prefix labels to namespace IRIs. Avoids app ownership.|`NS`, `prefixMap`, `rdfPrefixes`|App-specific maps should become `{ ...COMMON_NAMESPACE_PREFIXES, ...APP_PREFIXES }`.|
|NAME-002|`COMMON_PREFIXES` as namespace-to-prefix reverse map|`createNamespaceToPrefixMap(prefixes)`|Proposed|Reverse maps should be derived from source registry to prevent drift.|`COMMON_PREFIXES_BY_NAMESPACE` as hand-maintained constant|Ontology Tabulator can migrate away from source reverse map.|
|NAME-003|`bestPrefixForIri`|`findLongestPrefixMatch(iri, prefixes)`|Proposed|Names both the action and the longest-match behavior.|`getBestPrefix`, `findPrefix`|Axiolotl implementation is the strongest seed.|
|NAME-004|`shortIri`, `iriToCurie`, `iriToCurieIfCommon`, `compactIri`|`compactIriWithPrefixes(iri, prefixes, options)`|Proposed|Describes strict IRI-to-CURIE compaction with explicit registry input.|`shortIri`, `downloadRDF`, `formatIri`|Keep `formatIriForDisplay` separate when local-name fallback is intended.|
|NAME-005|`curieToIri`, `expandPrefixedName`|`expandCurieWithPrefixes(curie, prefixes, options)`|Proposed|Generic CURIE expansion should not be tied to SPARQL token scanning.|`resolveIriishToken`, `expandName`|SPARQL-specific expansion can wrap this after parsing token grammar.|
|NAME-006|`iriToDisplay`, `namedNodeToText`, `chooseQNameOrIri`|`formatIriForTurtle(iri, prefixes, options)` and `formatIriForSparql(iri, prefixes, options)`|Proposed|Syntax-safe formatting has stricter rules than generic compaction.|`iriToDisplay`, `formatIri`|TOM and Table Nova display/Turtle helpers need explicit syntax targets.|
|NAME-007|`extractPrefixes`, `parseTurtlePrefixes`|`extractTurtlePrefixDeclarations(text)`|Proposed|Names source syntax and declaration extraction.|`parsePrefixes`, `getPrefixes`|Visual Lynx and IRI Swapper variants should be compared with shared fixtures.|
|NAME-008|`parsePrefixesAndBase`|`extractSparqlPrologue(text)`|Proposed|SPARQL `PREFIX` and `BASE` together form the prologue.|`parseSparqlPrefixes`, `getSparqlHeaders`|IRI Swapper can pilot this adapter.|
|NAME-009|`parseXmlnsPrefixes`, `extractRdfXmlPrefixes`|`extractXmlNamespacePrefixes(xmlText)`|Proposed|Works for XML namespace declarations whether or not the source is RDF/XML.|`parseRdfXmlPrefixes`, `getXmlns`|May have browser and pure-text implementations under one contract.|
|NAME-010|`parseJsonLdPrefixes`|`extractJsonLdContextPrefixes(jsonTextOrObject)`|Proposed|Names JSON-LD context as the source of prefix-like terms.|`parseJsonLdPrefixes`|Expand contract later for array contexts and object terms.|
|NAME-011|`prefixesToJsonLdContext`|`createJsonLdContextFromPrefixes(prefixes)`|Proposed|Names construction of a JSON-LD context object from registry data.|`toJsonLd`, `prefixContext`|IRI Swapper helper is a small pure seed.|
|NAME-012|`bind_prefixes`, N3 writer prefix pass-through|`bindPrefixesToRdflibGraph`, `writeN3StoreWithPrefixes`|Proposed for adapters|Vendor adapters should name the vendor/boundary when the function mutates or calls a vendor API.|`bindPrefixes`, `writeWithPrefixes`|Keep these outside pure core package entrypoint.|
|NAME-013|`computeNamespace`, `getNamespaceFromIri`|`deriveNamespaceFromIri(iri)`|Proposed|Clear deterministic operation from IRI to namespace stem.|`getNamespace`, `computeNamespace`|Compare OntoEagle and OCM invalid-input behavior.|
|NAME-014|`extractNamespacesFromStore`|`listNamespacesInStore(store)`|Proposed|Names store scanning and array result.|`extractNamespaces`, `getNamespaces`|Adjacent utility; include only if namespace discovery belongs in this package.|
|NAME-015|`shortIri` local fallback, `extractLocalNameFromIRI`|`formatIriForDisplay(iri, prefixes, options)` or `extractLocalNameFromIriOrCurie(value)`|Proposed|Human display labels are not the same as syntax-safe CURIEs.|`compactTerm`, `shortName`|Use app-facing display helper only after strict compaction fails.|

## Proposed Package Surface

```js
COMMON_NAMESPACE_PREFIXES
createNamespaceToPrefixMap(prefixes)
mergeNamespacePrefixes(...prefixMaps)
findLongestPrefixMatch(iri, prefixes)
compactIriWithPrefixes(iri, prefixes, options)
expandCurieWithPrefixes(curie, prefixes, options)
deriveNamespaceFromIri(iri)
listNamespacesInStore(store)
extractTurtlePrefixDeclarations(text)
extractSparqlPrologue(text)
extractXmlNamespacePrefixes(xmlText)
extractJsonLdContextPrefixes(jsonTextOrObject)
createJsonLdContextFromPrefixes(prefixes)
formatIriForTurtle(iri, prefixes, options)
formatIriForSparql(iri, prefixes, options)
formatIriForDisplay(iri, prefixes, options)
```

## Notes

- `NS` is too short for a shared package API. It is acceptable as an app-local import alias, but not as the canonical exported name.
- `shortIri` is friendly but ambiguous. It currently means either CURIE compaction or display shortening depending on the caller.
- `iriPrefixes` reads like mutable state. Use explicit names for immutable defaults and separate names for project/user prefix settings.
