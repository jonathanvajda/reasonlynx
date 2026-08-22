/**
 * @file Project-portfolio storage for Table Nova runs.
 */

import {
  DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  PROJECT_RECORD_JSONLD_CONTEXT,
  createProjectPortfolioStores,
  ensureProjectPortfolioProject,
  openProjectPortfolioDatabase
} from '../../../packages/indexeddb-data-management/src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../../packages/namespace-registry/src/index.js';

const TABLE_NOVA_PROJECT_ID = DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID;
const TABLE_NOVA_RUN_KIND = 'tabular-to-rdf';

/**
 * @typedef {import('../rdf/buildDataset.js').QuadRecord} QuadRecord
 * @typedef {import('../rdf/schema.js').ColumnSchema} ColumnSchema
 */

/**
 * @typedef {Object} StoredRun
 * @property {string} graphIri
 * @property {string} filename
 * @property {string} createdAtIso
 * @property {QuadRecord[]} quads
 * @property {ColumnSchema[]} [columnSchemas]
 * @property {string} [ontologyTurtle]
 * @property {Record<string, string[]>} [sampleValuesByPredicate]
 */

/**
 * Opens the shared project portfolio for Table Nova.
 *
 * @returns {Promise<{db: IDBDatabase, stores: ReturnType<typeof createProjectPortfolioStores>}>}
 */
export async function openTableNovaDb() {
  const db = await openProjectPortfolioDatabase();
  const stores = createProjectPortfolioStores(db);
  await ensureProjectPortfolioProject(stores, {
    projectId: TABLE_NOVA_PROJECT_ID,
    label: 'Default Project',
    storageBackend: 'indexeddb'
  });
  return { db, stores };
}

/**
 * Stores a Table Nova transformation run in the shared portfolio.
 *
 * @param {{stores: ReturnType<typeof createProjectPortfolioStores>}} db
 * @param {StoredRun} run
 * @returns {Promise<void>}
 */
export async function putRun(db, run) {
  const runId = createRunIdFromGraphIri(run.graphIri);
  await db.stores.runs.storeRunRecord({
    runId,
    projectId: TABLE_NOVA_PROJECT_ID,
    runKind: TABLE_NOVA_RUN_KIND,
    label: run.filename || run.graphIri,
    createdAt: run.createdAtIso,
    payload: convertTableNovaRunToJsonLd({ ...run, runId }),
    metadata: {
      [COMMON_NAMESPACE_IRIS.okea.appId]: 'table-nova'
    },
    inputArtifactIds: [],
    outputArtifactIds: []
  });
}

/**
 * Lists Table Nova runs as metadata expected by the existing UI.
 *
 * @param {{stores: ReturnType<typeof createProjectPortfolioStores>}} db
 * @returns {Promise<Array<Pick<StoredRun,'graphIri'|'filename'|'createdAtIso'>>>}
 */
export async function listRuns(db) {
  const records = await db.stores.runs.listRunRecords({
    projectId: TABLE_NOVA_PROJECT_ID,
    runKind: TABLE_NOVA_RUN_KIND
  });
  return records
    .map((record) => readTableNovaRunFromJsonLd(record.payload))
    .filter(Boolean)
    .map(({ graphIri, filename, createdAtIso }) => ({ graphIri, filename, createdAtIso }))
    .sort((a, b) => String(b.createdAtIso).localeCompare(String(a.createdAtIso)));
}

/**
 * Deletes a Table Nova run by graph IRI.
 *
 * @param {{stores: ReturnType<typeof createProjectPortfolioStores>}} db
 * @param {string} graphIri
 * @returns {Promise<void>}
 */
export async function deleteRun(db, graphIri) {
  await db.stores.runs.deleteRunRecord(createRunIdFromGraphIri(graphIri));
}

/**
 * Gets a full Table Nova run by graph IRI.
 *
 * @param {{stores: ReturnType<typeof createProjectPortfolioStores>}} db
 * @param {string} graphIri
 * @returns {Promise<StoredRun|null>}
 */
export async function getRunDataset(db, graphIri) {
  const record = await db.stores.runs.getRunRecord(createRunIdFromGraphIri(graphIri));
  return readTableNovaRunFromJsonLd(record?.payload) || null;
}

/**
 * Converts Table Nova's existing graph-IRI key into a shared run id.
 *
 * @param {string} graphIri
 * @returns {string}
 */
export function createRunIdFromGraphIri(graphIri) {
  return `run:table-nova:${encodeURIComponent(String(graphIri || 'default'))}`;
}

/**
 * Creates a JSON-LD literal for stored string values.
 *
 * @param {unknown} value Source value.
 * @returns {{'@value': string, '@type': string}|null} JSON-LD literal.
 */
function createJsonLdStringLiteral(value) {
  if (value === null || value === undefined || value === '') return null;
  return {
    '@value': String(value),
    '@type': COMMON_NAMESPACE_IRIS.xsd.string
  };
}

/**
 * Creates a JSON-LD date-time literal.
 *
 * @param {unknown} value Source ISO timestamp.
 * @returns {{'@value': string, '@type': string}|null} JSON-LD date-time literal.
 */
function createJsonLdDateTimeLiteral(value) {
  if (!value) return null;
  return {
    '@value': String(value),
    '@type': COMMON_NAMESPACE_IRIS.xsd.dateTime
  };
}

/**
 * Reads a scalar value from a JSON-LD literal, IRI reference, or legacy value.
 *
 * @param {object} node JSON-LD object.
 * @param {string} iri Full property IRI.
 * @param {unknown} [fallback=''] Fallback value.
 * @returns {unknown} Resolved scalar.
 */
function readJsonLdScalarValueForIri(node, iri, fallback = '') {
  const value = node?.[iri];
  if (value && typeof value === 'object' && !Array.isArray(value) && '@value' in value) return value['@value'];
  if (value && typeof value === 'object' && !Array.isArray(value) && '@id' in value) return value['@id'];
  return value ?? fallback;
}

/**
 * Converts Table Nova's app-facing run DTO to a registry-backed JSON-LD
 * envelope for durable project-portfolio storage.
 *
 * The nested `rdf:value` payload preserves the existing UI DTO because the
 * graph-row migration is a separate project-store concern.
 *
 * @param {StoredRun & {runId?: string}} run Table Nova run.
 * @returns {object} JSON-LD run payload.
 */
export function convertTableNovaRunToJsonLd(run) {
  const runId = run.runId || createRunIdFromGraphIri(run.graphIri);
  return {
    '@context': PROJECT_RECORD_JSONLD_CONTEXT,
    '@id': runId,
    '@type': COMMON_NAMESPACE_IRIS.cceo.ComputerProgramExecution,
    [COMMON_NAMESPACE_IRIS.dcterms.identifier]: createJsonLdStringLiteral(runId),
    [COMMON_NAMESPACE_IRIS.dcterms.title]: createJsonLdStringLiteral(run.filename || run.graphIri),
    [COMMON_NAMESPACE_IRIS.dcterms.created]: createJsonLdDateTimeLiteral(run.createdAtIso),
    [COMMON_NAMESPACE_IRIS.okea.graphIri]: createJsonLdStringLiteral(run.graphIri),
    [COMMON_NAMESPACE_IRIS.okea.runKind]: createJsonLdStringLiteral(TABLE_NOVA_RUN_KIND),
    [COMMON_NAMESPACE_IRIS.rdf.value]: {
      quads: Array.isArray(run.quads) ? run.quads : [],
      columnSchemas: Array.isArray(run.columnSchemas) ? run.columnSchemas : [],
      ontologyTurtle: run.ontologyTurtle || '',
      sampleValuesByPredicate: run.sampleValuesByPredicate || {}
    }
  };
}

/**
 * Reads a Table Nova app-facing run DTO from the JSON-LD storage envelope.
 * Legacy payloads are returned unchanged for existing browser sessions.
 *
 * @param {object|null|undefined} payload Stored run payload.
 * @returns {StoredRun|null} App-facing run DTO.
 */
export function readTableNovaRunFromJsonLd(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (!payload['@context']) return payload;

  const value = payload[COMMON_NAMESPACE_IRIS.rdf.value] || {};
  return {
    graphIri: String(readJsonLdScalarValueForIri(payload, COMMON_NAMESPACE_IRIS.okea.graphIri, '') || ''),
    filename: String(readJsonLdScalarValueForIri(payload, COMMON_NAMESPACE_IRIS.dcterms.title, '') || ''),
    createdAtIso: String(readJsonLdScalarValueForIri(payload, COMMON_NAMESPACE_IRIS.dcterms.created, '') || ''),
    quads: Array.isArray(value.quads) ? value.quads : [],
    columnSchemas: Array.isArray(value.columnSchemas) ? value.columnSchemas : [],
    ontologyTurtle: value.ontologyTurtle || '',
    sampleValuesByPredicate: value.sampleValuesByPredicate || {}
  };
}
