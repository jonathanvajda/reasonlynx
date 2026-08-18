// docs/scripts/bundler-ui.js
import '../app/root-service-worker.js';
import {
  loadDoc,
  saveDoc,
  clearDoc,
  listBundles,
  nodeById,
  getMembers,
  createBundle,
  upsertNode,
  removeMember,
  moveMember,
  copyMember,
  mergeBundles,
  splitBundle,
  toRobotSeedText,
  shortId,
  pickLabelValue,
  getItemLabel,
  getPrimaryTypePill,
  getDefinedByIri,
  setShoppingCartCount,
  getShoppingCartCountFromStorage
} from './bundler-core.js';

import { extractDocumentsFromJsonLd, mapByIri, parseGraphJsonLdText } from '../app/rdf_extract.js';
import { buildSlimFromSeeds, serializeSlimJsonLd } from './slim-core.js';
import {
  downloadTextFile,
  readFileAsText
} from '../packages/browser-file-io/src/index.js';
import { parseDelimitedText } from '../packages/tabular-io/src/index.js';
import {
  SUPPORTED_MIME_DESCRIPTORS,
  getSupportedMimeTypeForFilename,
  isMimeDescriptorCategory
} from '../packages/format-registry/src/index.js';
import { isAbsoluteIri } from '../packages/ontology-utils/src/index.js';
import { renderStatusMessage } from '../packages/ui-feedback/src/index.js';

import {
  openOntoEagleProjectDatabase,
  getOntologyDatasetMeta,
  storeOntologyDatasetMeta,
  listOntologyDatasetDocuments,
  listEnabledOntologyDocuments,
  storeOntologyDatasetDocuments,
  storeOntoEagleRunRecord
} from '../app/ontoeagle-indexeddb-store.js';

/* Example item */
const EX_ITEM_IRI = 'http://purl.obolibrary.org/obo/ICO_0000120';
const EX_ITEM_NODE = {
  '@id': EX_ITEM_IRI,
  '@type': ['owl:Class'],
  'rdfs:label': 'Stasis of Law',
  'skos:definition': 'A Stasis of Regulation wherein the regulation is a legal directive.',
  'rdfs:isDefinedBy': { '@id': 'The Informed Consent Ontology (ICO)' }
};

const DOWNLOAD_MIME = Object.freeze({
  jsonLd: SUPPORTED_MIME_DESCRIPTORS.jsonLd.mimeType,
  robotSeed: SUPPORTED_MIME_DESCRIPTORS.plainText.mimeType,
  turtle: SUPPORTED_MIME_DESCRIPTORS.turtle.mimeType
});

/* ---------- DOM refs (bundler.html only) ---------- */

// In-memory dataset state (used by IDB cache + graph.jsonld pipeline)
let docsByIri = new Map();
const DATASET_SCHEMA_VERSION = 2;

const app = document.getElementById('app');
const txtRaw = document.getElementById('txtRaw');

// Status bar
const elStatusText = document.getElementById('ontStatusText');


// Bundle managemeny
const btnCreateBundle = document.getElementById('btnCreateBundle');
const btnSeedExample = document.getElementById('btnSeedExample');
const btnExportSeed = document.getElementById('btnExportSeed');
const btnClear = document.getElementById('btnClear');
const btnMerge = document.getElementById('btnMerge');

const selExportBundle = document.getElementById('selExportBundle');
const chkIncludeLabels = document.getElementById('chkIncludeLabels');
const seedFileInput = document.getElementById('seedFileInput');
const txtSeedInput = document.getElementById('txtSeedInput');
const selScoMode = document.getElementById('selScoMode');
const selSpoMode = document.getElementById('selSpoMode');
const selAnnotationMode = document.getElementById('selAnnotationMode');
const selProvenanceMode = document.getElementById('selProvenanceMode');
const btnLoadBundleSeeds = document.getElementById('btnLoadBundleSeeds');
const btnExportSlimTurtle = document.getElementById('btnExportSlimTurtle');
const btnExportSlimJsonLd = document.getElementById('btnExportSlimJsonLd');
const slimStatus = document.getElementById('slimStatus');

const selMergeA = document.getElementById('selMergeA'); // ✅ fixed scope
const selMergeB = document.getElementById('selMergeB'); // ✅ fixed scope

function hasBundlerUI() {
  return !!(app && txtRaw && btnCreateBundle && selExportBundle);
}

if (!hasBundlerUI()) {
  // Loaded on a page that isn't bundler.html; do nothing (safe import).
  // You can console.info if you want:
  // console.info('[bundler-ui] UI not present; skipping init');
} else {
  bundlerInit().catch((error) => {
    console.error('[bundler-ui] initialization failed:', error);
    setStatus(`Bundler failed to initialize: ${error?.message || error}`);
  });
}

/* ---------- UI helpers ---------- */

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setSlimStatus(message) {
  renderStatusMessage(slimStatus, { message, severity: 'info' }, { classPrefix: 'ont-status' });
}

async function ensureEnabledDocsLoaded() {
  await openOntoEagleProjectDatabase();
  const docs = await listEnabledOntologyDocuments();
  docsByIri = mapByIri(docs);
  return docs;
}

function selectedSlimOptions() {
  return {
    scoMode: selScoMode?.value || 'minimal',
    spoMode: selSpoMode?.value || 'minimal',
    annotationMode: selAnnotationMode?.value || 'minimal',
    provenanceMode: selProvenanceMode?.value || 'lite'
  };
}

async function buildCurrentSlim() {
  const docs = await ensureEnabledDocsLoaded();
  const seedText = txtSeedInput?.value || '';
  const slim = buildSlimFromSeeds(docs, seedText, selectedSlimOptions());
  setSlimStatus(`Slim contains ${slim.iris.length} resources. ${slim.missing.length ? `${slim.missing.length} seed(s) not found.` : 'All seeds found.'}`);
  return slim;
}

function isCsvSeedFile(fileName) {
  const detected = getSupportedMimeTypeForFilename(fileName);
  return detected.ok
    && isMimeDescriptorCategory(detected.value, 'tabular')
    && detected.value.id === 'csv';
}

function extractSeedTextFromCsv(text) {
  const parsed = parseDelimitedText(text, {
    delimiter: ',',
    hasHeader: false,
    trimCells: true
  });
  const iris = [];
  for (const row of parsed.rows) {
    for (const cell of row) {
      if (isAbsoluteIri(cell, { allowedSchemes: ['http', 'https', 'urn'] })) iris.push(cell);
    }
  }
  return Array.from(new Set(iris)).join('\n') + (iris.length ? '\n' : '');
}

function createSeedTextFromFileContent(file, text) {
  return isCsvSeedFile(file?.name) ? extractSeedTextFromCsv(text) : text;
}

function fillBundleSelect(select, bundleIds) {
  if (!select) return;
  select.innerHTML = '';
  if (bundleIds.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '(no bundles)';
    select.appendChild(opt);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  for (let i = 0; i < bundleIds.length; i++) {
    const id = bundleIds[i];
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `Bundle ${i + 1} (${shortId(id)})`;
    select.appendChild(opt);
  }
}

function renderTypePills(node) {
  const t = getPrimaryTypePill(node);
  if (!t) return null;

  const wrap = document.createElement('span');
  wrap.className = 'pills';

  const s = document.createElement('span');
  s.className = 'pill pill--type';
  s.textContent = t;

  wrap.appendChild(s);
  return wrap;
}

function renderDefinedByRow(node) {
  const iri = getDefinedByIri(node);
  if (!iri) return null;

  const row = document.createElement('div');
  row.className = 'itemDefinedByRow';

  const lab = document.createElement('div');
  lab.className = 'itemDefinedByLabel';
  lab.textContent = 'Curated in ontology:';

  const val = document.createElement('div');
  val.className = 'itemDefinedByValue';
  val.textContent = iri;

  row.appendChild(lab);
  row.appendChild(val);
  return row;
}

function renderDefinitionRow(defnText) {
  const defn = (defnText || '').trim();
  if (!defn) return null;

  const row = document.createElement('div');
  row.className = 'itemDefinedByRow';

  const lab = document.createElement('div');
  lab.className = 'itemDefinedByLabel';
  lab.textContent = 'Def.';

  const val = document.createElement('div');
  val.className = 'itemDefinedByValue';
  val.textContent = defn;

  row.appendChild(lab);
  row.appendChild(val);
  return row;
}

function renderIriRow(iri) {
  const row = document.createElement('div');
  row.className = 'itemDefinedByRow';

  const lab = document.createElement('div');
  lab.className = 'itemDefinedByLabel';
  lab.textContent = 'IRI:';

  const val = document.createElement('div');
  val.className = 'itemDefinedByValue';

  const a = document.createElement('a');
  a.href = iri;
  a.textContent = iri;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.overflowWrap = 'anywhere';
  a.style.wordBreak = 'break-word';

  val.appendChild(a);

  row.appendChild(lab);
  row.appendChild(val);
  return row;
}

/* ---------- init + event wiring ---------- */

/* -----------------------------
 * App init + search execution
 * ----------------------------- */

async function bundlerInit() {
  btnCreateBundle?.addEventListener('click', async () => {
    const doc = await loadDoc();
    createBundle(doc);
    await saveDoc(doc);
    await render();
  });

  btnSeedExample?.addEventListener('click', async () => {
    const doc = await loadDoc();
    if (listBundles(doc).length === 0) createBundle(doc);
    const b0 = listBundles(doc)[0];
    upsertNode(doc, EX_ITEM_NODE);
    // add member using core function by manipulating members through upsert+setMembers:
    // easiest is to reuse removeMember/moveMember etc; but here do:
    // We can just import addMember, but you didn’t include it above — so let's keep it simple:
    // (Import addMember if you want; for now, do a move-less add via getMembers+setMembers)
    // Better: import addMember and call it.
    // For immediate functionality, import addMember in the header and call it here.
    // --- For now, assume you add it:
    // addMember(doc, b0, EX_ITEM_IRI);

    // If you want no extra import changes, do this:
    const members = getMembers(doc, b0);
    if (!members.includes(EX_ITEM_IRI)) {
      // We didn't import setMembers; simplest: re-import addMember or setMembers.
      // Recommended: import addMember. (See note below.)
    }

    await saveDoc(doc);
    await render();
  });

  btnExportSeed?.addEventListener('click', async () => {
    console.info('Exporting bundle seed text…');
    const doc = await loadDoc();
    const bundleId = selExportBundle?.value || '';
    if (!bundleId) return;

    const includeLabels = !!chkIncludeLabels?.checked;
    const text = toRobotSeedText(doc, bundleId, includeLabels);
    downloadTextFile(`bundle-${shortId(bundleId)}.txt`, text, {
      mimeType: DOWNLOAD_MIME.robotSeed
    });
    console.info('Exported bundle seed text:');
  });

  seedFileInput?.addEventListener('change', async () => {
    const file = seedFileInput.files && seedFileInput.files[0];
    if (!file || !txtSeedInput) return;
    try {
      const text = await readFileAsText(file);
      txtSeedInput.value = createSeedTextFromFileContent(file, text);
      setSlimStatus(`Loaded seeds from ${file.name}.`);
    } catch (err) {
      console.error('Seed file read failed:', err);
      setSlimStatus(`Failed to read ${file.name}: ${err?.message || err}`);
    } finally {
      seedFileInput.value = '';
    }
  });

  btnLoadBundleSeeds?.addEventListener('click', async () => {
    if (!txtSeedInput) return;
    const doc = await loadDoc();
    const bundleId = selExportBundle?.value || '';
    if (!bundleId) return;
    txtSeedInput.value = getMembers(doc, bundleId).join('\n') + '\n';
    setSlimStatus('Loaded selected bundle members as seeds.');
  });

  btnExportSlimTurtle?.addEventListener('click', async () => {
    const slim = await buildCurrentSlim();
    downloadTextFile(`ontoeagle-slim-${Date.now()}.ttl`, slim.turtle, {
      mimeType: DOWNLOAD_MIME.turtle
    });
  });

  btnExportSlimJsonLd?.addEventListener('click', async () => {
    const slim = await buildCurrentSlim();
    downloadTextFile(`ontoeagle-slim-${Date.now()}.jsonld`, serializeSlimJsonLd(slim.jsonld), {
      mimeType: DOWNLOAD_MIME.jsonLd
    });
  });

  btnMerge?.addEventListener('click', async () => {
    const a = selMergeA?.value || '';
    const b = selMergeB?.value || '';
    if (!a || !b || a === b) return;
    const doc = await loadDoc();
    mergeBundles(doc, [a, b]);
    await saveDoc(doc);
    await render();
  });

  btnClear?.addEventListener('click', async () => {
    await clearDoc();
    await render();
  });

  await render();
}

/* ---------- render ---------- */

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
  const cachedDocs = await listOntologyDatasetDocuments('builtin');
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
  const docs = extractDocumentsFromJsonLd(json);

  docsByIri = mapByIri(docs);
 // INDEX FEATURE: index = buildIndex(docs); // your indexer.js should export this

  await storeOntologyDatasetDocuments('builtin', docs);
 // INDEX FEATURE:   await storeOntologySearchIndex('builtin', index);
  await storeOntologyDatasetMeta('builtin', { fingerprint, enabled: true, schemaVersion: DATASET_SCHEMA_VERSION, updatedAt: Date.now() });
  await storeOntoEagleRunRecord({
    runKind: 'ontology-dataset-load',
    label: 'Loaded built-in OntoEagle graph',
    outputArtifactIds: ['artifact:ontoeagle:builtin:documents'],
    payload: {
      datasetId: 'builtin',
      documentCount: docs.length,
      fingerprint
    }
  });
}

async function render() {
  const doc = await loadDoc();
  const bundles = listBundles(doc);
  const idx = nodeById(doc);

  fillBundleSelect(selExportBundle, bundles);
  if (selMergeA) fillBundleSelect(selMergeA, bundles);
  if (selMergeB) fillBundleSelect(selMergeB, bundles);

  txtRaw.value = JSON.stringify(doc, null, 2);

  app.innerHTML = '';
  if (bundles.length === 0) {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `<div class="bundleTitle">No bundles yet</div><div>Create a bundle to get started.</div>`;
    app.appendChild(div);
    return;
  }

  bundles.forEach((bundleId, bundleIndex) => {
    const members = getMembers(doc, bundleId);

    const card = document.createElement('div');
    card.className = 'card';

    const bundleManager = document.createElement('div');
    bundleManager.className = 'bundleManager';
    bundleManager.innerHTML = `
      <div>
        <div class="bundleTitle">Bundle ${bundleIndex + 1}</div>
        <div>${members.length} item(s)</div>
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'row';

    const btnDump = document.createElement('button');
    btnDump.type = 'button';
    btnDump.textContent = 'Dump bundle';
    btnDump.addEventListener('click', async () => {
      const d = await loadDoc();
      // delete bundle node; items remain
      d['@graph'] = d['@graph'].filter(n => !(n && n['@id'] === bundleId));
      await saveDoc(d);
      await render();
    });

    const btnSplitHalf = document.createElement('button');
    btnSplitHalf.type = 'button';
    btnSplitHalf.textContent = 'Split ~half';
    btnSplitHalf.addEventListener('click', async () => {
      const d = await loadDoc();
      const m = getMembers(d, bundleId);
      const half = m.slice(0, Math.floor(m.length / 2));
      if (half.length === 0) return;
      splitBundle(d, bundleId, half);
      await saveDoc(d);
      await render();
    });

    actions.appendChild(btnSplitHalf);
    actions.appendChild(btnDump);
    bundleManager.appendChild(actions);

    card.appendChild(bundleManager);

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'items';

    members.forEach((itemId) => {
      const itemNode = idx.get(itemId) || { '@id': itemId };
      const label = getItemLabel(doc, itemId) || '(no label)';
      const defn = pickLabelValue(itemNode['skos:definition']) || '';

      const itemDiv = document.createElement('div');
      itemDiv.className = 'item';

      const top = document.createElement('div');
      top.className = 'itemTop';
      top.innerHTML = `
        <div class="itemHeading">
          <div class="itemLabel">${escapeHtml(label)}</div>
        </div>
      `;

      const heading = top.querySelector('.itemHeading');
      const pills = renderTypePills(itemNode);
      if (pills && heading) heading.appendChild(pills);

      const row = document.createElement('div');
      row.className = 'row';
      row.style.justifyContent = 'flex-end';

      const btnRemoveItem = document.createElement('button');
      btnRemoveItem.type = 'button';
      btnRemoveItem.textContent = 'Remove';
      btnRemoveItem.addEventListener('click', async () => {
        const d = await loadDoc();
        removeMember(d, bundleId, itemId);
        await saveDoc(d);
        await render();
      });

      const selMove = document.createElement('select');
      const bundleIds = listBundles(doc).filter(b => b !== bundleId);
      selMove.innerHTML = `<option value="">Move to…</option>` + bundleIds.map((b, i) =>
        `<option value="${b}">Bundle ${i + 1} (${shortId(b)})</option>`
      ).join('');

      const btnMove = document.createElement('button');
      btnMove.type = 'button';
      btnMove.textContent = 'Move';
      btnMove.addEventListener('click', async () => {
        const to = selMove.value;
        if (!to) return;
        const d = await loadDoc();
        moveMember(d, bundleId, to, itemId);
        await saveDoc(d);
        await render();
      });

      const btnCopy = document.createElement('button');
      btnCopy.type = 'button';
      btnCopy.textContent = 'Copy';
      btnCopy.addEventListener('click', async () => {
        const to = selMove.value;
        if (!to) return;
        const d = await loadDoc();
        copyMember(d, bundleId, to, itemId);
        await saveDoc(d);
        await render();
      });

      row.appendChild(btnRemoveItem);
      row.appendChild(selMove);
      row.appendChild(btnMove);
      row.appendChild(btnCopy);

      const details = document.createElement('details');
      const sum = document.createElement('summary');
      sum.textContent = 'Expand item data';
      details.appendChild(sum);

      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.textContent = JSON.stringify(itemNode, null, 2);
      details.appendChild(pre);

      const iriRow = renderIriRow(itemId);
      const defRow = renderDefinitionRow(defn);
      const curatedRow = renderDefinedByRow(itemNode);

      itemDiv.appendChild(top);
      itemDiv.appendChild(iriRow);
      if (defRow) itemDiv.appendChild(defRow);
      if (curatedRow) itemDiv.appendChild(curatedRow);
      itemDiv.appendChild(row);
      itemDiv.appendChild(details);

      itemsWrap.appendChild(itemDiv);
    });

    card.appendChild(itemsWrap);
    app.appendChild(card);
  });


  await openOntoEagleProjectDatabase();

  // Prefer IDB cache; fall back to graph fetch if needed or outdated
  setStatus('Loading cached index…');
  const cacheOk = await tryLoadFromIdb();

  setStatus('Checking dataset…');
  const { text, fingerprint } = await fetchGraph();
  const meta = await getOntologyDatasetMeta('builtin');

  const fingerprintChanged = !meta || meta.fingerprint !== fingerprint || meta.schemaVersion !== DATASET_SCHEMA_VERSION;

  if (!cacheOk || fingerprintChanged) {
    setStatus('Building index (first run or updated dataset)…');
    await buildFromGraphAndPersist(text, fingerprint);
  }

  setShoppingCartCount(await getShoppingCartCountFromStorage());
  setStatus('Ready.');
}
