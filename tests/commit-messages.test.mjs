import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getConfig } from 'renovate/dist/config/defaults.js';
import { presetSources, resolveConfigPresets } from 'renovate/dist/config/presets/index.js';
import { fetchPreset, parsePreset } from 'renovate/dist/config/presets/util.js';
import { mergeChildConfig } from 'renovate/dist/config/utils.js';
import { init } from 'renovate/dist/logger/index.js';
import { branchifyUpgrades } from 'renovate/dist/workers/repository/updates/branchify.js';

await init();

// Use the checkout for preset files and synthetic updates in place of a datasource lookup.
presetSources.github.load = async () => ({
  getPreset({ repo, presetName = 'default', presetPath, tag }) {
    assert.equal(repo, 'zekihan/renovate-config');
    return fetchPreset({
      repo,
      filePreset: presetName,
      presetPath,
      tag,
      endpoint: 'https://example.invalid/',
      fetch: (_repo, file) => parsePreset(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), file),
    });
  },
});

async function buildBranch(packageFiles, ...presets) {
  const { config: presetConfig } = await resolveConfigPresets({
    extends: ['github>zekihan/renovate-config', ...presets],
  });
  const config = mergeChildConfig({ ...getConfig(), errors: [], warnings: [] }, presetConfig);
  const { branches } = await branchifyUpgrades(config, packageFiles);
  assert.equal(branches.length, 1);
  return branches[0];
}

function majorUpdate() {
  return {
    npm: [{
      packageFile: 'package.json',
      deps: [{
        datasource: 'npm',
        depType: 'dependencies',
        depName: 'fixture-library',
        packageName: 'fixture-library',
        currentValue: '1.2.3',
        currentVersion: '1.2.3',
        updates: [{ updateType: 'major', newValue: '2.0.0', newVersion: '2.0.0', newMajor: 2 }],
      }],
    }],
  };
}

test('major updates preserve the default scope', async () => {
  const { commitMessage, prTitle } = await buildBranch(majorUpdate());
  assert.match(prTitle, /^feat\(deps\)!: /);
  assert.equal(commitMessage.split('\n')[0], prTitle);
});

test('major updates omit the scope when the consumer disables it', async () => {
  const { commitMessage, prTitle } = await buildBranch(majorUpdate(), ':semanticCommitScopeDisabled');
  assert.match(prTitle, /^feat!: /);
  assert.equal(commitMessage.split('\n')[0], prTitle);
});

function pinAction(depName, newDigest) {
  const tag = 'v1.2.3';
  return {
    datasource: 'github-tags',
    depType: 'action',
    depName,
    packageName: depName,
    currentValue: tag,
    currentVersion: tag,
    updates: [{ updateType: 'pinDigest', newValue: tag, newDigest }],
  };
}

test('a single digest pin identifies the new digest', async () => {
  const action = pinAction('example/fixture-action', `1234567${'a'.repeat(33)}`);
  const { commitMessage, prTitle } = await buildBranch({
    'github-actions': [{ packageFile: '.github/workflows/fixture.yml', deps: [action] }],
  }, 'helpers:pinGitHubActionDigests');
  assert.equal(prTitle, 'ci(github-action): pin example/fixture-action to 1234567');
  assert.equal(commitMessage.split('\n')[0], prTitle);
});

test('grouped digest pins use a common title', async () => {
  const actions = [
    pinAction('example/one', 'a'.repeat(40)),
    pinAction('example/two', 'b'.repeat(40)),
  ];
  const { upgrades, prTitle } = await buildBranch({
    'github-actions': [{ packageFile: '.github/workflows/fixture.yml', deps: actions }],
  }, 'helpers:pinGitHubActionDigests');
  assert.equal(upgrades.length, 2);
  assert.equal(prTitle, 'ci(github-action): pin dependencies');
});
