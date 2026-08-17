import {
  buildImportGraph,
  buildMermaidImportSyntax,
  loadOntologyWorkspace,
  saveRegistryOverride,
  termsForOntology,
  truncateText
} from '../app/ontology-meta.js';
import { iconSvg } from '../app/ontology-icons.js';
import { serializeDelimitedRows } from '../packages/tabular-io/src/index.js';
import { downloadTextFile } from '../packages/browser-file-io/src/index.js';
import {
  createReportTextExportDescriptor,
  openPrintableHtmlDocument,
  serializeReportDocumentToHtml
} from '../packages/report-export/src/index.js';
import { renderStatusMessage } from '../packages/ui-feedback/src/index.js';

const statusText = document.getElementById('ontStatusText');
const ontologyCard = document.getElementById('ontologyCard');
const importDiagram = document.getElementById('importDiagram');
const termList = document.getElementById('termList');
const qaReport = document.getElementById('qualityAssuranceReport');
const modal = document.getElementById('ontologyRegistryModal');
const form = document.getElementById('ontologyRegistryForm');
const cancelBtn = document.getElementById('ontologyRegistryCancelBtn');

let workspace = null;
let currentRecord = null;

function setStatus(text) {
  renderStatusMessage(statusText, { message: text, severity: 'info' }, { classPrefix: 'ont-status' });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function paramsIri() {
  return new URLSearchParams(window.location.search).get('iri') || '';
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

function renderLinkedText(item, truncate = false) {
  const value = String(item?.value || item?.iri || item || '');
  const iri = item?.iri || (isHttpUrl(value) ? value : '');
  const display = truncate ? truncateText(value, 15, 100) : { text: value, truncated: false };
  const text = iri
    ? `<a href="${escapeHtml(iri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(display.text)}</a>`
    : escapeHtml(display.text);
  if (!display.truncated) return text;
  return `<details><summary>${text}&hellip;</summary>${iri ? `<a href="${escapeHtml(iri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>` : escapeHtml(value)}</details>`;
}

function valueList(label, values, options = {}) {
  const items = (values || []).filter((item) => item?.value || item?.iri || typeof item === 'string');
  if (!items.length) return '';
  const body = options.inline
    ? `<p class="ont-viewer__inlineValues">${items.map((item) => renderLinkedText(item, options.truncate)).join(', ')}</p>`
    : items.length === 1 && !options.forceList
    ? renderLinkedText(items[0], options.truncate)
    : `<ul class="ont-viewer__list">${items.map((item) => `<li>${renderLinkedText(item, options.truncate)}</li>`).join('')}</ul>`;
  return `<dt>${escapeHtml(label)}</dt><dd>${body}</dd>`;
}

function iriValue(label, value, options = {}) {
  if (!value) return '';
  const link = options.link
    ? `<a href="${escapeHtml(value)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>`
    : `<code>${escapeHtml(value)}</code>`;
  const copy = options.copy ? ` <button class="ont-catalog__iconBtn ont-viewer__copyBtn" type="button" data-copy="${escapeHtml(value)}" title="Copy ${escapeHtml(label)}">${iconSvg('copy')}</button>` : '';
  return `<dt>${escapeHtml(label)}</dt><dd class="ont-viewer__iri">${link}${copy}</dd>`;
}

function actionIcon(href, iconName, label, download = false) {
  if (!href) return '';
  return `<a class="ont-catalog__iconBtn" href="${escapeHtml(href)}" ${download ? 'download' : 'target="_blank" rel="noopener noreferrer"'} title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${iconSvg(iconName)}</a>`;
}

function renderOntologyCard(record) {
  document.title = `${record.label || 'Ontology'} | OntoEagle`;
  const registryActions = record.registered
    ? ''
    : `<button class="ont-search__btn ont-search__btn--secondary" type="button" id="ontologyAddRegistryBtn">Add registry data</button>`;
  const versionQuality = record.versionIriCount > 1
    ? `<p class="ont-viewer__empty">Data quality note: more than one owl:versionIRI was found; displaying the first value.</p>`
    : '';
  const importItems = (record.imports || []).map((iri) => ({ value: iri, iri }));
  const fields = [
    iriValue('IRI', record.iri, { copy: true }),
    iriValue('Version IRI', record.versionIri, { copy: true }),
    valueList('Version Info', record.versionInfo || []),
    record.description ? `<dt>Description</dt><dd>${escapeHtml(record.description)}</dd>` : '',
    record.git_repo_url ? `<dt>Git repository</dt><dd><a href="${escapeHtml(record.git_repo_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(record.git_repo_url)}</a> ${actionIcon(record.git_repo_url, record.git_logo, 'Open repository')} ${actionIcon(record.file, 'download', 'Download ontology', true)}</dd>` : '',
    iriValue('Issue tracker', record.issue_tracker_url, { link: true }),
    valueList('Direct imports', importItems, { forceList: true }),
    valueList('License', record.license, { truncate: true, forceList: true }),
    valueList('Rights holder', record.rightsHolder),
    valueList('Creator', record.creators, { inline: true }),
    valueList('Contributors', record.contributors, { inline: true }),
    valueList('Comment', record.comments, { truncate: true, forceList: true }),
    valueList('Created', record.created),
    valueList('Modified', record.modified),
    valueList('Publisher', record.publisher),
    valueList('Citation', record.citations, { forceList: true }),
    valueList('Prior version', (record.priorVersion || []).map((iri) => ({ value: iri, iri })), { forceList: true }),
    valueList('Backward compatible with', (record.backwardCompatibleWith || []).map((iri) => ({ value: iri, iri })), { forceList: true }),
    valueList('Incompatible with', (record.incompatibleWith || []).map((iri) => ({ value: iri, iri })), { forceList: true })
  ].filter(Boolean).join('');

  ontologyCard.innerHTML = `
    <div class="ont-viewer__toolbar">
      <h2 class="ont-viewer__title">${escapeHtml(record.label || record.iri)}</h2>
      <div class="ont-catalog__actions">${registryActions}</div>
    </div>
    ${versionQuality}
    <dl class="ont-viewer__cardGrid">${fields}</dl>
  `;

  ontologyCard.querySelector('#ontologyAddRegistryBtn')?.addEventListener('click', openRegistryModal);
  attachCopyButtons(ontologyCard);
}

function attachCopyButtons(root) {
  root.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const value = button.getAttribute('data-copy') || '';
      try {
        await navigator.clipboard.writeText(value);
        setStatus('Copied.');
      } catch (_err) {
        setStatus('Copy failed.');
      }
    });
  });
}

function renderFallbackDiagram(record) {
  const graph = buildImportGraph(record.iri, workspace.ontologyIndex);
  if (!graph.nodes.length) return '<p class="ont-viewer__empty">No import graph is available.</p>';
  const labels = new Map(graph.nodes.map((iri) => [iri, workspace.ontologyIndex.byIri.get(iri)?.label || iri]));
  const width = Math.max(760, graph.nodes.length * 190);
  const height = 220 + Math.max(0, graph.nodes.length - 1) * 24;
  const positions = new Map(graph.nodes.map((iri, index) => [iri, {
    x: 80 + (index % 4) * 185,
    y: 50 + Math.floor(index / 4) * 125
  }]));
  const edges = graph.edges.map((edge) => {
    const a = positions.get(edge.source);
    const b = positions.get(edge.target);
    if (!a || !b) return '';
    return `<path d="M${a.x + 70} ${a.y + 28} L${b.x + 70} ${b.y + 28}" stroke="var(--ont-muted)" stroke-width="2" marker-end="url(#arrow)"/><text x="${(a.x + b.x) / 2 + 55}" y="${(a.y + b.y) / 2 + 18}" fill="var(--ont-muted)" font-size="12">owl:imports</text>`;
  }).join('');
  const nodes = graph.nodes.map((iri) => {
    const pos = positions.get(iri);
    const text = labels.get(iri);
    return `<g><rect x="${pos.x}" y="${pos.y}" width="150" height="56" rx="6" fill="var(--ont-panel-bg)" stroke="var(--ont-border)"/><title>${escapeHtml(iri)}</title><foreignObject x="${pos.x + 8}" y="${pos.y + 8}" width="134" height="44"><div xmlns="http://www.w3.org/1999/xhtml" style="font:13px system-ui;color:var(--ont-text);overflow-wrap:anywhere;line-height:1.2">${escapeHtml(text)}</div></foreignObject></g>`;
  }).join('');
  return `<svg class="ont-viewer__diagramSvg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ontology import diagram"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="var(--ont-muted)"/></marker></defs>${edges}${nodes}</svg>`;
}

async function renderImportDiagram(record) {
  const { syntax } = buildMermaidImportSyntax(record.iri, workspace.ontologyIndex);
  importDiagram.innerHTML = `
    <div class="ont-viewer__toolbar">
      <h2 class="ont-viewer__title">Imports</h2>
    </div>
    <div class="ont-viewer__diagramWrap" id="importDiagramCanvas">${renderFallbackDiagram(record)}</div>
    <details class="ont-viewer__mermaidSource"><summary>Mermaid source</summary><pre><code>${escapeHtml(syntax)}</code></pre></details>
  `;

  if (globalThis.mermaid?.render) {
    try {
      globalThis.mermaid.initialize?.({
        startOnLoad: false,
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
        flowchart: { htmlLabels: true, curve: 'basis' }
      });
      const rendered = await globalThis.mermaid.render('ontologyImportMermaid', syntax);
      document.getElementById('importDiagramCanvas').innerHTML = rendered.svg;
    } catch (err) {
      console.warn('Mermaid render failed; using fallback SVG.', err);
    }
  }
}

function renderTermList(record) {
  const rows = termsForOntology(record.iri, workspace.docs);
  termList.innerHTML = `
    <div class="ont-viewer__toolbar">
      <h2 class="ont-viewer__title">Terms</h2>
      <div class="ont-catalog__actions">
        <button class="ont-search__btn ont-search__btn--secondary" type="button" id="termCsvBtn">CSV</button>
        <button class="ont-search__btn ont-search__btn--secondary" type="button" id="termPrintBtn">Print</button>
      </div>
    </div>
    <div id="ontologyTermTable" class="ont-viewer__termTable"></div>
  `;

  const table = new Tabulator('#ontologyTermTable', {
    data: rows,
    layout: 'fitColumns',
    height: '540px',
    pagination: true,
    paginationSize: 25,
    movableColumns: true,
    columns: [
      { title: 'IRI', field: 'iri', headerFilter: 'input', widthGrow: 2, formatter: 'textarea' },
      { title: 'Type', field: 'type', headerFilter: 'input', formatter: 'textarea' },
      { title: 'Label', field: 'label', headerFilter: 'input', formatter: 'textarea' },
      { title: 'Synonym', field: 'synonym', headerFilter: 'input', formatter: 'textarea' },
      { title: 'Definition', field: 'definition', headerFilter: 'input', widthGrow: 2, formatter: 'textarea' }
    ]
  });
  document.getElementById('termCsvBtn')?.addEventListener('click', () => {
    const csv = serializeDelimitedRows([
      ['IRI', 'Type', 'Label', 'Synonym', 'Definition'],
      ...rows.map((row) => [row.iri, row.type, row.label, row.synonym, row.definition])
    ], { delimiter: ',', trailingNewline: true });
    const descriptor = createReportTextExportDescriptor({
      text: csv,
      formatKey: 'csv',
      baseFileName: `${record.label || 'ontology'}-terms`,
      includeTimestamp: false
    });
    downloadTextFile(descriptor.fileName, descriptor.text, { mimeType: descriptor.mimeType });
  });
  document.getElementById('termPrintBtn')?.addEventListener('click', () => {
    const title = `${record.label || 'Ontology'} Terms`;
    const html = serializeReportDocumentToHtml({
      title,
      metadata: [['Ontology IRI', record.iri]],
      tables: [{
        caption: title,
        headers: ['IRI', 'Type', 'Label', 'Synonym', 'Definition'],
        rows: rows.map((row) => [row.iri, row.type, row.label, row.synonym, row.definition])
      }]
    }, {
      css: '@page{size:landscape;margin:0.5in;}th,td{border:1px solid #000;overflow-wrap:anywhere;}'
    });
    openPrintableHtmlDocument(html);
  });
}

function renderTermListDeferred(record) {
  termList.innerHTML = `
    <div class="ont-viewer__toolbar">
      <h2 class="ont-viewer__title">Terms</h2>
    </div>
    <div class="ont-catalog__loading">
      <span class="ont-catalog__spinner" aria-hidden="true"></span>
      <span>Loading terms...</span>
    </div>
  `;
  window.setTimeout(() => renderTermList(record), 0);
}

function renderQa(record) {
  const notes = [];
  if (!record.registered) notes.push('No registry entry is available for this ontology in this browser.');
  if (!record.versionIri) notes.push('No owl:versionIRI was found.');
  if (record.versionIriCount > 1) notes.push('More than one owl:versionIRI was found.');
  qaReport.innerHTML = `
    <h2 class="ont-viewer__title">Quality Assurance</h2>
    ${notes.length ? `<ul class="ont-viewer__list">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : '<p class="ont-viewer__empty">No basic ontology-card issues detected.</p>'}
  `;
}

function openRegistryModal() {
  if (!currentRecord) return;
  form.elements.iri.value = currentRecord.iri;
  form.elements.ontology_level.value = currentRecord.ontology_level === 'unsorted' ? 'mid' : (currentRecord.ontology_level || 'mid');
  form.elements.git_repo_url.value = currentRecord.git_repo_url || '';
  form.elements.git_logo.value = currentRecord.git_logo || 'git';
  form.elements.issue_tracker_url.value = currentRecord.issue_tracker_url || '';
  form.elements.file.value = currentRecord.file || '';
  modal?.showModal();
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  await saveRegistryOverride(Object.fromEntries(new FormData(form).entries()));
  modal?.close();
  await init();
  setStatus('Registry entry saved in this browser.');
});

cancelBtn?.addEventListener('click', () => modal?.close());

async function init() {
  const iri = paramsIri();
  if (!iri) {
    ontologyCard.innerHTML = '<p class="ont-viewer__empty">No ontology IRI was provided.</p>';
    return;
  }
  setStatus('Loading ontology viewer...');
  workspace = await loadOntologyWorkspace({ preferSnapshot: true });
  currentRecord = workspace.ontologyIndex.byIri.get(iri) || workspace.ontologyIndex.byIri.get(workspace.ontologyIndex.versionToOntologyIri.get(iri));
  if (!currentRecord) {
    ontologyCard.innerHTML = `<p class="ont-viewer__empty">Ontology not found: ${escapeHtml(iri)}</p>`;
    setStatus('Ontology not found.');
    return;
  }
  renderOntologyCard(currentRecord);
  setStatus(workspace.fromSnapshot ? 'Loaded ontology card from local snapshot.' : 'Loaded ontology card.');
  await renderImportDiagram(currentRecord);
  renderTermListDeferred(currentRecord);
  renderQa(currentRecord);
  setStatus('Ready.');
}

init().catch((err) => {
  console.error(err);
  ontologyCard.innerHTML = `<p class="ont-viewer__empty">Viewer failed to load. ${escapeHtml(err.message || err)}</p>`;
  setStatus(`Viewer failed: ${err.message || err}`);
});
