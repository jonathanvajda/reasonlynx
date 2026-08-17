/* vocab-extract-core.js
 * Append-only: no edits to existing files.
 * Purpose:
 *  - read CQ graph from IndexedDB (CQDatabase/CQStore)
 *  - extract vocabulary terms/phrases using POSTagger + Lexicon
 *  - ignore filler words; keep conjunctions only in “name-like” phrases
 *  - deduplicate
 *  - persist vocabulary nodes as JSON-LD in the same store
 *
 * Exposes: window.VOCAB_EXTRACT
 */
import { COMMON_NAMESPACE_IRIS } from '../packages/namespace-registry/src/index.js';
import { isAbsoluteIri } from '../packages/ontology-utils/src/index.js';
import { serializeDelimitedRows } from '../packages/tabular-io/src/index.js';
import {
  deleteCompetencyQuestionNodesByIds,
  readCompetencyQuestionNodes,
  storeCompetencyQuestionNodes
} from './cq-ferret-indexeddb-store.js';

(() => {
  "use strict";

  // ---------------------------
  // Configuration (overrideable)
  // ---------------------------
  const CFG = {
    dbName: "CQDatabase",
    storeName: "CQStore",
    dbVersion: 1,





    // Custom props for “element type” + “is a” columns (kept separate from @type)
    VOCAB_ELEMENT_TYPE: "https://jonathanvajda.com/ontology/vocabElementType",
    VOCAB_IS_A: "https://jonathanvajda.com/ontology/vocabIsA",

    // Default for rdfs:isDefinedBy
    defaultIsDefinedByFromDb(dbName) {
      return `https://example.org/ontology/${encodeURIComponent(dbName)}`;
    },

    // “Name-like” connectors we can keep inside a phrase
    allowedConnectors: new Set(["and", "or", "&", "of", "for"]),
  };

  // ---------------------------
  // Small utilities
  // ---------------------------
  function isAnyUri(s) {
    return isAbsoluteIri(s, { allowedSchemes: null });
  }

  function isCapitalizedToken(tok) {
    if (!tok || typeof tok.word !== "string") return false;
    return /^[A-Z]/.test(tok.word);
  }

  function hasType(node, iri) {
    const t = node?.["@type"];
    if (Array.isArray(t)) return t.includes(iri);
    if (typeof t === "string") return t === iri;
    return false;
  }

  function getTextValues(node) {
    const out = [];
    for (const p of [
      COMMON_NAMESPACE_IRIS.cco2.hasTextValue, // project convention: use CCO text value while ignoring its narrow domain axiom
      COMMON_NAMESPACE_IRIS.rdfs.label,
      COMMON_NAMESPACE_IRIS.dcterms.description,
      COMMON_NAMESPACE_IRIS.rdfs.comment
    ]) {
      const arr = node?.[p];
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        const v = item?.["@value"];
        if (typeof v === "string" && v.trim()) out.push(v.trim());
      }
    }
    return out;
  }

  function looksLikeVocabularyNode(node) {
    const id = node?.["@id"] || "";
    // Strong match: our vocabulary node IDs
    if (typeof id === "string" && id.startsWith(`${COMMON_NAMESPACE_IRIS.bfo.genericallyDependentContinuant}_`)) return true;

    // Also treat nodes with ABOUT_LINK_IRI + rdfs:label as vocab-ish
    if (node?.[COMMON_NAMESPACE_IRIS.bfo.continuantPartOf] && node?.[COMMON_NAMESPACE_IRIS.rdfs.label]) return true;

    // Or nodes typed as the GDC type IRI
    if (hasType(node, COMMON_NAMESPACE_IRIS.bfo.genericallyDependentContinuant)) return true;

    return false;
  }

  // ---------------------------
  // Phrase extraction (improved chunking)
  // ---------------------------
  class VocabExtractorService {
    constructor(tagger, options = {}) {
      if (!tagger) throw new Error("VocabExtractorService requires a POSTagger instance.");
      this.tagger = tagger;
      this.lemmatizer = new Lemmatizer();
      this.cfg = { ...CFG, ...options };
    }

    hashCode(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        hash = (hash << 5) - hash + c;
        hash |= 0;
      }
      return Math.abs(hash);
    }

    // Keep DT/articles out, keep conjunctions only when “name-like”
    extractPhrases(taggedWords) {
      const phrases = [];
      let current = [];

      const isDet = (t) => t?.tag === "DT";
      const isPunct = (t) => t && (t.tag === "." || t.tag === "," || t.tag === ":" || t.tag === "PRN" || t.word === ";" || t.word === "(" || t.word === ")");
      const isContent = (t) => {
        if (!t?.tag) return false;
        // Nouns + adjectives are “phrase material”
        if (t.tag.startsWith("NN")) return true;
        if (t.tag.startsWith("JJ")) return true;
        // Numbers can be part of names (e.g., “U-2”), but keep them conservative:
        if (t.tag === "CD") return true;
        return false;
      };
      const isConnector = (t) => {
        const w = (t?.word || "").toLowerCase();
        return this.cfg.allowedConnectors.has(w) && (t.tag === "CC" || t.tag === "IN");
      };

      const finalize = () => {
        if (!current.length) return;

        // Trim leading determiners just in case
        while (current.length && isDet(current[0])) current.shift();

        // Must include at least one noun
        const hasNoun = current.some((t) => t.tag && t.tag.startsWith("NN"));
        if (!hasNoun) {
          current = [];
          return;
        }

        // Drop trailing connectors
        while (current.length && isConnector(current[current.length - 1])) current.pop();

        const text = current.map((t) => t.word).join(" ").trim();
        if (!text) {
          current = [];
          return;
        }

        phrases.push({
          originalText: text,
          taggedWords: current.slice(),
        });

        current = [];
      };

      for (let i = 0; i < taggedWords.length; i++) {
        const tok = taggedWords[i];

        if (isPunct(tok)) {
          finalize();
          continue;
        }

        // Ignore standalone determiners unless we're already building a phrase
        if (isDet(tok) && current.length === 0) continue;

        if (isContent(tok)) {
          current.push(tok);
          continue;
        }

        if (isConnector(tok)) {
          // Only keep “and/or/&” inside a phrase if it looks like a proper name connector:
          //   NP (caps/NNP) + and + NP (caps/NNP)
          // And keep “of” similarly if adjacent tokens are “name-like”.
          const prev = current.length ? current[current.length - 1] : null;
          const next = i + 1 < taggedWords.length ? taggedWords[i + 1] : null;

          const prevNameLike = !!prev && (prev.tag?.startsWith("NNP") || isCapitalizedToken(prev));
          const nextNameLike = !!next && (next.tag?.startsWith("NNP") || isCapitalizedToken(next));

          const w = (tok.word || "").toLowerCase();
          const allowAndOr = (w === "and" || w === "or" || w === "&") ? (prevNameLike && nextNameLike) : true;
          const allowOfFor = (w === "of" || w === "for") ? (prevNameLike || nextNameLike) : true;

          if (current.length && next && isContent(next) && allowAndOr && allowOfFor) {
            current.push(tok);
            continue;
          }

          // Otherwise connector breaks phrase
          finalize();
          continue;
        }

        // Other tags: break phrase
        finalize();
      }

      finalize();
      return phrases;
    }

    processGraph(sourceGraph) {
      const chunkMap = new Map();

      for (const node of sourceGraph) {
        if (hasType(node, COMMON_NAMESPACE_IRIS.cco2.person)) continue;

        const sourceNodeIri = node["@id"];
        if (!sourceNodeIri) continue;

        const texts = getTextValues(node);
        for (const text of texts) {
          const tagged = this.tagger.tagSentence(text);
          const phrases = this.extractPhrases(tagged);

          for (const ph of phrases) {
            const conceptText = ph.originalText.trim();
            if (!conceptText) continue;

            // Dedup key: lemmatize last word + lower
            const lemmatized = this.lemmatizer.lemmatize(conceptText);
            const key = lemmatized.toLowerCase();

            if (chunkMap.has(key)) {
              const existing = chunkMap.get(key);
              const about = existing[COMMON_NAMESPACE_IRIS.bfo.continuantPartOf] || [];
              if (!about.some((x) => x?.["@id"] === sourceNodeIri)) {
                about.push({ "@id": sourceNodeIri });
                existing[COMMON_NAMESPACE_IRIS.bfo.continuantPartOf] = about;
              }
            } else {
              const gdcId = this.hashCode(key);
              const newNode = {
                "@id": `${COMMON_NAMESPACE_IRIS.bfo.genericallyDependentContinuant}_${gdcId}`,
                "@type": [COMMON_NAMESPACE_IRIS.bfo.genericallyDependentContinuant],
                [COMMON_NAMESPACE_IRIS.rdfs.label]: [{ "@value": lemmatized }],
                [COMMON_NAMESPACE_IRIS.bfo.continuantPartOf]: [{ "@id": sourceNodeIri }],
              };
              chunkMap.set(key, newNode);
            }
          }
        }
      }

      return Array.from(chunkMap.values());
    }
  }

  // ---------------------------
  // Table row mapping + persistence
  // ---------------------------
  function nodeToRow(node, dbName) {
    const iri = node["@id"] || "";
    const label = node?.[COMMON_NAMESPACE_IRIS.rdfs.label]?.[0]?.["@value"] ?? "";

    const elementType = node?.[CFG.VOCAB_ELEMENT_TYPE]?.[0]?.["@id"] ?? "";
    const definition = node?.[COMMON_NAMESPACE_IRIS.skos.definition]?.[0]?.["@value"] ?? "";
    const isA = node?.[CFG.VOCAB_IS_A]?.[0]?.["@value"] ?? "";
    const isDefinedBy = node?.[COMMON_NAMESPACE_IRIS.rdfs.isDefinedBy]?.[0]?.["@id"] ?? CFG.defaultIsDefinedByFromDb(dbName);

    return { iri, label, elementType, definition, isA, isDefinedBy };
  }

  function applyRowToNode(row, baseNode, dbName) {
    const node = { ...(baseNode || {}) };

    // IRI is the primary key; we do not change @id by default
    node["@id"] = node["@id"] || row.iri;

    // Keep existing @type and ensure it stays an array
    const types = Array.isArray(node["@type"]) ? node["@type"].slice() : (node["@type"] ? [node["@type"]] : []);
    if (!types.includes(COMMON_NAMESPACE_IRIS.bfo.genericallyDependentContinuant)) {
      types.push(COMMON_NAMESPACE_IRIS.bfo.genericallyDependentContinuant);
    }
    node["@type"] = types;

    // rdfs:label
    node[COMMON_NAMESPACE_IRIS.rdfs.label] = [{ "@value": row.label || "" }];

    // element type (OWL-ish) stored separately
    if (row.elementType) node[CFG.VOCAB_ELEMENT_TYPE] = [{ "@id": row.elementType }];
    else delete node[CFG.VOCAB_ELEMENT_TYPE];

    // definition (skos:definition)
    if (row.definition) node[COMMON_NAMESPACE_IRIS.skos.definition] = [{ "@value": row.definition }];
    else delete node[COMMON_NAMESPACE_IRIS.skos.definition];

    // is a (string)
    if (row.isA) node[CFG.VOCAB_IS_A] = [{ "@value": row.isA, "@type": COMMON_NAMESPACE_IRIS.xsd.string }];
    else delete node[CFG.VOCAB_IS_A];

    // isDefinedBy (IRI)
    const defBy = row.isDefinedBy || CFG.defaultIsDefinedByFromDb(dbName);
    node[COMMON_NAMESPACE_IRIS.rdfs.isDefinedBy] = [{ "@id": defBy }];

    return node;
  }

  // ---------------------------
  // Public operations
  // ---------------------------
  async function rebuildVocabularyInDb({
    dbName = CFG.dbName,
    storeName = CFG.storeName,
    tagger = null,
  } = {}) {
    if (!tagger) throw new Error("rebuildVocabularyInDb requires a POSTagger instance.");

    const allNodes = await readCompetencyQuestionNodes();

    // Build vocab from NON-vocab nodes to avoid self-feeding.
    const nonVocab = allNodes.filter((n) => !looksLikeVocabularyNode(n));
    const extractor = new VocabExtractorService(tagger);
    const vocabNodes = extractor.processGraph(nonVocab);

    // Delete old vocab keys
    const keysToDelete = allNodes
      .filter((n) => looksLikeVocabularyNode(n))
      .map((n) => (n["@id"] || n.id))
      .filter(Boolean);

    await deleteCompetencyQuestionNodesByIds(keysToDelete);
    await storeCompetencyQuestionNodes(vocabNodes);

    return { vocabCount: vocabNodes.length };
  }

  async function loadVocabularyRows({
    dbName = CFG.dbName,
    storeName = CFG.storeName,
    autoRebuild = true,
  } = {}) {
    const allNodes = await readCompetencyQuestionNodes();

    let vocabNodes = allNodes.filter((n) => looksLikeVocabularyNode(n));

    // Auto-rebuild on load so conjunction-in-names works consistently
    if (autoRebuild) {
      const tagger = new POSTagger(window.POSTAGGER_LEXICON);
      await rebuildVocabularyInDb({ dbName, storeName, tagger });
      const refreshed = await readCompetencyQuestionNodes();
      vocabNodes = refreshed.filter((n) => looksLikeVocabularyNode(n));
    }

    const nodesById = new Map();
    for (const n of vocabNodes) {
      const id = n["@id"] || n.id;
      if (id) nodesById.set(id, n);
    }

    const rows = vocabNodes
      .map((n) => nodeToRow(n, dbName))
      .filter((r) => r.iri && r.label);

    return { dbName, storeName, rows, nodesById };
  }

  async function saveRow(row, { dbName = CFG.dbName, storeName = CFG.storeName, nodesById } = {}) {
    if (!row?.iri) throw new Error("Row is missing iri.");

    // Validate isDefinedBy if present
    if (row.isDefinedBy && !isAnyUri(row.isDefinedBy)) {
      throw new Error(`is defined by must be a valid absolute IRI: ${row.isDefinedBy}`);
    }

    const base = nodesById?.get(row.iri) || {
      "@id": row.iri,
      "@type": [COMMON_NAMESPACE_IRIS.bfo.genericallyDependentContinuant]
    };
    const updated = applyRowToNode(row, base, dbName);

    await storeCompetencyQuestionNodes([updated]);
    if (nodesById) nodesById.set(row.iri, updated);
  }

  function exportRowsToCsv(rows) {
    const headers = ["iri", "label", "element type", "definition", "is a", "is defined by"];
    return serializeDelimitedRows([
      headers,
      ...rows.map((r) => [
        r.iri,
        r.label,
        r.elementType,
        r.definition,
        r.isA,
        r.isDefinedBy,
      ]),
    ], {
      delimiter: ",",
      newline: "\n",
      trailingNewline: false,
    });
  }

  // ---------------------------
  // Expose
  // ---------------------------
  window.VOCAB_EXTRACT = {
    CFG,
    loadVocabularyRows,
    rebuildVocabularyInDb,
    saveRow,
    exportRowsToCsv,
    isAnyUri,
  };
})();
