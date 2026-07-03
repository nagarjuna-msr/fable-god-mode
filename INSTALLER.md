# INSTALLER.md — Fable God Mode setup spec (v0.1.0)

**Audience: the Claude Code agent performing the install.** You are the EXECUTOR of
this spec, not its interpreter. Follow the phases in order, exactly. Where the spec
says STOP, stop and wait for the user. Where it says show, show before doing. If a
step is impossible on this machine, say so plainly and stop — do not improvise a
substitute. Users: you can read along; everything the agent does comes from here.

What gets installed, by mode:

| Mode | Skills installed | Extra requirement |
| --- | --- | --- |
| **god** | `fable-god-mode` | none (Claude subscription only) |
| **super** | `fable-god-mode` + `fable-super-god-mode` | ONE of: paid ChatGPT plan + Codex CLI, OR Alibaba Cloud Model Studio account + Qwen Code CLI (choose the reviewer provider in Phase 2) |

## 0.0 Bootstrap — obtaining this spec (read this first on a machine with no clone)

You must execute this spec VERBATIM, so you must first possess its exact text:

- If a local clone exists, read the file from it. Done.
- If the user gave only a repo URL, fetch the RAW file (e.g.
  `https://raw.githubusercontent.com/<owner>/fable-god-mode/main/INSTALLER.md`)
  — a raw fetch is read-only and mutates nothing. NEVER work from a summarizing
  fetcher or search snippet: a paraphrased spec is not this spec.
- If raw fetching is unavailable, ask the user before cloning: "I need to
  download the repo to read the installer — OK to clone it to `~/fable-god-mode`?"
  A clone made with that yes (or one the user's own request already named) IS the
  Q3/P6 clone: surface it in the Phase 3 plan as already-performed and record it
  in the manifest as the `clone` action once Phase 5 starts. This is the SOLE
  exception to Ground rule 1, and it carries its own cleanup rule: **if the run
  ends for any reason before Phase 5** (user aborts, preflight hard-stops, plan
  declined), you made a clone that no manifest records — say so and offer to
  remove it before ending. No other mutation is permitted before Phase 3
  approval.
- **Once a clone exists, its INSTALLER.md is authoritative.** If you bootstrapped
  from a raw fetch, compare it against the cloned file; if they differ (a push
  landed in between), STOP and restart from Phase 1 using the cloned spec —
  never keep executing a spec that doesn't match the repo you installed.

## 0. Ground rules (bind every phase)

1. **Transaction order.** NOTHING on this machine is created, edited, linked, or
   moved until Phase 1 (preflight) has passed, Phase 2 (interview) has collected
   every consent, and Phase 3 (plan) has been approved. All mutations happen in
   Phase 5, in manifest order. Two named exceptions only, each consent-gated:
   the §0.0 bootstrap clone (with its pre-Phase-5 abort-cleanup rule) and the
   reviewer CLI install/auth — Codex CLI login or Qwen Code CLI key setup,
   whichever provider was chosen (Phase 4, explicitly non-rollbackable).
2. **Consent is per-change-class, explicit, and never assumed.** The consents are
   C1 (install skills), C2 (data disclosure to the CHOSEN reviewer provider —
   OpenAI if Codex, Alibaba Cloud Model Studio if Qwen — super only, scoped to
   whichever one the user picked in Phase 2), C3 (install the chosen reviewer
   CLI — Codex CLI or Qwen Code CLI — super only, only if missing), C4 (edit
   CLAUDE.md — shown as a diff first). Audit remediation has its own per-item
   consent (C5) defined in `skills/fable-god-mode/references/audit.md`.
3. **Never delete user content.** The installer creates, links, and edits inside
   its own sentinel block. The audit archives (moves), never deletes. Backups are
   never deleted, even by rollback.
4. **Never duplicate.** Before writing the managed CLAUDE.md block, search for an
   existing `<!-- BEGIN fable-god-mode` sentinel. If found → this is a RE-RUN;
   switch to §9 semantics (update / repair / remove). Never append a second block.
5. **Verification is by probe, not by assertion.** "I logged in" is verified with
   `codex login status`; "skill installed" is verified by reading the installed
   path; the bridge is verified by running it.
6. **Report failures faithfully.** If a probe or smoke test fails, show the real
   output and route per this spec. Never mark the install verified when it isn't.

## 1. Preflight (read-only — mutates nothing)

Run these probes and collect results. Commands are POSIX; use the PowerShell
equivalents on Windows.

| # | Probe | Command / check |
| --- | --- | --- |
| P1 | OS + shell | `uname -s` (or Windows detection) |
| P2 | Node ≥18 | `node --version` |
| P3 | git | `git --version` |
| P4 | Codex CLI | `codex --version` (missing is fine for god mode) |
| P5 | Codex auth | `codex login status` — authenticated iff exit 0 (skip if P4 missing) |
| P4q | Qwen Code CLI | `qwen --version` (missing is fine for god mode; also fine if the user will choose Codex) |
| P5q | Qwen key present | does a Qwen provider key look configured — a `DASHSCOPE_API_KEY` env var, or a non-empty `env`/`modelProviders` entry in `~/.qwen/settings.json`? This is an EXISTENCE check only, never a validity claim — Qwen Code CLI has no `login status`-equivalent probe; the only proof of a working key is the Phase 4 model probe (skip if P4q missing) |
| P6 | Repo location | is this session already inside a clone of `fable-god-mode` (INSTALLER.md + `skills/fable-god-mode/SKILL.md` present)? Record the absolute repo path. |
| P7 | Existing installs | for BOTH scopes: does `<skills-dir>/fable-god-mode` or `<skills-dir>/fable-super-god-mode` exist (as dir or symlink, and pointing where)? If `fable-super-god-mode` exists, also record WHICH provider by checking its `scripts/` dir: exactly one of `ask-codex.mjs` (Codex) / `ask-qwen.mjs` (Qwen) is the healthy case. If NEITHER is present → record `provider: unknown`, route to §9 repair (the install is broken, not merely outdated). If BOTH are present → record `provider: ambiguous`, route to §9 repair (a prior install or provider-switch failed to prune the other script — Phase 5 action 3 requires exactly one to survive). Never guess which one is "active" from an ambiguous state. |
| P8 | Existing managed blocks | search user `~/.claude/CLAUDE.md` and project `./CLAUDE.md` for BOTH `<!-- BEGIN fable-god-mode` and `<!-- END fable-god-mode -->` — record version + mode + `reviewer` from the sentinel (§9's Current-state check compares all three). An unmatched (BEGIN without END, or END without BEGIN) or duplicated sentinel = the §9 damaged-block state; route there BEFORE any normal install. |
| P9 | Existing manifest | `~/.claude/fable-god-mode.manifest.json` and/or `./.claude/fable-god-mode.manifest.json` present? |
| P10 | Skills dir pre-existing? | does `~/.claude/skills/` (and `./.claude/skills/` for project scope) already exist? (Determines the restart note in Phase 8.) |
| P11 | CLAUDE.md size | line counts of `~/.claude/CLAUDE.md` and `./CLAUDE.md` (informational, for the audit offer) |

**Print a preflight report** — a short table of P1–P11 results in plain language.
Hard stops: Node missing or <18 (needed for the Super bridge and general health —
for god mode a missing Node is a warning, not a stop). If P8/P9 found existing
install state → tell the user and jump to §9 after the report.

## 2. Interview (questions, no mutations)

Ask concrete questions about facts the user knows. Do NOT ask the user to
self-report what their plan includes — that is what probes are for.

**Q1 — mode and reviewer provider.** First echo the relevant preflight findings
so the answer is informed — e.g. "Preflight found the Codex CLI installed but
not logged in — Super God Mode would need a browser login from you", "Preflight
found a Qwen provider key configured but Qwen Code CLI not installed", or "Both
Codex and Qwen Code CLI look available — Super God Mode can use either." When
P5 (Codex) or P5q (Qwen) already looks satisfied for the chosen provider, the
matching sub-question below is informational only (Phase 4 will skip
install/auth and go straight to the model probe — do not tell an
already-authenticated user to log in or re-enter a key). Then ask, verbatim:

1. "Do you want Claude to send selected code snippets to a second AI model for
   independent review? This is what powers Super God Mode's second-model
   reviews. yes/no"
2. If yes: "Which reviewer would you like: **Codex** (OpenAI's Codex CLI, model
   `gpt-5.5`, needs a ChatGPT plan) or **Qwen** (Qwen Code CLI, model
   `qwen3.7-plus`, needs an Alibaba Cloud Model Studio account)? codex/qwen"
   → a yes to Q1.1 PLUS this provider choice together IS consent **C2** (data
   disclosure), scoped to the chosen provider only — OpenAI if codex, Alibaba
   Cloud Model Studio if qwen. Record both the yes and the provider.
3. **If codex chosen:**
   1. "Can you complete a browser login to ChatGPT on this machine? yes/no"
   2. If yes: "Do you have a paid ChatGPT plan (Plus or higher)? The free tier
      has Codex but with a small quota. yes/no/free-tier"
4. **If qwen chosen:**
   1. "Do you have (or can you create) an Alibaba Cloud Model Studio (DashScope)
      account with an API key? yes/no" (there is no browser-login step for this
      provider — auth is a key in an environment variable or config file, set
      up in Phase 4)

All yes (through the chosen provider's branch) → mode = **super**, with the
chosen provider recorded. Any no → mode = **god** (tell the user they can
re-run the installer later to upgrade, and can choose either provider then;
nothing about god mode blocks it). Codex free-tier → super is possible but warn
about quota; let the user choose.

**Q2 — scope.** "Install for all your projects (`~/.claude/skills/`) or only this
project (`./.claude/skills/`)?" Default: all projects. If the current project IS
the fable-god-mode clone itself (P6 path == the working directory), say so:
project scope would install into the clone — fine for trying the skill out (the
repo's `.gitignore` keeps that install out of git), but choose all-projects to
use it across your real work. Set:
- user scope: `SKILLS_DIR=~/.claude/skills`, `CLAUDE_MD=~/.claude/CLAUDE.md`,
  `MANIFEST=~/.claude/fable-god-mode.manifest.json`
- project scope: `SKILLS_DIR=./.claude/skills`, `CLAUDE_MD=./CLAUDE.md`,
  `MANIFEST=./.claude/fable-god-mode.manifest.json`

**Q3 — install method.**
- If the repo is cloned locally (P6) and the user intends to keep it: default =
  **symlink** each skill dir into `SKILLS_DIR` (updates arrive via `git pull`).
- On Windows: default = **copy** (symlinks require Developer Mode/admin); offer
  symlink only if the user confirms symlinks work on their setup.
- If there is no local clone: explain in plain language ("a clone is just a
  downloaded copy of the project; it stays on your machine and updates with
  `git pull`"), ask where to put it (default `~/fable-god-mode`), record that
  cloning is part of the plan — and once the clone exists, the symlink/copy
  defaults above apply to it.
- The user may always choose copy over symlink.

**Q4 — audit offer.** "After install, want a stale-config audit? It is
REPORT-ONLY — it lists pre-Fable config that wastes tokens, and changes nothing
without per-item consent. now / later / no"

Asking Q1.1 with a yes answer collects **C2**. Proceeding past Q1–Q4 collects
**C1** implicitly only in the sense that the user chose a mode and scope — the
binding approval is Phase 3.

## 3. Install plan — STOP for approval

Assemble and SHOW the complete plan before touching anything:

1. Every path that will be created or linked (exact absolute paths, symlink vs
   copy, link targets).
2. The exact managed block that will be inserted into `CLAUDE_MD` (Appendix B),
   shown as a unified diff against the current file. This is consent **C4**.
3. Whether the chosen reviewer CLI (Codex CLI or Qwen Code CLI, per Q1) will be
   installed (super, only if missing) and by which command. This is consent
   **C3**.
4. The manifest path and a one-line explanation: "every change is recorded here;
   'undo the fable-god-mode install' reverses it."

Super-mode note on the block preview: the `codex_model` / `qwen_model` value
(whichever matches the chosen provider) is only validated in Phase 4. Show the
block with the intended model marked "(pending validation)". If Phase 4 ends up
validating a DIFFERENT model than the one shown, re-show the changed block line
and get a fresh yes before Phase 5 writes it — C4 covers what the user saw, not
a substitute.

If cloning is planned (Q3): determine the clone source in this order —
(1) `git remote get-url origin` run in the directory this INSTALLER.md came
from, if it is a git checkout; (2) the URL published in README.md's Install
section; (3) ask the user for it. If none yields a real URL — an unfilled angle-bracket
template like `<owner>` or `<your-fork>` is NOT a real URL — STOP; never guess
a remote.

Then ask: **"Proceed? yes/no"** — STOP until answered. No → end politely; nothing
has changed (say exactly that). Yes → C1/C3/C4 are now collected; continue.

## 4. Reviewer bridge setup (super mode only; skip entirely for god mode)

Follow the reference doc matching the provider chosen at Q1 — `setup-codex.md`
for Codex, `setup-qwen.md` for Qwen. Both share the same shape: agent probes →
agent installs the CLI if missing (uses C3) → auth step → agent runs the bridge
model probe. The auth step differs by provider:

- **Codex:** follow `skills/fable-super-god-mode/references/setup-codex.md`
  §2–§5 exactly. **USER completes `codex login` in the browser** (the agent
  cannot; wait, then re-probe `codex login status`).
- **Qwen:** follow `skills/fable-super-god-mode/references/setup-qwen.md`
  §2–§5 exactly. There is no browser login — the USER supplies (or the agent
  helps set) a `DASHSCOPE_API_KEY` environment variable or a
  `~/.qwen/settings.json` entry. There is no CLI-native "logged in" probe for
  this provider; the model probe below is the ONLY proof auth actually works.
  **Never have the agent print, log, or echo the raw key value** — per this
  project's own data-handling norm, secrets pass through user-set environment
  or the user's own file edit, not through agent output.

**Probe path (binding):** in this phase the skill is NOT yet installed (that is
Phase 5), so the bridge probe runs from the REPO clone, which P6/Q3 guarantees:
`node "<repo>/skills/fable-super-god-mode/scripts/ask-codex.mjs" <prompt-file>`
(Codex) or `node "<repo>/skills/fable-super-god-mode/scripts/ask-qwen.mjs" <prompt-file>`
(Qwen) — whichever matches the chosen provider. Wherever the reference doc
writes `${CLAUDE_SKILL_DIR}`, substitute `<repo>/skills/fable-super-god-mode`
during install. The Phase 6 smoke test then re-runs the bridge from the
INSTALLED path — both must pass.

- The model probe validates that the default model (`gpt-5.5` / `qwen3.7-plus`,
  or the matching `CODEX_MODEL` / `QWEN_MODEL` override) actually answers
  through the chosen bridge script. Record the WORKING model value under the
  matching field (`codex_model` or `qwen_model`) — it goes into the managed
  block in Phase 5.
- If the probe cannot be made to pass (no working model / auth impossible):
  offer to continue as **god mode** (mode downgrade, with the user's OK), or —
  if the OTHER provider's prerequisites are also available per preflight —
  offer to switch provider and retry this phase once, or stop. Never install
  super-god-mode with a failing bridge.
- **Non-rollbackable note:** installing the Codex CLI or the Qwen Code CLI
  changes the machine outside this installer's manifest scope. Rollback (§10)
  does NOT uninstall either CLI. Say this when C3 is used, naming whichever CLI
  was actually installed.

## 5. Managed writes (the only phase that mutates)

Initialize the manifest (Appendix A) with `version`, `mode`, `scope`,
`started_at`, empty `actions`. Then, for EACH action: append the action entry
with `"status": "planned"`, SAVE the manifest, perform the action, set
`"status": "done"`, save again.

**Crash semantics (binding for §10):** `"planned"` means "the mutation may or
may not have happened" — a crash can land between the save and the action, or
between the action and the `"done"` save. Rollback therefore treats `planned`
entries as SUSPECT: it probes the disk for the described mutation and undoes it
only when ownership evidence matches (symlink target, copy hashes, sentinel
content — the same checks §10 requires for `done` entries). `done` means the
action completed and was verified in-phase.

Actions, in order:

1. `clone` (only if planned in Q3): clone the repo to the agreed path.
2. `mkdir`: create `SKILLS_DIR` if missing (record whether it was created —
   restart note depends on it).
3. `skill_install` × N: for `fable-god-mode` (always): symlink
   `SKILLS_DIR/<name>` → `<repo>/skills/<name>`, or copy the directory. Record
   type, path, target, and for copies a `sha256` of each file copied.

   `fable-super-god-mode` (super only) needs ONE extra step, because the repo
   ships BOTH `scripts/ask-codex.mjs` and `scripts/ask-qwen.mjs` as source, but
   only the CHOSEN provider's script may end up installed — SKILL.md and P7
   both depend on "exactly one bridge script present" being true after
   install, and a naive whole-directory install would leave both:
   - **Copy:** copy the whole directory as normal, then DELETE the
     non-chosen provider's `scripts/ask-<other>.mjs` from the INSTALLED copy
     ONLY (never from the repo clone). Record `files` (for the §10 ownership
     check) as the surviving file set — the deleted script is simply absent
     from that list, not a separate tracked removal.
   - **Symlink:** do NOT symlink the whole directory as one link (that would
     expose both scripts through the repo clone, and there is no way to
     "delete one file" from inside a whole-directory symlink without deleting
     it from the repo clone itself). Instead: create
     `SKILLS_DIR/fable-super-god-mode` as a REAL directory containing
     individual symlinks — `SKILL.md` → repo file, `references/` → repo
     directory (safe as a whole-dir link; nothing inside it needs pruning),
     and `scripts/` as a REAL directory containing exactly ONE symlink,
     `ask-<chosen-provider>.mjs` → the matching repo file. Record each
     individual symlink's path and target in the manifest (not one directory
     target).
   Either way, the installed `fable-super-god-mode/scripts/` directory must
   contain exactly one bridge script when this action completes — verify this
   before marking the action `"done"`.
4. `claude_md_backup`: copy `CLAUDE_MD` to `CLAUDE_MD.bak-<ISO-timestamp>` (only
   if the file exists; record the backup path). Backups are permanent.
5. `claude_md_block`: insert the Appendix B block at the END of `CLAUDE_MD`
   (create the file if absent). Re-read the file afterward and verify the block
   appears exactly once (Ground rule 4).

Finish by setting `completed_at` in the manifest.

## 6. Smoke tests (verify, honestly)

**God mode:** read `SKILLS_DIR/fable-god-mode/SKILL.md` through its installed
path (resolves the symlink); confirm the YAML frontmatter parses and the
`references/` files are reachable. If `SKILLS_DIR` was newly created (P10/action
2), the skill will only appear after a Claude Code restart — that is expected,
not a failure; the checklist says so.

**Super mode (additionally):** run the bridge once end-to-end through the
INSTALLED path, using whichever script matches the chosen provider:

```
printf 'Bridge smoke test. There is no material to review. Respond with verdict "approved", an empty findings array, and summary "install smoke test OK".\n' > <tmpdir>/fgm-smoke.md
node "SKILLS_DIR/fable-super-god-mode/scripts/ask-codex.mjs" <tmpdir>/fgm-smoke.md   # Codex provider
node "SKILLS_DIR/fable-super-god-mode/scripts/ask-qwen.mjs"  <tmpdir>/fgm-smoke.md   # Qwen provider
```

Pass = exit 0 (or 10) AND the envelope parses with the expected fields.
Exit 20 (`codex_unavailable`) = the install is NOT verified — show the
envelope's `error`, route via the matching reference doc's §5/§6
(`setup-codex.md` or `setup-qwen.md`), and either fix and re-test or record the
install as "installed, bridge unverified" in both the manifest
(`"smoke": "failed"`) and the checklist. Never present exit 20 as success.
Manifest `smoke` values are exactly: `"approved"` on pass, `"failed"` on fail,
`"skipped"` in god mode.

**Optional demo** (offer, don't push): plant an off-by-one in a 10-line function,
run a critique, show the finding. This is a "see it work" moment — the smoke
test above, not the demo, is the pass criterion.

## 7. Stale-config audit (if Q4 = now)

Execute per `skills/fable-god-mode/references/audit.md`: scan → numbered findings
report → summary table → the exact sentence "Nothing has been changed. Confirm
any item to proceed, one at a time." Remediation only with per-item consent (C5),
archive-never-delete, manifest + restore path as that file specifies.

## 8. Verification checklist (always print)

```
Fable God Mode install — verification
[ ] Mode: <god|super>   Scope: <all projects|this project>
[ ] Reviewer provider:  <codex (gpt-5.5) | qwen (qwen3.7-plus) | n/a (god mode)>
[ ] Skills installed:   <paths, symlink→target or copy>
[ ] CLAUDE.md block:    v0.1.0 present once in <CLAUDE_MD> (backup: <path>)
[ ] Manifest:           <MANIFEST> (rollback: say "undo the fable-god-mode install")
[ ] Bridge smoke test:  <approved in N ms | SKIPPED (god mode) | FAILED: <error>>
[ ] Restart needed:     <yes — SKILLS_DIR was created just now | no>
[ ] Audit:              <N findings reported, M archived | deferred | declined>
```

Every line must reflect a probe actually run in this session. **Super mode with
a failed bridge smoke test: the checklist's FIRST line must read
`STATUS: installed, NOT verified — bridge smoke test failed` — no other line may
be presented as overall success.** If restart is needed, end with: "Restart
Claude Code, then say 'god mode status' to confirm the skill loads." Even when
restart is NOT needed (pre-existing skills dir gets live pickup), add the
fallback hint: "If the skill doesn't respond in this session, restart Claude
Code — that always re-scans skills."

## 9. Re-runs: update / repair / remove / adopt (idempotency)

If preflight found existing install state (P7/P8/P9), first DISAMBIGUATE:

- **Multiple scopes found** (e.g. manifests or blocks in both user and project
  scope): list them and ask which install this operation targets. Never pick by
  "newest" or any other inference.
- **The user may want a DIFFERENT scope**, not the existing install: after
  showing what exists, ask whether to (a) operate on the existing install
  (update/repair/remove) or (b) do a fresh install into the other scope —
  (b) proceeds as a normal Phase 2→8 run for that scope.

Before offering choices, check for the **Current** state: sentinel version equals
the installer version, the mode matches what the user wants, the sentinel's
`reviewer=` attribute matches the provider the user wants (super mode only —
a version+mode match with a DIFFERENT reviewer is a provider-switch update, not
current), and every manifest action re-verifies on disk using the SAME
per-action ownership predicates §10 defines — symlink: is-link AND target
matches; copy: exact path-set AND every sha256 matches; block: sentinels
present exactly once with version; backup: file still exists.
If so: report "already installed and up to date — nothing to do", make NO writes
(no new manifest, no block rewrite), and skip straight to the Phase 8 checklist.

Otherwise, for the targeted install, ask which the user wants:

- **Update** (e.g. older sentinel version, or repo pulled a new version):
  re-run Phases 3→6, but: replace the existing managed block IN PLACE (parse
  sentinels, swap content, never append), refresh symlinks/copies, write a NEW
  manifest and keep the old one as `<manifest>.prev`. The Phase 3 diff MUST be
  against the CURRENT block content — if the user hand-edited inside the block,
  the diff will show those lines being discarded; point at them explicitly
  before asking for approval. Mode changes are updates too: god→super = also
  run Phase 4 (asking Q1's provider question fresh); super→god = a
  `skill_remove` action (planned/done in the new manifest like any mutation,
  with §10's ownership checks before removal) for the super skill, plus the
  block update — the reviewer CLI itself (Codex or Qwen, whichever was
  installed) is left untouched. **Provider switch within super mode**
  (codex→qwen or qwen→codex, mode unchanged) is also an update: it needs a
  FRESH **C2**/**C3** for the new provider (new data-disclosure destination,
  possibly a new CLI to install), and re-runs the FULL `skill_install` for
  `fable-super-god-mode` (Phase 5 action 3) — not merely a swap of the bridge
  script. For a copy-method install this re-copies the ENTIRE installed
  directory from the repo (SKILL.md, `references/`, both scripts) before
  pruning the non-chosen one, so any user edits to installed files OTHER than
  the bridge script are overwritten too — say so before proceeding. For a
  symlink-method install, the individual `entries` symlinks are simply
  re-pointed/re-created (nothing to overwrite, since symlinks hold no content
  of their own). Either way, finish by updating the block's `reviewer=`
  attribute and model field (`codex_model` ↔ `qwen_model`). The OLD provider's
  CLI is left untouched on the machine (not uninstalled) — say so.
- **Repair** (files missing/broken but block or manifest present): re-verify
  every manifest action; re-create what is missing; replace the block; re-run
  smoke tests. Report what was fixed. **If P7 reported `provider: ambiguous`**
  (both bridge scripts present) or `provider: unknown` (neither present): the
  existing manifest's `reviewer_provider` field is the authoritative answer if
  present and still plausible (e.g. its CLI/key still looks available per
  preflight); if the manifest is missing that field, or absent entirely, ASK
  the user which provider they intend before touching anything — never guess
  from which script happens to still be on disk. Treat the answer as this
  repair's `reviewer_provider`, then prune the other script exactly as Phase 5
  action 3 would on a fresh install.
- **Remove**: run §10 (rollback) off the targeted install's manifest.
- **Adopt** (skills already present — e.g. installed via the plugin marketplace —
  but no managed block or manifest): run Phases 2→8 normally but SKIP the
  `skill_install` actions for skills the existing install already provides
  (record them in the manifest as `"method": "external"` with their found path).
  §10 never removes `external` entries. This is how the marketplace path
  converges on the same end state ("Finish Fable God Mode setup").
- A second `Proceed?` gate (Phase 3) applies to all of these.

**Damaged block state** (BEGIN sentinel present but END missing, or vice versa,
or nested/duplicated sentinels): do NOT guess the block's extent. Show the user
the affected region of the file, propose an exact bounded edit (which lines will
be replaced or removed), and apply it only with explicit approval (C4). If the
user declines, stop — a damaged block is reported, never silently repaired.

Running the installer twice with the same answers MUST leave the machine in the
same state as running it once — one block, one skill path each, one live
manifest. If you find duplicated blocks from a pre-existing broken state, treat
them as the damaged-block state above.

## 10. Abort & rollback

Process the manifest's `actions` in REVERSE order. `done` entries are undone per
the table; `planned` entries are SUSPECT (Phase 5 crash semantics): probe the
disk first — if the described mutation never happened, mark the entry
`"status": "not_performed"` and move on; if it happened, apply the same table
(its ownership checks protect against undoing what isn't ours).

| Action type | Undo — with mandatory ownership check |
| --- | --- |
| `claude_md_block` | remove exactly the sentinel-bounded block; verify by re-read. Damaged sentinels → the §9 damaged-block procedure (bounded, shown, approved edit). Restoring the whole file from backup is a LAST resort, mid-setup only (see below), and always behind a shown diff. If the block action recorded `"created_file": true` and the file now contains nothing but our block, DELETE the file on a plain uninstall (the installer created it; say so in the report) — offer a keep/delete choice only when other content survives in it. |
| `claude_md_backup` | KEEP the backup (never deleted). |
| `skill_install` (symlink) | for a single-`target` entry (`fable-god-mode`, or any whole-directory symlink): verify the path is STILL a symlink AND its current target equals the manifest `target`. Match → remove the symlink only, never the target. Mismatch (user replaced it with a real dir, another link, or plugin-managed content) → STOP and ask. For `fable-super-god-mode`'s per-item `entries` list: apply this same check to EACH entry (the `SKILL.md` symlink, the `references/` symlink, and the one `scripts/ask-<provider>.mjs` symlink) individually — a mismatch on any single entry stops only that entry's removal, not the others; then remove the now-empty `scripts/` and skill directories. |
| `skill_install` (copy) | enumerate the directory's CURRENT contents and compare to the manifest `files` list: the set of paths AND every sha256 must match exactly. Any extra, missing, or modified file → STOP and show the difference; remove only what the user then approves. (For `fable-super-god-mode`, the non-chosen provider's bridge script is correctly ABSENT from `files` per Phase 5's pruning — its absence is expected, not a mismatch.) |
| `skill_install` (external) | NEVER remove — the installer did not create it. Report it ("present, externally managed — uninstall via its own path, e.g. `/plugin uninstall`"). |
| `skill_remove` | nothing to undo (the removal was itself consented); report it. |
| `mkdir` | remove `SKILLS_DIR` only if `"created": true` in the manifest AND the directory is now empty. |
| `clone` | if the manifest records the clone as installer-created: default is REMOVE — but ONLY after proving it pristine: `git status --porcelain -uall` empty (untracked files included), no unpushed commits, `git stash list` empty, AND no install artifacts inside it even if gitignored (`.claude/`, a root `CLAUDE.md`). Anything non-pristine → STOP and ask, listing what was found. If the user made the clone themselves: default is keep; ask. |

Note: in BOTH scopes (`~/.claude/` in user scope on a blank profile, `./.claude/`
in project scope) the installer may have created the `.claude/` parent directory
that HOLDS the manifest — creating it is a precondition of the first manifest
save, not a tracked action. That parent is intentionally retained after
rollback in either scope — the manifest is the rollback record and must survive
it. Do not remove it or report it as leftover debris.

Mark each undone entry `"status": "rolled_back"`, set `"rolled_back_at"`, and
KEEP the manifest file as the record. The reviewer CLI install (Codex or Qwen
Code, whichever was set up) is not undone (§4).

**Mid-setup abort vs later uninstall — the CLAUDE.md rule differs:**

- **Mid-setup abort** (user says stop, or a phase fails hard, during this run):
  the backup taken minutes ago predates any user edits, so if surgical block
  removal fails, restoring `CLAUDE_MD` from that backup (behind a shown diff) is
  acceptable.
- **Later uninstall** ("undo the fable-god-mode install", days later): the user
  may have edited `CLAUDE_MD` since; restoring the old backup would CLOBBER
  those edits. Surgical block removal only. If sentinels are damaged, use the
  §9 damaged-block procedure. Offer whole-file restore only if the user
  explicitly asks for it after seeing a full diff of everything it would revert.

**Uninstall with no manifest at all**: preflight P7/P8 locates the pieces. Before
removing anything, establish ownership per item: a managed block must carry our
sentinels; a symlink must target a `fable-god-mode` repo's `skills/` dir; a
copied dir's files must match the repo's shipped files. The source of truth for
"the repo's shipped files" is, in order: the P6 local clone if present; else a
clone/path the user provides (verify it contains `skills/<name>/SKILL.md`); if
no trusted source is available, copied dirs are ownership-UNPROVEN. Anything
unproven or failing the ownership test is only removed after the user explicitly
confirms that specific item is theirs to remove.

## Appendix A — manifest schema

```json
{
  "installer_version": "0.1.0",
  "mode": "super",
  "scope": "user",
  "repo_path": "/Users/you/fable-god-mode",
  "reviewer_provider": "codex",
  "codex_model": "gpt-5.5",
  "started_at": "2026-07-02T10:00:00Z",
  "completed_at": "2026-07-02T10:04:12Z",
  "smoke": "approved",
  "actions": [
    { "seq": 1, "type": "mkdir", "status": "done", "path": "/Users/you/.claude/skills", "created": false },
    { "seq": 2, "type": "skill_install", "status": "done", "method": "symlink", "path": "/Users/you/.claude/skills/fable-god-mode", "target": "/Users/you/fable-god-mode/skills/fable-god-mode" },
    { "seq": 3, "type": "skill_install", "status": "done", "method": "symlink", "path": "/Users/you/.claude/skills/fable-super-god-mode", "entries": [
      { "path": "/Users/you/.claude/skills/fable-super-god-mode/SKILL.md", "target": "/Users/you/fable-god-mode/skills/fable-super-god-mode/SKILL.md" },
      { "path": "/Users/you/.claude/skills/fable-super-god-mode/references", "target": "/Users/you/fable-god-mode/skills/fable-super-god-mode/references" },
      { "path": "/Users/you/.claude/skills/fable-super-god-mode/scripts/ask-codex.mjs", "target": "/Users/you/fable-god-mode/skills/fable-super-god-mode/scripts/ask-codex.mjs" }
    ] },
    { "seq": 4, "type": "claude_md_backup", "status": "done", "path": "/Users/you/.claude/CLAUDE.md", "backup_path": "/Users/you/.claude/CLAUDE.md.bak-2026-07-02T10-03-58Z" },
    { "seq": 5, "type": "claude_md_block", "status": "done", "path": "/Users/you/.claude/CLAUDE.md", "block_version": "0.1.0", "backup_path": "/Users/you/.claude/CLAUDE.md.bak-2026-07-02T10-03-58Z", "created_file": false }
  ]
}
```

If the chosen provider is Qwen instead, replace `"reviewer_provider": "codex"` /
`"codex_model": "gpt-5.5"` with `"reviewer_provider": "qwen"` /
`"qwen_model": "qwen3.7-plus"` — exactly one of `codex_model` / `qwen_model` is
present, matching `reviewer_provider`. God-mode manifests omit `reviewer_provider`
and both model fields entirely (there is no reviewer to record).

Field notes:
- `reviewer_provider` (super mode only): `"codex"` or `"qwen"`. Governs which of
  `codex_model` / `qwen_model` is present, which bridge script `skill_install`
  installed, and which reference doc (`setup-codex.md` / `setup-qwen.md`) Phase
  4 followed. Absent in god-mode manifests.
- `skill_install` with `"method": "copy"` additionally records
  `"files": [{ "path": "...", "sha256": "..." }]` — the complete list; §10's
  copy-undo compares against it exactly. For `fable-super-god-mode`, this list
  reflects the PRUNED installed set (Phase 5 action 3) — it never includes the
  non-chosen provider's bridge script, because that file was deleted from the
  installed copy before the manifest was written, not merely left untracked.
- `skill_install` with `"method": "symlink"` for `fable-super-god-mode`
  additionally records `"entries": [{ "path": "...", "target": "..." }, ...]`
  — one entry per individual symlink (`SKILL.md`, `references/`, and the ONE
  `scripts/ask-<provider>.mjs`) — instead of a single `target`, because Phase 5
  action 3 requires per-item symlinks here, not a whole-directory link. (The
  `fable-god-mode` skill has no provider split, so its `skill_install` keeps
  the simple single-`target` shape.)
- `skill_install` with `"method": "external"` (adopt path, §9) records the found
  path and, where known, `"provider"` (e.g. `"plugin-marketplace"`); §10 never
  removes it.
- `skill_remove` (mode downgrade, §9) records `path`, `method` of the install it
  removed, and the pre-removal ownership evidence checked.
- `claude_md_block` records its `backup_path` (or `"created_file": true` when
  CLAUDE.md did not exist before this install) so §10 can act even if other
  actions are missing.
- `status` values: `planned` → `done` → (`rolled_back` | `not_performed`).
- `seq` is a monotonic counter over PERFORMED actions, starting at 1; skipped
  actions (e.g. no `clone` when the repo is already present) get no entry and
  no gap.
- Timestamps may use millisecond precision; identical `started_at`/
  `completed_at` on a fast god-mode install is normal, not an error.

## Appendix B — managed CLAUDE.md block

Exactly one block, sentinel-bounded, ≤10 lines inside, inserted at end of file.
Template (fill `<...>`; drop the reviewer line entirely in god mode):

```markdown
<!-- BEGIN fable-god-mode v0.1.0 mode=<god|super> reviewer=<codex|qwen|none> -->
## Fable God Mode (managed — re-run the installer to change; do not hand-edit)
- Default discipline for multi-step tasks: the `fable-god-mode` skill (10-80-10 — plan at full power, delegate the verbose middle to cheaper subagents, review at full power). The user may skip it for any task or session by saying so.
- Deterministic work: route independent critiques through the `fable-super-god-mode` skill (reviewer: <reviewer-description>, validated <date>).
- Installed <date> · scope: <all projects|this project> · manifest: <MANIFEST>
<!-- END fable-god-mode -->
```

Unlike the simple bare-word choices elsewhere in this template (`<god|super>`,
`<all projects|this project>`), `<reviewer-description>` is NOT a literal
pipe-separated token to fill in as-is — it is a single placeholder for exactly
one fully-written phrase, chosen per `reviewer_provider`: `` Codex, model
`gpt-5.5` `` or `` Qwen Code, model `qwen3.7-plus` `` (using whatever model
value the Phase 4 probe actually validated). In god mode, drop the entire
"Deterministic work" bullet line, not just this placeholder.

The `v<X>` in the BEGIN sentinel is the installer version that wrote it; the
`reviewer=` attribute is `none` in god mode, `codex` or `qwen` in super mode —
§9 compares BOTH on re-runs (a version match with a DIFFERENT `reviewer` value
is a provider-switch update, not "already current"). The block deliberately
stays under 10 lines — the discipline itself lives in the skills, which load
on demand.

## Appendix C — Windows command equivalents

The spec's commands are POSIX; on Windows (PowerShell) use exactly these:

| Operation | PowerShell |
| --- | --- |
| OS detect (P1) | `$PSVersionTable.Platform` / presence of `$env:OS -eq 'Windows_NT'` |
| Write probe file (Phase 6) | `Set-Content -Path "$env:TEMP\fgm-smoke.md" -Value 'Bridge smoke test. …'` |
| Symlink a skill dir | `New-Item -ItemType SymbolicLink -Path "<SKILLS_DIR>\<name>" -Target "<repo>\skills\<name>"` (needs Developer Mode or admin). On failure: STOP — do NOT silently copy instead. Copying is a different approved mutation class: mark the symlink action `not_performed`, update the plan to copy actions, and re-run the Phase 3 approval for the changed plan. |
| Copy a skill dir | `Copy-Item -Recurse -Path "<repo>\skills\<name>" -Destination "<SKILLS_DIR>\<name>"` |
| SHA-256 of a file | `(Get-FileHash -Algorithm SHA256 "<file>").Hash.ToLower()` |
| Timestamped CLAUDE.md backup | `Copy-Item "<CLAUDE_MD>" "<CLAUDE_MD>.bak-$(Get-Date -Format yyyy-MM-ddTHH-mm-ssZ -AsUTC)"` |
| Read a file / verify block | `Get-Content -Raw "<CLAUDE_MD>"` |
| Remove a symlink | `Remove-Item "<SKILLS_DIR>\<name>"` (after `(Get-Item <path>).LinkType -eq 'SymbolicLink'` and target check via `(Get-Item <path>).Target`) |

Paths with spaces MUST be quoted as shown. Frontmatter check (Phase 6) = read
the file and verify it begins with `---` and contains `name:` and `description:`
lines — no YAML library required on either platform.
