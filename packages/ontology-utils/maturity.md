# Reuse Maturity Ratings

## Maturity Scale

|Level|Name|Meaning|
|:---:|:---|:---|
|0|Local only|App-specific, unclear contract, or tightly coupled to DOM/storage.|
|1|Candidate|Useful behavior exists, but it is under-tested, underspecified, or partially coupled.|
|2|Characterized|Current behavior is documented with representative fixtures and comparison notes.|
|3|Reusable|Function is pure or mostly pure, named by action, has clear JSDoc, and has focused tests.|
|4|Package ready|Function is environment-neutral, has predictable error handling, and separates adapters from core logic.|
|5|Canonical|Shared package is adopted by all intended consumers and local duplicates have been deleted.|

## Rating Table

|ID|Function or package|Current level|Target level|Evidence|Blockers|Next action|Owner|Date updated|
|:---|:---|:---:|:---:|:---|:---|:---|:---|:---|
|MAT-001|`isAbsoluteIri` in namespace-registry|3|5|Pure, exported, JSDoc, used by shared CURIE/prefix helpers.|Validation behavior is intentionally light and differs from Axiolotl's stricter scheme allowlist.|Decide whether canonical behavior should be broad scheme-like validation or stricter semantic-web IRI validation.|Codex|2026-08-05|
|MAT-002|Axiolotl `isAbsoluteIri`|2|4|Rejects CURIEs and has explicit comments on scheme policy.|Local duplicate, no direct Jest, not exported from shared package.|Use as candidate behavior for stricter `isAbsoluteIri` tests.|Codex|2026-08-05|
|MAT-003|IRI token normalization helpers|2|5|Axiolotl, TOM, and tabular-io all normalize angle-bracket or display-form IRI tokens.|Behavior split across local functions and private helpers.|Define `normalizeIriToken(value, options)` and cover angle brackets, whitespace, non-string values, and display labels.|Codex|2026-08-05|
|MAT-004|RDF term role predicates|3|5|Axiolotl inference has clear pure checks; RDF IO has normalization enforcement.|Currently private/local except through thrown errors in RDF IO.|Promote `isRdfTerm`, `isBlankNodeTerm`, `canUseTermAsSubject`, `canUseTermAsPredicate`, `canUseTermAsObject`, `canUseTermAsGraph`.|Codex|2026-08-05|
|MAT-005|Ontology file classification|1|5|TOM and IRI Swapper both need this; current helpers are heuristics or filename mapping.|Needs clear boundary with format-registry and RDF parser probe.|Define structured `classifyOntologyInput` that can use filename, MIME, content snippet, and optional parse result.|Codex|2026-08-05|
|MAT-006|Built-in ontology IRI classification|2|4|OCD measures and engine functions are pure and documented.|Built-in namespace list must come from namespace-registry, not local constants.|Define registry-backed `isRegisteredVocabularyIri` and `isIriInNamespace`.|Codex|2026-08-05|
|MAT-007|XSD datatype helpers|3|5|Table Nova has pure JSDoc functions for JSON Schema mapping and example coercion.|No direct Jest; local XSD local-name extraction should reuse registry consistently.|Promote `getXsdDatatypeLocalName`, `describeXsdDatatypeForJsonSchema`, and `coerceLexicalValueForXsdDatatype`.|Codex|2026-08-05|
|MAT-008|UUID/GUID helpers|1|5|Three Axiolotl variants show need for UUID and graph IRI generation.|Browser globals, random fallback, hyphen policy, and testability differ.|Define `createUuid(options)` and `createTimestampedIri(baseIri, options)` with injectable clock/UUID.|Codex|2026-08-05|

## Promotion Checklist Status

- [x] Candidate functions are grouped and documented.
- [ ] Canonical function names are accepted.
- [ ] Inputs and outputs are fully specified.
- [ ] Core logic is pure or mostly pure.
- [ ] Error and warning behavior is predictable.
- [ ] Representative Jest fixtures exist.
- [ ] Browser, worker, and Node assumptions are documented in package contracts.
- [ ] Local duplicates have been deleted after migration.

## Notes

- This family should start at maturity level 2 overall: enough candidate behavior is documented to define canonical APIs, but the package does not exist yet.
- The strongest existing foundations are `namespace-registry` for IRI/prefix work and `rdf-io/rdf-model.js` for RDF/JS terms. New ontology-utils code should compose those packages rather than fork their logic.
