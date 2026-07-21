---
name: session-handoff
description: "Pause a heavy session at a NATURAL boundary and hand off to a fresh session via an audited handoff doc + ONE paste-able resume one-liner. Trigger when the user asks to resume/continue in a NEW session or chat ('resume in a new session', 'new session resumption', 'session handoff', 'let's pause and continue in a new chat', 'give me the resume one-liner', 'pause at a natural boundary and continue in a new session'), or asks to wrap up because the session/context is heavy. ALSO trigger proactively: when the session context has grown very heavy (roughly 500k+ tokens of history — multiple compactions, a long multi-phase transcript; a heuristic, not a counter) and a natural boundary is near, PROPOSE this skill to the user in one line; never pause on your own. Project-agnostic — any repo, any teammate, any session type. The handoff gets a MANDATORY clean-context audit (cross-model via Codex preferred when installed AND consented) to minimize context loss, and the deliverable is ONE line pasted into the new session."
---

# Session Handoff — natural pause → audited handoff doc → one-liner resume

Heavy sessions degrade and cost more: past roughly ~500k tokens of history the cache
churn, compaction losses, and re-reading overhead all grow, and billing grows with
them. The cure is a clean cut: pause at a NATURAL boundary, externalize the state so
a zero-context successor can continue with minimal loss, audit that externalization
with a fresh set of eyes, and give the human ONE line to paste into the fresh
session. This skill is that procedure. It is generic — discover the project's own
conventions and adapt; never assume a specific domain, agent roster, or doc layout.

**Two hard rules up front:**
- **Never an abrupt pause.** If work is running, find the natural boundary first (Step 0).
- **The deliverable is a ONE-LINER**, not a wall of prompt. The wall lives inside the
  handoff doc; the one-liner points at it.

## Step 0 — Find the natural pause (only if work is in flight)

Inventory everything live: background subagents, workflows, background bash, external
jobs (CI, deploys, paid batches). Then:

1. **Nothing running** → you are already at the boundary; go to Step 1.
2. **Bounded work mid-flight** (a build/review/gate cycle, a batch that lands soon) →
   announce in ONE line what you are waiting for, let it land, close out ONLY what is
   already in motion (e.g. the review round that just returned), and start nothing new.
   The boundary = the current cycle's verdict/receipt landing on disk.
3. **Long/unbounded work** (hours-long runs) the user wants to leave running or that
   cannot finish before the pause → do NOT kill it unless the user says so. Instead
   externalize its resume recipe: receipts/checkpoint paths on disk, the exact restart
   command (e.g. a workflow script path — note that same-session run-ids and agent ids
   DIE with the session, so a successor needs the from-disk restart form), and what
   "done" will look like. A new session can never message this session's agents —
   anything only they know must be written to disk NOW.
4. If the user asked to pause "when it arrives", state the boundary you're waiting on
   in one line and wait. One line only.

## Step 1 — Discover the current state

- `git log --oneline -10` and `git status -s` (real hashes; honest about uncommitted work).
- Find the newest prior handoff (`*HANDOFF*`, `*RESUME*`, checkpoint docs — check repo
  root, docs/, and any orchestration dirs) and MATCH its conventions; the new doc
  supersedes it explicitly.
- Skim the live frontier (latest plans/ledgers/trackers/task list) and pin down: DONE /
  IN-FLIGHT (with resume recipes from Step 0) / IMMEDIATE NEXT / DECISIONS PENDING ON
  THE HUMAN.
- Note which state sources are STALE (e.g. trackers that lag ledgers) — the handoff
  must warn the successor which files are authoritative.

## Step 2 — Write the handoff doc

Location: follow the repo's existing handoff convention; else docs/; else repo root.
Name: `SESSION_HANDOFF_<YYYYMMDD-HHMM>.md` (or the house pattern, e.g.
`COMPACTION_HANDOFF_<date>.md`). Scale depth to the session's weight — a light session
gets a light handoff; never pad.

Frontmatter: `date`, `status: session_handoff (gate pending)`, `supersedes:` (prior
handoff), `purpose`, and a **precedence rule** naming which live files outrank this
snapshot (evidence/ledgers > this handoff > trackers/logs, adapted to the repo).

Sections (keep the skeleton; scale each):
- **§1 What happened this session** — one honest paragraph. Real numbers, real paths,
  failures included.
- **§2 Binding disciplines/constraints** — the non-negotiable rules of this project,
  verbatim where they are laws (style rules, review gates, safety rules, budget rules).
- **§3 State pointers** — the files a successor reads, IN ORDER, each with a one-line
  why. Mark stale sources as historical-only. Prefer repo-relative paths.
- **§4 In-flight / immediate next** — exact next actions, including any fix specs
  already ruled, and the restart recipes for anything left running (from Step 0).
- **§5 Pending on the human** — every decision waiting on the user, none resolved
  silently. If the user said they'll open the next session with questions, say so:
  the successor's readback comes first, then their questions, then work.
- **§RESUME** — the full paste-able successor prompt in a fenced block. It must be
  self-contained: working dir; a FIRST step that spawns a clean-context read-only
  sub-agent to digest the handoff + key state files (quote verbatim, `found:false`
  over invention); a gate on that digest where the project uses one; a read-only
  state check; then a READBACK to the user followed by **STOP AND WAIT** (no work
  until the user's word). Carry the project's constraint list verbatim.

## Step 3 — Audit the handoff (MANDATORY)

The author is the one session that cannot see its own blind spots, and state can go
stale while the doc is written. A **clean-context audit** must run before the handoff
is trusted:

- **Cross-model audit (preferred), only with consent:** if the `fable-super-god-mode`
  bridge (or another second-model reviewer) is installed AND the user has already
  explicitly consented to sending project content to that provider (e.g. at that
  tool's install), run a one-shot audit there. The audit sends the handoff text and
  possibly referenced files to the external provider — if consent is not already
  established, DISCLOSE that and ask first, or use the fallback. Never assume consent
  from mere installation of this skill.
- **Fallback (no second model / no consent):** the same audit brief to a FRESH
  clean-context subagent on the strongest available local model. This is
  context-independent (fresh eyes), though not model-independent — state inside the
  doc which form ran.
- **The audit brief, either way:** *"Simulate the zero-context successor with ONLY
  this handoff + its referenced files. Audit AGAINST THE ESTATE: (1) stale or false
  facts vs the live files; (2) state checks that cannot literally pass; (3) queue
  items missing or mis-ordered; (4) decisions/pending items silently dropped;
  (5) defects in the §RESUME prompt itself (paths, read scope, stop-and-wait
  semantics). Findings most-severe-first, each with exact correction text."*
- Apply accepted findings **APPEND-ONLY** as a `GATE CORRECTIONS` section (the audited
  body stands unedited; corrections supersede it). If any finding changes the §RESUME
  prompt itself, ALSO append a **§RESUME-CORRECTED** that supersedes §RESUME. Log the
  round if the project keeps an adjudication log.
- Zero findings → record "gate: APPROVED, zero findings" in the doc.

## Step 4 — Commit (if that's the house pattern) and deliver the ONE-LINER

- Commit the handoff (pathspec-only, no unrelated files, no secrets) if the repo's
  history shows handoffs get committed; otherwise note it's uncommitted.
- Path rule: if the handoff is committed / shared with a team, use the REPO-RELATIVE
  path in the one-liner and say "run from the repo root" — that makes the same line
  work on any teammate's checkout. Use an absolute path only for a same-machine,
  uncommitted handoff.
- Reply to the user with a 3-5 line gist of where things stand, plus THE ONE-LINER —
  pick the matching template:

  **(a) The gate changed the §RESUME prompt (a §RESUME-CORRECTED exists):**
```
Read <PATH-TO-HANDOFF> and execute its §RESUME-CORRECTED prompt exactly as written (the GATE CORRECTIONS supersede the body) — recovery and its gate first, then the state check, then the readback — then STOP and wait for my word before any work.
```
  **(b) The gate found body-only issues (GATE CORRECTIONS exist, §RESUME unchanged):**
```
Read <PATH-TO-HANDOFF> and execute its §RESUME prompt exactly as written, treating the GATE CORRECTIONS section as superseding the body wherever they conflict — recovery first, then the state check, then the readback — then STOP and wait for my word before any work.
```
  **(c) Zero findings:**
```
Read <PATH-TO-HANDOFF> and execute its §RESUME prompt exactly as written — recovery first, then the state check, then the readback — then STOP and wait for my word before any work.
```
- Then **STOP**. The purpose is a clean boundary — do not start the next task.

## Proactive use (the ~500k rule)

You cannot count your context precisely; use signals: the transcript has been
compacted (once or more), the session spans many phases/hours, tool results are
being summarized away. When heavy AND a natural boundary is near, offer ONCE, in one
line: "Context is heavy — want an audited handoff + resume one-liner at the next
natural pause?" The user decides. Never abrupt-pause unilaterally, and never nag.
