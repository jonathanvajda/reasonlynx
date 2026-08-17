# Tabular I/O Decision Log

## 2026-07-27

- Created a staged `@ontoeagle/tabular-io` package.
- Kept browser file reads and downloads outside the package.
- Treated query CSV as language-neutral query-record exchange rather than a
  SPARQL-only utility.
- Split IRI mapping row normalization from generic delimited parsing.
- Deferred XLS/XLSX implementation until SheetJS dependency provenance and
  adapter shape are finalized.
