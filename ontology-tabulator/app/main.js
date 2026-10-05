// app/main.js
import {
  detectRdfFormatFromFilename,
  parseRdfTextToStore,
  extractOntologyMetadata,
  buildElementTableModel,
  logEvent,
  logError
} from './core.js';

import {
  showLoadingOverlay,
  hideLoadingOverlay,
  renderFileList,
  renderOntologyCard,
  renderOntologyTable
} from './ui-helpers.js';

/**
 * Switches between the centered empty state and the processed-results layout.
 *
 * @param {boolean} hasResults Whether at least one ontology was processed.
 * @returns {void}
 */
function setProcessedState(hasResults) {
  document.body?.classList.toggle('ontology-tabulator-has-results', hasResults);
}

function handleFilesSelected(files) {
  const fnName = 'handleFilesSelected';
  logEvent(fnName, 'start', { fileCount: files.length });

  if (!files.length) return;

  const cardsContainer = document.getElementById('ontologyCardsContainer');
  const tablesContainer = document.getElementById('ontologyTablesContainer');
  if (!cardsContainer || !tablesContainer) return;

  showLoadingOverlay();

  const fileInfos = [];

  (async () => {
    try {
      cardsContainer.innerHTML = '';
      tablesContainer.innerHTML = '';

      for (const file of files) {
        const text = await file.text();
        const format = detectRdfFormatFromFilename(file.name);
        const store = await parseRdfTextToStore(text, format);

        const meta = extractOntologyMetadata(store);
        const tableModel = buildElementTableModel(store);

        // record file info for file list
        fileInfos.push({
          displayName: meta.ontologyName || file.name,
          quadCount: store.size
        });

        renderOntologyCard(cardsContainer, meta);
        renderOntologyTable(tablesContainer, meta, tableModel);
      }

      renderFileList(fileInfos);
      setProcessedState(fileInfos.length > 0);
    } catch (err) {
      logError(fnName, err);
      alert('Error processing ontology files. See console for details.');
    } finally {
      hideLoadingOverlay();
    }
  })();
}

function setupFileInput() {
  const input = document.getElementById('ontologyFileInput');
  if (!input) return;

  input.addEventListener('change', ev => {
    const files = Array.from(ev.target.files || []);
    handleFilesSelected(files);
  });

  // Optional: allow drag & drop onto the whole body
  document.addEventListener('dragover', ev => {
    ev.preventDefault();
  });
  document.addEventListener('drop', ev => {
    ev.preventDefault();
    const files = Array.from(ev.dataTransfer?.files || []);
    if (files.length) {
      handleFilesSelected(files);
    }
  });
}

function initApp() {
  logEvent('initApp', 'start');
  setProcessedState(false);
  setupFileInput();
}

document.addEventListener('DOMContentLoaded', initApp);
