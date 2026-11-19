import { readFileAsText, downloadTextFile } from '../../packages/browser-file-io/src/index.js';
import { datasetToSerializations } from '../../table-nova/app/rdf/serialize.js';
import { buildRdfleeceRun, finalizeSchemaModel, inferJsonSchemaModel, modelFromJsonSchema, NS, quadRecordsToN3 } from './core.js';

const $ = (id) => document.getElementById(id);
const dom = {
  dropzone: $('RDFleeceDropzone'), file: $('RDFleeceFile'), filename: $('RDFleeceFilename'),
  schemaFile: $('RDFleeceSchemaFile'), schemaFilename: $('RDFleeceSchemaFilename'),
  preview: $('RDFleecePreview'), schema: $('RDFleeceSchema'), run: $('RDFleeceRun'),
  baseInstance: $('RDFleeceBaseInstance'), basePredicate: $('RDFleeceBasePredicate'),
  prefixHas: $('RDFleecePrefixHas'), casing: $('RDFleeceCasing'), preserveNulls: $('RDFleecePreserveNulls'),
  scopeInputs: document.querySelectorAll('input[name="RDFleeceOutputScope"]'),
  formatTabs: document.querySelectorAll('[data-rdfleece-format]'), output: $('RDFleeceOutput'),
  status: $('RDFleeceStatus'), download: $('RDFleeceDownload'), downloadAlternate: $('RDFleeceDownloadAlternate'), exportDictionary: $('RDFleeceDictionary'),
  exportSchema: $('RDFleeceJsonSchema')
};

let source = null;
let sourceFilename = 'source.json';
let inferred = null;
let run = null;
let serializations = null;

customizeSiteHeader();

dom.file.addEventListener('change', () => stage(dom.file.files?.[0]));
dom.schemaFile.addEventListener('change', () => stageSchema(dom.schemaFile.files?.[0]));
dom.dropzone.addEventListener('dragover', (event) => { event.preventDefault(); dom.dropzone.classList.add('is-dragging'); });
dom.dropzone.addEventListener('dragleave', () => dom.dropzone.classList.remove('is-dragging'));
dom.dropzone.addEventListener('drop', (event) => { event.preventDefault(); dom.dropzone.classList.remove('is-dragging'); stage(event.dataTransfer?.files?.[0]); });
dom.run.addEventListener('click', generate);
dom.casing.addEventListener('change', refreshGeneratedPredicateNames);
dom.prefixHas.addEventListener('change', refreshGeneratedPredicateNames);
dom.scopeInputs.forEach((input) => input.addEventListener('change', renderSelectedOutput));
dom.formatTabs.forEach((tab) => tab.addEventListener('click', () => selectFormatTab(tab)));
dom.download.addEventListener('click', () => downloadOutput(false));
dom.downloadAlternate.addEventListener('click', () => downloadOutput(true));
dom.exportDictionary.addEventListener('click', () => run && downloadTextFile('rdfleece-data-dictionary.csv', run.dataDictionaryCsv, 'text/csv;charset=utf-8'));
dom.exportSchema.addEventListener('click', () => run && downloadTextFile('rdfleece-schema.json', JSON.stringify(run.jsonSchema, null, 2), 'application/schema+json;charset=utf-8'));

async function stage(file) {
  if (!file) return;
  try {
    source = JSON.parse(await readFileAsText(file));
    sourceFilename = file.name;
    dom.filename.textContent = `${file.name} · ${file.size.toLocaleString()} bytes`;
    dom.preview.textContent = JSON.stringify(source, null, 2).slice(0, 30000);
    inferred = inferJsonSchemaModel(source, settings());
    renderSchema(inferred);
    dom.run.disabled = false;
    setStatus(`Parsed ${file.name}. Review ${inferred.fields.length} schema paths.`, 'ok');
  } catch (error) {
    source = null; inferred = null; dom.run.disabled = true;
    setStatus(`Could not parse JSON: ${error.message}`, 'error');
  }
}

async function stageSchema(file) {
  if (!file) return;
  try {
    const document = JSON.parse(await readFileAsText(file));
    if (!source) sourceFilename = file.name;
    inferred = modelFromJsonSchema(document, settings());
    source ??= inferred.rootKind === 'array' ? [] : inferred.rootKind === 'object' ? {} : null;
    dom.schemaFilename.textContent = `${file.name} · ${inferred.fields.length} declared paths`;
    renderSchema(inferred);
    dom.run.disabled = false;
    setStatus(`Loaded JSON Schema ${file.name}. Supplied constraints take precedence in review.`, 'ok');
  } catch (error) { setStatus(`Could not parse JSON Schema: ${error.message}`, 'error'); }
}

function settings() {
  return {
    baseInstanceIri: dom.baseInstance.value.trim(), basePredicateIri: dom.basePredicate.value.trim(),
    baseGraphIri: `${dom.basePredicate.value.trim().replace(/[/#]?$/, '/')}run/`,
    prefixHas: dom.prefixHas.checked, casing: dom.casing.value, preserveNulls: dom.preserveNulls.checked
  };
}

function renderSchema(model) {
  const displayModel = finalizeSchemaModel(model, {}, settings());
  dom.schema.replaceChildren();
  if (!displayModel.fields.length) { dom.schema.textContent = 'The root has no keyed fields.'; return; }
  const table = document.createElement('table');
  table.className = 'table-nova-table';
  table.innerHTML = '<thead><tr><th>JSON path</th><th>Observed</th><th>Predicate local name</th><th>Datatype</th><th>Required</th><th>Value mode</th></tr></thead>';
  const body = document.createElement('tbody');
  displayModel.fields.forEach((field) => {
    const tr = document.createElement('tr');
    tr.dataset.path = field.path;
    tr.dataset.generatedPredicateLocalName = field.predicateLocalName;
    tr.innerHTML = `<td><code></code></td><td></td><td><input class="table-nova-input" data-field="predicateLocalName"></td><td><select class="table-nova-select" data-field="datatypeIri"><option value="${NS.xsd}string">string</option><option value="${NS.xsd}integer">integer</option><option value="${NS.xsd}decimal">decimal</option><option value="${NS.xsd}boolean">boolean</option><option value="${NS.xsd}date">date</option><option value="${NS.xsd}dateTime">dateTime</option></select></td><td><input type="checkbox" data-field="required"></td><td><select class="table-nova-select" data-field="valueMode"><option value="auto">auto</option><option value="literal">literal</option><option value="iri">IRI</option></select></td>`;
    tr.querySelector('code').textContent = field.path;
    tr.children[1].textContent = [...field.kinds].join(', ') + (field.itemKinds.length ? ` [${field.itemKinds.join(', ')}]` : '');
    tr.querySelector('[data-field="predicateLocalName"]').value = field.predicateLocalName;
    tr.querySelector('[data-field="datatypeIri"]').value = field.datatypeIri;
    tr.querySelector('[data-field="required"]').checked = field.required;
    tr.querySelector('[data-field="valueMode"]').value = field.valueMode;
    body.appendChild(tr);
  });
  table.appendChild(body); dom.schema.appendChild(table);
}

async function generate() {
  try {
    const overrides = {};
    dom.schema.querySelectorAll('tbody tr').forEach((tr) => {
      const values = Object.fromEntries([...tr.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.type === 'checkbox' ? input.checked : input.value]));
      if (values.predicateLocalName === tr.dataset.generatedPredicateLocalName) delete values.predicateLocalName;
      overrides[tr.dataset.path] = values;
    });
    const runtimeSettings = { ...settings(), sourceFilename, createdAtIso: new Date().toISOString() };
    const schema = finalizeSchemaModel(inferred, overrides, runtimeSettings);
    run = buildRdfleeceRun(source, schema, runtimeSettings);
    const N3 = globalThis.N3;
    serializations = {};
    for (const [scope, records] of Object.entries({ abox: run.abox, tbox: run.tbox, combined: run.combined })) {
      serializations[scope] = await datasetToSerializations({ dataset: quadRecordsToN3(records, N3), graphIri: run.graphIri, prefixes: { rdfleece: NS.rdfleece, rdf: NS.rdf, rdfs: NS.rdfs, owl: NS.owl, xsd: NS.xsd, dcterms: NS.dcterms, okea: NS.okea } });
    }
    renderSelectedOutput();
    [dom.download, dom.downloadAlternate, dom.exportDictionary, dom.exportSchema].forEach((button) => { button.disabled = false; });
    updateOutputActions();
    setStatus(`Generated ${run.abox.length} ABox and ${run.tbox.length} TBox statements.`, 'ok');
  } catch (error) { setStatus(`Generation failed: ${error.message}`, 'error'); }
}

function renderSelectedOutput() {
  const format = getOutputFormat();
  updateOutputActions();
  if (!run) return;
  const scope = getOutputScope();
  if (format === 'shacl') dom.output.value = run.shacl;
  else dom.output.value = serializations[scope]?.[format === 'jsonld' ? 'jsonldTriples' : format] || '';
}

function downloadOutput(alternate) {
  if (!run) return;
  const format = getOutputFormat();
  const scope = getOutputScope();
  const variants = {
    turtle: alternate ? ['trig', 'trig'] : ['turtle', 'ttl'],
    ntriples: alternate ? ['nquads', 'nq'] : ['ntriples', 'nt'],
    jsonld: alternate ? ['jsonldGraph', 'jsonld'] : ['jsonldTriples', 'jsonld'],
    shacl: ['shacl', 'ttl']
  };
  const [key, extension] = variants[format];
  const text = key === 'shacl' ? run.shacl : serializations[scope]?.[key] || '';
  downloadTextFile(`rdfleece-${key === 'shacl' ? 'shapes' : scope}.${extension}`, text, key.startsWith('jsonld') ? 'application/ld+json;charset=utf-8' : 'text/plain;charset=utf-8');
}

function selectFormatTab(selected) {
  dom.formatTabs.forEach((tab) => tab.classList.toggle('table-nova-tab--active', tab === selected));
  renderSelectedOutput();
}

function getOutputFormat() {
  return document.querySelector('[data-rdfleece-format].table-nova-tab--active')?.dataset.rdfleeceFormat || 'turtle';
}

function getOutputScope() {
  return [...dom.scopeInputs].find((input) => input.checked)?.value || 'abox';
}

function updateOutputActions() {
  const format = getOutputFormat();
  const labels = {
    turtle: ['Export Turtle', 'Export TriG'],
    ntriples: ['Export N-Triples', 'Export N-Quads'],
    jsonld: ['Export JSON-LD triples', 'Export JSON-LD dataset'],
    shacl: ['Export SHACL', '']
  };
  dom.download.textContent = labels[format][0];
  dom.downloadAlternate.textContent = labels[format][1];
  dom.downloadAlternate.hidden = format === 'shacl';
}

function setStatus(message, kind) { dom.status.textContent = message; dom.status.dataset.kind = kind; }

function refreshGeneratedPredicateNames() {
  if (!inferred) return;
  const generatedModel = finalizeSchemaModel(inferred, {}, settings());
  const fieldsByPath = new Map(generatedModel.fields.map((field) => [field.path, field]));
  dom.schema.querySelectorAll('tbody tr').forEach((tr) => {
    const input = tr.querySelector('[data-field="predicateLocalName"]');
    const generatedField = fieldsByPath.get(tr.dataset.path);
    if (!input || !generatedField || input.value !== tr.dataset.generatedPredicateLocalName) return;
    const generated = generatedField.predicateLocalName;
    input.value = generated;
    tr.dataset.generatedPredicateLocalName = generated;
  });
}

function customizeSiteHeader() {
  const mount = document.getElementById('siteHeader');
  if (!mount) return;
  const apply = () => {
    const title = mount.querySelector('.sitehdr-tool__title');
    const image = mount.querySelector('.sitehdr-tool__img');
    if (title) title.textContent = 'RDFleece';
    if (image) { image.src = '../images/default-logo.png'; image.alt = 'RDFleece JSON to RDF'; }
    return Boolean(title);
  };
  if (apply()) return;
  const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
  observer.observe(mount, { childList: true, subtree: true });
}

