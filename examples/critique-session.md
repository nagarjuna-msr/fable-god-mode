# Critique session — the bridge reviewing itself

This is the actual critique history of `scripts/ask-codex.mjs` — the bridge you are using —
lightly compacted. Before shipping it, we ran the bridge's own critique loop on the bridge:
Claude wrote a self-contained prompt describing what the script must do, fed it to GPT-5.5, and
adjudicated the findings. It took two rounds. Round 1 came back with six findings; we accepted
five, rejected one with a reason, revised the script, and round 2 approved with zero findings.

## Round 1 — invocation

```
node "${CLAUDE_SKILL_DIR}/scripts/ask-codex.mjs" /tmp/critique-ask-codex.md
```

Exit code: `10` (findings). Envelope on stdout:

```json
{
  "verdict": "findings",
  "model": "gpt-5.5",
  "summary": "Six correctness/security issues. The cmd.exe fallback path is command-injection prone via the user-controlled --model value, and the output parser can emit a false approval on malformed model output.",
  "findings": [
    {
      "severity": "high",
      "category": "security",
      "where": "runCodex(), Windows cmd.exe fallback (shell command assembly)",
      "issue": "The --model value is interpolated into a cmd.exe command line inside double quotes. cmd.exe expands %VAR% inside double quotes and quoting cannot escape a literal %, so a --model value like %PATH% or %CD% reaches the shell. The value is user-controllable.",
      "suggestion": "Do not pass untrusted values through cmd.exe. Whitelist model ids against a known-good set (e.g. /^gpt-[0-9.]+(-[a-z]+)?$/) and fail closed on anything else before the fallback ever runs."
    },
    {
      "severity": "high",
      "category": "correctness",
      "where": "verdict shape validation after JSON extraction",
      "issue": "A response like {\"verdict\":\"approved\",\"findings\":\"not an array\",\"summary\":\"x\"} passes: the malformed findings field is coerced to [] and the approved verdict exits 0. A shape violation is reported to the caller as a clean approval — the worst possible failure direction for a critic.",
      "suggestion": "Validate strictly for BOTH verdicts: findings must be an array and summary a string, else map to codex_unavailable with error set, never approved."
    },
    {
      "severity": "medium",
      "category": "reliability",
      "where": "timeout handler in runCodex()",
      "issue": "On timeout the bridge sends SIGTERM and awaits child exit, but if the child ignores the signal there is no upper bound — the bridge can hang indefinitely, defeating the timeout it just enforced.",
      "suggestion": "After SIGTERM, arm a short give-up timer; on expiry send SIGKILL and resolve the promise regardless, so a failed kill can never hang the bridge."
    },
    {
      "severity": "medium",
      "category": "contract",
      "where": "verdict normalization",
      "issue": "A response with verdict 'findings' but an EMPTY findings array exits 10 with nothing to adjudicate. That preserves non-approval but violates what the findings verdict means — the output is incoherent per the schema's intent, and the caller is left with a review it cannot act on.",
      "suggestion": "Treat findings-verdict-with-empty-list as invalid output: map it to codex_unavailable so the caller re-runs, rather than shipping an empty exit-10."
    },
    {
      "severity": "low",
      "category": "input-validation",
      "where": "argv handling of the prompt-file argument",
      "issue": "Passing '-' as the prompt path is silently accepted and treated as a filename, producing a confusing ENOENT rather than a clear usage error. stdin-as-prompt is not a supported mode.",
      "suggestion": "Reject '-' explicitly with a usage error (exit 2). Only accept a real, readable file path."
    },
    {
      "severity": "low",
      "category": "resource",
      "where": "temp output dir handling",
      "issue": "Each run creates an ask-codex-* dir under the shared temp dir; on a schema-mismatch failure it is deliberately retained for debugging and never pruned, so repeated failures accumulate dirs across runs.",
      "suggestion": "Prune stale ask-codex-* dirs older than N hours at startup before creating the new one."
    }
  ],
  "error": null,
  "elapsed_ms": 18492
}
```

## Adjudication

Union rule: these findings are added to Claude's own self-review; none of Claude's existing
concerns were dropped. Each finding was judged on merit.

- **[high] cmd.exe %-injection** — Accepted. Added a model-id whitelist; the cmd.exe fallback
  now fails closed on any value that isn't on it.
- **[high] false-approve on malformed output** — Accepted. A non-valid envelope shape now maps
  to `codex_unavailable` with `error` set, never to `approved`.
- **[medium] timeout can hang** — Accepted. Added a give-up timer: SIGTERM, then SIGKILL and
  resolve on expiry (plus a process-tree kill on Windows), so a failed kill can't hang the bridge.
- **[medium] findings-verdict with empty list** — Accepted. Now maps to `codex_unavailable`
  instead of an empty exit-10 the caller can't act on.
- **[low] `-` prompt path** — Accepted. `-` is now rejected with a usage error (exit 2).
- **[low] temp-dir accumulation** — **Rejected, with reason:** startup pruning of a shared
  temp dir means one bridge process deleting files another user or process may still be
  writing — a cross-process race that is riskier than the slow accumulation it solves. We
  documented a retention note instead and left cleanup to the OS temp reaper.

Five accepted, one rejected. Revised the script and re-ran.

## Round 2 — invocation (revised script)

```
node "${CLAUDE_SKILL_DIR}/scripts/ask-codex.mjs" /tmp/critique-ask-codex-r2.md
```

Exit code: `0` (approved). Envelope on stdout:

```json
{
  "verdict": "approved",
  "model": "gpt-5.5",
  "summary": "Injection path closed via model-id whitelist with fail-closed fallback; malformed output no longer approves; timeout has a hard give-up kill; incoherent findings-verdicts map to codex_unavailable. No remaining correctness or security issues.",
  "findings": [],
  "error": null,
  "elapsed_ms": 15233
}
```

## Feedback log

The two rounds appended these lines to `.orchestration/feedback.jsonl`:

```jsonl
{"ts": "2026-07-02T09:14:22Z", "artifact": "scripts/ask-codex.mjs", "reviewer": "gpt-5.5", "verdict": "findings", "findings": 6, "accepted": 5, "rejected": 1, "notes": "high cmd.exe %-injection + false-approve-on-malformed accepted; temp-dir startup prune rejected (cross-process race > accumulation), documented retention instead"}
{"ts": "2026-07-02T09:41:07Z", "artifact": "scripts/ask-codex.mjs", "reviewer": "gpt-5.5", "verdict": "approved", "findings": 0, "accepted": 0, "rejected": 0, "notes": "revised script re-reviewed; whitelist + fail-closed fallback, hard kill timer, findings always array; clean"}
```

## Takeaways

- **Adjudicate on merit.** The critic is an input, not an authority — accept what's real,
  reject what isn't, and decide yourself.
- **Rejection requires a reason.** The rejected temp-dir finding is logged with why (a
  cross-process race worse than the problem it solves), not silently dropped.
- **An approval never cancels your own open findings.** Round 2's clean verdict clears the
  critic's list, not Claude's — the union rule holds in both directions.
