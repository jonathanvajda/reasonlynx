import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/namespace-registry.js';
import { DOCXHUND_TERMS } from '../scripts/docxhund-vocabulary.js';
import { createDocumentParsingProvenance } from '../scripts/provenance-model.js';

function hasQuad(quads, subject, predicate, object) {
  return quads.some((item) => item.subject.value === subject &&
    item.predicate.value === predicate && item.object.value === object);
}

test('document parsing is a CCO-shaped input/output act', () => {
  const result = createDocumentParsingProvenance({
    documentIri: 'https://example.test/document/1',
    fileName: 'example.docx',
    actIri: 'urn:act:parse:1',
    sourceIri: 'urn:source:docx:1',
    occurredAt: '2026-09-29T12:00:00.000Z'
  });
  assert.ok(hasQuad(result.quads, result.actIri, COMMON_NAMESPACE_IRIS.rdf.type, DOCXHUND_TERMS.DocumentParsingAct));
  assert.ok(hasQuad(result.quads, result.actIri, COMMON_NAMESPACE_IRIS.cco2.hasInput, result.sourceIri));
  assert.ok(hasQuad(result.quads, result.actIri, COMMON_NAMESPACE_IRIS.cco2.hasOutput, 'https://example.test/document/1'));
  assert.equal(result.quads.some((item) => item.predicate.value.startsWith('http://www.w3.org/ns/prov#')), false);
});
