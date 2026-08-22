# Implementation Plan: Reusable Ontology Text QA Components

## Goal

Build reusable JavaScript components for checking ontology annotation text. The system should begin with a single-field spelling checker, then add grammar checking, then table-based ontology QA, and later Aristotelian genus-species definition checking.

Do **not** make later capabilities depend on earlier UI implementations. Each checker should be usable independently.

## Architecture Principle

Use three layers:

1. **Core checker functions**

   * Pure JavaScript functions.
   * No DOM dependency.
   * Accept plain strings and config objects.
   * Return structured issue objects with character offsets.

2. **UI components**

   * Single-field checker.
   * Table-field checker.
   * Highlight renderer.
   * Filter controls.

3. **Ontology integration**

   * RDF parsing and serialization.
   * Existing ontology table loader.
   * Existing serializers.
   * Future save/export integration.

## Standard Issue Object

All checker modules should return issues in this shape:

```js
{
  id: "issue-uuid-or-generated-id",
  checker: "spelling",
  category: "spelling",
  severity: "error",
  code: "UNKNOWN_WORD",
  message: "Possible spelling error.",
  fieldName: "definition",
  iri: "http://example.org/SomeClass",
  start: 12,
  end: 18,
  text: "firerm",
  suggestions: ["firearm"],
  metadata: {}
}
```

Required fields:

```js
checker
category
severity
code
message
start
end
text
```

Optional fields:

```js
fieldName
iri
suggestions
metadata
```

Severity values:

```js
"error" | "warning" | "info"
```

## Phase 1: Single-Field Spelling Checker

Build a page/component that checks one text field for spelling.

### Requirements

* User enters text into a textarea.
* User clicks “Check spelling.”
* Misspelled words are highlighted.
* Results appear below the field.
* The checker returns character offsets for each misspelled token.
* Do not implement grammar yet.
* Do not implement ontology table yet.

### Core functions

```js
function tokenizeText(text) {}

function normalizeToken(token) {}

function buildLexicon(config) {}

function checkSpelling(text, options) {}
```

Expected result:

```js
{
  status: "pass" | "fail",
  issues: []
}
```

A spelling issue should be an `error`.

## Phase 2: Single-Field Spelling + Grammar Checker

Extend the single-field checker so spelling and grammar are separate modules.

### Requirements

* Spelling errors remain `error`.
* Grammar findings are `warning`.
* Grammar checks should be heuristic only.
* Do not claim full grammatical certainty.

### Grammar checks for MVP

Implement only simple checks:

* repeated words
* missing final punctuation
* suspicious subject-verb agreement patterns, such as `Entity that are`
* excessive clause cues
* unmatched parentheses

### Core functions

```js
function checkGrammar(text, options) {}

function checkTextField(text, options) {
  return {
    status,
    issues: [
      ...checkSpelling(text, options).issues,
      ...checkGrammar(text, options).issues
    ]
  };
}
```

Status rules:

```js
if any spelling error -> "fail"
else if any grammar warning -> "warning"
else -> "pass"
```

## Phase 3: Ontology Table Field Checking

Apply reusable checker modules to multiple ontology annotation fields.

### Existing table shape

Assume rows like:

```js
{
  iri: "http://example.org/SomeClass",
  type: "owl:Class",
  label: "Some Class",
  prefLabel: "some class",
  definition: "A thing that ...",
  description: "Optional description",
  acronym: "ABC"
}
```

### Checked fields

Initially check:

```js
label
prefLabel
definition
description
```

Acronym fields should contribute to the local lexicon, but do not need full spelling checks.

### Requirements

* Filter rows by:

  * all
  * spelling errors
  * grammar warnings
  * clean
  * modified
* Highlight misspelled word spans.
* Highlight grammar warning spans.
* User can edit a field.
* Recheck the edited field after debounce.
* Change status icon dynamically:

  * spelling error: red X
  * grammar warning: yellow warning
  * clean: green check
* Track modified rows.
* Saving/export should use existing serializers.

### Core functions

```js
function buildOntologyLexicon(rows, options) {}

function checkOntologyRow(row, lexicon, options) {}

function checkOntologyTable(rows, options) {}

function updateCheckedField(row, fieldName, newValue, previousCheckState, options) {}
```

## Phase 4: Genus-Species / Aristotelian Definition Checker

This is a later MVP and should be a separate optional checker.

Do not bake this into spelling or grammar.

### Category

Use a separate category:

```js
category: "genus-species-form"
checker: "aristotelian-definition"
severity: "warning"
```

### UI

Add an optional toggle:

```text
[ ] Check genus-species definition form
```

When enabled, display results with a distinct Aristotle icon, such as:

```text
🏛️ ✓
🏛️ ✕
🏛️ ⚠
```

Later this could be replaced with an Aristotle bust SVG.

### Important

The checker must support multiple patterns eventually, not only:

```text
An X that is Y
```

Potential future patterns include:

```text
An X whose Y is ...
An X which is ...
A Y that ...
A Y whose ...
A process in which ...
A role borne by ...
```

For now, create only the interface and module boundary.

### Future function

```js
function checkAristotelianDefinition(text, options) {
  return {
    status: "pass" | "warning",
    issues: []
  };
}
```

## Suggested File Structure

```text
/src
  /core
    tokenizer.js
    lexicon.js
    spelling-checker.js
    grammar-checker.js
    aristotelian-definition-checker.js
    issue-utils.js
    text-field-checker.js
    ontology-table-checker.js

  /ui
    highlight-renderer.js
    single-field-spellcheck-page.js
    single-field-qa-page.js
    ontology-table-qa.js
    issue-filter-controls.js

  /ontology
    ontology-row-model.js
    annotation-extractor.js
    ontology-lexicon-builder.js

  /data
    builtin-words.json
    builtin-phrases.json
    style-rules.json

/tests
  spelling-checker.test.js
  grammar-checker.test.js
  text-field-checker.test.js
  ontology-table-checker.test.js
```

## Critical Design Requirement

Every checker must be reusable outside the current UI.

Do not let checker functions read from the DOM.

Good:

```js
const result = checkSpelling("A firerm.", { lexicon });
```

Bad:

```js
const result = checkSpellingFromTextarea();
```

## MVP Deliverables

### Deliverable 1

A single-field spelling checker page.

### Deliverable 2

A single-field spelling + grammar checker page.

### Deliverable 3

A table-based ontology annotation checker using reusable modules.

### Deliverable 4

A placeholder module and UI category for future Aristotelian definition checking, but no full implementation yet.

## Non-goals for the first MVP

Do not implement:

* full grammar checking
* full Aristotelian definition analysis
* automatic correction
* AI-based suggestions
* RDF/XML parsing
* OWL reasoning
* server-side services
* dependency on external APIs

## Later Enhancements

Later, add:

* Hunspell or nspell dictionary support
* SCOWL-derived dictionaries
* custom project allowlists
* imported ontology lexicon harvesting
* approved phrase list management
* suggestion application button
* bulk fix review
* export QA report as CSV/JSON
* SVG icon set for issue categories

## Current Milestone Checklist

This checklist reflects the revised plan after the NLP Quality Assurance page
work, dictionary build work, and field-specific checker norms.

### Static page and local-first architecture

- [x] Add a distinct static GitHub Pages page: `docs/nlp-quality-assurance.html`.
- [x] Keep all checking local-native and browser-side.
- [x] Keep checker modules independent of the DOM.
- [x] Make the DOM downstream of memory state and persisted state.
- [x] Persist latest NLP QA state in IndexedDB.
- [x] Reuse existing RDF parser and serializer helpers through `docs/app/engine.js`.
- [x] Load existing local RDF vendor assets from `docs/app/shared/vendor/`.
- [x] Add links to NLP Quality Assurance from the existing app pages.
- [ ] Apply edited annotation text back into the RDF store before RDF export.
- [ ] Add a full QA report export independent of RDF serialization.

### Scratch pad checker

- [x] Add a text QA scratch pad.
- [x] Support spelling checks in the scratch pad.
- [x] Support grammar checks in the scratch pad.
- [x] Support Aristotelian form checks in the scratch pad.
- [x] Add scratch-pad check-mode controls for spelling, grammar, and Aristotelian form.
- [x] Highlight issue spans from character offsets.
- [x] Show structured issue rows below the scratch pad.
- [ ] Add user-facing correction/suggestion application controls.

### Ontology annotation table checker

- [x] Extract annotation rows from the RDF store rather than reading rendered table cells.
- [x] Check ontology rows from memory state.
- [x] Render editable annotation fields from checked state.
- [x] Debounce edited-field rechecking.
- [x] Track modified rows.
- [x] Filter rows by all, spelling errors, grammar warnings, clean, and modified.
- [x] Add ontology table check-mode controls for spelling, grammar, and Aristotelian form.
- [x] Enforce field-specific checker norms.
- [x] Check `rdfs:label` with spelling only.
- [x] Check `skos:prefLabel` with spelling only.
- [x] Check `skos:definition` with spelling, grammar, and Aristotelian form by default.
- [x] Check `skos:example` with spelling and grammar.
- [x] Check `skos:scopeNote` with spelling and grammar.
- [x] Ignore `dcterms:description` for NLP QA annotation checking.
- [ ] Add filter for Aristotelian form warnings.
- [ ] Add bulk review workflow.

### Checker modules and rules

- [x] Define reusable standard issue objects with offsets.
- [x] Implement reusable spelling checker functions.
- [x] Implement reusable grammar heuristic functions.
- [x] Implement an Aristotelian definition checker boundary.
- [x] Add a modest heuristic Aristotelian form check.
- [x] Add repeated-word grammar heuristic.
- [x] Add missing-final-punctuation grammar heuristic.
- [x] Add suspicious `Entity that are`-style agreement heuristic.
- [x] Add unmatched-parentheses grammar heuristic.
- [x] Add base inflection lookup variants for spelling.
- [x] Add possessive apostrophe lookup variants, including curly apostrophe support.
- [ ] Add fuller grammar/style rule catalog.
- [ ] Add richer Aristotelian definition pattern library.
- [ ] Add configurable rule severity policy.

### Dictionary and lexicon strategy

- [x] Add generated English spelling lexicon asset at `docs/app/data/nlp-qa-english-lexicon.js`.
- [x] Build the generated lexicon from the FinNLP `lexicon.ts` source.
- [x] Add repeatable lexicon build tooling under `src/lexicon-build/`.
- [x] Support Brill-style `window.POSTAGGER_LEXICON = {...}` source shape.
- [x] Support FinNLP TypeScript default-export source shape.
- [x] Filter punctuation-only, slash-heavy, and proper-noun-heavy lexicon noise by default.
- [x] Layer generated English dictionary, built-in ontology words, technical allowlist, ontology-derived terms, and caller allowlists.
- [ ] Add user-managed allowlist UI.
- [ ] Persist user/project allowlists with reason metadata in IndexedDB.
- [ ] Add explicit blocklist or suspicious-term policy.
- [ ] Harvest lexicon terms from imported ontology closure files.
- [ ] Consider a compressed or lazy-loaded dictionary asset if page weight becomes a problem.

### Tests and maintainability

- [x] Add Jest coverage for pure NLP QA model functions.
- [x] Add Jest coverage for ontology row extraction and ontology checking.
- [x] Add Jest coverage for lexicon asset build functions.
- [x] Keep generated asset build repeatable via `npm run build:nlp-qa-lexicon`.
- [x] Keep lint passing.
- [ ] Add browser-level smoke tests for the static page.
- [ ] Add fixture ontology files for regression testing common false positives.

## Third-Party and Generated Assets

### Compromise

Asset:

```text
docs/app/shared/vendor/compromise_v14.15.1.js
```

Use:

- Loaded locally by `docs/nlp-quality-assurance.html`.
- Used as an optional local NLP runtime aid.
- The current offset-producing tokenizer remains deterministic and regex-based,
  so checker output does not depend on reading the DOM or on Compromise offset
  behavior.
- Future work may use Compromise more deeply for lemmatization, POS-informed
  grammar heuristics, and phrase-level analysis.

Notes:

- This asset should remain local for GitHub Pages deployment.
- Keep its upstream version and license/provenance documented when updating it.

### FinNLP English Lexicon

Upstream source location in this repo:

```text
src/lexicon-build/upstream/lexicon.ts
```
Current version used: 14.15.1

Generated browser asset:

```text
docs/app/data/nlp-qa-english-lexicon.js
```

Build command:

```powershell
npm run build:nlp-qa-lexicon -- src/lexicon-build/upstream/lexicon.ts
```

Use:

- Provides the base English spelling dictionary for NLP QA.
- The generated asset exports `NLP_QA_ENGLISH_LEXICON_WORDS`.
- `docs/app/nlp-qa-model.js` imports that word list and seeds the default
  spelling lexicon with it.

Processing:

- The build tooling lives under `src/lexicon-build/`.
- It filters entries that are poor spelling-check defaults for ontology QA,
  including punctuation-only forms, slash-heavy forms, and proper-noun-heavy
  entries by default.
- It emits a compact ES module for browser use.

Notes:

- FinNLP derives from Eric Brill's English lexicon and extends/corrects it.
- Preserve FinNLP license/provenance materials alongside the upstream source
  when committing or updating the source file.

### Eric Brill English Lexicon Family

Use:

- Treated as the historical/provenance family for the FinNLP lexicon source.
- The build tooling also supports Brill-style JavaScript sources shaped like:

```js
window.POSTAGGER_LEXICON = {
  "fawn": ["NN"]
};
```

Notes:

- If a direct Brill-derived JavaScript lexicon is used instead of FinNLP, place
  it under `src/lexicon-build/upstream/` and run the same build script with that
  file path.
- Keep provenance and license text with the upstream input.

### RDF Vendor Libraries

Assets:

```text
docs/app/shared/vendor/n3.min.js
docs/app/shared/vendor/jsonld.min.js
docs/app/shared/vendor/rdflib.min.js
```

Use:

- Loaded locally by static pages.
- Reused through `docs/app/engine.js`.
- NLP QA uses existing parsing and serialization helpers rather than creating a
  separate RDF IO stack.

### Generated NLP QA English Lexicon

Asset:

```text
docs/app/data/nlp-qa-english-lexicon.js
```

Use:

- Browser-runtime generated dictionary asset.
- Should not be manually edited.
- Regenerate from upstream source via the build script.

Update policy:

- Update upstream source first.
- Re-run the build command.
- Review word-count changes and representative false-positive/false-negative
  regression cases.
