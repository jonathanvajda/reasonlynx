// Local, DOM-free query normalization and ranked search shared by library clients.
const textValue = v => typeof v === 'string' ? v : v?.['@value'] || '';
const localName = key => key.split(/[/#:]/).pop();
const looksLikeQuery = text => /\b(SELECT|ASK|CONSTRUCT|DESCRIBE|INSERT|DELETE|LOAD|CLEAR|CREATE|DROP|WITH)\b/i.test(text);

/** Extract raw query artifacts, OKEA nodes and queries nested in CQ JSON-LD. */
export function extractLibraryQueries(payload, metadata = {}) {
  const results = [];
  const visit = (node, path = '', context = {}) => {
    if (typeof node === 'string') {
      if (!path && /^[\s]*[\[{]/.test(node)) {
        try { visit(JSON.parse(node), path, context); return; } catch { /* A raw query can start with a comment or punctuation. */ }
      }
      if (!path && looksLikeQuery(node)) results.push({ ...metadata, id: metadata.artifactId || 'raw', query: node });
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${path}/${i}`, context));
    const ctx = { ...context, ...(typeof node['@context'] === 'object' && !Array.isArray(node['@context']) ? node['@context'] : {}) };
    const expand = key => {
      const mapped = ctx[key];
      if (mapped) return typeof mapped === 'string' ? mapped : mapped['@id'] || key;
      const [prefix, ...rest] = key.split(':');
      return rest.length && typeof ctx[prefix] === 'string' ? ctx[prefix] + rest.join(':') : key;
    };
    const labels = Object.entries(node).filter(([k]) => /^(label|prefLabel|title)$/.test(localName(expand(k))));
    const label = labels.map(([,v]) => textValue(Array.isArray(v) ? v[0] : v)).find(Boolean) || metadata.label;
    for (const [key, value] of Object.entries(node)) {
      const name = localName(expand(key));
      if (/^(query|queryText|sparql|text|content|value|has_sparql_query_text_value)$/.test(name)) {
        const values = Array.isArray(value) ? value : [value];
        values.forEach((v, i) => {
          const query = textValue(v);
          if (looksLikeQuery(query)) results.push({ ...metadata, label, query, annotations: node,
            id: `${metadata.artifactId || 'node'}${path}/${key}/${i}`, resourceId: node['@id'] || '' });
        });
      }
      if (key !== '@context' && value && typeof value === 'object') visit(value, `${path}/${key}`, ctx);
    }
  };
  visit(payload);
  return results;
}

export function levenshtein(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] !== b[j])));
    row = next;
  }
  return row[b.length];
}

export function matchText(text, search, fuzzy = true) {
  const haystack = text.toLowerCase(), needle = search.toLowerCase();
  const start = haystack.indexOf(needle);
  if (start >= 0) return { start, end: start + needle.length, score: 100, term: text.slice(start, start + needle.length), kind: 'text' };
  if (!fuzzy || needle.length < 4) return null;
  let best = null;
  for (const word of text.matchAll(/[\p{L}\p{N}_-]+/gu)) {
    if (Math.abs(word[0].length - needle.length) > 2) continue;
    const distance = levenshtein(word[0].toLowerCase(), needle);
    if (distance > (needle.length >= 8 ? 2 : 1)) continue;
    const score = Math.round(65 * (1 - distance / Math.max(needle.length, word[0].length)));
    if (!best || score > best.score) best = { start: word.index, end: word.index + word[0].length, score, term: word[0], kind: 'fuzzy' };
  }
  return best;
}

/** Walk the parser AST: comments, literals and PREFIX declarations alone cannot create resource hits. */
export function queryResourceIris(query, parser) {
  const iris = new Set();
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (node.termType === 'NamedNode') iris.add(node.value);
    for (const [key, value] of Object.entries(node)) if (key !== 'prefixes') {
      if (Array.isArray(value)) value.forEach(walk); else walk(value);
    }
  };
  try { const ast = parser(query); iris.prefixes = ast.prefixes || {}; walk(ast); } catch { /* Invalid queries remain text searchable. */ }
  return iris;
}

/** Locate a real resource spelling for a semantic preview using this query's prefix map. */
export function resourceMention(line, iri, prefixes = {}) {
  for (const token of line.matchAll(/<[^>]+>|(?:[\p{L}_][\p{L}\p{N}_-]*)?:[\p{L}\p{N}_~.!$&%#@-]+/gu)) {
    const value = token[0];
    const colon = value.indexOf(':');
    const expanded = value.startsWith('<') ? value.slice(1, -1) : (prefixes[value.slice(0, colon)] || '') + value.slice(colon + 1).replace(/\.$/, '');
    if (expanded === iri) return { start: token.index, end: token.index + value.length };
  }
  return null;
}

export const ANNOTATION_PREDICATES = new Set([
  'http://www.w3.org/2000/01/rdf-schema#label', 'http://www.w3.org/2004/02/skos/core#prefLabel',
  'http://www.w3.org/2004/02/skos/core#altLabel', 'https://www.commoncoreontologies.org/ont00001753',
  'http://www.ontologyrepository.com/CommonCoreOntologies/ont00001753'
]);

export function ontologyTerms(rows) {
  const terms = new Map();
  for (const row of rows) {
    const s = row.subject?.value || row.subject, p = row.predicate?.value || row.predicate, o = row.object?.value || row.object;
    if (!ANNOTATION_PREDICATES.has(p) || !s || typeof o !== 'string') continue;
    if (!terms.has(s)) terms.set(s, { iri: s, labels: [] });
    if (!terms.get(s).labels.includes(o)) terms.get(s).labels.push(o);
  }
  return [...terms.values()];
}

export function searchQueryLibrary(queries, search, { fuzzy = true, semantic = true, terms = [] } = {}) {
  search = search.trim();
  const termHits = semantic && search ? terms.map(term => ({ ...term,
    match: [term.iri, ...term.labels].map(label => ({ label, hit: matchText(label, search, fuzzy) }))
      .filter(x => x.hit).sort((a,b) => b.hit.score - a.hit.score)[0]
  })).filter(x => x.match) : [];
  return queries.map(query => {
    const hits = search ? query.query.split(/\r?\n/).flatMap((line, lineIndex) => {
      const hit = matchText(line, search, fuzzy);
      return hit ? [{ ...hit, lineIndex }] : [];
    }) : [];
    const resources = termHits.filter(term => query.iris?.has(term.iri));
    const titleHit = search && matchText(query.label || '', search, fuzzy);
    const score = search ? Math.max(titleHit?.score || 0, ...hits.map(h => h.score), ...resources.map(t => Math.round(t.match.hit.score * .85)), 0)
      + Math.min(9, Math.max(0, hits.length + resources.length - 1)) : 0;
    return { ...query, hits, resources, score };
  }).filter(q => !search || q.score > 0).sort((a,b) => b.score - a.score || (a.label || a.id).localeCompare(b.label || b.id));
}
