import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const binary = process.env.PATH.split(delimiter).map(p => join(p, 'renovate')).find(existsSync);
assert.ok(binary, 'Run through the pinned Renovate npm package');
const packageRoot = dirname(dirname(realpathSync(binary)));
const { init } = await import(pathToFileURL(join(packageRoot, 'dist/logger/index.js')).href);
await init();
const { isScheduledNow } = await import(pathToFileURL(join(packageRoot, 'dist/workers/repository/update/branch/schedule.js')).href);
const config = JSON.parse(readFileSync('default.json', 'utf8'));
assert.equal(config.timezone, 'Europe/Istanbul');
assert.equal(config.updateNotScheduled, false);
assert.equal(config.recreateWhen, 'auto');
const originalNow = Date.now;
try {
  for (const [now, expected] of [
    ['2026-10-18T20:59:00Z', false],
    ['2026-10-18T21:00:00Z', true],
    ['2026-10-19T02:59:00Z', true],
    ['2026-10-19T03:00:00Z', false],
    ['2026-10-20T00:00:00Z', false],
    ['2026-10-22T00:00:00Z', true],
  ]) {
    Date.now = () => Date.parse(now);
    assert.equal(isScheduledNow(config), expected, now);
    const security = { ...config, ...config.vulnerabilityAlerts };
    assert.equal(isScheduledNow(security), true);
    assert.equal(security.updateNotScheduled, true);
    assert.equal(security.minimumReleaseAge, null);
    assert.equal(security.automerge, false);
    assert.equal(security.automergeType, 'pr');
    assert.equal(security.ignoreTests, false);
  }
} finally {
  Date.now = originalNow;
}
console.log('Shared cadence and vulnerability-exception tests passed');
