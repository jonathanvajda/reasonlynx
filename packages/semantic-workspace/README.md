# Semantic workspace

This package defines environment-neutral contracts between project artifacts,
semantic operations, and UI view providers. Applications publish portable
artifacts; users choose an operation; a thin view adapter applies the result.

The package deliberately does not encode producer-to-consumer application
pairs. Core selection, projection, and merge functions are pure. Browser and
IndexedDB effects remain in application adapters.

Namespace IRIs are imported directly from `namespace-registry`; adapters must
not create local namespace constants or duplicate well-known IRIs.
