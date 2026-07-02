# INSTALLER.md dry-run report (v0.1.0)

Executed literally in a sandbox against `/Users/nagarjuna/fable-god-mode/INSTALLER.md`
plus its two delegated references (`skills/fable-god-mode/references/audit.md`,
`skills/fable-super-god-mode/references/setup-codex.md`). All `~/.claude` paths were
redirected to `$FAKEHOME/.claude`; project scope used `$FAKEPROJ`. The real
`~/.claude` and the repo were confirmed untouched. `codex login status` was simulated
as "not logged in, exit 1" (correct fresh-machine result); `codex --version` was run
for real (codex-cli 0.141.0). Node v20.19.5, git 2.39.5, Darwin/zsh.

## Per-scenario verdicts

| Scenario | Verdict |
| --- | --- |
| S1 — fresh god install (user scope, symlink, audit=now) | **PASS-with-friction** |
| S2 — idempotent re-run → §9 Update | **PASS-with-friction** |
| S3 — project-scope abort/rollback (copy, STOP after skill_install) | **PASS** |
| S4 — super-mode wall → downgrade-to-god | **PASS-with-friction** (masked a latent FAIL — see F1) |

All eight phases executed end-to-end in S1; §9 Update in S2; §10 rollback in S3;
Phase 4 wall + downgrade in S4. Everything the spec *told me to do* was executable.
The failures are in what the spec leaves under-specified for cases the harness didn't
force me into but a real user will hit.

---

## Findings (numbered; severity / spec section / what happened / fix)

### F1 — Phase 4 probes the INSTALLED super-skill path, but the skill isn't installed until Phase 5
**Severity: BLOCKER. Spec: §4 + §0 rule 1 + setup-codex.md §5 + §6 smoke test.**
Phase 4 says the model probe runs
`skills/fable-super-god-mode/scripts/ask-codex.mjs` and "Record the WORKING model
value — it goes into the managed block in Phase 5." setup-codex.md §5 invokes it as
`node "${CLAUDE_SKILL_DIR}/scripts/ask-codex.mjs"`. But `skill_install` is a **Phase 5**
action, and Ground rule 1 says "NOTHING is created, edited, linked… until Phase 5."
So on a *fresh* super install the installed path does not exist when Phase 4 needs it.
Three different path conventions refer to the same script across the spec:
Phase 4 = repo-relative `skills/…`; setup-codex §5 = `${CLAUDE_SKILL_DIR}/…` (never
defined anywhere); Phase 6 smoke = `SKILLS_DIR/fable-super-god-mode/scripts/…`
(installed). Two reasonable agents diverge: (A) run from the repo clone (works, but the
spec never says to and it's not the "installed" path Verification rule 5 demands), or
(B) install the super skill early (violates the transaction order). This was **masked in
S4** only because the harness's S4 ran against an *existing god install* in user scope,
so god→super collapsed into an Update where the skill was already linkable — a fresh
super user gets no such luck.
**Fix:** state explicitly that the Phase-4 bridge probe runs from the *repo* path
(the clone is guaranteed present by P6), define `CLAUDE_SKILL_DIR` once, and make
setup-codex.md §5 and INSTALLER Phase 6 use the same variable. Or add an explicit
"Phase 5 installs the super skill BEFORE the bridge probe, as a consented exception to
rule 1" carve-out — but that reopens the rollback story, so the repo-path reading is
cleaner.

### F2 — §9 has no "already current / nothing to do" outcome
**Severity: MAJOR. Spec: §9 + §0 rule 4.**
S2 re-ran with identical answers. Preflight found `v0.1.0` sentinel + intact symlink +
manifest, and the installer version is also `v0.1.0`. §9 forces a choice among
Update / Repair / Remove / Adopt. None fits "everything is already correct and current."
I picked Update per the script; the Phase-3 diff was empty and the block write was a
literal no-op. An honest agent wants to say "already installed and up to date, nothing
to do" and stop — the spec gives no such branch, so different agents will either
needlessly rewrite the manifest (as I did, producing a `.prev` that differs from the
live file in nothing but `started_at`/`completed_at`) or improvise an unlisted "no-op"
exit. The idempotency invariant in §9 ("running twice … same state") is satisfied for
files, but the *manifest* is churned on every no-op re-run.
**Fix:** add a fifth §9 outcome — "Current: sentinel version == installer version and
all manifest actions verify → report 'already installed, up to date', make no writes,
skip straight to the Phase 8 checklist." Only write a new manifest when something
actually changes.

### F3 — Clone source URL is unresolvable from the shipped repo (`<OWNER>` placeholder)
**Severity: MAJOR. Spec: §3 "clone source … as published in README.md".**
Phase 3 says if cloning is planned the source is
`https://github.com/<OWNER>/fable-god-mode` "as published in README.md." README.md
literally contains the placeholder `https://github.com/<OWNER>/fable-god-mode` (lines
22 and 35). So the "published" URL *is* a placeholder — the agent cannot determine a
real remote and, per the spec's own instruction, must "STOP — never guess a remote."
For any user who received the spec without a clone (the very case Q3 handles), the
install dead-ends. It didn't bite S1–S4 because P6 found a local clone, but it's a
guaranteed failure on the no-clone path.
**Fix:** publish a real owner/URL in README before launch, or have Phase 3 read the
clone URL from `git remote get-url origin` of the repo the INSTALLER came from rather
than from README prose.

### F4 — Audit finding (d) line-count threshold collides with the installer's own block
**Severity: MINOR. Spec: audit.md §2(d) + INSTALLER §5 action 5 + §7.**
When Q4=now (S1), the audit runs in Phase 7 — *after* Phase 5 already appended the
6-line managed block. The pre-Fable file was 204 lines; after the block it is 210. The
audit's "over 200 lines" rule (d) now counts the installer's own just-added block toward
the debt it reports. audit.md §1 says to respect managed blocks, but §2(d) gives no
instruction to *exclude* the fable block from the line count. Two agents differ on
whether to report 204 or 210, and whether to subtract the managed block.
**Fix:** audit.md §2(d) should say "count excludes any fable-god-mode managed block,"
and/or Phase 7 should note the audit measures the file as it was at P11 (pre-install).

### F5 — Two independent CLAUDE.md backups with no cross-reference (Phase 5 vs audit.md §6)
**Severity: MINOR. Spec: §5 action 4 + audit.md §6.1.**
S1 produced two backups seconds apart: `CLAUDE.md.bak-<t1>` (Phase 5
`claude_md_backup`) and `CLAUDE.md.bak-<t2>-audit` (audit.md §6.1 "backup first").
audit.md §6.1 unconditionally backs up before its edit; it doesn't know Phase 5 already
made one minutes earlier. Harmless (backups are never deleted), but a non-technical user
sees two near-identical `.bak-` files and won't know which is the "real" restore point,
and the manifest only records the Phase-5 one — the audit backup is untracked by any
manifest, so §10 rollback won't mention it.
**Fix:** either have the audit reuse/reference the manifest's existing backup when one
exists from this run, or record audit backups in the archive manifest so they're
discoverable.

### F6 — "Restart needed" hinges on SKILLS_DIR creation, but pre-existing skills dir is common and silently flips it
**Severity: MINOR (FRICTION). Spec: §6, §8, P10.**
Restart-needed = "SKILLS_DIR was created just now." In S1 the user skills dir already
existed (it held `old-web-search`), so restart=no and the checklist omits the restart
instruction. That's spec-correct, but a first-time skill *of this kind* still needs a
Claude Code restart to be picked up regardless of whether the parent `skills/` dir was
pre-existing. The spec ties the restart note to the wrong signal (dir creation) rather
than to "a new skill directory appeared." A user with a pre-existing `skills/` dir will
be told no restart is needed and then find `fable-god-mode` doesn't load until they
restart.
**Fix:** base the restart note on "a skill path new to Claude Code was just installed,"
not on whether the parent `skills/` dir was freshly created.

### F7 — §10 leaves the `.claude/` parent dir on project-scope rollback; no action tracks it
**Severity: MINOR. Spec: §10 `mkdir` row + Appendix A.**
S3 rolled back cleanly (copy hashes matched exactly, dir removed, SKILLS_DIR removed
because created:true+empty, block/backup never existed, manifest kept with both entries
`rolled_back`). But the manifest only tracks `SKILLS_DIR` (`$FAKEPROJ/.claude/skills`).
In project scope the installer also had to create `$FAKEPROJ/.claude/` to hold the
manifest itself. §10 has no action-type for that parent, so it's left behind (correctly,
since the manifest must persist there) — but the spec never acknowledges the parent
`.claude/` it may have created, so an agent can't reason about it. Result after rollback:
an otherwise-empty `.claude/` containing only the manifest.
**Fix:** note in §5/§10 that the manifest's own `.claude/` parent is intentionally
retained as the rollback record, so agents don't try to remove it or flag it as debris.

### F8 — Manifest `seq` numbering is under-specified (global counter vs per-action)
**Severity: MINOR. Spec: Appendix A.**
Appendix A's example numbers actions 1–5 with `clone`/`mkdir`/two `skill_install`/
`backup`/`block`, but §5's action list also numbers items 1–5 as *action types*, where
`skill_install × N` is a single numbered item. When `clone` is skipped (S1–S4, repo
present) an agent must decide whether `seq` starts at 1 for the first *performed* action
or preserves the Appendix-A absolute numbering (where mkdir would be seq 2). I used
"first performed = seq 1"; another agent would keep the gaps. §10 processes in reverse
by array order so it works either way, but two manifests for the same install would have
different `seq` values — bad for any external tooling keyed on `seq`.
**Fix:** state that `seq` is a monotonic counter over *performed* actions starting at 1,
skipped actions get no entry.

### F9 — `completed_at == started_at` when a run finishes within one second
**Severity: MINOR (cosmetic). Spec: §5 + Appendix A + §8 smoke line "approved in N ms".**
Fast god-mode installs complete inside one wall-clock second, so ISO-second-precision
`started_at` and `completed_at` are identical, and the Phase-8 "approved in N ms" line
has no basis in god mode (bridge skipped). Purely cosmetic but looks like a stopwatch bug
to a careful user.
**Fix:** use millisecond precision or accept identical timestamps explicitly.

### F10 — Q1 super gate ignores the P4/P5 probes it sits next to
**Severity: FRICTION. Spec: §2 Q1 + §1 P4/P5 + §2 preamble.**
§2 says "Do NOT ask the user to self-report what their plan includes — that is what
probes are for," yet Q1.3 asks the user to self-report their ChatGPT plan tier
(Plus/free), and Q1.2 asks whether they *can* complete a browser login — both are
un-probeable up front, fair enough, but Q1.1's data-disclosure consent is collected
*before* P4/P5 results are shown to the user in the interview flow. A user who says
"yes, I want super" may not have been shown that P5 already found them logged-out. The
ordering (preflight report → interview) technically shows P5 first, but the interview
never *references* the preflight finding, so the human answers Q1 blind to "you're not
logged in yet." Not a correctness bug; a UX gap that makes the S4 wall feel like a
surprise rather than a foreseen step.
**Fix:** have Q1 echo the relevant P4/P5 finding ("preflight found Codex installed but
not logged in — you'll need to complete a browser login") so the consent is informed.

---

## What passed cleanly (PASS evidence)

- **S1 Phase 5 idempotency guard**: block written exactly once; re-read verified.
- **S1 audit archive (audit.md §4)**: pre-move sha256 computed, dated dir created with
  preserved relative structure (`…/2026-07-02/skills/old-web-search/SKILL.md`),
  manifest.json written with original_path/archive_path/sha256/reason/category, post-move
  sha256 recomputed and **matched** — archive verified, original dir removed.
- **S1 audit CLAUDE.md edit (audit.md §6)**: separate backup, unified diff shown,
  ONE logical change applied (mandatory-gate removal), declined findings (ultrathink,
  model-routing) left intact, managed block untouched, re-read confirmed.
- **S2 §9 Update**: exactly ONE sentinel block, ONE live manifest + ONE `.prev`,
  symlink intact with correct target — idempotency invariant held for files.
- **S3 §10 copy-undo ownership check**: enumerated current dir, compared paths + every
  sha256 to manifest `files`, exact match confirmed before removal; SKILLS_DIR removed
  only because created:true AND empty; backup correctly absent (action never reached);
  manifest kept with both entries `rolled_back` + `rolled_back_at`.
- **S4 downgrade**: no half-super state — no super symlink, block still mode=god,
  manifest mode=god, no super skill_install entry; Codex CLI (real, pre-existing) not
  installed by the run so §4 non-rollbackable note was moot.

## Severity counts
- Blocker: 1 (F1)
- Major: 2 (F2, F3)
- Minor: 5 (F4, F5, F7, F8, F9)
- Friction: 2 (F6, F10)
- Total: 10
