import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getConfig } from 'renovate/dist/config/defaults.js';
import { mergeChildConfig } from 'renovate/dist/config/utils.js';
import { init } from 'renovate/dist/logger/index.js';
import { setPlatformApi } from 'renovate/dist/modules/platform/index.js';
import { prepareLabels } from 'renovate/dist/workers/repository/update/pr/labels.js';
import { branchifyUpgrades } from 'renovate/dist/workers/repository/updates/branchify.js';

await init();
setPlatformApi('github');

const preset = JSON.parse(readFileSync(new URL('../pr-labels.json', import.meta.url), 'utf8'));
const config = mergeChildConfig({ ...getConfig(), errors: [], warnings: [] }, {
  ...preset,
  labels: ['team/fixture'],
  semanticCommits: 'disabled',
});

test('update-type labels are added alongside repository and datasource labels', async t => {
  for (const [updateType, newVersion] of [
    ['major', '2.0.0'],
    ['minor', '1.3.0'],
    ['patch', '1.2.4'],
    ['digest', '1.2.3'],
  ]) {
    await t.test(updateType, async () => {
      const { branches } = await branchifyUpgrades(config, {
        dockerfile: [{
          packageFile: 'Dockerfile',
          deps: [{
            depName: 'registry.example/fixture/image',
            datasource: 'docker',
            currentValue: '1.2.3',
            currentVersion: '1.2.3',
            currentDigest: `sha256:${'a'.repeat(64)}`,
            updates: [{ updateType, newVersion, newValue: newVersion, newDigest: `sha256:${'b'.repeat(64)}` }],
          }],
        }],
      });
      assert.equal(branches.length, 1);
      assert.deepEqual(prepareLabels(branches[0]), ['renovate/container', 'team/fixture', `type/${updateType}`]);
    });
  }
});
