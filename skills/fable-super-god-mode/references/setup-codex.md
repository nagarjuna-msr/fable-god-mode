# Setup: Codex CLI (the Codex-lane bridge)

This reference takes a machine from "no Codex" to "working bridge": the [OpenAI Codex CLI](https://developers.openai.com/codex/cli) installed and on `PATH`, authenticated, and the default model `gpt-5.6-sol` responding through the vendored bridge at `scripts/ask-codex.mjs`.

The work splits two ways, and the split is load-bearing:

- **Agent:** everything the agent can do — probes, installs (with consent), the smoke test.
- **USER:** the one thing only a human can do — the interactive browser login.

> [!IMPORTANT]
> **Data disclosure — consent gate.** Enabling this bridge means that when critiques run, **selected code snippets and files will be sent to OpenAI.** This is a real data-egress decision. **Agent:** state this plainly and get the user's explicit "yes" before touching anything. If the user has not consented, stop here — do not probe, do not install.

## 1. Overview

A finished setup satisfies three checks, in order of dependency:

1. `codex` is installed and on `PATH` (`codex --version` prints e.g. `codex-cli 0.141.0`).
2. It is authenticated (`codex login status` prints `Logged in using ChatGPT`, exit 0).
3. the model answers through the bridge — the probe returns `"probe": "probe_ok"`, exit 0.

The bridge (`scripts/ask-codex.mjs`) needs Node ≥18, has zero dependencies, runs Codex read-only-sandboxed and non-interactive, and reports a tri-state verdict (`approved` | `findings` | `codex_unavailable`) via exit codes `0` / `10` / `20` (`2` = usage error; `--probe` mode adds `30` = model_rejected). Windows is fully supported through Node — no WSL or bash needed.

## 2. Preflight (Agent, read-only)

Probe in dependency order and **report all findings before changing anything.** Nothing here mutates the machine.

```bash
node --version            # need v18.0.0 or higher
codex --version           # installed? e.g. codex-cli 0.141.0
codex login status        # authenticated? prints "Logged in using ChatGPT", exit 0
```

Route on the results:

- Node < 18 or missing → the bridge cannot run; the user must install/upgrade Node first.
- `codex` missing (`command not found`) → go to §3 (Install).
- `codex` present but `login status` nonzero / different output → go to §4 (Login).
- All three pass → skip straight to §5 (Model probe).

## 3. Install (Agent, with consent)

> Installing a CLI is a machine change. **Agent:** confirm with the user before running any install command.

Pick **one** path:

| Situation | Command |
| --- | --- |
| Node present (preferred) | `npm install -g @openai/codex` |
| macOS, user prefers Homebrew | `brew install --cask codex` |
| macOS / Linux, no Node | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` |
| Windows PowerShell | `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 \| iex"` |

Then re-probe:

```bash
codex --version
```

If this still fails with `command not found`, it is almost always `PATH` — see §6.

## 4. Login (USER)

Authentication is interactive and browser-based. **The agent cannot do this step.**

**Agent:** run — or tell the USER to run — this, then **wait**:

```bash
codex login
```

**USER:** in the browser window that opens, choose **"Sign in with ChatGPT"** and complete the flow.

**Agent:** once the user says they're done, verify with the CLI probe — never trust "I logged in" alone:

```bash
codex login status        # must print "Logged in using ChatGPT" and exit 0
```

If it still reports not logged in, retry §4 or see §6.

**Plan eligibility.** Any paid ChatGPT plan (Plus and up) includes Codex CLI. The free tier has limited quota. Codex usage counts toward the plan's agentic usage limit; run `/status` inside a Codex session to see what's left.

**API-key alternative.** API-billing users can instead authenticate with an OpenAI API key rather than a ChatGPT login; the login flow above is the recommended path for plan users.

## 5. Model probe (Agent)

The probe confirms the default model `gpt-5.6-sol` actually answers through the bridge — a cheap, non-semantic liveness check (a fixed one-line echo; no user content is sent, no review happens). The bridge always passes the model explicitly (`--model` > `CODEX_MODEL` env > default `gpt-5.6-sol`) — the CLI's built-in default has lagged behind the recommended model, so never rely on it.

Path note: `${CLAUDE_SKILL_DIR}` below means the directory containing this skill's SKILL.md — the installed skill path. During install, the path is different: INSTALLER.md Phase 4's "Probe path (binding)" rule is the single source of truth (probe from the repo clone; the installed path is verified later in its Phase 6).

```bash
node "${CLAUDE_SKILL_DIR}/scripts/ask-codex.mjs" --probe
```

**Success:** `{"probe": "probe_ok", ...}`, exit `0`. The envelope's `reported_model` is what the CLI itself printed (never inferred); record both it and `requested_model`.

**Failure:** the probe CLASSIFIES the outcome — route on it, and never treat one class as another:

| Probe outcome (exit) | Meaning | Route |
| --- | --- | --- |
| `model_rejected` (30) | The CLI POSITIVELY rejected this model id | The ONLY case that authorizes fallback: retry once with `--model gpt-5.5` and disclose the fallback; if that also rejects, ask the user which model their plan offers |
| `auth_failure` (20) | Not logged in / credentials | Back to §4 (Login). NOT a model problem — do not switch models |
| `cli_missing` (20) | `codex` not on PATH | Back to §3 (Install) |
| `network_failure` (20) | DNS / proxy / connectivity | Fix connectivity; retry. Do not switch models |
| `timeout` (20) | Run exceeded the probe timeout | Retry; if persistent, raise `--timeout` |
| `malformed_output` (20) | CLI ran but the echo did not come back | Retry once; if persistent, report honestly — the bridge chain is not verified |
| `unavailable_other` (20) | Anything ambiguous | Report the `error` field verbatim; do NOT guess a cause and do NOT fall back |

```bash
node "${CLAUDE_SKILL_DIR}/scripts/ask-codex.mjs" --probe --model gpt-5.5   # fallback probe, only after exit 30
```

The probe validates that whatever model value you use actually answers before you rely on it. Record the WORKING model.

**Compatibility policy:** the bridge is developed and tested against Codex CLI `0.141.x`–`0.144.x` and the documented `codex exec` flags (`--output-schema`, `-o`, `--sandbox`, `--ephemeral`, `--skip-git-repo-check`, `-m`). Record `codex --version` at setup. A different major/minor version is not automatically a problem — but if the bridge fails on flags or output shape after a CLI upgrade, report the version delta as the likely cause instead of debugging blind.

Windows note: the examples above use POSIX syntax — in PowerShell set the model with `$env:CODEX_MODEL = 'gpt-5.5'` before invoking `node`.

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `codex: command not found` | Not on `PATH` yet | Open a new terminal / restart the shell; re-check the install dir is on `PATH`; re-run §3 |
| Login loop or "upgrade" prompt on a valid plan | Known auth edge case | Re-run `codex login`; confirm the plan status at chatgpt.com |
| Probe exits 30 (`model_rejected`) | Plan doesn't offer `gpt-5.6-sol` | Fall back to `gpt-5.5` (disclosed), or set `CODEX_MODEL` to a model your plan offers (§5) |
| Quota exhausted | Agentic usage limit hit | Run `/status` inside a Codex session; wait for the window to reset or add credits |
| Envelope exit `20` with a timeout | Slow / transient run | Re-run; if it persists, raise the bridge's `--timeout` |

## 7. Advanced: AgentBridge (outside this installer)

For long implementation sprints that need **persistent, bidirectional** Claude ↔ Codex dialogue (not one-shot critiques), [AgentBridge](https://github.com/quilin-ai/agent-bridge) sets up live paired sessions. It is MIT-licensed; install with `npm install -g @raysonmeng/agentbridge` and pin the version you install (e.g. `v0.1.24`, current at time of writing).

AgentBridge is **not** installed, configured, or touched by this skill's installer. It carries its own data-egress profile and needs its own consent and setup. Reach for it only when persistent Codex context clearly earns its keep.
