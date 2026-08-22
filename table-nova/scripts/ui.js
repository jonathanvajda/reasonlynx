// docs/scripts/ui.js

import { escapeHtml } from './utils.js';

/**
 * DOM helpers and rendering.
 */

export function getUiElements() {
  return {
    fileInput: document.getElementById('docxFile'),
    baseIriInput: document.getElementById('baseIri'),
    includeParagraphs: document.getElementById('includeParagraphs'),
    includeSections: document.getElementById('includeSections'),
    includeSentences: document.getElementById('includeSentences'),
    includeWords: document.getElementById('includeWords'),
    formatSelect: document.getElementById('formatSelect'),
    processBtn: document.getElementById('processBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    outputArea: document.getElementById('outputArea'),
    logArea: document.getElementById('logArea'),
    previewSummary: document.getElementById('previewSummary'),
    partsTableWrap: document.getElementById('partsTableWrap')
  };
}

/**
 * Append a log line.
 * @param {HTMLElement} logArea
 * @param {string} message
 */
export function appendLog(logArea, message) {
  logArea.textContent += message + '\n';
}

/**
 * Clear log display.
 * @param {HTMLElement} logArea
 */
export function clearLog(logArea) {
  logArea.textContent = '';
}

/**
 * Render summary text.
 * @param {HTMLElement} target
 * @param {object} result
 */
export function renderSummary(target, result) {
  target.innerHTML =
    'Processed <span class="app-code-inline">' + escapeHtml(String(result.parts.length)) + '</span> parts ' +
    '(' +
    'sections: <span class="app-code-inline">' + escapeHtml(String(result.sectionCount)) + '</span>, ' +
    'paragraphs: <span class="app-code-inline">' + escapeHtml(String(result.paragraphCount)) + '</span>' +
    ').';
}

/**
 * Render a simple parts preview table.
 * @param {HTMLElement} target
 * @param {object[]} parts
 */
export function renderPartsTable(target, parts) {
  if (!parts.length) {
    target.innerHTML = '<p class="app-muted">No parts extracted.</p>';
    return;
  }

  var rows = parts.map(function (part) {
    return (
      '<tr>' +
        '<td>' + escapeHtml(part.partType) + '</td>' +
        '<td>' + escapeHtml(part.label || '') + '</td>' +
        '<td>' + escapeHtml(part.textValue || '') + '</td>' +
        '<td>' + escapeHtml(part.styleName || '') + '</td>' +
        '<td>' + escapeHtml(String(part.siblingIndex || '')) + '</td>' +
      '</tr>'
    );
  }).join('');

  target.innerHTML =
    '<table class="app-parts-table">' +
      '<thead>' +
        '<tr>' +
          '<th>Part Type</th>' +
          '<th>Label</th>' +
          '<th>Text Value</th>' +
          '<th>Style</th>' +
          '<th>Sibling Index</th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';
}

