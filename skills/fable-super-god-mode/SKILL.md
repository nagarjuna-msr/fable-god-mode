---
name: fable-super-god-mode
description: Use when deterministic/backend/algorithmic work needs an independent correctness check — numeric, boundary, parsing, state-machine, concurrency, or scoring/data math and API contracts; when critiquing a plan before multi-step deterministic execution; when reviewing a diff before committing; when you want a debugging second opinion after a failed fix attempt; or when the user mentions Codex, GPT-5.6, gpt-5.6-sol, GPT-5.5, or asks for a second model's opinion. Extends and requires fable-god-mode; needs a paid ChatGPT plan with the Codex CLI installed and logged in.
---

# Fable Super God Mode

## What this adds

This skill adds ONE thing to Fable God Mode: a Codex lane — an OpenAI reviewer
(default model **gpt-5.6-sol**) reached through a vendored one-shot bridge to
the Codex CLI. The Codex reviewer acts as Fable's deterministic specialist and
independent critic on correctness-heavy work.

Fable God Mode's 10-80-10 discipline still governs everything — Fable 5 plans,
cheaper Claude subagents execute, Fable reviews and owns final quality. Nothing
here replaces or relaxes that loop; see `skills/fable-god-mode/SKILL.md`
(installed as the `fable-god-mode` skill). This skill only inserts a second,
independent model at specific correctness checkpoints inside that same loop.

## When to use the Codex lane

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

Three steps: write a prompt file, invoke the bridge, read the envelope.

1. **Write the prompt file.** A plain text/markdown file containing the FULL,
   self-contained critique request: the task context plus the material to review
   inline, or paths for Codex to read. The bridge sends only this file (plus a
   fixed output-contract suffix) — never your environment. Codex runs
   read-only-sandboxed and may READ files in the working directory only if the
   prompt points it at paths.

2. **Invoke the bridge** (Node ≥18, zero dependencies):

   ```sh
   node "${CLAUDE_SKILL_DIR}/scripts/ask-codex.mjs" <prompt-file> [--model <id>] [--timeout <seconds>]
   ```

   Model selection: `--model` flag > `CODEX_MODEL` env var > default `gpt-5.6-sol`
   (always passed explicitly to the CLI). The CLI is run as
   `codex exec --sandbox read-only --ephemeral`, non-interactive.

   **Model fallback rule (strict):** if the requested model is POSITIVELY
   rejected — the probe/envelope error names the model as unsupported /
   unavailable (probe outcome `model_rejected`, exit 30) — retry ONCE with the
   documented fallback `gpt-5.5` and TELL the user the review ran on the
   fallback. Any other failure (auth, network, timeout, CLI missing) is NOT a
   model problem: do not switch models on it — surface it.

   The bridge also offers a cheap non-semantic liveness check used by the
   installer and for fallback decisions:

   ```sh
   node "${CLAUDE_SKILL_DIR}/scripts/ask-codex.mjs" --probe [--model <id>]
   ```

3. **Read the envelope.** The bridge prints ONE JSON object on stdout:

   ```json
   {"verdict", "model", "requested_model", "reported_model", "summary", "findings": [...], "error", "elapsed_ms"}
   ```

   `verdict` is one of `approved` | `findings` | `codex_unavailable`. Each
   findings item is `{severity, category, where, issue, suggestion}` where
   `severity` ∈ `critical | high | medium | low`. `requested_model` is what the
   bridge asked for; `reported_model` is what the CLI itself reported (or
   `null`) — never inferred, never assumed equal to the request.

   Exit codes: `0` = approved, `10` = findings, `20` = codex_unavailable,
   `30` = model_rejected (probe mode only), `2` = usage error (bad arguments —
   a caller bug you must fix, not an outage).

## Handling the verdict

Three states, and you must treat them differently.

- **`approved`** — the Codex reviewer found nothing. This ADDS to your own
  review; it does not replace it. Ship on the union of both.
- **`findings`** — adjudicate below.
- **`codex_unavailable`** — this is the single most important rule.

**Tri-state rule.** `codex_unavailable` means NO review happened. You MUST
surface this plainly to the user — "Codex review did not run: `<error>`" — and
proceed on your own findings only. An outage must NEVER be reported as a clean
review, and must NEVER be silently ignored. This is a deliberate improvement
over fail-open designs that print "approve" on error.

**Union rule.** Codex findings ADD to your own self-review findings. The
reviewer's approval or silence NEVER drops a finding you already had.
Adjudicate each finding on merit: accept the real ones and act on them; reject
false positives with a stated reason. The result you ship is your findings ∪
the accepted Codex findings.

**Log every critique** as one JSON line appended to the project's
`.orchestration/feedback.jsonl` — `reviewer` is the envelope's
`requested_model` (add `reported_model` when it differs):

```json
{"ts": "<ISO>", "artifact": "<path or description>", "reviewer": "<requested_model>", "verdict": "<approved|findings|codex_unavailable>", "findings": <N>, "accepted": <N>, "rejected": <N>, "notes": "<short>"}
```

## Data disclosure

Using this lane sends the prompt file's contents — and any files Codex reads
under it — to OpenAI. The user consented to this at install. Do not send
secrets, credentials, or files the user has not approved for disclosure.

## Setup

Any paid ChatGPT plan (Plus and up) includes the Codex CLI; the free tier has
limited quota. The full install / login / verification procedure lives in
`references/setup-codex.md` — defer to it.

Advanced path: AgentBridge (github.com/quilin-ai/agent-bridge, MIT) enables live
bidirectional Fable↔Codex sessions; see `references/routing.md` for when that is
worth it. It is NOT installed or configured by this skill's installer.

## References

Load these on demand:

- `references/routing.md` — full routing detail: which lane fires when, the
  NOT-for list, and the AgentBridge advanced path.
- `references/setup-codex.md` — Codex CLI install, login, and verification.
- `references/verdict-schema.json` — the JSON Schema enforced on the Codex
  reviewer's raw verdict (`approved`/`findings` only; `codex_unavailable` is the
  bridge's own state, added in the envelope along with the model fields,
  `error`, and `elapsed_ms`).
