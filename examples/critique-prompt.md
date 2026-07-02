<!--
critique-prompt.md — a model critique-request file that Claude writes to disk, then feeds to
scripts/ask-codex.mjs as the <prompt-file> argument. It MUST be fully self-contained: Codex
(GPT-5.5) runs as an independent critic with no access to this conversation, the repo, or prior
turns. Everything the reviewer needs — spec, code, and the questions — lives in this one file.
-->

Role: You are an independent correctness reviewer. You did not write this code and have no
context beyond what is in this file. Read the spec, read the function, and decide whether the
function meets the spec. Do not assume anything the file does not state.

## What the artifact must do (spec)

`buildPageRanges(totalItems, pageSize)` returns an array of `{ start, end }` ranges that
partition the half-open interval `[0, totalItems)` into consecutive pages of at most `pageSize`
items each. `start` is inclusive, `end` is exclusive. Requirements:

1. Every item index in `[0, totalItems)` appears in exactly one range.
2. The final page may be partial (fewer than `pageSize` items) when `totalItems` is not an
   exact multiple of `pageSize`.
3. `totalItems === 0` returns `[]`.
4. `pageSize` is a positive integer; callers guarantee this, no validation required.

## The material under review

```js
function buildPageRanges(totalItems, pageSize) {
  const ranges = [];
  const pageCount = Math.floor(totalItems / pageSize);
  for (let page = 0; page < pageCount; page++) {
    const start = page * pageSize;
    const end = start + pageSize;
    ranges.push({ start, end });
  }
  return ranges;
}
```

## Probe specifically

1. Given `totalItems = 25, pageSize = 10`, what does this return, and does every index in
   `[0, 25)` end up covered exactly once? Walk the actual loop.
2. Does the page-count derivation handle a non-multiple `totalItems` — i.e. is the final
   partial page emitted, per spec requirement 2? If not, which indices are dropped?
3. What is the correct expression for the number of pages here, and how does it differ from
   the one used?
4. Are the boundary cases correct: `totalItems === 0`, and `totalItems` an exact multiple of
   `pageSize` (e.g. `20, 10`)? Does either regress if the count expression is fixed?
5. Is `end` ever allowed to exceed `totalItems`, and does the spec's half-open contract
   require clamping the last range's `end`?

Report concrete correctness findings only — off-by-one, dropped indices, boundary breakage,
contract violations. Skip style, naming, and formatting. For each finding give the severity,
where, the issue, and a concrete suggestion.
