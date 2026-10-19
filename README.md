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

Validate with the pinned Renovate package: `npm exec --yes --package renovate@44.123.0 --call 'renovate-config-validator --strict default.json && node tests/schedule.mjs'`.
