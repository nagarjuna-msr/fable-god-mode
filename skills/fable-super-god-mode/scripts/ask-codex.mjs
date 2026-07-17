#!/usr/bin/env node
// ask-codex.mjs — one-shot bridge to the Codex lane (the OpenAI Codex CLI) for a
// structured critique. Part of Fable Super God Mode (fable-god-mode repo).
// Zero runtime dependencies. Node >= 18. Cross-platform (macOS / Linux / Windows).
//
// Usage:
//   node ask-codex.mjs <prompt-file> [--model <id>] [--timeout <seconds>]
//   node ask-codex.mjs --probe      [--model <id>] [--timeout <seconds>]
//
//   <prompt-file>   Text/markdown file containing the FULL, self-contained critique
//                   request. Its content (plus a fixed output-contract suffix) is the
//                   ONLY input this bridge sends — no environment dumps. Codex runs in
//                   a read-only sandbox from the current directory, so the prompt MAY
//                   point it at absolute paths to read.
//   --probe         Cheap non-semantic liveness/model check: sends a fixed one-line
//                   echo request (no user content, no schema) and CLASSIFIES the
//                   outcome. Used by the installer and for fallback decisions.
//   --model <id>    Codex model id. Precedence: --model > CODEX_MODEL env > "gpt-5.6-sol".
//   --timeout <s>   Seconds before the codex run is killed (default 600; probe 120).
//
// Critique output: ONE JSON envelope on stdout:
//   { "verdict": "approved" | "findings" | "codex_unavailable",
//     "model": "...",              // legacy alias of requested_model
//     "requested_model": "...",    // what this bridge asked for
//     "reported_model": "...",     // what the CLI itself reported (null if absent —
//                                  // NEVER inferred)
//     "summary": "...", "findings": [...],
//     "error": null | "...", "elapsed_ms": N }
//
// Probe output: ONE JSON envelope on stdout:
//   { "probe": "probe_ok" | "model_rejected" | "auth_failure" | "cli_missing" |
//              "network_failure" | "timeout" | "malformed_output" | "unavailable_other",
//     "requested_model": "...", "reported_model": "..."|null,
//     "error": null | "...", "elapsed_ms": N }
//
// Exit codes (tri-state verdict — deliberately NOT fail-open):
//   0   approved / probe_ok   review clean, or probe answered correctly
//   10  findings              the review reported findings (see envelope)
//   20  codex_unavailable     NO review/probe happened (codex missing / auth /
//                             timeout / bad output). The caller MUST surface this —
//                             an outage must never read as a clean review, and it
//                             NEVER justifies a model fallback by itself.
//   30  model_rejected        probe only: the CLI POSITIVELY rejected the requested
//                             model id. This is the ONLY outcome that authorizes a
//                             documented fallback (e.g. gpt-5.6-sol -> gpt-5.5),
//                             and the fallback must be disclosed to the user.
//   2   usage error           bad arguments or broken vendoring — a caller/install bug
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
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL = "gpt-5.6-sol";
const DEFAULT_TIMEOUT_S = 600;
const DEFAULT_PROBE_TIMEOUT_S = 120;
const EXIT = {
  approved: 0,
  probe_ok: 0,
  findings: 10,
  codex_unavailable: 20,
  auth_failure: 20,
  cli_missing: 20,
  network_failure: 20,
  timeout: 20,
  malformed_output: 20,
  unavailable_other: 20,
  model_rejected: 30,
  usage: 2,
};
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
let probeMode = false;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-h" || a === "--help") {
    process.stdout.write(
      "usage: node ask-codex.mjs <prompt-file> [--model <id>] [--timeout <seconds>]\n" +
        "       node ask-codex.mjs --probe [--model <id>] [--timeout <seconds>]\n" +
        "exit codes: 0 approved/probe_ok | 10 findings | 20 codex_unavailable | 30 model_rejected (probe) | 2 usage error\n"
    );
    process.exit(0);
  } else if (a === "--probe") {
    probeMode = true;
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

if (probeMode && promptFile) usageError("--probe takes no <prompt-file>");
if (!probeMode && !promptFile) usageError("missing <prompt-file>");

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
const timeoutS = timeoutFlag
  ? Number(timeoutFlag)
  : probeMode
    ? DEFAULT_PROBE_TIMEOUT_S
    : DEFAULT_TIMEOUT_S;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(scriptDir, "..", "references", "verdict-schema.json");

// ---------- payload ----------
const probeNonce = probeMode ? crypto.randomBytes(4).toString("hex") : null;
let payload;
if (probeMode) {
  payload = `Reply with exactly this text on one line and nothing else: PROBE_OK ${probeNonce}\n`;
} else {
  let promptText;
  try {
    promptText = fs.readFileSync(promptFile, "utf8");
  } catch (e) {
    usageError(`cannot read prompt file ${promptFile}: ${e.message}`);
  }
  if (!promptText.trim()) usageError(`prompt file is empty: ${promptFile}`);

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

  payload =
    promptText.replace(/\s+$/, "") +
    `

--- OUTPUT CONTRACT (appended by ask-codex.mjs) ---
Respond with ONLY a single JSON object matching this JSON Schema — no prose before or after, no code fences:
${schemaText.trim()}
Use verdict "approved" only when you found nothing worth reporting; otherwise use "findings" and list each item. Report real issues only; do not invent findings to seem useful.
`;
}

// ---------- envelope ----------
// reported_model: parsed ONLY from the CLI's own banner/metadata (a line like
// "model: <id>"), never inferred. Absent metadata => null.
let reportedModel = null;
function parseReportedModel(stderr) {
  const m = /(?:^|\n)\s*model:\s*([A-Za-z0-9._:-]{1,64})\s*(?:\r?\n|$)/i.exec(stderr || "");
  if (m) reportedModel = m[1];
}

function emit(envelope) {
  process.stdout.write(JSON.stringify(envelope, null, 2) + "\n");
  process.exit(EXIT[envelope.verdict ?? envelope.probe]);
}

function emitProbe(outcome, error = null) {
  emit({
    probe: outcome,
    requested_model: model,
    reported_model: reportedModel,
    error,
    elapsed_ms: Date.now() - t0,
  });
}

function unavailable(error, extra = {}) {
  if (probeMode) {
    // Probe callers classify; a generic failure here is unavailable_other.
    emitProbe("unavailable_other", error);
  }
  emit({
    verdict: "codex_unavailable",
    model,
    requested_model: model,
    reported_model: reportedModel,
    summary: "",
    findings: [],
    error,
    elapsed_ms: Date.now() - t0,
    ...extra,
  });
}

// ---------- probe outcome classification (POSITIVE matches only) ----------
// The fallback rule depends on this: only an explicit, positively-classified
// model rejection may authorize a model fallback. Ambiguous failures classify
// as unavailable_other, which forbids fallback.
// ORDER MATTERS: auth is classified BEFORE model rejection, because auth errors
// often mention the word "model" ("no access token for model ...") and must
// never authorize a fallback. Model rejection requires a phrase BOUND to the
// model — two loose words anywhere in stderr are not evidence.
function classifyProbeFailure(stderr) {
  const s = stderr || "";
  const has = (re) => re.test(s);
  if (has(/(not\s+logged\s+in|log\s*in|login|auth(?:enticat|oriz)\w*|credential|access\s+token|401)/i))
    return "auth_failure";
  if (
    has(/model[^\n]{0,60}?\b(?:is\s+)?(?:unknown|invalid|unsupported|not\s+(?:found|supported|available|recognized|authorized))/i) ||
    has(/\b(?:unknown|invalid|unsupported|unavailable)\s+model\b/i) ||
    has(/no\s+access\s+to\s+(?:the\s+)?model/i)
  )
    return "model_rejected";
  if (has(/(is\s+not\s+recognized\s+as\s+an?\s+(?:internal|external)|command\s+not\s+found|\bnot\s+recognized\b[^\n]{0,40}command)/i))
    return "cli_missing";
  if (has(/(ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EAI_AGAIN|network|proxy|\bdns\b|tls|connect(?:ion)?\s+(?:failed|refused|error))/i))
    return "network_failure";
  return "unavailable_other";
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
  ...(probeMode ? [] : ["--output-schema", schemaPath]),
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

parseReportedModel(run.stderr);

if (run.spawnError) {
  cleanupTmp();
  const msg =
    run.spawnError.code === "ENOENT"
      ? "codex CLI not found on PATH — install it (e.g. `npm install -g @openai/codex`) and run `codex login`"
      : `could not launch codex CLI: ${run.spawnError.message}`;
  if (probeMode)
    emitProbe(run.spawnError.code === "ENOENT" ? "cli_missing" : "unavailable_other", msg);
  unavailable(msg);
}

function lastLine(s) {
  const lines = (s || "").trim().split(/\r?\n/).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

if (run.timedOut) {
  cleanupTmp();
  const msg = `codex run exceeded ${timeoutS}s and was killed — re-run or raise --timeout`;
  if (probeMode) emitProbe("timeout", msg);
  unavailable(msg);
}
if (run.code !== 0) {
  const hint = lastLine(run.stderr);
  cleanupTmp();
  const msg = `codex exited with code ${run.code}${run.signal ? ` (signal ${run.signal})` : ""}${
    hint ? `: ${hint}` : ""
  } — if this mentions auth, run \`codex login\``;
  if (probeMode) emitProbe(classifyProbeFailure(run.stderr), msg);
  unavailable(msg);
}

// ---------- probe: verify the echoed reply is EXACTLY the requested line ----------
if (probeMode) {
  let probeText = "";
  try {
    probeText = fs.readFileSync(outFile, "utf8");
  } catch {
    /* handled below as empty */
  }
  cleanupTmp();
  const expected = `PROBE_OK ${probeNonce}`;
  // Byte-for-byte equality; at most one terminal newline is tolerated.
  if (probeText === expected || probeText === expected + "\n") {
    emitProbe("probe_ok");
  }
  emitProbe(
    "malformed_output",
    `probe reply was not exactly the expected line (got: ${JSON.stringify(
      probeText.slice(0, 120)
    )})`
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
  requested_model: model,
  reported_model: reportedModel,
  summary,
  findings,
  error: null,
  elapsed_ms: Date.now() - t0,
});
