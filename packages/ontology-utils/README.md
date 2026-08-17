# Ontology Utils

Pure ontology-adjacent utilities for IRI tokens, RDF/JS term predicates,
ontology input classification, registered vocabulary checks, XSD datatype
helpers, and identifier generation.

This package composes existing promoted packages:

- `namespace-registry` owns prefixes, CURIEs, and common IRI terms.
- `format-registry` owns MIME type and filename-extension detection.
- `rdf-io` owns RDF/JS term construction, parsing, and serialization.

Ontology Utils should not duplicate those registries.
