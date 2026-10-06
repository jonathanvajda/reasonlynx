import {
  buildMergedOntologyQuads,
  buildMergedPrefixMap,
  buildTurtleHeaderTemplate,
  composeMergedOntologyText,
  createMergedOntologyFilename
} from './merge-ontology.js';
import {
  createOntologyImportDecisionRows,
  createOntologyMergeSource
} from '../../packages/rdf-graph-operations/src/index.js';
import { readFileAsText, downloadTextFile } from '../../packages/browser-file-io/src/index.js';
import { detectRdfMimeTypeFromText, getPreferredExtensionForMimeType, getSupportedMimeTypeForFilename } from '../../packages/format-registry/src/index.js';
import { createRdfDataset, parseRdfTextWithAdapters, serializeRdfDatasetWithAdapters } from '../../packages/rdf-io/src/index.js';

const RDF_ACCEPT = '.ttl,.turtle,.n3,.nt,.ntriples,.nq,.nquads,.trig,.jsonld,.json-ld,.rdf,.owl,.xml';

const state = {
  sources: [],
  actionsByIri: {},
  latestText: '',
  latestFileName: 'merged-ontology.ttl'
};

const els = {};

document.addEventListener('DOMContentLoaded', () => {
  Object.assign(els, {
    fileInput: document.querySelector('#ontologyFiles'),
    loadButton: document.querySelector('#loadOntologies'),
    buildButton: document.querySelector('#buildMerge'),
    downloadButton: document.querySelector('#downloadMerge'),
    status: document.querySelector('#status'),
    sourceList: document.querySelector('#sourceList'),
    importList: document.querySelector('#importList'),
    headerTemplate: document.querySelector('#headerTemplate'),
    headerOntologyIri: document.querySelector('#headerOntologyIri'),
    headerText: document.querySelector('#headerText'),
    outputFormat: document.querySelector('#outputFormat'),
    outputText: document.querySelector('#outputText'),
    selectAllRoots: document.querySelector('#selectAllRoots')
  });

  els.fileInput.accept = RDF_ACCEPT;
  els.loadButton.addEventListener('click', loadSelectedOntologies);
  els.buildButton.addEventListener('click', buildMergedFile);
  els.downloadButton.addEventListener('click', () => downloadTextFile(state.latestFileName, state.latestText, { mimeType: getOutputMimeType() }));
  els.headerTemplate.addEventListener('change', refreshHeaderText);
  els.headerOntologyIri.addEventListener('input', refreshHeaderText);
  els.selectAllRoots.addEventListener('click', () => {
    document.querySelectorAll('[data-root-source]').forEach((input) => { input.checked = true; });
    refreshHeaderText();
  });
  setStatus('Add two or more ontology files to begin.');
});

async function loadSelectedOntologies() {
  const files = [...(els.fileInput.files || [])];
  if (!files.length) {
    setStatus('Choose ontology files first.', 'warning');
    return;
  }

  setStatus(`Loading ${files.length} file${files.length === 1 ? '' : 's'}...`);
  const sources = [];
  for (const [index, file] of files.entries()) {
    const text = await readFileAsText(file);
    const mimeType = detectInputMimeType(file.name, text);
    const parsed = await parseRdfTextWithAdapters(text, {
      mimeType,
      baseIri: `file:///${encodeURIComponent(file.name)}`,
      runtime: getRdfRuntime()
    });
    sources.push(createOntologyMergeSource({
      id: `source-${Date.now()}-${index}`,
      name: file.name,
      dataset: parsed.dataset,
      prefixes: parsed.prefixes,
      mimeType
    }));
  }

  state.sources = sources;
  state.actionsByIri = {};
  renderSources();
  renderImportDecisions();
  refreshHeaderText();
  setStatus(`Loaded ${sources.length} ontolog${sources.length === 1 ? 'y' : 'ies'}.`);
}

async function buildMergedFile() {
  if (!state.sources.length) {
    setStatus('Load ontology files before building a merge.', 'warning');
    return;
  }

  const ontologyIri = els.headerOntologyIri.value.trim() || 'https://example.org/merged-ontology';
  const selectedRootIds = [...document.querySelectorAll('[data-root-source]:checked')].map((input) => input.value);
  if (!selectedRootIds.length) {
    setStatus('Select at least one root ontology.', 'warning');
    return;
  }

  setStatus('Building merged ontology...');
  const prefixes = buildMergedPrefixMap(state.sources);
  const merged = buildMergedOntologyQuads(state.sources, {
    rootSourceIds: selectedRootIds,
    actionsByIri: state.actionsByIri,
    headerOntologyIri: ontologyIri
  });
  const headerParsed = await parseRdfTextWithAdapters(els.headerText.value, {
    format: 'turtle',
    baseIri: ontologyIri,
    runtime: getRdfRuntime()
  });
  const outputMimeType = getOutputMimeType();
  const outputExtension = getOutputExtension(outputMimeType);
  const outputDataset = outputMimeType === 'text/turtle'
    ? createRdfDataset(merged.quads)
    : createRdfDataset([...headerParsed.quads, ...merged.quads]);
  const serialized = await serializeRdfDatasetWithAdapters(outputDataset, {
    mimeType: outputMimeType,
    prefixes,
    runtime: getRdfRuntime()
  });

  state.latestText = outputMimeType === 'text/turtle'
    ? composeMergedOntologyText(els.headerText.value, serialized.text)
    : serialized.text;
  state.latestFileName = createMergedOntologyFilename(ontologyIri, outputExtension);
  els.outputText.value = state.latestText;
  els.downloadButton.disabled = false;
  setStatus(`Merge built from ${merged.includedSourceIds.length} source${merged.includedSourceIds.length === 1 ? '' : 's'} with ${merged.quads.length + headerParsed.quads.length} quads.`);
}

function renderSources() {
  els.sourceList.innerHTML = state.sources.map((source, index) => `
    <label class="om-source-row">
      <input type="checkbox" data-root-source value="${escapeHtml(source.id)}" ${index === 0 ? 'checked' : ''} />
      <span>
        <strong>${escapeHtml(source.name)}</strong>
        <small>${escapeHtml(source.ontologyIri || 'No owl:Ontology IRI found')} · ${source.quads.length} quads · ${source.imports.length} imports</small>
      </span>
    </label>
  `).join('');
  document.querySelectorAll('[data-root-source]').forEach((input) => {
    input.addEventListener('change', refreshHeaderText);
  });
}

function renderImportDecisions() {
  const rows = createOntologyImportDecisionRows(state.sources, state.actionsByIri);
  if (!rows.length) {
    els.importList.innerHTML = '<p class="om-empty">No owl:imports declarations were found in the loaded files.</p>';
    return;
  }

  els.importList.innerHTML = rows.map((row) => `
    <div class="om-import-row">
      <div>
        <strong>${escapeHtml(shortenIri(row.targetIri))}</strong>
        <small>Declared by ${escapeHtml(row.sourceName)}${row.availableSourceName ? ` · local file: ${escapeHtml(row.availableSourceName)}` : ' · no matching local file loaded'}</small>
      </div>
      <select data-import-action="${escapeHtml(row.targetIri)}" aria-label="Import handling for ${escapeHtml(row.targetIri)}">
        <option value="merge" ${row.action === 'merge' ? 'selected' : ''} ${row.availableSourceId ? '' : 'disabled'}>Merge loaded ontology</option>
        <option value="import" ${row.action === 'import' ? 'selected' : ''}>Keep import statement</option>
        <option value="ignore" ${row.action === 'ignore' ? 'selected' : ''}>Drop import statement</option>
      </select>
    </div>
  `).join('');

  document.querySelectorAll('[data-import-action]').forEach((select) => {
    select.addEventListener('change', () => {
      state.actionsByIri[select.dataset.importAction] = select.value;
      refreshHeaderText();
    });
  });
}

function refreshHeaderText() {
  const prefixes = buildMergedPrefixMap(state.sources);
  const ontologyIri = els.headerOntologyIri.value.trim() || state.sources.find((source) => source.ontologyIri)?.ontologyIri || 'https://example.org/merged-ontology';
  els.headerOntologyIri.value = ontologyIri;
  const selectedRootIds = [...document.querySelectorAll('[data-root-source]:checked')].map((input) => input.value);
  const merged = buildMergedOntologyQuads(state.sources, {
    rootSourceIds: selectedRootIds.length ? selectedRootIds : state.sources.map((source) => source.id),
    actionsByIri: state.actionsByIri,
    headerOntologyIri: ontologyIri
  });
  els.headerText.value = buildTurtleHeaderTemplate({
    templateId: els.headerTemplate.value,
    ontologyIri,
    prefixes,
    importedIris: merged.importedIris
  });
}

function detectInputMimeType(fileName, text) {
  const byName = getSupportedMimeTypeForFilename(fileName);
  if (byName.ok && byName.value.category === 'rdf') return byName.value.mimeType;
  const byText = detectRdfMimeTypeFromText(text);
  return byText.ok ? byText.value.mimeType : 'text/turtle';
}

function getOutputMimeType() {
  return els.outputFormat.value || 'text/turtle';
}

function getOutputExtension(mimeType) {
  const result = getPreferredExtensionForMimeType(mimeType);
  return result.ok ? result.value : 'ttl';
}

function getRdfRuntime() {
  return {
    N3: globalThis.N3,
    jsonld: globalThis.jsonld,
    $rdf: globalThis.$rdf
  };
}

function setStatus(message, kind = 'info') {
  els.status.textContent = message;
  els.status.dataset.kind = kind;
}

function shortenIri(iri) {
  const text = String(iri || '');
  return text.length > 84 ? `${text.slice(0, 42)}...${text.slice(-34)}` : text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
