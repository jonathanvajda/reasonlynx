// docxhund/scripts/ui.js

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
    partsTableWrap: document.getElementById('partsTableWrap'),
    projectSelect: document.getElementById('projectSelect'),
    newProjectBtn: document.getElementById('newProjectBtn'),
    persistenceStatus: document.getElementById('persistenceStatus'),
    knowledgeFile: document.getElementById('knowledgeFile'),
    importKnowledgeBtn: document.getElementById('importKnowledgeBtn'),
    knowledgeBaseList: document.getElementById('knowledgeBaseList'),
    documentSelect: document.getElementById('documentSelect'),
    documentOutline: document.getElementById('documentOutline'),
    documentViewer: document.getElementById('documentViewer'),
    documentTitle: document.getElementById('documentTitle'),
    selectedPassage: document.getElementById('selectedPassage'),
    commitAnnotationBtn: document.getElementById('commitAnnotationBtn'),
    annotationType: document.getElementById('annotationType'),
    aboutResource: document.getElementById('aboutResource'),
    resourceSuggestions: document.getElementById('resourceSuggestions'),
    resourceLookupHint: document.getElementById('resourceLookupHint'),
    resourceIriLabel: document.getElementById('resourceIriLabel'),
    processResource: document.getElementById('processResource'),
    processResourceFields: document.getElementById('processResourceFields'),
    annotationStatus: document.getElementById('annotationStatus'),
    wordPreviewStyles: document.getElementById('wordPreviewStyles'),
    previewModeNote: document.getElementById('previewModeNote')
  };
}

/** @param {HTMLSelectElement} target @param {object[]} projects @param {string} activeId */
export function renderProjectOptions(target, projects, activeId) {
  target.replaceChildren(...projects.map((project) => {
    const option = document.createElement('option');
    option.value = project.projectId;
    option.textContent = project.label;
    option.selected = project.projectId === activeId;
    return option;
  }));
}

/** @param {HTMLSelectElement} target @param {object[]} artifacts */
export function renderDocumentOptions(target, artifacts) {
  const documents = artifacts.filter((item) => item.artifactKind === 'document');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = documents.length ? 'Choose a document' : 'No documents';
  target.replaceChildren(placeholder, ...documents.map((item) => {
    const option = document.createElement('option');
    option.value = item.artifactId;
    option.textContent = item.label;
    return option;
  }));
}

/** @param {HTMLElement} target @param {object[]} datasets */
export function renderKnowledgeBases(target, datasets) {
  target.replaceChildren();
  if (!datasets.length) {
    const empty = document.createElement('li');
    empty.className = 'app-muted';
    empty.textContent = 'None loaded';
    target.append(empty);
    return;
  }
  datasets.forEach((dataset) => {
    const item = document.createElement('li');
    item.textContent = `${dataset.label} (${dataset.metadata?.quadCount || 0} quads)`;
    target.append(item);
  });
}

/** @param {HTMLElement} target @param {object[]} parts */
export function renderOutline(target, parts) {
  const headings = parts.filter((part) => part.partType === 'paragraph' && part.headingLevel != null);
  target.replaceChildren();
  if (!headings.length) {
    const empty = document.createElement('span');
    empty.className = 'app-muted';
    empty.textContent = 'No headings detected.';
    target.append(empty);
    return;
  }
  headings.forEach((part) => {
    const link = document.createElement('a');
    link.href = `#rdf-part-${encodeURIComponent(part.iri)}`;
    link.style.paddingLeft = `${Math.max(0, Number(part.headingLevel) - 1)}rem`;
    link.textContent = part.textValue;
    target.append(link);
  });
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
    'paragraphs: <span class="app-code-inline">' + escapeHtml(String(result.paragraphCount)) + '</span>, ' +
    'sentences: <span class="app-code-inline">' + escapeHtml(String(result.sentenceCount || 0)) + '</span>, ' +
    'words: <span class="app-code-inline">' + escapeHtml(String(result.wordCount || 0)) + '</span>' +
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

