# Changelog

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
