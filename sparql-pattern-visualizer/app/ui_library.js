import { loadLibrary, importQueryFiles, parseOntology, readAdditionalQueryStore, indexOntologyArtifact } from './query-library-store.js';
import { searchQueryLibrary, matchText, resourceMention } from '../../packages/sparql-utils/src/query-library.js';

const el = id => document.getElementById(id);
function element(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function download(blob, name) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initQueryLibrary({ selectQuery, resize }) {
  let data = { queries: [], terms: [], artifacts: [] }, extraTerms = [], extraQueries = [], activeId = '', generation = 0;
  const selected = new Set();
  const exportState = () => {
    el('libraryExport').disabled = !selected.size;
    el('libraryExport').textContent = `Export selected (${selected.size})`;
  };
  function render() {
    const search = el('librarySearch').value.trim();
    const byIri = new Map();
    for (const term of [...data.terms, ...extraTerms]) {
      const existing = byIri.get(term.iri) || { iri: term.iri, labels: [] };
      existing.labels = [...new Set([...existing.labels, ...term.labels])]; byIri.set(term.iri, existing);
    }
    const terms = [...byIri.values()];
    const options = { fuzzy: el('libraryFuzzy').checked, semantic: el('librarySemantic').checked, terms };
    const allQueries = [...data.queries, ...extraQueries];
    const results = searchQueryLibrary(allQueries, search, options);
    el('libraryStatus').textContent = `${results.length} of ${allQueries.length} queries · ${terms.length} ontology resources`;
    const scrollTop = el('libraryResults').scrollTop;
    el('libraryResults').replaceChildren();
    if (!results.length) el('libraryResults').append(element('p', data.queries.length ? 'No matches. Try a shorter term or enable typo matching.' : 'No queries found in this project. Import query files or save queries from another app.'));
    for (const query of results) {
      const card = element('article', '', 'sviz-query-card');
      if (query.id === activeId) card.classList.add('is-active');
      const checkLabel = element('label', '', 'sviz-check');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selected.has(query.id);
      checkbox.addEventListener('change', () => { checkbox.checked ? selected.add(query.id) : selected.delete(query.id); exportState(); });
      checkLabel.append(checkbox, document.createTextNode('Select for export')); card.append(checkLabel);
      const open = element('button', query.label || query.resourceId || 'Untitled query', 'sviz-card-open');
      open.setAttribute('aria-pressed', String(query.id === activeId));
      open.addEventListener('click', () => {
        activeId = query.id;
        el('librarySelected').textContent = query.label || query.resourceId || 'Library query';
        selectQuery(query); render();
      });
      card.append(open, element('p', search ? `Relevance: ${query.score}` : 'All queries'));
      card.append(element('small', [query.source?.application, query.artifactKind, query.updatedAt, query.resourceId].filter(Boolean).join(' · ')));
      if (query.annotations) {
        const details = element('details', ''); details.append(element('summary', 'Query information'), element('pre', JSON.stringify(query.annotations, null, 2))); card.append(details);
      }
      const info = element('details', '');
      info.append(element('summary', 'Stored artifact information'), element('pre', JSON.stringify({ artifactId: query.artifactId,
        projectId: query.projectId, source: query.source, metadata: query.metadata, tags: query.tags }, null, 2))); card.append(info);
      const lines = query.query.split(/\r?\n/);
      const bestHit = [...query.hits].sort((a,b) => b.score - a.score)[0];
      let center = bestHit?.lineIndex ?? 0;
      if (!bestHit && query.resources.length) {
        const iri = query.resources[0].iri;
        center = Math.max(0, lines.findIndex(line => !/^\s*(PREFIX|BASE|#)/i.test(line) && resourceMention(line, iri, query.iris?.prefixes)));
      }
      const preview = element('pre', '', 'sviz-preview');
      for (let i = Math.max(0, center - 1); i <= Math.min(lines.length - 1, center + 1); i++) {
        const line = element('span', '', 'sviz-preview-line');
        let hit = query.hits.find(h => h.lineIndex === i);
        if (!hit && query.resources.length) {
          for (const resource of query.resources) {
            hit = resourceMention(lines[i], resource.iri, query.iris?.prefixes);
            if (hit) break;
          }
        }
        line.append(document.createTextNode(`${i + 1}  `));
        if (hit) {
          line.classList.add('is-match');
          line.append(document.createTextNode(lines[i].slice(0, hit.start)), element('mark', lines[i].slice(hit.start, hit.end)), document.createTextNode(lines[i].slice(hit.end)));
        } else line.append(document.createTextNode(lines[i]));
        preview.append(line);
      }
      card.append(preview);
      if (bestHit?.kind === 'fuzzy') card.append(element('p', `Did you mean “${bestHit.term}”?`));
      else if (!bestHit) {
        const correction = query.resources.find(r => r.match.hit.kind === 'fuzzy');
        if (correction) card.append(element('p', `Did you mean “${correction.match.hit.term}”?`));
      }
      for (const resource of query.resources) card.append(element('p', `Ontology match: ${resource.match.label} → ${resource.iri}`, 'sviz-resource-match'));
      el('libraryResults').append(card);
    }
    el('libraryResults').scrollTop = scrollTop;
    const suggestions = el('librarySuggestions'); suggestions.replaceChildren();
    if (search.length >= 2 && options.semantic) {
      const labels = new Set(terms.filter(t => [t.iri, ...t.labels].some(label => matchText(label, search, options.fuzzy))).flatMap(t => t.labels));
      for (const label of [...labels].slice(0, 12)) { const option = document.createElement('option'); option.value = label; suggestions.append(option); }
    }
  }
  async function refresh() {
    const current = ++generation;
    el('libraryStatus').textContent = 'Reading shared library…';
    try {
      const next = await loadLibrary(); if (current !== generation) return;
      data = next;
      for (const id of selected) if (![...data.queries, ...extraQueries].some(q => q.id === id)) selected.delete(id);
      el('libraryProject').textContent = `Project: ${data.projectId}`;
      const picker = el('libraryOntology'); picker.replaceChildren(element('option', 'All stored ontologies')); picker.firstChild.value = '';
      for (const a of data.artifacts.filter(a => /ontology|rdf|graph/.test(a.artifactKind || '') || /turtle|rdf|n-quads|n-triples/.test(a.mediaType || '') || /^(ttl|nt|nq|trig|rdf|owl|jsonld)$/.test(a.extension || ''))) {
        const option = element('option', a.label || a.artifactId); option.value = a.artifactId; picker.append(option);
      }
      exportState(); render();
      if (data.warnings.length) el('libraryStatus').textContent += ` · ${data.warnings.join('; ')}`;
    } catch (error) { el('libraryStatus').textContent = `Library unavailable: ${error.message}`; }
  }
  async function perform(action) {
    try { await action(); } catch (error) { el('libraryStatus').textContent = error.message; }
  }
  for (const id of ['librarySearch', 'libraryFuzzy', 'librarySemantic']) el(id).addEventListener('input', render);
  el('libraryRefresh').addEventListener('click', refresh);
  el('libraryReadStore').addEventListener('click', () => perform(async () => {
    const queries = await readAdditionalQueryStore(el('libraryDatabase').value.trim(), el('libraryObjectStore').value.trim());
    const byId = new Map([...extraQueries, ...queries].map(q => [q.id, q])); extraQueries = [...byId.values()]; render();
  }));
  el('libraryToggle').addEventListener('click', () => {
    const hidden = !el('queryLibrary').hidden; el('queryLibrary').hidden = hidden;
    el('libraryToggle').textContent = hidden ? 'Show query library' : 'Hide query library';
    el('libraryToggle').setAttribute('aria-expanded', String(!hidden)); resize();
  });
  el('libraryImport').addEventListener('change', event => perform(async () => { await importQueryFiles([...event.target.files]); event.target.value = ''; await refresh(); }));
  el('libraryOntologyFiles').addEventListener('change', event => perform(async () => {
    for (const file of event.target.files) extraTerms.push(...await parseOntology(await file.text(), file.name));
    event.target.value = ''; render();
  }));
  el('libraryIndex').addEventListener('click', () => perform(async () => {
    const id = el('libraryOntology').value, errors = [];
    for (const option of [...el('libraryOntology').options].filter(o => o.value && (!id || o.value === id))) {
      const artifact = data.artifacts.find(a => a.artifactId === option.value);
      try {
        extraTerms.push(...await indexOntologyArtifact(artifact));
      } catch (error) { errors.push(`${artifact.label}: ${error.message}`); }
    }
    render(); if (errors.length) el('libraryStatus').textContent += ` · ${errors.join('; ')}`;
  }));
  el('libraryExport').addEventListener('click', () => perform(async () => {
    const queries = [...data.queries, ...extraQueries].filter(q => selected.has(q.id));
    const filename = (q, i) => `${String(i + 1).padStart(3, '0')}-${(q.label || 'query').replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 70)}.rq`;
    if (queries.length === 1) download(new Blob([queries[0].query], { type: 'application/sparql-query' }), filename(queries[0], 0));
    else if (queries.length) {
      const zip = new window.JSZip(); queries.forEach((q, i) => zip.file(filename(q, i), q.query));
      download(await zip.generateAsync({ type: 'blob' }), 'sparql-queries.zip');
    }
  }));
  refresh();
}
