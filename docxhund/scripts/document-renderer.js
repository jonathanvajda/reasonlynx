/**
 * Select the block-level parts used by the safe RDF-backed reader.
 * @param {object[]} parts
 * @returns {object[]}
 */
export function selectRenderableParts(parts) {
  return (parts || []).filter((part) => part.partType === 'paragraph' && part.textValue);
}

/**
 * Map extracted style metadata to a safe HTML block tag.
 * @param {object} part
 * @returns {string}
 */
export function blockTagForPart(part) {
  const level = Number(part?.headingLevel);
  return Number.isInteger(level) && level >= 1 && level <= 6 ? `h${level}` : 'p';
}

/** @param {string} value @returns {string} */
export function normalizeDocumentText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Align RDF paragraph resources with docx-preview paragraph elements using
 * canonicalized text and source order. This enriches presentation DOM with
 * pointers; it does not make that DOM authoritative.
 *
 * @param {HTMLElement} container
 * @param {object[]} parts
 * @returns {{matched: number, total: number, unmatchedIris: string[]}}
 */
export function projectRdfPartsOntoPreview(container, parts) {
  const rdfParts = selectRenderableParts(parts);
  const candidates = Array.from(container.querySelectorAll('p'))
    .map((element) => ({ element, text: normalizeDocumentText(element.textContent), used: false }))
    .filter((candidate) => candidate.text);
  let cursor = 0;
  const unmatchedIris = [];
  for (const part of rdfParts) {
    const text = normalizeDocumentText(part.textValue);
    let candidateIndex = candidates.findIndex((candidate, index) =>
      index >= cursor && !candidate.used && candidate.text === text
    );
    if (candidateIndex < 0) {
      candidateIndex = candidates.findIndex((candidate) => !candidate.used && candidate.text === text);
    }
    if (candidateIndex < 0) {
      unmatchedIris.push(part.iri);
      continue;
    }
    const candidate = candidates[candidateIndex];
    candidate.used = true;
    cursor = candidateIndex + 1;
    candidate.element.dataset.rdfResource = part.iri;
    candidate.element.id = `rdf-part-${encodeURIComponent(part.iri)}`;
    candidate.element.classList.add('rdf-projected-part');
  }
  return { matched: rdfParts.length - unmatchedIris.length, total: rdfParts.length, unmatchedIris };
}

/**
 * Render a document from its normalized RDF/memory projection. Text is assigned
 * through textContent; no source markup enters the page.
 * @param {HTMLElement} container
 * @param {object[]} parts
 */
export function renderDocument(container, parts) {
  container.replaceChildren();
  const blocks = selectRenderableParts(parts);
  if (!blocks.length) {
    const empty = document.createElement('p');
    empty.className = 'app-muted';
    empty.textContent = 'No renderable document content.';
    container.append(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  blocks.forEach((part) => {
    const block = document.createElement(blockTagForPart(part));
    block.dataset.rdfResource = part.iri;
    block.id = `rdf-part-${encodeURIComponent(part.iri)}`;
    block.textContent = part.textValue;
    fragment.append(block);
  });
  container.append(fragment);
}

/** @param {HTMLElement} container @returns {string|null} */
export function getSelectedRdfResource(container) {
  const selection = globalThis.getSelection?.();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const node = selection.anchorNode?.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentElement : selection.anchorNode;
  const block = node?.closest?.('[data-rdf-resource]');
  return block && container.contains(block) ? block.dataset.rdfResource : null;
}

/**
 * Capture a single RDF-backed block selection as durable canonical offsets.
 * @param {HTMLElement} container
 * @param {Selection} [selection=globalThis.getSelection()]
 * @returns {{partIri: string, exact: string, prefix: string, suffix: string, start: number, end: number, range: Range}|null}
 */
export function captureRdfSelection(container, selection = globalThis.getSelection?.()) {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
  const range = selection.getRangeAt(0);
  const startNode = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer;
  const endNode = range.endContainer.nodeType === Node.TEXT_NODE ? range.endContainer.parentElement : range.endContainer;
  const startBlock = startNode?.closest?.('[data-rdf-resource]');
  const endBlock = endNode?.closest?.('[data-rdf-resource]');
  if (!startBlock || startBlock !== endBlock || !container.contains(startBlock)) return null;
  const before = range.cloneRange();
  before.selectNodeContents(startBlock);
  before.setEnd(range.startContainer, range.startOffset);
  const rawBefore = before.toString();
  const rawExact = range.toString();
  const exact = normalizeDocumentText(rawExact);
  const start = normalizeDocumentText(rawBefore + rawExact).length - exact.length;
  const canonical = normalizeDocumentText(startBlock.textContent);
  const end = start + exact.length;
  return {
    partIri: startBlock.dataset.rdfResource,
    exact,
    prefix: canonical.slice(Math.max(0, start - 32), start),
    suffix: canonical.slice(end, end + 32),
    start,
    end,
    range: range.cloneRange()
  };
}
