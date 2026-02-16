# Architecture Guardian - VS Code Extension

Inline diagnostics for security issues, AI code smells, and convention violations powered by the archguardian CLI.

## Features

- **Inline diagnostics** -- Security vulnerabilities, code smells, and convention violations appear directly in the editor as squiggly underlines with hover details.
- **Scan on save** -- Automatically runs archguardian when you save a file (configurable).
- **Manual scan command** -- Trigger a scan at any time with the `Archguardian: Scan Current File` command from the Command Palette.
- **Status bar indicator** -- Shows the current number of findings in the status bar. Click it to re-scan.
- **Multi-language support** -- Activates for TypeScript, JavaScript, Python, Go, Rust, and Java files.

## Requirements

- **Node.js 18+**
- **archguardian** CLI installed globally or available via npx:
  ```bash
  npm install -g archguardian
  ```

## Configuration

| Setting                      | Type    | Default | Description                        |
| ---------------------------- | ------- | ------- | ---------------------------------- |
| `archguardian.enable`        | boolean | `true`  | Enable archguardian diagnostics    |
| `archguardian.scanOnSave`    | boolean | `true`  | Run scan automatically on file save|

## Usage

1. Open a workspace that contains an `archguardian.config.*` file (or relies on default rules).
2. Save any supported file -- diagnostics will appear automatically.
3. Alternatively, open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Archguardian: Scan Current File**.

## Development

```bash
cd vscode-extension
npm install
npm run build     # compile TypeScript
npm run watch     # compile in watch mode
```

Press `F5` in VS Code to launch an Extension Development Host for testing.
