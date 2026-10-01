import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteProjectArtifactCascade, deleteProjectCascade } from '../src/portfolio-management.js';

const deletions = () => ({ artifacts: [], graphs: [], inclusions: [], rows: [], projects: [] });

function fakeStores(projectId = 'project:test') {
  const deleted = deletions();
  return { projectId, deleted,
    artifacts: { listProjectArtifacts: async () => [{ artifactId: 'a1' }], deleteProjectArtifact: async (id) => (deleted.artifacts.push(id), true) },
    datasets: { listDatasetRecords: async () => [{ datasetId: 'd1', metadata: { artifactId: 'a1' } }], deleteDataset: async () => true },
    runs: { listRunRecords: async () => [{ runId: 'r1' }], deleteRunRecord: async () => true },
    inclusions: { listWorkspaceInclusions: async () => [{ inclusionId: 'i1', targetType: 'artifact', targetId: 'a1' }], deleteWorkspaceInclusion: async (id) => (deleted.inclusions.push(id), true) },
    graphs: { listGraphRecords: async () => [{ graphId: 'g1' }], deleteGraphRecord: async (id) => (deleted.graphs.push(id), true) },
    quadRows: { clearQuadRows: async (filter) => (deleted.rows.push(filter), 2) },
    settings: { listSettingRecords: async () => [{ key: 'k1' }], deleteSettingRecord: async () => true },
    projects: { deleteProject: async (id) => (deleted.projects.push(id), true) }
  };
}

test('artifact cascade removes graph materialization and inclusion', async () => {
  const stores = fakeStores();
  const result = await deleteProjectArtifactCascade(stores, 'a1');
  assert.equal(result.deletedArtifact, true);
  assert.deepEqual(stores.deleted.artifacts, ['a1']);
  assert.deepEqual(stores.deleted.graphs, ['g1']);
  assert.deepEqual(stores.deleted.inclusions, ['i1']);
});

test('project cascade removes scoped records and protects default workspace', async () => {
  const stores = fakeStores();
  const result = await deleteProjectCascade(stores, 'project:test');
  assert.equal(result.deletedArtifacts, 1);
  assert.deepEqual(stores.deleted.projects, ['project:test']);
  await assert.rejects(() => deleteProjectCascade(fakeStores('project:default-workspace'), 'project:default-workspace'), /cannot be deleted/);
});
