import { DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID } from './project-portfolio-store.js';
import { StorageError } from './storage-error.js';

/**
 * Delete an artifact and its materialized graph, quad, and inclusion records.
 * Run records are retained as historical audit records.
 * @param {object} stores Project portfolio stores scoped to the artifact project.
 * @param {string} artifactId
 * @returns {Promise<object>}
 */
export async function deleteProjectArtifactCascade(stores, artifactId) {
  if (!artifactId) throw new StorageError('Artifact id is required.', { code: 'ARTIFACT_ID_REQUIRED' });
  const [graphs, inclusions, datasets] = await Promise.all([
    stores.graphs.listGraphRecords(stores.projectId, { artifactId }),
    stores.inclusions.listWorkspaceInclusions(stores.projectId),
    stores.datasets.listDatasetRecords(stores.projectId)
  ]);
  let deletedQuadRows = await stores.quadRows.clearQuadRows({ projectId: stores.projectId, artifactId });
  for (const graph of graphs) {
    deletedQuadRows += await stores.quadRows.clearQuadRows({ projectId: stores.projectId, graphId: graph.graphId });
    await stores.graphs.deleteGraphRecord(graph.graphId);
  }
  const artifactInclusions = inclusions.filter((item) => item.targetType === 'artifact' && item.targetId === artifactId);
  for (const inclusion of artifactInclusions) await stores.inclusions.deleteWorkspaceInclusion(inclusion.inclusionId);
  const artifactDatasets = datasets.filter((item) => item.metadata?.artifactId === artifactId);
  for (const dataset of artifactDatasets) await stores.datasets.deleteDataset(dataset.datasetId);
  const deletedArtifact = await stores.artifacts.deleteProjectArtifact(artifactId);
  return { deletedArtifact, deletedGraphs: graphs.length, deletedQuadRows, deletedInclusions: artifactInclusions.length, deletedDatasets: artifactDatasets.length };
}

/**
 * Delete a project and every project-scoped portfolio record.
 * The default workspace is protected so the portfolio always has a landing project.
 * @param {object} stores Project portfolio stores scoped to the target project.
 * @param {string} projectId
 * @returns {Promise<object>}
 */
export async function deleteProjectCascade(stores, projectId) {
  if (projectId === DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID) {
    throw new StorageError('The default workspace cannot be deleted.', { code: 'DEFAULT_PROJECT_PROTECTED' });
  }
  if (stores.projectId !== projectId) {
    throw new StorageError('Stores must be scoped to the project being deleted.', { code: 'PROJECT_SCOPE_MISMATCH' });
  }
  const [artifacts, datasets, runs, inclusions, graphs, settings] = await Promise.all([
    stores.artifacts.listProjectArtifacts(projectId, { includePayload: false }),
    stores.datasets.listDatasetRecords(projectId),
    stores.runs.listRunRecords({ projectId }),
    stores.inclusions.listWorkspaceInclusions(projectId),
    stores.graphs.listGraphRecords(projectId),
    stores.settings.listSettingRecords()
  ]);
  const deletedQuadRows = await stores.quadRows.clearQuadRows({ projectId });
  for (const graph of graphs) await stores.graphs.deleteGraphRecord(graph.graphId);
  for (const inclusion of inclusions) await stores.inclusions.deleteWorkspaceInclusion(inclusion.inclusionId);
  for (const run of runs) await stores.runs.deleteRunRecord(run.runId);
  for (const dataset of datasets) await stores.datasets.deleteDataset(dataset.datasetId);
  for (const artifact of artifacts) await stores.artifacts.deleteProjectArtifact(artifact.artifactId);
  for (const setting of settings) await stores.settings.deleteSettingRecord(setting.key);
  const deletedProject = await stores.projects.deleteProject(projectId);
  return {
    deletedProject,
    deletedArtifacts: artifacts.length,
    deletedDatasets: datasets.length,
    deletedRuns: runs.length,
    deletedInclusions: inclusions.length,
    deletedGraphs: graphs.length,
    deletedSettings: settings.length,
    deletedQuadRows
  };
}
