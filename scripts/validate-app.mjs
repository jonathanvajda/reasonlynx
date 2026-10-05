import fs from 'node:fs';
import path from 'node:path';

const APP_ROUTES = {
  reasonlynx: 'index.html',
  'onto-eagle': 'onto-eagle/index.html',
  'ontology-viewer': 'ontology-viewer/index.html',
  'cq-ferret': 'cq-ferret/index.html',
  bundler: 'bundler/index.html',
  'tabular-ontology-maker': 'tabular-ontology-maker/index.html',
  axiolotl: 'axiolotl/index.html',
  'graph-analyst-playbook': 'graph-analyst-playbook/index.html',
  'graph-analytics': 'graph-analytics/index.html',
  'visual-lynx': 'visual-lynx/index.html',
  'linked-data-transformer': 'linked-data-transformer/index.html',
  'ontology-compliance-diagnostic': 'ontology-compliance-diagnostic/index.html',
  'iri-swapper': 'iri-swapper/index.html',
  'sparql-pattern-visualizer': 'sparql-pattern-visualizer/index.html',
  'ontology-tabulator': 'ontology-tabulator/index.html',
  'table-nova': 'table-nova/index.html',
  docxhund: 'docxhund/index.html',
  about: 'about/index.html'
};

const requestedApp = process.argv[2];
if (!requestedApp || (requestedApp !== '--all' && !APP_ROUTES[requestedApp])) {
  console.error(`Usage: node scripts/validate-app.mjs <--all|${Object.keys(APP_ROUTES).join('|')}>`);
  process.exit(2);
}

const repoRoot = process.cwd();

function fileExists(repoRelativePath) {
  return fs.existsSync(path.join(repoRoot, repoRelativePath));
}

function normalizeLocalPath(baseFile, specifier) {
  const clean = specifier.split(/[?#]/, 1)[0];
  if (!clean || clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('mailto:') || clean.startsWith('#')) {
    return null;
  }

  const baseDir = path.dirname(baseFile);
  const relative = clean.startsWith('/')
    ? clean.slice(1)
    : path.normalize(path.join(baseDir, clean));

  return relative.split(path.sep).join('/');
}

function resolveModule(baseFile, specifier) {
  const localPath = normalizeLocalPath(baseFile, specifier);
  if (!localPath) return null;

  if (path.extname(localPath)) return localPath;
  return `${localPath}.js`;
}

/**
 * Validates one HTML entry point and its local static/module dependencies.
 *
 * @param {string} appName Registered application identifier.
 * @returns {{appName:string, htmlPath:string, moduleCount:number, failures:string[]}} Validation result.
 */
function validateApp(appName) {
  const htmlPath = APP_ROUTES[appName];
  const failures = [];
  const checkedModules = new Set();

  function scanModule(modulePath) {
    if (checkedModules.has(modulePath)) return;
    checkedModules.add(modulePath);

    if (!fileExists(modulePath)) {
      failures.push(`Missing module: ${modulePath}`);
      return;
    }

    const source = fs.readFileSync(path.join(repoRoot, modulePath), 'utf8');
    const importPattern = /from\s+['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g;
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] || match[2];
      if (!specifier || !specifier.startsWith('.')) continue;
      const resolved = resolveModule(modulePath, specifier);
      if (resolved) scanModule(resolved);
    }
  }

  function checkHtmlAsset(attr, specifier) {
    const localPath = normalizeLocalPath(htmlPath, specifier);
    if (!localPath) return;
    if (!fileExists(localPath)) failures.push(`Missing ${attr}: ${specifier} -> ${localPath}`);
  }

  if (!fileExists(htmlPath)) {
    failures.push(`Missing app HTML: ${htmlPath}`);
    return { appName, htmlPath, moduleCount: 0, failures };
  }

  const html = fs.readFileSync(path.join(repoRoot, htmlPath), 'utf8');

  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
    const full = match[0];
    const specifier = match[1];
    if (full.startsWith('href=') && specifier.startsWith('#')) continue;
    checkHtmlAsset(full.startsWith('href=') ? 'href' : 'src', specifier);
  }

  for (const match of html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/g)) {
    const modulePath = resolveModule(htmlPath, match[1]);
    if (modulePath) scanModule(modulePath);
  }

  for (const match of html.matchAll(/<link\b[^>]*rel=["']modulepreload["'][^>]*href=["']([^"']+)["']/g)) {
    const modulePath = resolveModule(htmlPath, match[1]);
    if (modulePath) scanModule(modulePath);
  }

  return { appName, htmlPath, moduleCount: checkedModules.size, failures };
}

const appNames = requestedApp === '--all' ? Object.keys(APP_ROUTES) : [requestedApp];
const results = appNames.map(validateApp);
let hasFailures = false;

for (const result of results) {
  if (result.failures.length === 0) {
    console.log(`Validated ${result.appName}: ${result.htmlPath}, ${result.moduleCount} modules`);
    continue;
  }

  hasFailures = true;
  console.error(`Validation failed for ${result.appName}:`);
  for (const failure of result.failures) console.error(`- ${failure}`);
}

if (hasFailures) process.exit(1);
console.log(`Validated ${results.length} application entry point${results.length === 1 ? '' : 's'}.`);
