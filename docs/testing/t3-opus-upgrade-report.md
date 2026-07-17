# T3 — fresh-Opus agent upgrade install (v0.1.0 → v0.2.0), 2026-07-17

**Authorship + honesty note.** The install was executed end-to-end by a FRESH Opus
agent following INSTALLER.md as written (pre-collected user answers: mode=super,
scope=user, C1-C4 consented, audit deferred). The agent completed and verified the
install, then was killed TWICE by infrastructure API errors ("Connection closed
mid-response") while writing this report. This report was therefore reconstructed
by the orchestrator FROM DISK EVIDENCE; the agent's narrative hiccup log died with
it and is reconstructed only where disk evidence or its last status messages
support it. The deaths were infrastructure failures, not installer defects — the
manifest trail shows every phase completed in order before the first death.

## Disk-verified outcome (all checks run by the orchestrator post-mortem)

| Check | Result |
| --- | --- |
| Manifest `installer_version` | `0.2.0` ✓ (chain: `.prev` preserved with v0.1.0/gpt-5.5) |
| Manifest model fields | `codex_model: gpt-5.6-sol` · `codex_model_probe: probe_ok` · `codex_reported_model: gpt-5.6-sol` · `codex_cli_version: codex-cli 0.144.1` ✓ (all four NEW v0.2.0 fields populated) |
| Smoke | `approved` ✓ (Phase-6 semantic smoke from the INSTALLED path) |
| Action trail | 5 actions, all `done`, in spec order (mkdir → 2× skill_install symlink → claude_md_backup → claude_md_block v0.2.0); `started_at` 10:46:03Z → `completed_at` 10:46:51Z (48 s) |
| Managed CLAUDE.md block | Exactly one block, sentinel `v0.2.0 mode=super`, model line `gpt-5.6-sol` validated 2026-07-17; REPLACED IN PLACE — no duplication; unrelated user content below the block untouched ✓ |
| Backups | `CLAUDE.md.bak-2026-07-17T10-46-03Z` + `fable-god-mode.manifest.json.prev` both present ✓ |
| Symlinks | Both skills re-linked 2026-07-17 16:16 local, resolving into the repo ✓ |
| Agent's last self-reports before death | "Install complete and verified. `.prev` confirmed intact (v0.1.0/gpt-5.5), new CLAUDE.md backup present, manifest valid, symlinks resolve." — CONSISTENT with every disk check above |

## Hiccup log (reconstructed; INCOMPLETE — see authorship note)

- **COSMETIC (pre-known deviation):** the release tag `v0.2.0` did not exist at
  test time; the agent was instructed to skip tag checkout and note it. The tag
  is cut before push, so real users never hit this state.
- **CLI version drift handled as designed:** the machine runs `codex-cli 0.144.1`
  vs the policy's tested `0.141.x`; probe + smoke both passed and the version was
  recorded in the manifest. The compatibility policy was widened to
  `0.141.x–0.144.x` on this evidence.
- **No BLOCKER evidenced:** the complete, ordered, 48-second manifest trail with
  correct new fields is strong evidence the v0.2.0 spec (probe-based Phase 4,
  §9 upgrade flow, new manifest fields) executes cleanly agent-driven. The lost
  narrative may have contained CONFUSING-grade findings that disk evidence cannot
  recover — this is a known gap of this report, stated rather than papered over.

## Residual risk + disposition

The lost hiccup narrative lowers confidence in "no confusing steps" (not in "no
blockers"). Disposition: the Sponsor's genuinely-fresh-laptop run (external
validation guidance, with a watch checklist) covers exactly this gap on a machine
with no prior install — treat it as the completing evidence for the
user-friendliness claim.
