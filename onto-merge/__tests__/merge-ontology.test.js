import {
  buildMergedOntologyQuads,
  buildMergedPrefixMap,
  buildTurtleHeaderTemplate,
  composeMergedOntologyText,
  createMergedOntologyFilename
} from '../app/merge-ontology.js';
import {
  createOntologyImportDecisionRows,
  createOntologyMergeSource
} from '../../packages/rdf-graph-operations/src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/index.js';
import { literal, namedNode, quad } from '../../packages/rdf-io/src/index.js';

const RDF_TYPE = COMMON_NAMESPACE_IRIS.rdf.type;
const OWL_ONTOLOGY = COMMON_NAMESPACE_IRIS.owl.Ontology;
const OWL_IMPORTS = COMMON_NAMESPACE_IRIS.owl.imports;
const RDFS_LABEL = COMMON_NAMESPACE_IRIS.rdfs.label;

describe('merge ontology helpers', () => {
  test('creates import decisions that merge locally available imports by default', () => {
    const root = source('root.ttl', 'https://example.org/root', [
      quad('https://example.org/root', OWL_IMPORTS, namedNode('https://example.org/imported'))
    ]);
    const imported = source('imported.ttl', 'https://example.org/imported', []);

    expect(createOntologyImportDecisionRows([root, imported])).toMatchObject([
      {
        targetIri: 'https://example.org/imported',
        availableSourceName: 'imported.ttl',
        action: 'merge'
      }
    ]);
  });

  test('keeps missing imports as import statements in the generated header plan', () => {
    const root = source('root.ttl', 'https://example.org/root', [
      quad('https://example.org/root', OWL_IMPORTS, namedNode('https://example.org/external'))
    ]);

    const merged = buildMergedOntologyQuads([root], {
      rootSourceIds: [root.id],
      actionsByIri: {},
      headerOntologyIri: 'https://example.org/root'
    });

    expect(merged.importedIris).toEqual(['https://example.org/external']);
  });

  test('drops imported ontology statements and old header quads when an import is merged', () => {
    const root = source('root.ttl', 'https://example.org/root', [
      quad('https://example.org/root', OWL_IMPORTS, namedNode('https://example.org/imported')),
      quad('https://example.org/A', RDFS_LABEL, literal('A'))
    ]);
    const imported = source('imported.ttl', 'https://example.org/imported', [
      quad('https://example.org/B', RDFS_LABEL, literal('B'))
    ]);

    const merged = buildMergedOntologyQuads([root, imported], {
      rootSourceIds: [root.id],
      actionsByIri: { 'https://example.org/imported': 'merge' },
      headerOntologyIri: 'https://example.org/root'
    });

    expect(merged.includedSourceIds).toEqual([root.id, imported.id]);
    expect(merged.quads.map((item) => item.subject.value)).toEqual(['https://example.org/A', 'https://example.org/B']);
    expect(merged.importedIris).toEqual([]);
  });

  test('builds editable Turtle headers with prefixes, imports, and annotations', () => {
    const header = buildTurtleHeaderTemplate({
      templateId: 'minimal',
      ontologyIri: 'https://example.org/merged',
      prefixes: buildMergedPrefixMap([], { ex: 'https://example.org/' }),
      importedIris: ['https://example.org/external'],
      annotationText: 'rdfs:label "Merged" .'
    });

    expect(header).toContain('@prefix ex: <https://example.org/> .');
    expect(header).toContain('<https://example.org/merged> a owl:Ontology ;');
    expect(header).toContain('owl:imports <https://example.org/external> ;');
    expect(header).toContain('rdfs:label "Merged" .');
  });

  test('composes final text and derives stable filenames', () => {
    expect(composeMergedOntologyText('@prefix ex: <https://example.org/> .', '@prefix ex: <https://example.org/> .\nex:a ex:b ex:c .'))
      .toBe('@prefix ex: <https://example.org/> .\n\nex:a ex:b ex:c .\n');
    expect(createMergedOntologyFilename('https://example.org/my merged ontology', 'ttl')).toBe('my-merged-ontology.ttl');
  });
});

function source(name, ontologyIri, extraQuads) {
  return createOntologyMergeSource({
    id: name,
    name,
    dataset: [
      quad(ontologyIri, RDF_TYPE, namedNode(OWL_ONTOLOGY)),
      ...extraQuads
    ],
    prefixes: { ex: 'https://example.org/' },
    mimeType: 'text/turtle'
  });
}
