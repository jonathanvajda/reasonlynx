// ./app/site-header.js
import {
  DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID,
  createProjectPortfolioStores,
  ensureProjectPortfolioProject,
  inspectIndexedDbDatabase,
  openProjectPortfolioDatabase
} from '../packages/indexeddb-data-management/src/index.js';
import {
  applyThemePreference,
  readThemePreference,
  toggleThemePreference
} from '../packages/ui-feedback/src/index.js';

(() => {
  "use strict";

  // --- Your config (as you provided) ---
  const HEADER_CONFIG = {
    brand: {
      mainLogo: { href: "../", src: "../images/block-logo.png", alt: "ReasonLynx placeholder logo" },
      toolLogoByPageId: {
        "ontoeagle": { src: "../images/Eagle-VI_1753264913.svg", alt: "OntoEagle Semantic Lookup" },
        "ontology-viewer": { src: "../images/Eagle-VI_1753264913.svg", alt: "Ontology Viewer" },
        "ontology-tabulator": { src: "../images/ontology-tabulator.svg", alt: "Ontology Tabulator" },
        "cq-ferret": { src: "../images/cq-ferret.svg", alt: "CQ Ferret" },
        "bundler": { src: "../images/default-logo.png", alt: "Slim Bundle Builder" },
        "bp-weaver": { src: "../images/bp-weaver.svg", alt: "BP Weaver" },
        "controlled-vocabulary-registry": { src: "../images/controlled-vocabulary-registry.svg", alt: "Controlled Vocabulary Registry" },
        "tom": { src: "../images/tom.svg", alt: "Tabular Ontology Maker" },
        "table-nova": { src: "../images/table-nova-logo.svg", alt: "Table Nova" },
        "axiolotl": { src: "../axiolotl/images/axiolotl.svg", alt: "Axiolotl SPARQL & Inference" },
        "graph-analyst-playbook": { src: "../images/default-logo.png", alt: "Graph Analyst Playbook" },
        "graph-analytics": { src: "../images/default-logo.png", alt: "Graph Analytics" },
        "myna-iri-swapper": { src: "../images/myna-iri-swapper.png", alt: "Myna IRI Swapper" },
        "docxhund": { src: "../docxhund/images/docxhund-base.png", alt: "DocxHund" },
        "visual-lynx": { src: "../images/visual-lynx.svg", alt: "Visual Lynx" },
        "sparql-pattern-visualizer": { src: "../sparql-pattern-visualizer/images/default-logo-uncropped.png", alt: "SPARQL Pattern Visualizer" },
        "linked-data-transformer": { src: "../images/default-logo.png", alt: "Linked-Data Transformer" },
        "ontology-compliance-diagnostic": { src: "../ontology-compliance-diagnostic/favicon.svg", alt: "Ontology Compliance Diagnostic" },
        "nlp-quality-assurance": { src: "../ontology-compliance-diagnostic/favicon.svg", alt: "NLP Quality Assurance" },
        "ontology-measures": { src: "../ontology-compliance-diagnostic/favicon.svg", alt: "Ontology Measures" },
        "about-page": { src: "../images/block-logo.png", alt: "ReasonLynx" },
      },
      defaultToolLogo: { src: "../images/default-logo.png", alt: "Semantic Tools" },
      titleByPageId: {
        "ontoeagle": { title: "OntoEagle Semantic Lookup" },
        "ontology-viewer": { title: "Ontology Viewer" },
        "iri-registry": { title: "IRI Registry" },
        "ontology-tabulator": { title: "Ontology Tabulator" },
        "cq-ferret": { title: "Competency Question Ferret" },
        "bundler": { title: "Slim Bundle Builder" },
        "bp-weaver": { title: "BP Weaver" },
        "controlled-vocabulary-registry": { title: "Controlled Vocabulary Registry" },
        "tom": { title: "Tabular Ontology Maker" },
        "table-nova": { title: "Table Nova" },
        "shacl-generator": { title: "SHACL Generator" },
        "axiolotl": { title: "Axiolotl SPARQL & Inference" },
        "graph-analyst-playbook": { title: "Graph Analyst Playbook" },
        "graph-analytics": { title: "Graph Analytics" },
        "sparql-pattern-visualizer": { title: "SPARQL Pattern Visualizer" },
        "ontology-compliance-diagnostic": { title: "Ontology Compliance Diagnostic" },
        "nlp-quality-assurance": { title: "NLP Quality Assurance" },
        "ontology-measures": { title: "Ontology Measures" },
        "myna-iri-swapper": { title: "Myna IRI Swapper" },
        "visual-lynx": { title: "Visual Lynx" },
        "linked-data-transformer": { title: "Linked-Data Transformer" },
        "docxhund": { title: "DocxHund" },
        "about-page": { title: "ReasonLynx" },
        }
    },

    classicGroups: [
      {
        title: "Data Exploration",
        items: [
          { label: "OntoEagle Semantic Lookup", href: "../onto-eagle/", pageId: "ontoeagle" },
        //  { label: "Ontology Viewer", href: "../ontology-viewer/", pageId: "ontology-viewer" },
        //  { label: "IRI Registry", href: "/iri-registry.html", pageId: "iri-registry" },
          { label: "Ontology Tabulator", href: "../ontology-tabulator/", pageId: "ontology-tabulator" },
          { label: "Visual Lynx", href: "../visual-lynx/", pageId: "visual-lynx" },
        ],
      },
      {
        title: "Domain Analysis",
        items: [
          { label: "Competency Question Ferret", href: "../cq-ferret/", pageId: "cq-ferret" },
          { label: "Graph Analyst Playbook", href: "../graph-analyst-playbook/", pageId: "graph-analyst-playbook" },
          /*{ label: "Business Process Weaver", href: "/bp-weaver.html", pageId: "bp-weaver" },*/
          { label: "Graph Analytics", href: "../graph-analytics/", pageId: "graph-analytics" },
        ],
      },
      {
        title: "Building Tools",
        items: [
          { label: "Tabular Ontology Maker (TOM)", href: "../tabular-ontology-maker/", pageId: "tom" },
          { label: "Knowledge Graph Modeler 🔗", href: "https://skreen5hot.github.io/kgModeler/", pageId: "kg-modeler" },
          { label: "Mermaid Diagram Builder 🔗", href: "https://skreen5hot.github.io/mermaid/", pageId: "mermaid-diagram-builder" },
        //  { label: "SHACL Generator", href: "/shacl-generator.html", pageId: "shacl-generator" },
        ],
      },
      {
        title: "Data Transformation",
        items: [
          { label: "Table Nova (Converts to RDF)", href: "../table-nova/", pageId: "table-nova" },
          { label: "DocxHund (Converts to RDF)", href: "../docxhund/", pageId: "docxhund" },
          { label: "Linked-Data Transformer", href: "../linked-data-transformer/", pageId: "linked-data-transformer" },
        ],
      },
      {
      title: "Data Manipulation",
        items: [
          { label: "Axiolotl SPARQL & Inference", href: "../axiolotl/", pageId: "axiolotl" },
          { label: "SPARQL Pattern Visualizer", href: "../sparql-pattern-visualizer/", pageId: "sparql-pattern-visualizer" },
          { label: "Slim Bundle Builder", href: "../bundler/", pageId: "bundler" },
        ],
      },
      {
        title: "Maintenance",
            items: [
            { label: "Ontology Compliance Diagnostic", href: "../ontology-compliance-diagnostic/", pageId: "ontology-compliance-diagnostic" },
            { label: "NLP Quality Assurance", href: "../ontology-compliance-diagnostic/nlp-quality-assurance.html", pageId: "nlp-quality-assurance" },
            { label: "Ontology Measures", href: "../ontology-compliance-diagnostic/ontology-measures.html", pageId: "ontology-measures" },
            { label: "Myna IRI Swapper for SPARQL & RDF", href: "../iri-swapper/", pageId: "myna-iri-swapper" },
            ],
        },
        ],
    };

  const TOOL_CATALOG = Object.freeze({
    "ontoeagle": { label: "OntoEagle Semantic Lookup", href: "../onto-eagle/" },
    "ontology-tabulator": { label: "Ontology Tabulator", href: "../ontology-tabulator/" },
    "visual-lynx": { label: "Visual Lynx", href: "../visual-lynx/" },
    "cq-ferret": { label: "Competency Question Ferret", href: "../cq-ferret/" },
    "graph-analyst-playbook": { label: "Graph Analyst Playbook", href: "../graph-analyst-playbook/" },
    "graph-analytics": { label: "Graph Analytics", href: "../graph-analytics/" },
    "tom": { label: "Tabular Ontology Maker", href: "../tabular-ontology-maker/" },
    "kg-modeler": { label: "Knowledge Graph Modeler", href: "https://skreen5hot.github.io/kgModeler/", external: true },
    "mermaid-diagram-builder": { label: "Mermaid Diagram Builder", href: "https://skreen5hot.github.io/mermaid/", external: true },
    "table-nova": { label: "Table Nova", href: "../table-nova/" },
    "docxhund": { label: "DocxHund", href: "../docxhund/" },
    "linked-data-transformer": { label: "Linked-Data Transformer", href: "../linked-data-transformer/" },
    "axiolotl": { label: "Axiolotl SPARQL & Inference", href: "../axiolotl/" },
    "sparql-pattern-visualizer": { label: "SPARQL Pattern Visualizer", href: "../sparql-pattern-visualizer/" },
    "bundler": { label: "Slim Bundle Builder", href: "../bundler/" },
    "ontology-compliance-diagnostic": { label: "Ontology Compliance Diagnostic", href: "../ontology-compliance-diagnostic/" },
    "nlp-quality-assurance": { label: "NLP Quality Assurance", href: "../ontology-compliance-diagnostic/nlp-quality-assurance.html" },
    "myna-iri-swapper": { label: "Myna IRI Swapper", href: "../iri-swapper/" },
    "controlled-vocabulary-registry": { label: "Controlled Vocabulary", status: "planned" },
    "onto-merge": { label: "OntoMerge", status: "external route pending" },
    "onto-diff": { label: "OntoDiff", status: "planned" }
  });

  const TOOL_DESCRIPTIONS = Object.freeze({
    "ontoeagle": "Search ontology terms, labels, definitions, and related semantic resources.",
    "ontology-tabulator": "Flatten an ontology into a table for inspection, comparison, and editing.",
    "visual-lynx": "Explore RDF resources and their relations as an interactive node-edge diagram.",
    "cq-ferret": "Capture competency questions and connect them with people, sources, diagrams, and queries.",
    "graph-analyst-playbook": "Author decision trees that guide analysts through SPARQL query execution.",
    "graph-analytics": "Analyze RDF graphs with path finding, community detection, and related measures.",
    "tom": "Build ontologies or instance data from curated, flattened tables.",
    "kg-modeler": "Draw semantic node-edge models and produce RDF, ontology seeds, and diagrams.",
    "mermaid-diagram-builder": "Create and edit Mermaid diagrams visually.",
    "table-nova": "Transform CSV and spreadsheet tables into RDF and lightweight ontology drafts.",
    "docxhund": "Transform Word documents into RDF and annotate passages with semantic resources.",
    "linked-data-transformer": "Transform RDF datasets into new RDF structures and serializations.",
    "axiolotl": "Load and query graphs with SPARQL, EL inference, and consistency-oriented workflows.",
    "sparql-pattern-visualizer": "Turn SPARQL graph patterns into an easier-to-read visual representation.",
    "bundler": "Build ontology seed files and reusable ontology slims from selected terms.",
    "ontology-compliance-diagnostic": "Inspect ontologies and generate bulk curation-status recommendations.",
    "nlp-quality-assurance": "Check ontology annotations for spelling, grammar, and definition structure.",
    "myna-iri-swapper": "Apply controlled IRI replacements to RDF datasets and SPARQL queries.",
    "controlled-vocabulary-registry": "Curate governed terms, labels, identifiers, and vocabulary metadata.",
    "onto-merge": "Create an ontology by merging two or more ontology inputs.",
    "onto-diff": "Compare ontology versions and generate semantic diffs or reproducible SPARQL updates."
  });

  const HEADER_VIEWS = Object.freeze({
    competency: {
      label: "Competency Cycle",
      groups: [
        { title: "Stage 0: Domain Scoping", appIds: ["cq-ferret", "ontoeagle"] },
        { title: "Stage 1: Domain Analysis", appIds: ["controlled-vocabulary-registry", "ontology-tabulator", "ontoeagle", "table-nova", "graph-analytics"] },
        { title: "Stage 2: Semantic Modeling", appIds: ["kg-modeler", "mermaid-diagram-builder", "tom", "graph-analyst-playbook", "sparql-pattern-visualizer"] },
        { title: "Stage 3: Alignment", appIds: ["tom", "table-nova", "docxhund", "bundler", "myna-iri-swapper", "onto-diff"] },
        { title: "Stage 4: Integration", appIds: ["linked-data-transformer", "axiolotl", "onto-merge", "table-nova", "tom", "bundler", "myna-iri-swapper"] },
        { title: "Stage 5: Validation", appIds: ["ontology-compliance-diagnostic", "nlp-quality-assurance", "onto-diff", "axiolotl", "graph-analytics", "visual-lynx", "sparql-pattern-visualizer", "graph-analyst-playbook"] }
      ]
    },
    linear: {
      label: "Linear Pipeline",
      groups: [
        { title: "Controlled Vocabulary", appIds: ["cq-ferret", "controlled-vocabulary-registry", "ontoeagle", "tom", "nlp-quality-assurance"] },
        { title: "Metadata Standards", appIds: ["ontology-tabulator", "ontoeagle", "tom", "ontology-compliance-diagnostic", "docxhund", "table-nova"] },
        { title: "Taxonomy", appIds: ["tom", "kg-modeler", "mermaid-diagram-builder", "ontology-tabulator", "bundler", "onto-merge", "onto-diff"] },
        { title: "Thesaurus", appIds: ["tom", "ontoeagle", "ontology-tabulator", "myna-iri-swapper", "onto-merge", "ontology-compliance-diagnostic", "nlp-quality-assurance"] },
        { title: "Ontology", appIds: ["tom", "kg-modeler", "ontology-tabulator", "bundler", "onto-merge", "onto-diff", "myna-iri-swapper", "linked-data-transformer", "axiolotl", "ontology-compliance-diagnostic", "nlp-quality-assurance"] },
        { title: "Knowledge Graph", appIds: ["table-nova", "docxhund", "linked-data-transformer", "axiolotl", "visual-lynx", "graph-analytics", "graph-analyst-playbook", "sparql-pattern-visualizer", "kg-modeler", "tom", "myna-iri-swapper", "onto-merge", "onto-diff"] }
      ]
    },
    cicd: {
      label: "CI/CD",
      groups: [
        { title: "Plan", appIds: ["cq-ferret", "ontoeagle", "controlled-vocabulary-registry", "ontology-tabulator", "visual-lynx", "graph-analyst-playbook", "graph-analytics"] },
        { title: "Code", appIds: ["tom", "kg-modeler", "mermaid-diagram-builder", "table-nova", "docxhund", "linked-data-transformer", "sparql-pattern-visualizer", "myna-iri-swapper"] },
        { title: "Build", appIds: ["tom", "table-nova", "docxhund", "linked-data-transformer", "axiolotl", "bundler", "onto-merge", "myna-iri-swapper"] },
        { title: "Test", appIds: ["axiolotl", "ontology-compliance-diagnostic", "nlp-quality-assurance", "onto-diff", "graph-analytics", "visual-lynx", "sparql-pattern-visualizer", "graph-analyst-playbook"] },
        { title: "Release", appIds: ["bundler", "tom", "table-nova", "onto-merge", "onto-diff", "ontology-compliance-diagnostic", "linked-data-transformer"] }
      ]
    },
    classic: {
      label: "Classic (deprecated)",
      groups: HEADER_CONFIG.classicGroups.map((group) => ({
        title: group.title,
        items: group.items
      }))
    }
  });

  const HEADER_VIEW_SETTING_KEY = "ui.headerView";
  let selectedHeaderView = "competency";
  let navigationSettingsPromise = null;

  const APP_UTILITIES = {
    ontoeagle: {
      settings: [],
      idb: {
        name: "OntoEagleDB",
        stores: ["settings", "datasets", "documents", "index"],
        label: "OntoEagle local data",
      },
      dataManagement: [
        {
          id: "catalog-data",
          label: "Manage catalog data",
          icon: "../images/file-icon-green.svg",
          event: "ontoeagle:open-catalog-data",
        },
      ],
      tools: [
        {
          id: "slim-bundle",
          label: "Slim bundle",
          href: "../bundler/",
          badgeId: "ontShoppingCartCount",
          icon: "shopping-cart",
        },
      ],
    },
  };
  APP_UTILITIES["ontology-viewer"] = APP_UTILITIES.ontoeagle;

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function getPageId() {
    const pid = document.body?.getAttribute("data-page-id");
    return pid && pid.trim() ? pid.trim() : null;
  }

  function pickToolLogo(pageId) {
    const map = HEADER_CONFIG.brand?.toolLogoByPageId || {};
    const fallback = HEADER_CONFIG.brand?.defaultToolLogo || { src: "", alt: "" };
    return (pageId && map[pageId]) ? map[pageId] : fallback;
  }

  function pageUtilities() {
    return APP_UTILITIES[getPageId()] || {};
  }

  function dbStatusConfig() {
    const body = document.body;
    const idb = pageUtilities().idb || {};
    const dbName = idb.name || body?.getAttribute("data-db-name")?.trim() || "";
    const stores = (Array.isArray(idb.stores) ? idb.stores : (body?.getAttribute("data-db-stores") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean));
    return {
      dbName,
      stores,
      label: idb.label || dbName || "Local data",
    };
  }

  function shoppingCartSvg() {
    return `
      <svg class="sitehdr-utilIconSvg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 2C14 1.44772 13.5523 1 13 1C12.4477 1 12 1.44772 12 2V8.58579L9.70711 6.29289C9.31658 5.90237 8.68342 5.90237 8.29289 6.29289C7.90237 6.68342 7.90237 7.31658 8.29289 7.70711L12.2929 11.7071C12.6834 12.0976 13.3166 12.0976 13.7071 11.7071L17.7071 7.70711C18.0976 7.31658 18.0976 6.68342 17.7071 6.29289C17.3166 5.90237 16.6834 5.90237 16.2929 6.29289L14 8.58579V2ZM1 3C1 2.44772 1.44772 2 2 2H2.47241C3.82526 2 5.01074 2.90547 5.3667 4.21065L5.78295 5.73688L7.7638 13H18.236L20.2152 5.73709C20.3604 5.20423 20.9101 4.88998 21.4429 5.03518C21.9758 5.18038 22.29 5.73006 22.1448 6.26291L20.1657 13.5258C19.9285 14.3962 19.1381 15 18.236 15H8V16C8 16.5523 8.44772 17 9 17H16.5H18C18.5523 17 19 17.4477 19 18C19 18.212 18.934 18.4086 18.8215 18.5704C18.9366 18.8578 19 19.1715 19 19.5C19 20.8807 17.8807 22 16.5 22C15.1193 22 14 20.8807 14 19.5C14 19.3288 14.0172 19.1616 14.05 19H10.95C10.9828 19.1616 11 19.3288 11 19.5C11 20.8807 9.88071 22 8.5 22C7.11929 22 6 20.8807 6 19.5C6 18.863 6.23824 18.2816 6.63048 17.8402C6.23533 17.3321 6 16.6935 6 16V14.1339L3.85342 6.26312L3.43717 4.73688C3.31852 4.30182 2.92336 4 2.47241 4H2C1.44772 4 1 3.55228 1 3ZM16 19.5C16 19.2239 16.2239 19 16.5 19C16.7761 19 17 19.2239 17 19.5C17 19.7761 16.7761 20 16.5 20C16.2239 20 16 19.7761 16 19.5ZM8 19.5C8 19.2239 8.22386 19 8.5 19C8.77614 19 9 19.2239 9 19.5C9 19.7761 8.77614 20 8.5 20C8.22386 20 8 19.7761 8 19.5Z"/>
      </svg>
    `;
  }

  function utilityIcon(item) {
    if (item.icon === "shopping-cart") return shoppingCartSvg();
    return `<img class="sitehdr-utilIconImg" src="${escapeHtml(item.icon || "")}" alt="" aria-hidden="true" />`;
  }

  function renderUtilityAction(item, extraClass = "") {
    const badge = item.badgeId
      ? `<span class="sitehdr-utilBadge" id="${escapeHtml(item.badgeId)}" aria-label="0 items">0</span>`
      : "";
    const icon = utilityIcon(item);
    const label = escapeHtml(item.label || "Header action");
    if (item.href) {
      return `<a class="sitehdr-utilBtn ${extraClass}" href="${escapeHtml(item.href)}" aria-label="${label}" title="${label}">${icon}${badge}</a>`;
    }
    return `<button class="sitehdr-utilBtn ${extraClass}" type="button" data-sitehdr-event="${escapeHtml(item.event || "")}" aria-label="${label}" title="${label}">${icon}${badge}</button>`;
  }

  function renderSettingsActions(settings) {
    if (!Array.isArray(settings) || !settings.length) return "";
    if (settings.length === 1) {
      return renderUtilityAction({
        ...settings[0],
        icon: settings[0].icon || "../images/settings-cog-icon.svg",
      });
    }
    return renderUtilityAction({
      label: "App settings",
      icon: "../images/settings-cog-icon.svg",
      event: "sitehdr:open-settings-menu",
    });
  }

  function dbStatusHtml() {
    const config = dbStatusConfig();
    if (!config.dbName) return "";

    return `
      <div class="sitehdr-db" data-db-status="idle" title="${escapeHtml(config.label)}">
        <div class="sitehdr-db__status" aria-live="polite" aria-atomic="true">
          <span class="sitehdr-db__bulb" aria-hidden="true"></span>
          <span class="sitehdr-db__text">DB idle</span>
        </div>
      </div>
    `;
  }

  function appUtilityHtml() {
    const utilities = pageUtilities();
    const settings = renderSettingsActions(utilities.settings);
    const data = Array.isArray(utilities.dataManagement)
      ? utilities.dataManagement.map((item) => renderUtilityAction({
          icon: "../images/file-icon-green.svg",
          ...item,
        }, "sitehdr-utilBtn--data")).join("")
      : "";
    const tools = Array.isArray(utilities.tools)
      ? utilities.tools.map((item) => renderUtilityAction(item, "sitehdr-utilBtn--tool")).join("")
      : "";
    const db = dbStatusHtml();
    if (!settings && !data && !tools && !db) return "";

    return `
      <div class="sitehdr-appTools" aria-label="App tools">
        ${db}
        <div class="sitehdr-appToolActions">
          ${settings}
          ${data}
          ${tools}
        </div>
      </div>
    `;
  }

  function buildSectionsHtml(currentPageId) {
    const view = HEADER_VIEWS[selectedHeaderView] || HEADER_VIEWS.competency;
    const groups = Array.isArray(view.groups) ? view.groups : [];
    if (groups.length === 0) return "";

    const sections = groups.map((g) => {
      const title = escapeHtml(g.title || "");
      const items = Array.isArray(g.items)
        ? g.items
        : (g.appIds || []).map((appId) => ({ pageId: appId, ...TOOL_CATALOG[appId] })).filter((item) => item.label);

      const links = items.map((it) => {
        const active = currentPageId && it.pageId === currentPageId;
        const description = TOOL_DESCRIPTIONS[it.pageId] || "Open this ReasonLynx semantic-engineering tool.";
        const icon = HEADER_CONFIG.brand.toolLogoByPageId[it.pageId]?.src || HEADER_CONFIG.brand.defaultToolLogo.src;
        const preview = `
          <aside class="sitehdr-itemPreview" role="tooltip">
            <img src="${escapeHtml(icon)}" alt="" />
            <span><strong>${escapeHtml(it.label || "")}</strong>${escapeHtml(description)}</span>
          </aside>
        `;
        if (!it.href) {
          return `
            <li class="sitehdr-menuItem">
              <span class="sitehdr-link sitehdr-link--unavailable" title="${escapeHtml(it.status || "Unavailable")}">
                ${escapeHtml(it.label || "")} <small>${escapeHtml(it.status || "unavailable")}</small>
              </span>
              ${preview}
            </li>
          `;
        }
        return `
          <li class="sitehdr-menuItem">
            <a class="sitehdr-link${active ? " is-active" : ""}"
               href="${escapeHtml(it.href || "#")}"
               ${it.external ? 'target="_blank" rel="noopener noreferrer"' : ""}
               ${active ? 'aria-current="page"' : ""}>
              ${escapeHtml(it.label || "")}${it.external ? '<span class="sitehdr-external" aria-label="opens in a new tab">↗</span>' : ""}
            </a>
            ${preview}
          </li>
        `;
      }).join("");

      return `
        <details class="sitehdr-section">
          <summary class="sitehdr-section__title">${title}</summary>
          <ul class="sitehdr-section__list">${links}</ul>
        </details>
      `;
    }).join("");

    return `
      <div class="sitehdr-navigation" data-view="${escapeHtml(selectedHeaderView)}">
        <nav class="sitehdr-sections" aria-label="${escapeHtml(view.label)} tool sections">${sections}</nav>
      </div>
    `;
  }

  function globalSettingsHtml() {
    const options = Object.entries(HEADER_VIEWS).map(([value, config]) =>
      `<option value="${escapeHtml(value)}"${value === selectedHeaderView ? " selected" : ""}>${escapeHtml(config.label)}</option>`
    ).join("");
    const language = globalThis.navigator?.language || "Browser default";
    const timezone = globalThis.Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "Browser default";
    return `
      <details class="sitehdr-settings">
        <summary class="sitehdr-settings__toggle" aria-label="Global settings" title="Global settings">
          <img src="../images/settings-cog-icon.svg" alt="" aria-hidden="true" />
        </summary>
        <div class="sitehdr-settings__panel">
          <h2>Settings</h2>
          <label for="siteHeaderView">Navigation view</label>
          <select class="sitehdr-viewSelect" id="siteHeaderView">${options}</select>
          <dl class="sitehdr-environmentSettings">
            <div><dt>Language</dt><dd>${escapeHtml(language)}</dd></div>
            <div><dt>Timezone</dt><dd>${escapeHtml(timezone)}</dd></div>
          </dl>
        </div>
      </details>
    `;
  }

  /** @returns {Promise<object>} Shared settings for cross-app header preferences. */
  function getNavigationSettings() {
    if (!navigationSettingsPromise) {
      navigationSettingsPromise = openProjectPortfolioDatabase().then(async (db) => {
        const stores = createProjectPortfolioStores(db, { projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID });
        await ensureProjectPortfolioProject(stores);
        return stores.settings;
      });
    }
    return navigationSettingsPromise;
  }

  function renderNavigation() {
    const current = document.querySelector(".sitehdr-navigation");
    if (!current) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = buildSectionsHtml(getPageId()).trim();
    current.replaceWith(wrapper.firstElementChild);
    enableHoverNavigation();
  }

  /** Make pointer hover sufficient on desktop while preserving native details behavior. */
  function enableHoverNavigation() {
    if (!globalThis.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    document.querySelectorAll(".sitehdr-section").forEach((section) => {
      section.addEventListener("pointerenter", () => {
        document.querySelectorAll(".sitehdr-section[open]").forEach((openSection) => {
          if (openSection !== section) openSection.removeAttribute("open");
        });
        section.setAttribute("open", "");
      });
      section.addEventListener("pointerleave", () => section.removeAttribute("open"));
    });
  }

  async function initializeHeaderView() {
    try {
      const saved = await (await getNavigationSettings()).readSettingValue(HEADER_VIEW_SETTING_KEY, "competency");
      if (HEADER_VIEWS[saved] && saved !== selectedHeaderView) {
        selectedHeaderView = saved;
        renderNavigation();
        const selector = document.getElementById("siteHeaderView");
        if (selector) selector.value = saved;
      }
    } catch (_err) {
      selectedHeaderView = "competency";
    }
  }

  function renderHeader() {
    const mount = document.getElementById("siteHeader");
    if (!mount) return;

    const pageId = getPageId();
    const toolLogo = pickToolLogo(pageId);

    const mainLogo = HEADER_CONFIG.brand?.mainLogo || { href: "/", src: "", alt: "" };
    const title = HEADER_CONFIG.brand?.titleByPageId?.[pageId]?.title || toolLogo.alt || "Semantic Tools";

    mount.innerHTML = `
      <div class="sitehdr">
        <div class="sitehdr-bar">
          <a class="sitehdr-brand" href="${escapeHtml(mainLogo.href)}">
            <img class="sitehdr-brand__main"
                 src="${escapeHtml(mainLogo.src)}"
                 alt="${escapeHtml(mainLogo.alt)}" />
          </a>

          <div class="sitehdr-tool">
            <img class="sitehdr-tool__img"
                 src="${escapeHtml(toolLogo.src)}"
                 alt="${escapeHtml(toolLogo.alt)}" />
                 <h1 class="sitehdr-tool__title" style="margin-left: 2rem;">${escapeHtml(title)}</h1>
          </div>

          ${buildSectionsHtml(pageId)}

          <div class="sitehdr-utility">
          ${globalSettingsHtml()}
          <div id="light-dark-toggle">
            <button
              type="button"
              class="theme-toggle"
              id="themeToggle"
              aria-label="Toggle theme"
              aria-pressed="false"
              title="Toggle theme"
            >
            <span class="theme-toggle__track" aria-hidden="true">
              <span class="theme-toggle__icon theme-toggle__icon--sun">☀️</span>
              <span class="theme-toggle__icon theme-toggle__icon--moon">🌙</span>
              <span class="theme-toggle__thumb"></span>
            </span>
            <span class="theme-toggle__sr">Toggle theme</span>
          </button>
          </div>
          ${appUtilityHtml()}
          </div>
        </div>
      </div>
    `;
  }

  function updateDbStatus(state = "idle", text = "") {
    const widget = document.querySelector(".sitehdr-db");
    if (!widget) return;

    const config = dbStatusConfig();
    const label = widget.querySelector(".sitehdr-db__text");
    const normalized = ["idle", "initializing", "reading", "writing", "ready", "error"].includes(state)
      ? state
      : "idle";
    const fallbackText = {
      idle: "DB idle",
      initializing: "DB initializing",
      reading: "DB reading",
      writing: "DB writing",
      ready: "DB ready",
      error: "DB error",
    }[normalized];

    widget.setAttribute("data-db-status", normalized);
    widget.title = `${config.dbName}${config.stores.length ? ` (${config.stores.join(", ")})` : ""}`;
    if (label) label.textContent = text || fallbackText;
  }

  async function inspectDbStatus() {
    const config = dbStatusConfig();
    if (!config.dbName) return;

    try {
      const status = await inspectIndexedDbDatabase(config.dbName);
      if (!status.available || status.exists === null) {
        updateDbStatus("idle", "DB idle");
        return;
      }

      if (!status.exists) {
        updateDbStatus("idle", "DB not created");
        return;
      }

      updateDbStatus("reading", "DB checking");
      const missing = config.stores.filter((store) => !status.stores.includes(store));
      updateDbStatus(missing.length ? "error" : "ready", missing.length ? "DB store missing" : "DB ready");
    } catch (_err) {
      updateDbStatus("error", "DB unavailable");
    }
  }

  // script loaded at end of body => DOM is ready
  renderHeader();
  enableHoverNavigation();
  initializeHeaderView();
  window.SiteHeaderDBStatus = { set: updateDbStatus, inspect: inspectDbStatus };
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-sitehdr-event]");
    if (!button) return;
    const eventName = button.getAttribute("data-sitehdr-event");
    if (!eventName) return;
    document.dispatchEvent(new CustomEvent(eventName, { detail: { source: button } }));
  });
  document.addEventListener("change", async (event) => {
    if (event.target?.id !== "siteHeaderView") return;
    const nextView = event.target.value;
    if (!HEADER_VIEWS[nextView]) return;
    selectedHeaderView = nextView;
    renderNavigation();
    try {
      await (await getNavigationSettings()).writeSettingValue(HEADER_VIEW_SETTING_KEY, nextView);
    } catch (_err) {
      // The selected view remains usable for this page even if persistence fails.
    }
  });
  document.addEventListener("sitehdr:db-status", (event) => {
    updateDbStatus(event.detail?.state, event.detail?.text);
  });
  inspectDbStatus();
  
})();

// Theme toggle: sets <html data-theme="light|dark"> and persists choice.
  (() => {
    const SETTING_KEY = 'ui.theme'; // 'light' | 'dark'
    const root = document.documentElement;
    const btn = document.getElementById('themeToggle');
    let settingsStorePromise = null;

    if (!btn) return;

    const getSystemTheme = () => {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    };

    const getSettingsStore = async () => {
      if (!settingsStorePromise) {
        settingsStorePromise = openProjectPortfolioDatabase()
          .then((db) => {
            const stores = createProjectPortfolioStores(db, {
              projectId: DEFAULT_PROJECT_PORTFOLIO_PROJECT_ID
            });
            return ensureProjectPortfolioProject(stores).then(() => stores.settings);
          });
      }
      return settingsStorePromise;
    };

    const getSavedTheme = async () => {
      const settings = await getSettingsStore();
      return readThemePreference(settings, { settingKey: SETTING_KEY, fallback: null });
    };

    const applyTheme = (theme) => {
      applyThemePreference({ theme, rootElement: root, toggleElement: btn });
    };

    const initTheme = async () => {
      applyTheme(getSystemTheme());
      try {
        const saved = await getSavedTheme();
        if (saved) applyTheme(saved);
      } catch (_err) {
        applyTheme(getSystemTheme());
      }
    };

    const toggleTheme = async () => {
      try {
        await toggleThemePreference({
          currentTheme: root.getAttribute('data-theme') || getSystemTheme(),
          rootElement: root,
          toggleElement: btn,
          settingsStore: await getSettingsStore(),
          settingKey: SETTING_KEY
        });
      } catch (_err) {
        const current = root.getAttribute('data-theme') || getSystemTheme();
        applyTheme(current === 'dark' ? 'light' : 'dark');
      }
    };

    // Initialize once on load
    initTheme();

    // Button click toggles
    btn.addEventListener('click', toggleTheme);

    // Optional: If no saved preference, follow system changes live
    const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (mql) {
      mql.addEventListener('change', async () => {
        try {
          if (!await getSavedTheme()) applyTheme(getSystemTheme());
        } catch (_err) {
          applyTheme(getSystemTheme());
        }
      });
    }
  })();
