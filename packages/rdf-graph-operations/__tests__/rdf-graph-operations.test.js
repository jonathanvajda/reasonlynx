import {
  createOntologyImportDecisionRows,
  createOntologyMergeSource,
  ONTOLOGY_IMPORT_ACTIONS
} from '../src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../namespace-registry/src/index.js';
import { namedNode, quad } from '../../rdf-io/src/index.js';

const RDF_TYPE = COMMON_NAMESPACE_IRIS.rdf.type;
const OWL_ONTOLOGY = COMMON_NAMESPACE_IRIS.owl.Ontology;
const OWL_IMPORTS = COMMON_NAMESPACE_IRIS.owl.imports;

describe('ontology import planning', () => {
  test('creates an immutable source using canonical ontology metadata IRIs', () => {
    const source = createOntologyMergeSource({
      id: 'root',
      name: 'root.ttl',
      dataset: [
        quad('https://example.org/root', RDF_TYPE, namedNode(OWL_ONTOLOGY)),
        quad('https://example.org/root', OWL_IMPORTS, namedNode('https://example.org/z')),
        quad('https://example.org/root', OWL_IMPORTS, namedNode('https://example.org/a')),
        quad('https://example.org/root', OWL_IMPORTS, namedNode('https://example.org/a'))
      ],
      prefixes: { ex: 'https://example.org/' },
      mimeType: 'text/turtle'
    });

    expect(source).toMatchObject({
      id: 'root',
      name: 'root.ttl',
      ontologyIri: 'https://example.org/root',
      mimeType: 'text/turtle',
      imports: ['https://example.org/a', 'https://example.org/z']
    });
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.quads)).toBe(true);
    expect(Object.isFrozen(source.imports)).toBe(true);
  });

  test('requires a stable source identity when RDF has no ontology declaration', () => {
    expect(() => createOntologyMergeSource({ dataset: [] }))
      .toThrow(/requires id, name, or an owl:Ontology IRI/);
  });

  test('defaults available imports to merge and unavailable imports to import', () => {
    const root = source('root', 'https://example.org/root', [
      'https://example.org/local',
      'https://example.org/external'
    ]);
    const local = source('local', 'https://example.org/local');

    expect(createOntologyImportDecisionRows([root, local])).toEqual([
      expect.objectContaining({
        targetIri: 'https://example.org/external',
        availableSourceId: '',
        action: ONTOLOGY_IMPORT_ACTIONS.IMPORT
      }),
      expect.objectContaining({
        targetIri: 'https://example.org/local',
        availableSourceId: 'local',
        action: ONTOLOGY_IMPORT_ACTIONS.MERGE
      })
    ]);
  });

  test('honors valid explicit actions and ignores unsupported action values', () => {
    const root = source('root', 'https://example.org/root', ['https://example.org/local']);
    const local = source('local', 'https://example.org/local');

    expect(createOntologyImportDecisionRows([root, local], {
      'https://example.org/local': ONTOLOGY_IMPORT_ACTIONS.IGNORE
    })[0].action).toBe(ONTOLOGY_IMPORT_ACTIONS.IGNORE);

    expect(createOntologyImportDecisionRows([root, local], {
      'https://example.org/local': 'delete-everything'
    })[0].action).toBe(ONTOLOGY_IMPORT_ACTIONS.MERGE);
  });
});

function source(id, ontologyIri, imports = []) {
  return createOntologyMergeSource({
    id,
    name: `${id}.ttl`,
    dataset: [
      quad(ontologyIri, RDF_TYPE, namedNode(OWL_ONTOLOGY)),
      ...imports.map((targetIri) => quad(ontologyIri, OWL_IMPORTS, namedNode(targetIri)))
    ]
  });
}
