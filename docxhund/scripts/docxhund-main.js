import { normalizeBaseIri } from './utils.js';
import { loadDocxParts } from './docx-reader.js';
import { parseDocumentParts } from './parser.js';
import { createPartsDataset, serializePartsToTurtle } from './rdf-writer.js';
import { captureRdfSelection, projectRdfPartsOntoPreview, renderDocument } from './document-renderer.js';
import { renderFidelityPreview } from './fidelity-preview.js';
import { DocxHundProjectStore } from './project-store.js';
import { ANNOTATION_TYPES, createAnnotationQuads } from './annotation-model.js';
import { createDocumentParsingProvenance } from './provenance-model.js';
import { buildKnowledgeLookupIndex, searchKnowledgeLookup } from './knowledge-lookup.js';
import {
  appendLog, clearLog, getUiElements, renderDocumentOptions, renderKnowledgeBases,
  renderOutline, renderPartsTable, renderProjectOptions, renderSummary
} from './ui.js';
import { downloadTextFile } from '../../packages/browser-file-io/src/index.js';
import { getSupportedMimeTypeForFilename } from '../../packages/format-registry/src/mime-registry.js';
import { parseRdfTextWithAdapters } from '../../packages/rdf-io/src/index.js';
import { createRdfDataset, datasetToQuads, serializeRdfDatasetWithAdapters } from '../../packages/rdf-io/src/index.js';
import { convertQuadRowsToRdfJsQuads } from '../../packages/indexeddb-data-management/src/index.js';
import { namespacePrefixMapFromRegistry } from '../../packages/namespace-registry/src/namespace-registry.js';
import { selectPrefixesUsedByRdfTerms } from '../../packages/namespace-registry/src/rdf-serialization-prefixes.js';

const ui = getUiElements();
const workspace = new DocxHundProjectStore();
let latestOutput = '';
let latestFilename = 'document.ttl';
let latestDocxSource = null;
let currentDocumentArtifactId = null;
let currentSelection = null;
let currentDocumentParts = [];
let currentDocumentProvenance = null;
let knowledgeLookupEntries = [];

/**
 * Rebuild the visible/downloadable Turtle from the current document dataset
 * plus the active project's persisted manual-annotation graph.
 * @returns {Promise<number>} Number of included annotation quads.
 */
async function refreshVisibleRdf() {
  const annotationRows = await workspace.listAnnotationQuadRows();
  const annotationQuads = convertQuadRowsToRdfJsQuads(annotationRows, globalThis.N3.DataFactory);
  const provenanceQuads = currentDocumentProvenance
    ? createDocumentParsingProvenance(currentDocumentProvenance).quads
    : [];
  const documentQuads = datasetToQuads(createPartsDataset(currentDocumentParts, provenanceQuads));
  const combined = createRdfDataset([...documentQuads, ...annotationQuads]);
  const prefixes = selectPrefixesUsedByRdfTerms(namespacePrefixMapFromRegistry(), combined);
  const serialized = await serializeRdfDatasetWithAdapters(combined, {
    format: 'text/turtle',
    prefixes,
    runtime: { N3: globalThis.N3 }
  });
  latestOutput = serialized.text;
  ui.outputArea.value = latestOutput;
  ui.downloadBtn.disabled = !latestOutput;
  return annotationQuads.length;
}

/** @returns {object} */
function getOptionsFromUi() {
  normalizeExtractionControls();
  return {
    baseIri: normalizeBaseIri(ui.baseIriInput.value),
    includeParagraphs: ui.includeParagraphs.checked,
    includeSections: ui.includeSections.checked,
    includeSentences: ui.includeSentences.checked,
    includeWords: ui.includeWords.checked
  };
}

/** Keep hierarchical extraction choices internally consistent. */
function normalizeExtractionControls() {
  if (ui.includeWords.checked) ui.includeSentences.checked = true;
  if (ui.includeSentences.checked) ui.includeParagraphs.checked = true;
}

/** @param {File} file @returns {string} */
function makeOutputFilename(file) {
  return (file?.name?.replace(/\.docx$/i, '') || 'document') + '.ttl';
}

/** @param {object} snapshot @returns {Promise<void>} */
async function renderWorkspace(snapshot) {
  renderProjectOptions(ui.projectSelect, snapshot.projects, snapshot.activeProjectId);
  renderDocumentOptions(ui.documentSelect, snapshot.artifacts);
  renderKnowledgeBases(ui.knowledgeBaseList, snapshot.datasets);
  ui.persistenceStatus.textContent = 'Saved locally';
  const rows = await workspace.listWorkspaceQuadRows();
  const quads = convertQuadRowsToRdfJsQuads(rows, globalThis.N3.DataFactory);
  knowledgeLookupEntries = buildKnowledgeLookupIndex(quads);
  renderResourceSuggestions();
}

/** @param {object} result @param {string} title @returns {Promise<void>} */
async function showDocument(result, title) {
  ui.documentTitle.textContent = title || 'Document';
  renderSummary(ui.previewSummary, result);
  renderPartsTable(ui.partsTableWrap, result.parts);
  renderOutline(ui.documentOutline, result.parts);
  if (!latestDocxSource) {
    renderDocument(ui.documentViewer, result.parts);
    ui.previewModeNote.textContent = 'Document view linked to the RDF document model.';
    return;
  }
  ui.documentViewer.textContent = 'Rendering document…';
  try {
    await renderFidelityPreview(latestDocxSource, ui.documentViewer, ui.wordPreviewStyles);
    const projection = projectRdfPartsOntoPreview(ui.documentViewer, result.parts);
    ui.previewModeNote.textContent =
      'Word-like presentation with ' + projection.matched + ' of ' + projection.total +
      ' RDF document parts linked for selection and annotation.';
    if (projection.unmatchedIris.length) {
      appendLog(ui.logArea, 'Projection warning: ' + projection.unmatchedIris.length + ' document parts were not aligned to the preview.');
    }
  } catch (error) {
    renderDocument(ui.documentViewer, result.parts);
    ui.previewModeNote.textContent = 'Simplified document presentation linked to the RDF model.';
    appendLog(ui.logArea, 'Word-like presentation unavailable; using the semantic fallback: ' + error.message);
  }
}

/** @returns {Promise<void>} */
async function handleProcess() {
  clearLog(ui.logArea);
  ui.outputArea.value = '';
  ui.downloadBtn.disabled = true;
  ui.previewSummary.textContent = 'Processing…';
  const file = ui.fileInput.files?.[0];
  if (!file) {
    appendLog(ui.logArea, 'Error: No DOCX file selected.');
    ui.previewSummary.textContent = 'No document processed yet.';
    return;
  }
  try {
    ui.persistenceStatus.textContent = 'Processing…';
    const options = getOptionsFromUi();
    appendLog(ui.logArea, 'Loading DOCX: ' + file.name);
    const docxParts = await loadDocxParts(file);
    const result = parseDocumentParts(docxParts, options);
    const documentIri = result.parts.find((part) => part.partType === 'document')?.iri;
    if (!documentIri) throw new Error('The parsed document has no document resource.');
    const parsing = createDocumentParsingProvenance({ documentIri, fileName: file.name });
    result.provenance = {
      documentIri,
      fileName: file.name,
      actIri: parsing.actIri,
      sourceIri: parsing.sourceIri,
      occurredAt: parsing.occurredAt
    };
    const turtle = await serializePartsToTurtle(result.parts, parsing.quads);
    const documentArtifact = await workspace.storeDocument(file, result, turtle);
    latestOutput = turtle;
    latestFilename = makeOutputFilename(file);
    latestDocxSource = file;
    currentDocumentArtifactId = documentArtifact.artifactId;
    currentDocumentParts = result.parts;
    currentDocumentProvenance = result.provenance;
    await refreshVisibleRdf();
    await showDocument(result, file.name);
    renderWorkspace(await workspace.snapshot());
    appendLog(ui.logArea, 'Saved ' + result.parts.length + ' extracted parts to the active project.');
  } catch (error) {
    appendLog(ui.logArea, 'Error: ' + error.message);
    ui.previewSummary.textContent = 'Processing failed.';
    ui.persistenceStatus.textContent = 'Save failed';
    console.error(error);
  }
}

/** @returns {Promise<void>} */
async function handleKnowledgeImport() {
  const file = ui.knowledgeFile.files?.[0];
  if (!file) {
    appendLog(ui.logArea, 'Error: Select an RDF knowledge-base file.');
    return;
  }
  try {
    ui.persistenceStatus.textContent = 'Importing knowledge base…';
    const descriptor = getSupportedMimeTypeForFilename(file.name);
    if (!descriptor.ok || descriptor.value.category !== 'rdf') throw new Error('Unsupported RDF file: ' + file.name);
    const parsed = await parseRdfTextWithAdapters(await file.text(), {
      mimeType: descriptor.value.mimeType,
      baseIri: ui.baseIriInput.value,
      runtime: { N3: globalThis.N3, jsonld: globalThis.jsonld, $rdf: globalThis.$rdf }
    });
    const stored = await workspace.storeKnowledgeBase(file, parsed);
    renderWorkspace(await workspace.snapshot());
    appendLog(ui.logArea, 'Imported ' + stored.quadCount + ' quads from ' + file.name + '.');
  } catch (error) {
    ui.persistenceStatus.textContent = 'Import failed';
    appendLog(ui.logArea, 'Error: ' + error.message);
    console.error(error);
  }
}

/** @param {string} artifactId @returns {Promise<void>} */
async function openStoredDocument(artifactId) {
  if (!artifactId) return;
  const artifact = await workspace.getDocument(artifactId);
  if (!artifact?.payload?.document) return;
  latestOutput = artifact.payload.turtle || '';
  latestFilename = artifact.label.replace(/\.docx$/i, '') + '.ttl';
  latestDocxSource = artifact.payload.source;
  currentDocumentArtifactId = artifact.artifactId;
  currentDocumentParts = artifact.payload.document.parts;
  currentDocumentProvenance = artifact.payload.document.provenance || null;
  await refreshVisibleRdf();
  await showDocument(artifact.payload.document, artifact.label);
}

ui.processBtn.addEventListener('click', handleProcess);
ui.importKnowledgeBtn.addEventListener('click', handleKnowledgeImport);
ui.downloadBtn.addEventListener('click', () => latestOutput && downloadTextFile(latestFilename, latestOutput, { mimeType: 'text/turtle' }));
ui.documentSelect.addEventListener('change', () => openStoredDocument(ui.documentSelect.value));
ui.projectSelect.addEventListener('change', async () => renderWorkspace(await workspace.selectProject(ui.projectSelect.value)));
ui.newProjectBtn.addEventListener('click', async () => {
  const label = globalThis.prompt('Project name');
  if (label?.trim()) renderWorkspace(await workspace.createProject(label));
});
ui.documentViewer.addEventListener('mouseup', () => {
  currentSelection = captureRdfSelection(ui.documentViewer);
  ui.selectedPassage.value = currentSelection?.exact || '';
  ui.selectedPassage.dataset.rdfResource = currentSelection?.partIri || '';
  ui.commitAnnotationBtn.disabled = !currentSelection;
  ui.annotationStatus.textContent = currentSelection
    ? 'Ready to commit an RDF annotation.'
    : 'Select text within one document paragraph.';
});

/** Update fields required by the selected semantic assertion template. */
function updateAnnotationFields() {
  const type = ui.annotationType.value;
  const isDeontic = [
    ANNOTATION_TYPES.permission,
    ANNOTATION_TYPES.prohibition,
    ANNOTATION_TYPES.obligation
  ].includes(type);
  ui.processResourceFields.hidden = !isDeontic;
  ui.resourceIriLabel.textContent = isDeontic
    ? 'Process Regulation IRI'
    : type === ANNOTATION_TYPES.classMention
      ? 'Class IRI'
      : type === ANNOTATION_TYPES.definition
        ? 'Defined resource IRI'
      : 'About resource IRI';
  renderResourceSuggestions();
}

/** @returns {'class'|'individual'|'resource'} */
function currentLookupKind() {
  if (ui.annotationType.value === ANNOTATION_TYPES.classMention) return 'class';
  if ([ANNOTATION_TYPES.about, ANNOTATION_TYPES.entityMention].includes(ui.annotationType.value)) return 'individual';
  return 'resource';
}

/** Refresh native look-ahead options from the active workspace label index. */
function renderResourceSuggestions() {
  const matches = searchKnowledgeLookup(
    knowledgeLookupEntries,
    ui.aboutResource.value,
    currentLookupKind()
  );
  ui.resourceSuggestions.replaceChildren(...matches.map((entry) => {
    const option = document.createElement('option');
    option.value = entry.iri;
    option.label = entry.label + ' — ' + entry.kind;
    return option;
  }));
  const selected = knowledgeLookupEntries.find((entry) => entry.iri === ui.aboutResource.value.trim());
  ui.resourceLookupHint.textContent = selected
    ? selected.label + ' — ' + selected.kind + ' — ' + selected.iri
    : knowledgeLookupEntries.length
      ? 'Type a label or IRI; choose a suggestion to insert its full IRI.'
      : 'Import a knowledge base to search its labels.';
}

/** Resolve an exact, unambiguous label as a convenience if no suggestion was clicked. @returns {string} */
function resolveResourceInput() {
  const value = ui.aboutResource.value.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  const matches = searchKnowledgeLookup(knowledgeLookupEntries, value, currentLookupKind(), 50)
    .filter((entry) => entry.label.toLocaleLowerCase() === value.toLocaleLowerCase() ||
      entry.aliases.some((alias) => alias.toLocaleLowerCase() === value.toLocaleLowerCase()));
  return matches.length === 1 ? matches[0].iri : value;
}

/** Mark the committed selection in the disposable presentation DOM. @param {Range} range @param {string} annotationIri */
function markCommittedSelection(range, annotationIri) {
  const mark = document.createElement('mark');
  mark.className = 'manual-annotation';
  mark.dataset.annotationResource = annotationIri;
  mark.append(range.extractContents());
  range.insertNode(mark);
  globalThis.getSelection?.()?.removeAllRanges();
}

/** Commit the current selection and semantic assertion to the project RDF graph. */
async function handleAnnotationCommit() {
  if (!currentSelection) {
    ui.annotationStatus.textContent = 'Select text within one document paragraph first.';
    return;
  }
  ui.commitAnnotationBtn.disabled = true;
  ui.annotationStatus.textContent = 'Committing annotation…';
  try {
    const command = createAnnotationQuads({
      annotationType: ui.annotationType.value,
      selection: currentSelection,
      resourceIri: resolveResourceInput(),
      processIri: ui.processResource.value
    });
    const stored = await workspace.storeAnnotationQuads(command.quads, {
      documentArtifactId: currentDocumentArtifactId,
      annotationIri: command.annotationIri
    });
    const visibleAnnotationQuadCount = await refreshVisibleRdf();
    markCommittedSelection(currentSelection.range, command.annotationIri);
    appendLog(
      ui.logArea,
      'Committed annotation ' + command.annotationIri + ' (' + stored.count +
      ' quads). RDF panel refreshed with ' + visibleAnnotationQuadCount + ' persisted annotation quads.'
    );
    ui.annotationStatus.textContent = 'Annotation committed and shown in the RDF panel: ' + command.annotationIri;
    currentSelection = null;
  } catch (error) {
    ui.commitAnnotationBtn.disabled = false;
    ui.annotationStatus.textContent = 'Commit failed: ' + error.message;
    appendLog(ui.logArea, 'Annotation error: ' + error.message);
    console.error(error);
  }
}

ui.annotationType.addEventListener('change', updateAnnotationFields);
ui.includeParagraphs.addEventListener('change', () => {
  if (!ui.includeParagraphs.checked) {
    ui.includeSentences.checked = false;
    ui.includeWords.checked = false;
  }
});
ui.includeSentences.addEventListener('change', () => {
  if (ui.includeSentences.checked) ui.includeParagraphs.checked = true;
  else ui.includeWords.checked = false;
});
ui.includeWords.addEventListener('change', normalizeExtractionControls);
ui.aboutResource.addEventListener('input', renderResourceSuggestions);
ui.commitAnnotationBtn.addEventListener('click', handleAnnotationCommit);
updateAnnotationFields();
workspace.initialize()
  .then(renderWorkspace)
  .catch((error) => {
    ui.persistenceStatus.textContent = 'Persistence unavailable';
    appendLog(ui.logArea, 'Error opening workspace: ' + error.message);
  });
