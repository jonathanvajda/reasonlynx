/**
 * @file Build RDF datasets from tabular data.
 */

import { COMMON_NAMESPACE_IRIS } from '../../../packages/namespace-registry/src/namespace-registry.js';

/**
 * @typedef {import('../state/types.js').FileOptions} FileOptions
 * @typedef {import('../tabular/parseTabular.js').TabularData} TabularData
 * @typedef {import('./schema.js').ColumnSchema} ColumnSchema
 */

/**
 * @typedef {Object} QuadRecord
 * @property {string} s
 * @property {string} p
 * @property {string} g
 * @property {'iri'|'literal'} oType
 * @property {string} oValue
 * @property {string} [datatypeIri]
 * @property {string} [lang]
 */

let _n3Mod = null;

/**
 * Builds an RDF dataset (N3.Store) and storable quads from tabular data.
 * @param {{
 *   tabular: TabularData,
 *   options: FileOptions,
 *   baseInstanceIri: string,
 *   predicateIris?: Record<string, string>,
 *   columnSchemas?: ColumnSchema[],
 *   graphIri: string,
 *   buildRowInstanceIri: (params: {baseInstanceIri: string, rowIndex: number}) => string,
 *   buildLiteralObject: (value: string, datatypeIri: string) => Promise<any>
 * }} params
 * @returns {Promise<{dataset: any, quads: QuadRecord[]}>}
 */
export async function buildDatasetFromTabular({
  tabular,
  options,
  baseInstanceIri,
  predicateIris,
  columnSchemas,
  graphIri,
  buildRowInstanceIri,
  buildLiteralObject
}) {
  const { DataFactory, Store } = N3;

  const store = new Store();
  const g = DataFactory.namedNode(graphIri);

  const schemaList = Array.isArray(columnSchemas) && columnSchemas.length > 0
    ? columnSchemas
    : Object.keys(predicateIris || {}).map((key, index) => ({
        key,
        index,
        predicateIri: predicateIris[key],
        datatypeIri: options.datatypesByColumnKey?.[key] || COMMON_NAMESPACE_IRIS.xsd.string
      }));

  // Determine data rows (if treatFirstRowAsHeader is false, we re-insert the header row as a data row).
  const dataRows = options.treatFirstRowAsHeader
    ? (tabular.rows || [])
    : [
        ...(Array.isArray(tabular.header) ? [tabular.header] : []),
        ...(tabular.rows || [])
      ];

  /** @type {QuadRecord[]} */
  const records = [];

  for (let r = 0; r < dataRows.length; r += 1) {
    const row = dataRows[r] || [];
    const subjectIri = buildRowInstanceIri({ baseInstanceIri, rowIndex: r });
    const s = DataFactory.namedNode(subjectIri);

    for (let c = 0; c < schemaList.length; c += 1) {
      const schema = schemaList[c];
      const key = schema.key;
      const pIri = schema.predicateIri;
      if (!pIri) continue;

      const cell = row[c];
      if (cell === undefined || cell === null || String(cell).trim() === '') continue;

      const datatype = schema.datatypeIri || options.datatypesByColumnKey?.[key] || COMMON_NAMESPACE_IRIS.xsd.string;
      const obj = await buildLiteralObject(String(cell), datatype);

      const p = DataFactory.namedNode(pIri);
      const q = DataFactory.quad(s, p, obj, g);
      store.addQuad(q);

      if (obj.termType === 'NamedNode') {
        records.push({ s: subjectIri, p: pIri, g: graphIri, oType: 'iri', oValue: obj.value });
      } else {
        records.push({
          s: subjectIri,
          p: pIri,
          g: graphIri,
          oType: 'literal',
          oValue: obj.value,
          datatypeIri: obj.datatype?.value,
          lang: obj.language || undefined
        });
      }
    }
  }

  return { dataset: store, quads: records };
}

/**
 * Rebuilds an N3.Store dataset from stored quads.
 * @param {QuadRecord[]} records
 * @returns {Promise<{dataset: any}>}
 */
export async function datasetFromQuads(records) {
  const { DataFactory, Store } = N3;

  const store = new Store();
  for (const rec of records || []) {
    const s = DataFactory.namedNode(rec.s);
    const p = DataFactory.namedNode(rec.p);
    const g = DataFactory.namedNode(rec.g);

    const o = rec.oType === 'iri'
      ? DataFactory.namedNode(rec.oValue)
      : DataFactory.literal(rec.oValue, DataFactory.namedNode(rec.datatypeIri || COMMON_NAMESPACE_IRIS.xsd.string));

    store.addQuad(DataFactory.quad(s, p, o, g));
  }

  return { dataset: store };
}
