# Changelog

## v0.3.0 — 2026-07-21

- New skill: `session-handoff` — pause a heavy session at a NATURAL boundary and
  resume in a fresh session while minimizing context loss. Flow: natural-pause discipline
  (inventory running work, wait for the boundary, externalize restart recipes —
  never abrupt), a dated handoff doc with a self-contained §RESUME prompt,
  a MANDATORY clean-context audit of the handoff (cross-model via the
  fable-super-god-mode Codex bridge when installed AND consented; a fresh
  clean-context subagent as the disclosed fallback) applied APPEND-ONLY as GATE CORRECTIONS +
  §RESUME-CORRECTED, and finally ONE paste-able resume line for the next session.
  Triggers on session-transfer phrases ("resume in a new session", "give me the
  resume one-liner", "pause at a natural boundary and continue in a new
  session") and proactively offers itself once when the session grows heavy
  (~500k+ tokens of history, a heuristic). The cross-model audit runs only with
  established data-egress consent; otherwise a local clean-context subagent
  audits. Project-agnostic; no Codex required.

## v0.2.0 — 2026-07-17

- Default Codex reviewer model: `gpt-5.6-sol` (was `gpt-5.5`). Fallback to
  `gpt-5.5` ONLY on a positively-classified model rejection (probe exit 30),
  always disclosed. Envelope now carries `requested_model` and `reported_model`
  (CLI-reported, never inferred).
- New `--probe` mode in `ask-codex.mjs`: cheap non-semantic liveness check with
  classified outcomes (`probe_ok` | `model_rejected` | `auth_failure` |
  `cli_missing` | `network_failure` | `timeout` | `malformed_output` |
  `unavailable_other`; exits 0/30/20). Installs verify with one probe + one
  tiny smoke review instead of two paid reviews.
- fable-god-mode gains four operating rules: long-running & paid work
  (orchestrator-owned, receipts on disk, evidence-based stall checks);
  falsify-new-checks-both-directions; receipts audit before repeating claimed
  numbers; explicit model on every subagent. Plus an optional
  independent-second-takes pattern (routing.md §8).
- INSTALLER v0.2.0: Phase-4 verification by classified probe; manifest records
  probe outcome, reported model, and `codex --version`; bootstrap fetches pin
  to the release tag (not `main`); optional user-invoked bridge diagnostic
  (falsifies the bridge both directions); managed CLAUDE.md block v0.2.0.
- Honest-scope statement in README (tested configurations; Windows still not
  physically tested; Claude-only/offline machines install God Mode only).

## v0.1.0 — 2026-07-02

Initial public release: fable-god-mode (10-80-10 discipline + stale-config
audit) and fable-super-god-mode (one-shot Codex bridge, tri-state verdict,
union rule), agent-driven transactional installer with manifest + rollback,
plugin-marketplace path, Windows-via-Node support.
