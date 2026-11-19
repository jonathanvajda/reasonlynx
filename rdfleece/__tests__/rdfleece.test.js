import { buildJsonSchema, buildRdfleeceRun, finalizeSchemaModel, inferJsonSchemaModel, modelFromJsonSchema, NS } from '../app/core.js';

const ids = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555'];
const options = { baseInstanceIri:'https://example.org/i/', basePredicateIri:'https://example.org/v/', prefixHas:true, casing:'camelCase', uuidFactory:() => ids.shift() };

test('infers key predicates and mixed array kinds', () => {
  const model = finalizeSchemaModel(inferJsonSchemaModel({ crew:[{ name:'Atalanta' },'Orpheus',12,null] }, options), {}, options);
  const crew = model.fields.find((field) => field.path === '/crew');
  expect(crew.predicateIri).toBe('https://example.org/v/hasCrew');
  expect(crew.itemKinds).toEqual(['object','string','integer','null']);
});

test('uses structural root identity and key-derived predicates', () => {
  const source = { name:'Argo', captain:{ name:'Jason' } };
  const schema = finalizeSchemaModel(inferJsonSchemaModel(source, options), {}, options);
  const run = buildRdfleeceRun(source, schema, options);
  expect(run.rootIri).toMatch(/^https:\/\/example.org\/i\/root-000001-/);
  expect(run.rootIri).not.toContain('Argo');
  expect(run.rootIri).not.toContain('row');
  expect(run.abox).toContainEqual(expect.objectContaining({ s:run.rootIri, p:'https://example.org/v/hasName', oValue:'Argo', oType:'literal' }));
  expect(run.abox).toContainEqual(expect.objectContaining({ s:run.rootIri, p:'https://example.org/v/hasCaptain', oType:'iri' }));
});

test('preserves absolute predicate IRIs and does not auto-convert URL strings', () => {
  const source = { 'https://schema.org/url':'https://example.com/argo' };
  const schema = finalizeSchemaModel(inferJsonSchemaModel(source, options), {}, options);
  const run = buildRdfleeceRun(source, schema, options);
  expect(schema.fields[0].predicateIri).toBe('https://schema.org/url');
  expect(run.abox).toContainEqual(expect.objectContaining({ p:'https://schema.org/url', oType:'literal', datatypeIri:`${NS.xsd}string` }));
});

test('generates nested JSON Schema with mixed array alternatives', () => {
  const source = { captain:{ name:'Jason' }, crew:[{ name:'Atalanta' },'Orpheus',null] };
  const schema = finalizeSchemaModel(inferJsonSchemaModel(source, options), {}, options);
  const generated = buildJsonSchema(schema);
  expect(generated.properties.captain.properties.name.type).toBe('string');
  expect(generated.properties.crew.items.anyOf).toEqual(expect.arrayContaining([
    expect.objectContaining({ type:'object' }),
    { type:'string' },
    { type:'null' }
  ]));
});

test('imports required, nullable, nested, and array JSON Schema fields', () => {
  const model = finalizeSchemaModel(modelFromJsonSchema({
    $schema:'https://json-schema.org/draft/2020-12/schema', type:'object', required:['captain'],
    properties:{ captain:{ type:['object','null'], properties:{ name:{ type:'string' } } }, crew:{ type:'array', items:{ type:'object', properties:{ name:{ type:'string' } } } } }
  }, options), {}, options);
  expect(model.fields.find((field) => field.path === '/captain')).toEqual(expect.objectContaining({ required:true, nullable:true }));
  expect(model.fields.find((field) => field.path === '/crew').itemKinds).toEqual(['object']);
  expect(model.fields.some((field) => field.path === '/crew/*/name')).toBe(true);
});

test('recomputes predicates from current casing and has-prefix preferences', () => {
  const inferred = inferJsonSchemaModel({ crewMember:'Atalanta' }, options);
  const snake = finalizeSchemaModel(inferred, {}, { ...options, casing:'snake_case', prefixHas:true });
  const shout = finalizeSchemaModel(inferred, {}, { ...options, casing:'SHOUT_CASE', prefixHas:false });
  expect(snake.fields[0].predicateIri).toBe('https://example.org/v/has_crew_member');
  expect(shout.fields[0].predicateIri).toBe('https://example.org/v/CREW_MEMBER');
});

test('annotates ontology and properties with provenance metadata', () => {
  const source = { crew:'Argonauts' };
  const schema = finalizeSchemaModel(inferJsonSchemaModel(source, options), {}, { ...options, casing:'snake_case' });
  const run = buildRdfleeceRun(source, schema, { ...options, casing:'snake_case', sourceFilename:'argo-crew.json', createdAtIso:'2026-11-18T23:32:05.511Z' });
  expect(run.tbox).toContainEqual(expect.objectContaining({ s:run.ontologyIri, p:`${NS.rdf}type`, oValue:`${NS.owl}Ontology` }));
  expect(run.tbox).toContainEqual(expect.objectContaining({ s:run.ontologyIri, p:`${NS.dcterms}source`, oValue:'argo-crew.json' }));
  expect(run.tbox).toContainEqual(expect.objectContaining({ p:`${NS.dcterms}created`, oValue:'2026-11-18T23:32:05.511Z', datatypeIri:`${NS.xsd}dateTime` }));
  expect(run.tbox).toContainEqual(expect.objectContaining({ s:'https://example.org/v/has_crew', p:`${NS.dcterms}identifier`, oValue:'crew' }));
  expect(run.tbox).toContainEqual(expect.objectContaining({ s:'https://example.org/v/has_crew', p:`${NS.rdfs}comment`, oValue:"Generated by RDFleece from source JSON key 'crew' at path '/crew'." }));
  const predicates = new Set(run.tbox.filter((quad) => quad.s === run.ontologyIri).map((quad) => quad.p));
  expect(predicates).not.toContain(`${NS.okea}has_iri_local_name_delimiter_text_value`);
  expect(predicates).not.toContain(`${NS.okea}has_opaque_iri_local_name_prefix_text_value`);
  expect(predicates).not.toContain(`${NS.okea}has_opaque_iri_local_name_integer_width_value`);
  expect(predicates).not.toContain(`${NS.okea}has_opaque_iri_local_name_integer_start_value`);
  expect(run.tbox).toContainEqual(expect.objectContaining({
    s:run.ontologyIri,
    p:`${NS.okea}has_iri_local_name_style_text_value`,
    oValue:'snake_case'
  }));
});

test('contextualizes colliding key-derived predicates by nearest ancestors', () => {
  const source = { organizations:{ org1:{ name:'Acme' } }, titles:{ title1:{ name:'President' } } };
  const schema = finalizeSchemaModel(inferJsonSchemaModel(source, options), {}, { ...options, casing:'snake_case' });
  const byPath = Object.fromEntries(schema.fields.map((field) => [field.path, field.predicateLocalName]));
  expect(byPath['/organizations/org1/name']).toBe('has_org1_name');
  expect(byPath['/titles/title1/name']).toBe('has_title1_name');
  expect(new Set(schema.fields.map((field) => field.predicateIri)).size).toBe(schema.fields.length);
});

test('preserves deliberate predicate reuse through explicit overrides', () => {
  const source = { organizations:{ name:'Acme' }, titles:{ name:'President' } };
  const inferred = inferJsonSchemaModel(source, options);
  const schema = finalizeSchemaModel(inferred, {
    '/organizations/name':{ predicateLocalName:'hasSharedName' },
    '/titles/name':{ predicateLocalName:'hasSharedName' }
  }, options);
  expect(schema.fields.filter((field) => field.key === 'name').map((field) => field.predicateIri)).toEqual([
    'https://example.org/v/hasSharedName', 'https://example.org/v/hasSharedName'
  ]);
});

