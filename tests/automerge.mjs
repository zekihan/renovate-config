import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
const { GlobalConfig } = await importRenovate('config/global.js');
const { mergeChildConfig } = await importRenovate('config/utils.js');
const { presetSources, resolveConfigPresets } = await importRenovate('config/presets/index.js');
const { fetchPreset, parsePreset } = await importRenovate('config/presets/util.js');
const { extractPackageFile: extractDockerfile } = await importRenovate('modules/manager/dockerfile/extract.js');
const { extractPackageFile: extractWorkflow } = await importRenovate('modules/manager/github-actions/extract.js');
const { extractPackageFile: extractGoModule } = await importRenovate('modules/manager/gomod/extract.js');
const { api: gomodVersioning } = await importRenovate('modules/versioning/gomod/index.js');
const { resolveCurrentVersion } = await importRenovate('workers/repository/process/lookup/current.js');
const { classifyRelease } = await importRenovate('workers/repository/process/lookup/update-type.js');
const { resolveUpdateTypeConfig } = await importRenovate('workers/repository/process/lookup/filter-checks.js');
const { branchifyUpgrades } = await importRenovate('workers/repository/updates/branchify.js');

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

test('grouped Docker digest updates cannot bypass tests for a tag patch', async () => {
  const packageFile = 'Dockerfile';
  const currentDigest = `sha256:${'a'.repeat(64)}`;
  const newDigest = `sha256:${'b'.repeat(64)}`;
  const { deps } = extractDockerfile(`FROM registry.example/fixture/api:1.2.3@${currentDigest} AS api
FROM registry.example/fixture/db:1.2.3@${currentDigest} AS db
FROM registry.example/fixture/worker:1.2.3
`, packageFile, {});

  for (const dep of deps) {
    dep.currentVersion = dep.currentValue;
    dep.updates = [dep.currentDigest
      ? { updateType: 'digest', newValue: dep.currentValue, newDigest }
      : { updateType: 'patch', newValue: '1.2.4', newVersion: '1.2.4', newMajor: 1, newMinor: 2 }];
  }

  const groupedConfig = mergeChildConfig(config, {
    errors: [],
    warnings: [],
    semanticCommits: 'disabled',
    packageRules: [{
      matchDatasources: ['docker'],
      matchPackageNames: ['registry.example/fixture/**'],
      groupName: 'Fixture images',
    }],
  });
  const { branches } = await branchifyUpgrades(groupedConfig, { dockerfile: [{ packageFile, deps }] });

  const patch = branches.find(branch => branch.upgrades.some(upgrade => upgrade.updateType === 'patch'));
  assert.ok(patch);
  assert.deepEqual({ automerge: patch.automerge, automergeType: patch.automergeType, ignoreTests: patch.ignoreTests }, {
    automerge: true,
    automergeType: 'pr',
    ignoreTests: false,
  });
  assert.deepEqual(patch.upgrades.map(upgrade => upgrade.updateType), ['patch']);

  const digests = branches.find(branch => branch.updateType === 'digest');
  assert.ok(digests);
  assert.deepEqual({ automerge: digests.automerge, automergeType: digests.automergeType, ignoreTests: digests.ignoreTests }, {
    automerge: true,
    automergeType: 'branch',
    ignoreTests: true,
  });
  assert.deepEqual(digests.upgrades.map(upgrade => upgrade.depName), [
    'registry.example/fixture/api',
    'registry.example/fixture/db',
  ]);
});

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

test('only action and reusable workflow refs get GitHub Actions branch automerge', async t => {
  GlobalConfig.set({ localDir: mkdtempSync(join(tmpdir(), 'renovate-workflow-')) });
  t.after(() => GlobalConfig.reset());
  const packageFile = '.github/workflows/fixture.yml';
  const { deps } = await extractWorkflow(`jobs:
  test:
    runs-on: ubuntu-latest
    services:
      db:
        image: registry.example/fixture/db:1.2.3@sha256:${'a'.repeat(64)}
    steps:
      - uses: actions/setup-node@v4.0.0
        with:
          node-version: '20.11.0'
  reusable:
    uses: example/fixture/.github/workflows/reusable.yml@v1.2.3
`, packageFile);

  for (const [depType, updateType, newVersion, expectedType] of [
    ['service', 'patch', '1.2.4', 'pr'],
    ['uses-with', 'patch', '20.11.1', 'pr'],
    ['service', 'digest', '1.2.3', 'branch'],
    ['workflow', 'minor', 'v1.3.0', 'branch'],
  ]) {
    await t.test(`${depType} ${updateType}`, async () => {
      const dep = deps.find(item => item.depType === depType);
      assert.ok(dep);
      assert.equal(dep.skipReason, undefined);
      const { automerge, automergeType, ignoreTests } = await resolveUpdateTypeConfig({
        ...config,
        ...dep,
        manager: 'github-actions',
        packageFile,
        packageName: dep.packageName ?? dep.depName,
        currentVersion: dep.currentValue,
        newVersion,
      }, updateType);
      assert.deepEqual({ automerge, automergeType, ignoreTests }, {
        automerge: true,
        automergeType: expectedType,
        ignoreTests: expectedType === 'branch',
      });
    });
  }
});
