---
name: fable-super-god-mode
description: Use when deterministic/backend/algorithmic work needs an independent correctness check — numeric, boundary, parsing, state-machine, concurrency, or scoring/data math and API contracts; when critiquing a plan before multi-step deterministic execution; when reviewing a diff before committing; when you want a debugging second opinion after a failed fix attempt; or when the user mentions Codex, GPT-5.5, Qwen, or asks for a second model's opinion. Extends and requires fable-god-mode; needs ONE of two reviewer providers set up at install time — a paid ChatGPT plan with the Codex CLI, or an Alibaba Cloud Model Studio account with the Qwen Code CLI.
---

# Fable Super God Mode

## What this adds

This skill adds ONE thing to Fable God Mode: an independent second-model
review lane, reached through a vendored one-shot bridge. The installer's
interview picks ONE reviewer provider, once, at install time:

| Provider | Model | CLI | Data goes to |
| --- | --- | --- | --- |
| OpenAI Codex | `gpt-5.5` | Codex CLI | OpenAI |
| Qwen Code | `qwen3.7-plus` | Qwen Code CLI | Alibaba Cloud Model Studio |

Exactly one is installed per install — the repo SOURCE ships both bridge
scripts, but the installer excludes the non-chosen one when it copies or
symlinks this skill into place (see INSTALLER.md Phase 5), so your INSTALLED
copy of this skill directory's `scripts/` contains only the one matching
script (`ask-codex.mjs` or `ask-qwen.mjs`); whichever is present there is the
active provider. The managed `CLAUDE.md` block also names it. If you ever find
both scripts installed side by side, that is a broken install state (a
provider switch that failed to prune the old script) — re-run the installer to
repair it, don't guess which one is active. Both providers act as Fable's
deterministic specialist and independent critic on correctness-heavy work,
through the identical tri-state contract described below — nothing about the
loop changes based on which one you picked.

Fable God Mode's 10-80-10 discipline still governs everything — Fable 5 plans,
cheaper Claude subagents execute, Fable reviews and owns final quality. Nothing
here replaces or relaxes that loop; see `skills/fable-god-mode/SKILL.md`
(installed as the `fable-god-mode` skill). This skill only inserts a second,
independent model at specific correctness checkpoints inside that same loop.

## When to use the reviewer lane

Keep it gated. Fire the lane for:

- **Deterministic / backend / algorithmic work** — numeric, boundary, parsing,
  state-machine, concurrency, data/scoring math, or API-contract correctness.
- **Plan critique** — before executing a multi-step deterministic plan.
- **Diff review** — of substantial deterministic changes before finalizing or
  committing.
- **Debugging second opinion** — AFTER one failed fix attempt, not before.

Do NOT fire it for creative work, frontend / visual / UX, copy / prose / docs,
conversational turns, or trivial edits — a second model there adds cost without
decisive signal. Full routing detail lives in `references/routing.md`.

## Running a critique

Three steps: write a prompt file, invoke the bridge, read the envelope. The
steps are identical regardless of which provider is installed — only the
script name, default model, and underlying CLI invocation differ.

1. **Write the prompt file.** A plain text/markdown file containing the FULL,
   self-contained critique request: the task context plus the material to review
   inline, or paths for the reviewer to read. The bridge sends only this file
   (plus a fixed output-contract suffix) — never your environment. The reviewer
   runs sandboxed/isolated (Codex: read-only sandbox; Qwen: `--safe-mode`,
   disabling its own context files/hooks/extensions/skills/MCP servers) and may
   READ files in the working directory only if the prompt points it at paths.

2. **Invoke the bridge that's actually installed** (Node ≥18, zero dependencies):

   ```sh
   # Codex CLI provider:
   node "${CLAUDE_SKILL_DIR}/scripts/ask-codex.mjs" <prompt-file> [--model <id>] [--timeout <seconds>]
   # Qwen Code CLI provider:
   node "${CLAUDE_SKILL_DIR}/scripts/ask-qwen.mjs" <prompt-file> [--model <id>] [--timeout <seconds>]
   ```

   Only one of these two scripts exists in your installed `scripts/` directory
   — that is the provider you chose at install. Model selection for either:
   `--model` flag > provider env var (`CODEX_MODEL` / `QWEN_MODEL`) > default
   (`gpt-5.5` / `qwen3.7-plus`, always passed explicitly to the CLI). Codex is
   run as `codex exec --sandbox read-only --ephemeral`, non-interactive; Qwen
   Code is run as `qwen -p ... -o json -m <model> --safe-mode`, non-interactive.

3. **Read the envelope.** The bridge prints ONE JSON object on stdout:

   ```json
   {"verdict", "model", "summary", "findings": [...], "error", "elapsed_ms"}
   ```

   `verdict` is one of `approved` | `findings` | `codex_unavailable`. Each
   findings item is `{severity, category, where, issue, suggestion}` where
   `severity` ∈ `critical | high | medium | low`.

   Exit codes: `0` = approved, `10` = findings, `20` = codex_unavailable,
   `2` = usage error (bad arguments — a caller bug you must fix, not an outage).

## Handling the verdict

Three states, and you must treat them differently.

- **`approved`** — the reviewer found nothing. This ADDS to your own review; it
  does not replace it. Ship on the union of both.
- **`findings`** — adjudicate below.
- **`codex_unavailable`** — this is the single most important rule. (Field/exit
  code name is shared verbatim by both bridge scripts for contract
  compatibility — it means "reviewer unavailable," not specifically Codex; this
  applies identically whether the installed provider is Codex or Qwen.)

**Tri-state rule.** `codex_unavailable` means NO review happened. You MUST
surface this plainly to the user — "Reviewer review did not run: `<error>`"
(name the actual provider, e.g. "GPT-5.5" or "Qwen") — and proceed on your own
findings only. An outage must NEVER be reported as a clean review, and must
NEVER be silently ignored. This is a deliberate improvement over fail-open
designs that print "approve" on error.

**Union rule.** The reviewer's findings ADD to your own self-review findings.
Its approval or silence NEVER drops a finding you already had. Adjudicate each
finding on merit: accept the real ones and act on them; reject false positives
with a stated reason. The result you ship is your findings ∪ the accepted
reviewer findings.

**Log every critique** as one JSON line appended to the project's
`.orchestration/feedback.jsonl`:

```json
{"ts": "<ISO>", "artifact": "<path or description>", "reviewer": "<gpt-5.5|qwen3.7-plus>", "verdict": "<approved|findings|codex_unavailable>", "findings": <N>, "accepted": <N>, "rejected": <N>, "notes": "<short>"}
```

## Data disclosure

Using this lane sends the prompt file's contents — and any files the reviewer
reads under it — to whichever provider you installed: **OpenAI** (Codex CLI
path) or **Alibaba Cloud Model Studio** (Qwen Code CLI path) — never both; only
one bridge is installed per install. The user consented to this specific
provider at install. Do not send secrets, credentials, or files the user has
not approved for disclosure.

## Setup

Two supported providers — the installer's interview (INSTALLER.md Phase 2/4)
picks one:

- **Codex CLI.** Any paid ChatGPT plan (Plus and up) includes it; the free tier
  has limited quota. Full install / login / verification procedure:
  `references/setup-codex.md`.
- **Qwen Code CLI.** Needs an Alibaba Cloud Model Studio (DashScope) API key.
  No interactive browser login — auth is a key in an environment variable or
  `~/.qwen/settings.json`; validity can only be proven by actually running the
  bridge (there's no CLI-native "am I logged in" probe). Full install / auth /
  verification procedure: `references/setup-qwen.md`.

Advanced path: AgentBridge (github.com/quilin-ai/agent-bridge, MIT) enables live
bidirectional Fable↔Codex sessions; see `references/routing.md` for when that is
worth it. It is Codex-specific (no Qwen equivalent exists) and is NOT installed
or configured by this skill's installer.

## References

Load these on demand:

- `references/routing.md` — full routing detail: which lane fires when, the
  NOT-for list, and the AgentBridge advanced path.
- `references/setup-codex.md` — Codex CLI install, login, and verification.
- `references/setup-qwen.md` — Qwen Code CLI install, auth, and verification.
- `references/verdict-schema.json` — the JSON Schema enforced on the reviewer's
  raw verdict (`approved`/`findings` only; `codex_unavailable` is the bridge's
  own state, added in the envelope along with `model`, `error`, and
  `elapsed_ms`). Shared unchanged by both `ask-codex.mjs` and `ask-qwen.mjs`.
