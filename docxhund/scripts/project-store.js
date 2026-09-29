import {
  convertRdfJsQuadsToQuadRows,
  createProjectPortfolioStores,
  createStableRecordId,
  ensureProjectPortfolioProject,
  openProjectPortfolioDatabase,
  storeGraphQuadRows
} from '../../packages/indexeddb-data-management/src/index.js';
import { normalizeSupportedMimeType } from '../../packages/format-registry/src/mime-registry.js';

export const DOCXHUND_DEFAULT_PROJECT_ID = 'project:docxhund-default';
const DOCX_FORMAT = normalizeSupportedMimeType('docx').value;
const TURTLE_FORMAT = normalizeSupportedMimeType('text/turtle').value;

/**
 * Persistent project workspace for DocxHund. This is a thin application
 * service over the shared project-portfolio stores, not a parallel schema.
 */
export class DocxHundProjectStore {
  /** @param {object} [options] */
  constructor(options = {}) {
    this.openDatabase = options.openDatabase || openProjectPortfolioDatabase;
    this.activeProjectId = options.projectId || DOCXHUND_DEFAULT_PROJECT_ID;
    this.db = null;
    this.stores = null;
  }

  /** @returns {Promise<object>} */
  async initialize() {
    this.db = await this.openDatabase();
    await this.selectProject(this.activeProjectId);
    return this.snapshot();
  }

  /** @param {string} projectId @returns {Promise<object>} */
  async selectProject(projectId) {
    this.activeProjectId = projectId;
    this.stores = createProjectPortfolioStores(this.db, { projectId });
    await ensureProjectPortfolioProject(this.stores, {
      projectId,
      label: projectId === DOCXHUND_DEFAULT_PROJECT_ID ? 'DocxHund Workspace' : projectId,
      tags: ['docxhund']
    });
    return this.snapshot();
  }

  /** @param {string} label @returns {Promise<object>} */
  async createProject(label) {
    const cleanLabel = String(label || '').trim();
    if (!cleanLabel) throw new TypeError('Project name is required.');
    const projectId = createStableRecordId('project', ['docxhund', cleanLabel, Date.now()]);
    this.activeProjectId = projectId;
    this.stores = createProjectPortfolioStores(this.db, { projectId });
    await this.stores.projects.createProject({ projectId, label: cleanLabel, tags: ['docxhund'] });
    return this.snapshot();
  }

  /** @returns {Promise<object>} */
  async snapshot() {
    const [projects, artifacts, datasets, inclusions] = await Promise.all([
      this.stores.projects.listProjects(),
      this.stores.artifacts.listProjectArtifacts(this.activeProjectId, { includePayload: false }),
      this.stores.datasets.listDatasetRecords(this.activeProjectId),
      this.stores.inclusions.listWorkspaceInclusions(this.activeProjectId)
    ]);
    return { activeProjectId: this.activeProjectId, projects, artifacts, datasets, inclusions };
  }

  /**
   * Persist a source DOCX and its current derived representation.
   * @param {File} file
   * @param {object} result
   * @param {string} turtle
   * @returns {Promise<object>}
   */
  async storeDocument(file, result, turtle) {
    const artifactId = createStableRecordId('artifact', [this.activeProjectId, 'docx', file.name]);
    const rdfArtifactId = createStableRecordId('artifact', [this.activeProjectId, 'document-rdf', file.name]);
    const payload = {
      source: await file.arrayBuffer(),
      document: result,
      turtle
    };
    const record = await this.stores.artifacts.storeProjectArtifact({
      artifactId,
      projectId: this.activeProjectId,
      artifactKind: 'document',
      role: 'source',
      label: file.name,
      mediaType: DOCX_FORMAT.mimeType,
      extension: DOCX_FORMAT.extensions[0],
      source: { fileName: file.name, size: file.size, lastModified: file.lastModified },
      summary: { partCount: result.parts.length, paragraphCount: result.paragraphCount, sectionCount: result.sectionCount }
    }, payload);
    await this.stores.artifacts.storeProjectArtifact({
      artifactId: rdfArtifactId,
      projectId: this.activeProjectId,
      artifactKind: 'document-rdf',
      role: 'generated',
      label: file.name.replace(/\.docx$/i, '') + '.ttl',
      mediaType: TURTLE_FORMAT.mimeType,
      extension: TURTLE_FORMAT.extensions[0],
      provenance: { derivedFrom: [artifactId], method: 'docxhund-ooxml-extraction' },
      summary: { partCount: result.parts.length }
    }, { text: turtle });
    await this.stores.runs.storeRunRecord({
      projectId: this.activeProjectId,
      runKind: 'document-extraction',
      label: 'Extract ' + file.name,
      inputArtifactIds: [artifactId],
      outputArtifactIds: [rdfArtifactId],
      payload: { partCount: result.parts.length }
    });
    await this.stores.projects.updateProject(this.activeProjectId, { activeArtifactId: artifactId });
    return record;
  }

  /** @param {string} artifactId @returns {Promise<object|null>} */
  async getDocument(artifactId) {
    return this.stores.artifacts.getProjectArtifact(artifactId);
  }

  /**
   * Persist imported RDF as an artifact, knowledge-base record, workspace
   * inclusion, graph metadata, and canonical quad rows.
   * @param {File} file
   * @param {{quads: object[], sourceFormat: string}} parsed
   * @returns {Promise<object>}
   */
  async storeKnowledgeBase(file, parsed) {
    const artifactId = createStableRecordId('artifact', [this.activeProjectId, 'knowledge-base', file.name]);
    const datasetId = createStableRecordId('dataset', [this.activeProjectId, artifactId]);
    const graphId = createStableRecordId('graph', [this.activeProjectId, artifactId]);
    const graphIri = `urn:docxhund:graph:${encodeURIComponent(artifactId)}`;
    const artifact = await this.stores.artifacts.storeProjectArtifact({
      artifactId,
      projectId: this.activeProjectId,
      artifactKind: 'knowledge-base',
      role: 'reference',
      label: file.name,
      mediaType: file.type || '',
      extension: file.name.split('.').pop() || '',
      source: { fileName: file.name, size: file.size },
      summary: { quadCount: parsed.quads.length, sourceFormat: parsed.sourceFormat }
    }, { text: await file.text() });
    const dataset = await this.stores.datasets.storeDatasetRecord({
      datasetId,
      projectId: this.activeProjectId,
      source: 'user',
      label: file.name,
      fileName: file.name,
      ontologyCount: 1,
      metadata: { artifactId, quadCount: parsed.quads.length, sourceFormat: parsed.sourceFormat }
    });
    const rows = convertRdfJsQuadsToQuadRows(parsed.quads, {
      projectId: this.activeProjectId, graphId, artifactId, graphIri
    });
    await storeGraphQuadRows(this.stores, {
      graphId, projectId: this.activeProjectId, graphIri, artifactId,
      role: 'reference', label: file.name,
      source: { datasetId, fileName: file.name }
    }, rows);
    await this.stores.inclusions.storeWorkspaceInclusion({
      projectId: this.activeProjectId,
      targetType: 'artifact',
      targetId: artifactId,
      role: 'knowledge-base',
      graphIri,
      includeMode: 'read-only'
    });
    await this.stores.runs.storeRunRecord({
      projectId: this.activeProjectId,
      runKind: 'knowledge-base-import',
      label: 'Import ' + file.name,
      inputArtifactIds: [artifactId],
      outputArtifactIds: [],
      payload: { datasetId, graphId, quadCount: rows.length, sourceFormat: parsed.sourceFormat }
    });
    return { artifact, dataset, quadCount: rows.length };
  }

  /**
   * Append manual annotation quads to the project's materialized annotation
   * graph and record the commit as an artifact/run.
   * @param {object[]} quads RDF/JS annotation quads.
   * @param {object} options
   * @param {string} options.documentArtifactId
   * @param {string} options.annotationIri
   * @returns {Promise<{artifact: object, graph: object, count: number}>}
   */
  async storeAnnotationQuads(quads, { documentArtifactId, annotationIri }) {
    const projectId = this.activeProjectId;
    const artifactId = createStableRecordId('artifact', [projectId, 'manual-annotations']);
    const graphId = createStableRecordId('graph', [projectId, 'manual-annotations']);
    const graphIri = 'urn:docxhund:graph:manual-annotations:' + encodeURIComponent(projectId);
    const existingCount = await this.stores.quadRows.countQuadRows({ graphId });
    const existingArtifact = await this.stores.artifacts.getProjectArtifact(artifactId, { includePayload: false });
    const artifact = await this.stores.artifacts.storeProjectArtifact({
      artifactId,
      projectId,
      artifactKind: 'annotation-rdf',
      role: 'curated',
      label: 'Manual annotations',
      mediaType: TURTLE_FORMAT.mimeType,
      extension: TURTLE_FORMAT.extensions[0],
      provenance: { derivedFrom: documentArtifactId ? [documentArtifactId] : [], method: 'manual-annotation' },
      summary: {
        annotationCommitCount: Number(existingArtifact?.summary?.annotationCommitCount || 0) + 1,
        quadCount: existingCount + quads.length
      }
    });
    const rows = convertRdfJsQuadsToQuadRows(quads, { projectId, graphId, artifactId, graphIri });
    const stored = await storeGraphQuadRows(this.stores, {
      graphId, projectId, graphIri, artifactId,
      role: 'curated', label: 'Manual annotations',
      source: { documentArtifactId }
    }, rows);
    await this.stores.inclusions.storeWorkspaceInclusion({
      projectId,
      targetType: 'artifact',
      targetId: artifactId,
      role: 'annotations',
      graphIri,
      includeMode: 'read-write'
    });
    await this.stores.runs.storeRunRecord({
      projectId,
      runKind: 'annotation-commit',
      label: 'Commit annotation',
      inputArtifactIds: documentArtifactId ? [documentArtifactId] : [],
      outputArtifactIds: [artifactId],
      payload: { annotationIri, graphId, addedQuadCount: rows.length }
    });
    return { artifact, graph: stored.graph, count: rows.length };
  }

  /**
   * List persisted manual-annotation quad rows for the active project.
   * @returns {Promise<object[]>}
   */
  async listAnnotationQuadRows() {
    const graphId = createStableRecordId('graph', [this.activeProjectId, 'manual-annotations']);
    const rows = await this.stores.quadRows.listQuadRows({ projectId: this.activeProjectId, graphId });
    const legacyProvNamespace = 'http://www.w3.org/ns/prov#';
    const unsupportedRows = rows.filter((row) =>
      String(row.predicate || '').startsWith(legacyProvNamespace) ||
      (row.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        String(row.object || '').startsWith(legacyProvNamespace))
    );
    if (unsupportedRows.length) {
      await this.stores.quadRows.deleteQuadRows(unsupportedRows);
      return rows.filter((row) => !unsupportedRows.includes(row));
    }
    return rows;
  }

  /** @returns {Promise<object[]>} All materialized RDF rows in the active project workspace. */
  async listWorkspaceQuadRows() {
    return this.stores.quadRows.listQuadRows({ projectId: this.activeProjectId });
  }
}
