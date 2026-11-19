import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getConfig } from 'renovate/dist/config/defaults.js';
import { getManagerConfig } from 'renovate/dist/config/index.js';
import { mergeChildConfig } from 'renovate/dist/config/utils.js';
import { init } from 'renovate/dist/logger/index.js';
import { extractPackageFile } from 'renovate/dist/modules/manager/gomod/extract.js';
import { applyPackageRules } from 'renovate/dist/util/package-rules/index.js';
import { resolveRangeStrategy } from 'renovate/dist/workers/repository/process/lookup/range-strategy.js';

await init();

test('the Go preset enables and bumps both go.mod version directives', async () => {
  const preset = JSON.parse(readFileSync(new URL('../go.json', import.meta.url), 'utf8'));
  const inherited = mergeChildConfig(getConfig(), {
    packageRules: [{ matchManagers: ['gomod'], enabled: false }],
  });
  const config = getManagerConfig(mergeChildConfig(inherited, preset), 'gomod');
  const { deps } = extractPackageFile(`module example.org/project

go 1.24.0
toolchain go1.24.1

require example.org/library v1.2.3
`);

  const effectiveRules = {};
  for (const dep of deps) {
    const resolved = await applyPackageRules({ ...config, ...dep, packageFile: 'go.mod' }, 'pre-lookup');
    effectiveRules[dep.depType] = { enabled: resolved.enabled, rangeStrategy: resolveRangeStrategy(resolved) };
  }
  assert.deepEqual(effectiveRules, {
    golang: { enabled: true, rangeStrategy: 'bump' },
    toolchain: { enabled: true, rangeStrategy: 'bump' },
    require: { enabled: false, rangeStrategy: 'replace' },
  });
});
