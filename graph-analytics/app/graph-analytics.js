import { COMMON_NAMESPACE_IRIS as NS } from '../../packages/namespace-registry/src/index.js';
import { parseRdfTextWithAdapters } from '../../packages/rdf-io/src/index.js';

(function(){
  // --- State ---
  const state = {
    quads: [], // { s,p,o,g }
    nodes: new Set(),
    preds: new Set(),
    subjToEdges: new Map(), // subject IRI/Literal -> [{p, o}]
    objToEdges: new Map(),  // reverse index for undirected traversal
    subPropIndex: new Map(), // p -> [children]
    objectProps: new Set(),  // owl:ObjectProperty IRIs in data
    loadedName: null,
  };

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const logEl = $('#logs');
  const statsEl = $('#stats');

  function log(msg, level='info') {
    const color = level==='error' ? 'error' : level==='warn' ? 'warn' : 'muted';
    const prefix = level==='error' ? '✖' : level==='warn' ? '⚠' : '•';
    logEl.textContent += `${prefix} ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }
  function clearLogs(){ logEl.textContent=''; }

  // --- Parsing helpers ---
  function detectFormatByName(name) {
    if (!name) return 'auto';
    const n = name.toLowerCase();
    if (n.endsWith('.ttl') || n.endsWith('.n3') || n.endsWith('.trig')) return 'text/turtle';
    if (n.endsWith('.nt') || n.endsWith('.nq')) return 'application/n-triples';
    if (n.endsWith('.json') || n.endsWith('.jsonld')) return 'application/ld+json';
    if (n.endsWith('.rdf') || n.endsWith('.owl') || n.endsWith('.xml')) return 'application/rdf+xml';
    return 'auto';
  }

  function iri(str) {
    // Accepts <IRI> or bare IRI; returns a canonical string form.
    const s = String(str || '').trim();
    if (!s) return '';
    if (s.startsWith('<') && s.endsWith('>')) return s.slice(1, -1);
    // Quote literals: "foo" or number detection
    if (s.startsWith('"') && s.endsWith('"')) return s; // literal
    if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(s)) return s; // numeric literal-ish
    return s; // assume IRI
  }

  function isLiteralTerm(val){
    // crude heuristic: quoted string, or numeric without angle brackets
    if (val == null) return false;
    const s = String(val);
    return (s.startsWith('"') && s.endsWith('"')) || (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(s));
  }

  function rdfTermToAnalyticsValue(term) {
    if (!term) return '';
    if (term.termType === 'BlankNode') return `_:${term.value}`;
    if (term.termType === 'Literal') return JSON.stringify(term.value);
    return term.value || '';
  }

  function rdfIoQuadsToAnalyticsQuads(quads) {
    return quads.map((quad) => ({
      s: rdfTermToAnalyticsValue(quad.subject),
      p: quad.predicate.value,
      o: rdfTermToAnalyticsValue(quad.object),
      g: quad.graph && quad.graph.termType !== 'DefaultGraph' ? rdfTermToAnalyticsValue(quad.graph) : undefined
    }));
  }
  async function parseFileToQuads(file, overrideFormat, baseIRI) {
    const name = file?.name || 'graph';
    const fmt = overrideFormat && overrideFormat !== 'auto' ? overrideFormat : detectFormatByName(name);
    const text = await file.text();
    const parseFormat = fmt === 'auto'
      ? (text.trim().startsWith('{') ? 'application/ld+json' : (/<rdf:RDF[\s>]/.test(text) ? 'application/rdf+xml' : 'text/turtle'))
      : fmt;

    try {
      log(`Parsing as ${parseFormat} via shared RDF IO...`);
      const parsed = await parseRdfTextWithAdapters(text, {
        format: parseFormat,
        baseIri: baseIRI || 'http://example.org/',
        runtime: { N3, jsonld: globalThis.jsonld, $rdf: globalThis.$rdf }
      });
      return rdfIoQuadsToAnalyticsQuads(parsed.quads);
    } catch (e) {
      log(`RDF parse failed: ${e.message || e}`, 'error');
      throw e;
    }
  }

  // --- Graph building & indexes ---  function buildIndexes(quads, includeLiterals) {
    state.nodes.clear();
    state.preds.clear();
    state.subjToEdges.clear();
    state.objToEdges.clear();
    state.subPropIndex.clear();
    state.objectProps.clear();

    const subjToEdges = state.subjToEdges;
    const objToEdges = state.objToEdges;

    for (const q of quads) {
      const {s, p, o} = q;
      state.preds.add(p);
      // capture owl:ObjectProperty
      if (p === NS.rdf.type && o === NS.owl.ObjectProperty) {
        state.objectProps.add(s);
      }
      // subPropertyOf tree
      if (p === NS.rdfs.subPropertyOf) {
        const child = s, parent = o;
        const arr = state.subPropIndex.get(parent) || [];
        arr.push(child);
        state.subPropIndex.set(parent, arr);
      }

      // Build adjacency lists, honoring literal inclusion
      const allowLiteralEdge = (includeLiterals === 'yes') || (!isLiteralTerm(o));
      if (allowLiteralEdge) {
        state.nodes.add(s); state.nodes.add(o);
        const list = subjToEdges.get(s) || [];
        list.push({ p, o });
        subjToEdges.set(s, list);
        // Reverse index for undirected traversal
        const rev = objToEdges.get(o) || [];
        rev.push({ p, s });
        objToEdges.set(o, rev);
      }
    }

    statsEl.textContent = `${state.nodes.size} nodes • ${state.preds.size} predicates • ${quads.length} triples`;
  }

  function expandSubProps(roots) {
    // BFS over rdfs:subPropertyOf to collect all descendants
    const result = new Set();
    const q = [...roots];
    while (q.length) {
      const cur = q.shift();
      if (result.has(cur)) continue;
      result.add(cur);
      const kids = state.subPropIndex.get(cur) || [];
      for (const k of kids) if (!result.has(k)) q.push(k);
    }
    return result;
  }

  function allowedPredicateSet(mode, listText, subpropRootsText) {
    if (mode === 'all') return null; // null => allow all
    if (mode === 'list') {
      const s = new Set(listText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean));
      return s.size ? s : null;
    }
    if (mode === 'objectProps') {
      return new Set(state.objectProps);
    }
    if (mode === 'subpropTree') {
      const roots = new Set(subpropRootsText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean));
      if (!roots.size) return null;
      const expanded = expandSubProps(roots);
      return expanded.size ? expanded : null;
    }
    return null;
  }

  // --- Search algorithms ---
  function neighborsOf(node, edgeMode, allowedPreds) {
    const outs = state.subjToEdges.get(node) || [];
    const next = [];
    for (const {p, o} of outs) {
      if (!allowedPreds || allowedPreds.has(p)) next.push({ via: p, to: o, dir: '→' });
    }
    if (edgeMode === 'undirected') {
      const ins = state.objToEdges.get(node) || [];
      for (const {p, s} of ins) {
        if (!allowedPreds || allowedPreds.has(p)) next.push({ via: p, to: s, dir: '←' });
      }
    }
    return next;
  }

  function bfsShortest(start, goal, edgeMode, allowedPreds, maxDepth) {
    const startKey = iri(start), goalKey = iri(goal);
    if (!startKey || !goalKey) throw new Error('Start and goal must be provided.');
    const q = [{ node: startKey, path: [] }];
    const seen = new Set([startKey]);
    let depth = 0;
    while (q.length) {
      const { node, path } = q.shift();
      if (node === goalKey) return path; // path is list of {from, via, to, dir}
      if (path.length >= maxDepth) continue;
      for (const step of neighborsOf(node, edgeMode, allowedPreds)) {
        if (!seen.has(step.to)) {
          seen.add(step.to);
          q.push({ node: step.to, path: [...path, { from: node, via: step.via, to: step.to, dir: step.dir }] });
        }
      }
      depth++;
    }
    return null;
  }

  function dfsAllPaths(start, goal, edgeMode, allowedPreds, maxDepth, maxPaths) {
    const startKey = iri(start), goalKey = iri(goal);
    const results = [];
    const stack = [{ node: startKey, path: [], visited: new Set([startKey]) }];
    while (stack.length && results.length < maxPaths) {
      const { node, path, visited } = stack.pop();
      if (node === goalKey) { results.push(path); continue; }
      if (path.length >= maxDepth) continue;
      const nbrs = neighborsOf(node, edgeMode, allowedPreds);
      for (const step of nbrs.reverse()) { // reverse to keep natural order
        if (!visited.has(step.to)) {
          const nextVisited = new Set(visited);
          nextVisited.add(step.to);
          stack.push({ node: step.to, path: [...path, { from: node, via: step.via, to: step.to, dir: step.dir }], visited: nextVisited });
        }
      }
    }
    return results;
  }

  function renderPathList(container, path) {
    container.innerHTML = '';
    if (!path) { container.innerHTML = '<li class="muted">(none)</li>'; return; }
    if (Array.isArray(path) && path.length === 0) { container.innerHTML = '<li class="muted">(start equals goal)</li>'; return; }
    for (const step of path) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="node">${escapeHtml(step.from)}</span> <span class="edge">${escapeHtml(step.dir)} ${escapeHtml(step.via)}</span> <span class="node">${escapeHtml(step.to)}</span>`;
      container.appendChild(li);
    }
  }

  function renderAllPaths(container, paths) {
    container.innerHTML = '';
    if (!paths || paths.length === 0) { container.innerHTML = '<li class="muted">(none)</li>'; return; }
    let idx = 1;
    for (const path of paths) {
      const li = document.createElement('li');
      const pieces = path.map(st => `${escapeHtml(st.from)} <span class="edge">${escapeHtml(st.dir)} ${escapeHtml(st.via)}</span> ${escapeHtml(st.to)}`);
      li.innerHTML = `<div class="badge">#${idx++}</div> ` + pieces.join(' &nbsp;»&nbsp; ');
      container.appendChild(li);
    }
  }

  function escapeHtml(s){ return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  function generateSparqlForPath(path, start, goal) {
    if (!path || !path.length) return '';
    // Build SELECT using variables ?n1 ?n2 ... and concrete predicates
    const vars = [];
    const lines = [];
    let cur = `<${iri(start)}>`;
    for (let i=0; i<path.length; i++) {
      const v = `?n${i+1}`;
      vars.push(v);
      const p = `<${path[i].via}>`;
      const triple = path[i].dir === '←' ? `${v} ${p} ${cur} .` : `${cur} ${p} ${v} .`;
      lines.push(triple);
      cur = v;
    }
    const finalBind = `${cur} ${cur.startsWith('?') ? '' : ''}`;
    const where = lines.join('\n  ');
    const query = `# Concrete chain for discovered path\nSELECT ${vars.join(' ')} WHERE {\n  ${where}\n}`;
    return query;
  }

  // --- UI handlers ---
  $('#btnLoad').addEventListener('click', async () => {
    clearLogs();
    const file = $('#file').files?.[0];
    if (!file) { log('Please choose a graph file first.', 'warn'); return; }
    try {
      log(`Loading: ${file.name}`);
      state.loadedName = file.name;
      const quads = await parseFileToQuads(file, $('#format').value, $('#baseIri').value.trim());
      state.quads = quads;
      buildIndexes(quads, $('#includeLiterals').value);
      log(`Loaded ${quads.length} triples; found ${state.nodes.size} nodes, ${state.preds.size} unique predicates.`);
      if (state.objectProps.size) log(`Detected ${state.objectProps.size} owl:ObjectProperty definitions.`);
    } catch (e) {
      console.error(e);
      log(String(e.message || e), 'error');
    }
  });

  $('#btnShortest').addEventListener('click', () => {
    try {
      clearOutputs();
      if (!state.quads.length) { log('Load a graph first.', 'warn'); return; }
      const allowed = allowedPredicateSet($('#predMode').value, $('#predList').value, $('#subpropRoots').value);
      const path = bfsShortest($('#start').value, $('#goal').value, $('#edgeMode').value, allowed, Number($('#maxDepth').value || 8));
      if (!path) { log('No path found within limits.', 'warn'); renderPathList($('#shortest'), null); return; }
      log(`Shortest path length: ${path.length}`, 'info');
      renderPathList($('#shortest'), path);
      $('#sparql').value = generateSparqlForPath(path, $('#start').value, $('#goal').value);
    } catch (e) { log(String(e.message || e), 'error'); }
  });

  $('#btnAll').addEventListener('click', () => {
    try {
      clearOutputs(false);
      if (!state.quads.length) { log('Load a graph first.', 'warn'); return; }
      const allowed = allowedPredicateSet($('#predMode').value, $('#predList').value, $('#subpropRoots').value);
      const paths = dfsAllPaths($('#start').value, $('#goal').value, $('#edgeMode').value, allowed, Number($('#maxDepth').value || 8), Number($('#maxPaths').value || 50));
      log(`Enumerated ${paths.length} path(s).`);
      renderAllPaths($('#allpaths'), paths);
    } catch (e) { log(String(e.message || e), 'error'); }
  });

  $('#btnSparql').addEventListener('click', () => {
    try {
      const items = $('#shortest').querySelectorAll('li');
      if (!items.length || items[0].classList.contains('muted')) { log('Compute a shortest path first.', 'warn'); return; }
      // Reconstruct path from DOM list (each has innerHTML with from, via, to). Simpler: store last path.
      const recalc = bfsShortest($('#start').value, $('#goal').value, $('#edgeMode').value, allowedPredicateSet($('#predMode').value, $('#predList').value, $('#subpropRoots').value), Number($('#maxDepth').value || 8));
      if (!recalc) { log('No path to generate SPARQL for.', 'warn'); return; }
      $('#sparql').value = generateSparqlForPath(recalc, $('#start').value, $('#goal').value);
      log('SPARQL generated for current shortest path.');
    } catch (e) { log(String(e.message || e), 'error'); }
  });

  function clearOutputs(clearShortest=true){
    if (clearShortest) $('#shortest').innerHTML='';
    $('#allpaths').innerHTML='';
    $('#sparql').value='';
  }
})();
