# Fable God Mode INSTALLER.md — dogfood report (blank profile, real Codex bridge)

**Spec under test:** `clone-test/INSTALLER.md` v0.1.0 (fresh public-repo clone, never modified)
**Profile:** `$M4HOME` empty home; every `~/...` → `$M4HOME/...`; Codex env `HOME=$M4HOME CODEX_HOME=/Users/nagarjuna/.codex` (real auth, exit 0).
**Date of run:** 2026-07-02

## Scenario verdicts

| Scenario | Verdict | One-line |
| --- | --- | --- |
| **D1** Fresh SUPER install, blank profile, end-to-end | **PASS** | All 8 phases executed for real; manifest valid, block present once, both bridge runs exit 0. |
| **D2** §9 re-run, identical answers | **PASS** | Current check fired; zero writes; mtimes+hashes byte-identical before/after. |
| **D3** Uninstall via §10 off the manifest | **PASS** | Reverse-order rollback with ownership checks; residue = exactly the manifest; targets untouched. |

## Bridge runs (real gpt-5.5, live quota)

| Run | Path | Verdict | Exit | elapsed_ms |
| --- | --- | --- | --- | --- |
| Phase 4 model probe | **repo** `<repo>/skills/fable-super-god-mode/scripts/ask-codex.mjs` | `approved` | 0 | **5722** |
| Phase 6 smoke test | **installed** `$M4HOME/.claude/skills/fable-super-god-mode/scripts/ask-codex.mjs` (symlink) | `approved` | 0 | **5476** |

Both parsed clean envelopes with expected fields (verdict/model/summary/findings/error/elapsed_ms). The Phase-4-repo vs Phase-6-installed distinction was executed exactly as written and both passed.

## Findings count by severity

- Blocker: **0**
- Major: **0**
- Minor: **3** (F1, F2, F5)
- Friction: **3** (F3, F4, F6)

---

## Findings

### F1 — `.claude/` parent-dir creation is an untracked, implicit mutation (MINOR)
**Where:** Phase 5 / Appendix A action list; §10 residue note.
**What happens:** On a blank profile in user scope, `$M4HOME/.claude/` does not exist. The manifest must live at `$M4HOME/.claude/fable-god-mode.manifest.json`, so **`.claude/` itself has to be created before the very first manifest save** — but the spec's action list starts at `mkdir SKILLS_DIR` (`.claude/skills`), which via `mkdir -p` also creates `.claude`. There is no manifest action, `created` flag, or seq entry for `.claude/` as a distinct directory.
**Why it matters:** The spec explicitly reasons about the `.claude/` parent only for **project scope** ("in project scope the installer may also have created the `.claude/` parent … intentionally retained"). In **user scope** the same parent-creation happens but is never named. It is correctly retained after rollback (it holds the manifest), so behavior is right — but the *reasoning* the spec gives is scope-specific and doesn't cover the user-scope blank-profile case, and two agents could disagree on whether `.claude/` needs its own `mkdir` action with `created:true`.
**Severity:** Minor (behavior is correct; the gap is in the written justification / traceability).
**Suggested fix:** Add one sentence to §10's parent-dir note: "In BOTH user and project scope the installer may create the `.claude/` directory that holds the manifest; it is retained after rollback in either scope." Optionally note in Phase 5 that creating the manifest's parent dir is a precondition, not a tracked action.

### F2 — `smoke` success value is unspecified; only the failure value is named (MINOR)
**Where:** Phase 6 + Appendix A (`"smoke"` field).
**What happens:** Appendix A shows `"smoke": "approved"` in the example, and Phase 6 says to record `"smoke": "failed"` on a failed/exit-20 bridge. But no line states what to write on success. I wrote `"approved"` by symmetry with the example. An agent could equally write `"passed"`, `"ok"`, or the verdict verbatim.
**Severity:** Minor (interoperability/consistency only; no functional break).
**Suggested fix:** State explicitly: "On smoke pass, record `"smoke": "approved"` (the bridge verdict); on fail, `"smoke": "failed"`; god mode = `"skipped"` or omit."

### F3 — `created_file:true` deletion is an "offer," but a non-interactive/uninstall agent has no scripted branch (FRICTION → this is the flagged created_file case)
**Where:** §10 `claude_md_block` row: *"If the block action recorded `created_file: true` and the file now contains nothing but our block, **offer** to delete the file itself."*
**What happens:** In D3 the install created `CLAUDE.md` (`created_file:true`); after surgical block removal the file was empty. The spec says *offer* to delete — a second interactive gate. The task's D3 instruction ("undo the fable-god-mode install") reads as a single intent, so I treated it as accepting the cleanup and deleted the now-empty file, leaving `.claude` = manifest only (which is exactly the "what remains" the task expected). But strictly, the spec wants a **separate yes** here, and if the user declines, an **empty `CLAUDE.md` is legitimate leftover** — which would then contradict the task's "what remains should be exactly the manifest." So there is a real gap: the spec's happy-path prose ("exactly the manifest + backups") and the §10 "offer" branch can disagree on whether an empty created-by-us `CLAUDE.md` is debris or a user choice.
**Severity:** Friction (non-technical user gets an extra yes/no about a file they never knew was created; and a "no" leaves a confusing empty file).
**Suggested fix:** Make the default explicit: "Since we created this file and it now holds only our block, we will delete it unless you want to keep it." Default to delete on a plain uninstall; keep the offer only when other content survives. Also add the empty-created-file case to §10's residue expectation.

### F4 — Phase 4 probe-path rule reads clearly, but the `${CLAUDE_SKILL_DIR}` substitution lives in setup-codex.md, not INSTALLER (FRICTION, mostly PASS)
**Where:** Phase 4 "Probe path (binding)" vs `setup-codex.md` §5 path note.
**What happens:** INSTALLER Phase 4 is now unambiguous: it spells out the literal `node "<repo>/skills/fable-super-god-mode/scripts/ask-codex.mjs" <prompt-file>` and says Phase 6 re-runs from the installed path. Executed both; both passed with no interpretation needed. The only residual friction: an agent following `setup-codex.md` §5 in isolation sees `${CLAUDE_SKILL_DIR}` and must remember INSTALLER's "substitute the repo clone during install" instruction. Both files DO say this, so it's belt-and-suspenders, but the value is duplicated in two places and could drift.
**Severity:** Friction (verdict on the rule itself: reads unambiguously in practice — this is a near-PASS). 
**Suggested fix:** None strictly needed. Optionally have setup-codex.md §5 point back to INSTALLER Phase 4 as the single source of the during-install path rather than restating it.

### F5 — §9 "all manifest actions verify" is executable, but the per-action verify predicate is only sketched (MINOR, verdict PASS on executability)
**Where:** §9 Current check: *"every manifest action re-verifies on disk (links intact, hashes match, block present once)."*
**What happens:** I implemented this literally and it worked cleanly (all 4 actions verified → Current → no writes). The parenthetical gives one verifier per action *type* actually present in a symlink super install: symlink→(is-link && target==manifest.target), block→(exactly one BEGIN/END && version present), mkdir→(dir exists). That was enough. BUT the clause doesn't enumerate the **copy** case ("hashes match" implies re-hashing every file against `files[].sha256`, which §10 spells out but §9 only gestures at) or the `claude_md_backup` action (nothing on disk to verify beyond the backup still existing). For the tested install it was fully executable; for a copy install an agent must borrow §10's exact predicates.
**Severity:** Minor (executable as written for the common symlink path; underspecified for copy/backup).
**Suggested fix:** In §9 Current, add: "Use the same per-action ownership predicates §10 defines (symlink target match; copy path-set + every sha256; block sentinel count + version)." One cross-reference closes it.

### F6 — Interview Q1 preflight-echo for the "already authenticated" case has no example (FRICTION)
**Where:** Phase 2 Q1: *"First echo the relevant preflight findings … (e.g. 'Preflight found the Codex CLI installed but not logged in — Super God Mode would need a browser login from you')."*
**What happens:** The only worked example is the *not-logged-in* case. On this blank profile P5 was **authenticated** (exit 0). The right echo is roughly "Preflight found the Codex CLI installed AND logged in — Super God Mode is fully available, no browser login needed." An agent has to compose that itself; a less careful agent might still tell the user to do a browser login (Q1.2), which is pointless when already authed, or might skip Phase 4 login (correct) but not tell the user why.
**Severity:** Friction (non-technical user could be told to "log in" when they're already logged in).
**Suggested fix:** Add the authenticated-case example to Q1, and note that when P5 already passed, Q1.2 (browser-login capability) is informational — Phase 4 will skip §3/§4 and go straight to the model probe.

---

## Per-scenario execution detail

### D1 — Fresh SUPER install (PASS)
- **Preflight P1–P11:** Darwin; Node v20.19.5; git 2.39.5; codex-cli 0.141.0; `codex login status` exit 0 (authenticated, blank HOME + real CODEX_HOME); repo found at clone; no existing installs/blocks/manifest; skills dir absent (→ restart note applies); CLAUDE.md absent. No hard stops; not §9.
- **Interview (scripted):** Q1.1 yes → **C2 recorded**; Q1.2 yes; Q1.3 yes → **mode=super**. Q2 all projects → **user scope** (`$M4HOME/.claude/...`). Q3 → **symlink** from the existing clone (no clone action). Q4 → **no** (audit declined).
- **Phase 3:** plan assembled (2 symlinks, no backup [file absent], block create with `created_file:true`, manifest path); block preview shown with model `gpt-5.5 (pending validation)`; **C1/C3/C4** collected on approve. C3 not exercised (Codex already installed → no CLI install).
- **Phase 4 (real):** §3/§4 skipped (present+authed); §5 model probe from **repo path** → `approved`, model `gpt-5.5` validated, exit 0, **5722 ms**. Validated model == previewed model → no C4 re-show needed.
- **Phase 5:** write-ahead manifest honored (init → per action append `planned`, save, act, `done`, save). seq 1 mkdir(created:true), seq 2/3 symlinks, seq 4 claude_md_block(created_file:true). `claude_md_backup` skipped (no file) with no entry and no seq gap — matches Appendix A. Block verified present exactly once (begin=1,end=1). `smoke` set to `approved` after Phase 6.
- **Phase 6:** god-mode — SKILL.md read through installed symlink, frontmatter (`---`,`name:`,`description:`) parses, `references/` reachable. super-mode — bridge from **installed path** → `approved`, exit 0, **5476 ms**, envelope parses.
- **Phase 8 checklist:** printed; restart-needed = yes (skills dir created this run); audit = declined.
- **Verification asks:** manifest valid JSON ✓; block present exactly once ✓; both bridge runs exit 0 ✓.

### D2 — §9 re-run, identical answers (PASS)
- Before-snapshot of every `.claude` file (mtime + sha256, symlink targets) captured.
- Re-run preflight now finds P7 (symlinks), P8 (block v0.1.0 mode=super), P9 (manifest) → route to §9.
- **Current check executed literally:** (a) sentinel version 0.1.0 == installer 0.1.0 ✓; (b) manifest mode super == user-wants super, sentinel mode super ✓; (c) all 4 manifest actions re-verify on disk (mkdir OK; both symlinks link-intact + target-match; block present once + version present) ✓. → **Current = true**.
- Reported "already installed and up to date — nothing to do"; **made no writes** (no new manifest, no block rewrite); skipped to Phase 8 checklist.
- **Proof of no-op:** after-snapshot diffed against before → **byte-identical, no mtime change, no new files.** No bridge re-run (Current path doesn't re-smoke).

### D3 — Uninstall via §10 (PASS)
- User intent: "undo the fable-god-mode install" → §10 rollback off the manifest, **reverse order** (seq 4→1).
- **seq4 claude_md_block:** located sentinel-bounded block, removed it, verified by re-read (no BEGIN remains). `created_file:true` AND file now empty → deleted the file (see F3 for the "offer" nuance).
- **seq3/seq2 skill_install(symlink):** ownership check — still a symlink AND current target == manifest `target` → removed **symlink only**; confirmed both targets still exist in the clone.
- **seq1 mkdir:** `created:true` AND `.claude/skills` now empty → removed it.
- All four entries set `status:"rolled_back"` + `rolled_back_at`; **manifest retained** and still valid JSON.
- **Residue check:** `$M4HOME/.claude` now contains **exactly** `fable-god-mode.manifest.json` (+ the `.claude` parent) — nothing else. No backups existed (file was created, not backed up). Matches the task's expected end state.
- **Untouched:** clone symlink targets intact; Codex CLI not uninstalled (§4 non-rollbackable — correct).
- **Side note (not a finding against the manifest):** the Codex bridge caused the CLI to populate `$M4HOME/.codex/` (state sqlite, tmp, system skills) as its runtime working dir. This is Codex CLI machine state, outside the installer's manifest scope, and §4 explicitly excludes Codex CLI changes from rollback. Real auth was read from `/Users/nagarjuna/.codex` (untouched).

## Notes on real bridge behavior
- Both live gpt-5.5 runs returned in ~5.5 s, clean single-JSON envelopes, exit 0. No timeouts, no exit-20. The bridge's `-m gpt-5.5` explicit-model path worked; no `CODEX_MODEL` fallback needed.
- The bridge honored the blank `HOME` while using `CODEX_HOME` for auth — confirming the installer's Phase-4/Phase-6 probes work under a fresh profile as long as Codex auth is reachable.
