# renovate-config

Shared [Renovate](https://docs.renovatebot.com/) presets. Extend the default preset:

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["github>zekihan/renovate-config"]
}
```

That loads `default.json`. A named preset is `github>zekihan/renovate-config:<name>`, which loads `<name>.json`. `custom-managers` is JSON5, so its preset id is `github>zekihan/renovate-config:custom-managers.json5`.

`default.json` extends `config:recommended`, `:dependencyDashboard`, `:disableRateLimiting`, and `:enablePreCommit`, then the presets below. Later package rules win. `automerge-github-actions` comes after `automerge-patch`, so `action` and `workflow` minor, patch, and digest updates keep branch automerge.

## Presets

- `default` — dashboard titled "Renovate Dashboard" (label `dependency/renovate`, not autoclose), label `dependency/renovate` on pull requests, reviewer `zekihan`, commit body table, `rebaseWhen: conflicted`, `platformCommit: enabled`, `configMigration: true`, and the schedule below.
- `automerge-docker-digest` — branch-automerge Docker `digest` updates and ignore tests. A grouped digest uses branch topic `{{{groupSlug}}}-docker-digest`.
- `automerge-patch` — PR-automerge `minor` and `patch` updates whose current version does not match `/^v?0/`. Tests are not ignored.
- `automerge-github-actions` — branch-automerge `minor`, `patch`, and `digest` updates for GitHub Actions `action` and `workflow` references, and ignore tests. Service images and `uses` inputs are outside this rule.
- `commit-message` — topic `{{depName}}`, extra `to {{newVersion}}`, empty suffix. Helm topics are `chart {{depName}}` and Docker topics are `image {{depName}}`. A digest pin uses extra `to {{newDigestShort}}`.
- `pr-labels` — adds `type/major`, `type/minor`, `type/patch`, or `type/digest`, plus `renovate/helm`, `renovate/container`, `renovate/ansible` (`galaxy` and `galaxy-collection`), `renovate/terraform`, `renovate/github-release` (`github-releases` and `github-tags`), and `renovate/github-action` (the `github-actions` manager).
- `semantic-commits` — enables semantic commits. Major is `feat` with a breaking `!` prefix, minor is `feat`, patch is `fix`, and digest is `chore`. Scopes are `container` (docker), `helm`, `terraform` (`terraform-provider`), and `ansible` (`galaxy` and `galaxy-collection`). GitHub Actions updates set type `ci` and scope `github-action`, which overrides the update-type commit type.
- `go` — `postUpdateOptions` includes `gomodTidy`. The `go` and `toolchain` directives (`golang` and `toolchain`) stay enabled and use `rangeStrategy: bump`.
- `helm` — adds helm-values file pattern `/(^|/)values\.[^/]*\.yaml$/` (`values.*.yaml`). The manager default still matches `values.yaml` and `values.yml`. The added pattern matches the filename, not every file in a `values.*` directory.
- `custom-managers.json5` — regex managers for `.yml`, `.yaml`, and those names with a `.j2` suffix. One reads inline or preceding `# renovate:` annotations. The other reads `github.com/.../releases/download/<version>/...` and `raw.githubusercontent.com/<owner>/<repo>/<version>/...` URLs, always as datasource `github-releases` with versioning `semver`. A third tracks versioned `go run` and `go install` commands in YAML files and Makefiles using the `go` datasource. Annotation defaults are datasource `github-releases`, versioning `semver`, and extractVersion `^(?<version>.*)$`.

## Shared update cadence

The default preset allows routine branch creation and updates every Friday
00:00–06:00 Europe/Istanbul (`* 0-5 * * 5`). `updateNotScheduled: false` prevents updates to
existing branches outside that window; `recreateWhen: auto` avoids unconditional
recreation of closed updates. The Renovate service must run within a window.
Repositories can explicitly override these settings.

GitHub vulnerability-alert fixes bypass the schedule and release-age delay, but
use tested, reviewed PRs (`schedule: []`, `updateNotScheduled: true`,
`minimumReleaseAge: null`, `automerge: false`, `ignoreTests: false`). This is not
container vulnerability scanning. Existing automerge eligibility otherwise remains unchanged.

Use Node.js 26 (`engines` is `^26.0.0`), then run `npm ci && npm run validate && npm test`.
`npm run validate` strictly validates every preset and this repository's Renovate
config. `npm test` runs the schedule, custom-manager, automerge, commit-message, Go,
Helm, and PR-label regression tests with the Renovate version pinned in `package.json`
and `package-lock.json`.
