import { loadGraphFromIndexedDB } from '../../axiolotl/app/comunica-indexeddb-bridge.js';
import { mapFromQuads, transitiveClosure } from '../../axiolotl/app/axiolotl-inference.js';
import { COMMON_NAMESPACE_IRIS as NS } from '../../packages/namespace-registry/src/index.js';

  // Path Finder — reuses your existing rdflib/comunica + inference helpers (no duplicate parsers)
  // Exposes window.PathFinder with: loadStore, computeAllowedPredicates, shortestPath, allPaths, toSparql
  //
  // Depends on:
  //   - loadGraphFromIndexedDB() (from comunica-indexeddb-bridge.js)
  //   - mapFromQuads(), transitiveClosure(), and RDF/OWL/RDFS constants (from axiolotl-inference.js)
  //   - global N3 (RDF/JS DataFactory/Store)
  (function(){
    const DF = N3.DataFactory;
    const { namedNode, blankNode, literal } = DF;

    // --- Utilities ---
    const isLiteralTerm = (term) => term && term.termType === 'Literal';

    function normalizeNodeInput(x){
      // Accept <IRI> or bare IRI or JSON-string literal like "Alice" or numbers
      if (typeof x !== 'string') return String(x);
      const s = x.trim();
      if (!s) return s;
      if (s.startsWith('<') && s.endsWith('>')) return s.slice(1,-1);
      return s;
    }

    // Build a lightweight adjacency over an RDF/JS store, honoring predicate allow-list and literal policy
    function neighbors(store, nodeIri, { edgeMode='directed', allowed=null, includeLiterals=false }){
      const out = [];
      // outgoing s->o
      for (const q of store.getQuads(namedNode(nodeIri), null, null, null)){
        if (allowed && !allowed.has(q.predicate.value)) continue;
        if (!includeLiterals && isLiteralTerm(q.object)) continue;
        out.push({ via:q.predicate.value, to:q.object.value, dir:'→' });
      }
      if (edgeMode === 'undirected'){
        // incoming as reverse
        for (const q of store.getQuads(null, null, namedNode(nodeIri), null)){
          if (allowed && !allowed.has(q.predicate.value)) continue;
          if (!includeLiterals && isLiteralTerm(q.subject)) continue; // should always be non-literal
          out.push({ via:q.predicate.value, to:q.subject.value, dir:'←' });
        }
      }
      return out;
    }

    function bfsShortest(store, start, goal, opt){
      const s = normalizeNodeInput(start);
      const g = normalizeNodeInput(goal);
      if (!s || !g) throw new Error('Start and goal are required.');

      if (s === g) return [];
      const Q = [{ node:s, path:[] }];
      const seen = new Set([s]);
      const maxDepth = Number(opt.maxDepth||8);

      while (Q.length){
        const cur = Q.shift();
        if (cur.path.length > maxDepth) continue;
        for (const step of neighbors(store, cur.node, opt)){
          if (seen.has(step.to)) continue;
          const path = cur.path.concat({ from:cur.node, via:step.via, to:step.to, dir:step.dir });
          if (step.to === g) return path;
          seen.add(step.to);
          Q.push({ node:step.to, path });
        }
      }
      return null;
    }

    function dfsAll(store, start, goal, opt){
      const s = normalizeNodeInput(start);
      const g = normalizeNodeInput(goal);
      const maxDepth = Number(opt.maxDepth||8);
      const maxPaths = Number(opt.maxPaths||50);
      const results = [];
      const stack = [{ node:s, path:[], seen:new Set([s]) }];

      while (stack.length && results.length < maxPaths){
        const cur = stack.pop();
        if (cur.node === g){ results.push(cur.path); continue; }
        if (cur.path.length >= maxDepth) continue;
        const nbrs = neighbors(store, cur.node, opt);
        // push in reverse for natural order on pop
        for (let i=nbrs.length-1; i>=0; i--){
          const step = nbrs[i];
          if (cur.seen.has(step.to)) continue;
          const nextSeen = new Set(cur.seen); nextSeen.add(step.to);
          stack.push({ node:step.to, path:cur.path.concat({ from:cur.node, via:step.via, to:step.to, dir:step.dir }), seen:nextSeen });
        }
      }
      return results;
    }

    function toSparql(path, start){
      if (!path || !path.length) return '';
      const lines = [];
      let cur = `<${normalizeNodeInput(start)}>`;
      for (let i=0; i<path.length; i++){
        const v = `?n${i+1}`;
        const p = `<${path[i].via}>`;
        const t = path[i].dir === '←' ? `${v} ${p} ${cur} .` : `${cur} ${p} ${v} .`;
        lines.push(t); cur = v;
      }
      return `SELECT ${path.map((_,i)=>`?n${i+1}`).join(' ')} WHERE {
  ${lines.join('  ')} }`;
    }

    // --- Allowed predicate calculation (DRY: reuse axiolotl-inference.js helpers) ---
    function computeAllowedPredicates(store, { mode='all', list=[], subpropRoots=[] }){
      if (mode === 'all') return null; // null ⇒ allow all
      if (mode === 'list') return new Set(list);

      // discover owl:ObjectProperty in data
      if (mode === 'objectProps'){
        const out = new Set();
        for (const q of store.getQuads(null, namedNode(NS.rdf.type), namedNode(NS.owl.ObjectProperty), null)){
          out.add(q.subject.value);
        }
        return out;
      }

      if (mode === 'subpropTree'){
        const edges = (typeof mapFromQuads === 'function')
          ? mapFromQuads(store, NS.rdfs.subPropertyOf)
          : (function fallback(){
              const M = new Map();
              for (const q of store.getQuads(null, namedNode(NS.rdfs.subPropertyOf), null, null)){
                const c = q.subject.value, p = q.object.value;
                if (!M.has(c)) M.set(c, new Set());
                if (!M.has(p)) M.set(p, new Set());
                M.get(c).add(p);
              }
              return M;
            })();
        const closure = (typeof transitiveClosure === 'function')
          ? transitiveClosure(edges)
          : (function fallbackTC(E){
              const C = new Map();
              for (const [child, parents] of E){
                const seen = new Set(); const st = [...parents];
                while (st.length){ const x = st.pop(); if (seen.has(x)) continue; seen.add(x); const up = E.get(x); if (up) up.forEach(u => st.push(u)); }
                C.set(child, seen);
              }
              return C;
            })(edges);
        const roots = new Set(subpropRoots);
        const allowed = new Set();
        for (const root of roots){
          allowed.add(root);
          for (const [p, supers] of closure){ if (supers.has(root)) allowed.add(p); }
        }
        return allowed;
      }
      return null;
    }

    async function loadStore(){
      return await loadGraphFromIndexedDB();
    }

    // Public API
    window.PathFinder = {
      loadStore,
      computeAllowedPredicates,
      shortestPath: bfsShortest,
      allPaths: dfsAll,
      toSparql,
    };
  })();

  // --- Example minimal wiring (keep or remove):
  // document.getElementById('btnShortest')?.addEventListener('click', async () => {
  //   const store = await PathFinder.loadStore();
  //   const opt = {
  //     edgeMode: document.getElementById('edgeMode')?.value || 'directed',
  //     includeLiterals: (document.getElementById('includeLiterals')?.value||'no') === 'yes',
  //     maxDepth: Number(document.getElementById('maxDepth')?.value||8),
  //   };
  //   const mode = document.getElementById('predMode')?.value || 'all';
  //   const list = (document.getElementById('predList')?.value||'').split(/?/).filter(Boolean);
  //   const roots = (document.getElementById('subpropRoots')?.value||'').split(/?/).filter(Boolean);
  //   opt.allowed = PathFinder.computeAllowedPredicates(store, { mode, list, subpropRoots: roots });
  //   const path = PathFinder.shortestPath(store, document.getElementById('start').value, document.getElementById('goal').value, opt);
  //   document.getElementById('sparql').value = PathFinder.toSparql(path, document.getElementById('start').value);
  // });
