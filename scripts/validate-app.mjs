import fs from 'node:fs';
import path from 'node:path';

const APP_ROUTES = {
  reasonlynx: 'index.html',
  'onto-eagle': 'onto-eagle/index.html',
  'ontology-viewer': 'ontology-viewer/index.html',
  'cq-ferret': 'cq-ferret/index.html',
  bundler: 'bundler/index.html',
  'tabular-ontology-maker': 'tabular-ontology-maker/index.html',
  about: 'about/index.html'
};

const appName = process.argv[2];
if (!appName || !APP_ROUTES[appName]) {
  console.error(`Usage: node scripts/validate-app.mjs <${Object.keys(APP_ROUTES).join('|')}>`);
  process.exit(2);
}

const repoRoot = process.cwd();
const htmlPath = APP_ROUTES[appName];
const failures = [];
const checkedModules = new Set();

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

function checkHtmlAsset(htmlPath, attr, specifier) {
  const localPath = normalizeLocalPath(htmlPath, specifier);
  if (!localPath) return;
  if (!fileExists(localPath)) failures.push(`Missing ${attr}: ${specifier} -> ${localPath}`);
}

if (!fileExists(htmlPath)) {
  console.error(`Missing app HTML: ${htmlPath}`);
  process.exit(1);
}

const html = fs.readFileSync(path.join(repoRoot, htmlPath), 'utf8');

for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) {
  const full = match[0];
  const specifier = match[1];
  if (full.startsWith('href=') && specifier.startsWith('#')) continue;
  checkHtmlAsset(htmlPath, full.startsWith('href=') ? 'href' : 'src', specifier);
}

for (const match of html.matchAll(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/g)) {
  const modulePath = resolveModule(htmlPath, match[1]);
  if (modulePath) scanModule(modulePath);
}

for (const match of html.matchAll(/<link\b[^>]*rel=["']modulepreload["'][^>]*href=["']([^"']+)["']/g)) {
  const modulePath = resolveModule(htmlPath, match[1]);
  if (modulePath) scanModule(modulePath);
}

if (failures.length) {
  console.error(`Validation failed for ${appName}:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Validated ${appName}: ${htmlPath}, ${checkedModules.size} modules`);
