import { getSupportedMimeTypeForFilename, listSupportedMimeDescriptors } from '../../packages/format-registry/src/mime-registry.js';
import { getRdfAdapterDescriptorForMimeType } from '../../packages/format-registry/src/rdf-parser-formats.js';
import { parseRdfTextWithAdapters } from '../../packages/rdf-io/src/serialize-rdf.js';
import { createAcceptAttribute } from '../../packages/browser-file-io/src/create-accept-attribute.js';
import { downloadTextFile } from '../../packages/browser-file-io/src/download-text-file.js';
import { serializeReportValueToYaml } from '../../packages/report-export/src/yaml-document.js';
import { serializeReportDocumentToHtml } from '../../packages/report-export/src/html-document.js';
import { compareTriples, createCombinedRows, createSideRows, createSparqlUpdate } from './diff-engine.js';

const allowedIds = new Set(['turtle', 'nTriples', 'jsonLd', 'rdfXml']);
const descriptors = listSupportedMimeDescriptors({ category: 'rdf' }).filter((item) => allowedIds.has(item.id));
const accept = createAcceptAttribute(descriptors, { includeMimeTypes: true });
const state = { left: null, right: null, diff: null, view: 'combined', table: null };
const message = document.querySelector('#message');
const report = document.querySelector('#report');

for (const side of ['left', 'right']) setupDropZone(side);
document.querySelector('#swap-files').addEventListener('click', swapFiles);
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
document.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => exportReport(button.dataset.export)));
document.querySelectorAll('.metric[data-status]').forEach((button) => button.addEventListener('click', () => filterStatus(button.dataset.status)));
document.querySelector('#clear-filter').addEventListener('click', () => state.table?.clearFilter(true));

function setupDropZone(side) {
  const zone = document.querySelector(`.drop-zone[data-side="${side}"]`);
  const input = document.querySelector(`#${side}-file`);
  input.accept = accept;
  zone.querySelector('.select-file').addEventListener('click', () => input.click());
  zone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => input.files[0] && loadFile(side, input.files[0]));
  for (const eventName of ['dragenter', 'dragover']) zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.add('dragging'); });
  for (const eventName of ['dragleave', 'drop']) zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.remove('dragging'); });
  zone.addEventListener('drop', (event) => event.dataTransfer.files[0] && loadFile(side, event.dataTransfer.files[0]));
}

async function loadFile(side, file) {
  setMessage(`Parsing ${file.name}…`);
  try {
    const mimeResult = getSupportedMimeTypeForFilename(file.name);
    if (!mimeResult.ok || !allowedIds.has(mimeResult.value.id)) throw new Error('Unsupported format. Choose Turtle (.ttl), N-Triples (.nt), JSON-LD (.jsonld), or RDF/XML (.rdf, .owl, .xml).');
    const adapter = getRdfAdapterDescriptorForMimeType(mimeResult.value.mimeType);
    if (!adapter.ok) throw new Error(`No parser is available for ${mimeResult.value.label}.`);
    const text = await file.text();
    const parsed = await parseRdfTextWithAdapters(text, {
      mimeType: mimeResult.value.mimeType,
      baseIri: file.name ? new URL(encodeURIComponent(file.name), location.href).href : location.href,
      runtime: { N3: globalThis.N3, jsonld: globalThis.jsonld, $rdf: globalThis.$rdf }
    });
    if (parsed.quads.some((quad) => quad.graph?.termType !== 'DefaultGraph')) throw new Error('Named graphs were found. This app supports triples in the default graph only.');
    state[side] = { file, descriptor: mimeResult.value, quads: parsed.quads };
    document.querySelector(`#${side}-meta`).textContent = `${file.name} · ${mimeResult.value.label} · ${parsed.quads.length.toLocaleString()} triples`;
    document.querySelector('#swap-files').disabled = !(state.left && state.right);
    if (state.left && state.right) renderComparison();
    else setMessage(`Loaded ${side.toUpperCase()}. Select the ${side === 'left' ? 'RIGHT revision' : 'LEFT original'} file.`);
  } catch (error) {
    state[side] = null;
    document.querySelector(`#${side}-meta`).textContent = 'No valid file selected';
    setMessage(error.message || String(error), true);
  }
}

function renderComparison() {
  try {
    state.diff = compareTriples(state.left.quads, state.right.quads);
    document.querySelector('#removed-count').textContent = state.diff.removed.length.toLocaleString();
    document.querySelector('#added-count').textContent = state.diff.added.length.toLocaleString();
    document.querySelector('#modified-count').textContent = state.diff.modifications.length.toLocaleString();
    document.querySelector('#total-count').textContent = state.diff.right.length.toLocaleString();
    report.hidden = false;
    showView('combined');
    const changed = state.diff.removed.length + state.diff.added.length + state.diff.modifications.length;
    const ignored = state.diff.ignoredBlankNodeTriples;
    const ignoredText = ` Blank-node triples ignored: ${ignored.left.toLocaleString()} LEFT, ${ignored.right.toLocaleString()} RIGHT.`;
    setMessage((changed ? `Comparison complete: ${changed.toLocaleString()} change${changed === 1 ? '' : 's'} found.` : 'The compared triples are identical.') + ignoredText);
  } catch (error) { setMessage(error.message || String(error), true); }
}

function showView(view) {
  state.view = view;
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  const combined = view === 'combined';
  const data = combined ? createCombinedRows(state.diff) : createSideRows(state.diff[view]);
  const columns = [
    ...(combined ? [{ title: 'Change', field: 'status', width: 120, headerFilter: 'input', formatter: (cell) => `<span class="status-pill">${cell.getValue()}</span>` }] : []),
    ...(combined ? [{ title: 'Previous subject', field: 'previousSubject', sorter: 'string', headerFilter: 'input', widthGrow: 2 }] : []),
    { title: 'Subject', field: 'subject', sorter: 'string', headerFilter: 'input', widthGrow: 2 },
    ...(combined ? [{ title: 'Previous predicate', field: 'previousPredicate', sorter: 'string', headerFilter: 'input', widthGrow: 2 }] : []),
    { title: 'Predicate', field: 'predicate', sorter: 'string', headerFilter: 'input', widthGrow: 2 },
    ...(combined ? [{ title: 'Previous object', field: 'previousObject', sorter: 'string', headerFilter: 'input', widthGrow: 2 }] : []),
    { title: combined ? 'Current object' : 'Object', field: 'object', sorter: 'string', headerFilter: 'input', widthGrow: 2 }
  ];
  state.table?.destroy();
  state.table = new globalThis.Tabulator('#diff-table', {
    data, columns, layout: 'fitColumns', height: 560, pagination: true, paginationSize: 50,
    initialSort: [{ column: 'subject', dir: 'asc' }], movableColumns: true,
    rowFormatter(row) { const status = row.getData().status; if (status) row.getElement().classList.add(`row-${status}`); }
  });
}

function filterStatus(status) {
  if (state.view !== 'combined') showView('combined');
  state.table.setFilter('status', '=', status);
  document.querySelector('#diff-table').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function swapFiles() {
  [state.left, state.right] = [state.right, state.left];
  for (const side of ['left', 'right']) {
    const item = state[side];
    document.querySelector(`#${side}-meta`).textContent = `${item.file.name} · ${item.descriptor.label} · ${item.quads.length.toLocaleString()} triples`;
  }
  renderComparison();
}

function exportReport(format) {
  if (!state.diff) return;
  const rows = createCombinedRows(state.diff).filter((row) => row.status !== 'unchanged');
  const base = `ontology-diff-${new Date().toISOString().slice(0, 10)}`;
  const summary = { removed: state.diff.removed.length, added: state.diff.added.length, modified: state.diff.modifications.length };
  if (format === 'sparql') return downloadTextFile(`${base}.ru`, createSparqlUpdate(state.diff), { mimeType: 'application/sparql-update' });
  if (format === 'csv') {
    const csv = globalThis.Papa.unparse(rows.map(exportRow));
    return downloadTextFile(`${base}.csv`, `${csv}\n`, { mimeType: 'text/csv' });
  }
  if (format === 'yaml') {
    return downloadTextFile(`${base}.yaml`, serializeReportValueToYaml({ title: 'Ontology Diff', left: state.left.file.name, right: state.right.file.name, summary, changes: rows.map(exportRow) }), { mimeType: 'text/yaml' });
  }
  const html = serializeReportDocumentToHtml({
    title: 'Ontology Diff', metadata: [['Original', state.left.file.name], ['Revision', state.right.file.name]],
    tables: [{ caption: 'Summary', headers: ['Removed', 'Added', 'Modified'], rows: [[summary.removed, summary.added, summary.modified]] }, { caption: 'Changes', headers: ['Change', 'Previous subject', 'Subject', 'Previous predicate', 'Predicate', 'Previous object', 'Current object'], rows: rows.map((row) => Object.values(exportRow(row))) }]
  });
  return downloadTextFile(`${base}.html`, html, { mimeType: 'text/html' });
}

function exportRow(row) {
  return { change: row.status, previousSubject: row.previousSubject, subject: row.subject, previousPredicate: row.previousPredicate, predicate: row.predicate, previousObject: row.previousObject, currentObject: row.object };
}

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
}
