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
      mainLogo: { href: "../about/", src: "../images/main-logo.png", alt: "Erhaben Semantic Solutions" },
      toolLogoByPageId: {
        "ontoeagle": { src: "../images/Eagle-VI_1753264913.svg", alt: "OntoEagle Semantic Lookup" },
        "ontology-tabulator": { src: "../images/ontology-tabulator.svg", alt: "Ontology Tabulator" },
        "cq-ferret": { src: "../images/cq-ferret.svg", alt: "CQ Ferret" },
        "bp-weaver": { src: "../images/bp-weaver.svg", alt: "BP Weaver" },
        "controlled-vocabulary-registry": { src: "../images/controlled-vocabulary-registry.svg", alt: "Controlled Vocabulary Registry" },
        "tom": { src: "../images/tom.svg", alt: "Tabular Ontology Maker" },
        "table-nova": { src: "../images/table-nova-logo.svg", alt: "Table Nova" },
        "axiolotl": { src: "../images/axiolotl.svg", alt: "Axiolotl SPARQL & Inference" },
        "myna-iri-swapper": { src: "../images/myna-iri-swapper.png", alt: "Myna RDF IRI Swapper" },
        "myna-sparql-iri-swapper": { src: "../images/myna-iri-swapper.png", alt: "Myna SPARQL IRI Swapper" },
        "visual-lynx": { src: "../images/visual-lynx.svg", alt: "Visual Lynx" },
      },
      defaultToolLogo: { src: "../images/default-logo.png", alt: "Semantic Tools" },
      titleByPageId: {
        "ontoeagle": { title: "OntoEagle Semantic Lookup" },
        "iri-registry": { title: "IRI Registry" },
        "ontology-tabulator": { title: "Ontology Tabulator" },
        "cq-ferret": { title: "Competency Question Ferret" },
        "bp-weaver": { title: "BP Weaver" },
        "controlled-vocabulary-registry": { title: "Controlled Vocabulary Registry" },
        "tom": { title: "Tabular Ontology Maker" },
        "table-nova": { title: "Table Nova" },
        "shacl-generator": { title: "SHACL Generator" },
        "axiolotl": { title: "Axiolotl SPARQL & Inference" },
        "sparql-pattern-visualizer": { title: "SPARQL Pattern Visualizer" },
        "ontology-compliance-diagnostic": { title: "Ontology Compliance Diagnostic" },
        "myna-iri-swapper": { title: "Myna RDF IRI Swapper" },
        "myna-sparql-iri-swapper": { title: "Myna SPARQL IRI Swapper" },
        "visual-lynx": { title: "Visual Lynx" },
        "linked-data-transformer": { title: "Linked-Data Transformer" },
        }
    },

    groups: [
      {
        title: "Data Exploration",
        items: [
          { label: "OntoEagle Semantic Lookup", href: "../onto-eagle/", pageId: "ontoeagle" },
        //  { label: "IRI Registry", href: "/iri-registry.html", pageId: "iri-registry" },
          { label: "Ontology Tabulator", href: "https://jonathanvajda.github.io/ontology-tabulator/", pageId: "ontology-tabulator" },
          { label: "Visual Lynx", href: "https://jonathanvajda.github.io/visual-lynx/", pageId: "visual-lynx" },
        ],
      },
      {
        title: "Domain Analysis",
        items: [
          { label: "Competency Question Ferret", href: "../cq-ferret/", pageId: "cq-ferret" },
          /*{ label: "Business Process Weaver", href: "/bp-weaver.html", pageId: "bp-weaver" },*/
          { label: "Mermaid Diagram Builder 🔗", href: "https://skreen5hot.github.io/mermaid/", pageId: "mermaid-diagram-builder" },
        ],
      },
      {
        title: "Building Tools",
        items: [
        //  { label: "Controlled Vocabulary", href: "/controlled-vocabulary-registry.html", pageId: "controlled-vocabulary-registry" },
          { label: "Tabular Ontology Maker (TOM)", href: "../tabular-ontology-maker/", pageId: "tom" },
          { label: "Table Nova", href: "https://jonathanvajda.github.io/table-nova/", pageId: "table-nova" },
          { label: "Knowledge Graph Modeler 🔗", href: "https://skreen5hot.github.io/kgModeler/", pageId: "kg-modeler" },
        //  { label: "SHACL Generator", href: "/shacl-generator.html", pageId: "shacl-generator" },
        ],
      },
      {
      title: "Data Manipulation",
        items: [
          { label: "Axiolotl SPARQL & Inference", href: "https://jonathanvajda.github.io/axiolotl/", pageId: "axiolotl" },
          { label: "SPARQL Pattern Visualizer", href: "https://jonathanvajda.github.io/sparql-pattern-visualizer/", pageId: "sparql-pattern-visualizer" },
          { label: "Linked-Data Transformer", href: "https://jonathanvajda.github.io/visual-lynx/linked-data-transformer.html", pageId: "linked-data-transformer" },
        ],
      },
      {
        title: "Maintenance",
            items: [
            { label: "Ontology Compliance Diagnostic", href: "https://jonathanvajda.github.io/ontology-compliance-diagnostic/", pageId: "ontology-compliance-diagnostic" },
            { label: "Myna RDF IRI Swapper", href: "https://jonathanvajda.github.io/iri-swapper/", pageId: "myna-iri-swapper" },
            { label: "Myna SPARQL IRI Swapper", href: "https://jonathanvajda.github.io/iri-swapper/sparql-iri-swapper.html", pageId: "myna-sparql-iri-swapper" }, 
            ],
        },
        ],
    };

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
    const groups = Array.isArray(HEADER_CONFIG.groups) ? HEADER_CONFIG.groups : [];
    if (groups.length === 0) return "";

    const sections = groups.map((g) => {
      const title = escapeHtml(g.title || "");
      const items = Array.isArray(g.items) ? g.items : [];

      const links = items.map((it) => {
        const active = currentPageId && it.pageId === currentPageId;
        return `
          <li>
            <a class="sitehdr-link${active ? " is-active" : ""}"
               href="${escapeHtml(it.href || "#")}"
               ${active ? 'aria-current="page"' : ""}>
              ${escapeHtml(it.label || "")}
            </a>
          </li>
        `;
      }).join("");

      return `
        <section class="sitehdr-section" aria-label="${title}">
          <h2 class="sitehdr-section__title">${title}</h2>
          <ul class="sitehdr-section__list">
            ${links}
          </ul>
        </section>
      `;
    }).join("");

    return `<nav class="sitehdr-sections" aria-label="Tool sections">${sections}</nav>`;
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
  window.SiteHeaderDBStatus = { set: updateDbStatus, inspect: inspectDbStatus };
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("[data-sitehdr-event]");
    if (!button) return;
    const eventName = button.getAttribute("data-sitehdr-event");
    if (!eventName) return;
    document.dispatchEvent(new CustomEvent(eventName, { detail: { source: button } }));
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
