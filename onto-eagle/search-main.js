/**
 * docs/app/search-main.js
 * DOM + orchestration for the Ontology Lookup app.
 *
 * Responsibilities (side-effects):
 * - Fetch consolidated dataset (docs/data/graph.jsonld)
 * - Register service worker (docs/sw.js)
 * - Hydrate/load IndexedDB caches (settings, docs, index) [Stage E minimal]
 * - Handle form events and render results/details
 *
 * Pure logic lives in:
 * - normalize.js
 * - rdf_extract.js
 * - search.js
 * - types.js
 */

import { extractDocumentsFromJsonLd, mapByIri, parseGraphJsonLdText } from '../app/rdf_extract.js';
import { searchDocuments } from './search.js';
import { defaultSearchOptions } from '../app/types.js';
import { mintBundleIri, setShoppingCartCount, loadSlimBundleDoc, saveDoc, getShoppingCartCountFromStorage} from '../bundler/bundler-core.js';
import { importUserOntologyFile as importUserOntologyFileToIdb } from '../app/ontology-meta.js';
import {
  COMMON_NAMESPACE_IRIS,
  formatIriForDisplay,
  namespacePrefixMapFromRegistry
} from '../packages/namespace-registry/src/index.js';
import {
  createRdfQuadsFromObjects,
  rdfDatasetToJsonLdGraph
} from '../packages/rdf-io/src/index.js';
import { renderStatusMessage } from '../packages/ui-feedback/src/index.js';
  

import {
  openOntoEagleProjectDatabase,
  getActiveSearchSettings,
  setActiveSearchSettings,
  getOntologyDatasetMeta,
  listOntologyDatasetMeta,
  storeOntologyDatasetMeta,
  listEnabledOntologyDocuments,
  storeOntologyDatasetDocuments,
  setOntologyDatasetEnabled,
  deleteOntologyDataset
} from '../app/ontoeagle-indexeddb-store.js';

/* -----------------------------
 * DOM refs
 * ----------------------------- */

const elStatusText = document.getElementById('ontStatusText');

const form = document.getElementById('ontSearchForm');
const inputQuery = document.getElementById('ontQuery');
const btnSearch = document.getElementById('ontSearchBtn');

const optExact = document.getElementById('optExact');
const optWildcard = document.getElementById('optWildcard');

const optIncludeDefinition = document.getElementById('optIncludeDefinition');
const optIncludeCitation = document.getElementById('optIncludeCitation');
const optIncludeExamples = document.getElementById('optIncludeExamples');
const optIncludeClarifications = document.getElementById('optIncludeClarifications');

const optNamespaces = document.getElementById('optNamespaces');

const btnSaveSettings = document.getElementById('ontSaveSettingsBtn');
const btnResetSettings = document.getElementById('ontResetSettingsBtn');

const elResultsCount = document.getElementById('ontResultsCount');
const elResultsTime = document.getElementById('ontResultsTime');
const elResultsList = document.getElementById('ontResultsList');
const elEmptyState = document.getElementById('ontEmptyState');

const elDetails = document.getElementById('ontDetails');
const ontUserOntologyFile = document.getElementById('ontUserOntologyFile');
const ontUserOntologyList = document.getElementById('ontUserOntologyList');
const ontUserOntologyStatus = document.getElementById('ontUserOntologyStatus');

const typeCheckboxes = /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('.optType'));

/* -----------------------------
 * App state (in-memory)
 * ----------------------------- */

let docsByIri = new Map();   // Map<string, OntologyDocument>
let options = structuredClone(defaultSearchOptions);
let searchReady = false;
const DATASET_SCHEMA_VERSION = 2;
const COMMON_PREFIXES = namespacePrefixMapFromRegistry();
const SLIM_BUNDLE_CONTEXT = Object.freeze({
  rdf: COMMON_PREFIXES.rdf,
  rdfs: COMMON_PREFIXES.rdfs,
  skos: COMMON_PREFIXES.skos,
  owl: COMMON_PREFIXES.owl,
  'rdfs:label': COMMON_NAMESPACE_IRIS.rdfs.label,
  'rdfs:isDefinedBy': COMMON_NAMESPACE_IRIS.rdfs.isDefinedBy,
  'skos:definition': COMMON_NAMESPACE_IRIS.skos.definition
});
const OWL_TYPE_IRIS = Object.freeze([
  'Class',
  'ObjectProperty',
  'DatatypeProperty',
  'AnnotationProperty',
  'NamedIndividual',
  'Ontology'
].map((id) => COMMON_NAMESPACE_IRIS.owl[id]));

/* -----------------------------
 * Utilities
 * ----------------------------- */

/**
 * Update the top status line (aria-live).
 * @param {string} s
 */
function setStatus(s) {
  renderStatusMessage(elStatusText, { message: s, severity: 'info' }, { classPrefix: 'ont-status' });
}

function setSearchReady(isReady) {
  searchReady = isReady;
  if (!btnSearch) return;
  btnSearch.disabled = !isReady;
  btnSearch.setAttribute('aria-disabled', String(!isReady));
  btnSearch.title = isReady ? '' : 'Search index is still loading.';
}

function setDbStatus(state, text) {
  document.dispatchEvent(new CustomEvent('sitehdr:db-status', {
    detail: { state, text }
  }));
}

/**
 * @param {any} err
 * @returns {string}
 */
function errToString(err) {
  if (!err) return 'Unknown error';
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Compute SHA-256 fingerprint of a text (used to detect dataset changes).
 * @param {string} text
 * @returns {Promise<string>}
 */
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function annotateDocs(docs, meta) {
  return docs.map((doc) => ({
    ...doc,
    datasetId: meta.datasetId,
    source: meta.source,
    ontologyName: meta.ontologyName || meta.fileName || meta.datasetId,
    fileName: meta.fileName || '',
    addedByUser: meta.source === 'user' || !!doc.addedByUser
  }));
}

function labelForIri(iri) {
  const doc = docsByIri.get(iri);
  return doc?.label || formatIriForDisplay(iri, COMMON_PREFIXES) || iri;
}

function sortIrisByLabel(iris) {
  return [...new Set(iris || [])].sort((a, b) => labelForIri(a).localeCompare(labelForIri(b)));
}

function ontologyViewerHref(iri) {
  return `../ontology-viewer/?iri=${encodeURIComponent(iri)}`;
}

function isOntologyIri(iri) {
  return docsByIri.get(iri)?.type === 'Ontology';
}

/**
 * Read the current UI controls into `options`.
 * @returns {import('../app/types.js').SearchOptions}
 */
function readOptionsFromUI() {
  const selectedTypes = Array.from(typeCheckboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  const ns = (optNamespaces?.value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return {
    exact: !!optExact?.checked,
    wildcard: !!optWildcard?.checked,
    types: /** @type {any} */ (selectedTypes),
    namespaces: ns,
    includeDefinition: !!optIncludeDefinition?.checked,
    includeCitation: !!optIncludeCitation?.checked,
    includeExamples: !!optIncludeExamples?.checked,
    includeClarifications: !!optIncludeClarifications?.checked
  };
}

/**
 * Apply options to the UI controls.
 * @param {import('../app/types.js').SearchOptions} o
 */
function applyOptionsToUI(o) {
  if (optExact) optExact.checked = !!o.exact;
  if (optWildcard) optWildcard.checked = !!o.wildcard;

  if (optIncludeDefinition) optIncludeDefinition.checked = !!o.includeDefinition;
  if (optIncludeCitation) optIncludeCitation.checked = !!o.includeCitation;
  if (optIncludeExamples) optIncludeExamples.checked = !!o.includeExamples;
  if (optIncludeClarifications) optIncludeClarifications.checked = !!o.includeClarifications;

  if (optNamespaces) optNamespaces.value = (o.namespaces || []).join(', ');

  const set = new Set(o.types || []);
  for (const cb of typeCheckboxes) {
    cb.checked = set.has(cb.value);
  }
}

/**
 * Escape unsafe HTML for rendering.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return (s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* -----------------------------
 * Rendering
 * ----------------------------- */

/**
 * Render result list.
 * Uses role="listbox" and role="option" semantics as set in the HTML.
 *
 * @param {Array<{
 *   doc: import('../app/types.js').OntologyDocument,
 *   score: number,
 *   matchedTokenCount: number
 * }>} results
 */
function renderResults(results) {
  elResultsList.innerHTML = '';

  if (!results.length) {
    elEmptyState.hidden = false;
    elResultsList.setAttribute('aria-activedescendant', '');
    return;
  }

  elEmptyState.hidden = true;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const id = `ontOpt_${i}`;

    const li = document.createElement('li');
    li.className = 'ont-search__result';
    li.id = id;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');

    // Button for focus/activation
   
    const resultDiv = document.createElement('div');
    resultDiv.className = 'ont-search__result';
    resultDiv.dataset.iri = r.doc.iri;

    const title = escapeHtml(r.doc.label || r.doc.iri);
    const titleHtml = r.doc.type === 'Ontology'
      ? `<a href="${escapeHtml(ontologyViewerHref(r.doc.iri))}" data-result-link>${title}</a>`
      : title;

    const iriText = escapeHtml(r.doc.iri);
    const iriHtml = r.doc.type === 'Ontology'
      ? `<a href="${escapeHtml(ontologyViewerHref(r.doc.iri))}" data-result-link>${iriText}</a>`
      : `<span>${iriText}</span>`;

    resultDiv.innerHTML = `
      <div class="ont-search__resultTitle">${titleHtml}</div>
      <div class="ont-search__resultMeta">
        <span class="ont-search__pill">${escapeHtml(r.doc.type)}</span>
        ${r.doc.addedByUser ? '<span class="ont-search__pill ont-search__pill--user">added by user</span>' : ''}
        <br />
      </div>
      <div class="ont-search__resultIri">
        ${iriHtml}
        ${renderCopyIriButton(r.doc.iri)}
      </div>
    `.trim();

    resultDiv.addEventListener('click', () => {
      selectResultByIri(r.doc.iri);
    });

    li.appendChild(resultDiv);
    elResultsList.appendChild(li);
  }

  attachCopyButtons(elResultsList);

  // Set initial active descendant to first item (but focus stays where it is)
  elResultsList.setAttribute('aria-activedescendant', 'ontOpt_0');
}

function renderTaxonomyNode(iri, className = '', connector = '', depth = 0) {
  const label = labelForIri(iri);
  const safeDepth = Math.max(0, Math.min(8, Number(depth) || 0));
  return `<li class="ont-search__treeItem ${className}" style="--tree-depth:${safeDepth}">
    <span class="ont-search__treeConnector" aria-hidden="true">${escapeHtml(connector)}</span>
    <span class="ont-search__treeNode" title="${escapeHtml(iri)}">${escapeHtml(label)}</span>
  </li>`;
}

function firstKnownParent(iri, seen = new Set()) {
  if (seen.has(iri)) return '';
  seen.add(iri);
  const doc = docsByIri.get(iri);
  const parents = sortIrisByLabel((doc?.parents || []).filter((parent) => docsByIri.has(parent)));
  return parents[0] || '';
}

function ancestorChain(iri) {
  const chain = [];
  const seen = new Set([iri]);
  let parent = firstKnownParent(iri);
  while (parent && !seen.has(parent) && chain.length < 5) {
    chain.unshift(parent);
    seen.add(parent);
    parent = firstKnownParent(parent, seen);
  }
  return chain;
}

function renderTaxonomy(doc) {
  const primaryParents = sortIrisByLabel(doc.parents || []).slice(0, 3);
  const chain = ancestorChain(doc.iri);
  const chainSet = new Set(chain);
  const extraParents = primaryParents.filter((iri) => !chainSet.has(iri));
  const displayedParent = chain[chain.length - 1] || primaryParents[0] || '';
  const siblings = sortIrisByLabel(
    (displayedParent ? docsByIri.get(displayedParent)?.children || [] : [])
      .filter((iri) => iri !== doc.iri)
  ).slice(0, 8);
  const children = sortIrisByLabel(doc.children || []).slice(0, 8);

  if (!chain.length && !extraParents.length && !siblings.length && !children.length) return '';

  const ancestorHtml = chain.map((iri, index) =>
    renderTaxonomyNode(iri, 'ont-search__treeItem--ancestor', index === 0 ? '' : '└─', index)
  ).join('');
  const extraParentHtml = extraParents.length
    ? extraParents.map((iri) => renderTaxonomyNode(iri, 'ont-search__treeItem--ancestor ont-search__treeItem--extraParent', '├─', chain.length)).join('')
    : '';
  const siblingHtml = siblings.length
    ? siblings.map((iri, index) =>
        renderTaxonomyNode(iri, 'ont-search__treeItem--sibling', index === siblings.length - 1 ? '└─' : '├─', chain.length)
      ).join('')
    : '';
  const childHtml = children.length
    ? `<ul class="ont-search__treeLevel ont-search__treeLevel--children">${children.map((iri, index) =>
        renderTaxonomyNode(iri, '', index === children.length - 1 ? '└─' : '├─', chain.length + 1)
      ).join('')}</ul>`
    : '';

  return `
    <section class="ont-search__taxonomy" aria-label="Taxonomy context">
      <h3 class="ont-search__detailsSubhead">Taxonomy</h3>
      <div class="ont-search__tree" role="tree">
        <ul class="ont-search__treeLevel ont-search__treeLevel--root">
          ${ancestorHtml}
          ${extraParentHtml}
          ${renderTaxonomyNode(doc.iri, 'ont-search__treeItem--focus', children.length || siblings.length ? '├─' : '└─', chain.length)}
          ${childHtml}
          ${siblingHtml}
        </ul>
      </div>
    </section>
  `.trim();
}

/**
 * Find or create the bundle (skos:Collection) in @graph.
 * @param {any} bundleDoc
 * @returns {any} the collection node
 */
function ensureSlimCollection(bundleDoc) {
  if (!bundleDoc['@graph']) bundleDoc['@graph'] = [];

  let col = bundleDoc['@graph'].find(
    (n) => n && n['@type'] === 'skos:Collection'
  );

  if (!col) {
    col = {
      "@id": mintBundleIri(),
      "@type": "skos:Collection",
      "skos:member": []
    };
    bundleDoc['@graph'].unshift(col);
  }

  if (!Array.isArray(col['skos:member'])) col['skos:member'] = [];
  return col;
}

/**
 * Upsert the member node and membership edge.
 * @param {any} bundleDoc
 * @param {any} itemNode JSON-LD node with @id, @type, label/definition/etc.
 * @returns {{memberCount:number, changed:boolean}}
 */
function addItemToSlimBundle(bundleDoc, itemNode) {
  if (!itemNode || typeof itemNode !== 'object' || !itemNode['@id']) {
    return { memberCount: 0, changed: false };
  }

  const col = ensureSlimCollection(bundleDoc);

  const iri = itemNode['@id'];
  const members = col['skos:member'];

  const alreadyMember = members.some((m) => m && m['@id'] === iri);
  if (!alreadyMember) {
    members.push({ "@id": iri });
  }

  // Upsert full node into @graph (by @id)
  const g = bundleDoc['@graph'];
  const idx = g.findIndex((n) => n && n['@id'] === iri);

  if (idx >= 0) {
    // merge (bundle version gets updated fields if present on itemNode)
    g[idx] = { ...g[idx], ...itemNode };
  } else {
    g.push(itemNode);
  }

  const changed = !alreadyMember || idx < 0;
  return { memberCount: members.length, changed };
}

function createSlimBundleItemNode(doc) {
  const source = {
    iri: doc.iri,
    type: doc.type ? [`owl:${doc.type}`] : [],
    label: doc.label || doc.iri,
    definition: doc.definition || '',
    curatedIn: doc.curatedIn || doc.curated_in || ''
  };
  const { quads, warnings } = createRdfQuadsFromObjects([source], {
    subject: 'iri',
    type: 'type',
    properties: {
      label: COMMON_NAMESPACE_IRIS.rdfs.label,
      definition: COMMON_NAMESPACE_IRIS.skos.definition,
      curatedIn: {
        predicate: COMMON_NAMESPACE_IRIS.rdfs.isDefinedBy,
        termType: 'iri'
      }
    }
  });
  if (warnings.length) console.warn('Slim bundle item RDF mapping warnings:', warnings);
  return rdfDatasetToJsonLdGraph(quads, { context: SLIM_BUNDLE_CONTEXT })[0] || {
    '@id': doc.iri,
    '@type': source.type,
    'rdfs:label': { '@value': source.label }
  };
}



/**
 * Render details panel for a doc.
 * @param {import('../app/types.js').OntologyDocument} doc
 */
function normalizeDetailValue(item) {
  if (typeof item === 'string') return { value: item };
  if (item && typeof item === 'object') return item;
  return { value: String(item || '') };
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

function shouldLinkDetailValue(item) {
  const value = String(item?.iri || item?.value || '');
  return !!item?.iri || item?.datatype === COMMON_NAMESPACE_IRIS.xsd.anyURI || isHttpUrl(value);
}

function splitDetailText(text) {
  const raw = String(text || '');
  const words = raw.trim().split(/\s+/).filter(Boolean);
  if (raw.length <= 200 && words.length <= 75) return { truncated: false, text: raw, rest: '' };
  const byChars = raw.slice(0, 200).trim();
  const byWords = words.slice(0, 75).join(' ');
  const preview = byChars.length <= byWords.length ? byChars : byWords;
  const cleanPreview = preview.replace(/[;,\s]+$/, '');
  const rest = raw.slice(preview.length).replace(/^[;,\s]+/, '');
  return { truncated: true, text: cleanPreview, rest };
}

function renderDetailValue(item, truncate = true, linkValues = false) {
  const value = String(item?.value || item?.iri || '');
  const display = truncate ? splitDetailText(value) : { truncated: false, text: value, rest: '' };
  const href = linkValues && shouldLinkDetailValue(item) ? String(item.iri || item.value || '') : '';
  const renderText = (text) => href
    ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
    : escapeHtml(text);

  if (!display.truncated) return renderText(value);
  return `<span class="ont-search__expandText">
    <span class="ont-search__expandPreview">${renderText(display.text)}<span class="ont-search__ellipsis">...</span></span>
    <span class="ont-search__expandRest" hidden>${renderText(display.rest)}</span>
    <button class="ont-search__inlineBtn ont-search__expandBtn" type="button" data-expand-text>Show more</button>
  </span>`;
}

function renderDetailList(label, values, options = {}) {
  const items = (values || []).map(normalizeDetailValue).filter((item) => item.value || item.iri);
  if (!items.length) return '';
  const truncate = options.truncate !== false;
  const linkValues = options.linkValues === true;
  return `<div class="ont-search__detailsMeta">
    <strong>${escapeHtml(label)}:</strong>
    <ul class="ont-search__detailsList">
      ${items.map((item) => `<li>${renderDetailValue(item, truncate, linkValues)}</li>`).join('')}
    </ul>
  </div>`;
}

function renderIriLabel(iri) {
  const label = labelForIri(iri);
  const curie = formatIriForDisplay(iri, COMMON_PREFIXES);
  const suffix = curie && curie !== label ? ` <code>${escapeHtml(curie)}</code>` : '';
  const labelHtml = isOntologyIri(iri)
    ? `<a href="${escapeHtml(ontologyViewerHref(iri))}">${escapeHtml(label)}</a>`
    : escapeHtml(label);
  return `${labelHtml}${suffix} ${renderCopyIriButton(iri)}`;
}

function renderCopyIriButton(iri) {
  return `<button class="ont-search__copyBtn" type="button" data-copy-iri="${escapeHtml(iri)}" title="Copy full IRI" aria-label="Copy full IRI">⧉</button>`;
}

function renderIriList(label, iris, options = {}) {
  const values = [...new Set(iris || [])].filter((iri) => typeof iri === 'string' && !iri.startsWith('_:'));
  if (!values.length) return '';
  const itemClass = options.pills ? ' class="ont-search__detailsPillItem"' : '';
  const listClass = options.pills ? 'ont-search__detailsList ont-search__detailsList--pills' : 'ont-search__detailsList';
  return `<div class="ont-search__detailsMeta">
    <strong>${escapeHtml(label)}:</strong>
    <ul class="${listClass}">
      ${values.map((iri) => `<li${itemClass}>${renderIriLabel(iri)}</li>`).join('')}
    </ul>
  </div>`;
}

function renderAdditionalTypeSection(doc) {
  const additionalTypes = (doc.additionalTypes || [])
    .filter((iri) => !['owl:Class', 'owl:ObjectProperty', 'owl:DatatypeProperty', 'owl:AnnotationProperty', 'owl:NamedIndividual', 'owl:Ontology'].includes(iri))
    .filter((iri) => !OWL_TYPE_IRIS.includes(iri));
  if (!additionalTypes.length) return '';
  const label = doc.type === 'NamedIndividual' ? 'Type assertions' : 'Additional RDF/OWL types';
  return renderIriList(label, additionalTypes, { pills: true });
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function attachCopyButtons(root) {
  root.querySelectorAll('[data-copy-iri]').forEach((button) => {
    if (button.dataset.copyBound === 'true') return;
    button.dataset.copyBound = 'true';
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const iri = button.getAttribute('data-copy-iri') || '';
      try {
        await copyTextToClipboard(iri);
        const previous = button.textContent;
        button.textContent = '✓';
        button.setAttribute('aria-label', 'Copied full IRI');
        window.setTimeout(() => {
          button.textContent = previous || '⧉';
          button.setAttribute('aria-label', 'Copy full IRI');
        }, 1200);
      } catch (err) {
        setStatus(`Could not copy IRI: ${errToString(err)}`);
      }
    });
  });
}

function attachDetailsInteractions(root) {
  root.querySelectorAll('[data-expand-text]').forEach((button) => {
    button.addEventListener('click', () => {
      const wrapper = button.closest('.ont-search__expandText');
      const rest = wrapper?.querySelector('.ont-search__expandRest');
      const ellipsis = wrapper?.querySelector('.ont-search__ellipsis');
      if (!rest) return;
      const expanding = rest.hasAttribute('hidden');
      rest.toggleAttribute('hidden', !expanding);
      if (ellipsis) ellipsis.hidden = expanding;
      button.textContent = expanding ? 'Show less' : 'Show more';
    });
  });

  attachCopyButtons(root);
}

function renderDetails(doc) {
  if (!doc) {
    elDetails.innerHTML = `<p class="ont-search__help">Select a result to view details.</p>`;
    return;
  }

  const def = doc.definition ? `<p class="ont-search__detailsMeta"><strong>Definition:</strong><br />${escapeHtml(doc.definition)}</p>` : '';
  const alts = (doc.altLabels && doc.altLabels.length)
    ? `<p class="ont-search__detailsMeta"><strong>Alt labels:</strong><br />${escapeHtml(doc.altLabels.join(', '))}</p>`
    : '';

  const curated_in = renderIriList('Curated in', doc.curated_in || []);
  const userPill = doc.addedByUser ? '<span class="ont-search__pill ont-search__pill--user">added by user</span>' : '';
  const taxonomy = renderTaxonomy(doc);
  const relationDetails = [
    renderAdditionalTypeSection(doc),
    doc.type === 'Class' ? renderIriList('SubClass of', doc.subClassOf || []) : '',
    doc.type === 'Class' ? renderIriList('Equivalent class', doc.equivalentClasses || []) : '',
    doc.type === 'Class' ? renderIriList('Disjoint with', doc.disjointWith || []) : '',
    ['ObjectProperty', 'DatatypeProperty', 'AnnotationProperty'].includes(doc.type) ? renderIriList('SubProperty of', doc.subPropertyOf || []) : '',
    ['ObjectProperty', 'DatatypeProperty'].includes(doc.type) ? renderIriList('Domain', doc.domains || []) : '',
    ['ObjectProperty', 'DatatypeProperty'].includes(doc.type) ? renderIriList('Range', doc.ranges || []) : '',
    doc.type === 'AnnotationProperty' ? renderIriList('Domain', doc.domains || []) : '',
    doc.type === 'AnnotationProperty' ? renderIriList('Range', doc.ranges || []) : '',
  ].join('');
  const annotationDetails = [
    renderDetailList('Definition sources', doc.definitionSources || [], { linkValues: true }),
    renderDetailList('Citations', doc.citations || [], { linkValues: true }),
    renderDetailList('Clarifications', doc.clarifications || []),
    renderDetailList('Examples', doc.examples || []),
    renderDetailList('Comments', doc.comments || []),
    renderDetailList('Curator notes', doc.curatorNotes || []),
  ].join('');

    
  elDetails.innerHTML = `
    <div class="ont-search__detailsHeader">
      <div class="ont-search__detailsTitle"><strong>Label:</strong> <span style="font-size: 2rem; font-weight: 600">${escapeHtml(doc.label || doc.iri)}</span></div>
      <div class="ont-search__detailsMeta"><strong>Type:</strong> <span class="ont-search__pill">${escapeHtml(doc.type)}</span> ${userPill}
      </div>
      <div class="ont-search__detailsIri"><strong>IRI:</strong> <code>${escapeHtml(doc.iri)}</code> ${renderCopyIriButton(doc.iri)}
      </div>
      <div class="ont-search__detailsIri"><strong>Namespace:</strong> <code>${escapeHtml(doc.namespace || '')}</code>
      </div>
    </div>
    ${def}
    ${alts}
    ${relationDetails}
    ${annotationDetails}
    ${curated_in}
    ${taxonomy}
    <div class="ont-search__row" style="margin-top:0.75rem;">
      <button id="ontAddToSlimBundleBtn" class="ont-search__btn" type="button">
        Add to bundle for slim
      </button>
    </div>
  `.trim();

  {const btn = document.getElementById('ontAddToSlimBundleBtn');

  if (btn) {
    btn.onclick = async () => {
      const itemNode = createSlimBundleItemNode(doc);

      const bundleDoc = await loadSlimBundleDoc();
      const { memberCount } = addItemToSlimBundle(bundleDoc, itemNode);
      await saveDoc(bundleDoc);
      setShoppingCartCount(memberCount);

      // Optional: give the user feedback
      btn.textContent = 'Added ✓';
      btn.disabled = true;
      setTimeout(() => {
        btn.textContent = 'Add to bundle for slim';
        btn.disabled = false;
      }, 800);
    };
  }
}
  attachDetailsInteractions(elDetails);
}

/**
 * Mark a result as selected and update aria-selected + details panel.
 * @param {string} iri
 */
function selectResultByIri(iri) {
  const doc = docsByIri.get(iri);
  if (!doc) return;

  // Update aria-selected on listbox options
  const items = elResultsList.querySelectorAll('[role="option"]');
  for (const el of items) {
    const result = el.querySelector('.ont-search__result[data-iri]');
    const isSelected = result?.dataset?.iri === iri;
    el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  }

  renderDetails(doc);
}

/* -----------------------------
 * Keyboard navigation for results list
 * ----------------------------- */

function setupResultsKeyboardNav() {
  elResultsList.addEventListener('keydown', (e) => {
    const items = Array.from(elResultsList.querySelectorAll('[role="option"]'));
    if (!items.length) return;

    const activeId = elResultsList.getAttribute('aria-activedescendant');
    let idx = items.findIndex(el => el.id === activeId);
    if (idx < 0) idx = 0;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(items.length - 1, idx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(0, idx - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = items[idx].querySelector('.ont-search__result[data-iri]');
      if (result?.dataset?.iri) selectResultByIri(result.dataset.iri);
      return;
    } else {
      return;
    }

    const next = items[idx];
    elResultsList.setAttribute('aria-activedescendant', next.id);

    // Move focus to the button inside the option for a good keyboard UX
    next.scrollIntoView({ block: 'nearest' });
  });
}

/* -----------------------------
 * Dataset load + caching
 * ----------------------------- */

/**
 * Fetch graph.jsonld (service worker will cache it).
 * @returns {Promise<{text:string, fingerprint:string}>}
 */
async function fetchGraph() {
  const res = await fetch('../data/graph.jsonld', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch graph.jsonld: ${res.status}`);
  const text = await res.text();
  const fingerprint = await sha256Hex(text);
  return { text, fingerprint };
}

/**
 * Hydrate in-memory docs+index from IndexedDB.
 * @returns {Promise<boolean>} true if loaded from cache
 */
async function tryLoadFromIdb() {
  const cachedDocs = await listEnabledOntologyDocuments();
  if (cachedDocs && cachedDocs.length) {
    docsByIri = mapByIri(cachedDocs);
    return true;
  }
  return false;
}

/**
 * Build docs+index from graph.jsonld, persist to IDB.
 * @param {string} graphText
 * @param {string} fingerprint
 */
async function buildFromGraphAndPersist(graphText, fingerprint) {
  const json = parseGraphJsonLdText(graphText);
  const docs = annotateDocs(extractDocumentsFromJsonLd(json), {
    datasetId: 'builtin',
    source: 'builtin',
    ontologyName: 'OntoEagle built-in graph',
    fileName: 'graph.jsonld'
  });

  await storeOntologyDatasetDocuments('builtin', docs);
  await storeOntologyDatasetMeta('builtin', {
    fingerprint,
    enabled: true,
    source: 'builtin',
    ontologyName: 'OntoEagle built-in graph',
    fileName: 'graph.jsonld',
    documentCount: docs.length,
    schemaVersion: DATASET_SCHEMA_VERSION,
    updatedAt: Date.now()
  });
  docsByIri = mapByIri(await listEnabledOntologyDocuments());
}

async function refreshDocsFromEnabledDatasets() {
  docsByIri = mapByIri(await listEnabledOntologyDocuments());
}

async function renderUserOntologyManager() {
  if (!ontUserOntologyList) return;
  const metas = (await listOntologyDatasetMeta())
    .filter((m) => m && m.source === 'user')
    .sort((a, b) => String(a.ontologyName || a.fileName || '').localeCompare(String(b.ontologyName || b.fileName || '')));

  ontUserOntologyList.innerHTML = '';
  if (!metas.length) {
    ontUserOntologyList.innerHTML = '<p class="ont-search__help">No user ontologies loaded yet.</p>';
    if (ontUserOntologyStatus) ontUserOntologyStatus.textContent = '';
    return;
  }

  for (const meta of metas) {
    const row = document.createElement('div');
    row.className = 'ont-search__ontologyRow';
    row.innerHTML = `
      <div class="ont-search__ontologyMain">
        <div class="ont-search__ontologyName">${escapeHtml(meta.ontologyName || meta.fileName || meta.datasetId)}</div>
        <div class="ont-search__ontologyMeta">${escapeHtml(meta.fileName || '')} - ${Number(meta.documentCount || 0)} resources</div>
      </div>
      <label class="ont-search__ontologyToggle">
        <input type="checkbox" ${meta.enabled !== false ? 'checked' : ''} />
        <span>Enabled</span>
      </label>
      <button class="ont-search__btn ont-search__btn--ghost" type="button">Remove</button>
    `.trim();

    const toggle = row.querySelector('input');
    toggle?.addEventListener('change', async () => {
      await setOntologyDatasetEnabled(meta.datasetId, toggle.checked);
      setDbStatus('reading', 'DB refreshing');
      await refreshDocsFromEnabledDatasets();
      setDbStatus('ready', 'DB ready');
      setStatus(toggle.checked ? 'User ontology enabled.' : 'User ontology disabled.');
    });

    const remove = row.querySelector('button');
    remove?.addEventListener('click', async () => {
      await deleteOntologyDataset(meta.datasetId);
      setDbStatus('reading', 'DB refreshing');
      await refreshDocsFromEnabledDatasets();
      await renderUserOntologyManager();
      setDbStatus('ready', 'DB ready');
      setStatus('User ontology removed.');
    });

    ontUserOntologyList.appendChild(row);
  }

  if (ontUserOntologyStatus) ontUserOntologyStatus.textContent = `${metas.length} user ontolog${metas.length === 1 ? 'y' : 'ies'} loaded.`;
}

/* -----------------------------
 * App init + search execution
 * ----------------------------- */

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    // Non-fatal; app still works online
    console.warn('Service worker registration failed:', err);
  }
}

/**
 * Perform a search and render.
 * @param {string} query
 */
function runSearch(query) {
  if (!searchReady) {
    setStatus('Search index is still loading...');
    setDbStatus('initializing', 'DB loading');
    return;
  }

  const opts = readOptionsFromUI();
  options = opts;

  const t0 = performance.now();
  const { results } = searchDocuments(docsByIri, query, opts, 75);
  const t1 = performance.now();

  elResultsCount.textContent = String(results.length);
  elResultsTime.textContent = `${Math.round(t1 - t0)} ms`;

  renderResults(results);

  // Auto-select first result (if any)
  if (results.length) {
    selectResultByIri(results[0].doc.iri);
  } else {
    renderDetails(null);
  }
}

async function ontoEagleInit() {
  setSearchReady(false);
  setDbStatus('initializing', 'DB initializing');
  setStatus('Initializing…');

  await registerServiceWorker();
  setDbStatus('initializing', 'DB opening');
  await openOntoEagleProjectDatabase();

  // Load settings
  const saved = await getActiveSearchSettings();
  options = saved || structuredClone(defaultSearchOptions);
  applyOptionsToUI(options);

  // Prefer IDB cache; fall back to graph fetch if needed or outdated
  setStatus('Loading cached index…');
  setDbStatus('reading', 'DB reading');
  const cacheOk = await tryLoadFromIdb();

  setStatus('Checking dataset…');
  const { text, fingerprint } = await fetchGraph();
  const meta = await getOntologyDatasetMeta('builtin');

  const fingerprintChanged = !meta || meta.fingerprint !== fingerprint || meta.schemaVersion !== DATASET_SCHEMA_VERSION;

  if (!cacheOk || fingerprintChanged) {
    setStatus('Building index (first run or updated dataset)…');
    setDbStatus('writing', 'DB writing');
    await buildFromGraphAndPersist(text, fingerprint);
  } else {
    setDbStatus('reading', 'DB reading');
    await refreshDocsFromEnabledDatasets();
  }

  setStatus('Ready.');
  setDbStatus('ready', 'DB ready');
  setSearchReady(true);
  setShoppingCartCount(await getShoppingCartCountFromStorage());
  await renderUserOntologyManager();

  // Initial UI state
  elResultsCount.textContent = '0';
  elResultsTime.textContent = '0 ms';
  renderDetails(null);

  inputQuery.addEventListener('input', () => {
    // Optional: live search as you type (debounce later)
    // For now, do nothing to keep Stage E stable.
  });

  btnSaveSettings?.addEventListener('click', async () => {
    const o = readOptionsFromUI();
    await setActiveSearchSettings(o);
    setStatus('Settings saved.');
  });

  btnResetSettings?.addEventListener('click', async () => {
    options = structuredClone(defaultSearchOptions);
    applyOptionsToUI(options);
    await setActiveSearchSettings(options);
    setStatus('Settings reset.');
  });

  ontUserOntologyFile?.addEventListener('change', async () => {
    const files = Array.from(ontUserOntologyFile.files || []);
    for (const file of files) {
      try {
        setStatus(`Loading ${file.name}...`);
        setDbStatus('writing', 'DB writing');
        const result = await importUserOntologyFileToIdb(file);
        setDbStatus('reading', 'DB refreshing');
        await refreshDocsFromEnabledDatasets();
        await renderUserOntologyManager();
        setDbStatus('ready', 'DB ready');
        setStatus(`Loaded ${result.documentCount} resources from ${file.name}.`);
      } catch (err) {
        console.error(err);
        setDbStatus('error', 'DB error');
        setStatus(`Ontology import failed: ${errToString(err)}`);
      }
    }
    ontUserOntologyFile.value = '';
  });

  window.addEventListener('ontoeagle:catalog-data-updated', async () => {
    setDbStatus('reading', 'DB refreshing');
    await refreshDocsFromEnabledDatasets();
    setDbStatus('ready', 'DB ready');
    setStatus('Catalog data updated.');
  });

  setupResultsKeyboardNav();
}

form?.addEventListener('submit', (e) => {
  e.preventDefault();
  runSearch(inputQuery?.value || '');
});

setSearchReady(false);

ontoEagleInit().catch((err) => {
  console.error(err);
  setSearchReady(false);
  setDbStatus('error', 'DB error');
  setStatus(`Error: ${errToString(err)}`);
});
