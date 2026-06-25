# Changelog

All notable changes to this extension are documented here.

## [0.1.0] - 2026-06-25

Initial release.

### Added
- **Per-tab context gauge** — a status bar segment for each open Claude Code
  session tab, showing its real context usage `%` (count and order matched to
  your open tabs). Color escalates green → yellow → red as usage grows
  (default thresholds 30% / 60%, configurable).
- **Done notifications** — when a Claude Code turn finishes, fire a native OS
  notification (macOS / Windows / Linux), so it reaches you even when VS Code
  is in the background. Silent by default; optional sound.
- A soft version gate: if Claude Code updates past the version this extension
  was verified against, the gauge tooltip warns that `%` may be inaccurate
  (it still shows the number rather than hiding it).

### Notes
- Tested against Claude Code `2.1.191` on macOS. Windows/Linux notification
  paths are best-effort and not yet verified on those platforms.
