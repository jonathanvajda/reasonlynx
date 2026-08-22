// app/report-export.js
// @ts-check

import { getStandardDetailEntries } from './render-standards.js';
import { getCriterionDefinition } from './criteria.js';
import { getReportStandards } from './shared.js';
import { serializeDelimitedRows } from '../../packages/tabular-io/src/index.js';
import {
  escapeHtmlText,
  serializeReportValueToYaml
} from '../../packages/report-export/src/index.js';

/** @typedef {import('./types.js').EvaluatedReport} EvaluatedReport */
/** @typedef {import('./types.js').ExportState} ExportState */
/** @typedef {import('./types.js').OntologyMetadata} OntologyMetadata */
/** @typedef {import('./types.js').OntologyReport} OntologyReport */
/** @typedef {import('./types.js').PerResourceCurationRow} PerResourceCurationRow */
/** @typedef {import('./types.js').QueryResultRow} QueryResultRow */

/**
 * Serializes result rows as CSV.
 *
 * @param {QueryResultRow[] | null | undefined} results
 * @param {string} ontologyIri
 * @returns {string}
 */
export function buildResultsCsv(results, ontologyIri) {
  /** @type {Array<Array<unknown>>} */
  const rows = [[
    'ontologyIri',
    'resource',
    'queryId',
    'criterionId',
    'status',
    'severity',
    'scope'
  ]];

  for (const row of Array.isArray(results) ? results : []) {
    rows.push([
      ontologyIri || '',
      row.resource || '',
      row.queryId || '',
      row.criterionId || '',
      row.status || '',
      row.severity || '',
      row.scope || ''
    ]);
  }

  return serializeDelimitedRows(rows, { delimiter: ',', trailingNewline: true });
}

/**
 * Serializes an ontology report as YAML-like text.
 *
 * @param {OntologyReport | null | undefined} report
 * @returns {string}
 */
export function buildOntologyReportYaml(report) {
  if (!report) {
    return '# No ontology report\n';
  }

  return serializeReportValueToYaml({
    ontologyIri: report.ontologyIri,
    status: report.statusLabel,
    standards: getReportStandards(report).map((standard) => ({
      id: standard.id,
      type: standard.type,
      status: standard.status,
      failedResourcesCount: standard.failedResourcesCount || 0
    }))
  });
}

/**
 * Builds CSV for filtered per-resource rows.
 *
 * @param {PerResourceCurationRow[] | null | undefined} perResourceRows
 * @returns {string}
 */
export function buildFilteredResourcesCsv(perResourceRows) {
  /** @type {Array<Array<unknown>>} */
  const rows = [[
    'resource',
    'currentStatusIri',
    'currentStatusLabel',
    'statusIri',
    'statusLabel',
    'failedRequirementsCount',
    'failedRecommendationsCount',
    'failedRequirements',
    'failedRecommendations'
  ]];

  for (const row of Array.isArray(perResourceRows) ? perResourceRows : []) {
    const failedRequirements = Array.isArray(row.failedRequirements) ? row.failedRequirements : [];
    const failedRecommendations = Array.isArray(row.failedRecommendations)
      ? row.failedRecommendations
      : [];

    rows.push([
      row.resource || '',
      row.currentStatusIri || '',
      row.currentStatusLabel || '',
      row.statusIri || '',
      row.statusLabel || '',
      String(failedRequirements.length),
      String(failedRecommendations.length),
      failedRequirements.join(' | '),
      failedRecommendations.join(' | ')
    ]);
  }

  return serializeDelimitedRows(rows, { delimiter: ',', trailingNewline: true });
}

/**
 * Builds CSV for one selected standard detail.
 *
 * @param {string | null | undefined} criterionId
 * @param {QueryResultRow[] | null | undefined} results
 * @returns {string}
 */
export function buildStandardDetailCsv(criterionId, results) {
  const selectedCriterionId = criterionId || '';

  if (!selectedCriterionId) {
    throw new Error('No standard selected.');
  }

  const entries = getStandardDetailEntries(selectedCriterionId, results);

  /** @type {Array<Array<unknown>>} */
  const rows = [['criterionId', 'resource', 'queryIds']];

  for (const entry of entries) {
    rows.push([
      selectedCriterionId,
      entry.resource,
      entry.queryIds.join(' | ')
    ]);
  }

  return serializeDelimitedRows(rows, { delimiter: ',', trailingNewline: true });
}

/**
 * Builds CSV summary for batch results.
 *
 * @param {EvaluatedReport[] | null | undefined} batchReports
 * @returns {string}
 */
export function buildBatchSummaryCsv(batchReports) {
  const batch = Array.isArray(batchReports) ? batchReports : [];

  if (!batch.length) {
    throw new Error('No batch results available.');
  }

  /** @type {Array<Array<unknown>>} */
  const rows = [[
    'fileName',
    'ontologyIri',
    'statusIri',
    'statusLabel',
    'failedRequirements',
    'failedRecommendations',
    'totalRequirements',
    'totalRecommendations'
  ]];

  for (const item of batch) {
    const report = item.ontologyReport;
    const standards = getReportStandards(report);

    const failedRequirements = standards.filter(
      (standard) => standard.type === 'requirement' && standard.status === 'fail'
    ).length;

    const failedRecommendations = standards.filter(
      (standard) => standard.type === 'recommendation' && standard.status === 'fail'
    ).length;

    const totalRequirements = standards.filter(
      (standard) => standard.type === 'requirement'
    ).length;

    const totalRecommendations = standards.filter(
      (standard) => standard.type === 'recommendation'
    ).length;

    rows.push([
      item.fileName || '',
      report?.ontologyIri || '',
      report?.statusIri || '',
      report?.statusLabel || '',
      String(failedRequirements),
      String(failedRecommendations),
      String(totalRequirements),
      String(totalRecommendations)
    ]);
  }

  return serializeDelimitedRows(rows, { delimiter: ',', trailingNewline: true });
}

/**
 * Builds an HTML report for the current view.
 *
 * @param {ExportState} state
 * @returns {string}
 */
export function buildHtmlReport(state) {
  const createdAt = new Date().toISOString();
  const metadata = state.ontologyMetadata || null;
  const manifest = state.manifest || null;
  const inspectionScope = state.inspectionScope || null;
  const report = state.ontologyReport || null;
  const perResourceRows = Array.isArray(state.perResourceRows) ? state.perResourceRows : [];
  const results = Array.isArray(state.results) ? state.results : [];
  const resultsCount = results.length;
  const selectedCriterionId = state.selectedCriterionId || '';
  const standardDetailEntries = getStandardDetailEntries(selectedCriterionId, results);

  const css = `
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; }
    h1,h2,h3 { margin: 0.2rem 0 0.6rem; }
    .meta { color: #333; margin: 0.25rem 0; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 14px; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #fafafa; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; border: 1px solid #ddd; font-size: 0.9em; }
    @media print { body { margin: 12mm; } .card { break-inside: avoid; } }
  `;

  let html = '';
  html += '<!doctype html><html><head><meta charset="utf-8" />';
  html += '<meta name="viewport" content="width=device-width, initial-scale=1" />';
  html += '<title>Ontology Checks Report</title>';
  html += `<style>${css}</style>`;
  html += '</head><body>';

  html += '<h1>Ontology Checks Report</h1>';
  html += `<div class="meta">Created: <span class="mono">${escapeHtmlText(createdAt)}</span></div>`;
  html += `<div class="meta">Results rows: <span class="mono">${escapeHtmlText(resultsCount)}</span></div>`;

  html += '<div class="card">';
  html += '<h2>View state</h2>';
  html += `<div class="meta">Curation status filter: <span class="mono">${escapeHtmlText(state.statusFilter || 'All')}</span></div>`;
  html += `<div class="meta">Fails standard filter: <span class="mono">${escapeHtmlText(state.standardFilter || 'Any')}</span></div>`;
  html += `<div class="meta">Selected standard: <span class="mono">${escapeHtmlText(selectedCriterionId || '(none)')}</span></div>`;
  html += `<div class="meta">Included namespaces: <span class="mono">${escapeHtmlText((inspectionScope?.includedNamespaces || []).join(', ') || 'All')}</span></div>`;
  html += '</div>';

  html += '<div class="card"><h2>Ontology metadata</h2>';
  if (!metadata) {
    html += '<p>No ontology metadata loaded.</p>';
  } else {
    html += `<div class="meta">File: <span class="mono">${escapeHtmlText(metadata.fileName || '')}</span></div>`;
    html += `<div class="meta">Ontology IRI: <span class="mono">${escapeHtmlText(metadata.ontologyIri || '')}</span></div>`;
    html += `<div class="meta">Title: ${escapeHtmlText(metadata.title || 'Not found')}</div>`;
    html += `<div class="meta">Version IRI: <span class="mono">${escapeHtmlText(metadata.versionIri || 'Not found')}</span></div>`;
    html += `<div class="meta">Version info: <span class="mono">${escapeHtmlText(metadata.versionInfo || 'Not found')}</span></div>`;
    html += `<div class="meta">License: <span class="mono">${escapeHtmlText(metadata.license || 'Not found')}</span></div>`;
    html += `<div class="meta">Access rights: <span class="mono">${escapeHtmlText(metadata.accessRights || 'Not found')}</span></div>`;
    html += `<div class="meta">Imports: <span class="mono">${escapeHtmlText((metadata.imports || []).join(', ') || 'None found')}</span></div>`;
    html += `<div class="meta">Triple count: <span class="mono">${escapeHtmlText(metadata.tripleCount || 0)}</span></div>`;
    html += `<div class="meta">Labeled resources: <span class="mono">${escapeHtmlText(metadata.labeledResourceCount || 0)}</span></div>`;
  }
  html += '</div>';

  html += '<div class="card"><h2>Ontology standards</h2>';
  if (!report) {
    html += '<p>No ontology report loaded.</p>';
  } else {
    html += `<div class="meta">Overall status: <span class="pill">${escapeHtmlText(report.statusLabel || '')}</span></div>`;

    html += '<h3>Ontology-level checks</h3>';
    html += '<table><thead><tr><th>criterion</th><th>type</th><th>status</th><th>failedResourcesCount</th></tr></thead><tbody>';

    for (const standard of report.ontologyStandards || []) {
      const criterion = getCriterionDefinition(manifest, standard.id);
      html += '<tr>';
      html += '<td>';
      html += `<div>${escapeHtmlText(criterion?.label || standard.id)}</div>`;
      html += `<div class="mono">${escapeHtmlText(standard.id)}</div>`;
      if (criterion?.guidance) {
        html += `<div>${escapeHtmlText(criterion.guidance)}</div>`;
      }
      html += '</td>';
      html += '<td>';
      html += `${escapeHtmlText(standard.type)}`;
      if (criterion?.remediationEffort) {
        html += `<div>${escapeHtmlText(criterion.remediationEffort)}</div>`;
      }
      html += '</td>';
      html += `<td>${escapeHtmlText(standard.status)}</td>`;
      html += `<td class="mono">${escapeHtmlText(standard.failedResourcesCount ?? '')}</td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';

    html += '<h3>Ontology contents checks</h3>';
    html += '<table><thead><tr><th>criterion</th><th>type</th><th>status</th><th>failedResourcesCount</th></tr></thead><tbody>';

    for (const standard of report.contentStandards || []) {
      const criterion = getCriterionDefinition(manifest, standard.id);
      html += '<tr>';
      html += '<td>';
      html += `<div>${escapeHtmlText(criterion?.label || standard.id)}</div>`;
      html += `<div class="mono">${escapeHtmlText(standard.id)}</div>`;
      if (criterion?.guidance) {
        html += `<div>${escapeHtmlText(criterion.guidance)}</div>`;
      }
      html += '</td>';
      html += '<td>';
      html += `${escapeHtmlText(standard.type)}`;
      if (criterion?.remediationEffort) {
        html += `<div>${escapeHtmlText(criterion.remediationEffort)}</div>`;
      }
      html += '</td>';
      html += `<td>${escapeHtmlText(standard.status)}</td>`;
      html += `<td class="mono">${escapeHtmlText(standard.failedResourcesCount ?? '')}</td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
  }
  html += '</div>';

  if (selectedCriterionId) {
    const criterion = getCriterionDefinition(manifest, selectedCriterionId);
    html += '<div class="card"><h2>Standard detail</h2>';
    if (criterion) {
      html += `<div class="meta">Label: ${escapeHtmlText(criterion.label)}</div>`;
      html += `<div class="meta">Criterion ID: <span class="mono">${escapeHtmlText(criterion.id)}</span></div>`;
      html += `<div class="meta">Remediation effort: ${escapeHtmlText(criterion.remediationEffort)}</div>`;
      if (criterion.guidance) {
        html += `<div class="meta">Brief guidance: ${escapeHtmlText(criterion.guidance)}</div>`;
      }
    }

    if (!standardDetailEntries.length) {
      html += '<p>No failing resources found for selected standard.</p>';
    } else {
      html += '<table><thead><tr><th>Resource IRI</th><th>Failing query IDs</th></tr></thead><tbody>';

      for (const entry of standardDetailEntries) {
        html += '<tr>';
        html += `<td class="mono">${escapeHtmlText(entry.resource)}</td>`;
        html += `<td class="mono">${escapeHtmlText(entry.queryIds.join(', '))}</td>`;
        html += '</tr>';
      }

      html += '</tbody></table>';
    }

    html += '</div>';
  }

  html += '<div class="card"><h2>Per-resource curation (filtered)</h2>';
  html += `<div class="meta">Rows: <span class="mono">${escapeHtmlText(perResourceRows.length)}</span></div>`;

  if (!perResourceRows.length) {
    html += '<p>No resources in current view.</p>';
  } else {
    html += '<table><thead><tr><th>resource</th><th>currentStatus</th><th>suggestedStatus</th><th>failedRequirements</th><th>failedRecommendations</th></tr></thead><tbody>';

    for (const row of perResourceRows) {
      const failedRequirements = Array.isArray(row.failedRequirements) ? row.failedRequirements : [];
      const failedRecommendations = Array.isArray(row.failedRecommendations)
        ? row.failedRecommendations
        : [];

      html += '<tr>';
      html += `<td class="mono">${escapeHtmlText(row.resource || '')}</td>`;
      html += `<td>${escapeHtmlText(row.currentStatusLabel || 'Not asserted')}</td>`;
      html += `<td>${escapeHtmlText(row.statusLabel || '')}</td>`;
      html += `<td class="mono">${escapeHtmlText(failedRequirements.join(', '))}</td>`;
      html += `<td class="mono">${escapeHtmlText(failedRecommendations.join(', '))}</td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
  }

  html += '</div>';
  html += '</body></html>';

  return html;
}
