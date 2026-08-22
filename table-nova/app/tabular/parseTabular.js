/**
 * @file Parse CSV/TSV text and XLSX ArrayBuffers into a common tabular shape.
 */

import { getSupportedMimeTypeForFilename } from '../../../packages/format-registry/src/mime-registry.js';

/**
 * @typedef {'csv'|'tsv'|'xlsx'|'unknown'} TabularKind
 */

/**
 * @typedef {Object} TabularData
 * @property {string[]|null} header    // first row (if present)
 * @property {string[][]} rows         // remaining rows
 */

/**
 * Detects tabular kind by filename extension.
 * @param {string} filename
 * @returns {TabularKind}
 */
export function detectTabularType(filename) {
  const detected = getSupportedMimeTypeForFilename(filename);
  if (detected?.ok && detected.value.category === 'tabular') {
    if (detected.value.mimeType === 'text/csv') return 'csv';
    if (detected.value.mimeType === 'text/tab-separated-values') return 'tsv';
    if (
      detected.value.mimeType === 'application/vnd.ms-excel' ||
      detected.value.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      return 'xlsx';
    }
  }

  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx';
  if (lower.endsWith('.tsv')) return 'tsv';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.txt')) return 'csv';
  return 'unknown';
}

/**
 * Parses an XLSX ArrayBuffer into TabularData (first sheet, first row as header candidate).
 * @param {ArrayBuffer} buf
 * @returns {Promise<TabularData>}
 */
export async function parseXlsxArrayBuffer(buf) {
  // XLSX is already resolved globally at module load; this stays async for API compatibility.
  const wb = XLSX.read(buf, { type: 'array' });

  const sheetName = wb.SheetNames?.[0];
  if (!sheetName) return { header: null, rows: [] };

  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

  const all = aoa.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '').trim()) : []));
  if (all.length === 0) return { header: null, rows: [] };

  const header = all[0];
  const rows = all.slice(1);
  return { header, rows };
}
