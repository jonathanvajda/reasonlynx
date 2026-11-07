# SPARQL query library

The editor and diagram share the top row equally. A collapsible query library
sits below: search/options and expandable data management occupy the smaller
left column, while results occupy the wider right column. Cards form two columns
when space permits. Narrow screens stack the panels. Selecting a title loads and renders that query;
checkboxes independently select queries for export, including across searches.

## Implemented checklist

- [x] Live case-insensitive substring search with descending relevance scores.
- [x] Typo matching using Levenshtein distance and correction hints.
- [x] Cards with source, timestamp, available JSON-LD annotations, numbered
      three-line previews, highlighted matching lines, and bold matching text.
- [x] Search ontology IRIs, rdfs:label, skos:prefLabel, skos:altLabel and
      CCO ont00001753 acronym annotations.
- [x] Resolve resources from the SPARQL.js AST, including query-local PREFIX
      and BASE resolution and query/update patterns. Prefix declarations alone,
      comments, and literal text do not establish a resource occurrence.
- [x] Suggestions from ontology annotations while typing; picking one is optional.
- [x] Index one or all stored ontology artifacts, or multiple local ontology files.
- [x] Automatically index materialized shared-project annotation quad rows.
- [x] Read OntoEagle ontology document artifact references from its document store.
- [x] Read shared raw query artifacts, Axiolotl rdf:value JSON-LD, and OKEA
      has_sparql_query_text_value nodes nested in CQ Ferret graphs.
- [x] Support expanded JSON-LD properties and inline compact context mappings.
- [x] Read legacy CQDatabase/CQStore and inferenceDB/savedQueries without migration.
- [x] Explicit read-only adapter for other same-origin database/object store pairs,
      including string/Blob rows and query, text, value, or content fields.
- [x] Import .rq/.sparql and query-bearing JSON/JSON-LD into shared project artifacts.
- [x] Export one selected query as .rq; export multiple queries as individual .rq
      entries in one ZIP. Numeric filename prefixes prevent collisions.
- [x] Pure search tests, existing shared-storage regression tests, dependency
      validation, and browser smoke checks.

## Storage and scope

The authoritative store is OntologyWorkbenchProjects/artifacts. The active project
comes from the existing workspace.activeProjectId setting. Refresh rereads that
setting and the artifacts; it also refreshes materialized annotation rows. Legacy
unscoped stores are included automatically only in the default project. Additional
stores require an explicit database and object store name and are read without writes.
Importing query files writes new shared artifacts; source databases are retained.

All apps must run on the same origin in the same browser profile. Serve this repo
using the existing development server or, for example, `python -m http.server 8765`,
then open `/sparql-pattern-visualizer/`. A file:// page does not reliably support
ES module loading or shared IndexedDB access. Different ports have separate storage.

Imported ontology annotations and additional query-store reads last for the current
page session. Query imports persist in the shared database. Stored ontology parsing
supports Turtle, N-Triples, N-Quads, TriG, N3, JSON-LD, and RDF/XML through existing
RDF adapters and local vendor libraries. The .owl extension defaults to RDF/XML;
use .ttl for Turtle ontologies. Individual parse failures are reported by source.

## Ranking

Scores are deterministic ranking weights, not probabilities or percentages:

- An exact substring in a query line or title scores 100.
- Fuzzy word matching starts at 65, discounted by normalized edit distance.
  It requires at least four characters, permits one edit, or two for inputs
  of at least eight characters.
- An ontology annotation/IRI match contributes 85% of its text-match score,
  provided the annotated resource occurs in the parsed query.
- The strongest signal wins; additional matching lines/resources add at most 9.
  Ties sort by title/id. Empty input lists all queries with score 0.

Search treats the entered text as one substring, not a Boolean expression or
an embedding search. `pho` matches both “Telephone” and “phone number” as literal
substrings. It does not infer synonyms absent from ontology annotations. Invalid
SPARQL remains text-searchable but has no ontology resource matches; selecting an
unrenderable query clears the previous diagram and reports the parse error.

## Verification

Run `node --test sparql-pattern-visualizer/app/query-library.test.js` and
`node scripts/validate-app.mjs sparql-pattern-visualizer`.

The search tests exercise raw/expanded/compact payloads, exact line spans, typo
corrections, prefix expansion, multiple resource matches, false-positive exclusions,
invalid queries, empty searches and sorting. Browser smoke checks exercise file
imports, live results, query selection/rendering, ontology file indexing, download,
the library toggle, and mobile viewport behavior.

Potential future work: cached persistent ontology indexes, remote JSON-LD context
resolution in query normalization, and a background worker/paged results for very
large query collections. Inline context mappings suffice for the existing OKEA/CQ
payloads; this extractor is not a general-purpose JSON-LD expansion engine.
