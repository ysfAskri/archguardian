<p align="center">
  <img src=".github/banner.png" alt="archguardian" width="700">
</p>

<h3 align="center">The code quality guardrail for AI-assisted development</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/archguardian"><img src="https://img.shields.io/npm/v/archguardian?style=flat-square&color=6366f1&label=npm" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="license"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A518-339933?style=flat-square" alt="node"></a>
  <img src="https://img.shields.io/badge/languages-8-blueviolet?style=flat-square" alt="languages">
  <img src="https://img.shields.io/badge/rules-18-orange?style=flat-square" alt="rules">
</p>

<p align="center">
  <a href="#use-with-ai-coding-tools"><img src="https://img.shields.io/badge/Claude_Code-skills-d97706?style=flat-square&logo=anthropic&logoColor=white" alt="Claude Code"></a>
  <a href="#use-with-ai-coding-tools"><img src="https://img.shields.io/badge/Cursor-commands-00b4d8?style=flat-square&logo=cursor&logoColor=white" alt="Cursor"></a>
  <a href="#use-with-ai-coding-tools"><img src="https://img.shields.io/badge/Copilot-prompts-1f883d?style=flat-square&logo=githubcopilot&logoColor=white" alt="GitHub Copilot"></a>
  <a href="#use-with-ai-coding-tools"><img src="https://img.shields.io/badge/Windsurf-workflows-0ea5e9?style=flat-square&logo=codeium&logoColor=white" alt="Windsurf"></a>
  <a href="#use-with-ai-coding-tools"><img src="https://img.shields.io/badge/Cline-rules-a855f7?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0wIDE4Yy00LjQyIDAtOC0zLjU4LTgtOHMzLjU4LTggOC04IDggMy41OCA4IDgtMy41OCA4LTggOHoiLz48L3N2Zz4=" alt="Cline"></a>
  <a href="#use-with-ai-coding-tools"><img src="https://img.shields.io/badge/Aider-compatible-22c55e?style=flat-square" alt="Aider"></a>
</p>

<p align="center">
  Cursor, Copilot, Claude Code &mdash; they write code 10x faster.<br>
  <strong>archguardian</strong> makes sure that code doesn't wreck your codebase.
</p>

---

```bash
npx archguardian init    # adds config + git hook — one command, done
npx archguardian scan    # full project scan
npx archguardian fix     # auto-fix findings
git commit               # hook blocks bad code automatically
```

<br>

<p align="center">
  <img src=".github/demo.svg" alt="archguardian demo" width="780">
</p>

<br>

## The problem

You're shipping faster than ever with AI coding tools. But speed without guardrails is how you end up with:

- **Hardcoded API keys** that Copilot autocompleted from training data
- **Unused imports** that Cursor added and never cleaned up
- **`as any` everywhere** because the AI couldn't figure out the types
- **Copy-paste blocks** generated 5 times with slightly different variable names
- **Architecture violations** where the AI imported the database layer directly from UI components
- **Inconsistent naming** across files — `camelCase` here, `snake_case` there, `PascalCase` somewhere else

Code review catches some of it. But at 3 PRs a day with 500+ lines of AI-generated code each, reviewers are overwhelmed.

**archguardian catches all of it, automatically, before the commit even happens.**

## How it works

<p align="center">
  <img src=".github/how-it-works.svg" alt="How archguardian works" width="520">
</p>

1. You commit code (written by you, Copilot, Cursor, Claude, or any AI tool)
2. archguardian's pre-commit hook kicks in — analyzes **only changed lines**
3. Real AST parsing via [ast-grep](https://ast-grep.github.io/) (native tree-sitter bindings) — not regex hacks
4. 18 built-in rules across 5 analyzers run in parallel in under 1 second
5. Bad code gets blocked with clear, actionable messages. Clean code passes instantly.

## What it catches

<table>
<tr>
<td valign="top" width="33%">

**Security**
- Hardcoded secrets (AWS, GitHub, Slack, Stripe, Google, JWTs, DB URLs &mdash; 11 patterns)
- SQL injection via template literals
- XSS: `innerHTML`, `dangerouslySetInnerHTML`, `document.write`
- `eval()` / `Function()` usage
- ReDoS-prone regex
- Custom patterns via config

</td>
<td valign="top" width="33%">

**AI code smells**
- Excessive comment-to-code ratio
- Unused imports (AST-verified, not regex)
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
- AST structural hashing (ignores variable names and literals)
- Jaccard token similarity (configurable threshold)
- Catches the "AI generated 5 similar functions" pattern

</td>
<td valign="top" width="33%">

**Architecture**
- Define layers (UI, Service, Repository, Domain)
- Enforce allowed/denied import directions
- Catches boundary violations at commit time

</td>
<td valign="top" width="33%">

**Auto-fix**
- Remove unused imports automatically
- Rename identifiers to match conventions
- `--dry-run` to preview before applying

</td>
</tr>
</table>

## Works with your stack

TypeScript, JavaScript, TSX, JSX, Python, Go, Rust, Java &mdash; powered by [ast-grep](https://ast-grep.github.io/) native tree-sitter bindings. Real AST parsing, not regex pattern matching.

## Quick start

```bash
# Install and initialize in your project
npx archguardian init
```

That's it. archguardian creates `.archguard.yml` and installs a git pre-commit hook. Every commit is now guarded.

### Configuration

```yaml
version: 1
languages: [typescript, javascript, python, go, rust, java]
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
```

## Adopting on an existing codebase

Don't want 500 warnings on day one? Use baseline mode:

```bash
archguardian scan --update-baseline      # snapshot current state
archguardian scan                         # only shows NEW findings from now on
```

Findings are matched by `ruleId + file + message` (not line number), so baseline entries survive code edits.

## Inline suppression

Silence false positives without disabling rules globally:

```js
// archguard-ignore security/xss
el.innerHTML = sanitized;                   // suppress specific rule

doSomething(); // archguard-ignore-line     // suppress all rules on this line
```

Works with `//`, `#`, and `/* */` comment styles.

## CLI reference

```
archguardian init                                 Create config + install git hook
archguardian check [--format] [--update-baseline] Analyze staged changes (pre-commit)
archguardian scan  [--format] [--update-baseline] Analyze full project
archguardian fix   [--dry-run]                    Auto-fix findings
archguardian learn [--apply]                      Infer conventions from your codebase
archguardian rules [--json]                       List all 18 built-in rules
archguardian metrics [--json]                     Findings trend over time
archguardian dashboard [--port]                   Web dashboard on localhost
```

Output formats: `terminal` (default), `json`, `sarif`

Exit codes: `0` pass, `1` errors found, `2` warnings exceeded threshold, `3` config error

## Use with AI coding tools

archguardian ships with ready-made slash commands for all major AI coding assistants. After `npx archguardian init`, just type `/scan`, `/fix`, or `/check` in your AI tool.

| Command | What it does |
|:--------|:-------------|
| `/scan` | Full project scan, findings grouped by severity |
| `/check` | Analyze staged changes before committing |
| `/fix` | Auto-fix unused imports and naming violations |
| `/baseline` | Snapshot current findings for incremental adoption |
| `/suppress` | Add inline suppression comments for false positives |
| `/setup` | Initialize archguardian in a new project |

### Claude Code

archguardian includes [skills](https://code.claude.com/docs/en/skills) (`.claude/skills/`) that register as slash commands automatically.

```
.claude/skills/
├── scan/SKILL.md        →  /scan
├── check/SKILL.md       →  /check
├── fix/SKILL.md         →  /fix
├── baseline/SKILL.md    →  /baseline
├── suppress/SKILL.md    →  /suppress
└── setup/SKILL.md       →  /setup
```

**How it works:** Clone or install archguardian, and the skills are available immediately. Type `/scan` in Claude Code and it runs `npx archguardian scan --format json`, parses findings, explains each one, and offers to fix or suppress.

Skills use [SKILL.md frontmatter](https://code.claude.com/docs/en/skills#frontmatter-reference) with `allowed-tools`, `$ARGUMENTS` substitution, and `description` fields so Claude can also invoke them automatically when relevant.

### Cursor

archguardian includes both [rules](https://docs.cursor.com/context/rules) (`.cursor/rules/`) for background context and [slash commands](https://docs.cursor.com/chat/custom-commands) (`.cursor/commands/`) for invocable actions.

```
.cursor/
├── rules/
│   ├── archguardian.mdc    # Always-on project context
│   ├── scan.mdc            # Agent-requested scan context
│   ├── check.mdc           # Agent-requested check context
│   ├── fix.mdc             # Agent-requested fix context
│   ├── baseline.mdc        # Agent-requested baseline context
│   └── suppress.mdc        # Agent-requested suppress context
└── commands/
    ├── scan.md              →  /scan
    ├── check.md             →  /check
    ├── fix.md               →  /fix
    ├── baseline.md          →  /baseline
    ├── suppress.md          →  /suppress
    └── setup.md             →  /setup
```

Type `/scan` in Cursor Agent chat to run a full project scan.

### GitHub Copilot

archguardian includes [prompt files](https://code.visualstudio.com/docs/copilot/customization/prompt-files) (`.github/prompts/`) that register as slash commands in VS Code.

```
.github/
├── copilot-instructions.md      # Always-on project context
└── prompts/
    ├── scan.prompt.md            →  /scan
    ├── check.prompt.md           →  /check
    ├── fix.prompt.md             →  /fix
    ├── baseline.prompt.md        →  /baseline
    └── suppress.prompt.md        →  /suppress
```

Type `/scan` in Copilot Chat to run a full project scan.

### Windsurf

archguardian includes [workflows](https://docs.windsurf.com/windsurf/cascade/workflows) (`.windsurf/workflows/`) and [rules](https://docs.windsurf.com/windsurf/cascade/rules) (`.windsurf/rules/`).

```
.windsurf/
├── rules/
│   └── rules.md                 # Always-on project context
└── workflows/
    ├── scan.md                   →  /scan
    ├── check.md                  →  /check
    ├── fix.md                    →  /fix
    ├── baseline.md               →  /baseline
    ├── suppress.md               →  /suppress
    └── setup.md                  →  /setup
```

Type `/scan` in Windsurf Cascade to run a full project scan.

### Cline

archguardian includes [rules](https://docs.cline.bot/features/cline-rules) (`.clinerules/`) for project context. Cline also auto-detects the `.cursor/rules/` files.

### Aider

archguardian works with Aider via the `.aider.conf.yml` config which loads `CLAUDE.md` as read-only context:

```yaml
read:
  - CLAUDE.md
```

> **Tip**: All commands use `--format json` under the hood. JSON output is structured and easier for AI tools to parse, explain, and act on.

## CI/CD

### GitHub Action

```yaml
- uses: ysfAskri/archguardian@v1
  with:
    format: sarif        # uploads to GitHub Security tab
```

### Any CI

```bash
npx archguardian scan --format sarif > results.sarif
```

## LLM-powered suggestions

Get AI-powered fix suggestions for findings. Supports OpenAI, Anthropic, and Gemini:

```yaml
llm:
  enabled: true
  provider: anthropic   # openai | anthropic | gemini
```

Set your API key via `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`. Responses are cached locally to avoid repeated API calls.

## Plugins

Extend with custom analyzers:

```yaml
plugins:
  - archguardian-plugin-my-rules
```

Each plugin exports an analyzer class. See [plugin docs](docs/) for details.

## Comparison

| | archguardian | ESLint | SonarQube |
|:---|:---:|:---:|:---:|
| AI-specific code smells | Yes | No | No |
| Architecture layer enforcement | Yes | No | Partial |
| Duplicate detection (AST-based) | Yes | No | Yes |
| Pre-commit hook (zero config) | Yes | Manual | No |
| Runs in < 1 second | Yes | Depends | No |
| 8 languages, one tool | Yes | JS/TS only | Yes |
| Free & open source | Yes | Yes | Paid |

## Contributing

```bash
git clone https://github.com/ysfAskri/archguardian.git
cd archguardian && npm install
npm test           # 165 tests
npm run build      # builds to dist/
```

<details>
<summary>Project structure</summary>

```
src/
├── cli/          Commander.js entry + 8 commands + output formatters (terminal, JSON, SARIF)
├── core/         Pipeline, config loader, diff parser, suppression, baseline, types
├── parsers/      ast-grep NAPI parser (TS/JS/Python/Go/Rust/Java) + AST utilities
├── analyzers/    Security, AI smells, conventions, duplicates, layer violations
├── plugins/      Dynamic plugin loader for external analyzers
├── llm/          LLM client (OpenAI, Anthropic, Gemini), prompt builder, file-based cache
├── fixers/       Auto-fix engine (remove unused imports, rename conventions)
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
