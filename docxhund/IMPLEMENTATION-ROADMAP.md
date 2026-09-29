# DocxHund Remaining Capability Roadmap

This backlog orders the work remaining after the project portfolio, knowledge-base ingestion, artifact persistence, RDF-backed block preview, outline, and initial selection capture were added.

## Architecture checkpoint

The current OOXML parser produces a normalized document-part projection, and both RDF serialization and the reader consume that projection. This is transitional rather than the final target architecture: before annotation commands are enabled, parsed document quads must become the authoritative in-memory state and the reader must obtain its view model through RDF dataset selectors. The user sees one Word-like document surface; a projection layer adds RDF resource pointers to that presentation DOM without making the DOM authoritative.

## Dependencies

No new library is required for the current implementation. Reused dependencies are:

- JSZip for OOXML package access.
- Shared RDF I/O, tabular I/O, format/MIME registry, namespace registry, browser file I/O, and IndexedDB project-portfolio packages.
- Vendored N3, jsonld.js, and rdflib adapters for RDF input/output.
- Vendored Compromise 14.15.1 for the later candidate-generation phase.
- Vendored docx-preview 0.4.1 for the Word-like presentation layer.
- Vendored DOMPurify 3.4.16 to sanitize the fidelity preview body.

The docx-preview output is a non-authoritative presentation surface, its generated body is sanitized with DOMPurify, and RDF resource pointers are projected onto matched blocks. The explicit safe renderer remains a fallback. Do not add Mammoth unless a future comparison proves both renderers insufficient. Fuse.js/MiniSearch should be evaluated only when measured entity-search performance justifies it.

## Ordered implementation

1. **Establish the RDF state boundary and complete OOXML presentation (CAP-01–03).** Materialize parsed document quads into the authoritative in-memory dataset, add RDF-to-view selectors, and make the reader consume only those selectors. Then extract runs, bold/italic, lists, tables, hyperlinks, images, headers/footers, notes, and resolved style names into that RDF model. Add deterministic structural identifiers so reparsing an unchanged document preserves target identity.
2. **Durable text-selection targets (CAP-04, CAP-06).** Convert browser ranges into canonical document offsets, exact text, prefix/suffix context, and start/end RDF resources. Persist and restore targets; test single-run, cross-run, and cross-paragraph selections.
3. **RDF annotation command layer (CAP-05, CAP-13).** Add atomic add/remove quad commands, named graphs for source/manual/suggested assertions, pending RDF-delta preview, provenance, undo, and retract. Make RDF the sole annotation authority.
4. **Annotation rendering and review UI (CAP-05, CAP-11).** Render highlights from RDF targets, handle overlap, add selection actions, filters, inspector state, edit/retract controls, and accepted/rejected/superseded suggestion states.
5. **Knowledge browser and linking (CAP-07–08, CAP-14).** Search enabled workspace graphs by label/type/source, choose entities/classes, inspect triples, and create minimally typed/labeled project resources. Reuse the namespace registry; never introduce aliases for registered vocabularies.
6. **Structured assertion templates (CAP-09).** Represent templates and fields in RDF, render ontology-driven forms, validate required roles, preview the quad delta, and commit multi-triple assertions with evidence links.
7. **Candidate generation (CAP-10–11).** Add exact and normalized label matching, alternate labels/acronyms, legal-citation patterns, then Compromise-based NLP. Keep candidates in a distinct graph until reviewed.
8. **SPARQL recipes (CAP-12).** Persist named query/update recipes, expected graph inputs, previewed deltas, execution runs, and provenance. Reuse the existing RDF and run-history infrastructure.
9. **Query and evidence views (CAP-15–16).** Add stock queries, shared tabular result rendering/export, evidence-bearing explanations, conflict/no-evidence states, and focused Cytoscape subsets.
10. **Project lifecycle and export completion (CAP-17–18).** Add project archive import/export, document-only/annotation-only/provenance subsets, stale-derived-artifact tracking, migrations, deletion, and optional File System Access synchronization.
11. **Hardening and accessibility.** Add large-document virtualization, worker-based parsing/candidate generation, storage quotas/recovery, keyboard annotation workflows, focus management, ARIA review, and browser compatibility tests.
