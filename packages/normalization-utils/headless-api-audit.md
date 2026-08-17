# Normalization Utilities Headless API Audit

Date: 2026-08-15

## Scope

This package owns pure string normalization, identifier case conversion, date-part extraction, and filename-safe timestamps.

It does not own RDF term normalization, ontology validation, MIME normalization, namespace expansion, browser filenames/downloads, search token normalization, or NLP lexical normalization.

## Stable Programmatic API

The public API is the package export surface in `src/index.js`.

### Case and Label Utilities

- `NORMALIZATION_CASE_STYLES`
- `splitStringToWords(value)`
- `detectStringCaseStyle(value)`
- `buildLabelFromWords(words, options)`
- `normalizeStringToCase(value, caseStyle, options)`
- `normalizeStringToFlatCase(value)`
- `normalizeStringToUpperFlatCase(value)`
- `normalizeStringToCamelCase(value)`
- `normalizeStringToPascalCase(value)`
- `normalizeStringToSnakeCase(value)`
- `normalizeStringToShoutingSnakeCase(value)`
- `normalizeStringToKebabCase(value)`
- `normalizeStringToTrainCase(value)`
- `normalizeStringToCobolCase(value)`
- `normalizeStringToAsciiSlug(value, options)`

### Date and Filename Utilities

- `getLocalDateParts(date)`
- `getLocalDateTimeParts(date)`
- `getUtcDateParts(date)`
- `getUtcDateTimeParts(date)`
- `formatDatePartsForFilename(parts)`
- `getTimestampForFilename(date, options)`
- `appendTimestampToFilename(filename, options)`

## Input Contracts

- String functions accept `unknown` values and coerce with `String(value ?? '')`.
- Case conversion supports human labels, punctuation, snake case, kebab case, Train-Case, COBOL-CASE, camelCase, PascalCase, and acronym boundaries.
- `normalizeStringToCase` accepts only the values in `NORMALIZATION_CASE_STYLES`; unknown styles fall back to `fallbackStyle`, and an unknown fallback resolves to `camelCase`.
- Date functions accept `Date` values. Missing, non-Date, or invalid Date-object inputs fall back to the current date.
- Timestamp helpers accept explicit `Date` inputs for deterministic execution. If a date is omitted, the operation is intentionally nondeterministic because it uses the current clock.

## Output Contracts

- Case and label utilities return strings or string arrays.
- Date-part utilities return zero-padded date/time part objects.
- Filename timestamp utilities return strings only; they do not create files or trigger downloads.
- No function returns DOM nodes, `File`, `Blob`, storage records, or app-specific objects.

## Error Model

The package is tolerant by design:

- Empty or nullish text becomes an empty string or empty word array.
- Unknown case-style inputs fall back instead of throwing.
- Invalid date inputs fall back instead of throwing.

Throwing is reserved for impossible programmer errors introduced by future changes, not expected user input.

## Side Effects

The package has no DOM, IndexedDB, localStorage, File System Access, network, logging, download, or vendor side effects.

Clock access is the only nondeterministic dependency, and it is isolated to date/timestamp functions when callers omit the `date` argument.

## Adapter Boundary

Browser, CLI, CI, and agent adapters may call these functions to prepare identifiers, filenames, display labels, and timestamps. They must own:

- reading or writing files;
- choosing download names;
- storage keys and record persistence;
- UI display and toast/status reporting;
- app-specific ontology/RDF validation.

## Headless Coverage

Jest coverage exercises:

- supported case-style publication;
- word splitting across mixed naming conventions;
- common and extended case conversions;
- ASCII slug normalization;
- style detection and fallback behavior;
- label construction;
- UTC/local date part extraction with caller-provided dates;
- invalid date fallback behavior;
- filename timestamp generation and extension placement.

## Maturity Assessment

Current maturity: Level 5 for the scoped normalization capability.

Rationale:

- public API is pure and environment-neutral;
- exported names follow roadmap action-oriented naming;
- adapter boundaries are explicit;
- duplicate app-level implementations have been rewired or removed where active;
- shared package is mirrored across the browser apps;
- headless Jest coverage includes paradigmatic and edge cases.
