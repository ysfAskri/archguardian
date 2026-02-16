<p align="center">
  <img src=".github/banner.png" alt="archguardian" width="700">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/archguardian"><img src="https://img.shields.io/npm/v/archguardian?style=flat-square&color=6366f1&label=npm" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A518-339933?style=flat-square" alt="node"></a>
</p>

---

**archguardian** is a pre-commit hook and CLI that catches security issues, AI-generated code smells, naming convention violations, code duplication, and architecture layer breaches — before they reach your repo. Works with TypeScript, JavaScript, Python, Go, Rust, and Java.

```bash
npx archguardian init    # adds config + git hook
npx archguardian scan    # scans full project
npx archguardian fix     # auto-fix simple findings
git commit               # hook runs automatically
```

<br>

<p align="center">
  <img src=".github/demo.svg" alt="archguardian demo" width="780">
</p>

<br>

## Why

AI coding tools generate code fast but introduce patterns that compound into debt:

- **Hardcoded secrets** that slip through review
- **Excessive comments** that restate what the code already says
- **Unused imports** from autocomplete suggestions that were never cleaned up
- **`as any` casts** and non-null assertions used to silence the type checker
- **SQL injection and XSS vectors** in generated snippets
- **Inconsistent naming** across files written by different tools

archguardian runs in <1 second on typical diffs. It uses [tree-sitter](https://tree-sitter.github.io/) WASM for real AST parsing — not regex.

## What it checks

<table>
<tr>
<td valign="top" width="33%">

**Security**
- Hardcoded secrets (11 patterns: AWS, GitHub, Slack, Stripe, Google, JWTs, DB URLs)
- SQL injection via template literals and string concat
- XSS: `innerHTML`, `dangerouslySetInnerHTML`, `document.write`
- `eval()` / `Function()` usage
- ReDoS-prone regex
- Custom patterns via config

</td>
<td valign="top" width="33%">

**AI smells**
- Comment-to-code ratio above threshold
- Unused imports (AST-verified)
- Catch blocks larger than try blocks
- Duplicate code blocks in the same diff
- `as any` type assertions
- Excessive `!` non-null operators

</td>
<td valign="top" width="33%">

**Conventions**
- Functions: `camelCase`
- Classes / interfaces: `PascalCase`
- Constants: `UPPER_SNAKE`
- Files: `kebab-case`
- All configurable per project

</td>
</tr>
<tr>
<td valign="top" width="33%">

**Duplicates**
- AST structural hashing (ignores identifiers/literals)
- Jaccard token similarity (configurable threshold)
- Fingerprint cache for incremental scans

</td>
<td valign="top" width="33%">

**Architecture**
- Define layers (UI, Service, Repository, Domain)
- Enforce allowed/denied import directions
- Catch boundary violations at commit time

</td>
<td valign="top" width="33%">

**Auto-fix**
- Remove unused imports automatically
- Rename identifiers to match conventions
- `--dry-run` to preview changes first

</td>
</tr>
</table>

## Languages

TypeScript, JavaScript, TSX, JSX, Python, Go, Rust, Java — powered by [tree-sitter](https://tree-sitter.github.io/) WASM grammars.

## Configuration

`archguardian init` creates `.archguard.yml` in your project root:

```yaml
version: 1
languages: [typescript, javascript, tsx, jsx, python, go, rust, java]
include: ["src/**"]
exclude: ["**/*.test.ts", "**/node_modules/**"]

severity:
  failOn: error       # error | warning | info
  maxWarnings: 20

analyzers:
  security:
    enabled: true
    severity: error
  aiSmells:
    enabled: true
    severity: warning
    commentRatio: 0.4
  conventions:
    enabled: true
    naming:
      functions: camelCase
      classes: PascalCase
      constants: UPPER_SNAKE
      files: kebab-case
  duplicates:
    enabled: true
    similarity: 0.85
  architecture:
    layers:
      - name: ui
        patterns: ["src/components/**", "src/pages/**"]
      - name: service
        patterns: ["src/services/**"]
      - name: repository
        patterns: ["src/repositories/**"]
    rules:
      - from: ui
        deny: [repository]

llm:
  enabled: false
  provider: openai     # openai | anthropic | gemini
  model: gpt-4o-mini
```

## CLI

```
archguardian init                  Create .archguard.yml + install git hook
archguardian check [--format]      Analyze staged changes (pre-commit mode)
archguardian scan  [--format]      Analyze full project
archguardian fix   [--dry-run]     Auto-fix simple findings
archguardian learn [--apply]       Infer conventions from codebase
archguardian rules [--json]        List all 18 built-in rules
archguardian metrics [--json]      Show findings trend over time
archguardian dashboard [--port]    Open web dashboard on localhost
```

Formats: `terminal` (default), `json`, `sarif` &mdash; Exit codes: `0` pass, `1` errors, `2` warnings exceeded, `3` config error, `5` timeout.

## LLM suggestions

Enable optional AI-powered fix suggestions. Supports OpenAI, Anthropic, and Gemini:

```yaml
llm:
  enabled: true
  provider: anthropic   # openai | anthropic | gemini
```

Set your API key via environment variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`) or in config. Suggestions are cached locally to avoid repeated calls.

## GitHub Action

```yaml
- uses: ysfAskri/archguardian@v1
  with:
    format: sarif        # uploads to GitHub Security tab
```

## Plugins

Create custom analyzers as npm packages:

```yaml
plugins:
  - archguardian-plugin-my-rules
```

Each plugin exports an analyzer class that extends the base analyzer interface. See [plugin docs](docs/) for details.

## How it works

<p align="center">
  <img src=".github/how-it-works.svg" alt="How archguardian works" width="520">
</p>

Only **changed lines** are checked in pre-commit mode — no noise from existing code.

## Roadmap

| Version | Status | What's included |
|:--------|:-------|:----------------|
| **v0.1.0** | Shipped | Security scanner, AI smell detector, convention enforcer, CLI, git hooks |
| **v0.2.0** | Shipped | Duplicate detection, layer violations, Python support, `learn`, `rules`, JSON output, metrics |
| **v0.3.0** | Shipped | Plugin system, SARIF output, GitHub Action, CI pipeline |
| **v1.0.0** | Shipped | VS Code extension, auto-fix, LLM suggestions, Go/Rust/Java support, dashboard |

## Contributing

```bash
git clone https://github.com/ysfAskri/archguardian.git
cd archguardian && npm install
npm test           # 121 tests
npm run build      # builds to dist/
```

<details>
<summary>Project structure</summary>

```
src/
├── cli/          Commander.js entry + 10 commands + output formatters (terminal, JSON, SARIF)
├── core/         Pipeline, config loader, diff parser, types
├── parsers/      Tree-sitter WASM manager (TS/JS/Python/Go/Rust/Java) + AST utilities
├── analyzers/    Security, AI smells, conventions, duplicates, layer violations
├── plugins/      Dynamic plugin loader for external analyzers
├── llm/          LLM client (OpenAI, Anthropic, Gemini), prompt builder, file-based cache
├── fixes/        Auto-fix engine (remove unused imports, rename conventions)
├── metrics/      Run history tracker (.archguard/metrics.json)
├── hooks/        Git hook installer (direct + Husky)
└── utils/        Git operations, logging, perf timing
```

</details>

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built by <a href="https://github.com/ysfAskri">Youssef ASKRI</a></sub>
</p>
