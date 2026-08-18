import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, 'sw.js'), 'utf8');
const failures = [];

for (const section of ['SHELL_ASSETS', 'DATA_ASSETS']) {
  const match = source.match(new RegExp(`const ${section} = \\[([\\s\\S]*?)\\];`));
  if (!match) {
    failures.push(`Missing ${section}`);
    continue;
  }

  for (const assetMatch of match[1].matchAll(/'([^']+)'/g)) {
    const asset = assetMatch[1];
    const relativePath = asset.replace(/^\.\//, '').replace(/\/$/, '/index.html');
    if (!fs.existsSync(path.join(repoRoot, relativePath))) {
      failures.push(`Missing service worker asset: ${asset} -> ${relativePath}`);
    }
  }
}

if (failures.length) {
  console.error('Service worker validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Validated service worker asset manifest');
