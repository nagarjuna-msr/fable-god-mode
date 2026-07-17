> **v0.1.0-era research notes (2026-07-02). HISTORICAL — superseded by v0.2.0 (see CHANGELOG.md).**

# Research: prerequisites for god-mode / super-god-mode skills

Compiled 2026-07-02. VERIFIED = fetched primary source (or corroborated across 2+). UNVERIFIED = single secondary source / inferred.

---

## 1. OpenAI Codex CLI (July 2026)

### Install commands — VERIFIED (developers.openai.com/codex/cli, github.com/openai/codex)
- npm: `npm install -g @openai/codex` (requires Node.js 18+)
- Homebrew: `brew install --cask codex`
- macOS/Linux shell: `curl -fsSL https://chatgpt.com/codex/install.sh | sh`
  - Unattended: `curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_NON_INTERACTIVE=1 sh`
- Windows PowerShell: `powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"`
- npm package page: https://www.npmjs.com/package/@openai/codex

### Login flow — VERIFIED (quickstart + cli docs)
- First run: launch `codex`; you are prompted to sign in. Choose **"Sign in with ChatGPT"** to auth with your ChatGPT account, OR use an OpenAI API key.
- During a session, `/status` shows remaining plan limits. Usage dashboard shows current limits.
- Note: the login subcommand is `codex login` (interactive). Sign-in-with-ChatGPT article: https://help.openai.com/en/articles/11381614-codex-cli-and-sign-in-with-chatgpt

### Which ChatGPT plans include Codex CLI — VERIFIED (quickstart) + corroborated (help center)
- Quickstart states verbatim: **"Every ChatGPT plan includes Codex."**
- Help center + cli docs enumerate: **Free, Go, Plus, Pro, Business, Edu, Enterprise** (i.e. all plans, including free tier).
- CLI docs auth line names **Plus, Pro, Business, Edu, or Enterprise** for "Sign in with ChatGPT."
- Usage limits vary by plan; Codex usage counts toward your "agentic usage limit." Plus/Pro users hitting limits can buy additional credits without upgrading.
- CAVEAT: a known GitHub issue (#2330) showed some Pro accounts told to "upgrade to Plus" — edge-case auth bug, not a plan-eligibility rule. For the skill, safest phrasing: "any paid ChatGPT plan (Plus and up) includes Codex CLI; the free tier has limited quota." Source: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan (403 to WebFetch bot; content confirmed via two independent search snippets).

### Model IDs / GPT-5.5 — VERIFIED (developers.openai.com/codex/models)
Exact `-m` flag values:
- `gpt-5.5`  ← **recommended default for most tasks.** Docs: "For most tasks in Codex, start with `gpt-5.5`. It is strongest for complex coding, computer use, knowledge work, and research workflows."
- `gpt-5.4`
- `gpt-5.4-mini`  ← faster/cheaper, good for lighter tasks or subagents
- `gpt-5.3-codex-spark`
- Usage: `codex -m gpt-5.5 "..."` or `codex exec -m gpt-5.5 ...`
- NUANCE (UNVERIFIED, secondary): As of April 2026 the CLI *binary default* was still `gpt-5.4` even though `gpt-5.5` was the *recommended* model (releases Apr 23, 2026: 400K context in Codex / 1M in API, 82.7% Terminal-Bench 2.0). By July 2026 the default may have moved to 5.5 — always pass `-m gpt-5.5` explicitly in the skill to be safe. Sources: https://developers.openai.com/codex/changelog , https://www.developersdigest.tech/blog/codex-changelog-april-2026

### `codex exec` non-interactive flags — VERIFIED (config-advanced + cheat sheet)
`codex exec [FLAGS] "PROMPT"` runs headless (no TUI). Flags:
- `-m, --model <MODEL>` — model id (e.g. `gpt-5.5`)
- `-s, --sandbox <MODE>` — `read-only` | `workspace-write` | `danger-full-access`
- `-a, --ask-for-approval <MODE>` — `untrusted` | `on-request` | `never`
- `--output-schema <FILE>` — enforce a JSON Schema on the output (attached via OpenAI Responses `text.format`). NOTE bug #4181: schema guard historically narrow to gpt-5 family — verify it accepts gpt-5.5.
- `-o, --output-last-message <FILE>` — write only the final assistant message to a file (cheat sheet abbreviates as "save final response to file"). This is the key flag for the one-shot pattern.
- `--json` — stream/emit JSON events for scripting
- `--skip-git-repo-check` — bypass the git-repo requirement (referenced in docs; not on every cheat sheet)
- `-C, --cd <DIR>` — change working dir before running
- `--full-auto` — auto-approve within sandbox (= on-request + workspace-write)
- `--dangerously-bypass-approvals-and-sandbox` — disable all approvals + sandbox (avoid)
- Sandboxing is OS-native: Seatbelt (macOS), Bubblewrap (Linux), restricted tokens (Windows).
- Recommended safe one-shot for the skill: `codex exec -m gpt-5.5 --sandbox read-only -o /path/out.txt "$(cat prompt.txt)"` (matches user's existing ask-codex.sh pattern which feeds prompt via stdin).
Sources: https://developers.openai.com/codex/config-advanced , https://computingforgeeks.com/codex-cli-cheat-sheet/ , exec docs mirror https://docs.onlinetool.cc/codex/docs/exec.html

### Recent breaking / notable CLI changes — PARTIAL
- v0.142.0 (June 2026): remote executors now use authenticated E2E-encrypted Noise relay channels; better cross-platform working-dir/shell preservation. No CLI-flag breaking change documented in the visible June–July changelog.
- Open issues to watch: #4181 (--output-schema model guard), #19451 (`/clear` ignoring config.toml model, falling back to gpt-5.4).
- Source: https://developers.openai.com/codex/changelog

---

## 2. Claude Code skill installation (July 2026) — VERIFIED (code.claude.com/docs/en/skills)

### Where skills live (install locations)
| Location | Path | Applies to |
|---|---|---|
| Enterprise | managed settings | all org users |
| Personal | `~/.claude/skills/<name>/SKILL.md` | all your projects |
| Project | `.claude/skills/<name>/SKILL.md` | that project only |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | where plugin enabled |

- Precedence: enterprise > personal > project; any level overrides a bundled skill of same name. Plugin skills namespaced `plugin-name:skill-name`.
- **Simplest non-technical install**: unzip / copy the skill dir into `~/.claude/skills/<name>/` (personal). Live change detection picks it up mid-session for existing top-level dirs; **creating a brand-new top-level skills dir requires restarting Claude Code**.
- Each skill = a directory whose entrypoint is `SKILL.md` (required). Directory name becomes the `/command` name.
- A `<name>` entry can be a **symlink** to a dir elsewhere on disk — useful for pointing `~/.claude/skills/god-mode` at our cloned repo.
- Add `.claude-plugin/plugin.json` to a skill folder → it loads as a plugin `<name>@skills-dir` and can bundle agents/hooks/MCP.

### Plugin marketplace install (the other official path) — VERIFIED
- Register a marketplace: `/plugin marketplace add <owner>/<repo>` (or `/plugin marketplace update <name>` to refresh).
- Install a plugin: `/plugin install <plugin>@<marketplace>` (e.g. `/plugin install skill-creator@claude-plugins-official`).
- Then `/reload-plugins` to activate in-session.
- Official Anthropic marketplace: `anthropics/claude-plugins-official`. Public skills repo: https://github.com/anthropics/skills

### SKILL.md frontmatter — VERIFIED
YAML between `---` markers. **All fields optional; only `description` is recommended.**
- `name` — display name; defaults to directory name (does NOT change the `/command` except for a plugin-root SKILL.md).
- `description` — RECOMMENDED. What it does + when to use. Combined `description` + `when_to_use` is **truncated at 1,536 chars** in the skill listing (configurable via `skillListingMaxDescChars`). Put key use case first.
- `when_to_use` — extra trigger phrases; counts toward the 1,536-char cap.
- `disable-model-invocation: true` — only user can invoke (via `/name`); keeps it out of auto-context. Good for side-effecting commands.
- `user-invocable: false` — only Claude can invoke; hidden from `/` menu.
- `allowed-tools` — pre-approve tools (space/comma list or YAML list), e.g. `Bash(git add *) Bash(git commit *)`.
- `disallowed-tools`, `model`, `effort` (`low|medium|high|xhigh|max`), `context: fork`, `agent`, `hooks`, `paths`, `argument-hint`, `arguments`, `shell`.
- No hard char limit on `name` documented; the 1,536-char cap is on the listing text (desc+when_to_use).
- Tip: keep SKILL.md **under 500 lines**; move reference material to supporting files loaded on demand.
- Useful substitutions: `${CLAUDE_SKILL_DIR}` (dir containing SKILL.md — use for bundled scripts), `${CLAUDE_PROJECT_DIR}`, `$ARGUMENTS`, `${CLAUDE_EFFORT}`.

### Official best-practices docs — VERIFIED links
- Skills doc: https://code.claude.com/docs/en/skills
- Skill authoring best practices: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Agent Skills open standard: https://agentskills.io
- skill-creator (eval/benchmark tooling): https://github.com/anthropics/claude-plugins-official/tree/main/plugins/skill-creator

---

## 3. AgentBridge public status — VERIFIED (github.com/quilin-ai/agent-bridge)

**PUBLIC.** This is the same tool the user's global CLAUDE.md references (`abg`, per-directory pairs).
- Repo: https://github.com/quilin-ai/agent-bridge — "A local bridge for bidirectional collaboration between Claude Code and Codex."
- npm: `npm install -g @raysonmeng/agentbridge`
- CLI: `agentbridge` and alias `abg`.
- License: **MIT**.
- Per-directory pairs: **yes** — "one pair per project directory, ports allocated per pair in +10 strides from 4500"; `--pair <name>` targets a specific pair. Matches user's `abg --pair <name> claude` / `abg --pair <name> codex` workflow.
- Maintenance: active. Latest release v0.1.24 (2026-06-25), 24 releases, ~144 stars. Author: @raysonmeng.
- Usage: `abg init` (project config) → `abg claude` (starts Claude Code with bridge channel) + `abg codex` (starts Codex on the bridge).
- => super-god-mode CAN publicly offer the live-bridge path (MIT, npm-installable). Still recommend defaulting to the one-shot `codex exec` path for non-technical users and offering AgentBridge as the advanced option.

Other bridges found (prior art / alternatives, all public): abhishekgahlot2/codex-claude-bridge (real-time web UI), marko3190/ccbridge (npm `ccbridge-cli`), SeemSeam/claude_codex_bridge (multi-agent workspace), catatafishen/agentbridge (unrelated — JetBrains IDE plugin, name collision).

---

## 4. Anthropic official cost-guidance for Fable 5 — VERIFIED (code.claude.com/docs/en/costs)

Primary source: https://code.claude.com/docs/en/costs — "Manage costs effectively."

Best citable claims ("as Anthropic recommends"):
1. **Model routing / cheaper subagents.** Verbatim: "Sonnet handles most coding tasks well and costs less than Opus. Reserve Opus for complex architectural decisions or multi-step reasoning. Use `/model` to switch models mid-session... **For simple subagent tasks, specify `model: haiku` in your subagent configuration.**" (docs `/en/sub-agents#choose-a-model`)
2. **Delegate verbose ops to subagents to protect context.** Verbatim: "Delegate these to subagents so the verbose output stays in the subagent's context while only a summary returns to your main conversation." (Directly endorses the user's "write details to disk, return compact summaries" discipline.)
3. **Lower effort for simple tasks.** Verbatim: "For simpler tasks where deep reasoning isn't needed, you can reduce costs by lowering the effort level with `/effort` or in `/model`... lowering the budget with `MAX_THINKING_TOKENS=8000`." IMPORTANT CAVEAT: "**Disabling thinking is not available on Fable 5, which always uses extended thinking.**" and adaptive-reasoning models ignore nonzero token budgets — use *effort levels* on Fable 5, not MAX_THINKING_TOKENS.
4. (Bonus) **Move instructions out of CLAUDE.md into skills.** Verbatim: "Skills load on-demand only when invoked, so moving specialized instructions into skills keeps your base context smaller. **Aim to keep CLAUDE.md under 200 lines by including only essentials.**" — directly justifies god-mode's "cleanup of stale skills/CLAUDE.md."
5. (Bonus) **Track spend.** `/usage` shows plan-limit breakdown attributed to skills/subagents/plugins/MCP servers (press `d`/`w` for 24h/7d). `/cost` shows per-model cost + cache hit rates + rate-limit utilization (rebuilt in v2.1.92). Pro/Max: set monthly credit cap with `/usage-credits`. API workspace spend limits in Console.
- Other levers Anthropic lists: prompt caching (automatic), auto-compaction, `/clear` between tasks, prefer CLI tools over MCP servers, disable unused MCP servers, hooks that pre-filter output, write specific prompts, plan mode for complex tasks.
- Enterprise cost anchor (citable): "average cost is around $13 per developer per active day and $150-250 per developer per month."

Supporting/related official pages: pricing https://platform.claude.com/docs/en/about-claude/pricing ; model-config effort https://code.claude.com/docs/en/model-config ; sub-agents https://code.claude.com/docs/en/sub-agents .

Pay-per-token / model pricing (secondary, corroborated across several 2026 pricing trackers — UNVERIFIED against primary): Opus 4.8 ~$5 in / $25 out per MTok; Sonnet 4.6 ~$3 / $15; Haiku 4.5 ~$1 / $5 (Haiku ~15x cheaper than Opus). Confirm against platform.claude.com pricing before quoting exact numbers in the skill.

---

## 5. Prior art / competitors — MIXED

Claude+Codex collaboration (public, all GitHub):
- quilin-ai/agent-bridge (AgentBridge) — the one we build on; MIT.
- abhishekgahlot2/codex-claude-bridge — bidirectional bridge, real-time web UI, built on Claude Code Channels.
- marko3190/ccbridge — CLI orchestrator (`ccbridge-cli`) with planning/human-handoff/repair loops.
- SeemSeam/claude_codex_bridge — visible multi-agent CLI workspace (Codex, Claude, Gemini, Kimi, Qwen, etc.).
- OpenAI discussion #15374 / issue #15359 — "Claude Code Channels (MCP) talks bidirectionally to Codex App Server" (upstream provenance for bridges).

Skill marketplaces / Fable cost-optimization skills (public):
- anthropics/skills (official) and claude-plugins-official marketplace.
- jeremylongshore/claude-code-plugins-plus-skills — tonsofskills.com, `ccpi` package manager, large catalog (425 plugins / 2,810 skills claimed).
- Community routing writeups: "Claude Code Subagent Model Routing: Stop Paying for Opus on Haiku Work" (Medium, Jun 2026).
- Additional prior art (secondary, 2026): **Agent-Fusion** — multi-agent orchestration system routing across Claude Code, Codex CLI, Amazon Q, Gemini with consensus decisions; several **"god-mode"-style self-orchestrating** Claude Code toolkits already exist (e.g. rohitg00/awesome-claude-code-toolkit catalogs many; one "self-orchestrating v7.1" system with 15 agents + one-command installer). Curated lists: jqueryscript/awesome-claude-code, scriptbyai.com resource list.
- NOTE: no single well-known open-source skill found that packages BOTH "Fable cost-optimizing orchestration" AND "Codex-as-deterministic-backend via ChatGPT-sub Codex CLI" for NON-TECHNICAL users the way god-mode/super-god-mode intends — the name "god-mode" is already used by other orchestration toolkits, so differentiate on (a) non-technical one-command setup and (b) the Codex-CLI-as-backend angle. Credit AgentBridge (quilin-ai) explicitly and link Anthropic's cost docs.

### Fable 5 pricing / context (secondary — UNVERIFIED, confirm on platform.claude.com)
- Reported: Claude Fable 5 is a Mythos-class model priced ~**$10 in / $50 out per MTok**; began exiting flat/subscription plans around June 22, 2026 (pay-per-token era). SWE-bench Verified ~95.0% (vs GPT-5.5 ~88.7%). This matters for the skill's "use Fable economically" framing: Fable is the premium tier, so routing cheaper work to Haiku/Sonnet subagents and to Codex (covered by an existing ChatGPT sub, no extra token cost) is the core savings thesis. Source (secondary): https://www.developersdigest.tech/blog/codex-vs-claude-code-june-2026

---

## Open items to double-check before shipping the skill
- Confirm July-2026 Codex CLI *default* model (5.4 vs 5.5) — pass `-m gpt-5.5` explicitly regardless.
- Confirm `--output-schema` accepts gpt-5.5 (issue #4181).
- Confirm exact wording/limits in help.openai.com/11369540 (bot-blocked; verify in a browser) re: free-tier Codex quota.
- Verify current Opus/Sonnet/Haiku per-token pricing against platform.claude.com before citing numbers.
