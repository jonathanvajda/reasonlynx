// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Jonathan Vajda

import {
  createDatasetStore,
  createIndexedDbRecordAdapter,
  createProjectPortfolioStores,
  DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  ensureProjectPortfolioProject,
  openIndexedDbStore,
  openProjectPortfolioDatabase,
  resolveIdbRequest,
  runObjectStoreTransaction
} from '../packages/indexeddb-data-management/src/index.js';

const DB_NAME = 'OntoEagleDB';
const DB_VERSION = 4;
const SETTINGS_STORE = 'settings';
const DATASETS_STORE = 'datasets';
const DOCUMENTS_STORE = 'documents';
const INDEX_STORE = 'index';
const ACTIVE_SETTINGS_KEY = 'active';
const LEGACY_LOCAL_STORAGE_SETTING_KEYS = Object.freeze([
  'onto.bundles.jsonld',
  'ontoeagle:ontologyRegistryOverrides',
  'ontoeagle:ontologyMetadataSnapshot:v1',
  'ontoeagle:userOntologyRecords:v1'
]);
export const ONTOEAGLE_ACTIVE_PROJECT_ID = DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID;

const ONTOEAGLE_DB_SCHEMA = Object.freeze({
  name: DB_NAME,
  version: DB_VERSION,
  stores: Object.freeze([
    Object.freeze({ name: SETTINGS_STORE }),
    Object.freeze({ name: DATASETS_STORE }),
    Object.freeze({ name: DOCUMENTS_STORE }),
    Object.freeze({ name: INDEX_STORE })
  ])
});

let dbPromise = null;
let portfolioDbPromise = null;
let migrationPromise = null;

/**
 * Opens the OntoEagle application database.
 *
 * The schema intentionally preserves the old `OntoEagleDB` object stores so
 * existing browser data remains readable after the package migration.
 *
 * @returns {Promise<IDBDatabase>} Open IndexedDB database.
 */
export async function openOntoEagleProjectDatabase() {
  if (!dbPromise) dbPromise = openIndexedDbStore(ONTOEAGLE_DB_SCHEMA);
  const db = await dbPromise;
  if (!migrationPromise) migrationPromise = migrateOntoEagleProjectDatabase();
  await migrationPromise;
  return db;
}

async function adapterFor(storeName) {
  return createIndexedDbRecordAdapter(await openOntoEagleProjectDatabase(), storeName);
}

async function rawAdapterFor(storeName, options = {}) {
  return createIndexedDbRecordAdapter(await dbPromise, storeName, options);
}

async function datasetStore() {
  return createDatasetStore(await adapterFor(DATASETS_STORE));
}

async function projectPortfolioStores() {
  if (!portfolioDbPromise) portfolioDbPromise = openProjectPortfolioDatabase();
  const stores = createProjectPortfolioStores(await portfolioDbPromise, {
    projectId: ONTOEAGLE_ACTIVE_PROJECT_ID
  });
  await ensureProjectPortfolioProject(stores, {
    projectId: ONTOEAGLE_ACTIVE_PROJECT_ID,
    label: 'Default Cross-App Workspace',
    tags: ['cross-app', 'ontology-workbench'],
    metadata: {
      apps: ['OntoEagle'],
      purpose: 'Shared project for artifacts contributed across ontology tools'
    }
  });
  return stores;
}

function docKey(datasetId, iri) {
  return `${datasetId}::${iri}`;
}

function normalizeDatasetMeta(datasetId, meta = {}) {
  const now = new Date().toISOString();
  const metadata = meta.metadata && typeof meta.metadata === 'object'
    ? { ...meta.metadata }
    : { ...meta };
  return {
    datasetId,
    projectId: meta.projectId || ONTOEAGLE_ACTIVE_PROJECT_ID,
    source: meta.source || (datasetId === 'builtin' ? 'builtin' : 'user'),
    label: meta.label || meta.ontologyName || meta.fileName || datasetId,
    fileName: meta.fileName || '',
    fingerprint: meta.fingerprint || '',
    documentCount: Number.isFinite(meta.documentCount) ? meta.documentCount : 0,
    ontologyCount: Number.isFinite(meta.ontologyCount) ? meta.ontologyCount : 0,
    schemaVersion: Number.isInteger(meta.schemaVersion) ? meta.schemaVersion : 1,
    enabled: meta.enabled !== false,
    createdAt: meta.createdAt || now,
    updatedAt: meta.updatedAt || now,
    metadata
  };
}

function restoreDatasetMeta(record) {
  if (!record) return null;
  return {
    ...(record.metadata && typeof record.metadata === 'object' ? record.metadata : {}),
    ...record,
    ontologyName: record.metadata?.ontologyName || record.ontologyName || record.label,
    enabled: record.enabled !== false
  };
}

function datasetInclusionId(datasetId) {
  return `inclusion:ontoeagle:${datasetId}`;
}

function datasetArtifactId(datasetId) {
  return `artifact:ontoeagle:${datasetId}:documents`;
}

function datasetWorkspaceInclusionRecord(datasetId, meta = {}) {
  const isBuiltin = (meta.source || (datasetId === 'builtin' ? 'builtin' : 'user')) === 'builtin';
  return {
    inclusionId: datasetInclusionId(datasetId),
    projectId: ONTOEAGLE_ACTIVE_PROJECT_ID,
    targetType: isBuiltin ? 'reference-dataset' : 'artifact',
    targetId: isBuiltin ? `reference:ontoeagle:${datasetId}` : datasetArtifactId(datasetId),
    role: isBuiltin ? 'imported-reference' : 'project-source',
    enabled: meta.enabled !== false,
    graphIri: isBuiltin ? `urn:graph:reference:ontoeagle:${datasetId}` : `urn:graph:project:${ONTOEAGLE_ACTIVE_PROJECT_ID}:ontoeagle:${datasetId}`,
    includeMode: isBuiltin ? 'read-only' : 'editable',
    metadata: {
      app: 'OntoEagle',
      datasetId,
      datasetSource: isBuiltin ? 'builtin' : 'user'
    }
  };
}

async function ensureDefaultProject() {
  await projectPortfolioStores();
}

async function migrateLegacyActiveSettings() {
  const settingsAdapter = await rawAdapterFor(SETTINGS_STORE);
  const { settings } = await projectPortfolioStores();
  const migrated = await settings.readSettingValue(ACTIVE_SETTINGS_KEY, null);
  if (migrated) return;

  const raw = await settingsAdapter.get(ACTIVE_SETTINGS_KEY);
  if (raw) await settings.writeSettingValue(ACTIVE_SETTINGS_KEY, raw);
}

async function migrateLegacyDatasetRecords() {
  const adapter = await rawAdapterFor(DATASETS_STORE);
  const { inclusions } = await projectPortfolioStores();
  const records = await adapter.list();
  for (const record of records) {
    if (!record) continue;
    const migrated = record.projectId === ONTOEAGLE_ACTIVE_PROJECT_ID ? restoreDatasetMeta(record) : normalizeDatasetMeta(record.datasetId, record);
    await adapter.put(migrated.datasetId, migrated);
    await inclusions.storeWorkspaceInclusion(datasetWorkspaceInclusionRecord(migrated.datasetId, migrated));
  }
}

function readLegacyLocalStorageJson(key) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return { found: false, value: null };
    return { found: true, value: JSON.parse(raw) };
  } catch (_error) {
    return { found: false, value: null };
  }
}

function removeLegacyLocalStorageKey(key) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch (_error) {
    // Legacy cleanup is best-effort after data has been copied to IndexedDB.
  }
}

async function migrateLegacyLocalStorageSettings() {
  const { settings } = await projectPortfolioStores();
  for (const key of LEGACY_LOCAL_STORAGE_SETTING_KEYS) {
    const existing = await settings.readSettingValue(key, undefined);
    const legacy = readLegacyLocalStorageJson(key);
    if (legacy.found && existing === undefined) {
      await settings.writeSettingValue(key, legacy.value);
    }
    if (legacy.found) removeLegacyLocalStorageKey(key);
  }
}

async function migrateOntoEagleProjectDatabase() {
  await ensureDefaultProject();
  await migrateLegacyActiveSettings();
  await migrateLegacyDatasetRecords();
  await migrateLegacyLocalStorageSettings();
}

/**
 * Reads the active OntoEagle search settings.
 *
 * @returns {Promise<object|null>} Saved settings or null.
 */
export async function getActiveSearchSettings() {
  const { settings } = await projectPortfolioStores();
  return settings.readSettingValue(ACTIVE_SETTINGS_KEY, null);
}

/**
 * Stores the active OntoEagle search settings.
 *
 * @param {object} settingsObj Search settings object.
 * @returns {Promise<object>} Stored settings.
 */
export async function setActiveSearchSettings(settingsObj) {
  const { settings } = await projectPortfolioStores();
  await settings.writeSettingValue(ACTIVE_SETTINGS_KEY, settingsObj);
  return settingsObj;
}

/**
 * Reads an OntoEagle app/project setting from the shared project portfolio.
 *
 * @param {string} key Setting key.
 * @param {any} [fallbackValue=null] Value returned when no setting is stored.
 * @returns {Promise<any>} Stored value or fallback.
 */
export async function getOntoEagleAppSetting(key, fallbackValue = null) {
  await openOntoEagleProjectDatabase();
  const { settings } = await projectPortfolioStores();
  return settings.readSettingValue(key, fallbackValue);
}

/**
 * Stores an OntoEagle app/project setting in the shared project portfolio.
 *
 * @param {string} key Setting key.
 * @param {any} value JSON-serializable setting value.
 * @returns {Promise<any>} Stored value.
 */
export async function setOntoEagleAppSetting(key, value) {
  await openOntoEagleProjectDatabase();
  const { settings } = await projectPortfolioStores();
  await settings.writeSettingValue(key, value);
  return value;
}

/**
 * Deletes an OntoEagle app/project setting from the shared project portfolio.
 *
 * @param {string} key Setting key.
 * @returns {Promise<boolean>} True when deletion completes.
 */
export async function deleteOntoEagleAppSetting(key) {
  await openOntoEagleProjectDatabase();
  const { settings } = await projectPortfolioStores();
  return settings.deleteSettingRecord(key);
}

/**
 * Reads one dataset metadata record.
 *
 * @param {string} datasetId Dataset id.
 * @returns {Promise<object|null>} Dataset metadata.
 */
export async function getOntologyDatasetMeta(datasetId) {
  const record = await (await datasetStore()).listDatasetRecords(ONTOEAGLE_ACTIVE_PROJECT_ID);
  return restoreDatasetMeta(record.find((meta) => meta.datasetId === datasetId) || null);
}

/**
 * Stores dataset metadata while preserving OntoEagle's existing meta shape.
 *
 * @param {string} datasetId Dataset id.
 * @param {object} meta Metadata patch.
 * @returns {Promise<object>} Stored metadata.
 */
export async function storeOntologyDatasetMeta(datasetId, meta) {
  const record = await (await datasetStore()).storeDatasetRecord(normalizeDatasetMeta(datasetId, meta));
  const { inclusions } = await projectPortfolioStores();
  await inclusions.storeWorkspaceInclusion(datasetWorkspaceInclusionRecord(datasetId, restoreDatasetMeta(record)));
  return restoreDatasetMeta(record);
}

/**
 * Lists all dataset metadata records.
 *
 * @returns {Promise<object[]>} Dataset metadata records.
 */
export async function listOntologyDatasetMeta() {
  const records = await (await datasetStore()).listDatasetRecords(ONTOEAGLE_ACTIVE_PROJECT_ID);
  return records.map(restoreDatasetMeta);
}

/**
 * Deletes one dataset metadata record.
 *
 * @param {string} datasetId Dataset id.
 * @returns {Promise<boolean>} True when the delete request completes.
 */
export async function deleteOntologyDatasetMeta(datasetId) {
  return (await datasetStore()).deleteDataset(datasetId);
}

/**
 * Stores extracted ontology documents for one dataset.
 *
 * @param {string} datasetId Dataset id.
 * @param {object[]} docs Extracted ontology documents.
 * @returns {Promise<number>} Number of stored documents.
 */
export async function storeOntologyDatasetDocuments(datasetId, docs) {
  const adapter = await adapterFor(DOCUMENTS_STORE);
  const sourceDocs = Array.isArray(docs) ? docs : [];
  let count = 0;
  for (const doc of sourceDocs) {
    if (!doc || typeof doc.iri !== 'string') continue;
    await adapter.put(docKey(datasetId, doc.iri), { datasetId, ...doc });
    count += 1;
  }
  const { artifacts } = await projectPortfolioStores();
  await artifacts.storeProjectArtifact({
    artifactId: datasetArtifactId(datasetId),
    projectId: ONTOEAGLE_ACTIVE_PROJECT_ID,
    artifactKind: 'ontology-documents',
    role: datasetId === 'builtin' ? 'loaded' : 'source',
    label: `${datasetId} ontology documents`,
    summary: { documentCount: count }
  }, {
    datasetId,
    documentCount: count,
    storedInObjectStore: DOCUMENTS_STORE
  });
  return count;
}

/**
 * Lists all documents for one dataset.
 *
 * @param {string} datasetId Dataset id.
 * @returns {Promise<object[]>} Dataset documents.
 */
export async function listOntologyDatasetDocuments(datasetId) {
  const docs = await (await adapterFor(DOCUMENTS_STORE)).list();
  return docs.filter((doc) => doc && typeof doc.iri === 'string' && doc.datasetId === datasetId);
}

/**
 * Clears every stored document.
 *
 * @returns {Promise<void>}
 */
export async function clearOntologyDatasetDocuments() {
  await (await adapterFor(DOCUMENTS_STORE)).clear();
}

/**
 * Deletes all documents for one dataset.
 *
 * @param {string} datasetId Dataset id.
 * @returns {Promise<number>} Number of deleted documents.
 */
export async function deleteOntologyDatasetDocuments(datasetId) {
  const db = await openOntoEagleProjectDatabase();
  const prefix = `${datasetId}::`;
  return runObjectStoreTransaction(db, DOCUMENTS_STORE, 'readwrite', async (store) => {
    const keys = await resolveIdbRequest(store.getAllKeys());
    let count = 0;
    for (const key of keys || []) {
      if (String(key).startsWith(prefix)) {
        store.delete(key);
        count += 1;
      }
    }
    return count;
  });
}

/**
 * Lists documents belonging to enabled datasets.
 *
 * @returns {Promise<object[]>} Enabled ontology documents.
 */
export async function listEnabledOntologyDocuments() {
  const { inclusions } = await projectPortfolioStores();
  const activeInclusions = await inclusions.listWorkspaceInclusions(ONTOEAGLE_ACTIVE_PROJECT_ID, { enabledOnly: true });
  const enabledIds = new Set(activeInclusions.map((inclusion) => inclusion.metadata?.datasetId).filter(Boolean));
  if (!enabledIds.size) {
    const metas = await listOntologyDatasetMeta();
    metas.filter((meta) => meta && meta.enabled !== false).forEach((meta) => enabledIds.add(meta.datasetId));
  }
  const docs = await (await adapterFor(DOCUMENTS_STORE)).list();
  return docs.filter((doc) => doc && typeof doc.iri === 'string' && enabledIds.has(doc.datasetId));
}

/**
 * Enables or disables a dataset.
 *
 * @param {string} datasetId Dataset id.
 * @param {boolean} enabled Whether the dataset is enabled.
 * @returns {Promise<object|null>} Updated metadata or null.
 */
export async function setOntologyDatasetEnabled(datasetId, enabled) {
  const record = await (await datasetStore()).setDatasetEnabled(datasetId, enabled);
  if (record) {
    const { inclusions } = await projectPortfolioStores();
    await inclusions.storeWorkspaceInclusion(datasetWorkspaceInclusionRecord(datasetId, restoreDatasetMeta(record)));
  }
  return restoreDatasetMeta(record);
}

/**
 * Deletes a dataset's documents, metadata, and cached index.
 *
 * @param {string} datasetId Dataset id.
 * @returns {Promise<boolean>} True when complete.
 */
export async function deleteOntologyDataset(datasetId) {
  await deleteOntologyDatasetDocuments(datasetId);
  await deleteOntologyDatasetMeta(datasetId);
  await (await adapterFor(INDEX_STORE)).delete(datasetId);
  const { artifacts, inclusions } = await projectPortfolioStores();
  await artifacts.deleteProjectArtifact(datasetArtifactId(datasetId));
  await inclusions.deleteWorkspaceInclusion(datasetInclusionId(datasetId));
  return true;
}

/**
 * Reads a cached search index for one dataset.
 *
 * @param {string} datasetId Dataset id.
 * @returns {Promise<object|null>} Cached index.
 */
export async function getOntologySearchIndex(datasetId) {
  return (await adapterFor(INDEX_STORE)).get(datasetId);
}

/**
 * Stores a cached search index for one dataset.
 *
 * @param {string} datasetId Dataset id.
 * @param {object} indexObj Index object.
 * @returns {Promise<object>} Stored index object.
 */
export async function storeOntologySearchIndex(datasetId, indexObj) {
  await (await adapterFor(INDEX_STORE)).put(datasetId, indexObj);
  const { artifacts } = await projectPortfolioStores();
  await artifacts.storeProjectArtifact({
    artifactId: `artifact:ontoeagle:${datasetId}:search-index`,
    projectId: ONTOEAGLE_ACTIVE_PROJECT_ID,
    artifactKind: 'search-index',
    role: 'transformed',
    label: `${datasetId} search index`,
    provenance: { derivedFrom: [datasetArtifactId(datasetId)] },
    summary: {
      keys: indexObj && typeof indexObj === 'object' ? Object.keys(indexObj).length : 0
    }
  }, {
    datasetId,
    storedInObjectStore: INDEX_STORE
  });
  return indexObj;
}

/**
 * Clears all cached search indexes.
 *
 * @returns {Promise<void>}
 */
export async function clearOntologySearchIndex() {
  await (await adapterFor(INDEX_STORE)).clear();
}

/**
 * Records an OntoEagle operation in the project-oriented run history.
 *
 * @param {object} record Run-like record.
 * @returns {Promise<object>} Stored run record.
 */
export async function storeOntoEagleRunRecord(record) {
  const { runs } = await projectPortfolioStores();
  return runs.storeRunRecord({
    projectId: ONTOEAGLE_ACTIVE_PROJECT_ID,
    ...record
  });
}
