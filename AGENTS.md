# AGENTS.md

This file provides guidance to AI Agents when working with code in this repository.

## What this repo is

A collection of shared [Renovate](https://docs.renovatebot.com/) preset configurations. Other repositories consume these presets via `github>zekihan/renovate-config:preset-name` in their `renovate.json`.

This is a JSON/JSON5 config repo. Use Node.js 26 (`package.json` `engines` is `^26.0.0`) and run `npm ci && npm run validate && npm test` before committing. The npm scripts strictly validate every preset and run the regression tests with the pinned Renovate dependency. There is no build step. See README.md for how presets are extended.

## File roles

- `default.json` — the main composed preset. Extends `config:recommended`, `:dependencyDashboard`, `:disableRateLimiting`, `:enablePreCommit`, and every other preset in this repo. Also sets the shared schedule, dashboard, `dependency/renovate` label, reviewer, and vulnerability-alert exception. Loaded when the preset name is omitted.
- `renovate.json` — config for this repo itself; extends the default preset via `github>Zekihan/renovate-config`.
- `automerge-docker-digest.json` — branch-automerge for Docker `digest` updates (`ignoreTests: true`). Grouped digests use branch topic `{{{groupSlug}}}-docker-digest`.
- `automerge-github-actions.json` — branch-automerge for GitHub Actions `action` and `workflow` minor/patch/digest updates (`ignoreTests: true`). It does not match service images or `uses` inputs. It is extended after `automerge-patch`, so those refs keep branch automerge.
- `automerge-patch.json` — PR-automerge for `minor` and `patch` updates whose current version does not match `/^v?0/`; tests are not ignored.
- `commit-message.json` — topic `{{depName}}`, extra `to {{newVersion}}`, empty suffix. Helm and Docker topics are `chart {{depName}}` and `image {{depName}}`. Digest pins use extra `to {{newDigestShort}}`.
- `custom-managers.json5` — regex managers for `.ya?ml` and `.ya?ml.j2`. One reads inline or preceding `# renovate:` annotations. The other reads GitHub release-download URLs and `raw.githubusercontent.com` URLs. Extend it as `custom-managers.json5`.
- `go.json` — adds `gomodTidy`. Enables the `go` and `toolchain` directives (`golang` and `toolchain`) and sets their `rangeStrategy` to `bump`.
- `helm.json` — adds helm-values pattern `/(^|/)values\.[^/]*\.yaml$/`. This is merged with the manager default, which still matches `values.yaml` and `values.yml`.
- `pr-labels.json` — adds `type/major`, `type/minor`, `type/patch`, and `type/digest`, plus datasource labels (`renovate/helm`, `renovate/container`, `renovate/ansible`, `renovate/terraform`, `renovate/github-release`) and `renovate/github-action` for the `github-actions` manager.
- `semantic-commits.json` — major `feat` with a breaking `!` prefix, minor `feat`, patch `fix`, digest `chore`. Scopes: docker `container`, helm `helm`, terraform-provider `terraform`, galaxy `ansible`. GitHub Actions sets type `ci` and scope `github-action`, overriding the update-type commit type.

## Conventions

- All Renovate config files must include `"$schema": "https://docs.renovatebot.com/renovate-schema.json"` as the first field.
- `custom-managers.json5` uses JSON5 format (allows comments and unquoted keys); all others use strict JSON.
- When adding a new preset file, also add it to the `extends` array in `default.json`.
- The automerge presets distinguish between `automergeType: "branch"` (no PR required, used for low-risk digest/CI updates) and `automergeType: "pr"` (PR required with passing tests, used for patch/minor updates).
