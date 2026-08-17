# Ontology Utils Contract

All core functions are synchronous and side-effect free except identifier
creation, which uses runtime entropy/clock sources unless injected.

Functions return booleans or structured results for validation-style calls.
They do not log. They do not touch DOM, storage, files, downloads, network, or
vendor APIs.

`classifyOntologyInput()` is a preflight classifier. RDF parsing remains the
source of truth for syntax validity.
