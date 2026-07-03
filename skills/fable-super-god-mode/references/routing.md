# Three-Way Routing: When the Second Model Joins the Loop

This is the routing reference for **Fable Super God Mode**. It answers one question: *when does work go to the second-model reviewer (GPT-5.5 via Codex CLI, or Qwen Code's qwen3.7-plus — whichever your install picked) instead of — or in addition to — Fable or a Claude subagent, and how do you handle its verdicts?*

For Claude-internal routing — which Claude model does what, fan-out discipline, the delegation prompt contract — see **fable-god-mode's routing playbook** (`skills/fable-god-mode/references/routing.md`). Do NOT re-derive any of that here; this file only covers the third lane.

## 1. The three lanes

| Lane | Role | Best at |
| --- | --- | --- |
| **Fable 5** | Judgment | Planning, adjudication, integration, final quality. The orchestrator; owns every decision. |
| **Claude subagents** (Opus/Sonnet/Haiku) | Volume | Research fan-outs, first drafts, mechanical work. See fable-god-mode's routing playbook. |
| **Second-model reviewer** (GPT-5.5 via Codex CLI, or Qwen Code's qwen3.7-plus — one installed, chosen at install) | Independent correctness signal | A SECOND pair of eyes from a different model family. Strongest on logic that has a right answer. |

Why the third lane works: the reviewer comes from an independent training lineage (OpenAI or Alibaba, whichever you installed), so its errors are **uncorrelated** with Claude's. When it disagrees with you, that disagreement is signal — not noise you can wave away.

The bridge is a fixed, vendored one-shot contract — one of two scripts, whichever your install provisioned:

```
node "${CLAUDE_SKILL_DIR}/scripts/ask-codex.mjs" <prompt-file> [--model <id>] [--timeout <seconds>]   # Codex CLI provider
node "${CLAUDE_SKILL_DIR}/scripts/ask-qwen.mjs"  <prompt-file> [--model <id>] [--timeout <seconds>]   # Qwen Code CLI provider
```

The prompt file is a self-contained critique request. Output is a JSON envelope on stdout; `verdict` is one of `approved` | `findings` | `codex_unavailable`; exit codes are `0` / `10` / `20` (and `2` = usage error) — identical for both scripts. Codex runs read-only-sandboxed; Qwen Code runs with `--safe-mode`; both can read working-directory files the prompt points at. **Data leaves the machine** to whichever provider you installed — OpenAI (Codex) or Alibaba Cloud Model Studio (Qwen), never both — treat every invocation as a disclosure.

## 2. When the reviewer lane fires (gating)

Fire the lane only when the work matches one of these four cases:

| Lane | What qualifies |
| --- | --- |
| **a. Deterministic implementation critique** | Numeric / boundary / parsing / state-machine / concurrency / data-math logic, or API-contract correctness — run it AFTER Claude drafts, BEFORE Claude finalizes. |
| **b. Plan critique** | BEFORE executing a multi-step deterministic plan — catch design flaws while they're still cheap to fix. |
| **c. Diff review** | A substantial deterministic change, reviewed BEFORE commit / finalize. |
| **d. Debugging second opinion** | ONLY after one failed fix attempt — a fresh hypothesis from another lineage beats a third retry of the same one. |

**The gating rule (hard):** the lane is GATED. Do NOT run it on everything. Every invocation costs the user's quota (ChatGPT or Alibaba Cloud Model Studio) and sends data off-machine. When no lane above matches, do not invoke — proceed on Claude's own judgment.

## 3. NOT for this lane

Never route these to the second-model reviewer:

- **Creative work** — there is no right answer to check.
- **Frontend / visual / UX** — correctness is subjective; a text-only critique can't see the rendering.
- **Copy / prose / docs** — voice and taste are the point, not verifiable logic.
- **Conversational turns** — nothing to verify; just answer the user.
- **Trivial / one-step edits** — the review costs more than the change is worth.

Shared why: a second model on subjective work adds cost and noise **without decisive signal** — there is no "right answer" for it to check, so its "opinion" is just one more opinion you now have to adjudicate.

## 4. Writing the critique prompt

Neither reviewer has **conversation context** — each invocation is a fresh, one-shot process. The prompt file must stand entirely on its own. Include:

1. **What the artifact is supposed to do** — the spec, in one or two sentences.
2. **The material** — inline for short snippets; absolute paths for larger files (the reviewer reads them itself, sandboxed).
3. **The specific concerns to probe** — name them; don't ask "is this good?"
4. **A request for concrete findings**, not style opinions.

```text
Review this function for correctness. It is supposed to return true iff `date`
falls within [start, end] INCLUSIVE, treating all three as UTC calendar dates
(time-of-day ignored).

    export function inRange(date, start, end) {
      const d = Date.parse(date.slice(0, 10));
      return d > Date.parse(start) && d < Date.parse(end);
    }

Probe specifically:
- Are the boundary comparisons inclusive as specified?
- What happens when start === end, or when date equals a boundary?
- Any timezone / DST parsing hazard from Date.parse on bare date strings?
- Behavior on malformed or empty inputs.

Report concrete defects with the input that triggers each. Skip style.
```

## 5. Handling the three verdicts

- **`approved` (exit 0)** — proceed. But the **union rule** (below) still applies: approval never cancels a finding you already have open. The reviewer agreeing does not make your own concern disappear.
- **`findings` (exit 10)** — adjudicate each finding **on merit**. Accept real ones and fix them; reject false positives WITH a stated reason. Neither blanket-accept nor blanket-dismiss — do the work item by item.
- **`codex_unavailable` (exit 20)** — **NO review happened.** Say so plainly to the user: *"<Reviewer name> review did not run: `<error from envelope>`"*, then proceed on your own findings only. NEVER present unavailable as approved. NEVER silently skip past it. This tri-state design deliberately replaces fail-open bridges that print "approve" on error — an unavailable review is a known gap, not a green light. (The field/exit-code name `codex_unavailable` is shared verbatim by both bridge scripts for contract compatibility — it means "the installed reviewer is unavailable," whether that's Codex or Qwen.)

## 6. The union rule & the feedback log

**Union rule (exact):** the reviewer's findings ADD to Claude's own self-review. Its approval or silence NEVER drops a finding Claude already had. The merged set = **union** of both, each item adjudicated on merit.

After every critique — for all three verdicts — append ONE line to the project's `.orchestration/feedback.jsonl`:

```jsonl
{"ts": "2026-07-02T14:03:11Z", "artifact": "src/dates/inRange.ts", "reviewer": "gpt-5.5", "verdict": "findings", "findings": 3, "accepted": 2, "rejected": 1, "notes": "caught exclusive-boundary bug; DST claim was a false positive"}
{"ts": "2026-07-02T15:22:40Z", "artifact": "retry backoff plan", "reviewer": "gpt-5.5", "verdict": "codex_unavailable", "findings": 0, "accepted": 0, "rejected": 0, "notes": "codex CLI not authenticated; proceeded on own review"}
{"ts": "2026-07-03T09:12:05Z", "artifact": "src/clamp.ts", "reviewer": "qwen3.7-plus", "verdict": "findings", "findings": 2, "accepted": 2, "rejected": 0, "notes": "caught off-by-one and missing lower-bound check"}
```

Purpose: an audit trail of what the second model caught and what was rejected — evidence, over time, of whether this lane earns its cost.

## 7. One-shot vs live bridge (advanced)

The vendored one-shot bridge — `scripts/ask-codex.mjs` or `scripts/ask-qwen.mjs`, whichever is installed — is the **default** and the right tool for critiques: stateless, cheap, no setup beyond the reviewer's CLI.

**AgentBridge** ([github.com/quilin-ai/agent-bridge](https://github.com/quilin-ai/agent-bridge), MIT, `npm i -g @raysonmeng/agentbridge` — pin your version) runs persistent bidirectional Claude↔Codex pairs. Worth it ONLY for long implementation sprints where Codex needs durable context across many exchanges. It is **external**: not installed or configured by this skill, requires separate consent (same data-disclosure implications), and has its own docs. It is Codex-specific — Qwen has no live-bridge equivalent today.
