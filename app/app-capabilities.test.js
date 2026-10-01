import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverCompatibleArtifacts, getAppCapabilityManifest } from './app-capabilities.js';

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

