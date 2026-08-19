<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Demo verification policy

Use verification proportional to the change. Preserve the existing test and build scripts; do not run every check by default.

- UI copy, styling, layout, and static assets: lint only changed files and run `pnpm typecheck`. Do not run the full test suite, build, or browser automation unless the change affects behavior or the user asks for it.
- Pure utility or business-logic changes: add or run the focused test file plus `pnpm typecheck`.
- API, database, auth, uploads, storage, deployment, or cross-cutting state: run focused tests and a direct endpoint check. Add broader checks only when they validate the changed risk.
- Before a Git push, deployment, or an explicit request for a release-quality check: run the relevant full suite (`pnpm test`, `pnpm build`) and report the exact evidence.
- Never retry a check merely to create more evidence. State any intentionally skipped verification briefly in the handoff.
