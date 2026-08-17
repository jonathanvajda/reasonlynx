import {
  canUseTermAsGraph,
  canUseTermAsObject,
  canUseTermAsPredicate,
  canUseTermAsSubject,
  classifyOntologyInput,
  coerceLexicalValueForXsdDatatype,
  createTimestampedGraphIri,
  createUuid,
  describeXsdDatatypeForJsonSchema,
  formatDatatypeIriForDisplay,
  getXsdDatatypeLocalName,
  hasBlankNodeTermInQuad,
  isAbsoluteIri,
  isBlankNodeId,
  isBlankNodeTerm,
  isIriInNamespace,
  isRegisteredVocabularyIri,
  isRdfTerm,
  isUuid,
  normalizeIriToken,
  normalizeNamespaceIri
} from '../src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../namespace-registry/src/index.js';

const namedNode = (value) => ({ termType: 'NamedNode', value });
const blankNode = (value) => ({ termType: 'BlankNode', value });
const literal = (value, datatype = COMMON_NAMESPACE_IRIS.xsd.string) => ({
  termType: 'Literal',
  value,
  language: '',
  datatype: namedNode(datatype)
});
const defaultGraph = () => ({ termType: 'DefaultGraph', value: '' });

describe('IRI token utilities', () => {
  test('normalizes display labels and angle-bracket RDF/SPARQL tokens', () => {
    expect(normalizeIriToken('Label - <http://example.org/a>')).toBe('http://example.org/a');
    expect(normalizeIriToken('Predicate :: http://example.org/p')).toBe('http://example.org/p');
    expect(normalizeIriToken(null)).toBe('');
  });

  test('validates absolute IRIs without treating CURIEs as IRIs', () => {
    expect(isAbsoluteIri('http://example.org/a')).toBe(true);
    expect(isAbsoluteIri('urn:uuid:1234')).toBe(true);
    expect(isAbsoluteIri('skos:prefLabel')).toBe(false);
    expect(isAbsoluteIri('<https://example.org/a b>')).toBe(false);
    expect(isAbsoluteIri('custom:thing', { allowedSchemes: null })).toBe(true);
  });

  test('detects blank node identifiers and normalizes namespace boundaries', () => {
    expect(isBlankNodeId('_:b1')).toBe(true);
    expect(isBlankNodeId('_:1')).toBe(true);
    expect(isBlankNodeId('b1')).toBe(false);
    expect(normalizeNamespaceIri('http://example.org/ns')).toBe('http://example.org/ns#');
    expect(normalizeNamespaceIri('http://example.org/ns/')).toBe('http://example.org/ns/');
  });
});

describe('RDF term predicates', () => {
  test('classifies RDF/JS terms by role without throwing on malformed input', () => {
    const subject = namedNode('http://example.org/s');
    const predicate = namedNode('http://example.org/p');
    const object = literal('value');

    expect(isRdfTerm(subject)).toBe(true);
    expect(isBlankNodeTerm(blankNode('b1'))).toBe(true);
    expect(canUseTermAsSubject(subject)).toBe(true);
    expect(canUseTermAsSubject(object)).toBe(false);
    expect(canUseTermAsPredicate(predicate)).toBe(true);
    expect(canUseTermAsPredicate(blankNode('b1'))).toBe(false);
    expect(canUseTermAsObject(object)).toBe(true);
    expect(canUseTermAsGraph(defaultGraph())).toBe(true);
    expect(canUseTermAsGraph(null)).toBe(true);
    expect(isRdfTerm({})).toBe(false);
  });

  test('detects blank node terms inside quads', () => {
    expect(hasBlankNodeTermInQuad({
      subject: blankNode('b1'),
      predicate: namedNode('http://example.org/p'),
      object: literal('value'),
      graph: defaultGraph()
    })).toBe(true);
    expect(hasBlankNodeTermInQuad({ subject: null })).toBe(false);
  });
});

describe('ontology input classification', () => {
  test('classifies ontology text with RDF filename evidence as high confidence', () => {
    const result = classifyOntologyInput({
      filename: 'ontology.ttl',
      text: '@prefix owl: <http://www.w3.org/2002/07/owl#> .\n<urn:test> a owl:Ontology .'
    });

    expect(result.isRdfCandidate).toBe(true);
    expect(result.isOntologyCandidate).toBe(true);
    expect(result.mimeType).toBe('text/turtle');
    expect(result.confidence).toBe('high');
    expect(result.evidence).toContain('filename:rdf');
    expect(result.evidence).toContain('content:ontology-marker');
  });

  test('keeps unsupported inputs as structured non-candidates', () => {
    const result = classifyOntologyInput({
      filename: 'notes.txt',
      mimeType: 'text/plain',
      text: 'hello'
    });

    expect(result.ok).toBe(true);
    expect(result.isRdfCandidate).toBe(false);
    expect(result.isOntologyCandidate).toBe(false);
    expect(result.confidence).toBe('none');
  });
});

describe('ontology namespace classification', () => {
  test('checks explicit namespace containment and registered vocabulary namespaces', () => {
    expect(isIriInNamespace(COMMON_NAMESPACE_IRIS.rdfs.label, 'http://www.w3.org/2000/01/rdf-schema#')).toBe(true);
    expect(isRegisteredVocabularyIri(COMMON_NAMESPACE_IRIS.owl.Class)).toBe(true);
    expect(isRegisteredVocabularyIri('http://example.org/Class')).toBe(false);
    expect(isRegisteredVocabularyIri(COMMON_NAMESPACE_IRIS.owl.Class, { excludePrefixes: ['owl'] })).toBe(false);
  });
});

describe('XSD datatype helpers', () => {
  test('gets XSD local names and display labels through the namespace registry', () => {
    expect(getXsdDatatypeLocalName(COMMON_NAMESPACE_IRIS.xsd.dateTime)).toBe('dateTime');
    expect(getXsdDatatypeLocalName('http://example.org/customDatatype')).toBe('');
    expect(formatDatatypeIriForDisplay(COMMON_NAMESPACE_IRIS.xsd.boolean)).toBe('xsd:boolean');
  });

  test('describes XSD datatypes as JSON Schema fragments', () => {
    expect(describeXsdDatatypeForJsonSchema(COMMON_NAMESPACE_IRIS.xsd.integer)).toEqual({ type: 'integer' });
    expect(describeXsdDatatypeForJsonSchema(COMMON_NAMESPACE_IRIS.xsd.unsignedByte)).toEqual({ type: 'integer' });
    expect(describeXsdDatatypeForJsonSchema(COMMON_NAMESPACE_IRIS.xsd.decimal)).toEqual({ type: 'number' });
    expect(describeXsdDatatypeForJsonSchema(COMMON_NAMESPACE_IRIS.xsd.float)).toEqual({ type: 'number' });
    expect(describeXsdDatatypeForJsonSchema(COMMON_NAMESPACE_IRIS.xsd.boolean)).toEqual({ type: 'boolean' });
    expect(describeXsdDatatypeForJsonSchema(COMMON_NAMESPACE_IRIS.xsd.date)).toEqual({ type: 'string', format: 'date' });
    expect(describeXsdDatatypeForJsonSchema(COMMON_NAMESPACE_IRIS.xsd.anyURI)).toEqual({ type: 'string', format: 'uri' });
  });

  test('coerces lexical values only when unambiguous', () => {
    expect(coerceLexicalValueForXsdDatatype('42', COMMON_NAMESPACE_IRIS.xsd.integer)).toBe(42);
    expect(coerceLexicalValueForXsdDatatype('42.5', COMMON_NAMESPACE_IRIS.xsd.integer)).toBe('42.5');
    expect(coerceLexicalValueForXsdDatatype('3.14', COMMON_NAMESPACE_IRIS.xsd.decimal)).toBe(3.14);
    expect(coerceLexicalValueForXsdDatatype('1', COMMON_NAMESPACE_IRIS.xsd.boolean)).toBe(true);
    expect(coerceLexicalValueForXsdDatatype('', COMMON_NAMESPACE_IRIS.xsd.string)).toBeUndefined();
  });
});

describe('identifier utilities', () => {
  test('creates UUIDs with deterministic source and optional compact form', () => {
    const uuid = '123e4567-e89b-42d3-a456-426614174000';
    expect(createUuid({ uuidSource: () => uuid })).toBe(uuid);
    expect(createUuid({ uuidSource: () => uuid, removeHyphens: true })).toBe('123e4567e89b42d3a456426614174000');
    expect(isUuid(uuid)).toBe(true);
  });

  test('uses crypto.getRandomValues when randomUUID is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues(bytes) {
          bytes.set(Uint8Array.from([
            0x12, 0x3e, 0x45, 0x67,
            0xe8, 0x9b,
            0x02, 0xd3,
            0x24, 0x56,
            0x42, 0x66, 0x14, 0x17, 0x40, 0x00
          ]));
          return bytes;
        }
      }
    });

    try {
      expect(createUuid()).toBe('123e4567-e89b-42d3-a456-426614174000');
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto
      });
    }
  });

  test('throws instead of using insecure RNG when Web Crypto is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined
    });

    try {
      expect(() => createUuid()).toThrow('requires crypto.randomUUID() or crypto.getRandomValues()');
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: originalCrypto
      });
    }
  });

  test('creates deterministic timestamped graph IRIs and rejects invalid bases', () => {
    expect(createTimestampedGraphIri('urn:graph:auto', {
      clock: () => new Date('2026-08-05T12:34:56.789Z'),
      uuidSource: () => '123e4567-e89b-42d3-a456-426614174000'
    })).toBe('urn:graph:auto/2026-08-05T12-34-56-789Z/123e4567-e89b-42d3-a456-426614174000');

    expect(() => createTimestampedGraphIri('not an iri', {
      uuidSource: () => '123e4567-e89b-42d3-a456-426614174000'
    })).toThrow(TypeError);
  });
});
