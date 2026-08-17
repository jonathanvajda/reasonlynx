# ReasonLynx Deployment Inventory

This repo is shaped for hosts that deploy the repository root as the public web root.

## Canonical URLs

| URL | Local path | Source |
| --- | --- | --- |
| `/` | `index.html` | ReasonLynx landing page |
| `/onto-eagle/` | `onto-eagle/index.html` | `OntoEagle/docs/index.html` |
| `/ontology-viewer/` | `ontology-viewer/index.html` | `OntoEagle/docs/ontology-viewer.html` |
| `/cq-ferret/` | `cq-ferret/index.html` | `OntoEagle/docs/cq-ferret.html` |
| `/bundler/` | `bundler/index.html` | `OntoEagle/docs/bundler.html` |
| `/about/` | `about/index.html` | `OntoEagle/docs/about.html` |
| `/cq-ferret.html` | `cq-ferret.html` | Redirect alias to `/cq-ferret/` |
| `/onto-eagle.html` | `onto-eagle.html` | Redirect alias to `/onto-eagle/` |
| `/ontology-catalog.html` | `ontology-catalog.html` | Redirect alias to `/onto-eagle/`; catalog is embedded in OntoEagle |

## Shared Folders

| Path | Purpose | Source |
| --- | --- | --- |
| `packages/` | Canonical shared package source used directly by app suites | `OntoEagle/monorepo-staging/packages` |
| `vendor/` | Browser vendor bundles loaded by app entry pages | `OntoEagle/docs/app/shared/vendor` |
| `app/*.js` | Shared browser app scripts used by the directory apps | `OntoEagle/docs/app/*.js` |
| `images/` | Shared image assets | `OntoEagle/docs/images` |
| `styles/` | Shared OntoEagle app CSS | `OntoEagle/docs/styles` |
| `data/` | Shared runtime ontology data | `OntoEagle/docs/data` |
| `sw.js` | Root service worker with `/` scope | `OntoEagle/docs/sw.js`, path-adjusted |
| `app/styles/` | ReasonLynx landing page styles | Existing ReasonLynx files |

Shared package files under `packages/` are copied without deploy-time path rewrites. Only app HTML/JS is rewritten to consume those package entrypoints from the new repository layout.

Root `app/` is for cross-app browser integration code only. Current examples:
`site-header.js` is used by every OntoEagle suite page; `catalog-data-manager.js`,
`ontology-meta.js`, `ontology-icons.js`, and `ontoeagle-indexeddb-store.js` are shared by
the search/viewer/bundler screens and embedded OntoEagle views. Single-owner app files
belong in their app directory. CQ Ferret owns its NLP and vocabulary-extraction support
files: `lexicon.js`, `POSTaggerGraph.js`, `vocab-extract-core.js`, and
`cq-ferret-indexeddb-store.js`.

## OntoEagle Suite

| Path | Purpose | Source |
| --- | --- | --- |
| `onto-eagle/index.html` | OntoEagle landing/search entry point | `OntoEagle/docs/index.html` |
| `onto-eagle/ontology-catalog.js` | Embedded OntoEagle catalog view logic | `OntoEagle/docs/app/ontology-catalog.js` |
| `ontology-viewer/index.html` | Ontology viewer entry point | `OntoEagle/docs/ontology-viewer.html` |
| `cq-ferret/index.html` | CQ Ferret entry point | `OntoEagle/docs/cq-ferret.html` |

## Name Conflict Rule

App suites get directories, not root-level `index.html` variants. This avoids collisions and keeps URLs stable:

| App suite | Canonical directory |
| --- | --- |
| ReasonLynx | `/` |
| OntoEagle | `/onto-eagle/` |
| Ontology Viewer | `/ontology-viewer/` transitional standalone route; intended future embedded OntoEagle view |
| CQ Ferret | `/cq-ferret/` |

Root-level `.html` files should be aliases only, not separate app copies.
