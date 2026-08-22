// @ts-check

/**
 * Project-portfolio persistence for OCD saved diagnostic runs.
 *
 * The app-facing API intentionally preserves the existing `saveRun/listRuns`
 * names while routing storage through the shared IndexedDB data-management
 * package. Stored payloads retain the legacy shape consumed by the current UI.
 */

import {
  DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  PROJECT_RECORD_JSONLD_CONTEXT,
  createProjectPortfolioStores,
  ensureProjectPortfolioProject,
  openProjectPortfolioDatabase
} from '../../packages/indexeddb-data-management/src/index.js';
import { createUuid } from '../../packages/ontology-utils/src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/index.js';

/** @typedef {import('./types.js').RunKind} RunKind */
/** @typedef {import('./types.js').SaveRunInput} SaveRunInput */
/** @typedef {import('./types.js').SavedRun} SavedRun */

export const DB_NAME = 'OntologyWorkbenchProjects';
export const DB_VERSION = 1;

export const STORE_NAMES = Object.freeze({
  runs: 'runs',
  appState: 'settings'
});

const OCD_PROJECT_ID = DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID;
const OCD_APP_ID = 'ontology-curation-manager';
const LAST_RUN_SETTING_KEY = 'ocd.lastRunId';
const THEME_SETTING_KEY = 'theme';

let portfolioPromise = null;

/**
 * Returns the current timestamp in ISO 8601 format.
 *
 * @returns {string}
 */
function nowIso() {
  return new Date().toISOString();
}

/**
 * Creates a JSON-LD string literal.
 *
 * @param {unknown} value
 * @returns {object}
 */
function createJsonLdStringLiteral(value) {
  return { '@value': String(value ?? ''), '@type': COMMON_NAMESPACE_IRIS.xsd.string };
}

/**
 * Creates a JSON-LD dateTime literal.
 *
 * @param {string} value
 * @returns {object}
 */
function createJsonLdDateTimeLiteral(value) {
  return { '@value': value, '@type': COMMON_NAMESPACE_IRIS.xsd.dateTime };
}

/**
 * Reads a scalar value from a JSON-LD property using full IRI keys.
 *
 * @param {object} record
 * @param {string} key
 * @returns {unknown}
 */
function readJsonLdScalarValueForIri(record, key) {
  const value = record?.[key];
  if (value && typeof value === 'object' && !Array.isArray(value) && '@value' in value) {
    return value['@value'];
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && '@id' in value) {
    return value['@id'];
  }
  return value;
}

/**
 * Creates a reasonably unique id for a persisted run.
 *
 * @param {RunKind} prefix
 * @returns {string}
 */
function makeRunId(prefix) {
  return `${prefix}_${createUuid()}`;
}

/**
 * Converts the app-facing saved run DTO into a JSON-LD persisted envelope.
 *
 * The diagnostic report payload itself is preserved under `okea:payload`; the
 * run metadata envelope uses shared ontology-backed keys.
 *
 * @param {SavedRun} run
 * @returns {object}
 */
export function convertSavedDiagnosticRunToJsonLd(run) {
  return {
    '@context': PROJECT_RECORD_JSONLD_CONTEXT,
    '@id': run.id,
    '@type': COMMON_NAMESPACE_IRIS.cceo.ComputerProgramExecution,
    [COMMON_NAMESPACE_IRIS.dcterms.identifier]: createJsonLdStringLiteral(run.id),
    [COMMON_NAMESPACE_IRIS.okea.runKind]: run.kind,
    [COMMON_NAMESPACE_IRIS.dcterms.title]: run.label,
    [COMMON_NAMESPACE_IRIS.dcterms.created]: createJsonLdDateTimeLiteral(run.createdAt),
    [COMMON_NAMESPACE_IRIS.okea.payload]: run.payload,
    [COMMON_NAMESPACE_IRIS.okea.uiState]: run.uiState,
    [COMMON_NAMESPACE_IRIS.okea.appId]: OCD_APP_ID
  };
}

/**
 * Reads the app-facing saved run DTO from either the current JSON-LD envelope
 * or older app-shaped records.
 *
 * @param {object|null|undefined} record
 * @returns {SavedRun|null}
 */
export function readSavedDiagnosticRunFromJsonLd(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  if ('id' in record && 'kind' in record && 'createdAt' in record && 'payload' in record) {
    return /** @type {SavedRun} */ (record);
  }

  const id = String(record['@id'] || readJsonLdScalarValueForIri(record, COMMON_NAMESPACE_IRIS.dcterms.identifier) || '');
  const kind = readJsonLdScalarValueForIri(record, COMMON_NAMESPACE_IRIS.okea.runKind);
  const label = readJsonLdScalarValueForIri(record, COMMON_NAMESPACE_IRIS.dcterms.title);
  const createdAt = readJsonLdScalarValueForIri(record, COMMON_NAMESPACE_IRIS.dcterms.created);
  const payload = record[COMMON_NAMESPACE_IRIS.okea.payload];
  if (!id || (kind !== 'single' && kind !== 'batch') || !createdAt || payload == null) {
    return null;
  }

  return {
    id,
    kind,
    label: String(label || ''),
    createdAt: String(createdAt),
    payload,
    uiState: record[COMMON_NAMESPACE_IRIS.okea.uiState] || null
  };
}

/**
 * Validates the run kind.
 *
 * @param {unknown} value
 * @returns {asserts value is RunKind}
 */
function assertRunKind(value) {
  if (value !== 'single' && value !== 'batch') {
    throw new TypeError(`Invalid run kind: ${String(value)}`);
  }
}

/**
 * Opens shared project portfolio stores used by OCD.
 *
 * @returns {Promise<ReturnType<typeof createProjectPortfolioStores>>}
 */
async function openOcdStores() {
  if (!portfolioPromise) {
    portfolioPromise = openProjectPortfolioDatabase().then(async (db) => {
      const stores = createProjectPortfolioStores(db);
      await ensureProjectPortfolioProject(stores, {
        projectId: OCD_PROJECT_ID,
        label: 'Default Project',
        storageBackend: 'indexeddb'
      });
      return stores;
    });
  }
  return portfolioPromise;
}

/**
 * Opens shared OCD project portfolio stores for feature modules that need
 * artifact/run/settings access without creating app-local IndexedDB schemas.
 *
 * @returns {Promise<ReturnType<typeof createProjectPortfolioStores>>}
 */
export function openOcdProjectStores() {
  return openOcdStores();
}

/**
 * Saves a run and updates the "last" pointer.
 *
 * @param {SaveRunInput} input
 * @returns {Promise<string>}
 */
export async function saveRun(input) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('saveRun() requires an input object.');
  }

  const { kind, label = '', payload, uiState = null } = input;
  assertRunKind(kind);

  if (payload == null) {
    throw new TypeError('saveRun() requires a payload.');
  }

  /** @type {SavedRun} */
  const run = {
    id: makeRunId(kind),
    kind,
    label: String(label || ''),
    createdAt: nowIso(),
    payload,
    uiState
  };

  const stores = await openOcdStores();
  await stores.runs.storeRunRecord({
    runId: run.id,
    projectId: OCD_PROJECT_ID,
    runKind: `diagnostic-${kind}`,
    label: run.label || `Diagnostic ${kind}`,
    createdAt: run.createdAt,
    payload: convertSavedDiagnosticRunToJsonLd(run),
    uiState,
    inputArtifactIds: [],
    outputArtifactIds: [],
    metadata: { [COMMON_NAMESPACE_IRIS.okea.appId]: OCD_APP_ID }
  });

  await stores.settings.writeSettingValue(LAST_RUN_SETTING_KEY, run.id);

  return run.id;
}

/**
 * Lists saved runs in descending createdAt order.
 *
 * @param {number} [limit=50]
 * @returns {Promise<SavedRun[]>}
 */
export async function listRuns(limit = 50) {
  const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 50;
  const stores = await openOcdStores();
  const records = await stores.runs.listRunRecords({ projectId: OCD_PROJECT_ID });
  return records
    .filter((record) => String(record.runKind || '').startsWith('diagnostic-'))
    .map((record) => readSavedDiagnosticRunFromJsonLd(record.payload))
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, normalizedLimit);
}

/**
 * Retrieves a saved run by id.
 *
 * @param {string} runId
 * @returns {Promise<SavedRun | null>}
 */
export async function getRun(runId) {
  if (!runId) {
    return null;
  }

  const stores = await openOcdStores();
  const record = await stores.runs.getRunRecord(runId);
  return readSavedDiagnosticRunFromJsonLd(record?.payload);
}

/**
 * Deletes a saved run. If the deleted run is the current "last" pointer,
 * the pointer is removed as well.
 *
 * @param {string} runId
 * @returns {Promise<boolean>}
 */
export async function deleteRun(runId) {
  if (!runId) {
    return false;
  }

  const stores = await openOcdStores();
  if ((await getLastRunId()) === runId) {
    await stores.settings.deleteSettingRecord(LAST_RUN_SETTING_KEY);
  }
  await stores.runs.deleteRunRecord(runId);
  return true;
}

/**
 * Returns the saved run id stored in the "last" pointer, if any.
 *
 * @returns {Promise<string | null>}
 */
export async function getLastRunId() {
  const stores = await openOcdStores();
  return stores.settings.readSettingValue(LAST_RUN_SETTING_KEY, null);
}

/**
 * Persists one OCD project-scoped setting value in the shared portfolio DB.
 *
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<unknown>}
 */
export async function writeProjectSettingValue(key, value) {
  const stores = await openOcdStores();
  await stores.settings.writeSettingValue(key, value);
  return value;
}

/**
 * Reads one OCD project-scoped setting value from the shared portfolio DB.
 *
 * @template T
 * @param {string} key
 * @param {T} fallbackValue
 * @returns {Promise<T | unknown>}
 */
export async function readProjectSettingValue(key, fallbackValue = null) {
  const stores = await openOcdStores();
  return stores.settings.readSettingValue(key, fallbackValue);
}

/**
 * Persists the OCD theme as an app/user setting.
 *
 * @param {'ocd-theme-light' | 'ocd-theme-dark'} themeClass
 * @returns {Promise<'ocd-theme-light' | 'ocd-theme-dark'>}
 */
export async function writeThemePreference(themeClass) {
  const stores = await openOcdStores();
  await stores.settings.writeSettingValue(THEME_SETTING_KEY, themeClass);
  return themeClass;
}

/**
 * Reads the persisted OCD theme preference.
 *
 * @returns {Promise<'ocd-theme-light' | 'ocd-theme-dark' | null>}
 */
export async function readThemePreference() {
  const stores = await openOcdStores();
  const value = await stores.settings.readSettingValue(THEME_SETTING_KEY, null);
  return value === 'ocd-theme-dark' || value === 'ocd-theme-light' ? value : null;
}
