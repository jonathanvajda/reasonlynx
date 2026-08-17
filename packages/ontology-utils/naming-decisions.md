# Naming Decisions

## Decision Table

|Decision ID|Old name(s)|Proposed canonical name|Accepted?|Reason|Rejected alternatives|Migration notes|
|:---|:---|:---|:---:|:---|:---|:---|
|NAME-001|`isAbsoluteIri`, `isNamedIri`|`isAbsoluteIri`|Proposed|The action is clear and already used in shared namespace-registry. Keep the name but define strict/broad behavior explicitly.|`isNamedIri` because it is RDF-term specific and too narrow; `validIRI` because it is not action-oriented.|Apps currently using HTTP(S)/URN-only checks need option review.|
|NAME-002|`normalizeIriString`, `normalizeIriCell`, `normalizeIriishToken`|`normalizeIriToken`|Proposed|Describes the boundary: user/file/SPARQL/table token to normalized IRI token. Avoids pretending validation has occurred.|`cleanIri`, `normalizeIriString`, `normalizeIriishToken`.|Axiolotl, TOM, and IRI Swapper can replace local trim/angle-bracket helpers.|
|NAME-003|`looksLikeBnodeId`, `isBlankId`|`isBlankNodeId`|Proposed|Names the actual input shape: a string identifier, not an RDF/JS term.|`isBlankId` because it is vague; `looksLikeBnodeId` because it underspecifies contract.|Used by JSON-LD object traversal and rdflib/RDFJS conversion adapters.|
|NAME-004|`isBlankNode`|`isBlankNodeTerm`|Proposed|Distinguishes RDF/JS term checks from string blank-node IDs.|`isBlankNode` because ambiguous across string IDs and terms.|Ontology Tabulator can migrate after tests cover term and null input.|
|NAME-005|`quadHasBlankNode`|`hasBlankNodeTermInQuad`|Proposed|Action names the range and target shape precisely.|`quadHasBlankNode` because grammar is less consistent with action naming.|Axiolotl inference should reuse this once package exists.|
|NAME-006|`canBeSubject`|`canUseTermAsSubject`|Proposed|Makes RDF role validation explicit and action-oriented.|`isSubjectTerm`, because a term is not inherently a subject outside a quad role.|Axiolotl inference and RDF IO can share non-throwing checks.|
|NAME-007|`canBePredicate`|`canUseTermAsPredicate`|Proposed|Consistent role-validation naming.|`isPredicateTerm`.|Same as above.|
|NAME-008|`canBeObject`|`canUseTermAsObject`|Proposed|Consistent role-validation naming.|`isObjectTerm`.|Same as above.|
|NAME-009|`canBeGraph`|`canUseTermAsGraph`|Proposed|Consistent role-validation naming.|`isGraphTerm`.|Same as above.|
|NAME-010|`isValidOntology`, `detectOntologyFormat`|`classifyOntologyInput`|Proposed|Returns structured classification from filename, MIME, content, and optional parse evidence.|`isOntologyFile` because boolean is too lossy; `detectOntologyFormat` because format-registry owns format detection.|TOM and IRI Swapper can use it for preflight; RDF parser remains source of truth for actual parse validity.|
|NAME-011|`isBuiltInIri`|`isRegisteredVocabularyIri`|Proposed|Names the registry-backed concept rather than a local built-in list.|`isBuiltInIri` because "built-in" is app-relative.|OCD measures should use registry-derived namespace stems.|
|NAME-012|`isInOntologyNamespace`|`isIriInNamespace`|Proposed|General namespace containment helper usable outside one ontology.|`isLocalIri` because localness depends on context.|OCD engine can pass ontology namespace explicitly.|
|NAME-013|`datatypeLocalName`|`getXsdDatatypeLocalName`|Proposed|States that only XSD local names are expected.|`datatypeLocalName` because arbitrary datatype IRIs may not be XSD.|Table Nova direct migration.|
|NAME-014|`mapXsdDatatypeToJsonSchema`|`describeXsdDatatypeForJsonSchema`|Proposed|Returns a schema descriptor, not a transform of data.|`mapXsdDatatypeToJsonSchema` acceptable but less descriptive about output being a fragment.|Table Nova direct migration.|
|NAME-015|`coerceExampleValue`|`coerceLexicalValueForXsdDatatype`|Proposed|Names input domain and reason for coercion; not tied to examples only.|`coerceExampleValue` because too UI/report-specific.|Table Nova direct migration; later useful for TOM/table validation.|
|NAME-016|`uuid`, `makeGuidLike`|`createUuid`|Proposed|Action-oriented and not tied to GUID terminology unless callers request compact output.|`makeGuidLike`, `uuid`.|Support `{ removeHyphens: true, uuidSource }` for Axiolotl saved-query IDs and tests.|
|NAME-017|`makeNamedGraphIRI`|`createTimestampedGraphIri`|Proposed|Specific enough for graph use; should depend on `createUuid` and clock option.|`makeNamedGraphIRI` because "make" is less consistent and timestamp behavior is hidden.|Axiolotl graph creation migration.|

## Notes

- Do not introduce local constants for RDF/RDFS/OWL/XSD/DCTERMS/SKOS/CCO/OKEA IRIs in this package. Use `COMMON_NAMESPACE_IRIS` and registry functions directly.
- JSON-LD object keys should use full IRIs when representing data objects; compact CURIEs are serialization concerns unless the caller explicitly asks for compacted output.
- UUID/GUID might also fit the next normalization-utils family. It is kept here for now because named graph IRI generation and IRI reservation workflows require it.
