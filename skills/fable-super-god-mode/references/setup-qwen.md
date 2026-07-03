# Setup: Qwen Code CLI (Qwen bridge)

This reference takes a machine from "no Qwen Code" to "working bridge": the [Qwen Code CLI](https://github.com/QwenLM/qwen-code) (`@qwen-code/qwen-code`) installed and on `PATH`, authenticated against Alibaba Cloud Model Studio (DashScope), and `qwen3.7-plus` responding through the vendored bridge at `scripts/ask-qwen.mjs`.

The work splits two ways, and the split is load-bearing:

- **Agent:** everything the agent can do — probes, installs (with consent), the smoke test.
- **USER:** the one thing only a human can do — obtaining and supplying an Alibaba Cloud Model Studio API key.

> [!IMPORTANT]
> **Data disclosure — consent gate.** Enabling this bridge means that when critiques run, **selected code snippets and files will be sent to Alibaba Cloud Model Studio.** This is a real data-egress decision. **Agent:** state this plainly and get the user's explicit "yes" before touching anything. If the user has not consented, stop here — do not probe, do not install.

## 1. Overview

A finished setup satisfies three checks, in order of dependency:

1. `qwen` is installed and on `PATH` (`qwen --version` prints a version, e.g. `0.19.6`).
2. An API key is configured for Qwen Code's OpenAI-compatible provider mode (via `DASHSCOPE_API_KEY` or `~/.qwen/settings.json`).
3. `qwen3.7-plus` answers through the bridge — the smoke test returns a JSON envelope with verdict `approved` or `findings`.

The bridge (`scripts/ask-qwen.mjs`) needs Node ≥18, has zero dependencies, runs Qwen Code non-interactively with `--safe-mode`, and reports a tri-state verdict (`approved` | `findings` | `codex_unavailable`) via exit codes `0` / `10` / `20` (`2` = usage error) — the same envelope shape and exit codes as the Codex bridge, so the rest of the skill doesn't need to know which provider answered. Windows is fully supported through Node — no WSL or bash needed.

**Important asymmetry vs. the Codex path:** Qwen Code CLI has no login-status subcommand, so there is no CLI-native "am I logged in" probe equivalent to `codex login status`. Auth validity can **only** be proven by actually invoking the bridge (§5, the model probe). Preflight (§2) can check only that a key looks *present* (an env var is set, or a settings.json entry exists) — never that it's *valid*.

## 2. Preflight (Agent, read-only)

Probe in dependency order and **report all findings before changing anything.** Nothing here mutates the machine.

```bash
node --version             # need v18.0.0 or higher
qwen --version              # installed? e.g. 0.19.6
```

Then check presence (not validity — see §1) of an API key:

```bash
# POSIX
echo "${DASHSCOPE_API_KEY:+set}"          # prints "set" if the env var is present
test -f ~/.qwen/settings.json && echo "settings.json present"
```

```powershell
# PowerShell
if ($env:DASHSCOPE_API_KEY) { "set" }
Test-Path "$HOME\.qwen\settings.json"
```

Route on the results:

- Node < 18 or missing → the bridge cannot run; the user must install/upgrade Node first.
- `qwen` missing (`command not found`) → go to §3 (Install).
- `qwen` present but no `DASHSCOPE_API_KEY` and no `~/.qwen/settings.json` → go to §4 (Login/Auth).
- Key looks present → do **not** assume it's valid; still run §5 (Model probe) — that is the only real proof.

## 3. Install (Agent, with consent)

> Installing a CLI is a machine change. **Agent:** confirm with the user before running any install command.

```bash
npm install -g @qwen-code/qwen-code
```

Then re-probe:

```bash
qwen --version
```

If this still fails with `command not found`, it is almost always `PATH` — see §6.

**Windows note:** Qwen Code CLI ships only as an npm `.cmd`/`.ps1` shim — there is no native `qwen.exe`. This is the same caveat family the bridge script (`scripts/ask-qwen.mjs`) already documents and handles: a plain `spawn` without a shell fails `EINVAL` on Windows (Node's CVE-2024-27980 hardening), so the bridge always retries via a quoted `cmd.exe` invocation. Nothing extra is needed from these setup steps for this — it's handled internally by the bridge.

## 4. Login / Auth (USER, with Agent help)

Unlike Codex, there is **no interactive browser login flow.** `qwen auth` exists as a subcommand, but the CLI's own `--help` text marks it `(removed)`. Authentication is configured entirely through environment variables and/or `~/.qwen/settings.json`.

**USER:** the one thing only you can do here is obtain the API key:

1. Sign up for [Alibaba Cloud Model Studio](https://www.alibabacloud.com/en/product/modelstudio) (DashScope) and generate an API key.

**Agent:** once the USER has a key, prefer the simplest option first.

**Option A — environment variable (simplest, no file edits):**

```bash
export DASHSCOPE_API_KEY="..."
```

```powershell
$env:DASHSCOPE_API_KEY = '...'
```

Qwen Code CLI's OpenAI-compatible provider mode picks this up automatically against `baseUrl: https://dashscope-intl.aliyuncs.com/compatible-mode/v1` (international accounts) or the `cn-` mainland endpoint, depending on account region.

**Option B — `~/.qwen/settings.json` (persistent config):**

Add a provider entry under `modelProviders.openai[]` (each entry is `{id, name, baseUrl, envKey, generationConfig}`, where `envKey` names the environment variable holding that provider's key), set the corresponding value in the top-level `env` map, and point `security.auth.selectedType` and `model.name` at that provider entry.

Use Option A for a quick/first setup; use Option B when the key needs to persist across shells/sessions without re-exporting it each time.

**Agent:** there is no CLI command to verify the key was accepted — do not claim success here. Proceed to §5; that is the only real proof of a working auth chain.

## 5. Model probe (Agent)

The smoke test confirms `qwen3.7-plus` actually answers through the bridge. The bridge passes `-m qwen3.7-plus` by default (via `--model` flag > `QWEN_MODEL` env var > default `qwen3.7-plus`).

Path note: `${CLAUDE_SKILL_DIR}` below means the directory containing this skill's SKILL.md — the installed skill path. During install, the path is different: INSTALLER.md Phase 4's "Probe path (binding)" rule is the single source of truth (probe from the repo clone; the installed path is verified later in its Phase 6).

```bash
printf 'Reply with the single word OK.\n' > /tmp/qwen-probe.txt
node "${CLAUDE_SKILL_DIR}/scripts/ask-qwen.mjs" /tmp/qwen-probe.txt
```

```powershell
"Reply with the single word OK." | Out-File -Encoding utf8 "$env:TEMP\qwen-probe.txt"
node "${CLAUDE_SKILL_DIR}/scripts/ask-qwen.mjs" "$env:TEMP\qwen-probe.txt"
```

**Success:** a JSON envelope with verdict `approved` or `findings`, exit code `0` or `10`. This is the **only** confirmation that auth is actually working — there is no separate login-status check (see §1, §4).

**Failure:** exit code `20` (`codex_unavailable`) means the chain is broken — read the envelope's `error` field and route:

- error names a missing binary → back to §3 (Install).
- error mentions `401 Invalid API-key provided` → see §6 (Troubleshooting).
- error says the model was rejected → retry with a different model via the `QWEN_MODEL` env var, or ask the user which model their Model Studio account offers:

```bash
QWEN_MODEL=qwen3.7 node "${CLAUDE_SKILL_DIR}/scripts/ask-qwen.mjs" /tmp/qwen-probe.txt
```

The probe validates that whatever model value you use actually works before you rely on it.

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `qwen: command not found` | Not on `PATH` yet | Open a new terminal / restart the shell; re-check the npm global bin dir is on `PATH`; re-run §3 |
| `401 Invalid API-key provided` from Alibaba Cloud Model Studio | Stale/wrong key in the active provider entry, or `security.auth.selectedType`/`model.name` in `~/.qwen/settings.json` pointing at a different provider entry than the one holding a valid key | Verify the key value directly against the Model Studio console; confirm `model.name` + `selectedType` actually route to the provider entry holding that key |
| Model rejected in the probe | Model id not available on this Model Studio account | Set `QWEN_MODEL` to a model the account offers (§5) |
| Envelope exit `20` with a timeout | Slow / transient run | Re-run; if it persists, raise the bridge's `--timeout` |
| Windows: spawn errors despite `qwen --version` working in a normal terminal | Expected — no native `qwen.exe`, shim needs `cmd.exe` | Already handled by the bridge's automatic `cmd.exe` retry (see §3); no user action needed |

## 7. Advanced: AgentBridge (outside this installer)

For long implementation sprints that need **persistent, bidirectional** dialogue with a second model (not one-shot critiques), [AgentBridge](https://github.com/quilin-ai/agent-bridge) sets up live paired sessions. Today AgentBridge is a Codex-specific, live-bridge path — there is no equivalent live-bridge option for Qwen Code.

AgentBridge is **not** installed, configured, or touched by this skill's installer. It carries its own data-egress profile and needs its own consent and setup. Reach for it only when persistent context clearly earns its keep, and only for the Codex side.
