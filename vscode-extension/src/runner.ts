import { execFile } from "child_process";

export interface Finding {
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: "error" | "warning" | "info";
  rule: string;
  category: string;
}

export interface ScanResult {
  findings: Finding[];
  scannedFiles: number;
  duration: number;
}

const SCAN_TIMEOUT_MS = 60_000;

/**
 * Execute the archguardian CLI and return parsed scan results.
 *
 * Runs `npx archguardian scan --format json` inside the given workspace
 * directory.  The CLI is expected to print a JSON object to stdout that
 * conforms to the {@link ScanResult} interface.
 */
export function runArchguardian(workspacePath: string): Promise<ScanResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "npx",
      ["archguardian", "scan", "--format", "json"],
      {
        cwd: workspacePath,
        timeout: SCAN_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
        shell: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          // Provide a human-readable message for the most common failures.
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            reject(
              new Error(
                "archguardian CLI not found. Install it with: npm install -g archguardian"
              )
            );
            return;
          }
          if (error.killed) {
            reject(
              new Error(
                `archguardian scan timed out after ${SCAN_TIMEOUT_MS / 1000}s`
              )
            );
            return;
          }
          reject(
            new Error(
              `archguardian scan failed: ${stderr?.trim() || error.message}`
            )
          );
          return;
        }

        try {
          const result: ScanResult = JSON.parse(stdout);
          resolve(result);
        } catch {
          reject(
            new Error(
              `Failed to parse archguardian output as JSON: ${stdout.slice(0, 200)}`
            )
          );
        }
      }
    );

    // Guard against the child process handle itself failing to spawn.
    child.on("error", (err) => {
      reject(new Error(`Failed to start archguardian: ${err.message}`));
    });
  });
}
