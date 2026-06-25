# Unofficial Claude Code Companion

> ⚠️ **Unofficial, community-built.** Not affiliated with or endorsed by Anthropic.
> This extension reads Claude Code's **undocumented** local files
> (`~/.claude/sessions/*.json`, `~/.claude/projects/*.jsonl`). If Claude Code
> changes those formats in an update, parts of this extension may stop working
> until it is updated — watch for new releases.

Two small quality-of-life features for people who run **Claude Code inside VS Code**:

1. **Per-tab context gauge** — a status bar segment for *each* open Claude Code
   session tab, showing that session's real context usage `%`. The count and
   left-to-right order match your open tabs, so you can tell at a glance which
   conversation is getting full. Color escalates 🟢 → 🟡 → 🔴 as usage grows.
2. **Done notifications** — when a turn finishes, you get a native OS
   notification, so you know Claude is done even when you've switched to another
   app. Silent by default; sound is an optional toggle.

## Requirements

- VS Code `1.88.0+`
- The official **Claude Code** VS Code extension, used from within VS Code
  (this extension reads its on-disk session data and detects its chat tabs).
- Verified against Claude Code `2.1.191` on macOS.

## Install

**From a `.vsix` (current):**

```bash
code --install-extension claude-code-companion-0.1.0.vsix
```

…or in VS Code: Extensions panel → `…` menu → *Install from VSIX…*

(Marketplace listing planned once it has been dogfooded on more setups.)

## How it works

The extension is read-only against your local Claude Code data:

- It enumerates open chat tabs via the VS Code `window.tabGroups` API.
- For each tab it finds the matching session by joining the tab title to the
  session's AI-generated title (falling back to the first user message for
  brand-new, not-yet-titled sessions).
- Context `%` comes from the last assistant message's `usage` in the session
  JSONL (`input + cache_read + cache_creation` tokens) divided by the model's
  context limit.
- Completion is detected by watching the session JSONL for a finished turn
  (`stop_reason` of `end_turn` / `stop`), **not** by installing a Claude Code
  hook — nothing is written to your Claude Code settings.
- With multiple VS Code windows open, each window only watches the sessions it
  actually has tabs for, so a finished turn notifies exactly once.

## Configuration

| Setting | Default | What it does |
|---|---|---|
| `ccCompanion.contextLimit` | `1000000` | Fallback context limit (tokens) when the model's limit can't be inferred. |
| `ccCompanion.warnThreshold` | `30` | Usage `%` at which the gauge turns yellow. |
| `ccCompanion.dangerThreshold` | `60` | Usage `%` at which the gauge turns red. |
| `ccCompanion.notify.enabled` | `true` | Show a notification when a turn finishes. |
| `ccCompanion.notify.sound` | `false` | Play a sound with the notification. |
| `ccCompanion.notify.onlyWhenUnfocused` | `false` | Only notify when VS Code is in the background. |

## Privacy

Everything is local. The extension only **reads** files under `~/.claude` and
shows native OS notifications. It makes **no network requests** and sends your
data nowhere.

## Limitations (honest)

- **macOS is the tested platform.** Windows (PowerShell/BurntToast) and Linux
  (`notify-send`) notification paths are best-effort and not yet verified.
- It depends on Claude Code's **undocumented** on-disk format — a Claude Code
  update can break it. The gauge tooltip warns when it detects a Claude Code
  version newer than the one this build was verified against.
- Claude Code's 1M-context beta isn't recorded on disk, so the context limit is
  inferred (resident tokens > 200k ⇒ 1M); otherwise the configured fallback is
  used.

## Credits

The completion-notification approach was built clean-room, inspired by the
pattern in the MIT-licensed community work around Claude Code notifications.

## License

[MIT](LICENSE) © 2026 bwdeng1
