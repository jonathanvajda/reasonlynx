import {
  COMMON_NAMESPACE_REGISTRY,
  COMMON_NAMESPACE_IRIS,
  applyPrefixesToRdflibStore,
  compactIriToCurie,
  createN3WriterOptionsWithPrefixes,
  curieForNamespaceId,
  deriveNamespaceStemFromIri,
  discoverBaseIriOrNamespaceStem,
  expandCurieToIri,
  extractJsonLdContextPrefixes,
  extractRdfPrefixesFromText,
  extractTurtlePrefixDeclarations,
  extractXmlNamespacePrefixes,
  findLongestPrefixMatch,
  formatIriForDisplay,
  iriForNamespaceId,
  namespaceIriMapFromRegistry,
  listNamespaceStemsInStore,
  mergeProjectPrefixes,
  namespacePrefixMapFromRegistry,
  namespaceToPrefixMap,
  normalizePrefixMap,
  selectPrefixesUsedByRdfTerms,
  saveProjectPrefixes
} from '../src/index.js';

describe('namespace-registry package', () => {
  test('COMMON_NAMESPACE_REGISTRY exposes immutable common namespace facts and IDs', () => {
    expect(COMMON_NAMESPACE_REGISTRY.rdf.namespaceIri).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    expect(COMMON_NAMESPACE_REGISTRY.rdfs.ids.label).toBe('label');
    expect(Object.isFrozen(COMMON_NAMESPACE_REGISTRY.owl.ids)).toBe(true);

    expect(namespacePrefixMapFromRegistry()).toMatchObject({
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      owl: 'http://www.w3.org/2002/07/owl#',
      cceo: 'http://www.ontologyrepository.com/CommonCoreOntologies/',
      bfo: 'http://purl.obolibrary.org/obo/BFO_',
      iao: 'http://purl.obolibrary.org/obo/IAO_',
      oboInOwl: 'http://www.geneontology.org/formats/oboInOwl#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      prov: 'http://www.w3.org/ns/prov#',
      dcat: 'http://www.w3.org/ns/dcat#',
      geo: 'http://www.w3.org/2003/01/geo/wgs84_pos#',
      geojson: 'https://purl.org/geojson/vocab#',
      okea: 'https://github.com/jonathanvajda/okea/',
      vcard: 'http://www.w3.org/2006/vcard/ns#',
      xhtml: 'http://www.w3.org/1999/xhtml'
    });
    expect(namespaceToPrefixMap({ rdf: COMMON_NAMESPACE_REGISTRY.rdf.namespaceIri })).toEqual({
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#': 'rdf'
    });
    expect(iriForNamespaceId('rdf', 'type')).toEqual({
      ok: true,
      value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
    });
    expect(curieForNamespaceId('rdf', 'type')).toEqual({
      ok: true,
      value: 'rdf:type',
      prefix: 'rdf',
      localName: 'type'
    });
    expect(curieForNamespaceId('owl', 'notReal')).toEqual({
      ok: false,
      error: 'unknown namespace id',
      input: 'notReal'
    });
    expect(curieForNamespaceId('notReal', 'type')).toEqual({
      ok: false,
      error: 'unknown namespace',
      input: 'notReal'
    });
    expect(COMMON_NAMESPACE_IRIS.rdf.type).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
    expect(COMMON_NAMESPACE_IRIS.owl.Class).toBe('http://www.w3.org/2002/07/owl#Class');
    expect(namespaceIriMapFromRegistry().iao.definition).toBe('http://purl.obolibrary.org/obo/IAO_0000115');
  });

  test('COMMON_NAMESPACE_REGISTRY covers common OWL, SKOS, XSD, and DCTERMS IDs', () => {
    expect(COMMON_NAMESPACE_REGISTRY.owl.ids).toMatchObject({
      ObjectProperty: 'ObjectProperty',
      DatatypeProperty: 'DatatypeProperty',
      AnnotationProperty: 'AnnotationProperty',
      Restriction: 'Restriction',
      inverseOf: 'inverseOf',
      someValuesFrom: 'someValuesFrom',
      versionInfo: 'versionInfo'
    });
    expect(COMMON_NAMESPACE_REGISTRY.skos.ids).toMatchObject({
      Concept: 'Concept',
      ConceptScheme: 'ConceptScheme',
      hiddenLabel: 'hiddenLabel',
      scopeNote: 'scopeNote',
      exactMatch: 'exactMatch'
    });
    expect(COMMON_NAMESPACE_REGISTRY.xsd.ids).toMatchObject({
      anyURI: 'anyURI',
      normalizedString: 'normalizedString',
      nonNegativeInteger: 'nonNegativeInteger',
      unsignedInt: 'unsignedInt'
    });
    expect(COMMON_NAMESPACE_REGISTRY.dcterms.ids).toMatchObject({
      created: 'created',
      modified: 'modified',
      creator: 'creator',
      contributor: 'contributor',
      bibliographicCitation: 'bibliographicCitation',
      conformsTo: 'conformsTo'
    });

    expect(iriForNamespaceId('owl', 'ObjectProperty')).toEqual({
      ok: true,
      value: 'http://www.w3.org/2002/07/owl#ObjectProperty'
    });
    expect(iriForNamespaceId('skos', 'scopeNote')).toEqual({
      ok: true,
      value: 'http://www.w3.org/2004/02/skos/core#scopeNote'
    });
    expect(iriForNamespaceId('xsd', 'nonNegativeInteger')).toEqual({
      ok: true,
      value: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger'
    });
    expect(iriForNamespaceId('dcterms', 'modified')).toEqual({
      ok: true,
      value: 'http://purl.org/dc/terms/modified'
    });
    expect(iriForNamespaceId('cco2', 'informationContentEntity')).toEqual({
      ok: true,
      value: 'https://www.commoncoreontologies.org/ont00000958'
    });
    expect(iriForNamespaceId('cceo', 'ComputerProgramExecution')).toEqual({
      ok: true,
      value: 'http://www.ontologyrepository.com/CommonCoreOntologies/ComputerProgramExecution'
    });
    expect(iriForNamespaceId('okea', 'OntologyOfKnowledgeEngineeringArtifacts')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/OntologyOfKnowledgeEngineeringArtifacts'
    });
    expect(iriForNamespaceId('okea', 'OntologyMetadataProfile')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/OntologyMetadataProfile'
    });
    expect(iriForNamespaceId('okea', 'artifact')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/artifact'
    });
    expect(iriForNamespaceId('okea', 'hasGitRepositoryUrl')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_git_repository_url'
    });
    expect(iriForNamespaceId('okea', 'hasGeneratingSoftwareApplicationName')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_generating_software_application_name'
    });
    expect(iriForNamespaceId('okea', 'hasGenerationRunIdentifier')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_generation_run_identifier'
    });
    expect(iriForNamespaceId('okea', 'hasIssueTrackerUrl')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_issue_tracker_url'
    });
    expect(iriForNamespaceId('okea', 'hasOntologyDownloadUrl')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_ontology_download_url'
    });
    expect(iriForNamespaceId('okea', 'hasQualityAssuranceReportUrl')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_quality_assurance_report_url'
    });
    expect(iriForNamespaceId('okea', 'hasOntologyBaseIri')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_ontology_base_iri'
    });
    expect(iriForNamespaceId('okea', 'hasIriPolicyModeTextValue')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_iri_policy_mode_text_value'
    });
    expect(iriForNamespaceId('okea', 'hasOpaqueIriLocalNameIntegerWidthValue')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_opaque_iri_local_name_integer_width_value'
    });
    expect(iriForNamespaceId('okea', 'hasIriVersionInsertionPositionTextValue')).toEqual({
      ok: true,
      value: 'https://github.com/jonathanvajda/okea/has_iri_version_insertion_position_text_value'
    });
    expect(iriForNamespaceId('dc', 'contributor')).toEqual({
      ok: true,
      value: 'http://purl.org/dc/elements/1.1/contributor'
    });
    expect(iriForNamespaceId('iao', 'curationStatus')).toEqual({
      ok: true,
      value: 'http://purl.obolibrary.org/obo/IAO_0000114'
    });
    expect(iriForNamespaceId('iao', 'readyForRelease')).toEqual({
      ok: true,
      value: 'http://purl.obolibrary.org/obo/IAO_0000122'
    });
    expect(iriForNamespaceId('swrl', 'Imp')).toEqual({
      ok: true,
      value: 'http://www.w3.org/2003/11/swrl#Imp'
    });
    expect(iriForNamespaceId('cco', 'acronym')).toEqual({
      ok: false,
      error: 'unknown namespace',
      input: 'cco'
    });
    expect(iriForNamespaceId('cceo', 'acronym')).toEqual({
      ok: true,
      value: 'http://www.ontologyrepository.com/CommonCoreOntologies/ont00001753'
    });
    expect(iriForNamespaceId('cceo', 'curatedIn')).toEqual({
      ok: true,
      value: 'http://www.ontologyrepository.com/CommonCoreOntologies/is_curated_in_ontology'
    });
    expect(iriForNamespaceId('cco2', 'isTokenizedBy')).toEqual({
      ok: true,
      value: 'https://www.commoncoreontologies.org/ont00001761'
    });
    expect(iriForNamespaceId('cco2', 'hasTextValue')).toEqual({
      ok: true,
      value: 'https://www.commoncoreontologies.org/ont00001765'
    });
    expect(iriForNamespaceId('cco2', 'isSubjectOf')).toEqual({
      ok: true,
      value: 'https://www.commoncoreontologies.org/ont00001801'
    });
    expect(iriForNamespaceId('cco2', 'emailBox')).toEqual({
      ok: true,
      value: 'https://www.commoncoreontologies.org/ont00000906'
    });
    expect(iriForNamespaceId('cceo', 'hasBooleanValue')).toEqual({
      ok: true,
      value: 'http://www.ontologyrepository.com/CommonCoreOntologies/has_boolean_value'
    });
    expect(iriForNamespaceId('cco2', 'curatedIn')).toEqual({
      ok: true,
      value: 'https://www.commoncoreontologies.org/ont00001760'
    });
    expect(iriForNamespaceId('bfo', 'hasContinuantPart')).toEqual({
      ok: true,
      value: 'http://purl.obolibrary.org/obo/BFO_0000178'
    });
    expect(iriForNamespaceId('iao', 'definition')).toEqual({
      ok: true,
      value: 'http://purl.obolibrary.org/obo/IAO_0000115'
    });
    expect(iriForNamespaceId('oboInOwl', 'hasDbXref')).toEqual({
      ok: true,
      value: 'http://www.geneontology.org/formats/oboInOwl#hasDbXref'
    });
  });

  test('normalizePrefixMap and mergeProjectPrefixes validate and merge user/file prefixes', () => {
    const normalized = normalizePrefixMap({
      ex: ' https://example.org/ ',
      'bad prefix': 'https://example.org/bad/',
      nope: 'not an iri'
    });

    expect(normalized.prefixes).toEqual({ ex: 'https://example.org/' });
    expect(normalized.warnings).toEqual([
      'Ignored invalid prefix "bad prefix".',
      'Ignored prefix "nope" with invalid namespace IRI.'
    ]);

    const merged = mergeProjectPrefixes(
      { ex: 'https://example.org/old/', rdf: COMMON_NAMESPACE_REGISTRY.rdf.namespaceIri },
      { ex: 'https://example.org/new/' }
    );
    expect(merged.prefixes).toEqual({
      ex: 'https://example.org/new/',
      rdf: COMMON_NAMESPACE_REGISTRY.rdf.namespaceIri
    });
  });

  test('saveProjectPrefixes persists only normalized prefixes through an adapter', async () => {
    const calls = [];
    const adapter = {
      async saveProjectPrefixes(projectId, prefixes) {
        calls.push({ projectId, prefixes });
      }
    };

    const result = await saveProjectPrefixes(adapter, 'project-1', {
      ex: 'https://example.org/',
      bad: 'relative/path'
    });

    expect(result.prefixes).toEqual({ ex: 'https://example.org/' });
    expect(calls).toEqual([{ projectId: 'project-1', prefixes: { ex: 'https://example.org/' } }]);
  });

  test('RDF prefix extraction keeps Turtle, XMLNS, JSON-LD, and parser paths distinct', () => {
    expect(extractTurtlePrefixDeclarations('@prefix ex: <https://example.org/> .\nPREFIX owl: <http://www.w3.org/2002/07/owl#>')).toEqual({
      ex: 'https://example.org/',
      owl: 'http://www.w3.org/2002/07/owl#'
    });
    expect(extractXmlNamespacePrefixes('<rdf:RDF xmlns:rdf="http://rdf/" xmlns:ex="https://example.org/"></rdf:RDF>')).toEqual({
      rdf: 'http://rdf/',
      ex: 'https://example.org/'
    });

    const jsonld = extractJsonLdContextPrefixes('{"@context":{"ex":"https://example.org/","term":{"@id":"ex:term"}}}');
    expect(jsonld.ok).toBe(true);
    expect(jsonld.prefixes).toEqual({ ex: 'https://example.org/' });
    expect(jsonld.warnings).toEqual([
      'Ignored JSON-LD context term "term" because only string term values are supported.'
    ]);
    expect(extractJsonLdContextPrefixes('{"@context":["https://schema.org/",{"ex":"https://example.org/"}]}')).toMatchObject({
      ok: true,
      prefixes: {},
      warnings: ['Ignored JSON-LD array @context because only plain object contexts are supported.']
    });
    expect(extractJsonLdContextPrefixes('{bad json')).toMatchObject({
      ok: false,
      error: 'invalid jsonld'
    });

    expect(extractRdfPrefixesFromText('@prefix ex: <https://example.org/> .', { mimeType: 'text/turtle' })).toMatchObject({
      ok: true,
      prefixes: { ex: 'https://example.org/' },
      source: 'turtle-text'
    });
    expect(extractRdfPrefixesFromText('<rdf:RDF xmlns:ex="https://example.org/"></rdf:RDF>', { mimeType: 'application/rdf+xml' })).toMatchObject({
      ok: true,
      prefixes: { ex: 'https://example.org/' },
      source: 'xml-namespace'
    });
  });

  test('RDF parser prefix extraction adapter captures callback prefixes and reports parser errors', () => {
    const parser = {
      parse(text, callback) {
        callback(null, { subject: {} }, null);
        callback(null, null, { ex: 'https://example.org/' });
      }
    };
    expect(extractRdfPrefixesFromText('ignored', { n3Parser: parser })).toMatchObject({
      ok: true,
      prefixes: { ex: 'https://example.org/' },
      source: 'n3-parser'
    });

    const badParser = {
      parse(text, callback) {
        callback(new Error('bad rdf'), null, null);
      }
    };
    expect(extractRdfPrefixesFromText('ignored', { n3Parser: badParser })).toMatchObject({
      ok: false,
      error: 'rdf prefix parser error',
      message: 'bad rdf'
    });
  });

  test('CURIE compaction uses longest prefix matches and structured errors', () => {
    const prefixes = {
      ex: 'https://example.org/',
      exont: 'https://example.org/ontology/'
    };

    expect(findLongestPrefixMatch('https://example.org/ontology/Thing', prefixes)).toEqual({
      ok: true,
      prefix: 'exont',
      namespaceIri: 'https://example.org/ontology/'
    });
    expect(compactIriToCurie('https://example.org/ontology/Thing', prefixes)).toEqual({
      ok: true,
      value: 'exont:Thing',
      prefix: 'exont',
      namespaceIri: 'https://example.org/ontology/',
      localName: 'Thing'
    });
    expect(compactIriToCurie('not an iri', prefixes)).toEqual({
      ok: false,
      error: 'invalid iri',
      input: 'not an iri'
    });
    expect(compactIriToCurie('https://unknown.example/Thing', prefixes)).toEqual({
      ok: false,
      error: 'unknown namespace',
      input: 'https://unknown.example/Thing'
    });
    expect(formatIriForDisplay('https://example.org/ontology/Thing', prefixes)).toBe('exont:Thing');
    expect(formatIriForDisplay('https://unknown.example/path/Thing', prefixes)).toBe('Thing');
    expect(formatIriForDisplay(null, prefixes)).toBe('');
  });

  test('CURIE expansion returns explicit results for valid and invalid tokens', () => {
    const prefixes = { rdfs: COMMON_NAMESPACE_REGISTRY.rdfs.namespaceIri };
    expect(expandCurieToIri('rdfs:label', prefixes)).toEqual({
      ok: true,
      value: 'http://www.w3.org/2000/01/rdf-schema#label',
      prefix: 'rdfs',
      namespaceIri: 'http://www.w3.org/2000/01/rdf-schema#',
      localName: 'label'
    });
    expect(expandCurieToIri('missing:Thing', prefixes)).toEqual({
      ok: false,
      error: 'unknown prefix',
      input: 'missing:Thing',
      prefix: 'missing'
    });
    expect(expandCurieToIri('rdfs:', prefixes)).toEqual({
      ok: false,
      error: 'empty curie local name',
      input: 'rdfs:',
      prefix: 'rdfs'
    });
  });

  test('RDF serialization prefix adapters normalize N3 options and apply rdflib prefixes', () => {
    expect(createN3WriterOptionsWithPrefixes({
      format: 'Turtle',
      prefixes: { ex: 'https://example.org/', bad: 'relative' }
    })).toMatchObject({
      ok: true,
      value: { format: 'Turtle', prefixes: { ex: 'https://example.org/' } },
      warnings: ['Ignored prefix "bad" with invalid namespace IRI.']
    });

    const calls = [];
    const store = {
      setPrefixForURI(prefix, namespaceIri) {
        calls.push([prefix, namespaceIri]);
      }
    };
    expect(applyPrefixesToRdflibStore(store, { ex: 'https://example.org/', '': 'https://default.example/' })).toMatchObject({
      ok: true,
      warnings: []
    });
    expect(calls).toEqual([['ex', 'https://example.org/']]);
    expect(applyPrefixesToRdflibStore({}, { ex: 'https://example.org/' })).toMatchObject({
      ok: false,
      error: 'unsupported prefix target'
    });
  });

  test('RDF serialization prefix adapters select only prefixes used by RDF terms', () => {
    const result = selectPrefixesUsedByRdfTerms({
      ex: 'http://example.org/',
      owl: COMMON_NAMESPACE_REGISTRY.owl.namespaceIri,
      rdfs: COMMON_NAMESPACE_REGISTRY.rdfs.namespaceIri,
      skos: COMMON_NAMESPACE_REGISTRY.skos.namespaceIri,
      xsd: COMMON_NAMESPACE_REGISTRY.xsd.namespaceIri
    }, [
      {
        subject: { termType: 'NamedNode', value: 'http://example.org/ont000001' },
        predicate: { termType: 'NamedNode', value: COMMON_NAMESPACE_IRIS.rdf.type },
        object: { termType: 'NamedNode', value: COMMON_NAMESPACE_IRIS.owl.Class },
        graph: { termType: 'DefaultGraph', value: '' }
      },
      {
        subject: { termType: 'NamedNode', value: 'http://example.org/ont000001' },
        predicate: { termType: 'NamedNode', value: COMMON_NAMESPACE_IRIS.rdfs.label },
        object: {
          termType: 'Literal',
          value: 'Doctor',
          datatype: { termType: 'NamedNode', value: COMMON_NAMESPACE_IRIS.xsd.string }
        },
        graph: { termType: 'DefaultGraph', value: '' }
      }
    ]);

    expect(result).toEqual({
      ok: true,
      value: Object.freeze({
        ex: 'http://example.org/',
        owl: COMMON_NAMESPACE_REGISTRY.owl.namespaceIri,
        rdfs: COMMON_NAMESPACE_REGISTRY.rdfs.namespaceIri
      }),
      warnings: []
    });
  });

  test('namespace stem helpers derive and discover base namespace evidence', () => {
    expect(deriveNamespaceStemFromIri('https://example.org/ont#Thing')).toEqual({
      ok: true,
      value: 'https://example.org/ont#',
      source: 'hash'
    });
    expect(deriveNamespaceStemFromIri('https://example.org/ont/Thing')).toEqual({
      ok: true,
      value: 'https://example.org/ont/',
      source: 'slash'
    });

    const store = {
      getQuads() {
        return [
          {
            subject: { termType: 'NamedNode', value: 'https://example.org/a#S' },
            predicate: { termType: 'NamedNode', value: 'https://example.org/p/P' },
            object: { termType: 'Literal', value: 'label' },
            graph: { termType: 'DefaultGraph', value: '' }
          }
        ];
      }
    };
    expect(listNamespaceStemsInStore(store)).toEqual({
      ok: true,
      value: ['https://example.org/a#', 'https://example.org/p/']
    });
    expect(discoverBaseIriOrNamespaceStem({ ontologyIri: 'https://example.org/ont#Ontology' })).toEqual({
      ok: true,
      value: 'https://example.org/ont#',
      source: 'ontologyIri'
    });
    expect(deriveNamespaceStemFromIri('not an iri')).toEqual({
      ok: false,
      error: 'invalid iri',
      input: 'not an iri'
    });
    expect(listNamespaceStemsInStore(null)).toEqual({
      ok: true,
      value: []
    });
    expect(discoverBaseIriOrNamespaceStem({ baseIri: 'relative', store: null })).toEqual({
      ok: false,
      error: 'base iri not found',
      input: ''
    });
  });
});
