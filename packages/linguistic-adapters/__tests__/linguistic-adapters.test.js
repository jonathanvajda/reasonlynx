import {
  createLinguisticSource, createLinguisticUnit, createLinguisticUnitId,
  createLinguisticAnnotation, parseStrongsReference, readOshbLemmaReferences,
  createTokenRecordAdapter, createSblgntTokenAdapter, createEnglishTokenAdapter, createOshbWordAdapter,
  createLinguisticTokenSpan, createLinguisticAlignment, selectAlignedTokenSpans,
  segmentLinguisticWords, adaptDocumentPartText, createDocumentSelectionsFromTokenSpan,
  validateLinguisticTextRange, LinguisticAdapterError
} from '../src/index.js';
import { createAnnotationQuads } from '../../../docxhund/scripts/annotation-model.js';
import { createContext, runInContext } from 'node:vm';

test('accepts plain metadata from another realm and structured cloning', () => {
  const provenance = runInContext('({providerId:"other-realm", nested:{value:3}})', createContext({}));
  const input = { sourceId: 'realm-test', version: '1', language: 'en', provenance };
  expect(createLinguisticSource(input).provenance).toEqual(provenance);
  expect(createLinguisticSource(structuredClone(input)).provenance).toEqual(provenance);
});

const source = overrides => createLinguisticSource({ sourceId: 'fixture:greek', version: 'v1', language: 'grc',
  provenance: { providerId: 'synthetic-fixtures', license: 'test data' }, ...overrides });
const simpleUnit = (overrides = {}) => createLinguisticUnit({ source: source(), unitKey: 'part-1',
  tokens: [{ text: 'λόγος' }, { text: 'καί' }, { text: 'λόγος' }], ...overrides });
const spanInput = (unit, indices) => ({ unit, tokenIds: indices.map(index => unit.tokens[index].id) });
const provenance = { providerId: 'manual-review', reviewerId: 'test-reviewer' };

describe('versioned, source-preserving text records', () => {
  test('identity is repeatable, version-scoped, and safe from delimiter collisions', () => {
    expect(createLinguisticUnitId(source(), 'a:b')).toBe(createLinguisticUnitId(source(), 'a:b'));
    expect(simpleUnit().id).not.toBe(simpleUnit({ source: source({ version: 'v2' }) }).id);
    expect(simpleUnit().id).not.toBe(simpleUnit({ source: source({ sourceId: 'different' }) }).id);
    expect(createLinguisticUnitId(source({ sourceId: 'a:b' }), 'c')).not.toBe(createLinguisticUnitId(source({ sourceId: 'a' }), 'b:c'));
  });

  test('repeated spellings receive distinct IDs and provider IDs are retained', () => {
    const unit = simpleUnit();
    expect(unit.tokens[0].text).toBe(unit.tokens[2].text);
    expect(new Set(unit.tokens.map(token => token.id)).size).toBe(3);
    const provided = simpleUnit({ tokens: [{ text: 'λόγος', sourceTokenId: 'provider-1' }] });
    expect(provided.tokens[0].sourceTokenId).toBe('provider-1');
    expect(provided.tokens[0].id).toContain('provider:provider-1');
  });

  test('rejects duplicate provider IDs and missing source identity/version/language', () => {
    expect(() => simpleUnit({ tokens: [{ text: 'a', sourceTokenId: 'same' }, { text: 'b', sourceTokenId: 'same' }] })).toThrow(LinguisticAdapterError);
    for (const field of ['sourceId', 'version', 'language']) expect(() => source({ [field]: '' })).toThrow();
    expect(() => source({ language: 'not a language tag' })).toThrow();
  });

  test('preserves exact pointed text, combining characters, whitespace, and provider metadata', () => {
    const text = '  בְּרֵאשִׁית  ';
    const unit = simpleUnit({ source: source({ language: 'hbo' }), text,
      tokens: [{ text: text.slice(2, -2), start: 2, end: text.length - 2 }] });
    expect(unit.text).toBe(text);
    expect(unit.tokens[0].text).toBe(text.slice(2, -2));
    expect(unit.tokens[0].range).toEqual({ start: 2, end: text.length - 2, unit: 'utf16' });
    const input = { providerId: 'fixture', nested: { license: 'original' } };
    const descriptor = source({ provenance: input }); input.nested.license = 'mutated';
    expect(descriptor.provenance.nested.license).toBe('original');
  });

  test('does not fabricate text or offsets from pretokenized records', () => {
    expect(simpleUnit().text).toBeNull();
    expect(simpleUnit().tokens.every(token => token.range === null)).toBe(true);
  });

  test.each([
    ['a\u0301', 0, 1], ['😀', 0, 1], ['👩‍👩‍👧‍👦', 0, 2]
  ])('rejects offsets splitting graphemes in %s', (text, start, end) => {
    expect(() => validateLinguisticTextRange(text, start, end)).toThrow('grapheme');
  });

  test('rejects mismatched, overlapping, reversed, partial, and out-of-bounds token ranges', () => {
    expect(() => simpleUnit({ text: 'abc', tokens: [{ text: 'b', start: 0, end: 1 }] })).toThrow('exact source');
    expect(() => simpleUnit({ text: 'aaa', tokens: [{ text: 'aa', start: 0, end: 2 }, { text: 'aa', start: 1, end: 3 }] })).toThrow('overlap');
    for (const [start, end] of [[2, 1], [0, 4], [-1, 2], [0, undefined]]) {
      expect(() => simpleUnit({ text: 'abc', tokens: [{ text: 'abc', start, end }] })).toThrow();
    }
  });

  test('rejects metadata that would silently change in JSON serialization', () => {
    for (const value of [undefined, Infinity, new Date(), () => {}]) expect(() => source({ provenance: { value } })).toThrow();
    const cycle = {}; cycle.self = cycle;
    expect(() => source({ provenance: cycle })).toThrow('cycles');
  });
});

describe('explicit token-schema and lexical annotation adapters', () => {
  test('adapts supplied SBLGNT-associated records with configured keys and raw morphology', () => {
    const adapter = createSblgntTokenAdapter({ fields: { text: 'surface', id: 'key' }, morphologyScheme: 'fixture-morph' });
    const records = [{ key: 'w1', surface: 'λόγος', lemma: 'λόγος', morph: 'N-NSM', pos: 'noun', strongs: 'G3056', gloss: 'word' }];
    const snapshot = JSON.stringify(records);
    const unit = adapter.adaptUnit({ source: source(), unitKey: 'John.1.1', records });
    expect(unit.annotations.map(item => item.kind)).toEqual(['lemma', 'morphology', 'partOfSpeech', 'gloss', 'lexicalReference']);
    expect(unit.annotations.find(item => item.kind === 'morphology')).toMatchObject({ scheme: 'fixture-morph', value: 'N-NSM' });
    expect(unit.annotations.find(item => item.kind === 'lexicalReference').value.id).toBe('G3056');
    expect(unit.annotations.every(item => item.provenance.providerId === 'synthetic-fixtures')).toBe(true);
    expect(JSON.stringify(records)).toBe(snapshot);
    expect(JSON.parse(JSON.stringify(unit))).toEqual(unit);
  });

  test('supports mapped tuple records without guessing a source file schema', () => {
    const adapter = createTokenRecordAdapter({ adapterId: 'tuple-fixture', fields: { text: 0, id: null, lemma: 1, morphology: 2 } });
    const unit = adapter.adaptUnit({ source: source(), unitKey: 'verse', records: [['λέγει', 'λέγω', 'V-PAI-3S']] });
    expect(unit.tokens[0].text).toBe('λέγει');
    expect(unit.annotations).toHaveLength(2);
    expect(() => createTokenRecordAdapter({ adapterId: 'bad', fields: { text: {} } })).toThrow('Field mappings');
    expect(() => adapter.adaptUnit({ source: source(), unitKey: 'verse', records: [null] })).toThrow('Token records');
  });

  test('keeps OSHB prefix/lemma and morphology strings without inventing morphemes or syntax', () => {
    const unit = createOshbWordAdapter().adaptUnit({ source: source({ sourceId: 'fixture:oshb', language: 'hbo' }),
      unitKey: 'Gen.1.1', records: [{ id: '01001', text: 'בְּרֵאשִׁית', lemma: 'b/7225', morph: 'HR/Ncfsa' },
        { id: '01002', text: 'מֶלֶךְ', language: 'arc', lemma: 'c/m/4430 a', morph: 'ANcmsa' }] });
    expect(unit.tokens[1].language).toBe('arc');
    expect(unit.annotations.filter(item => item.kind === 'lemma')).toHaveLength(0);
    const lexical = unit.annotations.find(item => item.scheme === 'oshb-lemma');
    expect(lexical.value).toEqual({ raw: 'b/7225', references: [{ system: 'strongs', id: 'H7225', raw: '7225', extension: null }] });
    expect(unit.annotations.find(item => item.value === 'HR/Ncfsa').scheme).toBe('oshb-morphology');
    expect(readOshbLemmaReferences('c/m/4430 a').references[0]).toMatchObject({ id: 'H4430', extension: 'a' });
    expect(readOshbLemmaReferences('c/m').references).toEqual([]);
  });

  test('OSHB lemma field remapping remains distinct from a lemma spelling', () => {
    const unit = createOshbWordAdapter({ fields: { lemma: 'lex', text: 'word' } }).adaptUnit({ source: source({ language: 'hbo' }),
      unitKey: 'verse', records: [{ word: 'מֶלֶךְ', lex: '4428' }] });
    expect(unit.annotations).toHaveLength(1);
    expect(unit.annotations[0]).toMatchObject({ kind: 'lexicalReference', scheme: 'oshb-lemma' });
  });

  test('missing metadata stays missing and English Strong’s references require an explicit namespace', () => {
    const adapter = createEnglishTokenAdapter();
    const input = { source: source({ language: 'en' }), unitKey: 'part', records: [{ text: 'word' }] };
    expect(adapter.adaptUnit(input).annotations).toEqual([]);
    expect(() => adapter.adaptUnit({ ...input, records: [{ text: 'word', strongs: '3056' }] })).toThrow('namespace');
    expect(adapter.adaptUnit({ ...input, records: [{ text: 'word', strongs: 'G3056' }] }).annotations[0].value.id).toBe('G3056');
  });

  test('Strong’s references retain provider spelling and never become token identities', () => {
    expect(parseStrongsReference('H00430')).toMatchObject({ id: 'H430', raw: 'H00430' });
    expect(parseStrongsReference('3056', { namespace: 'G' }).id).toBe('G3056');
    for (const raw of ['G0', 'word', 'G3056/H430']) expect(() => parseStrongsReference(raw)).toThrow();
    expect(() => parseStrongsReference('H430', { namespace: 'G' })).toThrow('conflicts');
    const unit = createSblgntTokenAdapter().adaptUnit({ source: source(), unitKey: 'verse', records: [
      { text: 'λόγος', strongs: 'G3056' }, { text: 'λόγος', strongs: 'G3056' }] });
    expect(unit.tokens[0].id).not.toBe(unit.tokens[1].id);
  });

  test('annotations distinguish unavailable values and retain competing interpretations', () => {
    const base = { id: 'note-1', targetTokenId: 'token-1', kind: 'morphology', provenance };
    expect(createLinguisticAnnotation({ ...base, status: 'unavailable' }).value).toBeNull();
    expect(() => createLinguisticAnnotation(base)).toThrow('null');
    expect(() => createLinguisticAnnotation({ ...base, value: 'N', provenance: {} })).toThrow();
    expect(() => createLinguisticAnnotation({ ...base, kind: 'gloss', value: 'word' })).toThrow();
    expect(createLinguisticAnnotation({ ...base, value: 'N', status: 'proposed' }).status).toBe('proposed');
    const unit = createSblgntTokenAdapter().adaptUnit({ source: source(), unitKey: 'verse', records: [{ text: 'λόγος', morph: ['N-NSM', 'N-VSM'] }] });
    expect(unit.annotations.map(item => item.value)).toEqual(['N-NSM', 'N-VSM']);
  });
});

describe('source/version-scoped spans and supplied alignment', () => {
  test('supports discontinuous spans while rejecting unknown, duplicate, or reversed IDs', () => {
    const unit = simpleUnit();
    expect(createLinguisticTokenSpan(unit, spanInput(unit, [0, 2]).tokenIds).discontinuous).toBe(true);
    for (const indices of [[0, 0], [2, 0]]) expect(() => createLinguisticTokenSpan(unit, spanInput(unit, indices).tokenIds)).toThrow();
    expect(() => createLinguisticTokenSpan(unit, [])).toThrow();
    expect(() => createLinguisticTokenSpan(unit, ['unknown'])).toThrow();
    const otherVersion = simpleUnit({ source: source({ version: 'v2' }) });
    expect(() => createLinguisticTokenSpan(otherVersion, [unit.tokens[0].id])).toThrow();
  });

  test('many-to-many alignment highlights whole mapped spans in either direction', () => {
    const greek = simpleUnit();
    const english = simpleUnit({ source: source({ sourceId: 'fixture:english', language: 'en' }), tokens: [{ text: 'the' }, { text: 'word' }] });
    const alignment = createLinguisticAlignment({ id: 'align-1', from: spanInput(greek, [0, 2]), to: spanInput(english, [0, 1]), status: 'accepted', provenance });
    const result = selectAlignedTokenSpans([alignment], createLinguisticTokenSpan(greek, [greek.tokens[0].id]));
    expect(result[0].oppositeSpan.tokenIds).toEqual(english.tokens.map(token => token.id));
    expect(selectAlignedTokenSpans([alignment], alignment.to)[0].oppositeSpan.discontinuous).toBe(true);
    result[0].oppositeSpan.tokenIds.pop();
    expect(alignment.to.tokenIds).toHaveLength(2);
  });

  test('proposed and rejected alignments are not silently accepted; unmapped has no invented target', () => {
    const unit = simpleUnit(); const from = spanInput(unit, [0]); const to = spanInput(unit, [1]);
    const proposed = createLinguisticAlignment({ id: 'p', from, to, provenance });
    const rejected = createLinguisticAlignment({ id: 'r', from, to, provenance, status: 'rejected' });
    const unmapped = createLinguisticAlignment({ id: 'u', from, to: null, provenance, status: 'unmapped' });
    const selection = createLinguisticTokenSpan(unit, from.tokenIds);
    expect(selectAlignedTokenSpans([proposed, rejected], selection)).toEqual([]);
    expect(selectAlignedTokenSpans([proposed, rejected], selection, { includeProposals: true })).toHaveLength(1);
    expect(selectAlignedTokenSpans([unmapped], selection)[0].oppositeSpan).toBeNull();
    expect(() => createLinguisticAlignment({ id: 'bad', from, to: null, provenance, status: 'accepted' })).toThrow();
    expect(() => createLinguisticAlignment({ id: 'bad', from, to, provenance, status: 'unmapped' })).toThrow();
  });
});

describe('DocxHund-compatible selection boundary without DOM or RDF coupling', () => {
  function documentUnit() {
    const text = '  λόγος καὶ λόγος. ';
    return adaptDocumentPartText({ source: source({ sourceId: 'document:1' }), partId: 'urn:document:1:paragraph:3', text,
      tokenize: value => segmentLinguisticWords(value, new Intl.Segmenter('el', { granularity: 'word' })) });
  }

  test('generic document adaptation preserves source offsets and inter-word punctuation', () => {
    const unit = documentUnit();
    const selections = createDocumentSelectionsFromTokenSpan(unit, spanInput(unit, [0, 1]).tokenIds);
    expect(selections).toHaveLength(1);
    expect(selections[0]).toMatchObject({ partIri: unit.unitKey, exact: 'λόγος καὶ', start: 2, end: 11, prefix: '  ', suffix: ' λόγος. ' });
    expect(unit.source.referenceScheme).toBeNull();
  });

  test('discontinuous selections do not silently include omitted words', () => {
    const unit = documentUnit();
    const selections = createDocumentSelectionsFromTokenSpan(unit, spanInput(unit, [0, 2]).tokenIds);
    expect(selections.map(item => item.exact)).toEqual(['λόγος', 'λόγος']);
    expect(selections.map(item => item.start)).toEqual([2, 12]);
  });

  test('actual DocxHund annotation writer accepts the detached selection shape', () => {
    const unit = documentUnit();
    const selection = createDocumentSelectionsFromTokenSpan(unit, [unit.tokens[0].id])[0];
    const result = createAnnotationQuads({ annotationType: 'about', selection, resourceIri: 'urn:lexical:word',
      annotationIri: 'urn:test:annotation', actIri: 'urn:test:act', occurredAt: '2026-11-18T00:00:00Z' });
    expect(result.quads.some(item => item.object.value === selection.exact)).toBe(true);
    expect(result.quads.some(item => item.object.value === selection.partIri)).toBe(true);
  });

  test('selection and tokenizer errors are explicit rather than fabricating ranges', () => {
    const unit = documentUnit();
    expect(() => createDocumentSelectionsFromTokenSpan(unit, [unit.tokens[0].id], { partIri: 'not-an-iri' })).toThrow();
    expect(() => createDocumentSelectionsFromTokenSpan(unit, [unit.tokens[0].id], { contextLength: -1 })).toThrow();
    expect(() => createDocumentSelectionsFromTokenSpan(simpleUnit(), [simpleUnit().tokens[0].id], { partIri: 'urn:part' })).toThrow('exact canonical');
    expect(() => segmentLinguisticWords('text', new Intl.Segmenter('en', { granularity: 'grapheme' }))).toThrow('word granularity');
    expect(() => adaptDocumentPartText({ source: source(), partId: 'urn:part', text: 'word' })).toThrow('tokenizer');
  });
});
