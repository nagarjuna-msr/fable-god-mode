# Test C — "New laptop / no local clone" install path (Fable God Mode INSTALLER.md v0.1.0)

Executed literally against sandbox: TESTHOME=.../testc-home (as ~), CWD=.../testc-cwd (not a clone, not a git repo).
Scripted answers: Q1.1 no→god, Q2 all projects (user scope), Q3 clone at default ~/fable-god-mode, Q4 audit no, Phase 3 approve; §10 rollback with clone removal.
Codex `login status` SIMULATED as not-logged-in (real `codex --version` = 0.141.0; real git 2.39.5, Node v20.19.5).

## Per-step verdicts

| Step | Verdict | Note |
| --- | --- | --- |
| Bootstrap (obtain spec) | **PASS w/ FRICTION** | Raw curl fetch of INSTALLER.md worked (HTTP 200, read-only, no clone). WebFetch tool FAILED to return verbatim text (its own 125-char quote guardrail blocks it) — see Finding 1. Chicken-and-egg not triggered because curl bypasses the clone, but the spec never SAYS which bootstrap is legitimate — see Finding 2. |
| P1–P11 preflight | **PASS** | Correct: OS=Darwin, Node v20 (no stop), git present, Codex present but auth-fail (sim). P6 correctly reported NO local clone. P7/P8/P9 all absent. P10 skills dir absent → restart note applies. No §9 routing. Read-only confirmed — nothing mutated. |
| Preflight report | **PASS** | Plain-language, no hard stop (Node ok for god mode anyway). |
| Q1 mode | **PASS** | Echoed the correct P4-installed/P5-not-logged-in finding ("Super would need a browser login"); scripted no → god. |
| Q2 scope | **PASS** | all projects → user scope vars set. CWD is not the clone, so the "installing into the clone" caveat correctly did not fire. |
| Q3 clone method (no clone) | **PASS w/ AMBIGUITY** | Spec branch "no local clone → ask where to clone (default ~/fable-god-mode)" followed. Wording concern for non-technical users — see Finding 3. Method defaulting after clone is under-specified — see Finding 4. |
| Q4 audit | **PASS** | no → declined, recorded for checklist. |
| Phase 3 URL resolution | **PASS w/ AMBIGUITY** | Order landed correctly: (1) `git remote get-url origin` = N/A (raw fetch, no checkout); (2) README Install section → `https://github.com/nagarjuna-msr/fable-god-mode` (real, HTTP 200). No guess. But the placeholder rule names `nagarjuna-msr` as the example of a NON-real URL, and here it's the real owner — see Finding 5. |
| Phase 3 plan + STOP | **PASS** | Full plan shown: clone action, symlink path+target, exact block diff (C4), manifest path + one-line rollback explainer. No C3 (god mode). Approve → proceed. |
| Phase 4 | **PASS (correctly skipped)** | God mode → skipped entirely. |
| Phase 5 seq1 clone | **PASS** | REAL `git clone` from public URL succeeded; verified INSTALLER.md + skills/*/SKILL.md present. planned→done manifest discipline honored. |
| Phase 5 seq2 mkdir | **PASS** | SKILLS_DIR created (created:true recorded). |
| Phase 5 seq3 skill_install | **PASS** | Symlink fable-god-mode → clone; god mode correctly installed ONLY the one skill (no super skill). Verified is-link AND target. |
| Phase 5 seq4 backup | **PASS** | CLAUDE.md absent → NO backup action AND no manifest entry AND no seq gap (Appendix A: skipped actions get no seq). Verified seq jumps 3→(block as seq4) with no gap. |
| Phase 5 block | **PASS** | Appendix B god-mode template: Codex line DROPPED, ≤10 lines, appears exactly once, created_file:true. |
| Phase 5 finalize | **PASS** | completed_at set, smoke="skipped" (god). |
| Phase 6 god smoke | **PASS** | SKILL.md read through installed symlink path; frontmatter (name/description) parses; references/ (audit.md, routing.md) reachable. |
| Phase 7 audit | **PASS (skipped, Q4=no)** | |
| Phase 8 checklist | **PASS** | All 7 lines reflect probes run this session; restart-needed=yes with the correct end note. |
| §10 rollback seq4 block | **PASS** | created_file:true AND file = only our block → FILE DELETED (per spec), reported installer created it. |
| §10 rollback seq3 symlink | **PASS** | is-link + target match → removed symlink only, target preserved. |
| §10 rollback seq2 mkdir | **PASS** | created:true AND empty → rmdir. |
| §10 rollback seq1 clone | **PASS** | Spec says ASK, default keep; scripted "remove" → clone deleted only on explicit consent. |
| §10 residue | **PASS** | Only ~/.claude/ parent + manifest survive (rollback record persists, per §10 note). CWD untouched. No debris. |

Overall: **PASS.** The no-local-clone path is executable end-to-end and the spec's transaction/consent/rollback discipline holds under literal execution.

## Findings (numbered, severity, fix)

**Finding 1 — MEDIUM — WebFetch cannot return the spec verbatim; agents relying on it get a paraphrase.**
The natural first instinct ("fetch the spec") via a summarizing web-fetch tool returned a *paraphrase* and refused verbatim reproduction (125-char quote cap). An installer whose Ground Rule 0 is "you are the EXECUTOR, not the interpreter; follow phases exactly" is UNSAFE to run from a paraphrase — e.g. the exact Appendix B block text, the verbatim Q1 questions, and sentinel strings must be byte-exact.
Fix: README's Install/onboarding should say explicitly: "To read the spec without cloning, fetch the RAW file (`curl https://raw.githubusercontent.com/.../main/INSTALLER.md`), not a summarizing fetcher — the block text and sentinels must be byte-exact." Add a one-line self-check in §0 ("if you only have a paraphrase of this spec, STOP and re-fetch the raw file").

**Finding 2 — MEDIUM — bootstrap chicken-and-egg is unaddressed by the spec (the headline item under test).**
Ground Rule 0 + §5 say NOTHING is created/cloned before Phase 5 approval, and the `clone` is a consented Phase-5 action. But to READ the spec on a fresh machine you must obtain it somehow, and the two obvious routes have opposite implications: (a) raw HTTPS fetch = read-only, no conflict; (b) `git clone` first (what README's own Install section literally tells the human to do) = a mutation that happens BEFORE any preflight/interview/approval, directly contradicting the Phase-5-clone-is-consented rule. The spec never states which bootstrap is sanctioned, so a literal executor can't tell whether an initial clone is a violation or the intended entry.
Fix: add a "§0.0 Bootstrap" clause: "Reading this spec is read-only: fetch the raw file over HTTPS, OR — if the user already cloned per the README — that pre-existing clone is the P6 clone and the user's install request is consent for its existence. A fresh clone performed solely to obtain the spec is permitted ONLY as the P6/Q3 clone action and must still surface in the Phase 3 plan before any OTHER mutation." This reconciles README (tells humans to clone) with §0 (nothing before approval).

**Finding 3 — LOW/MEDIUM — Q3 clone-location wording is opaque to a non-technical user.**
Q3's no-clone branch is "ask where to clone (default `~/fable-god-mode`)". A non-technical user on a new laptop does not know what "clone", "`~`", or "a git checkout" mean, nor the consequence of the location (it becomes the live source the symlink points at; `git pull` there updates the install; deleting it later breaks the install). The word "clone" also appears in Q3, Phase 3, Phase 5, and §10 with no plain-language gloss.
Fix: give Q3 a scripted plain-language form: "I'll download a copy of Fable God Mode to a folder on your Mac (default: your home folder, ~/fable-god-mode). The installed skill points at this folder, so keep it around; you can move or delete it later and I'll help undo. Use the default location? yes / pick another." Define "clone = downloaded copy" once at first use.

**Finding 4 — LOW — after a fresh clone, the install-method default is stated only for the "already cloned + keep" case.**
Q3 bullet 1 (symlink default) is gated on "the repo is cloned locally (P6) AND the user intends to keep it." Bullet 3 (no clone) ends "record that cloning is part of the plan, then default per the rules above" — but "the rules above" (bullet 1) is conditioned on P6, which is FALSE in the no-clone path until the clone happens. A literal executor can read this as "no applicable default." In practice the intent is clearly symlink (non-Windows) and the test proceeded that way, but it rests on inference the spec elsewhere forbids.
Fix: make bullet 3 explicit: "...record that cloning is part of the plan; the freshly cloned repo is then treated as a kept local clone, so default = symlink (non-Windows) / copy (Windows) per bullet 1/2."

**Finding 5 — LOW — the placeholder-detection rule uses the real owner name as its example of a fake.**
Phase 3: "a `nagarjuna-msr` placeholder is NOT a real URL". But `nagarjuna-msr` IS the real repo owner (the scenario URL and README both use it; raw fetch returns HTTP 200). If a future agent takes this literally it could REJECT the correct URL as a placeholder and STOP. The rule almost certainly meant a generic `<your-org>` / `youruser` style placeholder.
Fix: change the example to a clearly-generic token, e.g. "a `<your-org>`/`example`/`YOUR_USERNAME` style placeholder is NOT a real URL", and detect placeholders by angle-bracket/obvious-template shape, not by the literal string `nagarjuna-msr`.

**Finding 6 — LOW — §10 clone-undo default (keep) vs a clone created *only* to obtain the spec.**
§10 clone-undo: "ask the user — a clone may hold their unrelated changes; default is keep." That's right when the user cloned independently. But if the clone was created BY the installer purely as the Phase-5 action (this test's case, and Finding 2's fresh-clone bootstrap), it holds nothing of the user's — defaulting to keep leaves a repo the user never asked for as "residue." The scripted answer (remove) produced a clean tree, but the *default* would have left it.
Fix: tie the default to provenance recorded in the manifest — if the `clone` action created the repo during THIS install (no pre-existing checkout), default = remove-after-confirm; if the clone pre-existed / was user-supplied, default = keep. The manifest already records the clone action; add a `"created_by_installer": true/false` flag to drive the §10 default.

## Highlights of what worked well (adversarial credit)
- P6 correctly distinguished "no clone here" on a genuinely clone-free CWD.
- Skipped backup produced NO seq gap — the Appendix A monotonic-over-performed-actions rule held under real execution.
- God-mode block correctly dropped the Codex line and stayed ≤10 lines / exactly one block.
- Reverse-order rollback resolved the symlink→clone dependency correctly (symlink undone and target verified before the clone it points into was removed).
- created_file:true → file deletion on uninstall behaved exactly as §10 specifies; manifest retained as the record; .claude parent intentionally retained (not flagged as debris).
