import test from 'node:test';
import assert from 'node:assert/strict';
import { datasetToQuads } from '../../packages/rdf-io/src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/namespace-registry.js';
import { createPartsDataset } from '../scripts/rdf-writer.js';

test('createPartsDataset emits document structure through RDF/JS quads', () => {
  const parent = 'https://example.test/document/1';
  const child = 'https://example.test/paragraph/1';
  const quads = datasetToQuads(createPartsDataset([
    { iri: parent, partType: 'document', label: 'document 1', siblingIndex: 1 },
    { iri: child, partType: 'paragraph', label: 'paragraph 1', textValue: 'Hello', parentIri: parent, siblingIndex: 1 }
  ]));
  assert.ok(quads.some((item) =>
    item.subject.value === child &&
    item.predicate.value === COMMON_NAMESPACE_IRIS.cco2.hasTextValue &&
    item.object.value === 'Hello'
  ));
  assert.ok(quads.some((item) =>
    item.subject.value === parent &&
    item.predicate.value === COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart &&
    item.object.value === child
  ));
});

test('createPartsDataset does not emit text values for structural-only parts', () => {
  const quads = datasetToQuads(createPartsDataset([
    { iri: 'https://example.test/section/1', partType: 'section', textValue: 'Not a section literal' }
  ]));
  assert.equal(quads.filter((item) => item.predicate.value === COMMON_NAMESPACE_IRIS.cco2.hasTextValue).length, 0);
});
