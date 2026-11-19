import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';

const binary = process.env.PATH.split(delimiter).map(p => join(p, 'renovate')).find(existsSync);
assert.ok(binary, 'Run through the pinned Renovate npm package');
const packageRoot = dirname(dirname(realpathSync(binary)));
const importRenovate = file => import(pathToFileURL(join(packageRoot, 'dist', file)).href);
const { init } = await importRenovate('logger/index.js');
await init();
const { getConfig } = await importRenovate('config/defaults.js');
const { mergeChildConfig } = await importRenovate('config/utils.js');
const { presetSources, resolveConfigPresets } = await importRenovate('config/presets/index.js');
const { fetchPreset, parsePreset } = await importRenovate('config/presets/util.js');
const { extractPackageFile: extractGoModule } = await importRenovate('modules/manager/gomod/extract.js');
const { api: gomodVersioning } = await importRenovate('modules/versioning/gomod/index.js');
const { resolveCurrentVersion } = await importRenovate('workers/repository/process/lookup/current.js');
const { classifyRelease } = await importRenovate('workers/repository/process/lookup/update-type.js');
const { resolveUpdateTypeConfig } = await importRenovate('workers/repository/process/lookup/filter-checks.js');

// Resolve the preset as a consumer would, with GitHub files supplied by the checkout.
presetSources.github.load = async () => ({
  getPreset({ repo, presetName = 'default', presetPath, tag }) {
    assert.equal(repo.toLowerCase(), 'zekihan/renovate-config');
    return fetchPreset({
      repo,
      filePreset: presetName,
      presetPath,
      tag,
      endpoint: 'https://example.invalid/',
      fetch: (_repo, file) => parsePreset(readFileSync(file, 'utf8'), file),
    });
  },
});
const { config: presetConfig } = await resolveConfigPresets({ extends: ['github>zekihan/renovate-config'] });
const config = mergeChildConfig(getConfig(), presetConfig);

test('generic automerge excludes v-prefixed zero-major Go module updates', async () => {
  for (const [currentValue, newVersion, expectedAutomerge] of [
    ['v0.4.2', 'v0.4.3', false],
    ['v0.4.2', 'v0.5.0', false],
    ['v1.4.2', 'v1.4.3', true],
    ['v1.4.2', 'v1.5.0', true],
  ]) {
    const [dep] = extractGoModule(`module example.org/project\n\nrequire example.org/library ${currentValue}\n`).deps;
    assert.equal(dep.skipReason, undefined);
    const releases = [{ version: dep.currentValue }, { version: newVersion }];
    const currentVersion = resolveCurrentVersion(dep.currentValue, undefined, gomodVersioning, 'replace', newVersion, releases);
    assert.equal(currentVersion, currentValue);
    const updateType = classifyRelease(gomodVersioning, currentVersion, newVersion);
    const update = await resolveUpdateTypeConfig({
      ...config,
      ...dep,
      manager: 'gomod',
      versioning: 'gomod',
      currentVersion,
      newVersion,
    }, updateType);
    assert.equal(update.automerge, expectedAutomerge, `${currentValue} → ${newVersion}`);
    assert.equal(update.automergeType, 'pr');
    assert.equal(update.ignoreTests, false);
  }
});

test('the default preset preserves GitHub Actions branch automerge', async () => {
  const actionConfig = {
    ...config,
    manager: 'github-actions',
    datasource: 'github-tags',
    depType: 'action',
    depName: 'example/action',
    packageName: 'example/action',
    versioning: 'github-actions',
    currentValue: 'v1.2.3',
    currentVersion: 'v1.2.3',
  };
  for (const [updateType, newVersion, branchAutomerge] of [
    ['minor', 'v1.3.0', true],
    ['patch', 'v1.2.4', true],
    ['digest', 'v1.2.3', true],
    ['major', 'v2.0.0', false],
  ]) {
    const { automerge, automergeType, ignoreTests } = await resolveUpdateTypeConfig({ ...actionConfig, newVersion }, updateType);
    assert.deepEqual({ automerge, automergeType, ignoreTests }, {
      automerge: branchAutomerge,
      automergeType: branchAutomerge ? 'branch' : 'pr',
      ignoreTests: branchAutomerge,
    }, `${updateType} v1.2.3 → ${newVersion}`);
  }
});
