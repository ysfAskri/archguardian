# archguardian

Pre-commit hook and CLI that catches security issues, AI-generated code smells, naming convention violations, code duplication, and architecture layer breaches. Works with TypeScript, JavaScript, Python, Go, Rust, and Java.

## Project structure

```
src/
├── cli/          Commander.js entry, 8 commands, output formatters (terminal, JSON, SARIF)
├── core/         Pipeline orchestrator, config loader, diff parser, suppression directives, baseline mode, types
├── parsers/      ast-grep NAPI parser (TS/JS/Python/Go/Rust/Java) + AST utilities
├── analyzers/    Security, AI smells, conventions, duplicates, layer violations
├── plugins/      Dynamic plugin loader for external analyzers
├── llm/          LLM client (OpenAI, Anthropic, Gemini), prompt builder, file-based cache
├── fixers/       Auto-fix engine (remove unused imports, rename conventions)
├── metrics/      Run history tracker (.archguard/metrics.json)
├── hooks/        Git hook installer (direct + Husky)
└── utils/        Git operations, logging, perf timing
```

## Build & test

- `npm run build` — tsup → dist/
- `npm test` — vitest (165 tests across unit, integration, e2e)
- `npm run typecheck` — tsc --noEmit

## Key conventions

- ESM-only (`"type": "module"`), all imports use `.js` extensions
- Node >= 18 required
- AST parsing via ast-grep NAPI (native tree-sitter bindings, not WASM)
- Tests in `tests/unit/`, `tests/integration/`, `tests/e2e/` using vitest
- Config file: `.archguard.yml` validated with Zod schemas
- Pipeline: analyzers run in parallel → deduplicate → suppress inline → filter baseline → optional LLM enhance

## CLI commands

```
archguardian init                                 Create config + install git hook
archguardian check [--format] [--update-baseline] Analyze staged changes
archguardian scan  [--format] [--update-baseline] Analyze full project
archguardian fix   [--dry-run]                    Auto-fix simple findings
archguardian learn [--apply]                      Infer conventions from codebase
archguardian rules [--json]                       List all built-in rules
archguardian metrics [--json]                     Show findings trend
archguardian dashboard [--port]                   Open web dashboard
```

## Common workflows

### Scan project
Run `npx archguardian scan --format json`, parse findings by severity, explain each finding and suggest a fix.

### Check staged changes
Run `npx archguardian check --format json` before committing. If findings exist, offer fixes or suppression.

### Auto-fix
Preview with `npx archguardian fix --dry-run`, confirm, then apply with `npx archguardian fix`.

### Baseline for incremental adoption
Create: `npx archguardian scan --update-baseline`. Future scans only show new findings.
Matching uses `ruleId + file + message` (not line numbers) — survives code edits.

### Suppress false positives
```js
// archguard-ignore                    — suppress all rules on next line
// archguard-ignore security/xss       — suppress specific rule on next line
doSomething(); // archguard-ignore-line — suppress all rules on same line
```
Python uses `#`, block comments `/* */` also work. Prefer rule-specific over blanket suppression.
