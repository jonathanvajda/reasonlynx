/**
 * @file ui_app.js
 * @description DOM handlers: parse → build model → render.
 */

import { DEFAULT_QUERY } from "./constants.js";
import { logEvent, logError } from "./log.js";
import {
  buildSparqlGraphModelFromAst,
  parseSparqlQueryToAst
} from "../../packages/sparql-utils/src/index.js";
import {
  createCytoscapeLayoutOptions,
  createDefaultCytoscapeStylesheet,
  projectGraphStateToCytoscapeElements,
  projectSparqlGraphModelToGraphState
} from "../../packages/cytoscape-visualization/src/index.js";
import { showToast } from "./ui_toast.js";

/**
 * Render the prefix legend.
 * @param {Record<string,string>} prefixes
 * @param {boolean} isEnabled
 */
function renderPrefixLegend(prefixes, isEnabled) {
  const el = document.getElementById("svizPrefixes");
  if (!el) return;

  el.innerHTML = "";
  if (!isEnabled) return;

  const entries = Object.entries(prefixes || {}).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    el.textContent = "No PREFIX declarations found.";
    return;
  }

  for (const [k, v] of entries) {
    const row = document.createElement("div");
    row.className = "sviz-prefix-item";

    const key = document.createElement("div");
    key.className = "sviz-prefix-key";
    key.textContent = k === "" ? ":" : `${k}:`;

    const val = document.createElement("div");
    val.className = "sviz-prefix-val";
    val.textContent = v;

    row.appendChild(key);
    row.appendChild(val);
    el.appendChild(row);
  }
}

/**
 * Render the Cytoscape diagram.
 * @param {any} graphModel
 */
function renderDiagram(graphModel) {
  const container = document.getElementById("svizDiagram");
  if (!container) return;

  if (!window.cytoscape) {
    showToast("Cytoscape not found. Did you load app/shared/vendor/cytoscape.min.js?", "error");
    return;
  }

  // Rebuild from scratch (simple, deterministic downstream DOM)
  container.innerHTML = "";

  const graphState = projectSparqlGraphModelToGraphState(graphModel, {
    ui: {
      activeFilters: {
        hideBlankNodes: false,
        hideAxiomSupportNodes: false
      }
    }
  });

  const cy = window.cytoscape({
    container,
    elements: projectGraphStateToCytoscapeElements(graphState, {
      hideBlankNodes: false,
      hideAxiomSupportNodes: false
    }),
    style: createDefaultCytoscapeStylesheet(),
    layout: createCytoscapeLayoutOptions("readable", { padding: 36 }),
    wheelSensitivity: 0.2
  });

  // Fit but keep padding
  cy.fit(undefined, 24);
}

/**
 * Update UI metadata fields.
 * @param {any} graphModel
 */
function updateMeta(graphModel) {
  const qt = document.getElementById("svizQueryType");
  const tc = document.getElementById("svizTripleCount");
  if (qt) qt.textContent = String(graphModel.queryType ?? "—");
  if (tc) tc.textContent = String(graphModel.whereTripleCount ?? 0);
}

/**
 * Handle a full render request from UI inputs.
 */
function handleRenderRequest() {
  const queryEl = document.getElementById("svizQuery");
  const showPrefixesEl = document.getElementById("svizShowPrefixes");

  const queryText = queryEl ? queryEl.value : "";
  const showPrefixes = !!showPrefixesEl?.checked;

  try {
    logEvent("render.start", { showPrefixes });

    const ast = parseSparqlQueryToAst(queryText, { runtime: window });
    const graphModel = buildSparqlGraphModelFromAst(ast);

    renderDiagram(graphModel);
    renderPrefixLegend(graphModel.prefixes, showPrefixes);
    updateMeta(graphModel);

    showToast("Diagram updated.", "success");
    logEvent("render.success", { nodes: graphModel.nodes.length, edges: graphModel.edges.length });
  } catch (err) {
    logError("render.failed", err, {});
    showToast(`Parse/render failed: ${err?.message ?? err}`, "error", { timeoutMs: 4500 });
  }
}

/**
 * Reset UI to defaults.
 */
function handleReset() {
  const queryEl = document.getElementById("svizQuery");
  if (queryEl) queryEl.value = DEFAULT_QUERY;
  handleRenderRequest();
}

/**
 * Initialize the app.
 */
function init() {
  const queryEl = document.getElementById("svizQuery");
  const renderBtn = document.getElementById("svizRenderBtn");
  const resetBtn = document.getElementById("svizResetBtn");

  if (queryEl) queryEl.value = DEFAULT_QUERY;

  if (renderBtn) renderBtn.addEventListener("click", () => handleRenderRequest());
  if (resetBtn) resetBtn.addEventListener("click", () => handleReset());

  // Initial render
  handleRenderRequest();
}

window.addEventListener("DOMContentLoaded", () => init());
