// app/measures-export.js
// @ts-check

import {
  serializeReportDocumentToHtml,
  serializeReportValueToYaml
} from '../../packages/report-export/src/index.js';
import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/namespace-registry.js';

import { serializeDelimitedRecords } from '../../packages/tabular-io/src/index.js';

/** @typedef {import('./types.js').ExternalIriDependency} ExternalIriDependency */
/** @typedef {import('./measures-model.js').MeasureMetric} MeasureMetric */
/** @typedef {'iri' | 'curated_in'} DependencySortMode */
/** @typedef {'rdfxml' | 'ttl' | 'ntriples' | 'jsonld'} ImportSnippetFormat */
/**
 * @typedef {Object} ExportableMeasuresAnalysis
 * @property {string} fileName
 * @property {string} ontologyIri
 * @property {MeasureMetric[]} metrics
 */

/**
 * Escapes one seed-file field while preserving the line format.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
function escapeSeedField(value) {
  return String(value || '').replace(/\r?\n/g, ' ').replace(/\s+#\s+/g, ' # ').trim();
}

/**
 * Returns external dependencies in one stable order.
 *
 * @param {ExternalIriDependency[] | null | undefined} dependencies
 * @param {DependencySortMode} [sortBy='iri']
 * @returns {ExternalIriDependency[]}
 */
export function sortExternalDependencies(dependencies, sortBy = 'iri') {
  const rows = Array.isArray(dependencies) ? [...dependencies] : [];
  return rows.sort((left, right) => {
    if (sortBy === 'curated_in') {
      const curatedCompare = String(left?.curatedIn || '').localeCompare(String(right?.curatedIn || ''));
      if (curatedCompare !== 0) {
        return curatedCompare;
      }
    }
    return String(left?.iri || '').localeCompare(String(right?.iri || ''));
  });
}

/**
 * Derives curated-in ontology import candidates from dependency rows.
 *
 * @param {ExternalIriDependency[] | null | undefined} dependencies
 * @param {string[] | null | undefined} declaredImports
 * @returns {{ allCandidates: string[], missingCandidates: string[] }}
 */
export function deriveImportCandidates(dependencies, declaredImports) {
  const allCandidates = Array.from(
    new Set(
      (Array.isArray(dependencies) ? dependencies : [])
        .map((dependency) => String(dependency?.curatedIn || ''))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));

  const declared = new Set(
    Array.isArray(declaredImports)
      ? declaredImports.filter(Boolean).map((value) => String(value))
      : []
  );

  return {
    allCandidates,
    missingCandidates: allCandidates.filter((iri) => !declared.has(iri))
  };
}

/**
 * Serializes ontology-slim seed dependencies as:
 * {iri} # {label} # # {curated in}
 *
 * @param {ExternalIriDependency[] | null | undefined} dependencies
 * @param {DependencySortMode} [sortBy='iri']
 * @returns {string}
 */
export function buildExternalDependenciesSeedText(dependencies, sortBy = 'iri') {
  const rows = sortExternalDependencies(dependencies, sortBy);
  return rows
    .map((dependency) =>
      `${escapeSeedField(dependency?.iri)} # ${escapeSeedField(dependency?.label)} # # ${escapeSeedField(dependency?.curatedIn)}`
    )
    .join('\n') + (rows.length ? '\n' : '');
}

/**
 * Builds an owl:imports snippet for one or more ontology IRIs.
 *
 * @param {string | null | undefined} ontologyIri
 * @param {string[] | null | undefined} importIris
 * @param {ImportSnippetFormat} [format='ttl']
 * @returns {string}
 */
export function buildImportSnippetText(ontologyIri, importIris, format = 'ttl') {
  const subjectIri = String(ontologyIri || '').trim() || 'urn:ontology:unknown';
  const rows = Array.isArray(importIris)
    ? Array.from(new Set(importIris.filter(Boolean).map((value) => String(value))))
    : [];

  switch (format) {
    case 'rdfxml':
      if (rows.length === 1) {
        return `<owl:imports rdf:resource="${rows[0]}"/>`;
      }
      return rows.map((iri) => `<owl:imports rdf:resource="${iri}"/>`).join('\n');
    case 'ntriples':
      return rows.map((iri) => `<${subjectIri}> <${COMMON_NAMESPACE_IRIS.owl.imports}> <${iri}> .`).join('\n');
    case 'jsonld':
      return `${JSON.stringify({
        '@id': subjectIri,
        [COMMON_NAMESPACE_IRIS.owl.imports]: rows.map((iri) => ({ '@id': iri }))
      }, null, 2)}\n`;
    case 'ttl':
    default:
      if (!rows.length) {
        return '';
      }
      if (rows.length === 1) {
        return `owl:imports <${rows[0]}> .`;
      }
      return `owl:imports\n${rows.map((iri) => `  <${iri}>`).join(',\n')} .`;
  }
}

/**
 * Converts one metric value to a stable string.
 *
 * @param {MeasureMetric['metricValue']} value
 * @returns {string}
 */
function metricValueToString(value) {
  if (Array.isArray(value)) {
    return value.join(' | ');
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

/**
 * Serializes measure rows to CSV or TSV.
 *
 * @param {MeasureMetric[] | null | undefined} metrics
 * @param {',' | '\t'} delimiter
 * @returns {string}
 */
function buildDelimitedMetrics(metrics, delimiter) {
  const records = (Array.isArray(metrics) ? metrics : []).map((metric) => ({
    metric: metric?.metric || '',
    metric_value: metricValueToString(metric?.metricValue),
    metric_type: metric?.metricType || '',
    explanation: metric?.explanation || ''
  }));

  return serializeDelimitedRecords(records, {
    headers: ['metric', 'metric_value', 'metric_type', 'explanation'],
    delimiter,
    trailingNewline: true
  });
}

/**
 * Builds CSV text for ontology measures.
 *
 * @param {MeasureMetric[] | null | undefined} metrics
 * @returns {string}
 */
export function buildMeasuresCsv(metrics) {
  return buildDelimitedMetrics(metrics, ',');
}

/**
 * Builds TSV text for ontology measures.
 *
 * @param {MeasureMetric[] | null | undefined} metrics
 * @returns {string}
 */
export function buildMeasuresTsv(metrics) {
  return buildDelimitedMetrics(metrics, '\t');
}

/**
 * Builds JSON text for ontology measures.
 *
 * @param {MeasureMetric[] | null | undefined} metrics
 * @returns {string}
 */
export function buildMeasuresJson(metrics) {
  return `${JSON.stringify(Array.isArray(metrics) ? metrics : [], null, 2)}\n`;
}

/**
 * Builds YAML-like text for ontology measures.
 *
 * @param {MeasureMetric[] | null | undefined} metrics
 * @returns {string}
 */
export function buildMeasuresYaml(metrics) {
  const rows = Array.isArray(metrics) ? metrics : [];
  return serializeReportValueToYaml({
    metrics: rows.map((metric) => ({
      metric: metric?.metric || '',
      metric_type: metric?.metricType || '',
      metric_value: metric?.metricValue ?? '',
      explanation: metric?.explanation || ''
    }))
  });
}

/**
 * Builds a lightweight HTML report for ontology measures.
 *
 * @param {string} title
 * @param {MeasureMetric[] | null | undefined} metrics
 * @returns {string}
 */
export function buildMeasuresHtml(title, metrics) {
  const rows = Array.isArray(metrics) ? metrics : [];
  return serializeReportDocumentToHtml({
    title,
    tables: [{
      headers: ['Metric', 'Value', 'Type', 'Explanation'],
      rows: rows.map((metric) => [
        metric?.metric || '',
        metricValueToString(metric?.metricValue || ''),
        metric?.metricType || '',
        metric?.explanation || ''
      ])
    }]
  });
}

/**
 * Builds CSV text for many ontology analyses.
 *
 * @param {ExportableMeasuresAnalysis[] | null | undefined} analyses
 * @returns {string}
 */
export function buildAllMeasuresCsv(analyses) {
  return buildDelimitedAllMeasures(analyses, ',');
}

/**
 * Builds TSV text for many ontology analyses.
 *
 * @param {ExportableMeasuresAnalysis[] | null | undefined} analyses
 * @returns {string}
 */
export function buildAllMeasuresTsv(analyses) {
  return buildDelimitedAllMeasures(analyses, '\t');
}

/**
 * Serializes many ontology analyses to CSV or TSV.
 *
 * @param {ExportableMeasuresAnalysis[] | null | undefined} analyses
 * @param {',' | '\t'} delimiter
 * @returns {string}
 */
function buildDelimitedAllMeasures(analyses, delimiter) {
  const records = [];

  for (const analysis of Array.isArray(analyses) ? analyses : []) {
    for (const metric of Array.isArray(analysis?.metrics) ? analysis.metrics : []) {
      records.push({
        fileName: analysis?.fileName || '',
        ontologyIri: analysis?.ontologyIri || '',
        metric: metric?.metric || '',
        metric_value: metricValueToString(metric?.metricValue),
        metric_type: metric?.metricType || '',
        explanation: metric?.explanation || ''
      });
    }
  }

  return serializeDelimitedRecords(records, {
    headers: ['fileName', 'ontologyIri', 'metric', 'metric_value', 'metric_type', 'explanation'],
    delimiter,
    trailingNewline: true
  });
}

/**
 * Builds JSON text for many ontology analyses.
 *
 * @param {ExportableMeasuresAnalysis[] | null | undefined} analyses
 * @returns {string}
 */
export function buildAllMeasuresJson(analyses) {
  return `${JSON.stringify(Array.isArray(analyses) ? analyses : [], null, 2)}\n`;
}

/**
 * Builds YAML-like text for many ontology analyses.
 *
 * @param {ExportableMeasuresAnalysis[] | null | undefined} analyses
 * @returns {string}
 */
export function buildAllMeasuresYaml(analyses) {
  const rows = Array.isArray(analyses) ? analyses : [];
  return serializeReportValueToYaml({
    analyses: rows.map((analysis) => ({
      fileName: analysis?.fileName || '',
      ontologyIri: analysis?.ontologyIri || '',
      metrics: (Array.isArray(analysis?.metrics) ? analysis.metrics : []).map((metric) => ({
        metric: metric?.metric || '',
        metric_type: metric?.metricType || '',
        metric_value: metric?.metricValue ?? '',
        explanation: metric?.explanation || ''
      }))
    }))
  });
}

/**
 * Builds an HTML report for many ontology analyses.
 *
 * @param {string} title
 * @param {ExportableMeasuresAnalysis[] | null | undefined} analyses
 * @returns {string}
 */
export function buildAllMeasuresHtml(title, analyses) {
  const rows = Array.isArray(analyses) ? analyses : [];
  return serializeReportDocumentToHtml({
    title,
    sections: rows.map((analysis) => ({
      title: analysis?.fileName || 'Ontology analysis',
      metadata: [['Ontology IRI', analysis?.ontologyIri || '']],
      tables: [{
        headers: ['Metric', 'Value', 'Type', 'Explanation'],
        rows: (Array.isArray(analysis?.metrics) ? analysis.metrics : []).map((metric) => [
          metric?.metric || '',
          metricValueToString(metric?.metricValue || ''),
          metric?.metricType || '',
          metric?.explanation || ''
        ])
      }]
    }))
  });
}
