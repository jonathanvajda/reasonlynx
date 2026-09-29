import test from 'node:test';
import assert from 'node:assert/strict';
import { literal, namedNode, quad } from '../../packages/rdf-io/src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/namespace-registry.js';
import { buildKnowledgeLookupIndex, searchKnowledgeLookup } from '../scripts/knowledge-lookup.js';

const classIri = 'https://example.test/AuthorizedEmployee';
const personIri = 'https://example.test/person/alice';
const quads = [
  quad(namedNode(classIri), namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
  quad(namedNode(classIri), namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('Authorized Employee')),
  quad(namedNode(personIri), namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.NamedIndividual)),
  quad(namedNode(personIri), namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('Alice Example')),
  quad(namedNode(personIri), namedNode(COMMON_NAMESPACE_IRIS.skos.altLabel), literal('A. Example'))
];

test('knowledge lookup classifies labeled classes and individuals', () => {
  const entries = buildKnowledgeLookupIndex(quads);
  assert.equal(entries.find((entry) => entry.iri === classIri).kind, 'class');
  assert.equal(entries.find((entry) => entry.iri === personIri).kind, 'individual');
});

test('knowledge lookup searches alternate labels and respects kind', () => {
  const entries = buildKnowledgeLookupIndex(quads);
  assert.deepEqual(searchKnowledgeLookup(entries, 'A. Ex', 'individual').map((entry) => entry.iri), [personIri]);
  assert.deepEqual(searchKnowledgeLookup(entries, 'Authorized', 'class').map((entry) => entry.iri), [classIri]);
  assert.equal(searchKnowledgeLookup(entries, 'Alice', 'class').length, 0);
});
