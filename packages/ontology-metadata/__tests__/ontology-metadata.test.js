import {
  buildOpaqueOntologyIri,
  buildReadableOntologyIri,
  collectUsedOpaqueOntologyIriNumbers,
  createOntologySettingsViewFromMetadataRecord,
  deriveOntologyImportTarget,
  findMaxOpaqueOntologyIriNumber,
  findNextAvailableOpaqueOntologyIriNumber,
  generateOntologySettings,
  normalizeOntologyMetadataRecord,
  ONTOLOGY_METADATA_PROFILE_SETTING_KEY,
  readOntologyMetadataRecordFromQuads,
  writeOntologyMetadataQuads,
  readOntologyRecordsFromJsonLd
} from '../src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../namespace-registry/src/index.js';
import { createRdfDataset } from '../../rdf-io/src/rdf-model.js';

describe('ontology-metadata package source', () => {
  test('reads ontology metadata from JSON-LD and preserves preferred predicates', () => {
    const result = readOntologyRecordsFromJsonLd({
      '@graph': [{
        '@id': 'https://example.org/ont',
        '@type': COMMON_NAMESPACE_IRIS.owl.Ontology,
        [COMMON_NAMESPACE_IRIS.dcterms.title]: { '@value': 'Example Ontology', '@language': 'en' },
        [COMMON_NAMESPACE_IRIS.owl.imports]: { '@id': 'https://example.org/imported' }
      }]
    });

    expect(result.records[0]).toMatchObject({
      iri: 'https://example.org/ont',
      label: 'Example Ontology',
      imports: ['https://example.org/imported']
    });
  });

  test('generates metadata settings and provisions local IRIs', () => {
    const settings = generateOntologySettings({
      base: 'https://example.org',
      label: 'Example Ontology',
      dateParts: { year: '2026', month: '08', day: '10' }
    });

    expect(settings['@id']).toBe('https://example.org/ExampleOntology');
    expect(settings.iriMode).toBeUndefined();
    expect(settings.base).toBeUndefined();
    expect(settings.opaqueDigits).toBeUndefined();
    expect(settings[COMMON_NAMESPACE_IRIS.owl.versionIRI]).toEqual([{ '@id': 'https://example.org/2026-08-10/ExampleOntology' }]);
    expect(findNextAvailableOpaqueOntologyIriNumber(new Set([1, 2]), settings, 1)).toBe(3);
    expect(buildOpaqueOntologyIri(3, settings)).toBe('https://example.org/ont000003');
    expect(buildReadableOntologyIri('Example entity', { ...settings, readableCase: 'PascalCase' }, new Set(['https://example.org/ExampleEntity']))).toBe('https://example.org/ExampleEntity_2');
    expect(createOntologySettingsViewFromMetadataRecord(settings)).toMatchObject({
      iri: 'https://example.org/ExampleOntology',
      base: 'https://example.org',
      iriMode: 'opaque',
      opaqueDigits: 6
    });
  });

  test('provisions opaque IRIs from canonical full-IRI policy values', () => {
    const settings = normalizeOntologyMetadataRecord({
      iri: 'https://example.org/ExampleOntology',
      [COMMON_NAMESPACE_IRIS.okea.hasOntologyBaseIri]: 'https://example.org/custom',
      [COMMON_NAMESPACE_IRIS.okea.hasIriLocalNameDelimiterTextValue]: '#',
      [COMMON_NAMESPACE_IRIS.okea.hasOpaqueIriLocalNamePrefixTextValue]: 'term',
      [COMMON_NAMESPACE_IRIS.okea.hasOpaqueIriLocalNameIntegerWidthValue]: 4,
      [COMMON_NAMESPACE_IRIS.okea.hasOpaqueIriLocalNameIntegerStartValue]: 10
    });

    expect(buildOpaqueOntologyIri(12, settings)).toBe('https://example.org/custom#term0012');
    expect(collectUsedOpaqueOntologyIriNumbers(['https://example.org/custom#term0012'], settings)).toEqual(new Set([12]));
    expect(findMaxOpaqueOntologyIriNumber(['https://example.org/custom#term0012'], settings)).toBe(12);
    expect(findNextAvailableOpaqueOntologyIriNumber(new Set([10, 11, 12]), settings)).toBe(13);
  });

  test('normalizes legacy settings into full-IRI metadata profile records', () => {
    const record = normalizeOntologyMetadataRecord({
      iri: 'https://example.org/ExampleOntology',
      base: 'https://example.org',
      label: 'Example Ontology',
      creator: 'Creator',
      contributors: ['Contributor'],
      iriMode: 'readable'
    });

    expect(ONTOLOGY_METADATA_PROFILE_SETTING_KEY).toBe(COMMON_NAMESPACE_IRIS.okea.OntologyMetadataProfile);
    expect(record[COMMON_NAMESPACE_IRIS.dcterms.creator]).toEqual([{ '@value': 'Creator' }]);
    expect(record[COMMON_NAMESPACE_IRIS.dcterms.contributor]).toEqual([{ '@value': 'Contributor' }]);
    expect(record[COMMON_NAMESPACE_IRIS.okea.hasIriPolicyModeTextValue]).toEqual([{ '@value': 'readable' }]);
    expect(createOntologySettingsViewFromMetadataRecord(record)[COMMON_NAMESPACE_IRIS.dcterms.creator]).toBe('Creator');
  });

  test('writes and reads ontology metadata quads', () => {
    const record = normalizeOntologyMetadataRecord({
      iri: 'https://example.org/ExampleOntology',
      label: 'Example Ontology',
      createdAtIso: '2026-08-10T15:32:45.000Z',
      [COMMON_NAMESPACE_IRIS.dcterms.format]: 'text/turtle',
      [COMMON_NAMESPACE_IRIS.dcterms.source]: 'source-file.csv',
      [COMMON_NAMESPACE_IRIS.owl.imports]: ['https://example.org/imported'],
      [COMMON_NAMESPACE_IRIS.dcterms.creator]: 'https://orcid.org/0000-0000-0000-0000',
      [COMMON_NAMESPACE_IRIS.okea.hasGeneratingSoftwareApplicationName]: 'Table-Nova',
      [COMMON_NAMESPACE_IRIS.okea.hasGenerationRunIdentifier]: 'run:table-nova:test'
    });
    const quads = writeOntologyMetadataQuads(record);

    expect(quads).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: expect.objectContaining({ value: COMMON_NAMESPACE_IRIS.rdf.type }),
        object: expect.objectContaining({ value: COMMON_NAMESPACE_IRIS.owl.Ontology })
      }),
      expect.objectContaining({
        predicate: expect.objectContaining({ value: COMMON_NAMESPACE_IRIS.dcterms.title }),
        object: expect.objectContaining({ value: 'Example Ontology' })
      }),
      expect.objectContaining({
        predicate: expect.objectContaining({ value: COMMON_NAMESPACE_IRIS.dcterms.format }),
        object: expect.objectContaining({ value: 'text/turtle' })
      }),
      expect.objectContaining({
        predicate: expect.objectContaining({ value: COMMON_NAMESPACE_IRIS.okea.hasGenerationRunIdentifier }),
        object: expect.objectContaining({ value: 'run:table-nova:test' })
      })
    ]));

    const roundTrip = readOntologyMetadataRecordFromQuads(createRdfDataset(quads));
    expect(roundTrip['@id']).toBe('https://example.org/ExampleOntology');
    expect(roundTrip[COMMON_NAMESPACE_IRIS.owl.imports]).toEqual([{ '@id': 'https://example.org/imported' }]);
    expect(roundTrip[COMMON_NAMESPACE_IRIS.dcterms.created]).toEqual([{ '@value': '2026-08-10T15:32:45.000Z', '@type': COMMON_NAMESPACE_IRIS.xsd.dateTime }]);
    expect(roundTrip[COMMON_NAMESPACE_IRIS.dcterms.source]).toEqual([{ '@value': 'source-file.csv' }]);
    expect(roundTrip[COMMON_NAMESPACE_IRIS.okea.hasGeneratingSoftwareApplicationName]).toEqual([{ '@value': 'Table-Nova' }]);
  });

  test('derives import target from owl:Ontology quads', () => {
    expect(deriveOntologyImportTarget([
      {
        subject: { value: 'https://example.org/ont' },
        predicate: { value: COMMON_NAMESPACE_IRIS.rdf.type },
        object: { value: COMMON_NAMESPACE_IRIS.owl.Ontology }
      }
    ])).toEqual({
      ontologyIri: 'https://example.org/ont',
      importIri: 'https://example.org/ont'
    });
  });
});
