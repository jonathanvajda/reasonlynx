const XSD_STRING = 'http://www.w3.org/2001/XMLSchema#string';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OWL_RESTRICTION = 'http://www.w3.org/2002/07/owl#Restriction';
const OWL_ON_PROPERTY = 'http://www.w3.org/2002/07/owl#onProperty';
const RESTRICTION_FACETS = new Set([
  'http://www.w3.org/2002/07/owl#cardinality', 'http://www.w3.org/2002/07/owl#minCardinality',
  'http://www.w3.org/2002/07/owl#maxCardinality', 'http://www.w3.org/2002/07/owl#qualifiedCardinality',
  'http://www.w3.org/2002/07/owl#minQualifiedCardinality', 'http://www.w3.org/2002/07/owl#maxQualifiedCardinality',
  'http://www.w3.org/2002/07/owl#someValuesFrom', 'http://www.w3.org/2002/07/owl#allValuesFrom',
  'http://www.w3.org/2002/07/owl#hasValue'
]);

export function termToDisplay(term) {
  if (term.displayValue) return term.displayValue;
  if (term.termType === 'NamedNode') return term.value;
  if (term.termType === 'BlankNode') return `_:${term.value}`;
  if (term.termType === 'Literal') {
    const escaped = escapeLiteral(term.value);
    if (term.language) return `"${escaped}"@${term.language}`;
    const datatype = term.datatype?.value || XSD_STRING;
    return datatype === XSD_STRING ? `"${escaped}"` : `"${escaped}"^^<${datatype}>`;
  }
  return String(term.value ?? '');
}

export function tripleKey(triple) {
  return [triple.subject, triple.predicate, triple.object].map(termKey).join('\u0001');
}

export function compareTriples(leftQuads, rightQuads) {
  const left = uniqueTriples(leftQuads);
  const right = uniqueTriples(rightQuads);
  const comparedLeft = [...left.filter(hasNoBlankNode), ...projectOwlRestrictions(left)];
  const comparedRight = [...right.filter(hasNoBlankNode), ...projectOwlRestrictions(right)];
  const leftMap = new Map(comparedLeft.map((triple) => [tripleKey(triple), triple]));
  const rightMap = new Map(comparedRight.map((triple) => [tripleKey(triple), triple]));
  const unchanged = comparedLeft.filter((triple) => rightMap.has(tripleKey(triple)));
  let removed = comparedLeft.filter((triple) => !rightMap.has(tripleKey(triple)));
  let added = comparedRight.filter((triple) => !leftMap.has(tripleKey(triple)));
  const modifications = detectModifications(removed, added);
  const modifiedRemoved = new Set(modifications.map((item) => tripleKey(item.before)));
  const modifiedAdded = new Set(modifications.map((item) => tripleKey(item.after)));
  removed = removed.filter((triple) => !modifiedRemoved.has(tripleKey(triple)));
  added = added.filter((triple) => !modifiedAdded.has(tripleKey(triple)));

  return {
    left, right, unchanged, removed, added, modifications,
    ignoredBlankNodeTriples: {
      left: left.filter((item) => !hasNoBlankNode(item)).length,
      right: right.filter((item) => !hasNoBlankNode(item)).length
    }
  };
}

function hasNoBlankNode(triple) {
  return triple.subject.termType !== 'BlankNode' && triple.object.termType !== 'BlankNode';
}

function projectOwlRestrictions(triples) {
  const bySubject = groupBy(triples, (item) => termKey(item.subject));
  const projected = [];
  for (const [blankKey, details] of bySubject) {
    if (!blankKey.startsWith('BlankNode:')) continue;
    const isRestriction = details.some((item) => item.predicate.value === RDF_TYPE && item.object.termType === 'NamedNode' && item.object.value === OWL_RESTRICTION);
    const onProperty = details.find((item) => item.predicate.value === OWL_ON_PROPERTY && item.object.termType === 'NamedNode');
    if (!isRestriction || !onProperty) continue;
    const anchors = triples.filter((item) => item.subject.termType === 'NamedNode' && termKey(item.object) === blankKey);
    for (const anchor of anchors) {
      for (const facet of details.filter((item) => RESTRICTION_FACETS.has(item.predicate.value) && item.object.termType !== 'BlankNode')) {
        const facetName = compactOwlName(facet.predicate.value);
        projected.push({
          subject: anchor.subject,
          predicate: {
            termType: 'NamedNode',
            value: `urn:ontology-diff:restriction:${encodeURIComponent(anchor.predicate.value)}:${encodeURIComponent(onProperty.object.value)}:${facetName}`,
            displayValue: `${termToDisplay(anchor.predicate)} → owl:Restriction(${termToDisplay(onProperty.object)}) → owl:${facetName}`
          },
          object: facet.object,
          sourceTriples: [anchor, ...details]
        });
      }
    }
  }
  return projected;
}

function compactOwlName(iri) {
  return iri.slice(iri.lastIndexOf('#') + 1);
}

function uniqueSourceTriples(items) {
  const map = new Map();
  for (const item of items) {
    for (const source of item.sourceTriples || [item]) map.set(tripleKey(source), source);
  }
  return [...map.values()];
}

export function createCombinedRows(diff) {
  const rows = [
    ...diff.removed.map((triple) => rowFromTriple(triple, 'removed')),
    ...diff.added.map((triple) => rowFromTriple(triple, 'added')),
    ...diff.modifications.map(({ before, after }) => ({
      status: 'modified',
      subject: termToDisplay(after.subject),
      predicate: termToDisplay(after.predicate),
      object: termToDisplay(after.object),
      previousSubject: termToDisplay(before.subject),
      previousPredicate: termToDisplay(before.predicate),
      previousObject: termToDisplay(before.object)
    }))
  ];
  return rows.sort(compareRows);
}

export function createSideRows(triples) {
  return triples.map((triple) => rowFromTriple(triple, '')).sort(compareRows);
}

export function createSparqlUpdate(diff) {
  const rawRemoved = uniqueSourceTriples([...diff.removed, ...diff.modifications.map((item) => item.before)]);
  const rawAdded = uniqueSourceTriples([...diff.added, ...diff.modifications.map((item) => item.after)]);
  const hasRemovedBlankNodes = rawRemoved.some(hasBlankNode);
  const sections = [
    '# Ontology Delta: apply to LEFT to reproduce RIGHT',
    ...(hasRemovedBlankNodes ? ['# Note: blank nodes in DELETE patterns are represented by variables. Review broad matches before applying.'] : [])
  ];
  if (rawRemoved.length) {
    const variables = new Map();
    const patterns = rawRemoved.map((triple) => `  ${tripleToSparql(triple, variables)}`).join('\n');
    sections.push(`DELETE {\n${patterns}\n}\nWHERE {\n${patterns}\n};`);
  }
  if (rawAdded.length) {
    const triples = rawAdded.map((triple) => `  ${tripleToSparql(triple)}`).join('\n');
    sections.push(`INSERT DATA {\n${triples}\n};`);
  }
  if (!rawRemoved.length && !rawAdded.length) sections.push('# No changes.');
  return `${sections.join('\n\n')}\n`;
}

function hasBlankNode(triple) {
  return triple.subject.termType === 'BlankNode' || triple.object.termType === 'BlankNode';
}

function uniqueTriples(quads) {
  const map = new Map();
  for (const quad of quads || []) {
    if (quad.graph?.termType && quad.graph.termType !== 'DefaultGraph') {
      throw new TypeError('Named graphs are not supported. Please provide triples in the default graph.');
    }
    const triple = { subject: quad.subject, predicate: quad.predicate, object: quad.object };
    map.set(tripleKey(triple), triple);
  }
  return [...map.values()].sort((a, b) => tripleKey(a).localeCompare(tripleKey(b)));
}

function detectModifications(removed, added) {
  const output = [];
  const usedRemoved = new Set();
  const usedAdded = new Set();
  const pair = (before, after, reason) => {
    usedRemoved.add(tripleKey(before));
    usedAdded.add(tripleKey(after));
    output.push({ before, after, reason });
  };

  // A renamed named subject is high-confidence only when its complete, multi-triple
  // description occurs exactly once on each side.
  const oldSubjects = subjectDescriptions(removed);
  const newSubjects = subjectDescriptions(added);
  for (const [signature, oldGroups] of groupDescriptionsBySignature(oldSubjects)) {
    const newGroups = groupDescriptionsBySignature(newSubjects).get(signature) || [];
    if (oldGroups.length !== 1 || newGroups.length !== 1 || oldGroups[0].triples.length < 2) continue;
    const oldGroup = oldGroups[0];
    const newGroup = newGroups[0];
    if (termKey(oldGroup.subject) === termKey(newGroup.subject)) continue;
    for (const before of oldGroup.triples) {
      const after = newGroup.triples.find((item) => termKey(item.predicate) === termKey(before.predicate) && termKey(item.object) === termKey(before.object));
      if (after) pair(before, after, 'subject changed');
    }
  }

  // Same subject + predicate: preserve the useful datatype/language heuristic,
  // then accept any object-term change when only one pairing remains.
  const oldBySP = groupBy(remaining(removed, usedRemoved), (item) => `${termKey(item.subject)}\u0001${termKey(item.predicate)}`);
  const newBySP = groupBy(remaining(added, usedAdded), (item) => `${termKey(item.subject)}\u0001${termKey(item.predicate)}`);
  for (const [key, oldValues] of oldBySP) {
    const newValues = newBySP.get(key) || [];
    for (const before of oldValues) {
      if (before.object.termType !== 'Literal') continue;
      const candidates = newValues.filter((after) => !usedAdded.has(tripleKey(after)) && after.object.termType === 'Literal' && after.object.value === before.object.value);
      if (candidates.length === 1) pair(before, candidates[0], 'literal annotation changed');
    }
    const oldRest = oldValues.filter((item) => !usedRemoved.has(tripleKey(item)));
    const newRest = newValues.filter((item) => !usedAdded.has(tripleKey(item)));
    if (oldRest.length === 1 && newRest.length === 1) pair(oldRest[0], newRest[0], 'object changed');
  }

  // Same subject + object with one unambiguous pairing means the predicate changed.
  const oldBySO = groupBy(remaining(removed, usedRemoved), (item) => `${termKey(item.subject)}\u0001${termKey(item.object)}`);
  const newBySO = groupBy(remaining(added, usedAdded), (item) => `${termKey(item.subject)}\u0001${termKey(item.object)}`);
  for (const [key, oldValues] of oldBySO) {
    const newValues = newBySO.get(key) || [];
    if (oldValues.length === 1 && newValues.length === 1) pair(oldValues[0], newValues[0], 'predicate changed');
  }
  return output.sort((a, b) => tripleKey(a.after).localeCompare(tripleKey(b.after)));
}

function groupBy(triples, keyFunction) {
  const groups = new Map();
  for (const triple of triples) {
    const key = keyFunction(triple);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(triple);
  }
  return groups;
}

function remaining(triples, used) {
  return triples.filter((item) => !used.has(tripleKey(item)));
}

function subjectDescriptions(triples) {
  const groups = groupBy(triples.filter((item) => item.subject.termType === 'NamedNode'), (item) => termKey(item.subject));
  return [...groups.values()].map((items) => ({
    subject: items[0].subject,
    triples: items,
    signature: items.map((item) => `${termKey(item.predicate)}\u0001${termKey(item.object)}`).sort().join('\u0002')
  }));
}

function groupDescriptionsBySignature(descriptions) {
  const groups = new Map();
  for (const description of descriptions) {
    if (!groups.has(description.signature)) groups.set(description.signature, []);
    groups.get(description.signature).push(description);
  }
  return groups;
}

function rowFromTriple(triple, status) {
  return {
    status,
    subject: termToDisplay(triple.subject),
    predicate: termToDisplay(triple.predicate),
    object: termToDisplay(triple.object),
    previousSubject: '',
    previousPredicate: '',
    previousObject: ''
  };
}

function compareRows(a, b) {
  return a.subject.localeCompare(b.subject, undefined, { numeric: true })
    || a.predicate.localeCompare(b.predicate, undefined, { numeric: true })
    || a.object.localeCompare(b.object, undefined, { numeric: true });
}

function termKey(term) {
  if (term.termType === 'Literal') return `Literal:${term.value}:${term.language || ''}:${term.datatype?.value || XSD_STRING}`;
  return `${term.termType}:${term.value}`;
}

function tripleToSparql(triple, blankVariables = null) {
  return `${termToSparql(triple.subject, blankVariables)} ${termToSparql(triple.predicate, blankVariables)} ${termToSparql(triple.object, blankVariables)} .`;
}

function termToSparql(term, blankVariables) {
  if (term.termType === 'NamedNode') return `<${term.value.replaceAll('>', '\\>')}>`;
  if (term.termType === 'BlankNode') {
    if (!blankVariables) return `_:${safeLabel(term.value)}`;
    if (!blankVariables.has(term.value)) blankVariables.set(term.value, `?b${blankVariables.size + 1}`);
    return blankVariables.get(term.value);
  }
  return termToDisplay(term);
}

function safeLabel(value) {
  return String(value).replace(/[^A-Za-z0-9_]/g, '_') || 'b';
}

function escapeLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}
