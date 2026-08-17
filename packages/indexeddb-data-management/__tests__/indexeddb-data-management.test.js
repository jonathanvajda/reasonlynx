import {
  COMMON_NAMESPACE_IRIS
} from '../../namespace-registry/src/index.js';

import {
  StorageError,
  createArtifactStore,
  createIndexedDbRecordAdapter,
  createDatasetStore,
  createGraphStore,
  createMemoryRecordAdapter,
  createProjectPortfolioSchema,
  createProjectPortfolioStores,
  createProjectArchiveBlob,
  createProjectExportManifest,
  createRecordJsonLdVocabulary,
  createActiveWorkspaceGraphPlan,
  createArtifactDownloadBlob,
  createArtifactDownloadFileName,
  createLegacyMigrationReport,
  createProjectStore,
  createRdfJsStoreFromQuadRows,
  createQuadRowStore,
  createRunRecordStore,
  createSettingsStore,
  createWorkspaceInclusionStore,
  createStableRecordId,
  createTimestampRecordId,
  convertArtifactRecordToJsonLd,
  convertGraphRecordToJsonLd,
  convertProjectRecordToJsonLd,
  convertRunRecordToJsonLd,
  convertSettingRecordToJsonLd,
  clearGraphQuadRows,
  deleteIndexedDbDatabase,
  DEFAULT_PROJECT_PORTFOLIO_DB_NAME,
  DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  deleteGraphRecordWithQuadRows,
  inspectLegacyIndexedDbDatabase,
  downloadProjectArchive,
  downloadProjectArtifact,
  ensureProjectPortfolioProject,
  normalizeArtifactRecord,
  normalizeDatasetRecord,
  normalizeGraphRecord,
  normalizeProjectRecord,
  normalizeProjectImportManifest,
  normalizeQuadRow,
  normalizeRunRecord,
  normalizeSettingRecord,
  normalizeWorkspaceInclusionRecord,
  readJsonLdRecordValue,
  readActiveWorkspaceGraphPlan,
  convertLegacyTripleRowsToQuadRows,
  convertLegacySettingsToSettingRecords,
  convertQuadRowsToRdfJsQuads,
  resolveArtifactDownloadFormat,
  resolveOutputRunForExport,
  replaceGraphQuadRows,
  convertRdfJsQuadsToQuadRows,
  downloadRunOutputForExport,
  serializeRunOutputForExport,
  storeGraphQuadRows,
  storeProjectArtifactData,
  storeProjectRunData,
  inspectIndexedDbDatabase,
  openIndexedDbStore,
  resolveIdbRequest,
  waitForIdbTransaction
} from '../src/index.js';

const FIXED_NOW = () => '2026-07-29T12:00:00.000Z';

function createAsyncRequest({ result, error, event = 'success' }) {
  const request = { result, error, onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null };
  queueMicrotask(() => {
    if (event === 'success') request.onsuccess?.();
    if (event === 'error') request.onerror?.();
    if (event === 'blocked') request.onblocked?.();
  });
  return request;
}

function makeNameList(values) {
  return {
    values,
    contains(name) {
      return this.values.includes(name);
    }
  };
}

function createMockIndexedDB() {
  const createdStores = [];
  const createdIndexes = [];
  const stores = new Map();
  const db = {
    objectStoreNames: makeNameList([]),
    close() {},
    createObjectStore(name, options) {
      createdStores.push({ name, options });
      const store = {
        indexNames: makeNameList([]),
        createIndex(indexName, keyPath, indexOptions) {
          createdIndexes.push({ indexName, keyPath, indexOptions });
        }
      };
      stores.set(name, store);
      db.objectStoreNames.values.push(name);
      return store;
    }
  };
  return {
    createdStores,
    createdIndexes,
    open(name, version) {
      const request = { result: db, onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null, name, version };
      queueMicrotask(() => {
        request.transaction = {
          objectStore(storeName) {
            return stores.get(storeName);
          }
        };
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
    databases() {
      return Promise.resolve([{ name: 'ProjectData' }]);
    },
    deleteDatabase() {
      return createAsyncRequest({ result: undefined });
    }
  };
}

function createMockObjectStoreDb() {
  const stores = new Map();
  const recordsFor = (storeName) => {
    if (!stores.has(storeName)) stores.set(storeName, new Map());
    return stores.get(storeName);
  };
  const makeRequest = (result, tx) => {
    const request = { result, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      request.onsuccess?.();
      if (!tx.completionQueued) {
        tx.completionQueued = true;
        setTimeout(() => tx.oncomplete?.(), 0);
      }
    });
    return request;
  };
  return {
    stores,
    transaction(storeNames, mode) {
      const tx = {
        storeNames,
        mode,
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null,
        objectStore(storeName) {
          const records = recordsFor(storeName);
          return {
            get(key) {
              return makeRequest(records.get(key) || null, tx);
            },
            put(value, key) {
              const resolvedKey = key || (value.graphId && !value.subject ? value.graphId : '') || value.artifactId || value.runId || value.inclusionId || value.projectId || value.id || [
                value.projectId || '',
                value.graphId || '',
                value.subject || '',
                value.predicate || '',
                value.object || '',
                value.objectLang || '',
                value.objectDatatype || '',
                value.graph || ''
              ].join('\u001f');
              records.set(resolvedKey, value);
              return makeRequest(resolvedKey, tx);
            },
            delete(key) {
              records.delete(key);
              return makeRequest(undefined, tx);
            },
            clear() {
              records.clear();
              return makeRequest(undefined, tx);
            },
            getAll() {
              return makeRequest([...records.values()], tx);
            }
          };
        }
      };
      return tx;
    }
  };
}

const TestDataFactory = {
  namedNode: (value) => ({ termType: 'NamedNode', value }),
  blankNode: (value) => ({ termType: 'BlankNode', value }),
  literal(value, languageOrDatatype) {
    if (typeof languageOrDatatype === 'string') {
      return { termType: 'Literal', value, language: languageOrDatatype, datatype: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString' } };
    }
    return { termType: 'Literal', value, language: '', datatype: languageOrDatatype || { value: 'http://www.w3.org/2001/XMLSchema#string' } };
  },
  defaultGraph: () => ({ termType: 'DefaultGraph', value: '' }),
  quad: (subject, predicate, object, graph) => ({ subject, predicate, object, graph })
};

class TestRdfJsStore {
  constructor() {
    this.quads = [];
  }

  addQuad(quad) {
    this.quads.push(quad);
  }

  addQuads(quads) {
    this.quads.push(...quads);
  }

  getQuads() {
    return this.quads;
  }
}

function createGraphAwareMockN3Runtime() {
  return {
    DataFactory: TestDataFactory,
    Store: TestRdfJsStore,
    Writer: class {
      constructor() {
        this.quads = [];
      }

      addQuads(quads) {
        this.quads.push(...quads);
      }

      end(callback) {
        callback(null, this.quads.map((item) => {
          const graph = item.graph && item.graph.termType !== 'DefaultGraph'
            ? ` <${item.graph.value}>`
            : '';
          const object = item.object.termType === 'Literal'
            ? `"${item.object.value}"`
            : `<${item.object.value}>`;
          return `<${item.subject.value}> <${item.predicate.value}> ${object}${graph} .`;
        }).join('\n') + (this.quads.length ? '\n' : ''));
      }
    }
  };
}

describe('record id helpers', () => {
  test('createStableRecordId normalizes app-neutral ids', () => {
    expect(createStableRecordId('Dataset', [' User File.ttl ', 'SHA:1234 ']))
      .toBe('dataset:user-file-ttl-sha-1234');
  });

  test('createTimestampRecordId supports deterministic test clocks and suffixes', () => {
    expect(createTimestampRecordId('run', { now: FIXED_NOW, suffix: 'abc' }))
      .toBe('run:2026-07-29t12-00-00-000z:abc');
  });
});

class FakeZip {
  constructor() {
    this.files = [];
  }

  file(name, content) {
    this.files.push({ name, content });
  }

  async generateAsync(options) {
    return new Blob([JSON.stringify({ options, files: this.files })], { type: 'application/zip' });
  }
}

describe('record normalizers', () => {
  test('normalizeProjectRecord creates a portfolio-ready project record', () => {
    expect(normalizeProjectRecord({ label: 'Ontology Work', tags: ['rdf', 'rdf', ''] }, { now: FIXED_NOW }))
      .toMatchObject({
        projectId: 'project:ontology-work',
        label: 'Ontology Work',
        storageBackend: 'indexeddb',
        tags: ['rdf'],
        createdAt: '2026-07-29T12:00:00.000Z'
      });
  });

  test('normalizeArtifactRecord scopes typed artifacts to projects', () => {
    expect(normalizeArtifactRecord({
      projectId: 'project:one',
      artifactKind: 'sparql-query',
      role: 'staged',
      label: 'Competency query',
      provenance: { derivedFrom: ['artifact:source', 'artifact:source'] }
    }, { now: FIXED_NOW })).toMatchObject({
      projectId: 'project:one',
      artifactKind: 'sparql-query',
      role: 'staged',
      provenance: { derivedFrom: ['artifact:source'] }
    });
  });

  test('normalizeDatasetRecord preserves OntoEagle built-in/user distinctions', () => {
    expect(normalizeDatasetRecord({
      projectId: 'project:eagle',
      source: 'builtin',
      label: 'Built in graph',
      enabled: false,
      documentCount: 12
    }, { now: FIXED_NOW })).toMatchObject({
      source: 'builtin',
      enabled: false,
      documentCount: 12
    });
  });

  test('normalizeRunRecord supports diagnostics, transformations, and query runs', () => {
    expect(normalizeRunRecord({
      projectId: 'project:one',
      kind: 'diagnostic',
      label: 'OCD report',
      inputArtifactIds: ['artifact:a']
    }, { now: FIXED_NOW })).toMatchObject({
      runKind: 'diagnostic',
      label: 'OCD report',
      inputArtifactIds: ['artifact:a'],
      outputArtifactIds: []
    });
  });

  test('normalizeWorkspaceInclusionRecord makes graph participation explicit', () => {
    expect(normalizeWorkspaceInclusionRecord({
      projectId: 'project:one',
      targetType: 'reference-dataset',
      targetId: 'reference:bfo',
      role: 'imported-reference',
      graphIri: 'urn:graph:reference:bfo'
    }, { now: FIXED_NOW })).toMatchObject({
      inclusionId: 'inclusion:project-one-reference-dataset-reference-bfo',
      projectId: 'project:one',
      targetType: 'reference-dataset',
      targetId: 'reference:bfo',
      role: 'imported-reference',
      enabled: true,
      includeMode: 'read-only',
      graphIri: 'urn:graph:reference:bfo'
    });
  });

  test('normalizeGraphRecord tracks graph metadata separately from quad rows', () => {
    expect(normalizeGraphRecord({
      projectId: 'project:one',
      graphIri: '',
      artifactId: 'artifact:source',
      role: 'source',
      label: 'Default source graph',
      materialization: {
        strategy: 'materialized-on-import',
        status: 'ready',
        quadCount: 2,
        indexedAt: FIXED_NOW()
      }
    }, { now: FIXED_NOW })).toMatchObject({
      projectId: 'project:one',
      graphIri: null,
      artifactId: 'artifact:source',
      role: 'source',
      label: 'Default source graph',
      materialization: {
        strategy: 'materialized-on-import',
        status: 'ready',
        quadCount: 2,
        indexedAt: FIXED_NOW()
      }
    });
  });

  test('normalizeSettingRecord uses scoped keys for app and project settings', () => {
    expect(normalizeSettingRecord({
      scope: 'app:axiolotl',
      key: 'activePrefixes',
      value: ['rdf', 'rdfs'],
      appId: 'axiolotl'
    }, { now: FIXED_NOW })).toMatchObject({
      settingId: 'app:axiolotl::activePrefixes',
      scope: 'app:axiolotl',
      key: 'activePrefixes',
      value: ['rdf', 'rdfs'],
      appId: 'axiolotl',
      schemaVersion: 1
    });
  });

  test('normalizeQuadRow treats triples as default-graph quads', () => {
    expect(normalizeQuadRow({
      projectId: 'project:one',
      graphId: 'graph:default',
      subject: 'http://example.test/s',
      predicate: 'http://example.test/p',
      object: 'value',
      objectType: 'Literal',
      objectLang: 'en'
    })).toMatchObject({
      projectId: 'project:one',
      graphId: 'graph:default',
      subject: 'http://example.test/s',
      subjectType: 'NamedNode',
      predicate: 'http://example.test/p',
      predicateType: 'NamedNode',
      object: 'value',
      objectType: 'Literal',
      objectLang: 'en',
      objectDatatype: '',
      graph: null,
      graphIri: null,
      graphType: 'DefaultGraph'
    });
  });

  test('normalizers reject invalid records with StorageError', () => {
    expect(() => normalizeProjectRecord(null)).toThrow(StorageError);
    expect(() => normalizeArtifactRecord({ projectId: 'p' })).toThrow('artifact.artifactKind');
    expect(() => normalizeQuadRow({ subject: 's', predicate: 'p' })).toThrow('quad.object');
  });
});

describe('record JSON-LD conversion', () => {
  test('project records use dcterms title/created/modified keys', () => {
    expect(convertProjectRecordToJsonLd({
      projectId: 'project:one',
      label: 'Ontology Work',
      createdAt: '2026-07-29T12:00:00.000Z',
      updatedAt: '2026-07-30T12:00:00.000Z'
    })).toMatchObject({
      '@id': 'project:one',
      '@type': COMMON_NAMESPACE_IRIS.okea.Project,
      [COMMON_NAMESPACE_IRIS.dcterms.identifier]: { '@value': 'project:one', '@type': COMMON_NAMESPACE_IRIS.xsd.string },
      [COMMON_NAMESPACE_IRIS.dcterms.title]: 'Ontology Work',
      [COMMON_NAMESPACE_IRIS.dcterms.created]: { '@value': '2026-07-29T12:00:00.000Z', '@type': COMMON_NAMESPACE_IRIS.xsd.dateTime },
      [COMMON_NAMESPACE_IRIS.dcterms.modified]: { '@value': '2026-07-30T12:00:00.000Z', '@type': COMMON_NAMESPACE_IRIS.xsd.dateTime }
    });
  });

  test('artifact, run, and setting records use full IRI RDF vocabulary keys', () => {
    expect(convertArtifactRecordToJsonLd({
      artifactId: 'artifact:one',
      projectId: 'project:one',
      artifactKind: 'sparql-query',
      role: 'query',
      label: 'Saved query',
      mediaType: 'application/sparql-query',
      createdAt: '2026-07-29T12:00:00.000Z'
    })).toMatchObject({
      '@id': 'artifact:one',
      '@type': COMMON_NAMESPACE_IRIS.cco2.informationContentEntity,
      [COMMON_NAMESPACE_IRIS.dcterms.identifier]: { '@value': 'artifact:one', '@type': COMMON_NAMESPACE_IRIS.xsd.string },
      [COMMON_NAMESPACE_IRIS.dcterms.isPartOf]: {
        '@id': 'project:one',
        '@type': COMMON_NAMESPACE_IRIS.okea.Project,
        [COMMON_NAMESPACE_IRIS.dcterms.identifier]: { '@value': 'project:one', '@type': COMMON_NAMESPACE_IRIS.xsd.string }
      },
      [COMMON_NAMESPACE_IRIS.dcterms.title]: 'Saved query',
      [COMMON_NAMESPACE_IRIS.dcterms.format]: 'application/sparql-query'
    });

    expect(convertRunRecordToJsonLd({
      runId: 'run:one',
      projectId: 'project:one',
      runKind: 'query',
      label: 'Query run',
      inputArtifactIds: ['artifact:query'],
      outputArtifactIds: ['artifact:results'],
      createdAt: '2026-07-29T12:00:00.000Z'
    })).toMatchObject({
      '@id': 'run:one',
      '@type': COMMON_NAMESPACE_IRIS.cceo.ComputerProgramExecution,
      [COMMON_NAMESPACE_IRIS.dcterms.title]: 'Query run',
      [COMMON_NAMESPACE_IRIS.okea.inputArtifact]: [{
        '@id': 'artifact:query',
        '@type': COMMON_NAMESPACE_IRIS.cco2.informationContentEntity,
        [COMMON_NAMESPACE_IRIS.dcterms.identifier]: { '@value': 'artifact:query', '@type': COMMON_NAMESPACE_IRIS.xsd.string }
      }],
      [COMMON_NAMESPACE_IRIS.okea.outputArtifact]: [{
        '@id': 'artifact:results',
        '@type': COMMON_NAMESPACE_IRIS.cco2.informationContentEntity,
        [COMMON_NAMESPACE_IRIS.dcterms.identifier]: { '@value': 'artifact:results', '@type': COMMON_NAMESPACE_IRIS.xsd.string }
      }]
    });

    expect(convertSettingRecordToJsonLd({
      scope: 'user:local',
      key: 'theme',
      value: 'light',
      createdAt: '2026-07-29T12:00:00.000Z'
    })).toMatchObject({
      '@id': 'user:local::theme',
      '@type': COMMON_NAMESPACE_IRIS.okea.Setting,
      [COMMON_NAMESPACE_IRIS.dcterms.identifier]: { '@value': 'user:local::theme', '@type': COMMON_NAMESPACE_IRIS.xsd.string },
      [COMMON_NAMESPACE_IRIS.okea.scope]: 'user:local',
      [COMMON_NAMESPACE_IRIS.okea.settingKey]: 'theme',
      [COMMON_NAMESPACE_IRIS.rdf.value]: 'light'
    });
  });

  test('graph records use rdfs:label and dcterms timestamps', () => {
    expect(convertGraphRecordToJsonLd({
      graphId: 'graph:one',
      projectId: 'project:one',
      label: 'Default graph',
      createdAt: '2026-07-29T12:00:00.000Z'
    })).toMatchObject({
      '@id': 'graph:one',
      '@type': COMMON_NAMESPACE_IRIS.okea.Graph,
      [COMMON_NAMESPACE_IRIS.dcterms.identifier]: { '@value': 'graph:one', '@type': COMMON_NAMESPACE_IRIS.xsd.string },
      [COMMON_NAMESPACE_IRIS.rdfs.label]: 'Default graph',
      [COMMON_NAMESPACE_IRIS.dcterms.created]: { '@value': '2026-07-29T12:00:00.000Z', '@type': COMMON_NAMESPACE_IRIS.xsd.dateTime }
    });
  });

  test('record JSON-LD vocabulary is derived from the namespace registry', () => {
    expect(createRecordJsonLdVocabulary()).toMatchObject({
      title: 'http://purl.org/dc/terms/title',
      created: 'http://purl.org/dc/terms/created',
      identifier: 'http://purl.org/dc/terms/identifier',
      modified: 'http://purl.org/dc/terms/modified',
      label: 'http://www.w3.org/2000/01/rdf-schema#label',
      informationContentEntity: 'https://www.commoncoreontologies.org/ont00000958',
      computerProgramExecution: 'http://www.ontologyrepository.com/CommonCoreOntologies/ComputerProgramExecution',
      okea: 'https://github.com/jonathanvajda/okea/OntologyOfKnowledgeEngineeringArtifacts'
    });
  });

  test('readJsonLdRecordValue reads compact JSON-LD keys and legacy aliases', () => {
    expect(readJsonLdRecordValue({ 'dcterms:modified': { '@value': '2026' } }, ['dcterms:modified', 'updatedAt']))
      .toBe('2026');
    expect(readJsonLdRecordValue({ updatedAt: 'legacy' }, ['dcterms:modified', 'updatedAt']))
      .toBe('legacy');
  });
});

describe('store factories over injected adapters', () => {
  test('project store creates, updates, lists, gets, and deletes projects', async () => {
    const store = createProjectStore(createMemoryRecordAdapter(), { now: FIXED_NOW });
    const project = await store.createProject({ label: 'Mermaid-style Portfolio' });
    await store.updateProject(project.projectId, { label: 'Renamed Portfolio' });

    await expect(store.getProject(project.projectId)).resolves.toMatchObject({ label: 'Renamed Portfolio' });
    await expect(store.listProjects()).resolves.toHaveLength(1);
    await expect(store.deleteProject(project.projectId)).resolves.toBe(true);
    await expect(store.getProject(project.projectId)).resolves.toBeNull();
  });

  test('artifact store filters project artifacts without loading payloads when requested', async () => {
    const store = createArtifactStore(createMemoryRecordAdapter(), { now: FIXED_NOW });
    await store.storeProjectArtifact({
      artifactId: 'artifact:one',
      projectId: 'project:one',
      artifactKind: 'rdf-dataset',
      role: 'loaded',
      label: 'Loaded quads'
    }, { rows: [1] });
    await store.storeProjectArtifact({
      artifactId: 'artifact:two',
      projectId: 'project:one',
      artifactKind: 'sparql-query',
      role: 'staged',
      label: 'Query'
    }, 'SELECT * WHERE {}');

    await expect(store.listProjectArtifacts('project:one', {
      artifactKind: 'rdf-dataset',
      includePayload: false
    })).resolves.toEqual([
      expect.not.objectContaining({ payload: expect.anything() })
    ]);
  });

  test('dataset store lists enabled records and updates enablement', async () => {
    const store = createDatasetStore(createMemoryRecordAdapter(), { now: FIXED_NOW });
    const dataset = await store.storeDatasetRecord({
      datasetId: 'dataset:one',
      projectId: 'project:one',
      source: 'user',
      label: 'User ontology'
    });
    await store.storeDatasetRecord({
      datasetId: 'dataset:two',
      projectId: 'project:one',
      source: 'builtin',
      label: 'Builtin ontology',
      enabled: false
    });

    await expect(store.listDatasetRecords('project:one', { enabledOnly: true })).resolves.toHaveLength(1);
    await expect(store.setDatasetEnabled(dataset.datasetId, false)).resolves.toMatchObject({ enabled: false });
    await expect(store.listDatasetRecords('project:one', { enabledOnly: true })).resolves.toHaveLength(0);
  });

  test('settings store separates app and project scoped values', async () => {
    const adapter = createMemoryRecordAdapter();
    const appSettings = createSettingsStore(adapter);
    const projectSettings = createSettingsStore(adapter, { scope: 'project:one' });

    await appSettings.writeSettingValue('theme', 'dark');
    await projectSettings.writeSettingValue('theme', 'light');

    await expect(appSettings.readSettingValue('theme')).resolves.toBe('dark');
    await expect(projectSettings.readSettingValue('theme')).resolves.toBe('light');
    await expect(projectSettings.listSettingRecords()).resolves.toEqual([expect.objectContaining({
      settingId: 'project:one::theme',
      scope: 'project:one',
      key: 'theme',
      value: 'light'
    })]);
    await expect(projectSettings.readSettingRecord('theme')).resolves.toMatchObject({
      settingId: 'project:one::theme',
      scope: 'project:one'
    });
    await expect(projectSettings.writeSettingValue('', 'x')).rejects.toThrow('Setting key must be a non-empty string.');
  });

  test('run store sorts, limits, filters, and tracks latest run id by scope', async () => {
    const store = createRunRecordStore(createMemoryRecordAdapter());
    await store.storeRunRecord({
      runId: 'run:old',
      projectId: 'project:one',
      runKind: 'transformation',
      label: 'Old',
      createdAt: '2026-07-29T10:00:00.000Z'
    });
    await store.storeRunRecord({
      runId: 'run:new',
      projectId: 'project:one',
      runKind: 'transformation',
      label: 'New',
      createdAt: '2026-07-29T11:00:00.000Z'
    });

    await expect(store.listRunRecords({ projectId: 'project:one', runKind: 'transformation', limit: 1 }))
      .resolves.toMatchObject([{ runId: 'run:new' }]);
    expect(store.getLastRunId('project:one', 'transformation')).toBe('run:new');
  });

  test('workspace inclusion store lists active project graph inputs explicitly', async () => {
    const store = createWorkspaceInclusionStore(createMemoryRecordAdapter(), { now: FIXED_NOW });
    const bfo = await store.storeWorkspaceInclusion({
      projectId: 'project:one',
      targetType: 'reference-dataset',
      targetId: 'reference:bfo',
      role: 'imported-reference',
      graphIri: 'urn:graph:reference:bfo'
    });
    await store.storeWorkspaceInclusion({
      projectId: 'project:one',
      targetType: 'artifact',
      targetId: 'artifact:user-source',
      role: 'project-source',
      includeMode: 'editable',
      enabled: false
    });

    await expect(store.listWorkspaceInclusions('project:one', { enabledOnly: true })).resolves.toEqual([
      expect.objectContaining({ targetId: 'reference:bfo' })
    ]);
    await expect(store.setWorkspaceInclusionEnabled(bfo.inclusionId, false)).resolves.toMatchObject({ enabled: false });
    await expect(store.listWorkspaceInclusions('project:one', { enabledOnly: true })).resolves.toHaveLength(0);
  });

  test('graph store manages materialized graph metadata by project', async () => {
    const store = createGraphStore(createMemoryRecordAdapter(), { now: FIXED_NOW });
    const source = await store.storeGraphRecord({
      graphId: 'graph:source',
      projectId: 'project:one',
      graphIri: 'urn:graph:source',
      artifactId: 'artifact:source',
      role: 'source',
      label: 'Source graph',
      materialization: { status: 'ready', quadCount: 10 }
    });
    await store.storeGraphRecord({
      graphId: 'graph:inferred',
      projectId: 'project:one',
      graphIri: 'urn:graph:inferred',
      role: 'inferred-overlay',
      label: 'Inference overlay',
      materialization: { status: 'pending' }
    });

    await expect(store.listGraphRecords('project:one', { role: 'source' })).resolves.toEqual([
      expect.objectContaining({ graphId: 'graph:source', artifactId: 'artifact:source' })
    ]);
    await expect(store.updateGraphMaterialization(source.graphId, {
      status: 'ready',
      quadCount: 12,
      indexedAt: FIXED_NOW()
    })).resolves.toMatchObject({
      materialization: {
        status: 'ready',
        quadCount: 12,
        indexedAt: FIXED_NOW()
      }
    });
  });

  test('quad store handles default graph, named graphs, filters, and exact deletion', async () => {
    const store = createQuadRowStore(createMemoryRecordAdapter());
    const defaultRow = {
      projectId: 'project:one',
      graphId: 'graph:default',
      subject: 's1',
      predicate: 'p',
      object: 'o',
      graph: ''
    };
    const namedRow = {
      projectId: 'project:one',
      graphId: 'graph:named',
      subject: 's2',
      predicate: 'p',
      object: 'o',
      graph: 'http://example.test/graph'
    };
    const otherProjectRow = {
      projectId: 'project:two',
      graphId: 'graph:other',
      subject: 's3',
      predicate: 'p',
      object: 'o',
      graph: 'http://example.test/graph'
    };

    await expect(store.upsertQuadRows([defaultRow, namedRow, otherProjectRow])).resolves.toBe(3);
    await expect(store.listNamedGraphs({ projectId: 'project:one' })).resolves.toEqual(['http://example.test/graph']);
    await expect(store.countQuadRows({ projectId: 'project:one', graph: null })).resolves.toBe(1);
    await expect(store.countQuadRows({ graphId: 'graph:named' })).resolves.toBe(1);
    await expect(store.deleteQuadRows([defaultRow])).resolves.toBe(1);
    await expect(store.countQuadRows({ projectId: 'project:one' })).resolves.toBe(1);
  });

  test('quad store accepts legacy Axiolotl rows with empty-string default graph', async () => {
    const store = createQuadRowStore(createMemoryRecordAdapter());
    await store.upsertQuadRows([{
      subject: 'http://example.test/s',
      predicate: 'http://example.test/p',
      object: 'literal',
      objectType: 'Literal',
      graph: ''
    }]);

    await expect(store.listQuadRows({ graph: null })).resolves.toEqual([
      expect.objectContaining({
        graph: null,
        graphIri: null,
        objectType: 'Literal'
      })
    ]);
  });

  test('IndexedDB record adapter can back the shared store factories', async () => {
    const db = createMockObjectStoreDb();
    const adapter = createIndexedDbRecordAdapter(db, 'runs', { keyPath: 'runId' });
    const store = createRunRecordStore(adapter);

    await store.storeRunRecord({
      runId: 'run:indexeddb',
      projectId: 'project:one',
      runKind: 'diagnostic',
      label: 'IndexedDB backed',
      createdAt: '2026-07-29T12:00:00.000Z'
    });

    await expect(store.getRunRecord('run:indexeddb')).resolves.toMatchObject({
      runId: 'run:indexeddb',
      runKind: 'diagnostic'
    });
    await expect(store.listRunRecords({ projectId: 'project:one' })).resolves.toHaveLength(1);
  });
});

describe('cross-app project portfolio stores', () => {
  test('createProjectPortfolioSchema uses the shared portfolio database and stores', () => {
    expect(createProjectPortfolioSchema()).toEqual({
      name: DEFAULT_PROJECT_PORTFOLIO_DB_NAME,
      version: 4,
      stores: [
        { name: 'projects', options: { keyPath: 'projectId' } },
        { name: 'artifacts', options: { keyPath: 'artifactId' } },
        { name: 'datasets', options: { keyPath: 'datasetId' } },
        { name: 'runs', options: { keyPath: 'runId' } },
        { name: 'workspaceInclusions', options: { keyPath: 'inclusionId' } },
        expect.objectContaining({ name: 'graphs', options: { keyPath: 'graphId' } }),
        expect.objectContaining({ name: 'quadRows' }),
        { name: 'settings' }
      ]
    });
  });

  test('portfolio stores let different apps contribute artifacts to one project', async () => {
    const db = createMockObjectStoreDb();
    const stores = createProjectPortfolioStores(db);
    expect(typeof stores.datasets.listDatasetRecords).toBe('function');
    await ensureProjectPortfolioProject(stores, {
      label: 'Shared ontology project'
    });

    await stores.artifacts.storeProjectArtifact({
      artifactId: 'artifact:ontoeagle:catalog',
      projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
      artifactKind: 'ontology-documents',
      role: 'loaded',
      label: 'OntoEagle catalog'
    });
    await stores.inclusions.storeWorkspaceInclusion({
      projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
      targetType: 'artifact',
      targetId: 'artifact:ontoeagle:catalog',
      role: 'imported-reference',
      graphIri: 'urn:graph:reference:ontoeagle-catalog'
    });
    await stores.graphs.storeGraphRecord({
      graphId: 'graph:ontoeagle:catalog',
      projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
      graphIri: 'urn:graph:reference:ontoeagle-catalog',
      artifactId: 'artifact:ontoeagle:catalog',
      role: 'reference',
      label: 'OntoEagle catalog graph',
      materialization: { status: 'ready', quadCount: 1 }
    });
    await stores.quadRows.upsertQuadRows([{
      projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
      graphId: 'graph:ontoeagle:catalog',
      subject: 's',
      predicate: 'p',
      object: 'o',
      graph: 'urn:graph:reference:ontoeagle-catalog'
    }]);
    await stores.artifacts.storeProjectArtifact({
      artifactId: 'artifact:axiolotl:query',
      projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
      artifactKind: 'sparql-query',
      role: 'staged',
      label: 'Axiolotl query'
    });

    await expect(stores.projects.getProject(DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID))
      .resolves.toMatchObject({ label: 'Shared ontology project' });
    await expect(stores.artifacts.listProjectArtifacts(DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID, { includePayload: false }))
      .resolves.toEqual(expect.arrayContaining([
        expect.objectContaining({ artifactId: 'artifact:axiolotl:query' }),
        expect.objectContaining({ artifactId: 'artifact:ontoeagle:catalog' })
      ]));
    await expect(stores.inclusions.listWorkspaceInclusions(DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID, { enabledOnly: true }))
      .resolves.toEqual([
        expect.objectContaining({ targetId: 'artifact:ontoeagle:catalog' })
      ]);
    await expect(stores.graphs.listGraphRecords(DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID))
      .resolves.toEqual([expect.objectContaining({ graphId: 'graph:ontoeagle:catalog' })]);
    await expect(stores.quadRows.countQuadRows({ graphId: 'graph:ontoeagle:catalog' }))
      .resolves.toBe(1);
  });
});

describe('active workspace graph and bulk graph helpers', () => {
  test('createActiveWorkspaceGraphPlan resolves enabled inclusions to graph metadata', () => {
    const plan = createActiveWorkspaceGraphPlan({
      projectId: 'project:one',
      inclusions: [
        {
          inclusionId: 'inclusion:source',
          projectId: 'project:one',
          targetType: 'artifact',
          targetId: 'artifact:source',
          enabled: true,
          graphIri: 'urn:graph:source'
        },
        {
          inclusionId: 'inclusion:disabled',
          projectId: 'project:one',
          targetType: 'artifact',
          targetId: 'artifact:disabled',
          enabled: false
        }
      ],
      artifacts: [{ artifactId: 'artifact:source', projectId: 'project:one', label: 'Source' }],
      graphs: [{
        graphId: 'graph:source',
        projectId: 'project:one',
        artifactId: 'artifact:source',
        graphIri: 'urn:graph:source',
        materialization: { status: 'ready' }
      }]
    });

    expect(plan).toMatchObject({
      projectId: 'project:one',
      graphIds: ['graph:source'],
      missingMaterialization: []
    });
    expect(plan.entries[0]).toMatchObject({
      targetArtifact: { artifactId: 'artifact:source' },
      materialized: true
    });
  });

  test('readActiveWorkspaceGraphPlan reads portfolio stores', async () => {
    const stores = createProjectPortfolioStores(createMockObjectStoreDb(), { projectId: 'project:one' });
    await stores.artifacts.storeProjectArtifact({
      artifactId: 'artifact:source',
      projectId: 'project:one',
      artifactKind: 'rdf-dataset',
      role: 'source',
      label: 'Source'
    });
    await stores.inclusions.storeWorkspaceInclusion({
      projectId: 'project:one',
      targetType: 'artifact',
      targetId: 'artifact:source',
      role: 'project-source',
      graphIri: 'urn:graph:source'
    });
    await stores.graphs.storeGraphRecord({
      graphId: 'graph:source',
      projectId: 'project:one',
      artifactId: 'artifact:source',
      graphIri: 'urn:graph:source',
      role: 'source',
      label: 'Source graph',
      materialization: { status: 'ready' }
    });

    await expect(readActiveWorkspaceGraphPlan(stores, 'project:one')).resolves.toMatchObject({
      graphIds: ['graph:source']
    });
  });

  test('bulk graph helpers store, replace, clear, and delete graph rows with metadata', async () => {
    const stores = createProjectPortfolioStores(createMockObjectStoreDb(), { projectId: 'project:one' });
    const graphRecord = {
      graphId: 'graph:source',
      projectId: 'project:one',
      graphIri: 'urn:graph:source',
      artifactId: 'artifact:source',
      role: 'source',
      label: 'Source graph'
    };

    await expect(storeGraphQuadRows(stores, graphRecord, [
      { subject: 's1', predicate: 'p', object: 'o1' },
      { subject: 's2', predicate: 'p', object: 'o2' }
    ], { now: FIXED_NOW })).resolves.toMatchObject({
      count: 2,
      graph: {
        graphId: 'graph:source',
        materialization: { status: 'ready', quadCount: 2, indexedAt: FIXED_NOW() }
      }
    });

    await expect(replaceGraphQuadRows(stores, graphRecord, [
      { subject: 's3', predicate: 'p', object: 'o3' }
    ], { now: FIXED_NOW })).resolves.toMatchObject({
      count: 1,
      graph: { materialization: { quadCount: 1 } }
    });
    await expect(stores.quadRows.listQuadRows({ graphId: 'graph:source' })).resolves.toEqual([
      expect.objectContaining({ subject: 's3', graph: 'urn:graph:source' })
    ]);
    await expect(clearGraphQuadRows(stores, 'graph:source', { now: FIXED_NOW })).resolves.toBe(1);
    await expect(stores.graphs.getGraphRecord('graph:source')).resolves.toMatchObject({
      materialization: { status: 'empty', quadCount: 0 }
    });
    await storeGraphQuadRows(stores, graphRecord, [{ subject: 's4', predicate: 'p', object: 'o4' }], { now: FIXED_NOW });
    await expect(deleteGraphRecordWithQuadRows(stores, 'graph:source')).resolves.toEqual({
      deletedGraph: true,
      deletedRows: 1
    });
  });
});

describe('RDF/JS quad row conversion helpers', () => {
  test('convertRdfJsQuadsToQuadRows and convertQuadRowsToRdfJsQuads preserve term metadata', () => {
    const rdfJsQuad = TestDataFactory.quad(
      TestDataFactory.namedNode('http://example.test/s'),
      TestDataFactory.namedNode('http://example.test/p'),
      TestDataFactory.literal('label', 'en'),
      TestDataFactory.namedNode('urn:graph:one')
    );

    const rows = convertRdfJsQuadsToQuadRows([rdfJsQuad], {
      projectId: 'project:one',
      graphId: 'graph:one',
      artifactId: 'artifact:one'
    });
    expect(rows).toEqual([expect.objectContaining({
      projectId: 'project:one',
      graphId: 'graph:one',
      artifactId: 'artifact:one',
      objectType: 'Literal',
      objectLang: 'en',
      graph: 'urn:graph:one'
    })]);

    expect(convertQuadRowsToRdfJsQuads(rows, TestDataFactory)).toEqual([expect.objectContaining({
      subject: { termType: 'NamedNode', value: 'http://example.test/s' },
      graph: { termType: 'NamedNode', value: 'urn:graph:one' }
    })]);
  });

  test('createRdfJsStoreFromQuadRows keeps the Comunica rdfjsSource path viable', () => {
    const store = createRdfJsStoreFromQuadRows([{
      subject: 'http://example.test/s',
      predicate: 'http://example.test/p',
      object: 'o',
      objectType: 'Literal',
      graph: ''
    }], TestRdfJsStore, TestDataFactory);

    expect(store.getQuads()).toEqual([expect.objectContaining({
      graph: { termType: 'DefaultGraph', value: '' }
    })]);
  });
});

describe('legacy migration helpers', () => {
  test('convertLegacyTripleRowsToQuadRows preserves legacy empty default graph compatibility', () => {
    expect(convertLegacyTripleRowsToQuadRows([{
      subject: 's',
      predicate: 'p',
      object: 'o',
      objectType: 'Literal',
      graph: ''
    }], {
      projectId: 'project:one',
      graphId: 'graph:default',
      artifactId: 'artifact:legacy'
    })).toEqual([expect.objectContaining({
      projectId: 'project:one',
      graphId: 'graph:default',
      artifactId: 'artifact:legacy',
      graph: null
    })]);
  });

  test('convertLegacySettingsToSettingRecords scopes app-local rows without deleting legacy data', () => {
    expect(convertLegacySettingsToSettingRecords([{ key: 'endpoint', value: 'local' }], {
      scope: 'app:axiolotl',
      appId: 'axiolotl'
    })).toEqual([expect.objectContaining({
      settingId: 'app:axiolotl::endpoint',
      scope: 'app:axiolotl',
      appId: 'axiolotl',
      metadata: { migratedFrom: { key: 'endpoint', value: 'local' } }
    })]);
  });

  test('createLegacyMigrationReport is non-destructive and count-focused', () => {
    expect(createLegacyMigrationReport({
      sourceApp: 'axiolotl',
      legacyDatabases: ['inferenceDB', 'SPARQLSettings'],
      graphs: [{}],
      quadRows: [{}, {}],
      settings: [{}]
    })).toEqual({
      sourceApp: 'axiolotl',
      legacyDatabases: ['inferenceDB', 'SPARQLSettings'],
      counts: {
        projects: 0,
        artifacts: 0,
        graphs: 1,
        quadRows: 2,
        settings: 1,
        runs: 0
      },
      destructiveActions: [],
      requiresUserConfirmation: true
    });
  });

  test('inspectLegacyIndexedDbDatabase delegates to IndexedDB inspection', async () => {
    await expect(inspectLegacyIndexedDbDatabase('ProjectData', { indexedDBRef: createMockIndexedDB() })).resolves.toMatchObject({
      available: true,
      exists: true
    });
  });
});

describe('project artifact and archive export helpers', () => {
  test('createProjectExportManifest describes records and archive files without payload duplication', () => {
    const manifest = createProjectExportManifest({
      project: { projectId: 'project:one', label: 'One' },
      artifacts: [{
        artifactId: 'artifact:ontology',
        projectId: 'project:one',
        artifactKind: 'ontology-rdf',
        role: 'source',
        label: 'source.ttl',
        payload: '@prefix ex: <https://example.org/> .'
      }],
      runs: [{ runId: 'run:import', projectId: 'project:one', runKind: 'import', payload: { internal: true } }],
      workspaceInclusions: [{ inclusionId: 'inclusion:one', projectId: 'project:one', targetType: 'artifact', targetId: 'artifact:ontology' }],
      settings: [{ scope: 'project:one', key: 'activeArtifactId', value: 'artifact:ontology' }]
    }, {
      now: FIXED_NOW,
      appId: 'test-app',
      archiveFiles: [{
        path: 'artifacts/source.ttl',
        artifactId: 'artifact:ontology',
        mediaType: 'text/turtle',
        extension: 'ttl'
      }]
    });

    expect(manifest).toMatchObject({
      manifestKind: 'ontoeagle-project-archive',
      manifestVersion: 1,
      exportedAt: FIXED_NOW(),
      generator: { appId: 'test-app' },
      project: { projectId: 'project:one' },
      contents: {
        artifacts: [expect.objectContaining({
          artifactId: 'artifact:ontology',
          archivePath: 'artifacts/source.ttl'
        })],
        runs: [expect.objectContaining({ runId: 'run:import' })],
        workspaceInclusions: [expect.objectContaining({ inclusionId: 'inclusion:one' })],
        settings: [expect.objectContaining({ key: 'activeArtifactId' })]
      },
      files: [expect.objectContaining({ path: 'artifacts/source.ttl' })]
    });
    expect(manifest.contents.artifacts[0]).not.toHaveProperty('payload');
    expect(manifest.contents.runs[0]).not.toHaveProperty('payload');
  });

  test('normalizeProjectImportManifest validates project archive manifest shape', () => {
    const manifest = createProjectExportManifest({
      project: { projectId: 'project:one', label: 'One' },
      artifacts: []
    }, { now: FIXED_NOW });

    expect(normalizeProjectImportManifest(manifest)).toMatchObject({
      manifestKind: 'ontoeagle-project-archive',
      manifestVersion: 1,
      project: { projectId: 'project:one' },
      contents: {
        artifacts: [],
        runs: [],
        workspaceInclusions: [],
        settings: []
      },
      files: []
    });
    expect(() => normalizeProjectImportManifest({ manifestKind: 'wrong', manifestVersion: 1 }))
      .toThrow('unsupported kind');
  });

  test('resolveArtifactDownloadFormat assigns common artifact extensions and MIME types', () => {
    expect(resolveArtifactDownloadFormat({ artifactKind: 'mermaid-diagram' })).toEqual({
      extension: 'mmd',
      mimeType: 'text/mermaid'
    });
    expect(resolveArtifactDownloadFormat({ artifactKind: 'sparql-query' })).toEqual({
      extension: 'rq',
      mimeType: 'application/sparql-query'
    });
    expect(resolveArtifactDownloadFormat({ artifactKind: 'rdf-dataset' })).toEqual({
      extension: 'jsonld',
      mimeType: 'application/ld+json'
    });
    expect(resolveArtifactDownloadFormat({ artifactKind: 'rdf-file', extension: 'owl', mediaType: 'application/rdf+xml' })).toEqual({
      extension: 'owl',
      mimeType: 'application/rdf+xml'
    });
  });

  test('downloadProjectArtifact creates a file name and blob from artifact payload', async () => {
    const downloads = [];
    const result = downloadProjectArtifact({
      artifactId: 'artifact:query',
      artifactKind: 'sparql-query',
      label: 'Class query',
      payload: 'SELECT * WHERE { ?s ?p ?o }'
    }, {
      downloadBlob(fileName, blob) {
        downloads.push({ fileName, blob });
        return { fileName };
      }
    });

    expect(result).toEqual({ fileName: 'Class query.rq' });
    expect(downloads[0].blob.type).toBe('application/sparql-query');
    await expect(downloads[0].blob.text()).resolves.toBe('SELECT * WHERE { ?s ?p ?o }');
  });

  test('createProjectArchiveBlob creates project JSON plus artifact files', async () => {
    const blob = await createProjectArchiveBlob({
      projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
      label: 'Shared Project'
    }, [
      { artifactId: 'artifact:mmd', artifactKind: 'mermaid-diagram', label: 'Flow', payload: 'graph TD; A-->B' },
      { artifactId: 'artifact:rdf', artifactKind: 'jsonld-graph', label: 'Graph', payload: { '@graph': [] } }
    ], {
      JSZipConstructor: FakeZip
    });

    const zipDescription = JSON.parse(await blob.text());
    expect(zipDescription.options).toEqual({ type: 'blob', mimeType: 'application/zip' });
    expect(zipDescription.files).toEqual([
      expect.objectContaining({ name: 'project.json' }),
      expect.objectContaining({ name: 'artifacts/Flow.mmd', content: 'graph TD; A-->B' }),
      expect.objectContaining({ name: 'artifacts/Graph.jsonld', content: '{\n  "@graph": []\n}' }),
      expect.objectContaining({ name: 'project-manifest.json' })
    ]);
    const manifestFile = zipDescription.files.find((file) => file.name === 'project-manifest.json');
    const manifest = JSON.parse(manifestFile.content);
    expect(manifest.files).toEqual([
      expect.objectContaining({ path: 'artifacts/Flow.mmd', artifactKind: 'mermaid-diagram' }),
      expect.objectContaining({ path: 'artifacts/Graph.jsonld', artifactKind: 'jsonld-graph' })
    ]);
  });

  test('downloadProjectArchive downloads a zip using injected JSZip and download function', async () => {
    const result = await downloadProjectArchive({
      projectId: 'project:test',
      label: 'Demo Project'
    }, [], {
      JSZipConstructor: FakeZip,
      downloadBlob(fileName, blob) {
        return { fileName, mimeType: blob.type };
      }
    });

    expect(result).toEqual({
      fileName: 'Demo Project.zip',
      mimeType: 'application/zip'
    });
  });

  test('storeProjectArtifactData and storeProjectRunData add records to portfolio stores', async () => {
    const stores = createProjectPortfolioStores(createMockObjectStoreDb());
    await ensureProjectPortfolioProject(stores);
    const artifact = await storeProjectArtifactData(stores, {
      artifactId: 'artifact:csv',
      projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
      artifactKind: 'tabular-file',
      role: 'source',
      label: 'terms.csv'
    }, 'id,label\nx,X');
    const run = await storeProjectRunData(stores, {
      runId: 'run:csv-to-rdf',
      projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
      runKind: 'tabular-to-rdf',
      label: 'CSV to RDF',
      inputArtifactIds: [artifact.artifactId]
    });

    await expect(stores.artifacts.getProjectArtifact('artifact:csv')).resolves.toMatchObject({
      artifactId: 'artifact:csv',
      payload: 'id,label\nx,X'
    });
    expect(run.inputArtifactIds).toEqual(['artifact:csv']);
  });

  test('createArtifactDownloadFileName sanitizes names and createArtifactDownloadBlob serializes objects', async () => {
    const artifact = {
      artifactId: 'artifact:report',
      artifactKind: 'diagnostic-report',
      label: 'Bad / Report',
      payload: { status: 'ok' }
    };
    expect(createArtifactDownloadFileName(artifact)).toBe('Bad - Report.json');
    const blob = createArtifactDownloadBlob(artifact);
    await expect(blob.text()).resolves.toBe('{\n  "status": "ok"\n}');
  });
});

describe('run output export orchestration', () => {
  test('resolves the latest output child when the active output pointer was lost', async () => {
    const runs = [
      {
        runId: 'run:input',
        kind: 'input',
        createdAt: '2026-07-29T10:00:00.000Z',
        fileName: 'source.ttl'
      },
      {
        runId: 'run:output-old',
        kind: 'output',
        parentRunId: 'run:input',
        createdAt: '2026-07-29T11:00:00.000Z',
        fileName: 'source.mapped.ttl'
      },
      {
        runId: 'run:output-new',
        kind: 'output',
        parentRunId: 'run:input',
        createdAt: '2026-07-29T12:00:00.000Z',
        fileName: 'source.mapped.ttl'
      }
    ];
    const byId = new Map(runs.map((run) => [run.runId, run]));

    await expect(resolveOutputRunForExport({
      selectedRunId: 'run:input',
      readRun: async (runId) => byId.get(runId) || null,
      listRuns: async () => runs
    })).resolves.toMatchObject({
      runId: 'run:output-new',
      parentRunId: 'run:input',
      source: 'latest-child'
    });
  });

  test('serializes and downloads text run outputs with selected MIME and extension', async () => {
    const downloads = [];
    const result = await downloadRunOutputForExport({
      runId: 'run:query-output',
      kind: 'output',
      fileName: 'query.rq',
      queryText: 'SELECT * WHERE {}'
    }, {
      mimeType: 'application/sparql-query',
      downloadTextFile(fileName, text, options) {
        downloads.push({ fileName, text, options });
        return { fileName };
      }
    });

    expect(result.serialized).toMatchObject({
      text: 'SELECT * WHERE {}',
      mimeType: 'application/sparql-query',
      extension: 'rq',
      fileName: 'query.rq'
    });
    expect(downloads).toEqual([{
      fileName: 'query.rq',
      text: 'SELECT * WHERE {}',
      options: { mimeType: 'application/sparql-query' }
    }]);
  });

  test('serializes canonical N-Quads run outputs through RDF graph export policy', async () => {
    const runtime = { N3: createGraphAwareMockN3Runtime() };
    const serialized = await serializeRunOutputForExport({
      runId: 'run:rdf-output',
      kind: 'output',
      fileName: 'ontology.mapped.ttl',
      nquads: '<http://ex/s> <http://ex/p> "v" <http://ex/g> .\n'
    }, {
      mimeType: 'text/turtle',
      runtime
    });

    expect(serialized).toMatchObject({
      mimeType: 'text/turtle',
      extension: 'ttl',
      fileName: 'ontology.mapped.ttl'
    });
    expect(serialized.text).toContain('<http://ex/s>');
    expect(serialized.text).not.toContain('<http://ex/g>');
  });
});

describe('IndexedDB adapter helpers', () => {
  test('resolveIdbRequest resolves results and rejects native errors', async () => {
    await expect(resolveIdbRequest(createAsyncRequest({ result: 'ok' }))).resolves.toBe('ok');
    await expect(resolveIdbRequest(createAsyncRequest({
      error: new Error('request failed'),
      event: 'error'
    }))).rejects.toMatchObject({
      code: 'IDB_REQUEST_FAILED',
      message: 'request failed'
    });
  });

  test('waitForIdbTransaction resolves completion and rejects aborts', async () => {
    const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
    const promise = waitForIdbTransaction(tx);
    tx.oncomplete();
    await expect(promise).resolves.toBe(true);

    const aborted = { oncomplete: null, onerror: null, onabort: null, error: new Error('aborted') };
    const abortPromise = waitForIdbTransaction(aborted);
    aborted.onabort();
    await expect(abortPromise).rejects.toMatchObject({ code: 'IDB_TRANSACTION_ABORTED' });
  });

  test('openIndexedDbStore creates missing stores and indexes from schema', async () => {
    const indexedDBRef = createMockIndexedDB();
    const db = await openIndexedDbStore({
      name: 'ProjectData',
      version: 1,
      stores: [
        {
          name: 'runs',
          options: { keyPath: 'runId' },
          indexes: [{ name: 'projectId', keyPath: 'projectId' }]
        }
      ]
    }, { indexedDBRef });

    expect(db).toBeTruthy();
    expect(indexedDBRef.createdStores).toEqual([{ name: 'runs', options: { keyPath: 'runId' } }]);
    expect(indexedDBRef.createdIndexes).toEqual([{ indexName: 'projectId', keyPath: 'projectId', indexOptions: undefined }]);
  });

  test('inspectIndexedDbDatabase reports unavailable IndexedDB without throwing', async () => {
    await expect(inspectIndexedDbDatabase('ProjectData', { indexedDBRef: null })).resolves.toEqual({
      available: false,
      exists: null,
      stores: []
    });
  });

  test('inspectIndexedDbDatabase reports absent databases and existing stores', async () => {
    let openCalls = 0;
    const missingIndexedDBRef = {
      open() {
        openCalls += 1;
      },
      databases: () => Promise.resolve([{ name: 'OtherData' }])
    };
    await expect(inspectIndexedDbDatabase('ProjectData', { indexedDBRef: missingIndexedDBRef })).resolves.toEqual({
      available: true,
      exists: false,
      stores: []
    });
    expect(openCalls).toBe(0);

    const indexedDBRef = createMockIndexedDB();
    await openIndexedDbStore({
      name: 'ProjectData',
      version: 1,
      stores: [
        { name: 'settings' },
        { name: 'datasets' }
      ]
    }, { indexedDBRef });

    await expect(inspectIndexedDbDatabase('ProjectData', { indexedDBRef })).resolves.toEqual({
      available: true,
      exists: true,
      stores: ['settings', 'datasets']
    });
  });

  test('deleteIndexedDbDatabase rejects blocked deletes clearly', async () => {
    const indexedDBRef = {
      deleteDatabase() {
        return createAsyncRequest({ event: 'blocked' });
      }
    };

    await expect(deleteIndexedDbDatabase('ProjectData', { indexedDBRef }))
      .rejects.toMatchObject({ code: 'IDB_DELETE_BLOCKED' });
  });
});

