# archguardian

Pre-commit hook and CLI that catches security issues, AI-generated code smells, naming convention violations, code duplication, and architecture layer breaches. Works with TypeScript, JavaScript, Python, Go, Rust, and Java.

## Project structure

```
src/
├── cli/          Commander.js entry, 8 commands (init, check, scan, fix, learn, rules, metrics, dashboard), output formatters (terminal, JSON, SARIF)
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

```bash
npm run build       # tsup → dist/
npm test            # vitest (165 tests)
npm run typecheck   # tsc --noEmit
```

## Key conventions

- ESM-only (`"type": "module"` in package.json), all imports use `.js` extensions
- Node >= 18 required
- AST parsing via ast-grep NAPI (native tree-sitter bindings, not WASM)
- Tests in `tests/unit/`, `tests/integration/`, `tests/e2e/` using vitest
- Config file: `.archguard.yml` validated with Zod schemas
- Pipeline: analyzers run in parallel with 5s timeout each, findings are deduplicated, then suppressed, then optionally enhanced by LLM

## Available skills

- `/scan` — Run full project scan and analyze results
- `/check` — Analyze staged changes before committing
- `/fix` — Auto-fix findings (unused imports, naming)
- `/baseline` — Create/update baseline for incremental adoption
- `/suppress` — Add inline suppression comments for false positives
- `/setup` — Initialize archguardian in a new project
