// docs/scripts/main.js

import { normalizeBaseIri } from './utils.js';
import { loadDocxParts } from './docx-reader.js';
import { parseDocumentParts } from './parser.js';
import { serializePartsToTurtle } from './rdf-writer.js';
import {
  appendLog,
  clearLog,
  getUiElements,
  renderPartsTable,
  renderSummary
} from './ui.js';
import { downloadTextFile } from '../../packages/browser-file-io/src/index.js';

var ui = getUiElements();
var latestOutput = '';
var latestFilename = 'document.ttl';

/**
 * Read current UI options into a config object.
 * @returns {object}
 */
function getOptionsFromUi() {
  return {
    baseIri: normalizeBaseIri(ui.baseIriInput.value),
    includeParagraphs: ui.includeParagraphs.checked,
    includeSections: ui.includeSections.checked,
    includeSentences: ui.includeSentences.checked,
    includeWords: ui.includeWords.checked
  };
}

/**
 * Build a safe download filename from the uploaded DOCX name.
 * @param {File} file
 * @returns {string}
 */
function makeOutputFilename(file) {
  var base = file && file.name ? file.name.replace(/\.docx$/i, '') : 'document';
  return base + '.ttl';
}

/**
 * Main processing handler.
 * @returns {Promise<void>}
 */
async function handleProcess() {
  clearLog(ui.logArea);
  ui.outputArea.value = '';
  ui.downloadBtn.disabled = true;
  ui.partsTableWrap.innerHTML = '';
  ui.previewSummary.textContent = 'Processing...';

  var file = ui.fileInput.files && ui.fileInput.files[0];
  if (!file) {
    appendLog(ui.logArea, 'Error: No DOCX file selected.');
    ui.previewSummary.textContent = 'No document processed yet.';
    return;
  }

  try {
    var options = getOptionsFromUi();
    appendLog(ui.logArea, 'Loading DOCX: ' + file.name);
    appendLog(ui.logArea, 'Base IRI: ' + options.baseIri);

    var docxParts = await loadDocxParts(file);
    appendLog(ui.logArea, 'Loaded DOCX package and parsed XML parts.');

    var result = parseDocumentParts(docxParts, options);
    appendLog(ui.logArea, 'Extracted parts: ' + result.parts.length);

    var turtle = await serializePartsToTurtle(result.parts);
    appendLog(ui.logArea, 'Serialized Turtle successfully.');

    ui.outputArea.value = turtle;
    renderSummary(ui.previewSummary, result);
    renderPartsTable(ui.partsTableWrap, result.parts);

    latestOutput = turtle;
    latestFilename = makeOutputFilename(file);
    ui.downloadBtn.disabled = false;
  } catch (error) {
    appendLog(ui.logArea, 'Error: ' + error.message);
    ui.previewSummary.textContent = 'Processing failed.';
    console.error(error);
  }
}

/**
 * Download handler.
 */
function handleDownload() {
  if (!latestOutput) {
    return;
  }
  downloadTextFile(latestFilename, latestOutput, { mimeType: 'text/turtle' });
}

ui.processBtn.addEventListener('click', function () {
  handleProcess();
});

ui.downloadBtn.addEventListener('click', function () {
  handleDownload();
});
