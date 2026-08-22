/**
 * @file Main UI wiring for Table Nova.
 */

import { TABLENOVA_DEFAULTS } from './state/defaults.js';
import {
  createLogger,
  createToastBus,
  safeAsync
} from './ui/telemetry.js';
import {
  readFileAsArrayBuffer,
  downloadTextFile,
  readFileAsText
} from '../../packages/browser-file-io/src/index.js';
import { getMimeTypeForFormatKey } from '../../packages/format-registry/src/index.js';
import {
  applyHeaderRowOptions,
  parseDelimitedTextAsHeaderRows,
} from '../../packages/tabular-io/src/index.js';
import {
  detectTabularType,
  parseXlsxArrayBuffer
} from './tabular/parseTabular.js';
import {
  buildColumnSchemas,
  buildRowInstanceIri,
  buildRunGraphIri,
  buildLiteralObject
} from './rdf/schema.js';
import {
  buildOntologyDataset,
  buildTableNovaOntologyMetadataRecord,
  ontologyRecordsFromDataset
} from './rdf/ontology.js';
import {
  rdfToJsonLd,
  serializeRdfDatasetText
} from './rdf/serialize.js';
import {
  buildDraftMetadataArtifacts,
  buildSampleValuesByPredicate
} from './metadataDrafts.js';
import { createUuid } from '../../packages/ontology-utils/src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/index.js';
import {
  createRunIdFromGraphIri,
  openTableNovaDb,
  putRun,
  listRuns,
  deleteRun,
  getRunDataset
} from './storage/indexedDb.js';
import {
  renderStagedFiles,
  renderFileOptionsPanel,
  renderOutputs,
  renderRunsList,
  setRunButtonEnabled,
  setDropzoneDragState,
  mountTabs,
  mountTableSortingAndFiltering
} from './ui/render.js';

/**
 * @typedef {import('./state/types.js').StagedFile} StagedFile
 */

const log = createLogger({ scope: 'main', enabled: true });
const toasts = createToastBus({ rootId: 'toast-container' });

const dom = {
  dropzone: /** @type {HTMLElement} */ (document.getElementById('TableNovaDropzone')),
  fileInput: /** @type {HTMLInputElement} */ (document.getElementById('TableNovaFileInput')),
  fileList: /** @type {HTMLElement} */ (document.getElementById('TableNovaFileList')),
  optionsPanel: /** @type {HTMLElement} */ (document.getElementById('TableNovaOptionsPanel')),
  runBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaRunBtn')),
  clearBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaClearBtn')),
  turtleText: /** @type {HTMLTextAreaElement} */ (document.getElementById('TableNovaTurtleText')),
  jsonldText: /** @type {HTMLTextAreaElement} */ (document.getElementById('TableNovaJsonLdText')),
  quadTable: /** @type {HTMLTableElement} */ (document.getElementById('TableNovaQuadTable')),
  quadFilter: /** @type {HTMLInputElement} */ (document.getElementById('TableNovaQuadFilter')),
  exportTurtleBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportTurtleBtn')),
  exportTrigBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportTrigBtn')),
  exportNTriplesBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportNTriplesBtn')),
  exportNQuadsBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportNQuadsBtn')),
  exportJsonLdTriplesBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportJsonLdTriplesBtn')),
  exportJsonLdGraphBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportJsonLdGraphBtn')),
  exportDataDictionaryBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportDataDictionaryBtn')),
  exportJsonSchemaBtn: /** @type {HTMLButtonElement} */ (document.getElementById('TableNovaExportJsonSchemaBtn')),
  outputScopeInputs: /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('input[name="TableNovaOutputScope"]')),
  runList: /** @type {HTMLElement} */ (document.getElementById('TableNovaRunList'))
};

let stagedFiles = /** @type {StagedFile[]} */ ([]);
let db = null;
let lastOutput = null; // { filename, graphIri, datasets, quadsByScope, views, columnSchemas, sampleValuesByPredicate }

/**
 * @param {FileList|File[]} files
 * @returns {StagedFile[]}
 */
function toStagedFiles(files) {
  return Array.from(files).map((f) => ({
    id: createUuid(),
    file: f,
    options: structuredClone(TABLENOVA_DEFAULTS.fileOptions)
  }));
}

/**
 * @param {StagedFile[]} next
 * @returns {void}
 */
function setStagedFiles(next) {
  const scrollState = captureOptionsScrollState();
  stagedFiles = next;
  renderStagedFiles(dom.fileList, stagedFiles, handleRemoveStagedFile);
  setRunButtonEnabled(dom.runBtn, stagedFiles.length > 0);
  renderFileOptionsPanel(dom.optionsPanel, stagedFiles, handleUpdateFileOptions, handlePreviewFile);
  restoreOptionsScrollState(scrollState);
}

/**
 * @param {string} stagedId
 * @returns {void}
 */
function handleRemoveStagedFile(stagedId) {
  log.info('remove_staged_file', { stagedId });
  setStagedFiles(stagedFiles.filter((s) => s.id !== stagedId));
  toasts.show({ title: 'Removed', body: 'File removed from staging.' });
}

/**
 * @returns {void}
 */
function handleClearStaged() {
  log.info('clear_staged');
  setStagedFiles([]);
  toasts.show({ title: 'Cleared', body: 'Staging area cleared.' });
}

/**
 * @param {string} stagedId
 * @param {import('./state/types.js').FileOptions} nextOptions
 * @returns {void}
 */
function handleUpdateFileOptions(stagedId, nextOptions) {
  log.info('update_file_options', { stagedId, nextOptions });
  setStagedFiles(stagedFiles.map((s) => (s.id === stagedId ? { ...s, options: nextOptions } : s)));
}

/**
 * @param {string} stagedId
 * @returns {Promise<void>}
 */
async function handlePreviewFile(stagedId) {
  const staged = stagedFiles.find((s) => s.id === stagedId);
  if (!staged) return;

  await safeAsync(log, async () => {
    const { file, options } = staged;
    const kind = detectTabularType(file.name);

    // Browser file I/O stops here; CSV/TSV/XLSX parser contracts are a separate capability.
    const tabular = await (kind === 'xlsx'
      ? parseXlsxArrayBuffer(await readFileAsArrayBuffer(file))
      : parseDelimitedTextAsHeaderRows(await readFileAsText(file), options.delimiterHint));

    const normalized = normalizeTabularForOptions(tabular, options);
    const preview = normalized.rows.slice(0, 5);
    const header = normalized.header;

    const nextOptions = {
      ...options,
      preview: {
        header,
        rows: preview
      },
      datatypesByColumnKey: options.datatypesByColumnKey ?? {},
      columnSchemaOverridesByKey: options.columnSchemaOverridesByKey ?? {}
    };

    handleUpdateFileOptions(stagedId, nextOptions);
    toasts.show({ title: 'Preview ready', body: `Showing first ${preview.length} rows.` });
  }, (err) => {
    toasts.show({ title: 'Preview failed', body: String(err?.message || err) });
  });
}

/**
 * @returns {Promise<void>}
 */
async function handleRun() {
  if (!db) return;

  if (stagedFiles.length === 0) {
    toasts.show({ title: 'Nothing to run', body: 'Add a file to the staging area first.' });
    return;
  }

  // MVP: run first staged file. (Easy to extend to multi-file runs later.)
  const staged = stagedFiles[0];

  await safeAsync(log, async () => {
    const { file, options } = staged;
    const kind = detectTabularType(file.name);
    const runCreatedAtIso = new Date().toISOString();
    const runDate = new Date(runCreatedAtIso);

    // Browser file I/O stops here; CSV/TSV/XLSX parser contracts are a separate capability.
    const tabular = await (kind === 'xlsx'
      ? parseXlsxArrayBuffer(await readFileAsArrayBuffer(file))
      : parseDelimitedTextAsHeaderRows(await readFileAsText(file), options.delimiterHint));

    const normalized = normalizeTabularForOptions(tabular, options);

    const columnSchemas = buildColumnSchemas({
      header: normalized.header,
      rows: normalized.rows,
      treatFirstRowAsHeader: options.treatFirstRowAsHeader,
      predicateOptions: options.predicate,
      basePredicateIri: TABLENOVA_DEFAULTS.basePredicateIri,
      datatypesByColumnKey: options.datatypesByColumnKey,
      columnSchemaOverridesByKey: options.columnSchemaOverridesByKey
    });
    const sampleValuesByPredicate = buildSampleValuesByPredicate({
      rows: getProcessedDataRows(normalized, options),
      columnSchemas
    });

    const graphIri = buildRunGraphIri({
      baseRunIri: TABLENOVA_DEFAULTS.baseRunIri,
      filename: file.name,
      now: runDate
    });
    const runId = createRunIdFromGraphIri(graphIri);

    const { dataset, quads } = await import('./rdf/buildDataset.js').then((m) =>
      m.buildDatasetFromTabular({
        tabular: normalized,
        options,
        baseInstanceIri: TABLENOVA_DEFAULTS.baseInstanceIri,
        columnSchemas,
        graphIri,
        buildRowInstanceIri,
        buildLiteralObject
      })
    );

    const outputPackage = await buildOutputPackage({
      dataset,
      graphIri,
      filename: file.name,
      createdAtIso: runCreatedAtIso,
      runId,
      quads,
      columnSchemas,
      sampleValuesByPredicate
    });

    await putRun(db, {
      graphIri,
      filename: file.name,
      createdAtIso: runCreatedAtIso,
      quads,
      columnSchemas,
      ontologyTurtle: outputPackage.views.tbox.turtle,
      sampleValuesByPredicate
    });

    lastOutput = outputPackage;

    renderCurrentOutputs();
    mountTableSortingAndFiltering(dom.quadTable, dom.quadFilter);
    await refreshRunsList();

    toasts.show({ title: 'Run complete', body: `Stored named graph in IndexedDB.` });
  }, (err) => {
    toasts.show({ title: 'Run failed', body: String(err?.message || err) });
  });
}

/**
 * @returns {Promise<void>}
 */
async function refreshRunsList() {
  if (!db) return;

  const runs = await listRuns(db);
  renderRunsList(dom.runList, runs, handleDeleteRun, handleLoadRunToOutput);
}

/**
 * @param {string} graphIri
 * @returns {Promise<void>}
 */
async function handleDeleteRun(graphIri) {
  if (!db) return;

  await safeAsync(log, async () => {
    await deleteRun(db, graphIri);
    await refreshRunsList();
    toasts.show({ title: 'Deleted', body: 'Named graph removed from IndexedDB.' });
  }, (err) => {
    toasts.show({ title: 'Delete failed', body: String(err?.message || err) });
  });
}

/**
 * @param {string} graphIri
 * @returns {Promise<void>}
 */
async function handleLoadRunToOutput(graphIri) {
  if (!db) return;

  await safeAsync(log, async () => {
    const run = await getRunDataset(db, graphIri);
    if (!run) throw new Error('Run not found.');

    // Re-serialize on demand so UI is consistent with current serializer.
    const { dataset } = await import('./rdf/buildDataset.js').then((m) =>
      m.datasetFromQuads(run.quads)
    );

    lastOutput = await buildOutputPackage({
      dataset,
      graphIri,
      filename: run.filename,
      createdAtIso: run.createdAtIso || new Date().toISOString(),
      runId: createRunIdFromGraphIri(graphIri),
      quads: run.quads || [],
      columnSchemas: run.columnSchemas || [],
      sampleValuesByPredicate: run.sampleValuesByPredicate || {}
    });

    renderCurrentOutputs();
    mountTableSortingAndFiltering(dom.quadTable, dom.quadFilter);
    toasts.show({ title: 'Loaded', body: 'Run loaded from IndexedDB.' });
  }, (err) => {
    toasts.show({ title: 'Load failed', body: String(err?.message || err) });
  });
}

/**
 * @param {DragEvent} e
 * @returns {void}
 */
function handleDrop(e) {
  e.preventDefault();
  setDropzoneDragState(dom.dropzone, false);

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const next = [...stagedFiles, ...toStagedFiles(files)];
  setStagedFiles(next);

  // Automatically select the latest file for configuration in options UI.
  renderFileOptionsPanel(dom.optionsPanel, stagedFiles, handleUpdateFileOptions, handlePreviewFile);

  toasts.show({ title: 'Added', body: `${files.length} file(s) added to staging.` });
}

/**
 * @param {DragEvent} e
 * @returns {void}
 */
function handleDragOver(e) {
  e.preventDefault();
  setDropzoneDragState(dom.dropzone, true);
}

/**
 * @param {DragEvent} e
 * @returns {void}
 */
function handleDragLeave(e) {
  e.preventDefault();
  setDropzoneDragState(dom.dropzone, false);
}

/**
 * @returns {void}
 */
function handleFileInputChange() {
  const files = dom.fileInput.files;
  if (!files || files.length === 0) return;
  setStagedFiles([...stagedFiles, ...toStagedFiles(files)]);
  dom.fileInput.value = '';
  toasts.show({ title: 'Added', body: `${files.length} file(s) added to staging.` });
}

/**
 * @param {string} kind
 * @returns {void}
 */
function handleExport(kind) {
  void safeAsync(log, async () => {
    if (!lastOutput) {
      toasts.show({ title: 'Nothing to export', body: 'Run a file or load a saved run first.' });
      return;
    }

    const scope = getOutputScope();
    await ensureViewReady(scope, kind);

    const view = lastOutput.views?.[scope];
    if (!view) return;

    const map = {
      turtle: { text: view.turtle, ext: `${scope}.ttl` },
      trig: { text: view.trig, ext: `${scope}.trig` },
      ntriples: { text: view.ntriples, ext: `${scope}.nt` },
      nquads: { text: view.nquads, ext: `${scope}.nq` },
      jsonldTriples: { text: view.jsonldTriples, ext: `${scope}.jsonld` },
      jsonldGraph: { text: view.jsonldGraph, ext: `${scope}.dataset.jsonld` }
    };

    const pick = map[kind];
    if (!pick?.text) return;

    downloadTextFile(`${buildExportBaseName(lastOutput)}.${pick.ext}`, pick.text);
    toasts.show({ title: 'Exported', body: `Downloaded ${pick.ext.toUpperCase()}.` });
  }, (err) => {
    toasts.show({ title: 'Export failed', body: String(err?.message || err) });
  });
}

/**
 * @returns {void}
 */
function handleExportTurtle() { handleExport('turtle'); }

/**
 * @returns {void}
 */
function handleExportTrig() { handleExport('trig'); }

/**
 * @returns {void}
 */
function handleExportNTriples() { handleExport('ntriples'); }

/**
 * @returns {void}
 */
function handleExportNQuads() { handleExport('nquads'); }

/**
 * @returns {void}
 */
function handleExportJsonLdTriples() { handleExport('jsonldTriples'); }

/**
 * @returns {void}
 */
function handleExportJsonLdGraph() { handleExport('jsonldGraph'); }

/**
 * @returns {{dataDictionaryCsv: string, jsonSchemaText: string}|null}
 */
function buildCurrentDraftMetadata() {
  if (!lastOutput) {
    toasts.show({ title: 'Nothing to export', body: 'Run a file or load a saved run first.' });
    return null;
  }

  return buildDraftMetadataArtifacts({
    filename: lastOutput.filename,
    columnSchemas: lastOutput.columnSchemas || [],
    quads: lastOutput.quadsByScope?.abox || [],
    sampleValuesByPredicate: lastOutput.sampleValuesByPredicate || {}
  });
}

/**
 * @returns {void}
 */
function handleExportDataDictionary() {
  const draftMetadata = buildCurrentDraftMetadata();
  if (!draftMetadata || !lastOutput) return;

  downloadTextFile(
    `${buildExportBaseName(lastOutput)}.draft-data-dictionary.csv`,
    draftMetadata.dataDictionaryCsv,
    { mimeType: 'text/csv;charset=utf-8' }
  );
  toasts.show({ title: 'Exported', body: 'Downloaded draft data dictionary.' });
}

/**
 * @returns {void}
 */
function handleExportJsonSchema() {
  const draftMetadata = buildCurrentDraftMetadata();
  if (!draftMetadata || !lastOutput) return;

  downloadTextFile(
    `${buildExportBaseName(lastOutput)}.draft-json-schema.json`,
    draftMetadata.jsonSchemaText,
    { mimeType: 'application/schema+json;charset=utf-8' }
  );
  toasts.show({ title: 'Exported', body: 'Downloaded draft JSON schema.' });
}

/**
 * @returns {'abox'|'tbox'|'both'}
 */
function getOutputScope() {
  const selected = Array.from(dom.outputScopeInputs || []).find((input) => input.checked)?.value;
  return selected === 'tbox' || selected === 'both' ? selected : 'abox';
}

/**
 * @returns {void}
 */
function renderCurrentOutputs() {
  void safeAsync(log, async () => {
    if (!lastOutput) {
      renderOutputs(dom, null, getOutputScope(), getActiveOutputTab());
      return;
    }

    const scope = getOutputScope();
    const tab = getActiveOutputTab();
    await ensureViewReady(scope, tab === 'ntriples' ? 'quadTable' : tab);
    renderOutputs(dom, lastOutput, scope, tab);
  }, (err) => {
    toasts.show({ title: 'Render failed', body: String(err?.message || err) });
  });
}

/**
 * @param {{dataset: any, graphIri: string, filename: string, createdAtIso: string, runId: string, quads: any[], columnSchemas: any[], sampleValuesByPredicate?: Record<string, string[]>}} params
 * @returns {Promise<any>}
 */
async function buildOutputPackage({ dataset, graphIri, filename, createdAtIso, runId, quads, columnSchemas, sampleValuesByPredicate = {} }) {
  const prefixes = TABLENOVA_DEFAULTS.prefixes;
  const aboxTurtle = await serializeScopeKind(dataset, graphIri, prefixes, 'turtle');
  const ontologyMetadataRecord = buildTableNovaOntologyMetadataRecord({
    filename,
    createdAtIso,
    runId,
    baseOntologyIri: TABLENOVA_DEFAULTS.basePredicateIri,
    localNameStyle: 'PascalCase',
    language: 'en'
  });
  const tboxDataset = buildOntologyDataset(columnSchemas || [], { metadataRecord: ontologyMetadataRecord });
  const tboxQuads = ontologyRecordsFromDataset(tboxDataset);
  const tboxTurtle = await serializeScopeKind(tboxDataset, graphIri, prefixes, 'turtle', {
    metadataRecord: ontologyMetadataRecord
  });

  return {
    filename,
    graphIri,
    createdAtIso,
    runId,
    columnSchemas,
    sampleValuesByPredicate,
    ontologyMetadataRecord,
    prefixes,
    datasets: {
      abox: dataset,
      tbox: tboxDataset,
      both: null
    },
    quadsByScope: {
      abox: quads || [],
      tbox: tboxQuads,
      both: null
    },
    views: {
      abox: createEmptyView({ turtle: aboxTurtle }),
      tbox: createEmptyView({ turtle: tboxTurtle }),
      both: createEmptyView()
    }
  };
}

/**
 * @param {{
 *   turtle?: string|null,
 *   trig?: string|null,
 *   ntriples?: string|null,
 *   nquads?: string|null,
 *   jsonldTriples?: string|null,
 *   jsonldGraph?: string|null
 * }} [seed]
 * @returns {{turtle: string|null, trig: string|null, ntriples: string|null, nquads: string|null, jsonldTriples: string|null, jsonldGraph: string|null}}
 */
function createEmptyView(seed = {}) {
  return {
    turtle: seed.turtle ?? null,
    trig: seed.trig ?? null,
    ntriples: seed.ntriples ?? null,
    nquads: seed.nquads ?? null,
    jsonldTriples: seed.jsonldTriples ?? null,
    jsonldGraph: seed.jsonldGraph ?? null
  };
}

/**
 * @returns {'turtle'|'ntriples'|'jsonld'|'session'}
 */
function getActiveOutputTab() {
  const active = /** @type {HTMLButtonElement|null} */ (document.querySelector('.table-nova-tabs .table-nova-tab--active'));
  const tab = active?.getAttribute('data-tab');
  return tab === 'ntriples' || tab === 'jsonld' || tab === 'session' ? tab : 'turtle';
}

/**
 * @param {'abox'|'tbox'|'both'} scope
 * @param {'turtle'|'ntriples'|'jsonld'|'session'|'trig'|'nquads'|'jsonldTriples'|'jsonldGraph'|'quadTable'} target
 * @returns {Promise<void>}
 */
async function ensureViewReady(scope, target) {
  if (!lastOutput) return;
  if (target === 'session') return;

  const { dataset } = await ensureScopeMaterials(scope);
  const view = lastOutput.views?.[scope];
  if (!view) return;

  if (target === 'quadTable') {
    return;
  }

  if (target === 'turtle') {
    if (view.turtle == null) {
      view.turtle = await serializeScopeKind(dataset, lastOutput.graphIri, lastOutput.prefixes, 'turtle', getMetadataSerializationOptions(scope));
    }
    return;
  }

  if (target === 'ntriples') {
    if (view.ntriples == null) {
      view.ntriples = await serializeScopeKind(dataset, lastOutput.graphIri, lastOutput.prefixes, 'ntriples', getMetadataSerializationOptions(scope));
    }
    return;
  }

  if (target === 'jsonld') {
    if (view.jsonldGraph == null) {
      view.jsonldGraph = await serializeScopeKind(dataset, lastOutput.graphIri, lastOutput.prefixes, 'jsonldGraph', getMetadataSerializationOptions(scope));
    }
    return;
  }

  if (target === 'trig' && view.trig == null) {
    view.trig = await serializeScopeKind(dataset, lastOutput.graphIri, lastOutput.prefixes, 'trig', getMetadataSerializationOptions(scope));
    return;
  }

  if (target === 'nquads' && view.nquads == null) {
    view.nquads = await serializeScopeKind(dataset, lastOutput.graphIri, lastOutput.prefixes, 'nquads', getMetadataSerializationOptions(scope));
    return;
  }

  if (target === 'jsonldGraph' && view.jsonldGraph == null) {
    view.jsonldGraph = await serializeScopeKind(dataset, lastOutput.graphIri, lastOutput.prefixes, 'jsonldGraph', getMetadataSerializationOptions(scope));
    return;
  }

  if (target === 'jsonldTriples' && view.jsonldTriples == null) {
    view.jsonldTriples = await serializeScopeKind(dataset, lastOutput.graphIri, lastOutput.prefixes, 'jsonldTriples', getMetadataSerializationOptions(scope));
    return;
  }

}

/**
 * @param {'abox'|'tbox'|'both'} scope
 * @returns {Promise<{dataset: any, quads: any[]}>}
 */
async function ensureScopeMaterials(scope) {
  if (!lastOutput) {
    return { dataset: null, quads: [] };
  }

  if (scope === 'abox') {
    return {
      dataset: lastOutput.datasets.abox,
      quads: lastOutput.quadsByScope.abox || []
    };
  }

  if (scope === 'tbox') {
    if (!lastOutput.datasets.tbox) {
      lastOutput.datasets.tbox = buildOntologyDataset(lastOutput.columnSchemas || [], {
        metadataRecord: lastOutput.ontologyMetadataRecord
      });
    }
    if (!lastOutput.quadsByScope.tbox) {
      lastOutput.quadsByScope.tbox = ontologyRecordsFromDataset(lastOutput.datasets.tbox);
    }
    return {
      dataset: lastOutput.datasets.tbox,
      quads: lastOutput.quadsByScope.tbox || []
    };
  }

  const abox = await ensureScopeMaterials('abox');
  const tbox = await ensureScopeMaterials('tbox');

  if (!lastOutput.datasets.both) {
    lastOutput.datasets.both = mergeDatasets(abox.dataset, tbox.dataset);
  }
  if (!lastOutput.quadsByScope.both) {
    lastOutput.quadsByScope.both = [...(abox.quads || []), ...(tbox.quads || [])];
  }

  return {
    dataset: lastOutput.datasets.both,
    quads: lastOutput.quadsByScope.both || []
  };
}

/**
 * @param {any} dataset
 * @param {string} graphIri
 * @param {Record<string, string>} prefixes
 * @param {'turtle'|'trig'|'ntriples'|'nquads'|'jsonldGraph'|'jsonldTriples'} kind
 * @param {{metadataRecord?: object|null}} [options]
 * @returns {Promise<string>}
 */
async function serializeScopeKind(dataset, graphIri, prefixes, kind, options = {}) {
  if (!dataset) return '';
  const exportDataset = options.metadataRecord
    ? cloneDatasetWithExportFormat(dataset, options.metadataRecord, getOutputMimeTypeForSerializationKind(kind))
    : dataset;

  if (kind === 'turtle') {
    return serializeRdfDatasetText(toTriplesStore(exportDataset), { format: 'Turtle', prefixes });
  }

  if (kind === 'trig') {
    return serializeRdfDatasetText(exportDataset, { format: 'application/trig', prefixes });
  }

  if (kind === 'ntriples') {
    return serializeRdfDatasetText(toTriplesStore(exportDataset), { format: 'N-Triples' });
  }

  if (kind === 'nquads') {
    return serializeRdfDatasetText(exportDataset, { format: 'N-Quads' });
  }

  if (kind === 'jsonldTriples') {
    const ntriples = await serializeRdfDatasetText(toTriplesStore(exportDataset), { format: 'N-Triples' });
    return rdfToJsonLd(ntriples, false);
  }

  const nquads = await serializeRdfDatasetText(exportDataset, { format: 'N-Quads' });
  return rdfToJsonLd(nquads, true, graphIri);
}

/**
 * @param {'turtle'|'trig'|'ntriples'|'nquads'|'jsonldGraph'|'jsonldTriples'} kind
 * @returns {string}
 */
function getOutputMimeTypeForSerializationKind(kind) {
  const formatKeys = {
    turtle: 'turtle',
    trig: 'trig',
    ntriples: 'n-triples',
    nquads: 'n-quads',
    jsonldGraph: 'jsonld',
    jsonldTriples: 'jsonld'
  };
  const result = getMimeTypeForFormatKey(formatKeys[kind]);
  if (result.ok) return result.value.mimeType;
  const binary = getMimeTypeForFormatKey('binary');
  return binary.ok ? binary.value.mimeType : '';
}

/**
 * @param {'abox'|'tbox'|'both'} scope
 * @returns {{metadataRecord?: object|null}}
 */
function getMetadataSerializationOptions(scope) {
  return scope === 'abox' ? {} : { metadataRecord: lastOutput?.ontologyMetadataRecord || null };
}

/**
 * @param {any} dataset
 * @param {object} metadataRecord
 * @param {string} outputMimeType
 * @returns {any}
 */
function cloneDatasetWithExportFormat(dataset, metadataRecord, outputMimeType) {
  const N3 = /** @type {any} */ (globalThis).N3;
  const { DataFactory, Store } = N3;
  const out = new Store(dataset?.getQuads?.(null, null, null, null) || []);
  const ontologyIri = String(metadataRecord?.['@id'] || '').trim();
  if (ontologyIri && outputMimeType) {
    out.addQuad(
      DataFactory.namedNode(ontologyIri),
      DataFactory.namedNode(COMMON_NAMESPACE_IRIS.dcterms.format),
      DataFactory.literal(outputMimeType, DataFactory.namedNode(COMMON_NAMESPACE_IRIS.xsd.string))
    );
  }
  return out;
}

/**
 * @param {any} dataset
 * @returns {any}
 */
function toTriplesStore(dataset) {
  const N3 = /** @type {any} */ (globalThis).N3;
  const { DataFactory, Store } = N3;
  const triplesStore = new Store();

  for (const q of dataset?.getQuads?.(null, null, null, null) || []) {
    triplesStore.addQuad(DataFactory.quad(q.subject, q.predicate, q.object));
  }

  return triplesStore;
}

/**
 * @param {{filename: string, graphIri: string}} output
 * @returns {string}
 */
function buildExportBaseName(output) {
  const base = String(output?.filename || 'table-nova-output').replace(/\.[^.]+$/, '');
  const graphSlug = String(output?.graphIri || '')
    .split('/')
    .slice(-2)
    .join('_')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${base}.${graphSlug || 'run'}`;
}

/**
 * @param  {...any} datasets
 * @returns {any}
 */
function mergeDatasets(...datasets) {
  const N3 = /** @type {any} */ (globalThis).N3;
  const { Store } = N3;
  const out = new Store();
  for (const ds of datasets) {
    for (const q of ds?.getQuads?.(null, null, null, null) || []) {
      out.addQuad(q);
    }
  }
  return out;
}

/**
 * Applies header row options to a parsed table.
 * @param {import('./tabular/parseTabular.js').TabularData} tabular
 * @param {import('./state/types.js').FileOptions} options
 * @returns {import('./tabular/parseTabular.js').TabularData}
 */
function normalizeTabularForOptions(tabular, options) {
  return applyHeaderRowOptions(tabular, Boolean(options?.treatFirstRowAsHeader ?? true), options?.headerRowNumber || 1);
}

/**
 * Builds the row slice used for draft metadata examples.
 * @param {import('./tabular/parseTabular.js').TabularData} tabular
 * @param {import('./state/types.js').FileOptions} options
 * @returns {string[][]}
 */
function getProcessedDataRows(tabular, options) {
  if (Boolean(options?.treatFirstRowAsHeader ?? true)) {
    return tabular.rows || [];
  }

  return [
    ...(Array.isArray(tabular.header) ? [tabular.header] : []),
    ...(tabular.rows || [])
  ];
}

/**
 * Captures page and options table scroll positions before an options re-render.
 * @returns {{windowX: number, windowY: number, scrollers: Array<{selector: string, index: number, left: number, top: number}>}}
 */
function captureOptionsScrollState() {
  const scrollers = Array.from(dom.optionsPanel.querySelectorAll('.table-nova-tablewrap')).map((el, index) => ({
    selector: '.table-nova-tablewrap',
    index,
    left: el.scrollLeft,
    top: el.scrollTop
  }));

  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    scrollers
  };
}

/**
 * Restores scroll positions after an options re-render.
 * @param {{windowX: number, windowY: number, scrollers: Array<{selector: string, index: number, left: number, top: number}>}} state
 * @returns {void}
 */
function restoreOptionsScrollState(state) {
  requestAnimationFrame(() => {
    for (const item of state.scrollers || []) {
      const el = dom.optionsPanel.querySelectorAll(item.selector)[item.index];
      if (el) {
        el.scrollLeft = item.left;
        el.scrollTop = item.top;
      }
    }
    window.scrollTo(state.windowX, state.windowY);
  });
}

/**
 * @returns {Promise<void>}
 */
async function init() {
  mountTabs(document.querySelector('.table-nova-tabs'), document.querySelectorAll('.table-nova-tabpanel'));

  renderStagedFiles(dom.fileList, stagedFiles, handleRemoveStagedFile);
  setRunButtonEnabled(dom.runBtn, false);

  // IndexedDB
  db = await openTableNovaDb();
  await refreshRunsList();

  // File selection in options panel
  document.addEventListener('tablenova:selected-file-changed', () => {
    renderFileOptionsPanel(dom.optionsPanel, stagedFiles, handleUpdateFileOptions, handlePreviewFile);
  });

  // Dropzone
  dom.dropzone.addEventListener('drop', handleDrop);
  dom.dropzone.addEventListener('dragover', handleDragOver);
  dom.dropzone.addEventListener('dragleave', handleDragLeave);
  dom.fileInput.addEventListener('change', handleFileInputChange);

  // Buttons
  dom.runBtn.addEventListener('click', handleRun);
  dom.clearBtn.addEventListener('click', handleClearStaged);

  // Exports
  dom.exportTurtleBtn.addEventListener('click', handleExportTurtle);
  dom.exportTrigBtn.addEventListener('click', handleExportTrig);
  dom.exportNTriplesBtn.addEventListener('click', handleExportNTriples);
  dom.exportNQuadsBtn.addEventListener('click', handleExportNQuads);
  dom.exportJsonLdTriplesBtn.addEventListener('click', handleExportJsonLdTriples);
  dom.exportJsonLdGraphBtn.addEventListener('click', handleExportJsonLdGraph);
  dom.exportDataDictionaryBtn.addEventListener('click', handleExportDataDictionary);
  dom.exportJsonSchemaBtn.addEventListener('click', handleExportJsonSchema);
  dom.outputScopeInputs.forEach((input) => input.addEventListener('change', renderCurrentOutputs));
  document.querySelector('.table-nova-tabs')?.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
    if (!target?.closest('button[data-tab]')) return;
    renderCurrentOutputs();
  });

  toasts.show({ title: 'Ready', body: 'Drop a file to begin.' });
}

init().catch((err) => {
  log.error('init_failed', { err });
  toasts.show({ title: 'Init failed', body: String(err?.message || err) });
});
