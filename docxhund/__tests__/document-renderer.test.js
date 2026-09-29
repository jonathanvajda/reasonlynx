import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blockTagForPart,
  normalizeDocumentText,
  projectRdfPartsOntoPreview,
  selectRenderableParts
} from '../scripts/document-renderer.js';

test('selectRenderableParts keeps only text-bearing paragraphs in source order', () => {
  const parts = [
    { partType: 'document' },
    { partType: 'paragraph', textValue: 'First' },
    { partType: 'sentence', textValue: 'First' },
    { partType: 'paragraph', textValue: '' },
    { partType: 'paragraph', textValue: 'Second' }
  ];
  assert.deepEqual(selectRenderableParts(parts).map((part) => part.textValue), ['First', 'Second']);
});

test('blockTagForPart maps valid heading levels and rejects unsafe tag names', () => {
  assert.equal(blockTagForPart({ headingLevel: 1 }), 'h1');
  assert.equal(blockTagForPart({ headingLevel: 6 }), 'h6');
  assert.equal(blockTagForPart({ headingLevel: 7 }), 'p');
  assert.equal(blockTagForPart({ headingLevel: 'script' }), 'p');
});

test('normalizeDocumentText makes OOXML and presentation whitespace comparable', () => {
  assert.equal(normalizeDocumentText('  Alpha\n\t beta  '), 'Alpha beta');
});

test('projectRdfPartsOntoPreview aligns repeated paragraphs in document order', () => {
  const elements = ['Repeated text', 'Middle', 'Repeated  text'].map((textContent) => ({
    textContent,
    dataset: {},
    id: '',
    classList: { add(value) { this.value = value; } }
  }));
  const container = { querySelectorAll() { return elements; } };
  const report = projectRdfPartsOntoPreview(container, [
    { iri: 'urn:p:1', partType: 'paragraph', textValue: 'Repeated text' },
    { iri: 'urn:p:2', partType: 'paragraph', textValue: 'Middle' },
    { iri: 'urn:p:3', partType: 'paragraph', textValue: 'Repeated text' }
  ]);
  assert.deepEqual(report, { matched: 3, total: 3, unmatchedIris: [] });
  assert.deepEqual(elements.map((element) => element.dataset.rdfResource), ['urn:p:1', 'urn:p:2', 'urn:p:3']);
});
