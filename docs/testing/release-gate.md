# Release gate — run before EVERY tagged version

The bridge and its probe are automated checks; per the falsification law they are
untrusted until they FAIL known-bad and PASS known-good. No tag is pushed unless
all four legs below land their expected outcome IN THE SAME session, against the
release candidate's exact code. Fixtures are immutable specimens — never edit
them to make a leg pass; a failing leg blocks the release claim (it must never
be "fixed" by weakening the fixture or the check).

| Leg | Command | Required outcome |
| --- | --- | --- |
| 1. Probe, real model | `node scripts/ask-codex.mjs --probe` | `probe_ok`, exit 0 |
| 2. Probe, bogus model | `node scripts/ask-codex.mjs --probe --model gpt-nonexistent-xyz` | `model_rejected`, exit 30 |
| 3. Critique, known-bad | `node scripts/ask-codex.mjs docs/testing/fixtures/known-bad.md` | `findings`, exit 10, ≥1 finding naming the boundary bug |
| 4. Critique, known-good | `node scripts/ask-codex.mjs docs/testing/fixtures/known-good.md` | `approved`, exit 0 |

(Paths relative to `skills/fable-super-god-mode/`.) `codex_unavailable` on any
leg = the gate DID NOT RUN — fix the chain and re-run; never release on a
partial gate. LLM verdicts are probabilistic: one unexpected semantic result
(leg 3 or 4) may be re-run ONCE; two consecutive unexpected results = the gate
fails. Record every run's envelopes in `docs/testing/release-report-v<X>.md`
with `requested_model`, `reported_model`, exit codes, and dates.
