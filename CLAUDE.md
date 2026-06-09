# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection of shared [Renovate](https://docs.renovatebot.com/) preset configurations. Other repositories consume these presets via `github>zekihan/renovate-config:preset-name` in their `renovate.json`.

No build, test, or lint commands exist — this is a pure JSON/JSON5 config repo.

## File roles

- `default.json` — the main composed preset; extends all other presets in this repo plus Renovate's `config:recommended`. Used as the top-level shared config.
- `renovate.json` — self-hosted config for this repo itself; extends `default.json` via `github>Zekihan/renovate-config`.
- `automerge-docker-digest.json` — branch-automerge for Docker digest updates (ignoreTests: true).
- `automerge-github-actions.json` — branch-automerge for GitHub Actions minor/patch/digest (ignoreTests: true).
- `automerge-patch.json` — PR-automerge for patch/minor updates to stable (non-`0.x`) packages; tests must pass.
- `commit-message.json` — standardizes commit message format; prefixes helm/docker updates with `chart`/`image`.
- `custom-managers.json5` — regex custom managers that parse YAML files for inline `# renovate:` annotations and raw GitHub download/raw URLs.
- `go.json` — enables `gomodTidy` post-update and sets `bump` range strategy for Go toolchain deps.
- `helm.json` — configures `helm-values` manager to match `values.*.yaml` file patterns.
- `pr-labels.json` — applies labels by update type (`type/major`, `type/patch`, etc.) and datasource (`renovate/helm`, `renovate/container`, etc.).
- `semantic-commits.json` — maps update types to semantic commit types (`feat`/`fix`/`chore`/`ci`) and scopes per datasource/manager.

## Conventions

- All files must include `"$schema": "https://docs.renovatebot.com/renovate-schema.json"` as the first field.
- `custom-managers.json5` uses JSON5 format (allows comments and unquoted keys); all others use strict JSON.
- When adding a new preset file, also add it to the `extends` array in `default.json`.
- The automerge presets distinguish between `automergeType: "branch"` (no PR required, used for low-risk digest/CI updates) and `automergeType: "pr"` (PR required with passing tests, used for patch/minor updates).
