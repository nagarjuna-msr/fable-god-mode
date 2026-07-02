#!/usr/bin/env node
// ask-codex.mjs — one-shot bridge: ask GPT-5.5 (via the OpenAI Codex CLI) for a
// structured critique. Part of Fable Super God Mode (fable-god-mode repo).
// Zero runtime dependencies. Node >= 18. Cross-platform (macOS / Linux / Windows).
//
// Usage:
//   node ask-codex.mjs <prompt-file> [--model <id>] [--timeout <seconds>]
//
//   <prompt-file>   Text/markdown file containing the FULL, self-contained critique
//                   request. Its content (plus a fixed output-contract suffix) is the
//                   ONLY input this bridge sends — no environment dumps. Codex runs in
//                   a read-only sandbox from the current directory, so the prompt MAY
//                   point it at absolute paths to read.
//   --model <id>    Codex model id. Precedence: --model > CODEX_MODEL env > "gpt-5.5".
//   --timeout <s>   Seconds before the codex run is killed (default 600).
//
// Output: ONE JSON envelope on stdout:
//   { "verdict": "approved" | "findings" | "codex_unavailable",
//     "model": "...", "summary": "...", "findings": [...],
//     "error": null | "...", "elapsed_ms": N }
//
// Exit codes (tri-state verdict — deliberately NOT fail-open):
//   0   approved           GPT-5.5 reviewed and found nothing to report
//   10  findings           GPT-5.5 reviewed and reported findings (see envelope)
//   20  codex_unavailable  NO review happened (codex missing / auth / timeout / bad
//                          output). The caller MUST surface this to the user — an
//                          outage must never read as a clean review.
//   2   usage error        bad arguments or broken vendoring — a caller/install bug
//
// Invocation notes:
// - The prompt is piped to `codex exec -` on stdin and stdin is closed (EOF).
//   Passing the prompt as an argv while stdin stays open is a known hang trap.
// - `--output-schema` asks the CLI to enforce references/verdict-schema.json on the
//   model's final message; the output contract appended to the prompt is a second
//   line of defense, and this bridge validates the parsed JSON regardless.
// - Windows: a native codex.exe on PATH is used directly; npm's codex.cmd shim
//   cannot be spawned without a shell (Node CVE-2024-27980 hardening), so the
//   bridge falls back to a quoted cmd.exe invocation for that case. The fallback
//   refuses to run (fails closed to codex_unavailable) if any shell-bound string
//   contains characters cmd.exe cannot carry safely (% or newlines), and model
//   ids are whitelist-validated, so no user-controlled text reaches cmd syntax.
// - On a schema-mismatch failure the codex output is kept for debugging (the
//   envelope's raw_output_file points at it) in an ask-codex-* dir under the OS
//   temp dir; all other paths clean up. OS temp cleaning eventually removes
//   retained ones; callers may delete them sooner.
//
// Data disclosure: running this sends the prompt file's contents — and any files
// Codex reads while handling it — to OpenAI.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_TIMEOUT_S = 600;
const EXIT = { approved: 0, findings: 10, codex_unavailable: 20, usage: 2 };
const SEVERITIES = ["critical", "high", "medium", "low"];

const t0 = Date.now();

function usageError(msg) {
  process.stderr.write(
    `ask-codex.mjs: ${msg}\n` +
      `usage: node ask-codex.mjs <prompt-file> [--model <id>] [--timeout <seconds>]\n`
  );
  process.exit(EXIT.usage);
}

// ---------- argv ----------
const argv = process.argv.slice(2);
let promptFile = null;
let modelFlag = null;
let timeoutFlag = null;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-h" || a === "--help") {
    process.stdout.write(
      "usage: node ask-codex.mjs <prompt-file> [--model <id>] [--timeout <seconds>]\n" +
        "exit codes: 0 approved | 10 findings | 20 codex_unavailable | 2 usage error\n"
    );
    process.exit(0);
  } else if (a === "--model") {
    modelFlag = argv[++i];
    if (!modelFlag) usageError("--model requires a value");
  } else if (a === "--timeout") {
    timeoutFlag = argv[++i];
    if (!timeoutFlag || !/^\d+$/.test(timeoutFlag) || Number(timeoutFlag) <= 0)
      usageError("--timeout requires a positive integer (seconds)");
  } else if (a === "-") {
    usageError("reading the prompt from stdin is not supported; pass a file path");
  } else if (a.startsWith("-")) {
    usageError(`unknown flag: ${a}`);
  } else if (promptFile === null) {
    promptFile = a;
  } else {
    usageError(`unexpected extra argument: ${a}`);
  }
}

if (!promptFile) usageError("missing <prompt-file>");

const model = modelFlag ?? process.env.CODEX_MODEL ?? DEFAULT_MODEL;
// Whitelist the model id — it is the only user-controlled string that can reach
// the Windows cmd.exe fallback's command line.
if (!/^[A-Za-z0-9._:-]{1,64}$/.test(model)) {
  usageError(
    `invalid model id ${JSON.stringify(model)} (from ${
      modelFlag ? "--model" : "CODEX_MODEL"
    }): only [A-Za-z0-9._:-] allowed`
  );
}
const timeoutS = timeoutFlag ? Number(timeoutFlag) : DEFAULT_TIMEOUT_S;

let promptText;
try {
  promptText = fs.readFileSync(promptFile, "utf8");
} catch (e) {
  usageError(`cannot read prompt file ${promptFile}: ${e.message}`);
}
if (!promptText.trim()) usageError(`prompt file is empty: ${promptFile}`);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(scriptDir, "..", "references", "verdict-schema.json");
let schemaText;
try {
  schemaText = fs.readFileSync(schemaPath, "utf8");
  JSON.parse(schemaText); // vendored file must itself be valid JSON
} catch (e) {
  usageError(
    `vendored schema missing or invalid at ${schemaPath} (${e.message}); ` +
      `keep scripts/ and references/ together as shipped`
  );
}

// ---------- payload ----------
const payload =
  promptText.replace(/\s+$/, "") +
  `

--- OUTPUT CONTRACT (appended by ask-codex.mjs) ---
Respond with ONLY a single JSON object matching this JSON Schema — no prose before or after, no code fences:
${schemaText.trim()}
Use verdict "approved" only when you found nothing worth reporting; otherwise use "findings" and list each item. Report real issues only; do not invent findings to seem useful.
`;

// ---------- envelope ----------
function emit(envelope) {
  process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
  process.exit(EXIT[envelope.verdict]);
}

function unavailable(error, extra = {}) {
  emit({
    verdict: "codex_unavailable",
    model,
    summary: "",
    findings: [],
    error,
    elapsed_ms: Date.now() - t0,
    ...extra,
  });
}

// ---------- temp output ----------
let tmpDir;
try {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ask-codex-"));
} catch (e) {
  unavailable(`cannot create temp dir: ${e.message}`);
}
const outFile = path.join(tmpDir, "verdict.json");

function cleanupTmp() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

// ---------- spawn codex ----------
const cliArgs = [
  "exec",
  "-",
  "--output-schema",
  schemaPath,
  "-o",
  outFile,
  "--sandbox",
  "read-only",
  "--skip-git-repo-check",
  "--ephemeral",
  "--color",
  "never",
  "-m",
  model,
];

const timeoutMs = timeoutS * 1000;

function runCodex({ viaShell }) {
  return new Promise((resolve) => {
    let child;
    let settled = false;
    let timedOut = false;
    let stderrBuf = "";
    const opts = { stdio: ["pipe", "ignore", "pipe"], windowsHide: true };
    try {
      if (viaShell) {
        // Windows npm shim (codex.cmd) path: must go through cmd.exe.
        // Inside cmd double quotes, % still expands and cannot be escaped from
        // the command line, so refuse (fail closed) rather than run unsafely.
        const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
        const shellCmd = ["codex", ...cliArgs].map(q).join(" ");
        if (/[%\r\n]/.test(shellCmd)) {
          resolve({
            spawnError: new Error(
              "a path or argument contains '%' or a newline, which cannot pass " +
                "safely through cmd.exe — install the native codex binary " +
                "(https://developers.openai.com/codex/cli) or move the skill to a " +
                "path without those characters"
            ),
          });
          return;
        }
        child = spawn(shellCmd, { ...opts, shell: true });
      } else {
        child = spawn("codex", cliArgs, opts);
      }
    } catch (e) {
      resolve({ spawnError: e });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill("SIGTERM");
      } catch {}
      if (process.platform === "win32" && child.pid) {
        // cmd.exe fallback runs codex as a grandchild; kill the whole tree.
        try {
          spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
            stdio: "ignore",
            windowsHide: true,
          }).on("error", () => {});
        } catch {}
      }
      const hardKill = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {}
      }, 10_000);
      hardKill.unref();
      // If the child never emits `close` (kill failed or reaped elsewhere),
      // settle anyway so the bridge cannot hang past its deadline.
      const giveUp = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ code: null, signal: null, stderr: stderrBuf, timedOut: true });
      }, 25_000);
      giveUp.unref();
    }, timeoutMs);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ spawnError: err });
    });
    child.stderr.on("data", (d) => {
      stderrBuf = (stderrBuf + d.toString()).slice(-65536);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stderr: stderrBuf, timedOut });
    });

    child.stdin.on("error", () => {
      /* EPIPE if codex exits before reading all of stdin */
    });
    child.stdin.end(payload);
  });
}

let run = await runCodex({ viaShell: false });
if (
  run.spawnError &&
  process.platform === "win32" &&
  (run.spawnError.code === "ENOENT" || run.spawnError.code === "EINVAL")
) {
  // Native codex.exe not found — retry through cmd.exe for the npm .cmd shim.
  run = await runCodex({ viaShell: true });
}

if (run.spawnError) {
  cleanupTmp();
  unavailable(
    run.spawnError.code === "ENOENT"
      ? "codex CLI not found on PATH — install it (e.g. `npm install -g @openai/codex`) and run `codex login`"
      : `could not launch codex CLI: ${run.spawnError.message}`
  );
}

function lastLine(s) {
  const lines = (s || "").trim().split(/\r?\n/).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

if (run.timedOut) {
  cleanupTmp();
  unavailable(`codex run exceeded ${timeoutS}s and was killed — re-run or raise --timeout`);
}
if (run.code !== 0) {
  const hint = lastLine(run.stderr);
  cleanupTmp();
  unavailable(
    `codex exited with code ${run.code}${run.signal ? ` (signal ${run.signal})` : ""}${
      hint ? `: ${hint}` : ""
    } — if this mentions auth, run \`codex login\``
  );
}

// ---------- parse & validate verdict ----------
let rawText = "";
try {
  rawText = fs.readFileSync(outFile, "utf8");
} catch {
  /* handled below as empty */
}
if (!rawText.trim()) {
  cleanupTmp();
  unavailable("codex produced no output (empty final message)");
}

function extractJson(text) {
  let t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {}
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(t.slice(first, last + 1));
    } catch {}
  }
  return null;
}

function coerceFinding(f) {
  const s = (x) => (typeof x === "string" ? x : x == null ? "" : JSON.stringify(x));
  if (typeof f !== "object" || f === null) {
    return { severity: "medium", category: "unstructured", where: "", issue: s(f), suggestion: "" };
  }
  return {
    severity: SEVERITIES.includes(f.severity) ? f.severity : "medium",
    category: s(f.category),
    where: s(f.where),
    issue: s(f.issue),
    suggestion: s(f.suggestion),
  };
}

const parsed = extractJson(rawText);
let failure = null;
let verdict = null;
let summary = "";
let findings = [];

// Strict shape validation — a malformed response is NOT a trustworthy review,
// so every violation below fails closed to codex_unavailable. Item-level
// sloppiness inside a valid findings array is merely coerced: it can only ever
// preserve or strengthen a findings verdict, never manufacture an approval.
if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
  failure = "response was not a JSON object";
} else if (parsed.verdict !== "approved" && parsed.verdict !== "findings") {
  failure = `invalid verdict value: ${JSON.stringify(parsed.verdict)}`;
} else if (!Array.isArray(parsed.findings)) {
  failure = "findings is not an array";
} else if (typeof parsed.summary !== "string") {
  failure = "summary is not a string";
} else if (parsed.verdict === "findings" && parsed.findings.length === 0) {
  failure = 'verdict is "findings" but the findings list is empty';
} else {
  findings = parsed.findings.map(coerceFinding);
  summary = parsed.summary;
  // Never downgrade signal: any reported finding forces the findings verdict.
  verdict = findings.length > 0 ? "findings" : "approved";
}

if (failure) {
  // Keep the raw output for debugging; a review we cannot parse is NOT a review.
  unavailable(`verdict did not match schema: ${failure}`, { raw_output_file: outFile });
}

cleanupTmp();
emit({
  verdict,
  model,
  summary,
  findings,
  error: null,
  elapsed_ms: Date.now() - t0,
});
