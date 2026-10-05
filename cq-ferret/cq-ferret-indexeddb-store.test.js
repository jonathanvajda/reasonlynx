import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMON_NAMESPACE_IRIS } from '../packages/namespace-registry/src/index.js';
import {
  createTermListPayload,
  extractSparqlQueryText,
  findTypedEntities,
  hasLegacyCqStore
} from './cq-ferret-indexeddb-store.js';

test('creates a portable term-list payload for TOM', () => {
  assert.deepEqual(createTermListPayload([{
    iri: 'urn:term:one',
    label: 'Person record',
    elementType: COMMON_NAMESPACE_IRIS.owl.Class,
    definition: 'A record about a person.',
    isA: 'record',
    isDefinedBy: 'urn:ontology:test'
  }]), {
    schemaVersion: 1,
    terms: [{
      iri: 'urn:term:one',
      label: 'Person record',
      elementType: COMMON_NAMESPACE_IRIS.owl.Class,
      definition: 'A record about a person.',
      broaderLabel: 'record',
      definedBy: 'urn:ontology:test'
    }]
  });
});

test('reads Axiolotl SPARQL text from supported payload shapes', () => {
  assert.equal(extractSparqlQueryText('SELECT * WHERE { ?s ?p ?o }'), 'SELECT * WHERE { ?s ?p ?o }');
  assert.equal(extractSparqlQueryText({ query: 'ASK { ?s ?p ?o }' }), 'ASK { ?s ?p ?o }');
  assert.equal(extractSparqlQueryText({ value: 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }' }), 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }');
  assert.equal(extractSparqlQueryText({
    [COMMON_NAMESPACE_IRIS.rdf.value]: [{ '@value': 'DESCRIBE ?s WHERE { ?s ?p ?o }' }]
  }), 'DESCRIBE ?s WHERE { ?s ?p ?o }');
});

test('finds directly typed CCO persons and their labels in shared quad rows', () => {
  const rows = [
    { subject: 'urn:person:1', predicate: COMMON_NAMESPACE_IRIS.rdf.type, object: COMMON_NAMESPACE_IRIS.cco2.person },
    { subject: 'urn:person:1', predicate: COMMON_NAMESPACE_IRIS.rdfs.label, object: 'Ada Lovelace' },
    { subject: 'urn:other:1', predicate: COMMON_NAMESPACE_IRIS.rdf.type, object: COMMON_NAMESPACE_IRIS.cco2.database }
  ];
  assert.deepEqual(findTypedEntities(rows, [COMMON_NAMESPACE_IRIS.cco2.person]), [
    { iri: 'urn:person:1', label: 'Ada Lovelace' }
  ]);
});

test('recognizes the canonical legacy database inspection shape', () => {
  assert.equal(hasLegacyCqStore({ exists: true, stores: ['CQStore'] }), true);
  assert.equal(hasLegacyCqStore({ exists: true, stores: [] }), false);
  assert.equal(hasLegacyCqStore({ exists: false, stores: ['CQStore'] }), false);
  assert.equal(hasLegacyCqStore({ exists: true }), false);
});
