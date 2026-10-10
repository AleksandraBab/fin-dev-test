# CLAUDE.md

This is an Angular app (Angular 21.2.x — see `package.json` for the exact version).

Shared coding rules for AI assistants live in `.github/copilot-instructions.md` and apply here too:

@.github/copilot-instructions.md

## Claude Code specifics

- The `angular-developer` and `angular-new-app` skills are installed — use them for component/service/routing/forms/testing/styling guidance instead of guessing or relying on memorized Angular knowledge, since they track the version actually installed.
- The Angular CLI MCP server (`ng mcp`, configured in `.mcp.json`) is available. Prefer its tools — `get_best_practices`, `list_projects`, `run_target`, `search_documentation`, `onpush_zoneless_migration` — over ad-hoc shell commands when they cover the task.
- Key commands: `npm start` (dev server), `npm test` (unit tests via Vitest), `npm run e2e` (Playwright), `npm run lint`, `npm run build`.
- After generating or changing code, run `npm run build` to confirm there are no compile errors before considering the task done.
