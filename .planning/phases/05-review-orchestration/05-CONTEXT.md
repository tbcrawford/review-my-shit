# Phase 5: Review Orchestration — Context

**Phase:** 05
**Created:** 2026-04-06
**Status:** Planning complete — executing

---

## Goal

Wire the `/review` entry command: scope selection (local/PR), session creation, pipeline sequencing, file-existence verification at each handoff.

## Requirements Covered

- **DIFF-01**: User can choose local git diff or PR diff as the review input, selected per invocation
- **DIFF-03**: PR diff is fetched via GitHub REST API using a user-configured token
- **DIFF-04**: User can specify an optional focus area when invoking review
- **PIPE-01**: User can invoke `/review` as a slash command in OpenCode
- **PIPE-02**: User can invoke `/review` as a slash command in Cursor

## Success Criteria

1. User can invoke `/review local` and receive a `REPORT.md` generated from staged/uncommitted git changes
2. User can invoke `/review pr <number>` and receive a `REPORT.md` generated from a GitHub PR diff
3. User can append a focus area (e.g., `/review local --focus security`) and see the reviewer emphasis reflected in the report
4. If the PR fetch fails or the diff is empty, the command exits with a clear error message rather than producing an empty report
5. Pipeline fails loudly if a previous step's output file is missing — no silent partial runs

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Orchestration model | Wire to Node.js CLI (Option A) | Phases 1–4 built a fully functional Node.js pipeline (88 tests); natural completion |
| Focus area flag | Unified `--focus` for both local and PR | Consistent interface; simpler mental model |
| PR session slug | `pr-{number}-{branch}` | Descriptive; includes branch for human readability |
| PR auth | `GITHUB_TOKEN` env var | Standard convention; no OAuth complexity needed |
| PR API client | Built-in `fetch` (no Octokit) | Node ≥18 already required; zero extra dependency |
| Local session slug | `local-{nanoid(4)}` suffix | Prevents collision when two reviews run same day |

## Plans

- [x] 05-01: Wire command files to Node.js CLI + local review (success criteria 1, 3, 4, 5)
- [x] 05-02: PR diff fetching via GitHub REST API (success criteria 2, 4)

## Pitfalls Identified

1. **Cursor shell injection**: OpenCode supports `!command` prefix; Cursor does not — use prose-with-CLI-call pattern for Cursor templates
2. **Branch name sanitization**: PR branch names may contain slashes (`feature/thing`) — `sanitizeSlug` in `session.ts` must handle this for `pr-{number}-{branch}` slug
3. **Session slug collision**: Local sessions used `local` hardcoded — appending `nanoid(4)` suffix prevents overwrite on same-day runs
4. **Empty diff vs network failure**: Both must produce user-facing errors, not silent empty reports
