/**
 * @file Render helpers (DOM updates) for Table Nova UI.
 */

import { buildColumnSchemas } from '../rdf/schema.js';
import {
  COMMON_NAMESPACE_IRIS,
  compactIriToCurie,
  namespacePrefixMapFromRegistry
} from '../../../packages/namespace-registry/src/index.js';

/**
 * @typedef {import('../state/types.js').StagedFile} StagedFile
 * @typedef {import('../state/types.js').FileOptions} FileOptions
 */

const REGISTERED_PREFIXES = namespacePrefixMapFromRegistry();
const MIN_PREVIEW_COL_CH = 10;
const MAX_PREVIEW_COL_CH = 38;
const ROW_HEADER_COL_CH = 10;
const FILE_WARN_MB = 5;
const FILE_DANGER_MB = 10;

/**
 * Enables or disables the Run button.
 * @param {HTMLButtonElement} btn
 * @param {boolean} enabled
 * @returns {void}
 */
export function setRunButtonEnabled(btn, enabled) {
  btn.disabled = !enabled;
}

/**
 * Toggles dropzone dragover state.
 * @param {HTMLElement} dropzone
 * @param {boolean} isOver
 * @returns {void}
 */
export function setDropzoneDragState(dropzone, isOver) {
  dropzone.classList.toggle('table-nova-dropzone--dragover', Boolean(isOver));
}

/**
 * Renders staged files list.
 * @param {HTMLElement} listEl
 * @param {StagedFile[]} stagedFiles
 * @param {(stagedId: string) => void} [onRemove]
 * @returns {void}
 */
export function renderStagedFiles(listEl, stagedFiles, onRemove) {
  listEl.innerHTML = '';
  for (const s of stagedFiles || []) {
    listEl.appendChild(buildStagedFileItem(s));
  }

  if (onRemove) {
    mountRemoveHandler(listEl, onRemove);
  }
}

/**
 * Builds a staged-file LI element.
 * @param {StagedFile} staged
 * @returns {HTMLLIElement}
 */
export function buildStagedFileItem(staged) {
  const warning = getStagedFileWarning(staged.file?.size || 0);
  const li = document.createElement('li');
  li.className = warning ? `table-nova-fileitem ${warning.itemClass}` : 'table-nova-fileitem';

  const meta = document.createElement('div');
  meta.className = 'table-nova-fileitem__meta';

  const name = document.createElement('div');
  name.className = 'table-nova-fileitem__name';
  name.textContent = staged.file?.name || '(unnamed)';

  const sub = document.createElement('div');
  sub.className = 'table-nova-fileitem__sub';
  sub.textContent = `${formatBytes(staged.file?.size || 0)} • ${staged.file?.type || 'application/octet-stream'}`;

  meta.appendChild(name);
  meta.appendChild(sub);

  if (warning) {
    const note = document.createElement('div');
    note.className = `table-nova-fileitem__warning ${warning.noteClass}`;
    note.textContent = warning.message;
    meta.appendChild(note);
  }

  const btn = document.createElement('button');
  btn.className = 'table-nova-btn table-nova-btn--icon';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Remove file');
  btn.textContent = '×';
  btn.dataset.tableNovaRemoveStagedId = staged.id;

  li.appendChild(meta);
  li.appendChild(btn);
  return li;
}

/**
 * @param {number} bytes
 * @returns {{message: string, itemClass: string, noteClass: string}|null}
 */
export function getStagedFileWarning(bytes) {
  const size = Number(bytes || 0);
  const warnThreshold = FILE_WARN_MB * 1024 * 1024;
  const dangerThreshold = FILE_DANGER_MB * 1024 * 1024;

  if (size > dangerThreshold) {
    return {
      message: 'Large file warning: files over 10 MB are likely to make this page crash. Select a smaller file if possible.',
      itemClass: 'table-nova-fileitem--danger',
      noteClass: 'table-nova-fileitem__warning--danger'
    };
  }

  if (size > warnThreshold) {
    return {
      message: 'Large file warning: files over 5 MB may take extra time to load and process.',
      itemClass: 'table-nova-fileitem--warn',
      noteClass: 'table-nova-fileitem__warning--warn'
    };
  }

  return null;
}

/**
 * Mounts delegated click handler for remove buttons.
 * @param {HTMLElement} listEl
 * @param {(stagedId: string) => void} onRemove
 * @returns {void}
 */
export function mountRemoveHandler(listEl, onRemove) {
  if (listEl.dataset.tableNovaRemoveHandlerMounted === '1') return;
  listEl.dataset.tableNovaRemoveHandlerMounted = '1';
  listEl.addEventListener('click', (e) => handleRemoveClick(e, onRemove));
}

/**
 * Handles clicks on remove buttons.
 * @param {MouseEvent} e
 * @param {(stagedId: string) => void} onRemove
 * @returns {void}
 */
export function handleRemoveClick(e, onRemove) {
  const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
  if (!t) return;

  const btn = t.closest('[data-table-nova-remove-staged-id]');
  if (!btn) return;

  const id = /** @type {HTMLElement} */ (btn).dataset.tableNovaRemoveStagedId;
  if (id) onRemove(id);
}

/**
 * Renders the per-file options panel.
 * @param {HTMLElement} panelEl
 * @param {StagedFile[]} stagedFiles
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @param {(stagedId: string) => Promise<void>} onPreview
 * @returns {void}
 */
export function renderFileOptionsPanel(panelEl, stagedFiles, onUpdateOptions, onPreview) {
  panelEl.innerHTML = '';

  if (!stagedFiles || stagedFiles.length === 0) {
    const p = document.createElement('p');
    p.className = 'table-nova-muted';
    p.textContent = 'Add a file to configure preview, header handling, predicate casing, and datatypes.';
    panelEl.appendChild(p);
    return;
  }

  const selectedId = getSelectedStagedId(stagedFiles);
  const staged = stagedFiles.find((s) => s.id === selectedId) || stagedFiles[0];

  // File selector
  if (stagedFiles.length > 1) {
    panelEl.appendChild(buildFileSelector(stagedFiles, staged.id));
  }

  panelEl.appendChild(buildHeaderOption(staged, onUpdateOptions));
  panelEl.appendChild(buildPredicateOptions(staged, onUpdateOptions));
  panelEl.appendChild(buildPreviewSection(staged, onUpdateOptions, onPreview));
}

/**
 * Returns the currently selected stagedId (stored in panel dataset).
 * @param {StagedFile[]} stagedFiles
 * @returns {string}
 */
export function getSelectedStagedId(stagedFiles) {
  const first = stagedFiles?.[0]?.id || '';
  const saved = document.body.dataset.owSelectedStagedId;
  return saved && stagedFiles.some((s) => s.id === saved) ? saved : first;
}

/**
 * Builds file selector UI.
 * @param {StagedFile[]} stagedFiles
 * @param {string} selectedId
 * @returns {HTMLElement}
 */
export function buildFileSelector(stagedFiles, selectedId) {
  const wrap = document.createElement('div');
  wrap.className = 'table-nova-field';

  const label = document.createElement('label');
  label.className = 'table-nova-label';
  label.textContent = 'File';

  const sel = document.createElement('select');
  sel.className = 'table-nova-select';
  sel.addEventListener('change', (e) => handleSelectFileChange(e, stagedFiles));

  for (const s of stagedFiles) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.file?.name || s.id;
    opt.selected = s.id === selectedId;
    sel.appendChild(opt);
  }

  wrap.appendChild(label);
  wrap.appendChild(sel);
  return wrap;
}

/**
 * Handles staged file selection change.
 * @param {Event} e
 * @param {StagedFile[]} stagedFiles
 * @returns {void}
 */
export function handleSelectFileChange(e, stagedFiles) {
  const target = /** @type {HTMLSelectElement|null} */ (e.target instanceof HTMLSelectElement ? e.target : null);
  if (!target) return;
  const id = target.value;
  if (!stagedFiles.some((s) => s.id === id)) return;
  document.body.dataset.owSelectedStagedId = id;

  // Trigger a re-render by dispatching a custom event; main.js already re-renders on state updates,
  // but selection changes are local, so we re-render via bubbling event.
  document.dispatchEvent(new CustomEvent('tablenova:selected-file-changed', { detail: { stagedId: id } }));
}

/**
 * Builds header option (treat first row as header).
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {HTMLElement}
 */
export function buildHeaderOption(staged, onUpdateOptions) {
  const wrap = document.createElement('div');
  wrap.className = 'table-nova-field';

  const row = document.createElement('div');
  row.className = 'table-nova-checkboxrow';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = Boolean(staged.options?.treatFirstRowAsHeader ?? true);
  cb.addEventListener('change', (e) => handleHeaderToggle(e, staged, onUpdateOptions));

  const label = document.createElement('label');
  label.className = 'table-nova-label';
  label.textContent = 'Treat row';

  const input = document.createElement('input');
  input.className = 'table-nova-input table-nova-input--rownum';
  input.type = 'number';
  input.min = '1';
  input.step = '1';
  input.value = String(Math.max(1, Number(staged.options?.headerRowNumber || 1)));
  input.disabled = !cb.checked;
  input.setAttribute('aria-label', 'Header row number');
  input.addEventListener('change', (e) => handleHeaderRowNumberChange(e, staged, onUpdateOptions));

  const suffix = document.createElement('span');
  suffix.className = 'table-nova-label';
  suffix.textContent = 'as header';

  row.appendChild(cb);
  row.appendChild(label);
  row.appendChild(input);
  row.appendChild(suffix);

  wrap.appendChild(row);
  return wrap;
}

/**
 * Handles header checkbox toggle.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handleHeaderToggle(e, staged, onUpdateOptions) {
  const target = /** @type {HTMLInputElement|null} */ (e.target instanceof HTMLInputElement ? e.target : null);
  if (!target) return;

  const next = {
    ...staged.options,
    treatFirstRowAsHeader: Boolean(target.checked),
    headerRowNumber: Math.max(1, Number(staged.options?.headerRowNumber || 1)),
    preview: null
  };
  onUpdateOptions(staged.id, next);
}

/**
 * Handles header row number input.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handleHeaderRowNumberChange(e, staged, onUpdateOptions) {
  const target = /** @type {HTMLInputElement|null} */ (e.target instanceof HTMLInputElement ? e.target : null);
  if (!target) return;
  const value = Math.max(1, Math.floor(Number(target.value || 1)));
  const next = {
    ...staged.options,
    headerRowNumber: value,
    preview: null
  };
  onUpdateOptions(staged.id, next);
}

/**
 * Builds predicate options UI (prefixHas + casing).
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {HTMLElement}
 */
export function buildPredicateOptions(staged, onUpdateOptions) {
  const container = document.createElement('div');
  container.className = 'table-nova-preview';
  container.setAttribute('aria-label', 'Predicate schema');

  const header = document.createElement('div');
  header.className = 'table-nova-preview__header';

  const title = document.createElement('h3');
  title.className = 'table-nova-preview__title';
  title.textContent = 'Predicate schema';

  header.appendChild(title);
  container.appendChild(header);

  // prefixHas
  const prefixRow = document.createElement('div');
  prefixRow.className = 'table-nova-checkboxrow';
  prefixRow.style.marginTop = '0.5rem';

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = Boolean(staged.options?.predicate?.prefixHas ?? true);
  cb.addEventListener('change', (e) => handlePrefixHasToggle(e, staged, onUpdateOptions));

  const lbl = document.createElement('label');
  lbl.className = 'table-nova-label';
  lbl.textContent = "Append 'has' before casing";

  prefixRow.appendChild(cb);
  prefixRow.appendChild(lbl);

  // casing
  const casingField = document.createElement('div');
  casingField.className = 'table-nova-field';
  casingField.style.marginTop = '0.75rem';

  const casingLabel = document.createElement('label');
  casingLabel.className = 'table-nova-label';
  casingLabel.textContent = 'Casing';

  const sel = document.createElement('select');
  sel.className = 'table-nova-select';
  sel.addEventListener('change', (e) => handleCasingChange(e, staged, onUpdateOptions));

  const options = [
    { value: 'camelCase', text: 'camelCase' },
    { value: 'PascalCase', text: 'PascalCase' },
    { value: 'snake_case', text: 'snake_case' },
    { value: 'SHOUT_CASE', text: 'SHOUT_CASE' }
  ];

  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.text;
    o.selected = opt.value === (staged.options?.predicate?.casing ?? 'camelCase');
    sel.appendChild(o);
  }

  casingField.appendChild(casingLabel);
  casingField.appendChild(sel);

  container.appendChild(prefixRow);
  container.appendChild(casingField);

  return container;
}

/**
 * Handles prefixHas toggle.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handlePrefixHasToggle(e, staged, onUpdateOptions) {
  const target = /** @type {HTMLInputElement|null} */ (e.target instanceof HTMLInputElement ? e.target : null);
  if (!target) return;
  const next = {
    ...staged.options,
    predicate: { ...staged.options.predicate, prefixHas: Boolean(target.checked) }
  };
  onUpdateOptions(staged.id, next);
}

/**
 * Handles casing change.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handleCasingChange(e, staged, onUpdateOptions) {
  const target = /** @type {HTMLSelectElement|null} */ (e.target instanceof HTMLSelectElement ? e.target : null);
  if (!target) return;
  const next = {
    ...staged.options,
    predicate: { ...staged.options.predicate, casing: /** @type {any} */ (target.value) }
  };
  onUpdateOptions(staged.id, next);
}

/**
 * Builds preview section with optional datatype selectors.
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @param {(stagedId: string) => Promise<void>} onPreview
 * @returns {HTMLElement}
 */
export function buildPreviewSection(staged, onUpdateOptions, onPreview) {
  const container = document.createElement('section');
  container.className = 'table-nova-preview';

  const header = document.createElement('div');
  header.className = 'table-nova-preview__header';

  const title = document.createElement('h3');
  title.className = 'table-nova-preview__title';
  title.textContent = 'Preview data';

  const btn = document.createElement('button');
  btn.className = 'table-nova-btn table-nova-btn--tertiary';
  btn.type = 'button';
  btn.textContent = staged.options?.preview ? 'Refresh preview' : 'Preview first 5 rows';
  btn.addEventListener('click', () => onPreview(staged.id));

  header.appendChild(title);
  header.appendChild(btn);

  container.appendChild(header);

  if (!staged.options?.preview) {
    const p = document.createElement('p');
    p.className = 'table-nova-muted';
    p.style.margin = '0.5rem 0 0';
    p.textContent = 'Click Preview to inspect rows and set column datatypes.';
    container.appendChild(p);
    return container;
  }

  const body = document.createElement('div');
  body.className = 'table-nova-preview__body';

  body.appendChild(buildPreviewTable(staged, onUpdateOptions));

  const dtHelp = document.createElement('p');
  dtHelp.className = 'table-nova-muted';
  dtHelp.style.margin = '0.75rem 0 0';
  dtHelp.textContent = 'Column schema edits drive both instance predicates and the separate ontology artifact.';

  body.appendChild(dtHelp);
  container.appendChild(body);
  return container;
}

/**
 * Builds one pivoted schema row.
 * @param {string} rowLabel
 * @param {import('../rdf/schema.js').ColumnSchema[]} schemas
 * @param {(schema: import('../rdf/schema.js').ColumnSchema) => HTMLTableCellElement} buildCell
 * @returns {HTMLTableRowElement}
 */
export function buildSchemaValueRow(rowLabel, schemas, buildCell) {
  const tr = document.createElement('tr');
  tr.className = rowLabel === 'Detected' ? 'table-nova-schema-row table-nova-schema-row--first' : 'table-nova-schema-row';
  const th = document.createElement('th');
  th.scope = 'row';
  th.textContent = rowLabel;
  tr.appendChild(th);

  for (const schema of schemas) {
    tr.appendChild(buildCell(schema));
  }

  return tr;
}

/**
 * @param {string} value
 * @returns {HTMLTableCellElement}
 */
export function textCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value;
  return cell;
}

/**
 * @param {HTMLElement} control
 * @returns {HTMLTableCellElement}
 */
export function controlCell(control) {
  const cell = document.createElement('td');
  cell.appendChild(control);
  return cell;
}

/**
 * Builds a preview table (first 5 rows).
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {HTMLElement}
 */
export function buildPreviewTable(staged, onUpdateOptions) {
  const preview = staged.options?.preview;
  const header = preview?.header || [];
  const rows = preview?.rows || [];

  const wrap = document.createElement('div');
  wrap.className = 'table-nova-tablewrap table-nova-tablewrap--preview-schema';
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', 'Data sample and column schema');
  wrap.tabIndex = 0;

  const table = document.createElement('table');
  table.className = 'table-nova-table table-nova-table--preview-schema';

  const thead = document.createElement('thead');
  const trh = document.createElement('tr');

  const effectiveCols = Math.max(header.length, ...(rows.map((r) => r.length)));
  const colKeys = Array.from({ length: effectiveCols }, (_, i) => header[i] || `Column${i + 1}`);
  const schemas = getPreviewColumnSchemas(staged);
  const colWidths = estimatePreviewColumnWidths(colKeys, rows, schemas);

  table.appendChild(buildPreviewColGroup(colWidths));

  const rowHeader = document.createElement('th');
  rowHeader.scope = 'col';
  rowHeader.textContent = 'Row';
  trh.appendChild(rowHeader);

  for (let i = 0; i < effectiveCols; i += 1) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = colKeys[i];
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((r, rowIndex) => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = String(rowIndex + 1);
    tr.appendChild(th);

    for (let i = 0; i < effectiveCols; i += 1) {
      const td = document.createElement('td');
      td.textContent = String(r?.[i] ?? '');
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });

  tbody.appendChild(buildSchemaValueRow('Detected', schemas, (schema) => textCell(formatDetectedStyle(schema.detectedStyle))));
  tbody.appendChild(buildSchemaValueRow('Label', schemas, (schema) => {
    const input = document.createElement('input');
    input.className = 'table-nova-input';
    input.type = 'text';
    input.value = schema.label;
    input.setAttribute('aria-label', `Label for ${schema.originalHeader}`);
    input.addEventListener('change', (e) => handleColumnLabelChange(e, staged, schema.key, onUpdateOptions));
    return controlCell(input);
  }));
  tbody.appendChild(buildSchemaValueRow('Predicate', schemas, (schema) => {
    const input = document.createElement('input');
    input.className = 'table-nova-input';
    input.type = 'text';
    input.value = schema.predicateLocalName;
    input.setAttribute('aria-label', `Predicate local name for ${schema.originalHeader}`);
    input.addEventListener('change', (e) => handleColumnPredicateChange(e, staged, schema.key, onUpdateOptions));
    return controlCell(input);
  }));
  tbody.appendChild(buildSchemaValueRow('Range', schemas, (schema) => {
    const sel = buildDatatypeSelect(schema.datatypeIri);
    sel.addEventListener('change', (e) => handleDatatypeChange(e, staged, schema.index, onUpdateOptions));
    return controlCell(sel);
  }));

  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/**
 * Builds fixed column widths for the combined preview/schema table.
 * @param {number[]} colWidths
 * @returns {HTMLTableColElement}
 */
export function buildPreviewColGroup(colWidths) {
  const group = document.createElement('colgroup');
  const rowCol = document.createElement('col');
  rowCol.style.width = `${ROW_HEADER_COL_CH}ch`;
  group.appendChild(rowCol);

  for (const width of colWidths) {
    const col = document.createElement('col');
    col.style.width = `${width}ch`;
    group.appendChild(col);
  }

  return group;
}

/**
 * Estimates practical wrapped column widths from headers, samples, and schema controls.
 * @param {string[]} colKeys
 * @param {string[][]} rows
 * @param {import('../rdf/schema.js').ColumnSchema[]} schemas
 * @returns {number[]}
 */
export function estimatePreviewColumnWidths(colKeys, rows, schemas) {
  return colKeys.map((key, index) => {
    const headerCh = Math.max(MIN_PREVIEW_COL_CH, textWidthCh(key));
    const maxFromHeader = Math.ceil(headerCh * 1.5);
    const sampleCh = Math.max(0, ...(rows || []).map((r) => textWidthCh(r?.[index] ?? '')));
    const schema = schemas?.[index];
    const schemaCh = Math.max(
      textWidthCh(schema?.detectedStyle || ''),
      textWidthCh(schema?.label || ''),
      textWidthCh(schema?.predicateLocalName || ''),
      textWidthCh(shortDatatypeLabel(schema?.datatypeIri || COMMON_NAMESPACE_IRIS.xsd.string))
    );
    const desired = Math.max(headerCh, sampleCh, schemaCh);
    return Math.min(MAX_PREVIEW_COL_CH, Math.max(MIN_PREVIEW_COL_CH, Math.min(desired, maxFromHeader)));
  });
}

/**
 * Roughly estimates text width in ch units.
 * @param {string} value
 * @returns {number}
 */
export function textWidthCh(value) {
  return String(value ?? '').trim().length || 0;
}

/**
 * @param {string} datatypeIri
 * @returns {string}
 */
export function shortDatatypeLabel(datatypeIri) {
  const s = String(datatypeIri || '');
  const compact = compactIriToCurie(s, REGISTERED_PREFIXES);
  return compact.ok ? compact.value : s;
}

/**
 * Builds an xsd datatype selector.
 * @param {string} selected
 * @returns {HTMLSelectElement}
 */
export function buildDatatypeSelect(selected) {
  const sel = document.createElement('select');
  sel.className = 'table-nova-select';
  sel.appendChild(optionOf(COMMON_NAMESPACE_IRIS.xsd.string, 'xsd:string'));
  sel.appendChild(optionOf(COMMON_NAMESPACE_IRIS.xsd.boolean, 'xsd:boolean'));
  sel.appendChild(optionOf(COMMON_NAMESPACE_IRIS.xsd.integer, 'xsd:integer'));
  sel.appendChild(optionOf(COMMON_NAMESPACE_IRIS.xsd.decimal, 'xsd:decimal'));
  sel.appendChild(optionOf(COMMON_NAMESPACE_IRIS.xsd.double, 'xsd:double'));
  sel.appendChild(optionOf(COMMON_NAMESPACE_IRIS.xsd.dateTime, 'xsd:dateTime'));
  sel.appendChild(optionOf(COMMON_NAMESPACE_IRIS.xsd.date, 'xsd:date'));
  sel.appendChild(optionOf(COMMON_NAMESPACE_IRIS.xsd.anyURI, 'xsd:anyURI'));
  sel.value = selected || COMMON_NAMESPACE_IRIS.xsd.string;
  return sel;
}

/**
 * Makes an <option> element.
 * @param {string} value
 * @param {string} label
 * @returns {HTMLOptionElement}
 */
export function optionOf(value, label) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  return o;
}

/**
 * Mounts datatype change handlers for preview table selects.
 * @param {HTMLElement} root
 * @param {StagedFile} staged
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function mountDatatypeSelectHandlers(root, staged, onUpdateOptions) {
  const selects = Array.from(root.querySelectorAll('select[data-table-nova-datatype-col-index]'));
  selects.forEach((sel) => {
    const idx = Number(sel.getAttribute('data-table-nova-datatype-col-index') || '0');
    const key = getColumnKeyForDatatype(staged, idx);
    const existing = staged.options?.datatypesByColumnKey?.[key];
    if (existing) sel.value = existing;

    sel.addEventListener('change', (e) => handleDatatypeChange(e, staged, idx, onUpdateOptions));
  });
}

/**
 * Determines column key string for a datatype selector.
 * If the file treats first row as header, we use header[idx]; otherwise ColumnA/ColumnB... (stable with schema rules).
 * @param {StagedFile} staged
 * @param {number} colIndex
 * @returns {string}
 */
export function getColumnKeyForDatatype(staged, colIndex) {
  const header = staged.options?.preview?.header || [];
  const label = header?.[colIndex];
  if (staged.options?.treatFirstRowAsHeader && label) return label;
  return `Column${excelLetters(colIndex)}`;
}

/**
 * Converts index to Excel letters.
 * @param {number} index
 * @returns {string}
 */
export function excelLetters(index) {
  let n = Math.max(0, Math.floor(index));
  let s = '';
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * Handles datatype dropdown change.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {number} colIndex
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handleDatatypeChange(e, staged, colIndex, onUpdateOptions) {
  const target = /** @type {HTMLSelectElement|null} */ (e.target instanceof HTMLSelectElement ? e.target : null);
  if (!target) return;
  const key = getColumnKeyForDatatype(staged, colIndex);
  const next = {
    ...staged.options,
    datatypesByColumnKey: { ...(staged.options?.datatypesByColumnKey || {}), [key]: target.value }
  };
  onUpdateOptions(staged.id, next);
}

/**
 * Handles label edits for a column schema.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {string} key
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handleColumnLabelChange(e, staged, key, onUpdateOptions) {
  const target = /** @type {HTMLInputElement|null} */ (e.target instanceof HTMLInputElement ? e.target : null);
  if (!target) return;
  updateColumnSchemaOverride(staged, key, { label: target.value }, onUpdateOptions);
}

/**
 * Handles predicate local-name edits for a column schema.
 * @param {Event} e
 * @param {StagedFile} staged
 * @param {string} key
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function handleColumnPredicateChange(e, staged, key, onUpdateOptions) {
  const target = /** @type {HTMLInputElement|null} */ (e.target instanceof HTMLInputElement ? e.target : null);
  if (!target) return;
  updateColumnSchemaOverride(staged, key, { predicateLocalName: target.value }, onUpdateOptions);
}

/**
 * Updates one column schema override while preserving other edited values.
 * @param {StagedFile} staged
 * @param {string} key
 * @param {{label?: string, predicateLocalName?: string}} patch
 * @param {(stagedId: string, nextOptions: FileOptions) => void} onUpdateOptions
 * @returns {void}
 */
export function updateColumnSchemaOverride(staged, key, patch, onUpdateOptions) {
  const existing = staged.options?.columnSchemaOverridesByKey || {};
  const nextForKey = { ...(existing[key] || {}), ...patch };
  const next = {
    ...staged.options,
    columnSchemaOverridesByKey: { ...existing, [key]: nextForKey }
  };
  onUpdateOptions(staged.id, next);
}

/**
 * Builds column schemas from the current preview state.
 * @param {StagedFile} staged
 * @returns {import('../rdf/schema.js').ColumnSchema[]}
 */
export function getPreviewColumnSchemas(staged) {
  const preview = staged.options?.preview || { header: [], rows: [] };
  return buildColumnSchemas({
    header: preview.header || [],
    rows: preview.rows || [],
    treatFirstRowAsHeader: Boolean(staged.options?.treatFirstRowAsHeader ?? true),
    predicateOptions: staged.options?.predicate,
    basePredicateIri: '',
    datatypesByColumnKey: staged.options?.datatypesByColumnKey || {},
    columnSchemaOverridesByKey: staged.options?.columnSchemaOverridesByKey || {}
  });
}

/**
 * Formats a detected style for display.
 * @param {string} style
 * @returns {string}
 */
export function formatDetectedStyle(style) {
  return String(style || 'unknown');
}

/**
 * Renders outputs into the output area.
 * @param {any} dom
 * @param {any} lastOutput
 * @param {'abox'|'tbox'|'both'} [scope]
 * @param {'turtle'|'ntriples'|'jsonld'|'session'} [activeTab]
 * @returns {void}
 */
export function renderOutputs(dom, lastOutput, scope = 'abox', activeTab = 'turtle') {
  if (!lastOutput) {
    dom.turtleText.value = '';
    dom.jsonldText.value = '';
    dom.quadTable.__TableNovaQuads = [];
    renderQuadTable(dom.quadTable, []);
    return;
  }

  const view = lastOutput?.views?.[scope] || {};
  const quads = lastOutput?.quadsByScope?.[scope] || [];

  if (activeTab === 'turtle') {
    dom.turtleText.value = view.turtle || '';
  }

  if (activeTab === 'jsonld') {
    dom.jsonldText.value = view.jsonldGraph || '';
  }

  if (activeTab === 'ntriples') {
    dom.quadTable.__TableNovaQuads = quads;
    renderQuadTable(dom.quadTable, quads);
  }
}

/**
 * Renders the quad table body.
 * @param {HTMLTableElement} table
 * @param {any[]} quads
 * @returns {void}
 */
export function renderQuadTable(table, quads) {
  const tbody = table.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  for (const q of quads || []) {
    const tr = document.createElement('tr');
    tr.appendChild(td(q.s));
    tr.appendChild(td(q.p));
    tr.appendChild(td(formatObject(q)));
    tr.appendChild(td(q.g));
    tbody.appendChild(tr);
  }
}

/**
 * Formats stored quad object for display.
 * @param {any} q
 * @returns {string}
 */
export function formatObject(q) {
  if (!q) return '';
  if (q.oType === 'iri') return `<${q.oValue}>`;
  const dt = q.datatypeIri ? `^^<${q.datatypeIri}>` : '';
  const lang = q.lang ? `@${q.lang}` : '';
  return `"${escapeLiteral(q.oValue)}"${lang}${dt}`;
}

/**
 * Escapes a literal value for display.
 * @param {string} s
 * @returns {string}
 */
export function escapeLiteral(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\"');
}

/**
 * Builds a TD element with text.
 * @param {string} s
 * @returns {HTMLTableCellElement}
 */
export function td(s) {
  const el = document.createElement('td');
  el.textContent = String(s ?? '');
  return el;
}

/**
 * Renders run list with delete/load controls.
 * @param {HTMLElement} listEl
 * @param {Array<{graphIri: string, filename: string, createdAtIso: string}>} runs
 * @param {(graphIri: string) => Promise<void>} onDelete
 * @param {(graphIri: string) => Promise<void>} onLoad
 * @returns {void}
 */
export function renderRunsList(listEl, runs, onDelete, onLoad) {
  listEl.innerHTML = '';
  for (const r of runs || []) {
    listEl.appendChild(buildRunItem(r));
  }
  mountRunListHandlers(listEl, onDelete, onLoad);
}

/**
 * Builds a run list item.
 * @param {{graphIri: string, filename: string, createdAtIso: string}} run
 * @returns {HTMLLIElement}
 */
export function buildRunItem(run) {
  const li = document.createElement('li');
  li.className = 'table-nova-runitem';

  const meta = document.createElement('div');
  meta.className = 'table-nova-fileitem__meta';

  const name = document.createElement('div');
  name.className = 'table-nova-fileitem__name';
  name.textContent = run.filename;

  const sub = document.createElement('div');
  sub.className = 'table-nova-fileitem__sub';
  sub.textContent = `${run.createdAtIso} • ${run.graphIri}`;

  meta.appendChild(name);
  meta.appendChild(sub);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '0.35rem';

  const loadBtn = document.createElement('button');
  loadBtn.className = 'table-nova-btn table-nova-btn--tertiary';
  loadBtn.type = 'button';
  loadBtn.textContent = 'Load';
  loadBtn.dataset.tableNovaLoadGraphIri = run.graphIri;

  const delBtn = document.createElement('button');
  delBtn.className = 'table-nova-btn table-nova-btn--icon';
  delBtn.type = 'button';
  delBtn.textContent = '×';
  delBtn.setAttribute('aria-label', 'Delete run');
  delBtn.dataset.tableNovaDeleteGraphIri = run.graphIri;

  actions.appendChild(loadBtn);
  actions.appendChild(delBtn);

  li.appendChild(meta);
  li.appendChild(actions);
  return li;
}

/**
 * Mounts click handlers for run list (delegated).
 * @param {HTMLElement} listEl
 * @param {(graphIri: string) => Promise<void>} onDelete
 * @param {(graphIri: string) => Promise<void>} onLoad
 * @returns {void}
 */
export function mountRunListHandlers(listEl, onDelete, onLoad) {
  if (listEl.dataset.tableNovaRunHandlersMounted === '1') return;
  listEl.dataset.tableNovaRunHandlersMounted = '1';
  listEl.addEventListener('click', (e) => handleRunListClick(e, onDelete, onLoad));
}

/**
 * Handles run list click.
 * @param {MouseEvent} e
 * @param {(graphIri: string) => Promise<void>} onDelete
 * @param {(graphIri: string) => Promise<void>} onLoad
 * @returns {void}
 */
export function handleRunListClick(e, onDelete, onLoad) {
  const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
  if (!t) return;

  const del = t.closest('[data-table-nova-delete-graph-iri]');
  if (del) {
    const iri = /** @type {HTMLElement} */ (del).dataset.tableNovaDeleteGraphIri;
    if (iri) void onDelete(iri);
    return;
  }

  const load = t.closest('[data-table-nova-load-graph-iri]');
  if (load) {
    const iri = /** @type {HTMLElement} */ (load).dataset.tableNovaLoadGraphIri;
    if (iri) void onLoad(iri);
  }
}

/**
 * Mounts tab switching behavior.
 * @param {HTMLElement|null} tabsEl
 * @param {NodeListOf<HTMLElement>} panels
 * @returns {void}
 */
export function mountTabs(tabsEl, panels) {
  if (!tabsEl) return;
  if (tabsEl.dataset.owTabsMounted === '1') return;
  tabsEl.dataset.owTabsMounted = '1';

  tabsEl.addEventListener('click', (e) => handleTabClick(e, tabsEl, panels));
}

/**
 * Handles tab click.
 * @param {MouseEvent} e
 * @param {HTMLElement} tabsEl
 * @param {NodeListOf<HTMLElement>} panels
 * @returns {void}
 */
export function handleTabClick(e, tabsEl, panels) {
  const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
  if (!t) return;

  const btn = t.closest('button[data-tab]');
  if (!btn) return;

  const tab = btn.getAttribute('data-tab');
  if (!tab) return;

  const buttons = Array.from(tabsEl.querySelectorAll('button[data-tab]'));
  buttons.forEach((b) => b.classList.toggle('table-nova-tab--active', b === btn));

  panels.forEach((p) => p.classList.toggle('table-nova-tabpanel--active', p.getAttribute('data-panel') === tab));
}

/**
 * Adds sorting and filtering controls to the quad table.
 * @param {HTMLTableElement} table
 * @param {HTMLInputElement} filterInput
 * @returns {void}
 */
export function mountTableSortingAndFiltering(table, filterInput) {
  if (table.dataset.owSortMounted === '1') return;
  table.dataset.owSortMounted = '1';

  const thead = table.querySelector('thead');
  if (thead) thead.addEventListener('click', (e) => handleSortHeaderClick(e, table));

  filterInput.addEventListener('input', (e) => handleFilterInput(e, table));
}

/**
 * Handles clicking on table headers for sorting.
 * @param {MouseEvent} e
 * @param {HTMLTableElement} table
 * @returns {void}
 */
export function handleSortHeaderClick(e, table) {
  const t = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
  if (!t) return;

  const th = t.closest('th[data-sort]');
  if (!th) return;

  const key = th.getAttribute('data-sort') || 's';
  const currentKey = table.dataset.owSortKey || 's';
  const currentDir = table.dataset.owSortDir || 'asc';
  const nextDir = currentKey === key && currentDir === 'asc' ? 'desc' : 'asc';

  table.dataset.owSortKey = key;
  table.dataset.owSortDir = nextDir;

  applySortAndFilter(table);
}

/**
 * Handles filter input.
 * @param {Event} e
 * @param {HTMLTableElement} table
 * @returns {void}
 */
export function handleFilterInput(e, table) {
  const t = /** @type {HTMLInputElement|null} */ (e.target instanceof HTMLInputElement ? e.target : null);
  if (!t) return;
  table.dataset.tableNovaFilter = t.value || '';
  applySortAndFilter(table);
}

/**
 * Applies sorting and filtering to the current quad list.
 * @param {HTMLTableElement} table
 * @returns {void}
 */
export function applySortAndFilter(table) {
  const raw = /** @type {any[]} */ (table.__TableNovaQuads || []);
  const filter = String(table.dataset.tableNovaFilter || '').toLowerCase().trim();

  let out = raw.slice();

  if (filter) {
    out = out.filter((q) => {
      const o = formatObject(q);
      return [q.s, q.p, o, q.g].some((v) => String(v ?? '').toLowerCase().includes(filter));
    });
  }

  const key = table.dataset.owSortKey || 's';
  const dir = table.dataset.owSortDir || 'asc';
  const mult = dir === 'desc' ? -1 : 1;

  out.sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? '')) * mult);

  renderQuadTable(table, out);
}

/**
 * Formats bytes for display.
 * @param {number} n
 * @returns {string}
 */
export function formatBytes(n) {
  const bytes = Number(n || 0);
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
