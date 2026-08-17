/* extracted-vocabulary-tabulator.js
 * Requires:
 *  - vendor/tabulator.min.js + Tabulator CSS loaded
 *  - vocab-extract-core.js loaded (window.VOCAB_EXTRACT)
 *  - lexicon.js + POSTaggerGraph.js (for rebuild)
 */
import { COMMON_NAMESPACE_IRIS } from '../packages/namespace-registry/src/index.js';
import { renderStatusMessage } from '../packages/ui-feedback/src/index.js';

(() => {
  "use strict";

  const OWL_TYPES = [
    { label: "Class", iri: COMMON_NAMESPACE_IRIS.owl.Class },
    { label: "NamedIndividual", iri: COMMON_NAMESPACE_IRIS.owl.NamedIndividual },
    { label: "ObjectProperty", iri: COMMON_NAMESPACE_IRIS.owl.ObjectProperty },
    { label: "DatatypeProperty", iri: COMMON_NAMESPACE_IRIS.owl.DatatypeProperty },
    { label: "AnnotationProperty", iri: COMMON_NAMESPACE_IRIS.owl.AnnotationProperty },
  ];

  const DEFAULT_TYPE_LABEL = "Class";

  const LABEL_TO_IRI = new Map(OWL_TYPES.map((t) => [t.label, t.iri]));
  const IRI_TO_LABEL = new Map(OWL_TYPES.map((t) => [t.iri, t.label]));
  const TYPE_LABELS = OWL_TYPES.map((t) => t.label);

  let state = {
    dbName: "CQDatabase",
    storeName: "CQStore",
    rows: [],
    nodesById: new Map(),
    table: null,
  };

  function setStatus(msg) {
    const el = document.getElementById("status");
    renderStatusMessage(el, { message: msg, severity: 'info' }, { classPrefix: 'ont-status' });
  }

  function normalizeTypeToLabel(v) {
    const s = String(v ?? "").trim();
    if (!s) return DEFAULT_TYPE_LABEL;
    if (IRI_TO_LABEL.has(s)) return IRI_TO_LABEL.get(s);
    if (LABEL_TO_IRI.has(s)) return s;
    return DEFAULT_TYPE_LABEL;
  }

  function rowForSave(row) {
    // UI stores label in row.elementType; DB stores IRI
    const label = normalizeTypeToLabel(row.elementType);
    const iri = LABEL_TO_IRI.get(label) || LABEL_TO_IRI.get(DEFAULT_TYPE_LABEL);

    return { ...row, elementType: iri };
  }

  async function saveRow(row) {
    try {
      setStatus("Saving…");
      await window.VOCAB_EXTRACT.saveRow(rowForSave(row), {
        dbName: state.dbName,
        storeName: state.storeName,
        nodesById: state.nodesById,
      });
      setStatus(`Saved (${new Date().toLocaleTimeString()})`);
    } catch (e) {
      console.error(e);
      setStatus(`Save failed: ${e.message || e}`);
    }
  }

  function buildTable(rows) {
    if (!window.Tabulator) {
      throw new Error("Tabulator is not loaded (missing tabulator.min.js).");
    }

    // If re-init, destroy old instance
    if (state.table) {
      state.table.destroy();
      state.table = null;
    }

    state.table = new window.Tabulator("#vocabGrid", {
      data: rows,
      reactiveData: true,
      layout: "fitColumns",
      height: "70vh",

      columns: [
        {
          title: "iri",
          field: "iri",
          headerFilter: "input",
          editor: false,
        },
        {
          title: "label",
          field: "label",
          headerFilter: "input",
          editor: "input",
        },
        {
          // IMPORTANT: title matches your desired CSV header
          title: "element type",
          field: "elementType",
          headerFilter: "input",
          editor: "list",
          editorParams: {
            values: TYPE_LABELS,
            clearable: false,
          },
        },
        {
          title: "definition",
          field: "definition",
          headerFilter: "input",
          editor: "textarea",
        },
        {
          title: "is a",
          field: "isA",
          headerFilter: "input",
          editor: "input",
        },
        {
          title: "is defined by",
          field: "isDefinedBy",
          headerFilter: "input",
          editor: "input",
          validator: (cell, value) => {
            // allow blank -> core will set default
            if (!value) return true;
            return window.VOCAB_EXTRACT.isAnyUri(value) || "Must be a valid absolute IRI";
          },
        },
      ],
    });

    // Save back to DB after edits
    state.table.on("cellEdited", (cell) => {
      const row = cell.getRow().getData();
      // Ensure default is never blank
      row.elementType = normalizeTypeToLabel(row.elementType);
      saveRow(row);
    });

    // Update count display on render/filter
    const updateCount = async () => {
      const el = document.getElementById("count");
      if (!el) return;
      const visible = await state.table.getDataCount("active"); // filtered set
      el.textContent = `${visible} terms`;
    };

    state.table.on("dataFiltered", updateCount);
    state.table.on("dataSorted", updateCount);
    state.table.on("dataLoaded", updateCount);
    updateCount();
  }

  function wireButtons() {
    document.getElementById("btnExportCsv")?.addEventListener("click", () => {
      // Tabulator downloads current visible data respecting filters/sort :contentReference[oaicite:4]{index=4}
      const name = `Extracted_Vocabulary_${new Date().toISOString().slice(0, 10)}.csv`;
      state.table.download("csv", name, { bom: true });
    });

    document.getElementById("btnRebuild")?.addEventListener("click", async () => {
      try {
        setStatus("Rebuilding vocabulary…");
        const tagger = new POSTagger(window.POSTAGGER_LEXICON);
        const res = await window.VOCAB_EXTRACT.rebuildVocabularyInDb({
          dbName: state.dbName,
          storeName: state.storeName,
          tagger,
        });

        setStatus(`Rebuilt (${res.vocabCount} terms). Reloading…`);

        const loaded = await window.VOCAB_EXTRACT.loadVocabularyRows({
          dbName: state.dbName,
          storeName: state.storeName,
          autoRebuild: false,
        });

        state.rows = loaded.rows.map((r) => ({ ...r, elementType: normalizeTypeToLabel(r.elementType) }));
        state.nodesById = loaded.nodesById;

        buildTable(state.rows);
        setStatus(`Ready (${new Date().toLocaleTimeString()})`);
      } catch (e) {
        console.error(e);
        setStatus(`Rebuild failed: ${e.message || e}`);
      }
    });
  }

  async function init() {
    setStatus("Loading…");

    const loaded = await window.VOCAB_EXTRACT.loadVocabularyRows({
      dbName: state.dbName,
      storeName: state.storeName,
      autoRebuild: true,
    });

    state.dbName = loaded.dbName;
    state.storeName = loaded.storeName;
    state.nodesById = loaded.nodesById;

    // Convert stored IRIs -> UI labels, and enforce default "Class"
    state.rows = loaded.rows.map((r) => ({
      ...r,
      elementType: normalizeTypeToLabel(r.elementType),
    }));

    wireButtons();
    buildTable(state.rows);

    setStatus(`Ready (${new Date().toLocaleTimeString()})`);
  }

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((e) => {
      console.error(e);
      setStatus(`Load failed: ${e.message || e}`);
    });
  });
})();
