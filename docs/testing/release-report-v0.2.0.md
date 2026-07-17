# Release report — v0.2.0 (2026-07-17)

Scope: sol-validated (scope round: AMEND-SCOPE, all amendments folded in). Gate 1
(sol full-diff review): REVISE, 10 findings, ALL applied and re-verified. Gate 2:
this report's approval round. All model calls on subscription quota.

## Release gate (per docs/testing/release-gate.md) — FINAL RUN

All four legs ran in ONE session on 2026-07-17 (UTC ~11:02Z) against the release
candidate's exact final code (`ask-codex.mjs` sha256 prefix `97e8347dc283` — the
code that is tagged). Earlier runs during development (pre-classifier-rewrite)
are superseded by these. Verbatim envelopes:

**Leg 1 — probe, real model. Required: `probe_ok`/exit 0. Got: exit 0**
```json
{
 "probe": "probe_ok",
 "requested_model": "gpt-5.6-sol",
 "reported_model": "gpt-5.6-sol",
 "error": null,
 "elapsed_ms": 3829
}
```
**Leg 2 — probe, bogus model. Required: `model_rejected`/exit 30. Got: exit 30**
```json
{
 "probe": "model_rejected",
 "requested_model": "gpt-nonexistent-xyz",
 "reported_model": "gpt-nonexistent-xyz",
 "error": "codex exited with code 1: ERROR: {\"type\":\"error\",\"status\":400,\"error\":{\"type\":\"invalid_request_error\",\"message\":\"The 'gpt-nonexistent-xyz' model is not supported when using Codex with a ChatGPT account.\"}} \u2014 if this mentions auth, run `codex login`",
 "elapsed_ms": 2134
}
```
**Leg 3 — critique, fixtures/known-bad.md. Required: `findings`/exit 10 naming the boundary bug. Got: exit 10, 2 findings (both boundary-exclusivity defects with concrete triggers)**
```json
{
 "verdict": "findings",
 "model": "gpt-5.6-sol",
 "requested_model": "gpt-5.6-sol",
 "reported_model": "gpt-5.6-sol",
 "summary": "The function excludes both boundaries, so it implements an open interval rather than the required inclusive interval.",
 "findings": [
  {
   "severity": "high",
   "category": "correctness",
   "where": "`d > Date.parse(start)`",
   "issue": "A date equal to the start boundary returns false. Trigger: `inRange(\"2024-06-01\", \"2024-06-01\", \"2024-06-30\")` returns false, but should return true.",
   "suggestion": "Use `d >= Date.parse(start)` after normalizing all inputs to UTC calendar dates."
  },
  {
   "severity": "high",
   "category": "correctness",
   "where": "`d < Date.parse(end)`",
   "issue": "A date equal to the end boundary returns false. Trigger: `inRange(\"2024-06-30\", \"2024-06-01\", \"2024-06-30\")` returns false, but should return true.",
   "suggestion": "Use `d <= Date.parse(end)` after normalizing all inputs to UTC calendar dates."
  }
 ],
 "error": null,
 "elapsed_ms": 19399
}
```
**Leg 4 — critique, fixtures/known-good.md. Required: `approved`/exit 0. Got: exit 0**
```json
{
 "verdict": "approved",
 "model": "gpt-5.6-sol",
 "requested_model": "gpt-5.6-sol",
 "reported_model": "gpt-5.6-sol",
 "summary": "release test OK",
 "findings": [],
 "error": null,
 "elapsed_ms": 4359
}
```

## Stubbed matrix (docs/testing/bridge-matrix.sh) — 9/9

cli_missing(20) · auth-text-MENTIONING-model → auth_failure(20) [the Gate-1
finding-1 trap, defeated] · bound model rejection → model_rejected(30) ·
network_failure(20) · timeout(20) · malformed_output(20) · exact-echo probe_ok(0)
· nonce-wrapped-in-prose → malformed_output(20) [exactness rule] · critique
envelope backward-compat (legacy `model` key + `requested_model` +
`reported_model` from CLI banner) ✓. One harness fix during development
(cli_missing PATH isolation — node and codex share an npm bin dir); no bridge
defect.

## Agent-driven upgrade install (T3)

Fresh Opus agent executed INSTALLER.md v0.2.0 §9 upgrade over the live v0.1.0
install: complete 5-action manifest trail in 48 s, probe-based Phase 4
(`probe_ok`, CLI `codex-cli 0.144.1` recorded), Phase-6 smoke `approved` from the
installed path, managed block replaced in place (no duplication, user content
preserved), backups + `.prev` chain intact. Full detail + honesty notes (the
executor died twice on infrastructure API errors while writing its narrative;
report reconstructed from disk): `t3-opus-upgrade-report.md`. No blocker
evidenced; the confusing-grade gap is covered by the fresh-laptop external
validation run.

## Tested configuration claims (release wording per the scope validation)

Default requested model is `gpt-5.6-sol`; availability depends on the user's
Codex plan and CLI. `gpt-5.5` is an explicit fallback only after a
positively-classified model rejection (probe exit 30), always disclosed. Tested:
macOS (this machine), Codex CLI 0.141.x–0.144.x, Node ≥18, upgrade-from-v0.1.0
and bridge behaviors per the matrix. Not guaranteed: other platforms/CLI
versions. Windows: implementation-reviewed, NOT physically tested. Offline,
unauthenticated, or Claude-only environments: God Mode installs; the Codex lane
cannot be verified or installed — the installer says so.
