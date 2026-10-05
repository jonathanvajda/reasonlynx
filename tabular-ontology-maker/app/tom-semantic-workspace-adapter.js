/** @file Browser adapter connecting shared semantic operations to TOM. */

import {
  createProjectPortfolioStores,
  openProjectPortfolioDatabase
} from '../../packages/indexeddb-data-management/src/index.js';
import {
  combineOntologyTableRows,
  createSequentialFileLoadModes,
  createOntologyTableRowsFromTermList,
  getSemanticOperation,
  resolveTableFileInterpretation
} from '../../packages/semantic-workspace/src/index.js';

/**
 * Executes a supported semantic workspace operation in TOM.
 *
 * @param {{operationId:string,projectId:string,artifactId:string}} request Operation request.
 * @returns {Promise<{rows:string[][],addedCount:number,updatedCount:number}>} Applied table result.
 */
export async function executeTomSemanticWorkspaceOperation(request) {
  const operation = getSemanticOperation(request?.operationId);
  if (!operation || operation.destinationViewId !== 'ontology-table-editor') {
    throw new Error(`TOM cannot execute semantic operation: ${request?.operationId || '(missing)'}`);
  }
  const database = await openProjectPortfolioDatabase();
  const stores = createProjectPortfolioStores(database, { projectId: request.projectId });
  const artifact = await stores.artifacts.getProjectArtifact(request.artifactId);
  if (!artifact) throw new Error('The selected workspace artifact no longer exists.');

  const incomingRows = createOntologyTableRowsFromTermList(artifact.payload);
  const result = combineOntologyTableRows(window.TOM.Core.readOntologyTableRows(), incomingRows, {
    mode: operation.mode
  });
  window.TOM.Core.selectProject(request.projectId);
  window.TOM.Core.replaceOntologyTableRows(result.rows);
  await window.TOM.Core.storeTomWorkspaceProjectState();
  window.TOM.Core.showToast(
    `${operation.mode === 'replace' ? 'Loaded' : 'Appended'} ${incomingRows.length} term${incomingRows.length === 1 ? '' : 's'} from ${artifact.label}.`,
    'success'
  );
  return result;
}

function readPendingSemanticWorkspaceOperation() {
  const parameters = new URLSearchParams(globalThis.location.search);
  const operationId = parameters.get('workspaceOperation');
  const projectId = parameters.get('projectId');
  const artifactId = parameters.get('artifactId');
  return operationId && projectId && artifactId ? { operationId, projectId, artifactId } : null;
}

/**
 * Registers TOM's operation listener and consumes a routed pending operation.
 *
 * @returns {Promise<void>}
 */
export async function initializeTomSemanticWorkspaceAdapter() {
  document.addEventListener('sitehdr:execute-semantic-operation', (event) => {
    executeTomSemanticWorkspaceOperation(event.detail).catch((error) => {
      window.TOM.Core.showToast(error.message, 'error');
    });
  });
  document.addEventListener('sitehdr:project-changed', async (event) => {
    window.TOM.Core.selectProject(event.detail?.projectId);
    await window.TOM.Core.reloadSavedSession();
  });
  document.addEventListener('sitehdr:load-workspace-files', async (event) => {
    const request = event.detail || {};
    try {
      const database = await openProjectPortfolioDatabase();
      const stores = createProjectPortfolioStores(database, { projectId: request.projectId });
      window.TOM.Core.selectProject(request.projectId);
      const fileLoadModes = createSequentialFileLoadModes((request.artifactIds || []).length, request.mode);
      for (const [index, artifactId] of (request.artifactIds || []).entries()) {
        const artifact = await stores.artifacts.getProjectArtifact(artifactId);
        if (!artifact) throw new Error(`Workspace artifact is unavailable: ${artifactId}`);
        const category = artifact.summary?.representationCategory || '';
        const interpretation = resolveTableFileInterpretation(request.interpretation, category);
        if (!interpretation) {
          throw new Error(`${artifact.label} is not a recognized spreadsheet or ontology representation.`);
        }
        const sourceFile = new File([artifact.payload], artifact.source?.fileName || artifact.label, {
          type: artifact.mediaType,
          lastModified: Number(artifact.summary?.fileLastModified || Date.now())
        });
        await window.TOM.Core.importFileIntoOntologyTable(sourceFile, {
          interpretation,
          mode: fileLoadModes[index],
          firstRowIsHeader: request.firstRowIsHeader
        });
      }
      await window.TOM.Core.storeTomWorkspaceProjectState();
    } catch (error) {
      window.TOM.Core.showToast(error.message, 'error');
    }
  });
  const request = readPendingSemanticWorkspaceOperation();
  if (!request) return;
  await executeTomSemanticWorkspaceOperation(request);
  const cleanUrl = `${globalThis.location.pathname}${globalThis.location.hash || ''}`;
  globalThis.history.replaceState({}, '', cleanUrl);
}
