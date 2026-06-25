<div align="center">

# Unofficial Claude Code Companion

**Two quality-of-life features for Claude Code inside VS Code: a per-tab context % gauge ＋ done notifications**

[![Release](https://img.shields.io/github/v/release/bwdeng1/claude-code-companion?label=release&color=3fb950)](https://github.com/bwdeng1/claude-code-companion/releases)
[![CI](https://github.com/bwdeng1/claude-code-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/bwdeng1/claude-code-companion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/bwdeng1/claude-code-companion?color=blue)](LICENSE)

[中文](README.md) · English

</div>

![screenshot](https://raw.githubusercontent.com/bwdeng1/claude-code-companion/main/media/screenshot.png)

> ⚠️ **Unofficial, community-built.** Not affiliated with or endorsed by Anthropic. This extension reads Claude Code's **undocumented** local files (`~/.claude/sessions/*.json`, `~/.claude/projects/*.jsonl`); a Claude Code update may break it until this extension is updated.

---

## ✨ Features

- **Per-tab context gauge** — a status bar segment for *each* open Claude Code session tab, showing its real context usage `%`. Count and order match your tabs, so you can tell at a glance which conversation is filling up. Color escalates 🟢 → 🟡 → 🔴.
- **Done notifications** — a native OS notification when a turn finishes, so you know even when VS Code is in the background. Silent by default, optional sound.

## 📦 Install

**Option 1 · From Releases (recommended)**

Download the latest `.vsix` from [Releases](https://github.com/bwdeng1/claude-code-companion/releases), then in VS Code:
Extensions panel (`⇧⌘X` / `Ctrl+Shift+X`) → `⋯` menu → **Install from VSIX…** → pick the `.vsix`.

**Option 2 · CLI**

```bash
code --install-extension claude-code-companion-<version>.vsix
```

> A VS Code Marketplace listing is planned after more dogfooding.

## ⚙️ Requirements

- VS Code `1.88.0+`
- The official **Claude Code** extension, used from within VS Code
- Verified on macOS / Claude Code `2.1.191` (Windows & Linux notifications are best-effort, not yet verified)

## 🔧 Configuration

Search `Claude Code Companion` in VS Code settings:

| Setting | Default | What it does |
|---|---|---|
| `ccCompanion.contextLimit` | `1000000` | Fallback context limit (tokens) when the model's limit can't be inferred |
| `ccCompanion.warnThreshold` | `30` | Usage `%` at which the gauge turns yellow |
| `ccCompanion.dangerThreshold` | `60` | Usage `%` at which the gauge turns red |
| `ccCompanion.notify.enabled` | `true` | Notify when a turn finishes |
| `ccCompanion.notify.sound` | `false` | Play a sound with the notification |
| `ccCompanion.notify.onlyWhenUnfocused` | `false` | Only notify when VS Code is in the background |

## 🔍 How it works

Read-only against your local Claude Code data — no Claude Code hook, no changes to your settings:

- Enumerates open chat tabs via the VS Code `window.tabGroups` API;
- Joins each tab to its session by the session's AI-generated title (falling back to the first user message for brand-new sessions);
- Context `%` = the last assistant message's `usage` (`input + cache_read + cache_creation`) ÷ the model's context limit;
- Completion is detected by watching the session JSONL for a finished turn (`stop_reason` of `end_turn` / `stop`);
- With multiple windows open, each only watches its own sessions, so a finished turn notifies exactly once.

## 🔒 Privacy

Everything is local: it only **reads** files under `~/.claude` and shows native OS notifications. It makes **no network requests** and your data never leaves your machine.

## ⚠️ Limitations

- macOS is the tested platform; Windows / Linux notification paths are best-effort and not yet verified.
- It depends on Claude Code's undocumented on-disk format — a Claude Code update can break it; the tooltip warns when it detects a newer-than-tested version.
- The 1M-context beta isn't recorded on disk, so the limit is inferred (resident > 200k tokens ⇒ 1M); otherwise the configured fallback is used.

## 🤝 Contributing

Issues and PRs welcome. Local development:

```bash
npm install
npm test          # vitest, 28 cases
npm run compile   # esbuild → dist/
# open this folder in VS Code, press F5 to launch the Extension Development Host
```

## 🙏 Credits

The completion-notification approach was built clean-room, inspired by the pattern in the MIT-licensed community work around Claude Code notifications.

## 📄 License

[MIT](LICENSE) © 2026 bwdeng1
