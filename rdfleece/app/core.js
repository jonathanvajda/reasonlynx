import { buildPredicateLocalName } from '../../table-nova/app/rdf/schema.js';
import { isAbsoluteIri } from '../../packages/ontology-utils/src/index.js';
import { buildLabelFromWords, normalizeStringToCase, splitStringToWords } from '../../packages/normalization-utils/src/index.js';

export const NS = Object.freeze({
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  sh: 'http://www.w3.org/ns/shacl#',
  dcterms: 'http://purl.org/dc/terms/',
  okea: 'https://github.com/jonathanvajda/okea/',
  rdfleece: 'https://example.org/RDFleece/'
});

const DEFAULTS = Object.freeze({
  baseInstanceIri: `${NS.rdfleece}instance/`,
  basePredicateIri: NS.rdfleece,
  baseGraphIri: `${NS.rdfleece}run/`,
  prefixHas: true,
  casing: 'camelCase',
  preserveNulls: true,
  valueMode: 'auto'
});

export function inferJsonSchemaModel(value, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const fields = new Map();
  visit(value, '', null);
  return { rootKind: kindOf(value), fields: [...fields.values()].sort((a, b) => a.path.localeCompare(b.path)) };

  function visit(node, path, key) {
    const kind = kindOf(node);
    if (key !== null) {
      const field = fields.get(path) || createField(path, key, config);
      field.kinds.add(kind);
      field.occurrences += 1;
      if (kind === 'null') field.nullable = true;
      if (kind === 'array') {
        field.minItems = Math.min(field.minItems ?? node.length, node.length);
        field.maxItems = Math.max(field.maxItems ?? 0, node.length);
        node.forEach((item) => field.itemKinds.add(kindOf(item)));
      }
      if (isScalar(node) && node !== null && field.examples.length < 3 && !field.examples.includes(node)) field.examples.push(node);
      fields.set(path, field);
    }
    if (kind === 'object') {
      for (const childKey of Object.keys(node).sort()) visit(node[childKey], `${path}/${escapePointer(childKey)}`, childKey);
    } else if (kind === 'array') {
      node.forEach((item) => {
        if (kindOf(item) === 'object' || kindOf(item) === 'array') visit(item, `${path}/*`, null);
      });
    }
  }
}

export function modelFromJsonSchema(document, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const fields = [];
  const rootTypes = schemaTypes(document);
  walkObject(document, '');
  return { rootKind: rootTypes.find((type) => type !== 'null') || 'object', fields: fields.sort((a, b) => a.path.localeCompare(b.path)) };

  function walkObject(node, path) {
    const required = new Set(Array.isArray(node?.required) ? node.required : []);
    for (const [key, child] of Object.entries(node?.properties || {})) {
      const childPath = `${path}/${escapePointer(key)}`;
      const field = createField(childPath, key, config);
      const types = schemaTypes(child);
      types.forEach((type) => field.kinds.add(type));
      field.nullable = types.includes('null');
      field.required = required.has(key);
      field.label = String(child.title || key);
      field.examples = Array.isArray(child.examples) ? child.examples.slice(0, 3) : child.default !== undefined ? [child.default] : [];
      field.datatypeIri = datatypeForSchemaTypes(types, child.format);
      if (types.includes('array') || child.items) {
        const choices = Array.isArray(child.items?.anyOf) ? child.items.anyOf : [child.items || {}];
        choices.flatMap(schemaTypes).forEach((type) => field.itemKinds.add(type));
        field.minItems = Number.isInteger(child.minItems) ? child.minItems : null;
        field.maxItems = Number.isInteger(child.maxItems) ? child.maxItems : null;
      }
      fields.push(field);
      if (types.includes('object') || child.properties) walkObject(child, childPath);
      if (types.includes('array') || child.items) {
        const choices = Array.isArray(child.items?.anyOf) ? child.items.anyOf : [child.items || {}];
        choices.filter((choice) => schemaTypes(choice).includes('object') || choice?.properties).forEach((choice) => walkObject(choice, `${childPath}/*`));
      }
    }
  }
}

function createField(path, key, options) {
  const predicateLocalName = buildPredicateLocalName(key, {
    prefixHas: options.prefixHas,
    casing: options.casing,
    whenNoHeader: 'ordinal'
  });
  const predicateIri = isAbsoluteIri(key, { allowedSchemes: null })
    ? key
    : `${ensureBase(options.basePredicateIri)}${predicateLocalName || 'hasJsonValue'}`;
  return {
    path,
    key,
    label: key,
    predicateLocalName,
    predicateIri,
    kinds: new Set(),
    itemKinds: new Set(),
    datatypeIri: `${NS.xsd}string`,
    required: false,
    nullable: false,
    occurrences: 0,
    examples: [],
    minItems: null,
    maxItems: null,
    valueMode: options.valueMode || 'auto'
  };
}

export function finalizeSchemaModel(model, overrides = {}, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const fields = model.fields.map((raw) => {
      const override = overrides[raw.path] || {};
      const kinds = [...raw.kinds];
      const itemKinds = [...raw.itemKinds];
      const datatypeIri = override.datatypeIri || inferDatatype(raw.examples, kinds, config);
      const predicateLocalName = override.predicateLocalName || buildPredicateLocalName(raw.key, {
        prefixHas: config.prefixHas,
        casing: config.casing,
        whenNoHeader: 'ordinal'
      });
      return {
        ...raw,
        ...override,
        kinds,
        itemKinds,
        datatypeIri,
        predicateLocalName,
        predicateIri: override.predicateIri || (isAbsoluteIri(raw.key, { allowedSchemes: null })
          ? raw.key
          : `${ensureBase(config.basePredicateIri)}${predicateLocalName}`)
      };
    });
  resolveGeneratedPredicateCollisions(fields, overrides, config);
  return { ...model, fields };
}

export function buildRdfleeceRun(value, schema, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const fields = new Map(schema.fields.map((field) => [field.path, field]));
  const counters = { root: 0, object: 0, array: 0, value: 0 };
  const uuid = typeof config.uuidFactory === 'function' ? config.uuidFactory : () => crypto.randomUUID();
  const abox = [];
  const tbox = [];
  const createdAtIso = validIso(config.createdAtIso);
  const graphIri = `${ensureBase(config.baseGraphIri)}rdfleece-${uuid()}`;
  const sourceFilename = localFileName(config.sourceFilename || 'source.json');
  const ontologyTitle = generatedOntologyTitle(sourceFilename);
  const ontologyLocalName = normalizeStringToCase(ontologyTitle, 'PascalCase', { fallbackStyle: 'PascalCase' }) || 'GeneratedRDFleeceSchema';
  const ontologyIri = `${ensureBase(config.basePredicateIri)}${ontologyLocalName}`;
  const root = makeNode('root');
  const rootClass = `${ensureBase(config.basePredicateIri)}JsonDocument`;
  iriQuad(abox, root, `${NS.rdf}type`, rootClass);
  mapValue(value, root, '', null, true);
  buildTbox();
  return {
    rootIri: root,
    graphIri,
    ontologyIri,
    abox,
    tbox,
    combined: [...tbox, ...abox],
    shacl: buildShacl(schema, config),
    dataDictionaryCsv: buildDataDictionary(schema),
    jsonSchema: buildJsonSchema(schema, config)
  };

  function makeNode(role) {
    counters[role] += 1;
    return `${ensureBase(config.baseInstanceIri)}${role}-${String(counters[role]).padStart(6, '0')}-${uuid()}`;
  }

  function mapValue(node, subject, path, predicate, isRoot = false) {
    const kind = kindOf(node);
    if (kind === 'object') {
      for (const key of Object.keys(node).sort()) {
        const childPath = `${path}/${escapePointer(key)}`;
        const field = fields.get(childPath);
        if (!field) continue;
        emitField(subject, field, node[key], childPath);
      }
      return;
    }
    if (kind === 'array') {
      node.forEach((item) => emitAnonymousValue(subject, predicate || `${NS.rdfleece}hasJsonValue`, item, `${path}/*`));
      return;
    }
    emitScalar(subject, predicate || `${NS.rdfleece}hasJsonValue`, node, null);
  }

  function emitField(subject, field, node, path) {
    if (Array.isArray(node)) {
      node.forEach((item) => emitAnonymousValue(subject, field.predicateIri, item, `${path}/*`, field));
      return;
    }
    emitAnonymousValue(subject, field.predicateIri, node, path, field);
  }

  function emitAnonymousValue(subject, predicate, node, path, field = null) {
    const kind = kindOf(node);
    if (kind === 'object' || kind === 'array') {
      const child = makeNode(kind === 'object' ? 'object' : 'array');
      iriQuad(abox, subject, predicate, child);
      iriQuad(abox, child, `${NS.rdf}type`, kind === 'object' ? `${ensureBase(config.basePredicateIri)}JsonObject` : `${ensureBase(config.basePredicateIri)}JsonArray`);
      mapValue(node, child, path, null);
    } else {
      emitScalar(subject, predicate, node, field);
    }
  }

  function emitScalar(subject, predicate, value, field) {
    if (value === null) {
      if (!config.preserveNulls) return;
      const nullNode = makeNode('value');
      iriQuad(abox, subject, predicate, nullNode);
      iriQuad(abox, nullNode, `${NS.rdf}type`, `${NS.rdfleece}JsonNull`);
      return;
    }
    const mode = field?.valueMode || config.valueMode;
    if (mode === 'iri' && isAbsoluteIri(value, { allowedSchemes: null })) iriQuad(abox, subject, predicate, String(value));
    else literalQuad(abox, subject, predicate, value, field?.datatypeIri || inferScalarDatatype(value));
  }

  function buildTbox() {
    addOntologyMetadata();
    iriQuad(tbox, rootClass, `${NS.rdf}type`, `${NS.owl}Class`);
    literalQuad(tbox, rootClass, `${NS.rdfs}label`, 'JSON document', `${NS.xsd}string`);
    for (const field of schema.fields) {
      const nonNull = field.kinds.filter((kind) => kind !== 'null');
      const resource = nonNull.some((kind) => kind === 'object' || kind === 'array') || field.itemKinds.some((kind) => kind === 'object' || kind === 'array');
      const literal = nonNull.some((kind) => !['object', 'array'].includes(kind)) || field.itemKinds.some((kind) => !['object', 'array', 'null'].includes(kind));
      iriQuad(tbox, field.predicateIri, `${NS.rdf}type`, resource && literal ? `${NS.rdf}Property` : resource ? `${NS.owl}ObjectProperty` : `${NS.owl}DatatypeProperty`);
      literalQuad(tbox, field.predicateIri, `${NS.rdfs}label`, field.label, `${NS.xsd}string`);
      if (!resource) iriQuad(tbox, field.predicateIri, `${NS.rdfs}range`, field.datatypeIri);
      else if (!literal) iriQuad(tbox, field.predicateIri, `${NS.rdfs}range`, `${ensureBase(config.basePredicateIri)}JsonObject`);
      literalQuad(tbox, field.predicateIri, `${NS.dcterms}identifier`, field.key, `${NS.xsd}string`);
      literalQuad(tbox, field.predicateIri, `${NS.rdfs}comment`, `Generated by RDFleece from source JSON key '${field.key}' at path '${field.path}'.`, `${NS.xsd}string`);
    }
  }

  function addOntologyMetadata() {
    const versionToken = createdAtIso.replace(/\.\d{3}Z$/, 'Z').replaceAll(':', '-');
    const versionIri = `${ensureBase(config.basePredicateIri)}${versionToken}/${ontologyLocalName}`;
    const runId = `run:rdfleece:${encodeURIComponent(graphIri)}`;
    iriQuad(tbox, ontologyIri, `${NS.rdf}type`, `${NS.owl}Ontology`);
    iriQuad(tbox, ontologyIri, `${NS.owl}versionIRI`, versionIri);
    literalQuad(tbox, ontologyIri, `${NS.owl}versionInfo`, createdAtIso, `${NS.xsd}string`);
    literalQuad(tbox, ontologyIri, `${NS.dcterms}created`, createdAtIso, `${NS.xsd}dateTime`);
    literalQuad(tbox, ontologyIri, `${NS.dcterms}modified`, createdAtIso, `${NS.xsd}dateTime`);
    literalQuad(tbox, ontologyIri, `${NS.dcterms}title`, ontologyTitle, null, 'en');
    literalQuad(tbox, ontologyIri, `${NS.dcterms}description`, `This data schema was automatically generated by RDFleece from JSON source ${sourceFilename} on ${createdAtIso}, guided by user-selected JSON-to-RDF mapping preferences. It is a naive ontology of the supplied data structure and is not purported to be a robust account of a domain on its own. Use at your own risk.`, null, 'en');
    literalQuad(tbox, ontologyIri, `${NS.dcterms}source`, sourceFilename, `${NS.xsd}string`);
    literalQuad(tbox, ontologyIri, `${NS.dcterms}creator`, 'Generated by RDFleece', `${NS.xsd}string`);
    literalQuad(tbox, ontologyIri, `${NS.dcterms}format`, 'text/turtle', `${NS.xsd}string`);
    literalQuad(tbox, ontologyIri, `${NS.okea}has_generating_software_application_name`, 'RDFleece', `${NS.xsd}string`);
    literalQuad(tbox, ontologyIri, `${NS.okea}has_generation_run_identifier`, runId, `${NS.xsd}string`);
    literalQuad(tbox, ontologyIri, `${NS.okea}has_ontology_base_iri`, ensureBase(config.basePredicateIri), `${NS.xsd}anyURI`);
    literalQuad(tbox, ontologyIri, `${NS.okea}has_iri_policy_mode_text_value`, 'readable', `${NS.xsd}string`);
    literalQuad(tbox, ontologyIri, `${NS.okea}has_iri_local_name_style_text_value`, config.casing, `${NS.xsd}string`);
    literalQuad(tbox, ontologyIri, `${NS.okea}has_iri_version_token_strategy_text_value`, 'datetime', `${NS.xsd}string`);
    literalQuad(tbox, ontologyIri, `${NS.okea}has_iri_version_insertion_position_text_value`, 'infix', `${NS.xsd}string`);
  }
}

export function buildShacl(schema, options = {}) {
  const base = ensureBase(options.basePredicateIri || DEFAULTS.basePredicateIri);
  const lines = [`@prefix sh: <${NS.sh}> .`, `@prefix xsd: <${NS.xsd}> .`, '', `<${base}JsonDocumentShape> a sh:NodeShape ;`, `  sh:targetClass <${base}JsonDocument>`];
  schema.fields.filter((field) => field.path.split('/').length === 2).forEach((field) => {
    lines[lines.length - 1] += ' ;';
    lines.push('  sh:property [', `    sh:path <${field.predicateIri}> ;`);
    if (field.required) lines.push('    sh:minCount 1 ;');
    if (!field.kinds.some((kind) => kind === 'object' || kind === 'array')) lines.push(`    sh:datatype <${field.datatypeIri}> ;`);
    lines.push('  ]');
  });
  lines[lines.length - 1] += ' .';
  return lines.join('\n');
}

export function buildDataDictionary(schema) {
  const headers = ['path', 'key', 'label', 'kinds', 'item kinds', 'predicate IRI', 'datatype IRI', 'required', 'nullable', 'examples'];
  const rows = schema.fields.map((field) => [field.path, field.key, field.label, field.kinds.join('|'), field.itemKinds.join('|'), field.predicateIri, field.datatypeIri, field.required, field.nullable, field.examples.join('|')]);
  return [headers, ...rows].map((row) => row.map(csv).join(',')).join('\n') + '\n';
}

export function buildJsonSchema(schema, options = {}) {
  const root = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: options.title || 'RDFleece generated schema',
    ...shapeFor('', schema.rootKind)
  };
  return root;

  function shapeFor(path, kind) {
    if (kind === 'object') {
      const properties = {};
      const required = [];
      for (const field of directFields(schema.fields, path)) {
        properties[field.key] = { title: field.label, ...fieldShape(field) };
        if (field.required) required.push(field.key);
      }
      return { type: 'object', properties, additionalProperties: false, ...(required.length ? { required } : {}) };
    }
    if (kind === 'array') return { type: 'array', items: itemShape(path) };
    return { type: jsonType(kind) || 'string' };
  }

  function fieldShape(field) {
    if (field.itemKinds.length) {
      return {
        type: field.nullable ? ['array', 'null'] : 'array',
        items: itemShape(field.path),
        ...(field.minItems !== null ? { minItems: field.minItems } : {}),
        ...(field.maxItems !== null ? { maxItems: field.maxItems } : {})
      };
    }
    const kinds = field.kinds.map(jsonType).filter(Boolean);
    const primary = kinds.includes('object') ? shapeFor(field.path, 'object') : { type: collapseTypes(kinds) };
    return { ...primary, ...(field.examples.length ? { examples: field.examples } : {}) };
  }

  function itemShape(path) {
    const parent = schema.fields.find((field) => field.path === path);
    const kinds = parent?.itemKinds || [];
    const choices = kinds.filter((kind) => kind !== 'null').map((kind) => kind === 'object' ? shapeFor(`${path}/*`, 'object') : shapeFor(`${path}/*`, kind));
    if (kinds.includes('null')) choices.push({ type: 'null' });
    return choices.length === 1 ? choices[0] : { anyOf: choices.length ? choices : [{}] };
  }
}

export function quadRecordsToN3(records, N3) {
  const store = new N3.Store();
  for (const q of records) {
    const subject = N3.DataFactory.namedNode(q.s);
    const predicate = N3.DataFactory.namedNode(q.p);
    const object = q.oType === 'iri'
      ? N3.DataFactory.namedNode(q.oValue)
      : q.lang
        ? N3.DataFactory.literal(q.oValue, q.lang)
        : N3.DataFactory.literal(q.oValue, N3.DataFactory.namedNode(q.datatypeIri || `${NS.xsd}string`));
    store.addQuad(N3.DataFactory.quad(subject, predicate, object));
  }
  return store;
}

function iriQuad(target, s, p, o) { target.push({ s, p, oType: 'iri', oValue: o }); }
function literalQuad(target, s, p, value, datatypeIri, lang) { target.push({ s, p, oType: 'literal', oValue: String(value), ...(datatypeIri ? { datatypeIri } : {}), ...(lang ? { lang } : {}) }); }
function kindOf(value) { return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'object' ? 'object' : Number.isInteger(value) ? 'integer' : typeof value; }
function isScalar(value) { return value === null || (typeof value !== 'object'); }
function inferDatatype(examples, kinds) { return inferScalarDatatype(examples[0], kinds); }
function inferScalarDatatype(value, kinds = []) {
  const kind = value === undefined ? kinds.find((item) => item !== 'null') : kindOf(value);
  return kind === 'integer' ? `${NS.xsd}integer` : kind === 'number' ? `${NS.xsd}decimal` : kind === 'boolean' ? `${NS.xsd}boolean` : `${NS.xsd}string`;
}
function schemaTypes(node) {
  const declared = Array.isArray(node?.type) ? node.type : node?.type ? [node.type] : [];
  if (declared.length) return declared;
  if (node?.properties) return ['object'];
  if (node?.items) return ['array'];
  return ['string'];
}
function datatypeForSchemaTypes(types, format) {
  if (format === 'date') return `${NS.xsd}date`;
  if (format === 'date-time') return `${NS.xsd}dateTime`;
  const type = types.find((item) => item !== 'null');
  return type === 'integer' ? `${NS.xsd}integer` : type === 'number' ? `${NS.xsd}decimal` : type === 'boolean' ? `${NS.xsd}boolean` : `${NS.xsd}string`;
}
function jsonType(kind) { return kind === 'integer' ? 'integer' : kind === 'number' ? 'number' : ['string', 'boolean', 'object', 'array', 'null'].includes(kind) ? kind : null; }
function collapseTypes(types) { const unique = [...new Set(types.filter(Boolean))]; return unique.length === 1 ? unique[0] : unique; }
function directFields(fields, parentPath) {
  const prefix = parentPath ? `${parentPath}/` : '/';
  return fields.filter((field) => field.path.startsWith(prefix) && !field.path.slice(prefix.length).includes('/'));
}
function resolveGeneratedPredicateCollisions(fields, overrides, config) {
  const generated = fields.filter((field) => {
    const override = overrides[field.path] || {};
    return !override.predicateIri && !override.predicateLocalName && !isAbsoluteIri(field.key, { allowedSchemes: null });
  });
  const groups = new Map();
  for (const field of generated) {
    const items = groups.get(field.predicateIri) || [];
    items.push(field);
    groups.set(field.predicateIri, items);
  }
  const reserved = new Set(fields.filter((field) => !(groups.get(field.predicateIri)?.length > 1)).map((field) => field.predicateIri));
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => pathSegments(a.path).length - pathSegments(b.path).length || a.path.localeCompare(b.path));
    const shallowestDepth = pathSegments(ordered[0].path).length;
    const shallowest = ordered.filter((field) => pathSegments(field.path).length === shallowestDepth);
    const keeper = shallowest.length === 1 ? shallowest[0] : null;
    if (keeper) reserved.add(keeper.predicateIri);
    for (const field of ordered) {
      if (field === keeper) continue;
      const ancestors = pathSegments(field.path).slice(0, -1).reverse();
      let resolved = false;
      for (let count = 1; count <= ancestors.length; count += 1) {
        const context = ancestors.slice(0, count).reverse();
        const local = buildPredicateLocalName([...context, field.key].join(' '), {
          prefixHas: config.prefixHas,
          casing: config.casing,
          whenNoHeader: 'ordinal'
        });
        const iri = `${ensureBase(config.basePredicateIri)}${local}`;
        if (reserved.has(iri)) continue;
        field.predicateLocalName = local;
        field.predicateIri = iri;
        field.contextualized = true;
        reserved.add(iri);
        resolved = true;
        break;
      }
      if (resolved) continue;
      const baseLocal = field.predicateLocalName;
      let suffix = 2;
      let local = `${baseLocal}_${suffix}`;
      let iri = `${ensureBase(config.basePredicateIri)}${local}`;
      while (reserved.has(iri)) {
        suffix += 1;
        local = `${baseLocal}_${suffix}`;
        iri = `${ensureBase(config.basePredicateIri)}${local}`;
      }
      field.predicateLocalName = local;
      field.predicateIri = iri;
      field.contextualized = true;
      reserved.add(iri);
    }
  }
}
function pathSegments(path) {
  return String(path || '').split('/').filter((segment) => segment && segment !== '*').map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
}
function ensureBase(value) { const text = String(value || ''); return /[/#]$/.test(text) ? text : `${text}/`; }
function escapePointer(value) { return String(value).replaceAll('~', '~0').replaceAll('/', '~1'); }
function csv(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function localFileName(value) { return String(value || 'source.json').split(/[\\/]/).filter(Boolean).pop() || 'source.json'; }
function generatedOntologyTitle(filename) {
  const stem = localFileName(filename).replace(/\.[^.]+$/, '');
  const label = buildLabelFromWords(splitStringToWords(stem), { fallback: 'Generated RDFleece' });
  return /\bschema\b/i.test(label) ? label : `${label} Schema`;
}
function validIso(value) {
  const date = new Date(value || Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
}

