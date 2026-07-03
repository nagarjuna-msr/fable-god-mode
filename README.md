# Fable God Mode

Two installable Claude Code skills that spend your premium model where it earns its keep and push the verbose middle of every task onto cheaper models. God Mode runs on a Claude subscription alone. Super God Mode adds an independent, second-lineage reviewer — your choice at install of GPT-5.5 through a paid ChatGPT plan you may already have, or qwen3.7-plus through an Alibaba Cloud Model Studio account. Installation is agent-driven: you clone the repo and tell Claude to set it up, and nothing on your machine is touched without an explicit OK.

## Two modes

| | Fable God Mode | Fable Super God Mode |
|---|---|---|
| **Needs** | A Claude subscription | God Mode + **one of:** (a paid ChatGPT plan and Codex CLI) or (an Alibaba Cloud Model Studio account and Qwen Code CLI) — chosen at install |
| **Core idea** | The 10-80-10 loop: Fable 5 plans (10%) and reviews (10%); cheaper Claude subagents (Opus/Sonnet/Haiku) do the verbose middle 80% | Everything in God Mode, plus a second model as a deterministic specialist and independent reviewer |
| **Reviews** | Fable 5 reviews its own delegated work | Adds a second-model reviewer — GPT-5.5 via Codex CLI or qwen3.7-plus via Qwen Code CLI, whichever you choose at install: backend/algorithmic critique, plan critique, diff review, debugging second opinion |
| **Stale-config audit** | Yes — report-only by default, reversible archival | Same |
| **Sends code off your machine** | No | Only with explicit consent (see Data disclosure) |

Both modes converge on the same operating discipline; Super God Mode is a strict superset.

## Install

**One line, any machine.** Paste this into any Claude Code session — no clone, no setup:

> I want to install Fable God Mode from https://github.com/nagarjuna-msr/fable-god-mode. Set it up for me.

Claude fetches the installer spec, interviews you, and shows you every change before making it. Works the same in Opus sessions — the discipline is model-relative (see FAQ).

**Or clone first** and ask from inside the repo:

```bash
git clone https://github.com/nagarjuna-msr/fable-god-mode
cd fable-god-mode
```

Then in Claude Code, say:

> Set up Fable God Mode

(or "Set up Fable Super God Mode"). Claude reads `INSTALLER.md` and runs an interview: it shows you a preflight report first, asks for explicit consent before any change, shows diffs before editing `CLAUDE.md`, records every change in a manifest for rollback, and finishes with a verification checklist. Nothing is touched without your OK.

**Alternative: install as a Claude Code plugin.** Use this only if you already
manage plugins; the one-liner above is simpler and ends in the same place.

> Note: `/plugin` commands work in the **terminal** version of Claude Code
> (run `claude` in a terminal). The desktop app will say the command isn't
> recognized — that's expected, not a bug.

1. In a Claude Code terminal session, register the marketplace:
   `/plugin marketplace add nagarjuna-msr/fable-god-mode`
2. Install the skill you want (or both):
   `/plugin install fable-god-mode@fable-god-mode`
   `/plugin install fable-super-god-mode@fable-god-mode`
3. Activate without restarting: `/reload-plugins`
4. The plugin gives you the skills. To get the full setup (managed CLAUDE.md
   block, Codex wiring and smoke test, audit offer), say:
   **"Finish Fable God Mode setup"** — the installer detects the plugin install
   and completes the rest without duplicating anything.

Either path can be undone any time with: **"Undo the fable-god-mode install"**
(plugin copies are removed with `/plugin uninstall`).

## What the installer will and won't do

The installer works to a contract:

- **Report first.** A preflight report before anything runs — you see what it found and what it proposes.
- **Consent per change.** Every change is asked for individually; there is no bulk apply.
- **Diff before CLAUDE.md edits.** Any edit to your `CLAUDE.md` is shown as a diff before it is written.
- **Never deletes.** The stale-config audit is report-only by default. Archival is reversible, per-item, and consented — archived skills are restorable from a dated manifest.
- **Manifest + rollback.** Every change is recorded so the installer can undo its own work.
- **Verification checklist.** A final checklist confirms the install landed as described.

## Why this exists

Fable 5 is the premium tier, and premium time is wasted on verbose grunt work. Per [Anthropic's own cost guidance](https://code.claude.com/docs/en/costs), simple subagent tasks belong on cheaper models, and verbose work belongs in subagents that return summaries rather than filling your main context. God Mode makes that the default operating loop. Super God Mode adds a second-lineage reviewer whose errors are uncorrelated with Claude's — a genuinely independent check, covered by a ChatGPT or Alibaba Cloud Model Studio subscription you may already have.

## Data disclosure

Read this before enabling Super God Mode.

**Super God Mode sends code to exactly one third party — never both — depending on which reviewer you chose at install.** Specifically, it sends the contents of the critique prompt file and any files the reviewer CLI reads while working under it. The installer asks for this consent explicitly, for whichever provider you're enabling, before anything runs:

> Do you want Claude to send selected code snippets to OpenAI for review? *(Codex path)*

> Do you want Claude to send selected code snippets to Alibaba Cloud Model Studio for review? *(Qwen path)*

**God Mode alone sends nothing anywhere** beyond your normal Claude session. No third party, no OpenAI, no Alibaba Cloud Model Studio, nothing new leaves your machine.

## Requirements

| | Fable God Mode | Fable Super God Mode |
|---|---|---|
| Claude Code with Fable 5 access | Required | Required |
| Node ≥ 18 | Not needed | Required |
| OS | macOS / Linux / Windows | macOS / Linux / Windows |
| Reviewer CLI + account (choose **one**, not both) | — | **Codex path:** paid ChatGPT plan (Plus and up) + OpenAI Codex CLI, **or** **Qwen path:** Alibaba Cloud Model Studio account + Qwen Code CLI — installer sets up whichever you pick; login/API-key setup is a step only you can do |

## Windows

Windows is supported through Node: the bridge is a `.mjs` script — no WSL or bash required — and the npm-shim spawn path is handled (with a fail-closed guard on cmd.exe quoting). Symlink installs fall back to copies on Windows; the installed behavior is the same. Honest status: macOS/Linux are tested end-to-end; the Windows-specific code paths are implemented and independently reviewed but not yet exercised on a physical Windows machine — if you hit anything, please open an issue.

## Repo map

```
fable-god-mode/
├── README.md
├── INSTALLER.md
├── LICENSE
├── .claude-plugin/
│   └── marketplace.json
├── skills/
│   ├── fable-god-mode/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── routing.md
│   │       └── audit.md
│   └── fable-super-god-mode/
│       ├── SKILL.md
│       ├── scripts/
│       │   ├── ask-codex.mjs
│       │   └── ask-qwen.mjs
│       └── references/
│           ├── routing.md
│           ├── setup-codex.md
│           ├── setup-qwen.md
│           └── verdict-schema.json
├── examples/
└── docs/
    └── planning/
```

## FAQ

**Does God Mode work without a ChatGPT plan?**
Yes — that is the whole point of the two tiers. God Mode runs on a Claude subscription alone.

**Will the installer delete my old skills?**
Never. The audit is report-only by default. It archives with per-item consent, and everything is restorable from a dated manifest.

**Why Node and not bash?**
Cross-platform support, including Windows without WSL. The bridge is a single `.mjs` script.

**What happens if Codex is down or logged out?**
The bridge returns a tri-state verdict — `approved`, `findings`, or `codex_unavailable`. An outage surfaces as `codex_unavailable`; it can never masquerade as a clean review. (Qwen goes through the identical tri-state contract, so the same guarantee holds whichever bridge you installed.)

**Can I use my own model instead of gpt-5.5?**
Yes. Set `CODEX_MODEL` or pass `--model`; the choice is validated by a probe before use.

**Can I use Qwen instead of Codex?**
Yes — the installer's interview asks which reviewer provider you want (Codex/OpenAI or Qwen/Alibaba Cloud Model Studio) before enabling Super God Mode. Both go through the same tri-state bridge contract; only one is installed at a time.

**Is my code sent anywhere in God Mode?**
No. God Mode sends nothing beyond your normal Claude session. Only Super God Mode contacts a reviewer provider — OpenAI or Alibaba Cloud Model Studio, whichever you chose at install — and only with your explicit consent.

**Does it only work with Fable 5?**
The discipline is model-relative: plan and review at your session model's full power, delegate the verbose middle to cheaper models. It pays on any premium session model (Opus included); it pays most on Fable 5.

**Am I locked into the discipline once installed?**
No. It is a default, not a gate — say "skip god mode for this task" (or session) and Claude complies. Install project-only if you want it scoped, and uninstall is one prompt, fully reversible. The skill never blocks a response or forces a tool call — that would make it exactly the kind of config its own audit flags.

## Credits & license

- **[AgentBridge](https://github.com/quilin-ai/agent-bridge)** (MIT) — the inspiration and the advanced live-bridge path. It is a documented option here, never touched by the installer.
- **[Anthropic cost docs](https://code.claude.com/docs/en/costs)** — the cost thesis this project operationalizes.

Licensed under MIT. See [LICENSE](./LICENSE).
