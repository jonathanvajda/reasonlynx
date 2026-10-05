// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Jonathan Vajda

import { COMMON_NAMESPACE_IRIS } from '../packages/namespace-registry/src/index.js';
import {
  createProjectPortfolioStores,
  DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  ensureProjectPortfolioProject,
  inspectLegacyIndexedDbDatabase,
  openProjectPortfolioDatabase,
  readLegacyObjectStoreRows
} from '../packages/indexeddb-data-management/src/index.js';

const CQ_DB_NAME = 'CQDatabase';
const CQ_STORE = 'CQStore';
const ACTIVE_PROJECT_SETTING_KEY = 'workspace.activeProjectId';
const RDF_TYPE = COMMON_NAMESPACE_IRIS.rdf.type;
const LABEL_PREDICATES = Object.freeze([
  COMMON_NAMESPACE_IRIS.rdfs.label,
  COMMON_NAMESPACE_IRIS.skos.prefLabel,
  COMMON_NAMESPACE_IRIS.dcterms.title
]);

let portfolioDbPromise = null;
let activeProjectId = DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID;
let initializedProjectId = null;

/** @returns {string} Currently selected shared project identifier. */
export function getCompetencyQuestionProjectId() {
  return activeProjectId;
}

/** @param {string} projectId Shared project identifier. @returns {Promise<string>} Selected identifier. */
export async function selectCompetencyQuestionProject(projectId) {
  activeProjectId = String(projectId || DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID);
  initializedProjectId = null;
  await projectPortfolioStores();
  return activeProjectId;
}

async function portfolioDatabase() {
  portfolioDbPromise ||= openProjectPortfolioDatabase();
  return portfolioDbPromise;
}

async function readShellProjectId() {
  const stores = createProjectPortfolioStores(await portfolioDatabase(), {
    projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID
  });
  return stores.settings.readSettingValue(ACTIVE_PROJECT_SETTING_KEY, DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID);
}

async function projectPortfolioStores() {
  const stores = createProjectPortfolioStores(await portfolioDatabase(), { projectId: activeProjectId });
  await ensureProjectPortfolioProject(stores, {
    projectId: activeProjectId,
    label: activeProjectId === DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID ? 'Default Cross-App Workspace' : activeProjectId,
    tags: ['cross-app', 'ontology-workbench'],
    metadata: { apps: ['CQ Ferret'] }
  });
  return stores;
}

function workspaceArtifactId(projectId = activeProjectId) {
  return `artifact:cq-ferret:workspace:${encodeURIComponent(projectId)}`;
}

function termListArtifactId(projectId = activeProjectId) {
  return `artifact:cq-ferret:term-list:${encodeURIComponent(projectId)}`;
}

function nodeId(node) {
  return node?.['@id'] || node?.id || '';
}

function normalizeNode(node) {
  const id = nodeId(node);
  if (!id) return null;
  const normalized = { ...node, '@id': id };
  delete normalized.id;
  return normalized;
}

function nodesFromArtifact(artifact) {
  const graph = artifact?.payload?.['@graph'];
  return Array.isArray(graph) ? graph.map(normalizeNode).filter(Boolean) : [];
}

async function writeWorkspace(nodes, {
  runKind = 'competency-question-save',
  label = 'Saved CQ Ferret workspace',
  source = { origin: 'generated', application: 'cq-ferret' }
} = {}) {
  const normalized = (Array.isArray(nodes) ? nodes : []).map(normalizeNode).filter(Boolean);
  const artifactId = workspaceArtifactId();
  const { artifacts, runs } = await projectPortfolioStores();
  const artifact = await artifacts.storeProjectArtifact({
    artifactId,
    projectId: activeProjectId,
    artifactKind: 'competency-question-set',
    role: 'staged',
    label: 'CQ Ferret competency-question workspace',
    mediaType: 'application/ld+json',
    extension: 'jsonld',
    source,
    summary: { nodeCount: normalized.length }
  }, { '@graph': normalized });
  const run = await runs.storeRunRecord({
    projectId: activeProjectId,
    runKind,
    label,
    outputArtifactIds: [artifactId],
    payload: { nodeCount: normalized.length }
  });
  return { artifact, run };
}

/**
 * Initializes from the shell and non-destructively imports legacy nodes only
 * when the selected project has no CQ workspace. The legacy DB is retained.
 *
 * @returns {Promise<object>} Initialization/migration result.
 */
export async function initCompetencyQuestionStore() {
  if (!initializedProjectId) activeProjectId = await readShellProjectId();
  const stores = await projectPortfolioStores();
  const existing = await stores.artifacts.getProjectArtifact(workspaceArtifactId());
  if (existing) {
    initializedProjectId = activeProjectId;
    return { projectId: activeProjectId, migrated: false, nodeCount: nodesFromArtifact(existing).length };
  }

  let legacyRows = [];
  const legacy = await inspectLegacyIndexedDbDatabase(CQ_DB_NAME);
  const isLegacyMigrationTarget = activeProjectId === DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID;
  if (isLegacyMigrationTarget && hasLegacyCqStore(legacy)) {
    legacyRows = await readLegacyObjectStoreRows(CQ_DB_NAME, CQ_STORE);
  }
  const nodes = legacyRows.map(normalizeNode).filter(Boolean);
  if (nodes.length) {
    await writeWorkspace(nodes, {
      runKind: 'legacy-import',
      label: `Migrated ${nodes.length} CQ Ferret graph nodes`,
      source: { origin: 'legacy-indexeddb', databaseName: CQ_DB_NAME, objectStoreName: CQ_STORE }
    });
  }
  initializedProjectId = activeProjectId;
  return {
    projectId: activeProjectId,
    migrated: nodes.length > 0,
    nodeCount: nodes.length,
    legacy: {
      databaseName: CQ_DB_NAME,
      sourceCount: legacyRows.length,
      retained: legacy.exists,
      eligibleForImport: isLegacyMigrationTarget
    }
  };
}

/** @returns {Promise<object[]>} CQ graph nodes in the active shared project. */
export async function readCompetencyQuestionNodes() {
  await initCompetencyQuestionStore();
  const { artifacts } = await projectPortfolioStores();
  return nodesFromArtifact(await artifacts.getProjectArtifact(workspaceArtifactId()));
}

/** @param {object[]} nodes Nodes to upsert. @returns {Promise<number>} Upsert count. */
export async function storeCompetencyQuestionNodes(nodes) {
  const byId = new Map((await readCompetencyQuestionNodes()).map((node) => [nodeId(node), node]));
  let count = 0;
  for (const rawNode of Array.isArray(nodes) ? nodes : []) {
    const node = normalizeNode(rawNode);
    if (!node) continue;
    byId.set(node['@id'], node);
    count += 1;
  }
  await writeWorkspace([...byId.values()], {
    runKind: 'competency-question-node-upsert',
    label: `Stored ${count} CQ graph node${count === 1 ? '' : 's'}`
  });
  return count;
}

/**
 * Atomically applies GDCManager cleanup and upserts to the shared artifact.
 * @param {object[]} nodesToUpsert Nodes to save.
 * @param {string[]} idsToDelete Nodes to remove first.
 * @returns {Promise<number>} Final node count.
 */
export async function replaceCompetencyQuestionNodes(nodesToUpsert, idsToDelete = []) {
  const byId = new Map((await readCompetencyQuestionNodes()).map((node) => [nodeId(node), node]));
  for (const id of idsToDelete) byId.delete(id);
  for (const rawNode of nodesToUpsert || []) {
    const node = normalizeNode(rawNode);
    if (node) byId.set(node['@id'], node);
  }
  await writeWorkspace([...byId.values()]);
  return byId.size;
}

/** @param {string} cqId CQ identifier. @returns {Promise<number>} Deleted count. */
export async function deleteCompetencyQuestionById(cqId) {
  const uniqueId = String(cqId || '').split('_').pop();
  if (!uniqueId) return 0;
  const current = await readCompetencyQuestionNodes();
  const retained = current.filter((node) => !nodeId(node).includes(`_${uniqueId}`));
  const count = current.length - retained.length;
  if (count) await writeWorkspace(retained, { runKind: 'competency-question-delete', label: `Deleted ${count} CQ graph nodes` });
  return count;
}

/** @param {string[]} ids Node identifiers. @returns {Promise<number>} Deleted count. */
export async function deleteCompetencyQuestionNodesByIds(ids) {
  const deleteIds = new Set(ids || []);
  const current = await readCompetencyQuestionNodes();
  const retained = current.filter((node) => !deleteIds.has(nodeId(node)));
  const count = current.length - retained.length;
  if (count) await writeWorkspace(retained, { runKind: 'competency-question-node-delete', label: `Deleted ${count} CQ graph nodes` });
  return count;
}

/** Backward-compatible explicit snapshot API. */
export async function recordCompetencyQuestionProjectSnapshot(nodes, options = {}) {
  return writeWorkspace(nodes, options);
}

/** @param {object[]} rows Vocabulary rows. @returns {Promise<object>} Term-list artifact. */
export async function publishCompetencyQuestionTermList(rows) {
  const payload = createTermListPayload(rows);
  const terms = payload.terms;
  const artifactId = termListArtifactId();
  const { artifacts, runs } = await projectPortfolioStores();
  const artifact = await artifacts.storeProjectArtifact({
    artifactId,
    projectId: activeProjectId,
    artifactKind: 'term-list',
    role: 'staged',
    label: 'CQ Ferret extracted term list',
    mediaType: 'application/vnd.reasonlynx.term-list+json',
    extension: 'json',
    source: { origin: 'generated', application: 'cq-ferret' },
    provenance: { derivedFrom: [workspaceArtifactId()] },
    summary: { termCount: terms.length }
  }, payload);
  await runs.storeRunRecord({
    projectId: activeProjectId,
    runKind: 'term-extraction',
    label: `Published ${terms.length} CQ terms`,
    inputArtifactIds: [workspaceArtifactId()],
    outputArtifactIds: [artifactId],
    payload: { termCount: terms.length }
  });
  return artifact;
}

/** @param {object[]} rows Vocabulary rows. @returns {{schemaVersion: number, terms: object[]}} Portable payload. */
export function createTermListPayload(rows) {
  const terms = (rows || []).filter((row) => row?.label).map((row) => ({
    iri: row.iri || '', label: row.label, elementType: row.elementType || '',
    definition: row.definition || '', broaderLabel: row.isA || '', definedBy: row.isDefinedBy || ''
  }));
  return { schemaVersion: 1, terms };
}

/** @returns {Promise<object[]>} Saved SPARQL query artifacts in the active project. */
export async function listSavedSparqlQueries() {
  const { artifacts } = await projectPortfolioStores();
  const records = await artifacts.listProjectArtifacts(activeProjectId, { artifactKind: 'sparql-query' });
  return records.map((record) => ({
    artifactId: record.artifactId,
    label: record.label,
    query: extractSparqlQueryText(record.payload)
  })).filter((record) => record.query);
}

/** @param {unknown} payload Stored query payload. @returns {string} Query text. */
export function extractSparqlQueryText(payload) {
  if (typeof payload === 'string') return payload;
  const rdfValue = payload?.[COMMON_NAMESPACE_IRIS.rdf.value];
  const value = Array.isArray(rdfValue) ? rdfValue[0] : rdfValue;
  return payload?.query || payload?.text || payload?.value
    || (typeof value === 'object' ? value?.['@value'] || value?.['@id'] : value)
    || '';
}

/**
 * Finds directly typed entities in materialized project knowledge graphs.
 * @param {string[]} typeIris RDF class IRIs.
 * @returns {Promise<object[]>} Entity IRIs and labels.
 */
export async function listKnowledgeBaseEntities(typeIris) {
  const { quadRows } = await projectPortfolioStores();
  const rows = await quadRows.listQuadRows({ projectId: activeProjectId });
  return findTypedEntities(rows, typeIris);
}

/**
 * Resolves directly typed entities and their labels from canonical quad rows.
 * @param {object[]} rows Canonical quad rows.
 * @param {string[]} typeIris Accepted RDF class IRIs.
 * @returns {object[]} Entity IRIs and labels.
 */
export function findTypedEntities(rows, typeIris) {
  const requested = new Set(typeIris || []);
  const entityIds = new Set((rows || []).filter((row) => row.predicate === RDF_TYPE && requested.has(row.object)).map((row) => row.subject));
  const labels = new Map();
  for (const row of rows || []) {
    if (entityIds.has(row.subject) && LABEL_PREDICATES.includes(row.predicate)) labels.set(row.subject, row.object);
  }
  return [...entityIds].map((iri) => ({ iri, label: labels.get(iri) || iri })).sort((a, b) => a.label.localeCompare(b.label));
}

/** @returns {Promise<object>} Non-destructive legacy/shared record counts. */
export async function inspectCompetencyQuestionMigration() {
  const legacy = await inspectLegacyIndexedDbDatabase(CQ_DB_NAME);
  const legacyRows = hasLegacyCqStore(legacy)
    ? await readLegacyObjectStoreRows(CQ_DB_NAME, CQ_STORE)
    : [];
  return {
    legacyDatabase: CQ_DB_NAME,
    legacyExists: legacy.exists,
    legacyCount: legacyRows.length,
    sharedProjectId: activeProjectId,
    sharedCount: (await readCompetencyQuestionNodes()).length,
    deletionRequiresConfirmation: true
  };
}

/**
 * Tests the canonical IndexedDB inspection result for CQ Ferret's legacy store.
 *
 * @param {{exists?: boolean, stores?: string[]}|null} inspection Inspection result.
 * @returns {boolean} Whether the legacy CQ store exists.
 */
export function hasLegacyCqStore(inspection) {
  return inspection?.exists === true && Array.isArray(inspection.stores) && inspection.stores.includes(CQ_STORE);
}

if (typeof document !== 'undefined') {
  document.addEventListener('sitehdr:project-changed', (event) => {
    selectCompetencyQuestionProject(event.detail?.projectId).catch(console.error);
  });
}

globalThis.cqFerretReplaceNodes = replaceCompetencyQuestionNodes;
