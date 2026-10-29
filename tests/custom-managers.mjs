import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const binary = process.env.PATH.split(delimiter).map(p => join(p, 'renovate')).find(existsSync);
assert.ok(binary, 'Run through the pinned Renovate npm package');
const packageRoot = dirname(dirname(realpathSync(binary)));
const require = createRequire(join(packageRoot, 'package.json'));
const JSON5 = require('json5');
const { init } = await import(pathToFileURL(join(packageRoot, 'dist/logger/index.js')).href);
await init();
const { regexEngineStatus } = await import(pathToFileURL(join(packageRoot, 'dist/util/regex.js')).href);
assert.equal(regexEngineStatus.type, 'available', 'These regressions require Renovate\'s native RE2 engine');
const { extractPackageFile } = await import(pathToFileURL(join(packageRoot, 'dist/modules/manager/custom/regex/index.js')).href);
const [annotations, urls] = JSON5.parse(readFileSync('custom-managers.json5', 'utf8')).customManagers;
const failures = [];

// Exercise Renovate's regex engine and templates, without any datasource lookup.
for (const placement of ['inline', 'newline']) {
  for (const quote of ['', '"', "'"]) {
    for (const eol of ['\n', '\r\n']) {
      for (const finalEol of ['', eol]) {
        const value = `${quote}v1.2.3${quote}`;
        const annotation = '# renovate: depName=example/tool datasource=github-tags versioning=semver extractVersion=^v(?<version>.*)$';
        const content = (placement === 'inline'
          ? `  version: ${value} ${annotation}`
          : `  ${annotation}${eol}  version: ${value}`) + finalEol;
        const label = JSON.stringify({ placement, quote, eol, finalEol });
        try {
          const deps = extractPackageFile(content, 'fixture.yaml', annotations)?.deps;
          assert.equal(deps?.length, 1, label);
          assert.equal(deps[0].currentValue, 'v1.2.3', label);
          assert.equal(deps[0].depName, 'example/tool', label);
          assert.equal(deps[0].datasource, 'github-tags', label);
          assert.equal(deps[0].versioning, 'semver', label);
          assert.equal(deps[0].extractVersion, '^v(?<version>.*)$', label);
        } catch (error) {
          failures.push(`${label}: ${error.message}`);
        }
      }
    }
  }
}

// Defaults and adjacent dependencies must remain independent.
const adjacent = '# renovate: depName=example/one\nversion: v1.2.3\n# renovate: depName=example/two\nversion: "v2.3.4"\n';
const deps = extractPackageFile(adjacent, 'fixture.yaml', annotations).deps;
assert.deepEqual(deps.map(d => [d.depName, d.currentValue, d.datasource, d.versioning]), [
  ['example/one', 'v1.2.3', 'github-releases', 'semver'],
  ['example/two', 'v2.3.4', 'github-releases', 'semver'],
]);
for (const url of [
  'https://github.com/example/tool/releases/download/v1.2.3/tool.tar.gz',
  'https://raw.githubusercontent.com/example/tool/v1.2.3/config.yaml',
]) {
  const [dep] = extractPackageFile(`url: "${url}"\n`, 'fixture.yaml', urls).deps;
  assert.equal(dep.depName, 'example/tool');
  assert.equal(dep.currentValue, 'v1.2.3');
}
assert.deepEqual(failures, []);
console.log('Custom manager extraction tests passed');
