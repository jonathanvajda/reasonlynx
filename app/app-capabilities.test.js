import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverCompatibleArtifacts, getAppCapabilityManifest, getArtifactLoadActions, getWorkspaceAction, listWorkspaceActions } from './app-capabilities.js';

test('TOM discovers CQ Ferret term lists but not unrelated reports', () => {
  const artifacts = [
    { artifactId: 'terms', artifactKind: 'term-list' },
    { artifactId: 'report', artifactKind: 'diagnostic-report' }
  ];
  assert.deepEqual(discoverCompatibleArtifacts(artifacts, getAppCapabilityManifest('tom')).map((item) => item.artifactId), ['terms']);
});

test('Axiolotl and Visual Lynx discover shared RDF outputs', () => {
  const artifact = { artifactId: 'graph', artifactKind: 'rdf-dataset', mediaType: 'text/turtle' };
  assert.equal(discoverCompatibleArtifacts([artifact], getAppCapabilityManifest('axiolotl')).length, 1);
  assert.equal(discoverCompatibleArtifacts([artifact], getAppCapabilityManifest('visual-lynx')).length, 1);
});

test('CQ Ferret declares explicit workspace import and export destinations', () => {
  const manifest = getAppCapabilityManifest('cq-ferret');
  assert.deepEqual(listWorkspaceActions(manifest).map((action) => action.actionId), [
    'import-cq-csv',
    'export-cq-jsonld',
    'export-cq-csv'
  ]);
  assert.deepEqual(getWorkspaceAction(manifest, 'import-cq-csv'), {
    actionId: 'import-cq-csv',
    label: 'Import competency questions from CSV',
    direction: 'import',
    description: 'Append new competency questions and update rows whose CQ identifiers already exist.',
    accept: '.csv,text/csv',
    mode: 'merge',
    artifactKind: 'competency-question-set'
  });
});

test('artifact visibility and artifact load actions are distinct', () => {
  const cqManifest = getAppCapabilityManifest('cq-ferret');
  const query = { artifactId: 'query:1', artifactKind: 'sparql-query' };
  const ontology = { artifactId: 'ontology:1', artifactKind: 'ontology-rdf' };
  assert.equal(discoverCompatibleArtifacts([query, ontology], cqManifest).length, 2);
  assert.deepEqual(getArtifactLoadActions(query, cqManifest), [{
    actionId: 'append-sparql-query-to-cq',
    artifactKind: 'sparql-query',
    label: 'Append to associated queries',
    mode: 'append',
    destination: 'database-query-list'
  }]);
  assert.deepEqual(getArtifactLoadActions(ontology, cqManifest), []);
});
