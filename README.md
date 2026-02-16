<div align="center">

<!-- HERO SECTION -->
<br>

```
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║        █████╗ ██████╗  ██████╗██╗  ██╗ ██████╗ ██╗   ██╗     ║
    ║       ██╔══██╗██╔══██╗██╔════╝██║  ██║██╔════╝ ██║   ██║     ║
    ║       ███████║██████╔╝██║     ███████║██║  ███╗██║   ██║     ║
    ║       ██╔══██║██╔══██╗██║     ██╔══██║██║   ██║██║   ██║     ║
    ║       ██║  ██║██║  ██║╚██████╗██║  ██║╚██████╔╝╚██████╔╝     ║
    ║       ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝     ║
    ║                    A R D                                      ║
    ║               ─── ARCHITECTURE GUARDIAN ───                    ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
```

<br>

### 🛡️ Stop AI from slowly destroying your codebase.

<br>

[![version](https://img.shields.io/badge/version-0.1.0-CB3837?style=for-the-badge&logo=hackthebox&logoColor=white)](https://github.com/ysfAskri/archguard/releases)
[![license](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge&logo=opensourceinitiative&logoColor=white)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![typescript](https://img.shields.io/badge/TypeScript-5.6+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge&logo=github&logoColor=white)](https://github.com/ysfAskri/archguard/pulls)

<br>

**Tool-agnostic CLI + git pre-commit hook** that catches architectural violations,<br>
duplication, convention drift, security issues, and AI-specific code smells<br>
**— before code reaches the repo.**

<br>

Works with &nbsp;
<img src="https://img.shields.io/badge/Cursor-000?style=flat-square&logo=cursor&logoColor=white" alt="Cursor" />
&nbsp;
<img src="https://img.shields.io/badge/Claude_Code-CC785C?style=flat-square&logo=anthropic&logoColor=white" alt="Claude Code" />
&nbsp;
<img src="https://img.shields.io/badge/Copilot-000?style=flat-square&logo=githubcopilot&logoColor=white" alt="Copilot" />
&nbsp;
<img src="https://img.shields.io/badge/Manual_Coding-444?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Manual" />

<br><br>

[**Getting Started**](#-getting-started) · [**Features**](#-what-it-catches) · [**Config**](#%EF%B8%8F-configuration) · [**Roadmap**](#-roadmap) · [**Contributing**](#-contributing)

<br>

---

</div>

<br>

## 🤔 The Problem

AI coding tools generate code **10x faster** — but at a hidden cost:

<table>
<tr>
<td width="33%" align="center">

### 📈 8×
**more duplication**<br>
<sub>Copy-paste patterns that<br>compound over time</sub>

</td>
<td width="33%" align="center">

### 🔓 45%
**more vulnerabilities**<br>
<sub>Hardcoded secrets, SQL injection,<br>XSS vectors in generated code</sub>

</td>
<td width="33%" align="center">

### 😤 66%
**developer frustration**<br>
<sub>"AI solutions that are almost right,<br>but not quite" — Stack Overflow 2025</sub>

</td>
</tr>
</table>

> **Forrester predicts 75% of companies will face moderate-to-high technical debt severity in 2026.**
>
> No tool currently prevents these problems at commit time. **Until now.**

<br>

## ⚡ Getting Started

Three commands. Thirty seconds. Done.

```bash
# 1️⃣  Initialize in your project
npx archguard init

# 2️⃣  Scan your entire codebase
npx archguard scan

# 3️⃣  That's it — staged changes are now checked automatically before every commit
git commit -m "feat: new feature"   # archguard runs automatically 🛡️
```

<details>
<summary><b>📸 See it in action</b></summary>
<br>

```
  Scanning project...
  Found 27 files to analyze...

 Architecture Guardian
────────────────────────────────────────────────────────────

  src/api/users.ts
  ✗ Possible hardcoded AWS Access Key detected
    src/api/users.ts:12 [security/hardcoded-secret]
    suggestion: Move secrets to environment variables or a secrets manager

  ✗ Potential SQL injection: SQL keywords in template literal with interpolation
    src/api/users.ts:25 [security/sql-injection]
    suggestion: Use parameterized queries instead of string interpolation

  src/components/Dashboard.tsx
  ⚠ Excessive comment-to-code ratio: 62% comments (threshold: 40%)
    src/components/Dashboard.tsx:1 [ai-smell/excessive-comments]
    suggestion: AI-generated code often has too many obvious comments.

  ⚠ Unused import: 'useCallback'
    src/components/Dashboard.tsx:1 [ai-smell/unused-import]
    suggestion: AI tools often add imports that are never used.

  src/utils/helpers.ts
  ⚠ Function 'ProcessData' should use camelCase naming
    src/utils/helpers.ts:8 [convention/function-naming]
    suggestion: Rename to match camelCase convention

────────────────────────────────────────────────────────────
  2 errors, 3 warnings in 12 files (342ms)

  Commit blocked. Fix the issues above and try again.
```

</details>

<br>

## 🔍 What It Catches

<br>

<table>
<tr>
<td width="50%" valign="top">

### 🔒 Security Scanner

| Threat | Detection |
|:--|:--|
| **Hardcoded Secrets** | API keys, tokens, passwords — 11 regex patterns covering AWS, GitHub, Slack, Stripe, Google, JWTs, database URLs |
| **SQL Injection** | Template literals and string concatenation with SQL keywords |
| **XSS Vectors** | `innerHTML`, `outerHTML`, `dangerouslySetInnerHTML`, `document.write` |
| **Code Execution** | `eval()` and `Function()` constructor usage |
| **ReDoS** | Unsafe regex with nested quantifiers |
| **Custom Rules** | Add your own patterns via config |

</td>
<td width="50%" valign="top">

### 🤖 AI Smell Detector

| Smell | What it Flags |
|:--|:--|
| **Excessive Comments** | Comment-to-code ratio above threshold (default 40%) |
| **Unused Imports** | Declared but never referenced in AST |
| **Verbose Errors** | Catch blocks 2× larger than try blocks |
| **Copy-Paste** | Repeated code blocks within the same diff |
| **Type Hacks** | `as any` assertions, excessive `!` non-null operators |

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📏 Convention Enforcer

| Target | Convention |
|:--|:--|
| **Functions** | `camelCase` |
| **Classes / Interfaces** | `PascalCase` |
| **Constants** | `UPPER_SNAKE` |
| **Files** | `kebab-case` |

All fully configurable per project.

</td>
<td width="50%" valign="top">

### 🔮 Coming Soon

| Feature | Version |
|:--|:--|
| **Duplicate Detection** | v0.2.0 |
| **Layer Violations** | v0.2.0 |
| **Auto-Learn Conventions** | v0.2.0 |
| **Plugin System** | v0.3.0 |
| **LLM Integration** | v0.3.0 |

</td>
</tr>
</table>

<br>

## 🏗️ How It Works

```
                    ┌─────────────────────────────────────────────────────┐
                    │              ARCHITECTURE GUARDIAN                   │
                    └─────────────────────────────────────────────────────┘

  git commit        ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 ─────────────────▶ │  Parse   │──▶ │  Filter  │──▶ │   AST    │──▶ │ Analyze  │
  (pre-commit)      │  Diff    │    │  Files   │    │  Parse   │    │ (parallel)│
                    └──────────┘    └──────────┘    └──────────┘    └────┬─────┘
                                                                         │
                    ┌──────────────────────────────────────────────────────┘
                    │
                    ▼
              ┌──────────┐    ┌──────────┐         ✅ Pass → commit proceeds
              │Aggregate │──▶ │  Report  │────────▶
              │& Dedup   │    │  Output  │         ❌ Fail → commit blocked
              └──────────┘    └──────────┘
```

<table>
<tr>
<td>🧩 <b>AST-Powered</b></td>
<td>Uses <code>web-tree-sitter</code> (WASM) for real parsing — not regex hacks. Zero native compilation.</td>
</tr>
<tr>
<td>⚡ <b>Parallel</b></td>
<td>All analyzers run concurrently with <code>Promise.allSettled</code> and 5s individual timeouts.</td>
</tr>
<tr>
<td>🎯 <b>Diff-Aware</b></td>
<td>Only checks <i>changed lines</i> in pre-commit mode — no noise from existing code.</td>
</tr>
<tr>
<td>🔌 <b>Pluggable</b></td>
<td>Clean analyzer interface — bring your own rules (plugin system in v0.3.0).</td>
</tr>
</table>

<br>

## ⚙️ Configuration

Run `archguard init` or create `.archguard.yml` manually:

```yaml
# .archguard.yml
version: 1
languages: [typescript, javascript, tsx, jsx]
include: ["src/**"]
exclude: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"]

severity:
  failOn: error          # Block commits on: error | warning | info
  maxWarnings: 20        # Fail if warnings exceed this count

analyzers:
  security:
    enabled: true
    severity: error
    # customPatterns:    # Add your own regex patterns
    #   - name: "Internal API"
    #     pattern: "api\\.internal\\."
    #     severity: warning

  aiSmells:
    enabled: true
    severity: warning
    commentRatio: 0.4    # Flag files with >40% comments

  conventions:
    enabled: true
    severity: warning
    naming:
      functions: camelCase
      classes: PascalCase
      constants: UPPER_SNAKE
      files: kebab-case
    autoLearn: false      # v0.2.0: infer from existing code
```

<br>

## 🖥️ CLI Reference

```
Usage: archguard [options] [command]

Stop AI from slowly destroying your codebase.

Options:
  -V, --version   output the version number
  --verbose        enable debug logging
  -h, --help      display help for command

Commands:
  init            create config + install git hook
  check           analyze staged changes (pre-commit mode)
  scan            analyze the full project
  learn           scan codebase and infer conventions (v0.2.0)
```

<details>
<summary><b>Exit Codes</b></summary>
<br>

| Code | Meaning | When |
|:----:|:--------|:-----|
| `0` | ✅ Success | No issues found |
| `1` | ❌ Errors found | Violations at or above `failOn` severity |
| `2` | ⚠️ Warnings exceeded | More warnings than `maxWarnings` |
| `3` | 🔧 Config error | Invalid `.archguard.yml` |
| `5` | ⏱️ Timeout | Analysis exceeded time limit |

</details>

<br>

## ⚡ Performance

<table>
<tr>
<td align="center"><h3>< 400ms</h3><sub>Typical scan time</sub></td>
<td align="center"><h3>27 files</h3><sub>Full project parse</sub></td>
<td align="center"><h3>0</h3><sub>Native dependencies</sub></td>
<td align="center"><h3>WASM</h3><sub>Tree-sitter grammars</sub></td>
</tr>
</table>

> **Target: < 5 seconds** for typical diffs (1–10 files, < 500 changed lines).<br>
> Uses `web-tree-sitter` WASM — runs everywhere Node.js runs, zero compilation step.

<br>

## 🗺️ Roadmap

<table>
<tr>
<th width="120">Version</th>
<th>Features</th>
<th width="100">Status</th>
</tr>
<tr>
<td><b>v0.1.0</b></td>
<td>Security scanner · AI smell detector · Convention enforcer · CLI · Git hooks · TypeScript & JavaScript</td>
<td>✅ Released</td>
</tr>
<tr>
<td><b>v0.2.0</b></td>
<td>Duplicate detection · Layer violation checks · Python support · <code>archguard learn</code> · JSON output</td>
<td>🚧 Next</td>
</tr>
<tr>
<td><b>v0.3.0</b></td>
<td>Plugin system · LLM-powered suggestions · SARIF output · GitHub Action</td>
<td>📋 Planned</td>
</tr>
<tr>
<td><b>v1.0.0</b></td>
<td>VS Code extension · Auto-fix · Dashboard · Go / Rust / Java support · Metrics tracking</td>
<td>🔮 Future</td>
</tr>
</table>

<br>

## 🧑‍💻 Contributing

```bash
# Clone and set up
git clone https://github.com/ysfAskri/archguard.git
cd archguard
npm install

# Build
npm run build

# Run tests
npm test

# Scan itself (dogfooding!)
node dist/cli/index.js scan
```

<details>
<summary><b>Project Structure</b></summary>
<br>

```
archguard/
├── src/
│   ├── cli/                  # Commander.js CLI + commands
│   │   ├── commands/         # init, check, scan, learn
│   │   └── output/           # Terminal reporter
│   ├── core/                 # Pipeline, config, types, diff parsing
│   ├── parsers/              # Tree-sitter WASM manager + AST utils
│   ├── analyzers/            # Security, AI smells, conventions
│   ├── rules/                # Rule interface + built-in rules
│   ├── hooks/                # Git hook installer (direct + Husky)
│   └── utils/                # Git ops, logging, performance
├── wasm/                     # Bundled tree-sitter WASM grammars
├── tests/
│   ├── unit/                 # Per-module tests
│   ├── integration/          # CLI + git hook E2E tests
│   └── fixtures/             # Sample code with violations
├── .archguard.yml            # Dogfooding config
├── tsup.config.ts            # Build config
└── vitest.config.ts          # Test config
```

</details>

<br>

## 📄 License

[MIT](LICENSE) — use it, fork it, ship it.

<br>

---

<div align="center">

<br>

**Built by [Youssef ASKRI](https://github.com/ysfAskri)**

<br>

⭐ **Star this repo** if archguard saved your codebase from AI-generated chaos.

<br>

<sub>

[Report Bug](https://github.com/ysfAskri/archguard/issues) · [Request Feature](https://github.com/ysfAskri/archguard/issues) · [Discussions](https://github.com/ysfAskri/archguard/discussions)

</sub>

<br><br>

</div>
