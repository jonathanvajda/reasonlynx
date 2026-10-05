import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMON_NAMESPACE_IRIS } from '../../namespace-registry/src/index.js';
import {
  combineOntologyTableRows,
  createOntologyTableRowsFromTermList,
  createSourceArtifactMetadata,
  createSemanticOperationUrl,
  getSemanticOperation,
  getSemanticViewProvider,
  getSemanticViewProviderForPage,
  getSourceArtifactKindForMimeDescriptor,
  isBinaryMimeDescriptor,
  listSemanticOperationsForArtifact
} from '../src/index.js';

test('term-list operations expose explicit append and replace destinations', () => {
  assert.deepEqual(listSemanticOperationsForArtifact({ artifactKind: 'term-list' }).map(({ operationId }) => operationId), [
    'ontology-table.append-terms',
    'ontology-table.replace-with-terms'
  ]);
  assert.equal(getSemanticOperation('ontology-table.append-terms').destinationViewId, 'ontology-table-editor');
});

test('operation discovery can be scoped to the consuming view', () => {
  const termList = { artifactKind: 'term-list' };
  assert.deepEqual(
    listSemanticOperationsForArtifact(termList, { destinationViewId: 'ontology-table-editor' })
      .map(({ operationId }) => operationId),
    ['ontology-table.append-terms', 'ontology-table.replace-with-terms']
  );
  assert.deepEqual(
    listSemanticOperationsForArtifact(termList, { destinationViewId: 'competency-question-editor' }),
    []
  );
  assert.equal(getSemanticViewProviderForPage('tom')?.viewId, 'ontology-table-editor');
});

test('file representations become portable source artifacts without app ownership', () => {
  const descriptor = { id: 'csv', mimeType: 'text/csv', category: 'tabular' };
  assert.equal(getSourceArtifactKindForMimeDescriptor(descriptor), 'tabular-file');
  assert.equal(isBinaryMimeDescriptor(descriptor), false);
  assert.equal(isBinaryMimeDescriptor({ id: 'docx', category: 'document' }), true);
  assert.deepEqual(createSourceArtifactMetadata(
    { name: 'terms.csv', size: 42, lastModified: 100 },
    descriptor,
    { projectId: 'project:1', artifactId: 'artifact:1', extension: 'csv', now: '2026-10-05T00:00:00.000Z' }
  ), {
    artifactId: 'artifact:1', projectId: 'project:1', artifactKind: 'tabular-file', role: 'source',
    label: 'terms.csv', mediaType: 'text/csv', extension: 'csv',
    createdAt: '2026-10-05T00:00:00.000Z', updatedAt: '2026-10-05T00:00:00.000Z',
    source: { origin: 'file-upload', fileName: 'terms.csv' }, provenance: { derivedFrom: [] },
    summary: { representationId: 'csv', representationCategory: 'tabular', byteLength: 42, fileLastModified: 100 }
  });
});

test('term-list projection reuses registered OWL IRIs and TOM columns', () => {
  assert.deepEqual(createOntologyTableRowsFromTermList({ terms: [{
    iri: 'https://example.test/Person',
    label: 'Person',
    elementType: COMMON_NAMESPACE_IRIS.owl.Class,
    definition: 'A human being.',
    broaderLabel: 'Agent',
    definedBy: 'https://example.test/ontology'
  }] }), [[
    'https://example.test/Person', 'Person', 'Class', 'A human being.', 'Agent', 'https://example.test/ontology'
  ]]);
});

test('append merges duplicate terms without mutating inputs', () => {
  const existing = [['https://example.test/Person', 'Person', 'Class', '', '', '']];
  const incoming = [['https://example.test/Person', 'Person', 'Class', 'A human being.', '', '']];
  const result = combineOntologyTableRows(existing, incoming, { mode: 'append' });
  assert.deepEqual(result, {
    rows: [['https://example.test/Person', 'Person', 'Class', 'A human being.', '', '']],
    addedCount: 0,
    updatedCount: 1
  });
  assert.equal(existing[0][3], '');
});

test('replace returns only projected rows', () => {
  const result = combineOntologyTableRows([['old']], [['new']], { mode: 'replace' });
  assert.deepEqual(result, { rows: [['new']], addedCount: 1, updatedCount: 0 });
});

test('view route carries a complete pending operation request', () => {
  const provider = getSemanticViewProvider('ontology-table-editor');
  assert.equal(
    createSemanticOperationUrl(provider, { operationId: 'ontology-table.append-terms', projectId: 'project 1', artifactId: 'artifact:1' }),
    '../tabular-ontology-maker/?workspaceOperation=ontology-table.append-terms&projectId=project+1&artifactId=artifact%3A1'
  );
});
