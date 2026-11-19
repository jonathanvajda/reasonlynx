# Linguistic adapters

Headless ES modules for versioned text, supplied lexical annotations, token alignment,
and document selections. The package has no DOM, storage, network, RDF, or ontology
dependency. It can support discourse analysis and DocxHund without requiring either
application's UI or data model.

## Adapt supplied records

```js
import {
  createLinguisticSource, createSblgntTokenAdapter,
} from './src/index.js';

const source = createLinguisticSource({
  sourceId: 'my-sblgnt-dataset', version: 'release-1', language: 'grc',
  referenceScheme: 'my-versification',
  provenance: { providerId: 'my-provider', license: 'record actual dataset license' },
});
const adapter = createSblgntTokenAdapter({
  fields: { text: 'surface' }, morphologyScheme: 'my-provider-morphology',
});
const unit = adapter.adaptUnit({
  source, unitKey: 'John.1.1', reference: { book: 'John', chapter: 1, verse: 1 },
  text: 'Ἐν ἀρχῇ',
  records: [
    { id: 'w1', surface: 'Ἐν', start: 0, end: 2, lemma: 'ἐν', strongs: 'G1722' },
    { id: 'w2', surface: 'ἀρχῇ', start: 3, end: 7, gloss: 'beginning' },
  ],
});
```

These are **parsed-record contracts**, not file-format parsers. Map keys (or tuple
indices) explicitly; set a field to `null` to disable it. The Greek profile does
not imply that SBLGNT itself supplies glosses or morphology. The English profile
requires a declared namespace for bare numeric Strong's references.

`createOshbWordAdapter()` accepts parsed Hebrew/Aramaic word records with `text`,
`id`, `lemma`, and `morph` fields. It preserves OSHB lemma codes separately from
lemma spellings, retains raw morphology, and extracts numeric Hebrew Strong's
references from slash-separated codes. It does not infer morpheme boundaries or
decode a complete morphology grammar. Supply token `language` where it differs
from the source language.

## Align texts

`createLinguisticTokenSpan(unit, tokenIds)` describes ordered tokens, including
discontinuous spans. `createLinguisticAlignment({id, from, to, status, provenance})`
accepts endpoints shaped as `{unit, tokenIds}`. It supports many-to-many mappings,
proposals, accepted/rejected mappings, and explicitly unmapped spans (one null
endpoint). `selectAlignedTokenSpans()` returns intersecting accepted mappings in
either direction; proposals require explicit opt-in. It does not generate alignments.

## Reuse in DocxHund

```js
import {
  adaptDocumentPartText, segmentLinguisticWords,
  createDocumentSelectionsFromTokenSpan,
} from './src/index.js';

const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
const part = adaptDocumentPartText({
  source: { sourceId: 'document-1', version: 'revision-1', language: 'en' },
  partId: 'urn:document:1:paragraph:7', text: 'An exact document paragraph.',
  tokenize: text => segmentLinguisticWords(text, segmenter),
});
const selections = createDocumentSelectionsFromTokenSpan(part, [part.tokens[0].id]);
// Each selection has partIri, exact, start, end, prefix, suffix.
```

Use the **same canonical part text** as DocxHund's renderer. The selection shape
matches its existing annotation writer; a test calls that writer directly.
Discontinuous spans produce separate selections to avoid including omitted words.
The application still decides whether to create RDF assertions and how to persist
them. DocxHund's UI has not been rewired by this scaffold.

## Identity and validation

- Source ID, version, and unit key scope deterministic token identifiers. Provider
  token IDs are retained. Position-based fallback IDs require stable token ordering;
  change the version when source text or segmentation changes.
- Source spelling, whitespace, pointing, and raw provider codes are preserved.
  Missing source text remains `null`; token strings are never joined to invent it.
- Optional offsets are half-open UTF-16 indices, must match the exact source text,
  and cannot split grapheme clusters. Modern `Intl.Segmenter` support is required.
- Metadata must be JSON-compatible. Returned metadata is copied; records remain
  ordinary mutable objects. Annotation provenance identifies the provider, source
  version, and adapter. Record actual dataset licensing and attribution yourself.
- Bible references are source-specific metadata. Cross-edition versification and
  word correspondence require explicit mappings, not shared verse/token IDs.
- Annotation statuses distinguish supplied/proposed/accepted/rejected/unavailable
  information. Missing fields generate no annotation. Raw morphology and POS codes
  retain their provider scheme rather than claiming a universal interpretation.

## Scope and next steps

Implemented: generic and Greek/English/OSHB mapping profiles, lexical annotation
records, Strong's normalization, explicit token spans and alignments, exact document
offset selections, validation, and automated headless tests.

Still to build: actual corpus file/XML ingestion and release manifests; verification
against your real source files; complete morphology interpreters and morpheme
segmentation; lexicon/gloss services; versification converters; automatic alignment;
discourse algorithms; storage integration; and application-specific UI/RDF bridges.
This package does not bundle Bible datasets or establish their redistribution rights.

Run from the repository root: `npm run test:linguistic-adapters`.
