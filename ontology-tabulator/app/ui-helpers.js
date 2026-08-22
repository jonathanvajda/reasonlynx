// app/ui-helpers.js
import { filterAndSortRows } from './core.js';
import { normalizeStringToPascalCase } from '../../packages/normalization-utils/src/index.js';
import { downloadTextFile } from '../../packages/browser-file-io/src/index.js';
import { serializeDelimitedRows } from '../../packages/tabular-io/src/index.js';
import {
  createReportTextExportDescriptor,
  openPrintableHtmlDocument,
  serializeReportDocumentToHtml
} from '../../packages/report-export/src/index.js';

export function showLoadingOverlay() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.classList.remove('ontology-tabulator-loading-hidden');
}

export function hideLoadingOverlay() {
  const el = document.getElementById('loadingOverlay');
  if (el) el.classList.add('ontology-tabulator-loading-hidden');
}

export function renderFileList(fileInfos) {
  const ul = document.getElementById('ontologyFileList');
  if (!ul) return;
  ul.innerHTML = '';

  fileInfos.forEach(info => {
    const li = document.createElement('li');
    li.className = 'ontology-tabulator-filelist-item';
    li.textContent = `${info.displayName} (${info.quadCount} triples)`;
    ul.appendChild(li);
  });
}

export function createLinkIfUri(value) {
  try {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) {
      return `<a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a>`;
    }
    return value;
  } catch {
    return value;
  }
}

export function renderOntologyCard(container, metadata) {
  const card = document.createElement('article');
  card.className = 'ontology-tabulator-card';

  const title = document.createElement('h3');
  title.className = 'ontology-tabulator-card-title';
  title.textContent = metadata.ontologyName || metadata.ontologyIri || 'Unnamed Ontology';
  card.appendChild(title);

  const table = document.createElement('table');
  table.className = 'ontology-tabulator-card-table';

  const fields = [
    ['Ontology Name', metadata.ontologyName],
    ['Ontology IRI', createLinkIfUri(metadata.ontologyIri)],
    ['Version IRI', createLinkIfUri(metadata.versionIri)],
    ['Version Info', metadata.versionInfo],
    ['Description', metadata.description],
    ['License', metadata.license],
    ['Copyright', metadata.rightsHolder]
  ];

  fields.forEach(([label, value]) => {
    if (!value) return;
    const tr = document.createElement('tr');

    const tdKey = document.createElement('td');
    tdKey.className = 'ontology-tabulator-card-table-cell-key';
    tdKey.textContent = `${label}:`;

    const tdVal = document.createElement('td');
    tdVal.className = 'ontology-tabulator-card-table-cell-value';
    tdVal.innerHTML = String(value);

    tr.appendChild(tdKey);
    tr.appendChild(tdVal);
    table.appendChild(tr);
  });

  card.appendChild(table);
  container.appendChild(card);
}

export function renderOntologyTable(container, ontologyMeta, tableModel) {
  const wrapper = document.createElement('section');
  wrapper.className = 'ontology-tabulator-table-wrapper';

  const headerRow = document.createElement('div');
  headerRow.className = 'ontology-tabulator-table-header-row';

  const title = document.createElement('h3');
  title.className = 'ontology-tabulator-table-title';
  title.textContent = (ontologyMeta.ontologyName || ontologyMeta.ontologyIri || 'Ontology Elements');
  headerRow.appendChild(title);

  const actions = document.createElement('div');
  actions.className = 'ontology-tabulator-table-actions';

  const filterInput = document.createElement('input');
  filterInput.type = 'search';
  filterInput.placeholder = 'Filter...';
  filterInput.className = 'ontology-tabulator-table-filter-input';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'ontology-tabulator-button';
  exportBtn.textContent = 'Export CSV';

  const printBtn = document.createElement('button');
  printBtn.className = 'ontology-tabulator-button';
  printBtn.textContent = 'Print';

  actions.appendChild(filterInput);
  actions.appendChild(exportBtn);
  actions.appendChild(printBtn);
  headerRow.appendChild(actions);

  wrapper.appendChild(headerRow);

  const table = document.createElement('table');
  table.className = 'ontology-tabulator-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  tableModel.headers.forEach((h, idx) => {
    const th = document.createElement('th');
    th.className = 'ontology-tabulator-table-header-cell ontology-tabulator-table-header-cell-sortable';
    th.textContent = h;
    th.dataset.sortIndex = String(idx);
    th.dataset.colKey = tableModel.keys[idx];   // NEW
    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);

  wrapper.appendChild(table);
  container.appendChild(wrapper);

  // state
  let sortIndex = 0;
  let sortDirection = 'asc';
  let currentQuery = '';

  function rerenderBody() {
    const rows = filterAndSortRows(tableModel, currentQuery, sortIndex, sortDirection);
    tbody.innerHTML = '';
    rows.forEach(rowModel => {
      const tr = document.createElement('tr');
      tableModel.headers.forEach((h, i) => {
        const td = document.createElement('td');
        td.className = 'ontology-tabulator-table-data-cell';

        const key = tableModel.keys[i];
        td.dataset.colKey = key;                    // NEW

        const value = key ? rowModel[key] : '';
        td.textContent = value || '';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  rerenderBody();

  // events
  thead.addEventListener('click', ev => {
    const target = ev.target;
    if (!(target instanceof HTMLElement)) return;
    const idx = target.dataset.sortIndex;
    if (idx == null) return;

    const i = Number(idx);
    if (i === sortIndex) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortIndex = i;
      sortDirection = 'asc';
    }
    rerenderBody();
  });

  filterInput.addEventListener('input', ev => {
    currentQuery = ev.target.value;
    rerenderBody();
  });

  exportBtn.addEventListener('click', () => {
    const rows = filterAndSortRows(tableModel, currentQuery, sortIndex, sortDirection);
    const csv = tableModelToCsv(tableModel, rows);
    const baseName = normalizeStringToPascalCase(ontologyMeta.ontologyName || ontologyMeta.ontologyIri) || 'Ontology';
    const descriptor = createReportTextExportDescriptor({
      text: csv,
      formatKey: 'csv',
      baseFileName: baseName
    });
    downloadTextFile(descriptor.fileName, descriptor.text, { mimeType: descriptor.mimeType });
  });

  printBtn.addEventListener('click', () => {
    const titleText = ontologyMeta.ontologyName || ontologyMeta.ontologyIri || 'Ontology Elements';
    const rows = filterAndSortRows(tableModel, currentQuery, sortIndex, sortDirection);
    const html = serializeReportDocumentToHtml({
      title: titleText,
      tables: [{
        caption: titleText,
        headers: tableModel.headers,
        rows: rows.map((row) => tableModel.keys.map((key) => (key ? (row[key] ?? '') : '')))
      }]
    }, {
      css: '@page{size:landscape;margin:0.5in;}th,td{border:1px solid #000;overflow-wrap:anywhere;}'
    });
    openPrintableHtmlDocument(html);
  });
}

export function tableModelToCsv(model, rows) {
  const tableRows = [
    model.headers,
    ...rows.map(row => model.keys.map(key => (key ? (row[key] ?? '') : '')))
  ];

  return serializeDelimitedRows(tableRows, {
    delimiter: ',',
    trailingNewline: false
  });
}

