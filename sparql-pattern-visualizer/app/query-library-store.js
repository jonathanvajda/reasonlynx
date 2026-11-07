import { createProjectPortfolioStores, openProjectPortfolioDatabase, DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  inspectLegacyIndexedDbDatabase, readLegacyObjectStoreRows, ensureProjectPortfolioProject } from '../../packages/indexeddb-data-management/src/index.js';
import { extractLibraryQueries, ontologyTerms, queryResourceIris } from '../../packages/sparql-utils/src/query-library.js';
import { parseSparqlQueryToAst } from '../../packages/sparql-utils/src/index.js';
import { parseRdfTextWithAdapters, datasetToQuads } from '../../packages/rdf-io/src/index.js';

export async function libraryStores() {
  const db = await openProjectPortfolioDatabase();
  const initial = createProjectPortfolioStores(db);
  const projectId = await initial.settings.readSettingValue('workspace.activeProjectId', DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID);
  return createProjectPortfolioStores(db, { projectId });
}

export async function loadLibrary() {
  const stores = await libraryStores();
  const artifacts = await stores.artifacts.listProjectArtifacts(stores.projectId);
  const queries = [];
  for (const artifact of artifacts) {
    const payload = artifact.payload instanceof Blob ? await artifact.payload.text() : artifact.payload;
    queries.push(...extractLibraryQueries(payload, artifact));
  }
  const warnings = [];
  if (stores.projectId === DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID) {
    for (const [databaseName, storeName] of [['CQDatabase', 'CQStore'], ['inferenceDB', 'savedQueries']]) {
      try {
        const legacy = await inspectLegacyIndexedDbDatabase(databaseName);
        if (legacy.exists && legacy.stores.includes(storeName)) {
          const rows = await readLegacyObjectStoreRows(databaseName, storeName);
          queries.push(...rows.flatMap((row, i) => extractLibraryQueries(row, { artifactId: `legacy:${databaseName}:${i}`, label: row.label || `${databaseName} (legacy)`, source: { application: databaseName } })));
        }
      } catch (error) { warnings.push(`${databaseName}: ${error.message}`); }
    }
  }
  const seen = new Set();
  const normalized = queries.filter(q => {
    const key = `${q.resourceId || ''}\n${q.query}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map(q => ({ ...q, iris: queryResourceIris(q.query, text => parseSparqlQueryToAst(text, { runtime: window })) }));
  const rows = await stores.quadRows.listQuadRows({ projectId: stores.projectId });
  return { queries: normalized, terms: ontologyTerms(rows), artifacts, projectId: stores.projectId, warnings };
}

export async function importQueryFiles(files) {
  const stores = await libraryStores();
  await ensureProjectPortfolioProject(stores, { projectId: stores.projectId });
  for (const file of files) {
    const text = await file.text();
    const json = /\.json(ld)?$/i.test(file.name);
    const payload = json ? JSON.parse(text) : text;
    if (!extractLibraryQueries(payload).length) throw new Error(`${file.name}: no supported SPARQL query text found.`);
    await stores.artifacts.storeProjectArtifact({ artifactId: `artifact:query-library:${crypto.randomUUID()}`,
      projectId: stores.projectId, artifactKind: json ? 'competency-question-set' : 'sparql-query', role: 'source',
      label: file.name, mediaType: json ? 'application/ld+json' : 'application/sparql-query',
      extension: file.name.split('.').pop(), source: { origin: 'file', application: 'sparql-pattern-visualizer', fileName: file.name }
    }, payload);
  }
}

export async function parseOntology(text, name) {
  const extension = name.split('.').pop().toLowerCase();
  const format = ({ rdf: 'rdfxml', owl: 'rdfxml', xml: 'rdfxml', json: 'jsonld' })[extension] || extension;
  const result = await parseRdfTextWithAdapters(text, { format });
  return ontologyTerms(datasetToQuads(result.dataset));
}

export async function indexOntologyArtifact(artifact) {
  const payload = artifact.payload;
  if (artifact.artifactKind === 'ontology-documents' && payload?.storedInObjectStore === 'documents') {
    const inspection = await inspectLegacyIndexedDbDatabase('OntoEagleDB');
    if (!inspection.exists) throw new Error('OntoEagle document database is unavailable.');
    const docs = await readLegacyObjectStoreRows('OntoEagleDB', 'documents');
    return docs.filter(doc => doc.datasetId === payload.datasetId).map(doc => ({ iri: doc.iri,
      labels: [...new Set([doc.label, ...(doc.altLabels || []), ...(Array.isArray(doc.acronyms) ? doc.acronyms : [doc.acronym])].filter(v => typeof v === 'string' && v))]
    })).filter(term => term.iri && term.labels.length);
  }
  if (Array.isArray(payload) || payload?.quads || payload?.rows) return ontologyTerms(payload.quads || payload.rows || payload);
  const text = payload instanceof Blob ? await payload.text() : typeof payload === 'string' ? payload : typeof payload?.text === 'string' ? payload.text : JSON.stringify(payload);
  return parseOntology(text, `ontology.${artifact.extension || 'jsonld'}`);
}

/** Explicit read-only adapter for other same-origin query/file object stores. */
export async function readAdditionalQueryStore(databaseName, storeName) {
  const inspection = await inspectLegacyIndexedDbDatabase(databaseName);
  if (!inspection.exists || !inspection.stores.includes(storeName)) throw new Error('Database or object store not found (or this browser cannot enumerate databases).');
  const rows = await readLegacyObjectStoreRows(databaseName, storeName);
  const queries = [];
  for (const [index, row] of rows.entries()) {
    let payload = row;
    if (row instanceof Blob) payload = await row.text();
    else if (row?.content instanceof Blob) payload = { ...row, content: await row.content.text() };
    const extracted = extractLibraryQueries(payload, { artifactId: `${databaseName}:${storeName}:${index}`, label: row?.label || row?.fileName || row?.name || `${storeName} ${index + 1}`, source: { application: databaseName } });
    queries.push(...extracted.map(query => ({ ...query, iris: queryResourceIris(query.query, text => parseSparqlQueryToAst(text, { runtime: window })) })));
  }
  return queries;
}
