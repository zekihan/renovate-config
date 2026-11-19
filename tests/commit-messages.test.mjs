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
