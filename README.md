# renovate-config
renovate-config

## Shared update cadence

The default preset allows routine branch creation and updates every Friday
00:00–06:00 Europe/Istanbul. `updateNotScheduled: false` prevents updates to
existing branches outside that window; `recreateWhen: auto` avoids unconditional
recreation of closed updates. The Renovate service must run within a window.
Repositories can explicitly override these settings.

GitHub vulnerability-alert fixes bypass the schedule and release-age delay, but
use tested, reviewed PRs. This is not container vulnerability scanning. Existing
automerge eligibility otherwise remains unchanged.

Use Node.js 24 (at least 24.11.0), then run `npm ci && npm run validate && npm test`.
`npm run validate` strictly validates every preset and the repository's Renovate
config. `npm test` runs the schedule and custom-manager regression tests with the
Renovate version pinned in `package.json` and `package-lock.json`.
