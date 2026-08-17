/**
 * docs/app/search.js
 * Pure search + scoring + filtering. No DOM, no IndexedDB.
 *
 * Relevance model (initial, tunable):
 * Exact matches:
 *  - iri == token: +120
 *  - label == token: +100
 *  - altLabel == token: +70
 *
 * Contains / wildcard:
 *  - label contains token: +40
 *  - iri contains token: +25
 *  - altLabel contains token: +20
 *  - definition contains token (if enabled): +10
 *  - citations/examples/clarifications contains token (if enabled): +5
 *
 * Tie-breakers:
 *  1) higher score
 *  2) more distinct tokens matched
 *  3) prefer label hits over definition-only hits
 *  4) shorter label
 *  5) alphabetical label
 */

import { normalizeQuery, normalizeText } from './normalize.js';
import { docMatchesNamespaceFilter, normalizeNamespaceFilters } from './namespaces.js';

function fieldValuesToText(values) {
  return (values || []).map((v) => {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') return v.value || v.iri || '';
    return '';
  }).join(' ');
}

/**
 * @param {string} token
 * @param {string} haystackNormalized
 * @param {boolean} exact
 * @param {boolean} wildcard
 * @returns {{exactHit:boolean, wildcardHit:boolean}}
 */
function matchToken(token, haystackNormalized, exact, wildcard) {
  const t = normalizeText(token);
  if (!t || !haystackNormalized) return { exactHit: false, wildcardHit: false };

  const exactHit = exact && haystackNormalized === t;
  const wildcardHit = wildcard && haystackNormalized.includes(t);

  return { exactHit, wildcardHit };
}

/**
 * @param {import('../app/types.js').OntologyDocument} doc
 * @param {import('../app/types.js').SearchOptions} options
 * @returns {boolean}
 */
export function docPassesFilters(doc, options) {
  // Type filter
  if (Array.isArray(options.types) && options.types.length) {
    if (!options.types.includes(doc.type)) return false;
  }

  // Namespace filter
  const nsFilters = normalizeNamespaceFilters(options.namespaces || []);

  if (nsFilters.length) {
    const ok = nsFilters.some((f) => docMatchesNamespaceFilter(doc, f));
    if (!ok) return false;
  }

  return true;
}

/**
 * Score a document for a query token set.
 *
 * @param {import('../app/types.js').OntologyDocument} doc
 * @param {string[]} queryTokens
 * @param {import('../app/types.js').SearchOptions} options
 * @returns {{
 *   score: number,
 *   matchedTokens: Set<string>,
 *   labelHits: number,
 *   defOnlyHits: number,
 *   reasons: string[]
 * }}
 */
export function scoreDocument(doc, queryTokens, options) {
  let score = 0;

  const reasons = [];
  const matchedTokens = new Set();

  const label = normalizeText(doc.label || '');
  const iri = normalizeText(doc.iri || '');
  const alt = normalizeText((doc.altLabels || []).join(' '));

  const def = options.includeDefinition ? normalizeText(doc.definition || '') : '';
  const cit = options.includeCitation ? normalizeText(fieldValuesToText(doc.citations)) : '';
  const ex = options.includeExamples ? normalizeText(fieldValuesToText(doc.examples)) : '';
  const cl = options.includeClarifications ? normalizeText(fieldValuesToText(doc.clarifications)) : '';

  let labelHits = 0;
  let defOnlyHits = 0;

  for (const tokRaw of queryTokens) {
    const tok = normalizeText(tokRaw);
    if (!tok) continue;

    let tokenMatchedSomewhere = false;
    let tokenMatchedLabelOrIri = false;

    // --- Exact equality is always a relevance signal.
    // If wildcard is off, this block also acts as exact-only matching.
    if (label === tok) {
      score += 160;
      labelHits += 1;
      tokenMatchedSomewhere = true;
      tokenMatchedLabelOrIri = true;
      reasons.push(`label == "${tok}" (+160)`);
    }
    if (iri === tok || iri.endsWith(`/${tok}`) || iri.endsWith(`#${tok}`)) {
      score += 150;
      tokenMatchedSomewhere = true;
      tokenMatchedLabelOrIri = true;
      reasons.push(`iri == "${tok}" (+150)`);
    }

    if (doc.altLabels?.length) {
      const altExact = doc.altLabels.some((a) => normalizeText(a) === tok);
      if (altExact) {
        score += 120;
        tokenMatchedSomewhere = true;
        reasons.push(`altLabel == "${tok}" (+120)`);
      }
    }

    // --- Wildcard / contains matches ---
    if (options.wildcard) {
      if (label && label.includes(tok)) {
        score += 40;
        labelHits += 1;
        tokenMatchedSomewhere = true;
        tokenMatchedLabelOrIri = true;
        reasons.push(`label ~ "${tok}" (+40)`);
      }
      if (iri && iri.includes(tok)) {
        score += 25;
        tokenMatchedSomewhere = true;
        tokenMatchedLabelOrIri = true;
        reasons.push(`iri ~ "${tok}" (+25)`);
      }
      if (alt && alt.includes(tok)) {
        score += 20;
        tokenMatchedSomewhere = true;
        reasons.push(`altLabels ~ "${tok}" (+20)`);
      }

      if (def && def.includes(tok)) {
        score += 10;
        tokenMatchedSomewhere = true;
        reasons.push(`definition ~ "${tok}" (+10)`);
      }

      // low-weight ancillary fields
      if (cit && cit.includes(tok)) {
        score += 5;
        tokenMatchedSomewhere = true;
        reasons.push(`citations ~ "${tok}" (+5)`);
      }
      if (ex && ex.includes(tok)) {
        score += 5;
        tokenMatchedSomewhere = true;
        reasons.push(`examples ~ "${tok}" (+5)`);
      }
      if (cl && cl.includes(tok)) {
        score += 5;
        tokenMatchedSomewhere = true;
        reasons.push(`clarifications ~ "${tok}" (+5)`);
      }
    }

    if (tokenMatchedSomewhere) {
      matchedTokens.add(tok);
      if (!tokenMatchedLabelOrIri) {
        // if it matched but NOT label/iri, it’s a weaker match
        defOnlyHits += 1;
      }
    }
  }

  return { score, matchedTokens, labelHits, defOnlyHits, reasons };
}

/**
 * Search documents and return ranked results.
 *
 * @param {Map<string, import('../app/types.js').OntologyDocument>} docsByIri
 * @param {string} query
 * @param {import('../app/types.js').SearchOptions} options
 * @param {number} limit
 * @returns {{
 *   results: Array<{
 *     doc: import('../app/types.js').OntologyDocument,
 *     score: number,
 *     matchedTokenCount: number,
 *     labelHits: number,
 *     defOnlyHits: number,
 *     reasons: string[]
 *   }>,
 *   queryTokens: string[]
 * }}
 */
export function searchDocuments(docsByIri, query, options, limit = 50) {
  const queryTokens = normalizeQuery(query);
  const fullQuery = normalizeText(query);
  const phraseQuery = queryTokens.length === 1 && queryTokens[0].includes(' ')
    ? queryTokens[0]
    : fullQuery;
  const isPhraseQuery = phraseQuery && phraseQuery.includes(' ');
  const scoringTokens = isPhraseQuery && options.exact && !options.wildcard
    ? [phraseQuery]
    : isPhraseQuery
      ? Array.from(new Set([phraseQuery, ...queryTokens]))
    : queryTokens;
  if (!queryTokens.length) return { results: [], queryTokens };

  /** @type {Array<any>} */
  const scored = [];

  for (const doc of docsByIri.values()) {
    if (!docPassesFilters(doc, options)) continue;

    const { score, matchedTokens, labelHits, defOnlyHits, reasons } =
      scoreDocument(doc, scoringTokens, options);

    let finalScore = score;
    let finalLabelHits = labelHits;
    const finalReasons = [...reasons];

    if (isPhraseQuery && options.wildcard) {
      const label = normalizeText(doc.label || '');
      const altExact = (doc.altLabels || []).some((a) => normalizeText(a) === phraseQuery);
      if (label === phraseQuery) {
        finalScore += 300;
        finalLabelHits += 1;
        finalReasons.push(`label phrase == "${phraseQuery}" (+300)`);
      } else if (altExact) {
        finalScore += 220;
        finalReasons.push(`altLabel phrase == "${phraseQuery}" (+220)`);
      }
    }

    if (finalScore <= 0) continue;

    scored.push({
      doc,
      score: finalScore,
      matchedTokenCount: matchedTokens.size,
      labelHits: finalLabelHits,
      defOnlyHits,
      reasons: finalReasons
    });
  }

  // Tie-breakers (stable)
  scored.sort((a, b) => {
    // 1) higher score
    if (b.score !== a.score) return b.score - a.score;

    // 2) more distinct tokens matched
    if (b.matchedTokenCount !== a.matchedTokenCount) return b.matchedTokenCount - a.matchedTokenCount;

    // 3) prefer label/iri hits over definition-only hits
    // (higher labelHits better; fewer defOnlyHits better)
    if (b.labelHits !== a.labelHits) return b.labelHits - a.labelHits;
    if (a.defOnlyHits !== b.defOnlyHits) return a.defOnlyHits - b.defOnlyHits;

    // 4) shorter label
    const al = (a.doc.label || a.doc.iri || '').length;
    const bl = (b.doc.label || b.doc.iri || '').length;
    if (al !== bl) return al - bl;

    // 5) alphabetical by label (stable-ish)
    const aLab = a.doc.label || a.doc.iri || '';
    const bLab = b.doc.label || b.doc.iri || '';
    return aLab.localeCompare(bLab);
  });

  return { results: scored.slice(0, limit), queryTokens };
}
