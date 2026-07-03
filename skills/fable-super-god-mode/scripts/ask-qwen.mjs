#!/usr/bin/env node
// ask-qwen.mjs — one of two supported fable-super-god-mode reviewer bridges.
// One-shot bridge: ask a Qwen Code model (via the Qwen Code CLI) for a
// structured critique, using the SAME CLI contract and output envelope as
// the upstream ask-codex.mjs, so it can be swapped in as fable-super-god-mode's
// reviewer bridge without touching the rest of the skill.
//
// Why this exists: this bridge targets the Qwen Code CLI
// (@qwen-code/qwen-code), which has a different non-interactive interface
// than OpenAI's Codex CLI — no `exec` subcommand, no
// --output-schema/--sandbox read-only/--ephemeral flags. It re-implements
// the same tri-state contract (approved/findings/codex_unavailable, same
// JSON envelope shape, same exit codes 0/10/20/2) against Qwen Code's actual
// CLI: non-interactive via `-p` (prompt appended to stdin) and `-o json`
// (Qwen Code emits a JSON array of session events; the bridge takes the last
// "result" event's `.result` string as the model's final answer).
//
// Verified: as of 2026-07-03 this bridge was manually smoke-tested
// end-to-end twice and both paths work: (1) an empty-findings prompt
// returned {"verdict":"approved","model":"qwen3.7-plus",...} exit 0; (2) a
// prompt containing a deliberate off-by-one bug in a clampIndex function
// returned {"verdict":"findings",...} exit 10 with two well-formed findings
// (a critical off-by-one and a medium missing-lower-bound-check). Both the
// success and findings paths are verified, not just the failure path. This
// was manual verification on one Windows machine with one Alibaba Cloud
// Model Studio account, not CI-covered.
// - Data-disclosure note: this makes the "independent second reviewer" a
//   Qwen-family model via Alibaba Cloud Model Studio, not GPT-5.5 via
//   OpenAI. Data goes to Alibaba Cloud Model Studio, not OpenAI — a
//   different data-disclosure surface than the one fable-super-god-mode's
//   setup-codex.md describes consent (C2) for.
// - Qwen Code's tool/agent/slash-command surface (visible in its `-o json`
//   init event) mirrors this project's own .claude skills/agents — it reads
//   the same Claude-Code-style config directories. That's a compatibility
//   feature of Qwen Code, not a sign anything is wrong.
//
// Usage:
//   node ask-qwen.mjs <prompt-file> [--model <id>] [--timeout <seconds>]
//
// Output: ONE JSON envelope on stdout (same shape as ask-codex.mjs):
//   { "verdict": "approved" | "findings" | "codex_unavailable",
//     "model": "...", "summary": "...", "findings": [...],
//     "error": null | "...", "elapsed_ms": N }
// Exit codes (unchanged from ask-codex.mjs, for skill-side compatibility):
//   0 approved | 10 findings | 20 codex_unavailable (no review happened) | 2 usage error
//
// Invocation notes:
// - Full prompt (+ appended output contract) goes via stdin; -p only carries
//   a short fixed directive, so no variable/user content ever reaches argv.
// - Windows: qwen ships only as an npm .cmd/.ps1 shim (no native qwen.exe),
//   so child_process.spawn without a shell always fails EINVAL there (Node's
//   CVE-2024-27980 hardening) — this bridge always retries via a quoted
//   cmd.exe invocation on win32, refusing to run (fails closed) if any
//   shell-bound string contains '%' or a newline. Model ids are
//   whitelist-validated, so no user-controlled text reaches cmd syntax.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MODEL = "qwen3.7-plus";
const DEFAULT_TIMEOUT_S = 600;
const EXIT = { approved: 0, findings: 10, codex_unavailable: 20, usage: 2 };
const SEVERITIES = ["critical", "high", "medium", "low"];
const PROMPT_FLAG_VALUE = "Follow the instructions and content provided on stdin.";

const t0 = Date.now();

function usageError(msg) {
  process.stderr.write(
    `ask-qwen.mjs: ${msg}\n` +
      `usage: node ask-qwen.mjs <prompt-file> [--model <id>] [--timeout <seconds>]\n`
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
      "usage: node ask-qwen.mjs <prompt-file> [--model <id>] [--timeout <seconds>]\n" +
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

const model = modelFlag ?? process.env.QWEN_MODEL ?? DEFAULT_MODEL;
if (!/^[A-Za-z0-9._:-]{1,64}$/.test(model)) {
  usageError(
    `invalid model id ${JSON.stringify(model)} (from ${
      modelFlag ? "--model" : "QWEN_MODEL"
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
  JSON.parse(schemaText);
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

--- OUTPUT CONTRACT (appended by ask-qwen.mjs) ---
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

// ---------- temp output (debugging only, for schema-mismatch retention) ----------
let tmpDir;
try {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ask-qwen-"));
} catch (e) {
  unavailable(`cannot create temp dir: ${e.message}`);
}

function cleanupTmp() {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

// ---------- spawn qwen ----------
// Note: qwen's -s/--sandbox flag requires a Docker image pull
// (ghcr.io/qwenlm/qwen-code) and fails hard if Docker/that image isn't
// available, so it's deliberately omitted here rather than assumed present.
const cliArgs = ["-p", PROMPT_FLAG_VALUE, "-o", "json", "-m", model, "--safe-mode"];
const timeoutMs = timeoutS * 1000;

function runQwen({ viaShell }) {
  return new Promise((resolve) => {
    let child;
    let settled = false;
    let timedOut = false;
    let stderrBuf = "";
    let stdoutBuf = "";
    const opts = { stdio: ["pipe", "pipe", "pipe"], windowsHide: true };
    try {
      if (viaShell) {
        // Windows npm shim (qwen.cmd): must go through cmd.exe (no native
        // qwen.exe is distributed). Inside cmd double quotes, % still expands
        // and cannot be escaped from the command line, so refuse (fail
        // closed) rather than run unsafely.
        const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
        const shellCmd = ["qwen", ...cliArgs].map(q).join(" ");
        if (/[%\r\n]/.test(shellCmd)) {
          resolve({
            spawnError: new Error(
              "a path or argument contains '%' or a newline, which cannot pass " +
                "safely through cmd.exe"
            ),
          });
          return;
        }
        child = spawn(shellCmd, { ...opts, shell: true });
      } else {
        child = spawn("qwen", cliArgs, opts);
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
      const giveUp = setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve({ code: null, signal: null, stdout: stdoutBuf, stderr: stderrBuf, timedOut: true });
      }, 25_000);
      giveUp.unref();
    }, timeoutMs);

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ spawnError: err });
    });
    child.stdout.on("data", (d) => {
      stdoutBuf += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderrBuf = (stderrBuf + d.toString()).slice(-65536);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout: stdoutBuf, stderr: stderrBuf, timedOut });
    });

    child.stdin.on("error", () => {
      /* EPIPE if qwen exits before reading all of stdin */
    });
    child.stdin.end(payload);
  });
}

let run = await runQwen({ viaShell: false });
if (
  run.spawnError &&
  process.platform === "win32" &&
  (run.spawnError.code === "ENOENT" || run.spawnError.code === "EINVAL")
) {
  run = await runQwen({ viaShell: true });
}

if (run.spawnError) {
  cleanupTmp();
  unavailable(
    run.spawnError.code === "ENOENT"
      ? "qwen CLI not found on PATH — install @qwen-code/qwen-code (npm install -g @qwen-code/qwen-code)"
      : `could not launch qwen CLI: ${run.spawnError.message}`
  );
}

function lastLine(s) {
  const lines = (s || "").trim().split(/\r?\n/).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

if (run.timedOut) {
  cleanupTmp();
  unavailable(`qwen run exceeded ${timeoutS}s and was killed — re-run or raise --timeout`);
}
if (run.code !== 0) {
  const hint = lastLine(run.stderr);
  cleanupTmp();
  unavailable(
    `qwen exited with code ${run.code}${run.signal ? ` (signal ${run.signal})` : ""}${
      hint ? `: ${hint}` : ""
    }`
  );
}

// ---------- parse qwen's event-array output ----------
if (!run.stdout || !run.stdout.trim()) {
  cleanupTmp();
  unavailable("qwen produced no stdout output");
}

let events;
try {
  events = JSON.parse(run.stdout);
} catch (e) {
  const rawOutFile = path.join(tmpDir, "raw-stdout.txt");
  try {
    fs.writeFileSync(rawOutFile, run.stdout, "utf8");
  } catch {}
  unavailable(`qwen -o json output was not valid JSON: ${e.message}`, {
    raw_output_file: rawOutFile,
  });
}
if (!Array.isArray(events)) {
  cleanupTmp();
  unavailable("qwen -o json output was not a JSON array of events");
}

const resultEvent = [...events].reverse().find((e) => e && e.type === "result");
if (!resultEvent) {
  cleanupTmp();
  unavailable('no "result" event found in qwen output');
}
if (resultEvent.is_error) {
  cleanupTmp();
  unavailable(
    `qwen reported an error: ${
      typeof resultEvent.result === "string" ? resultEvent.result : JSON.stringify(resultEvent)
    }`
  );
}

const rawText = typeof resultEvent.result === "string" ? resultEvent.result : "";
if (!rawText.trim()) {
  cleanupTmp();
  unavailable("qwen produced no output (empty result)");
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
  verdict = findings.length > 0 ? "findings" : "approved";
}

if (failure) {
  const rawOutFile = path.join(tmpDir, "raw-result.txt");
  try {
    fs.writeFileSync(rawOutFile, rawText, "utf8");
  } catch {}
  unavailable(`verdict did not match schema: ${failure}`, { raw_output_file: rawOutFile });
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
