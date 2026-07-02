# Fresh-session test kit (pre-launch dogfooding)

Purpose: simulate a brand-new user and catch friction BEFORE launch. Each test is
a prompt you paste into a fresh Claude Code session, plus a checklist of what to
record while you watch. Run these on: (A/B) this machine, fresh session; (C) a
machine that has never seen this repo — the "new laptop" test; (D) the
marketplace path.

> **These tests really install.** On a machine you care about, either use
> project scope into a throwaway directory, or finish each test with the
> rollback prompt (Test E) and verify it cleaned up. The installer's manifest
> makes this safe, and exercising the rollback IS part of the test.

## Test A — God Mode, fresh session (naive user)

Setup: `git clone <repo-url> && cd fable-god-mode`, open a fresh Claude Code
session in that directory. Paste exactly:

```
Set up Fable God Mode
```

That one line is the product promise — do not add hints. If Claude does not find
INSTALLER.md on its own, that is finding #1.

## Test B — Super God Mode, fresh session

Same setup. Paste exactly:

```
Set up Fable Super God Mode
```

You will need to complete the `codex login` browser step when asked (that is
part of the test — note how clearly you were told what to do). If you want to
test the refusal path instead, answer "no" to the data-disclosure question and
confirm you cleanly land in God Mode.

## Test C — New laptop (the real test)

On a machine with Claude Code but nothing else prepared:

1. Do NOT clone first. Open Claude Code anywhere and paste:

```
I want to install Fable God Mode from https://github.com/<OWNER>/fable-god-mode — set it up for me.
```

2. This exercises the clone-first path (INSTALLER.md Q3). Watch whether the
   clone location, scope question, and restart note are clear to someone who
   has never seen the repo.
3. If the machine has no Node: God Mode should still install with a warning;
   Super should be blocked with a clear explanation. Both are pass criteria.

## Test D — Marketplace path

In a fresh session:

```
/plugin marketplace add <OWNER>/fable-god-mode
/plugin install fable-god-mode@fable-god-mode
/reload-plugins
```

Then paste: `Finish Fable God Mode setup` — this must take the §9 "adopt" path:
no duplicate skill install, managed block written, same end state as Test A.

## Test E — Rollback / uninstall (run after any of the above)

```
Undo the fable-god-mode install
```

Pass: skills gone (but plugin-installed ones only reported, not removed),
managed block removed surgically (your other CLAUDE.md content untouched),
manifest retained with rolled_back statuses, backups still present.

## What to record (the friction log)

For every step, note:

| Field | What to write |
| --- | --- |
| Step | which phase/question you were at |
| Expected | what INSTALLER.md says should happen |
| Observed | what Claude actually did / asked |
| Severity | blocker / major / minor / cosmetic |
| Naive-user lens | would a non-technical person know what to do here? |

Specific things to watch for:

- Did the preflight report appear BEFORE any question or change?
- Was the data-disclosure question asked verbatim, before anything else Codex-related?
- Was every mutation preceded by the Phase 3 plan and a yes?
- Did the CLAUDE.md edit show as a diff first?
- Was the restart note shown when `~/.claude/skills/` was newly created?
- Did the final checklist reflect probes actually run (not optimism)?
- Anywhere Claude improvised beyond the spec — spec bug, log it.

## Reporting back

Paste the friction log into the build session (or a new one) with:

```
Here are the fresh-session test results for fable-god-mode. Adjudicate each item, fix the spec or skills accordingly, re-run the Codex gate on any logic changes, and log the round to .orchestration/feedback.jsonl.
```
