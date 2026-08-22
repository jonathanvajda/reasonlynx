// app/render-nlp-qa.js
// @ts-check

import { escapeHtml } from './shared.js';
import { filterNlpQaCheckedRowsForDisplay, NLP_QA_CHECKED_FIELD_NAMES } from './nlp-qa-ontology.js';

/** @typedef {import('./nlp-qa-ontology.js').NlpQaCheckedOntologyRow} NlpQaCheckedOntologyRow */
/** @typedef {import('./nlp-qa-model.js').NlpQaIssue} NlpQaIssue */
/** @typedef {import('./nlp-qa-model.js').NlpQaCheckModes} NlpQaCheckModes */

/**
 * Returns a human-readable status marker.
 *
 * @param {string} status
 * @returns {string}
 */
function deriveNlpQaStatusDisplayText(status) {
  if (status === 'fail') {
    return 'X';
  }
  if (status === 'warning') {
    return '!';
  }
  return 'OK';
}

/**
 * Renders a text value with issue spans.
 *
 * @param {string} text
 * @param {NlpQaIssue[]} issues
 * @returns {string}
 */
export function renderNlpQaHighlightedText(text, issues) {
  const source = String(text || '');
  const orderedIssues = issues
    .filter((issue) => Number.isInteger(issue.start) && Number.isInteger(issue.end))
    .filter((issue) => issue.start >= 0 && issue.end > issue.start && issue.end <= source.length)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  let cursor = 0;
  let html = '';
  for (const issue of orderedIssues) {
    if (issue.start < cursor) {
      continue;
    }
    html += escapeHtml(source.slice(cursor, issue.start));
    const className = issue.category === 'spelling' ? 'ocd-nlpqa-mark-error' : 'ocd-nlpqa-mark-warning';
    html += `<mark class="${className}" title="${escapeHtml(issue.message)}">${escapeHtml(source.slice(issue.start, issue.end))}</mark>`;
    cursor = issue.end;
  }
  html += escapeHtml(source.slice(cursor));
  return html || '<span class="ocd-muted">Not asserted</span>';
}

/**
 * Renders the single-field scratch checker.
 *
 * @param {{ text: string, issues: NlpQaIssue[], status: string, checkModes: NlpQaCheckModes }} state
 * @param {HTMLElement | null} container
 * @returns {void}
 */
export function renderNlpQaScratchChecker(state, container) {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="ocd-section ocd-card">
      <div class="ocd-toolbar">
        <div class="ocd-toolbar-left ocd-nlpqa-toolbar-wide">
          <h2 class="ocd-title">Text QA Scratch Pad</h2>
          <textarea id="nlpQaScratchText" class="ocd-input ocd-textarea ocd-nlpqa-scratch-textarea">${escapeHtml(state.text)}</textarea>
        </div>
        <div class="ocd-toolbar-right">
          ${renderNlpQaCheckModeControls('scratch', state.checkModes)}
          <button id="checkScratchTextBtn" class="ocd-btn ocd-btn-primary" type="button">Check text</button>
          <span class="ocd-badge ${state.status === 'fail' ? 'ocd-badge-danger' : state.status === 'warning' ? 'ocd-badge-warn' : 'ocd-badge-success'}">${escapeHtml(deriveNlpQaStatusDisplayText(state.status))}</span>
        </div>
      </div>
      <div class="ocd-nlpqa-preview">${renderNlpQaHighlightedText(state.text, state.issues)}</div>
      ${renderNlpQaIssueList(state.issues)}
    </div>
  `;
}

/**
 * Renders the checked ontology table.
 *
 * @param {NlpQaCheckedOntologyRow[]} checkedRows
 * @param {'all' | 'spelling' | 'grammar' | 'clean' | 'modified'} filter
 * @param {NlpQaCheckModes} checkModes
 * @param {HTMLElement | null} container
 * @returns {void}
 */
export function renderNlpQaOntologyTable(checkedRows, filter, checkModes, container) {
  if (!container) {
    return;
  }

  const visibleRows = filterNlpQaCheckedRowsForDisplay(checkedRows, filter);
  if (!checkedRows.length) {
    container.innerHTML = '<div class="ocd-section ocd-card"><p class="ocd-muted">Load an ontology file to inspect annotation text.</p></div>';
    return;
  }

  let html = '<div class="ocd-section ocd-card ocd-nlpqa-table-shell">';
  html += '<div class="ocd-toolbar"><div class="ocd-toolbar-left">';
  html += `<h2 class="ocd-title">Annotation QA</h2><p class="ocd-muted">${escapeHtml(visibleRows.length)} of ${escapeHtml(checkedRows.length)} row(s) shown</p>`;
  html += '</div><div class="ocd-toolbar-right">';
  html += renderNlpQaCheckModeControls('ontology', checkModes);
  html += '<label class="ocd-label" for="nlpQaFilter">Filter</label>';
  html += '<select id="nlpQaFilter" class="ocd-select">';
  for (const option of [
    ['all', 'All'],
    ['spelling', 'Spelling errors'],
    ['grammar', 'Grammar warnings'],
    ['clean', 'Clean'],
    ['modified', 'Modified']
  ]) {
    html += `<option value="${option[0]}"${filter === option[0] ? ' selected' : ''}>${option[1]}</option>`;
  }
  html += '</select></div></div>';

  html += '<table class="ocd-table ocd-table-wide ocd-nlpqa-table"><thead class="ocd-table-head"><tr>';
  html += '<th class="ocd-table-th">Status</th><th class="ocd-table-th">Resource</th>';
  for (const fieldName of NLP_QA_CHECKED_FIELD_NAMES) {
    html += `<th class="ocd-table-th">${escapeHtml(fieldName)}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const checkedRow of visibleRows) {
    const row = checkedRow.row;
    html += '<tr class="ocd-table-tr">';
    html += `<td class="ocd-table-td"><span class="ocd-badge ${checkedRow.status === 'fail' ? 'ocd-badge-danger' : checkedRow.status === 'warning' ? 'ocd-badge-warn' : 'ocd-badge-success'}">${escapeHtml(deriveNlpQaStatusDisplayText(checkedRow.status))}</span></td>`;
    html += `<td class="ocd-table-td"><div class="ocd-mono ocd-resource-iri">${escapeHtml(row.iri)}</div>${row.modified ? '<span class="ocd-chip">modified</span>' : ''}</td>`;
    for (const fieldName of NLP_QA_CHECKED_FIELD_NAMES) {
      const value = String(row[/** @type {keyof typeof row} */ (fieldName)] || '');
      const fieldIssues = checkedRow.issues.filter((issue) => issue.fieldName === fieldName);
      html += '<td class="ocd-table-td ocd-nlpqa-field-cell">';
      html += `<textarea class="ocd-input ocd-textarea ocd-nlpqa-field-editor" data-nlpqa-iri="${escapeHtml(row.iri)}" data-nlpqa-field="${escapeHtml(fieldName)}">${escapeHtml(value)}</textarea>`;
      html += `<div class="ocd-nlpqa-preview">${renderNlpQaHighlightedText(value, fieldIssues)}</div>`;
      html += renderNlpQaIssueList(fieldIssues);
      html += '</td>';
    }
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

/**
 * Renders checkbox controls for enabled checker categories.
 *
 * @param {'scratch' | 'ontology'} scope
 * @param {NlpQaCheckModes} checkModes
 * @returns {string}
 */
export function renderNlpQaCheckModeControls(scope, checkModes) {
  const controls = [
    ['spelling', 'Spelling'],
    ['grammar', 'Grammar'],
    ['aristotelian', 'Aristotelian form']
  ];
  let html = `<fieldset class="ocd-nlpqa-mode-controls" aria-label="${escapeHtml(scope)} checks">`;
  for (const [mode, label] of controls) {
    html += '<label class="ocd-checkbox">';
    html += `<input type="checkbox" data-nlpqa-check-scope="${escapeHtml(scope)}" data-nlpqa-check-mode="${escapeHtml(mode)}"${checkModes[/** @type {keyof NlpQaCheckModes} */ (mode)] ? ' checked' : ''} />`;
    html += `<span>${escapeHtml(label)}</span>`;
    html += '</label>';
  }
  html += '</fieldset>';
  return html;
}

/**
 * Renders a compact issue list.
 *
 * @param {NlpQaIssue[]} issues
 * @returns {string}
 */
export function renderNlpQaIssueList(issues) {
  if (!issues.length) {
    return '<p class="ocd-table-meta">No issues found.</p>';
  }
  let html = '<ul class="ocd-nlpqa-issue-list">';
  for (const issue of issues) {
    html += `<li><span class="ocd-mono">${escapeHtml(issue.code)}</span> ${escapeHtml(issue.message)} <span class="ocd-muted">${escapeHtml(issue.text)}</span></li>`;
  }
  html += '</ul>';
  return html;
}
