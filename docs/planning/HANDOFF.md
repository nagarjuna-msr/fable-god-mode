> **v0.1.0-era handoff (2026-07-02). HISTORICAL — superseded by v0.2.0 (see CHANGELOG.md); decisions referencing GPT-5.5 as default are v0.1.0 provenance, not current guidance.**

# HANDOFF — Fable God Mode build (written 2026-07-02, for a fresh session)

## What this is
You are starting the BUILD phase of an already-planned open-source project. Planning is DONE and critiqued — do not re-research or re-litigate decisions. Authoritative inputs, in this folder:
1. **PLAN.md** (v2.1) — the full spec: repo structure, installer contract, bridge design, milestones M1–M4, final naming. This is the single source of truth.
2. **research-prereqs.md** — verified facts (install commands, plan eligibility, skill-install mechanics, citable Anthropic guidance) + a short "re-verify at build time" list at the end. Trust the VERIFIED items; re-check only the flagged ones.

## Decisions already made (final — do not reopen)
- Brand: **Fable God Mode** (Claude-only tier) / **Fable Super God Mode** (adds GPT-5.5 via Codex CLI). Repo `fable-god-mode`; skill dirs `skills/fable-god-mode/`, `skills/fable-super-god-mode/`.
- One repo, two skills; vendor a Node bridge (`ask-codex.mjs`, tri-state verdict: approved|findings|codex_unavailable); depend on nothing at runtime; AgentBridge = documented external advanced path only (public, MIT, pin version), never touched by the installer.
- Primary install = agent-driven per INSTALLER.md spec (preflight → consents → mutate last → verify → rollback manifest); marketplace secondary; identical end state. Report-only audit by default; archive per-item with manifest+restore; managed sentinel blocks in CLAUDE.md; explicit data-disclosure consent for sending snippets to OpenAI.

## Where to build
Create the repo at `~/fable-god-mode` (git init; this becomes the public repo). Copy this folder's three files into `docs/planning/` there for provenance.

## Operational discipline (carries via ~/.claude/CLAUDE.md — global, loads automatically)
- Claude orchestrates and owns quality; Opus subagents for research/first drafts; Codex (GPT-5.5) for deterministic work.
- Codex one-shot critique: `~/.claude/skills/codex-critique/scripts/ask-codex.sh <prompt-file>` (prompt in a FILE, fed via stdin). Gate: use it on INSTALLER.md logic, ask-codex.mjs, verdict schema; skip it for SKILL.md prose/README/marketing. Union rule; adjudicate on merit; log to the new repo's `.orchestration/feedback.jsonl`.
- Known improvement to apply: the vendored bridge must use the tri-state verdict (NOT the private script's approve-on-error fail-open).

## Build order (from PLAN.md)
- M1: fable-god-mode skill (SKILL.md + references/routing.md + references/audit.md). Content sources: 10-80-10 system, Anthropic cost-docs citations (in research-prereqs.md), subagent fan-out discipline.
- M2: fable-super-god-mode (SKILL.md + scripts/ask-codex.mjs + references/setup-codex.md + verdict-schema.json). Codex-critique ask-codex.mjs before calling it done.
- M3: INSTALLER.md spec + README.md + .claude-plugin/marketplace.json + examples/. Codex-critique INSTALLER.md.
- M4: dogfood on a blank profile (fresh HOME or container): both modes, a re-run (idempotency), a mid-setup abort (rollback). Fix friction. Only then is it ship-ready.

## Definition of done
A non-technical user can: clone repo (or point Claude at the URL) → say "set up Fable God Mode" → answer the interview → get a verified, reversible install — on macOS/Linux/Windows(Node) — and the Twitter post can link the repo honestly.
