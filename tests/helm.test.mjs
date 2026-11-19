import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getConfig } from 'renovate/dist/config/defaults.js';
import { getManagerConfig } from 'renovate/dist/config/index.js';
import { mergeChildConfig } from 'renovate/dist/config/utils.js';
import { init } from 'renovate/dist/logger/index.js';
import { getMatchingFiles } from 'renovate/dist/workers/repository/extract/file-match.js';

await init();

test('the Helm values overlay pattern matches the filename only', () => {
  const preset = JSON.parse(readFileSync(new URL('../helm.json', import.meta.url), 'utf8'));
  const config = getManagerConfig(mergeChildConfig(getConfig(), preset), 'helm-values');
  const valuesFiles = [
    'charts/example/values.archive/values.production.yaml',
    'charts/example/values.staging.yaml',
    'charts/example/values.yaml',
    'charts/example/values.yml',
    'values.production.yaml',
  ];
  const otherFiles = [
    'charts/example/values.archive/backup.yaml',
    'values.archive/templates/deployment.yaml',
  ];

  assert.deepEqual(getMatchingFiles(config, [...valuesFiles, ...otherFiles]), valuesFiles);
});
