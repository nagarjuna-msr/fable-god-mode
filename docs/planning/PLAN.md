# fable-god-mode — open-source plan (v2.1, 2026-07-02, post Codex critique: 13/13 findings accepted)

**NAMING — FINAL (user-approved):** Brand = **Fable God Mode** / **Fable Super God Mode**. Repo = `fable-god-mode`. Skill dirs = `skills/fable-god-mode/` and `skills/fable-super-god-mode/` (the `fable-` prefix avoids collisions with existing "god-mode" toolkits in users' ~/.claude/skills).

## Product
One GitHub repo, **`fable-god-mode`**, shipping two installable Claude Code skills plus a deterministic agent-driven installer. The Twitter post links here.

- **`god-mode`** (Claude subscription only): the 10-80-10 token discipline as an operating skill — Fable plans, cheap models (Opus/Haiku subagents) execute, Fable reviews — plus a stale-config audit (report-first) for pre-Fable skills/CLAUDE.md instructions that degrade Fable.
- **`super-god-mode`** (Claude Max + ChatGPT plan with Codex): everything in god-mode, plus GPT-5.5 wired in as Fable's deterministic specialist (backend implementation, plan critique, diff review, debugging second opinion) via a vendored cross-platform one-shot bridge. AgentBridge live pairs = documented external option only, never touched by the installer.

## Repo structure
```
fable-god-mode/
├── README.md                    # landing: 2 modes, 1-line agent install, honest Windows note, data-disclosure note
├── INSTALLER.md                 # THE SPEC: preflight → steps → verify → rollback (agent = executor, not interpreter)
├── .claude-plugin/marketplace.json   # secondary install path; MUST converge on identical installed state
├── skills/
│   ├── god-mode/
│   │   ├── SKILL.md             # tight description (loads into every session); 10-80-10 + effort calibration
│   │   └── references/
│   │       ├── routing.md       # Fable→plan, Opus/Haiku→execute (fan-out, write-to-disk, compact returns), Fable→review
│   │       └── audit.md         # stale-config audit rules: report-first, per-item consent, manifest, restore
│   └── super-god-mode/
│       ├── SKILL.md             # adds GPT-5.5 lane + union rule + gating; references god-mode (no duplication)
│       ├── scripts/ask-codex.mjs        # Node (cross-platform), NOT bash: stdin-from-file, tri-state verdict
│       └── references/
│           ├── setup-codex.md   # agent-steps vs USER-steps split for install/login (login is interactive)
│           ├── routing.md       # GPT-5.5 vs Opus vs Fable; NOT-for list (creative/frontend/prose)
│           └── verdict-schema.json
└── examples/                    # transcript snippets; feedback.jsonl format
```

## Installer contract (INSTALLER.md — the core deliverable)
**Transaction order: nothing is mutated until all checks pass and consents are collected.**

1. **Preflight (read-only):** OS/shell detect; `codex` on PATH; `codex` auth status probe; existing fable-god-mode managed blocks (version compare → offer update/repair/remove, never duplicate); Node available. Emit a preflight report.
2. **Mode selection (concrete questions, not plan self-report):** "Do you want Claude to send selected code snippets to OpenAI (via Codex) for review?" (DATA-DISCLOSURE GATE — explicit consent, documented in README) + "Can you complete a browser login to ChatGPT?" → verified afterward by CLI auth check, not user assertion.
3. **Scope:** all projects (~/.claude) vs this project (.claude/) — AskUserQuestion.
4. **Stale-config audit — REPORT-ONLY by default:** list findings with reasons; archive only on per-item confirmation → move to ~/.claude/skills-archive/<date>/ with a **manifest (paths + checksums) and a one-prompt restore path**. Never delete. CLAUDE.md edits shown as diff before applying.
5. **Codex setup (super-god only), agent-steps/user-steps split:** agent installs CLI + probes; USER completes `codex login` in browser when told; agent re-probes auth; **model probe** validates CODEX_MODEL (default gpt-5.5) and stores the working value in the managed config block with a repair flow.
6. **Managed writes:** CLAUDE.md discipline block bounded by sentinels `<!-- BEGIN fable-god-mode v<X> mode=<god|super> -->` … `<!-- END fable-god-mode -->`; re-runs parse and replace, never append twice. Backup written before any edit; setup manifest records every change for rollback.
7. **Smoke test = connectivity + schema validation** (executable found, auth OK, model responds, verdict envelope parses; failures explained plainly). The planted-bug demo is an optional "see it work" moment, not the pass criterion.
8. **Verification checklist** printed at the end; both install paths (agent-driven, marketplace) converge on one canonical installed state.

## Bridge design (ask-codex.mjs)
- Node for cross-platform (every Claude Code user has Node); no bash/WSL dependency. Windows: supported via Node; README states this plainly.
- **Tri-state verdict, not fail-open:** `approved` | `findings` | `codex_unavailable` (distinct exit code). Claude must surface `codex_unavailable` in its answer — an outage must never read as a clean review. (Improvement over the private script's approve-on-error.)
- Input = explicit file only; no environment dumps; docs state clearly that snippets leave the machine to OpenAI.
- Union rule in SKILL.md: Codex findings ADD to Claude's own; silence/approve never drops a Claude finding; adjudicate on merit; log to .orchestration/feedback.jsonl.

## Key decisions (with rationale)
1. **One repo, two skills** — skill descriptions load into every session; Claude-only users must not carry Codex dead weight. Tiers match the marketing story.
2. **Vendor the bridge (rewrite in Node), depend on nothing at runtime.** AgentBridge: external, pinned-version docs, separate consent, outside the installer entirely.
3. **Primary install = agent-driven against INSTALLER.md spec**; marketplace secondary; identical end state.

## Build milestones
- M1: god-mode skill + audit references.
- M2: ask-codex.mjs (tri-state) + verdict schema + super-god SKILL.md + setup-codex.md.
- M3: INSTALLER.md spec + README + marketplace.json + examples.
- M4: dogfood on a blank profile, both modes + a re-run (idempotency test) + a mid-setup abort (rollback test); fix friction; ship + post.
- Research input landed (god-mode-skill-plan/research-prereqs.md, all VERIFIED vs primary sources):
  - Codex CLI: `npm i -g @openai/codex` / brew / curl; login = "Sign in with ChatGPT"; **every ChatGPT plan includes Codex** (free = limited quota; phrase as "any paid plan, Plus and up"). Pass `-m gpt-5.5` explicitly (binary default lagged at 5.4).
  - Skill install: `~/.claude/skills/<name>/` (new top-level dir needs Claude Code restart — installer must say so) or plugin marketplace; **symlink from ~/.claude/skills to the cloned repo works** → cleanest "point Claude at our repo" path AND gives users updates via git pull. description+when_to_use ≤1,536 chars; SKILL.md body <500 lines.
  - **AgentBridge is public, MIT, active** (github.com/quilin-ai/agent-bridge, `npm i -g @raysonmeng/agentbridge`) → super-god-mode CAN document the live-bridge advanced path publicly, pinned version, still outside the installer.
  - Citable Anthropic guidance (code.claude.com/docs/en/costs): haiku-for-simple-subagents; delegate-verbose-work-to-subagents-return-summary; /effort levels (Fable always uses extended thinking — effort, not thinking toggles); "keep CLAUDE.md under 200 lines" (justifies the audit).
  - **Naming collision:** "god-mode" style names already exist in orchestration toolkits; no existing project packages Fable cost-routing + ChatGPT-sub Codex backend for non-technical users — that's the positioning wedge. Consider branding as "Fable God Mode" to stay distinctive.
  - Re-verify at build: gpt-5.5 `--output-schema` support (upstream issue #4181), July CLI default model, pricing numbers before quoting.

## Post integration (closer to append to the draft)
"I packaged this entire system into an open-source skill — God Mode (Claude-only) and Super God Mode (if you also have a ChatGPT plan: GPT-5.5 becomes Fable's backend specialist and reviewer). Point Claude Code at the repo and say 'set it up' — it interviews you, shows you exactly what it wants to change (nothing is touched without your OK), archives the stale skills that confuse Fable, and verifies the whole setup end-to-end. Repo: <link>"
