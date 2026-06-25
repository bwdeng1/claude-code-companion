<div align="center">

# Unofficial Claude Code Companion

**为 VS Code 里的 Claude Code 加两个顺手的小功能：按 tab 显上下文 % ＋ 跑完弹通知**

[![Release](https://img.shields.io/github/v/release/bwdeng1/claude-code-companion?label=release&color=3fb950)](https://github.com/bwdeng1/claude-code-companion/releases)
[![CI](https://github.com/bwdeng1/claude-code-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/bwdeng1/claude-code-companion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/bwdeng1/claude-code-companion?color=blue)](LICENSE)

中文 · [English](README.en.md)

</div>

![预览](https://raw.githubusercontent.com/bwdeng1/claude-code-companion/main/media/screenshot.png)

> ⚠️ **非官方社区扩展，与 Anthropic 无隶属、无背书关系。** 本扩展读取 Claude Code 未公开的本地文件（`~/.claude/sessions/*.json`、`~/.claude/projects/*.jsonl`），Claude Code 更新这些格式时可能失效——留意更新本扩展。

---

## ✨ 功能

- **按 tab 显上下文 %** — 状态栏给每个打开的 Claude Code 会话 tab 一个小段，显示该会话真实的上下文占用 `%`，数量和左右顺序跟你的 tab 对齐。一眼看出哪个对话快满了，颜色随占用 🟢 → 🟡 → 🔴 升级。
- **完成通知** — 一轮跑完弹一条系统原生通知，切到别的 app 也收得到。默认静音，声音可选。

## 📦 安装

**方式一 · 从 Release 下载（推荐）**

去 [Releases](https://github.com/bwdeng1/claude-code-companion/releases) 下载最新的 `.vsix`，然后在 VS Code 里：
扩展面板（`⇧⌘X` / `Ctrl+Shift+X`）→ 右上角 `⋯` → **从 VSIX 安装…** → 选中下载的 `.vsix`。

**方式二 · 命令行**

```bash
code --install-extension claude-code-companion-<版本>.vsix
```

> VS Code 官方市场上架计划在更多机器实测后进行。

## ⚙️ 要求

- VS Code `1.88.0+`
- 官方 **Claude Code** 扩展，并在 VS Code 里使用（本扩展靠读它的本地会话数据 + 识别它的对话 tab 工作）
- 在 macOS / Claude Code `2.1.191` 上验证过（Windows、Linux 的通知为 best-effort，尚未实测）

## 🔧 配置

VS Code 设置里搜 `Claude Code Companion`：

| 设置项 | 默认 | 作用 |
|---|---|---|
| `ccCompanion.contextLimit` | `1000000` | 推断不出模型上限时的兜底上下文上限（token） |
| `ccCompanion.warnThreshold` | `30` | 占用 `%` 到多少变黄 |
| `ccCompanion.dangerThreshold` | `60` | 占用 `%` 到多少变红 |
| `ccCompanion.notify.enabled` | `true` | 回合跑完弹通知 |
| `ccCompanion.notify.sound` | `false` | 通知带声音 |
| `ccCompanion.notify.onlyWhenUnfocused` | `false` | 仅当 VS Code 不在前台时才通知 |

## 🔍 工作原理

对本地 Claude Code 数据**只读**，不装任何 Claude Code hook、不改你的配置：

- 用 VS Code `window.tabGroups` API 枚举打开的对话 tab；
- 每个 tab 按「会话的 AI 生成标题」join 到对应会话（新会话还没标题就用首句用户消息兜底）；
- 上下文 `%` = 会话 JSONL 末条 assistant 的 `usage`（`input + cache_read + cache_creation` token）÷ 模型上下文上限；
- 完成检测靠监听会话 JSONL 出现已结束的回合（`stop_reason` 为 `end_turn` / `stop`）；
- 多窗口时每个窗口只监听自己有 tab 的会话，一轮跑完只通知一次。

## 🔒 隐私

全程本地：只**读取** `~/.claude` 下的文件 + 弹系统原生通知，**不发任何网络请求**，数据不出本机。

## ⚠️ 局限

- macOS 是测试平台；Windows / Linux 的通知路径为 best-effort，尚未在对应平台验证。
- 依赖 Claude Code 未公开的本地格式，Claude Code 一更新就可能失效；检测到更新版本时状态栏 tooltip 会提示 `%` 可能不准（仍照常显数字，不藏）。
- 1M 上下文 beta 不落盘，上限靠推断（驻留 > 20 万 token ⇒ 1M），否则用配置的兜底值。

## 🤝 贡献

欢迎 issue / PR。本地开发：

```bash
npm install
npm test          # vitest，28 个用例
npm run compile   # esbuild → dist/
# VS Code 打开本目录，按 F5 启动扩展开发宿主调试
```

## 🙏 致谢

完成通知的做法为 clean-room 实现，灵感来自 Claude Code 通知相关的 MIT 许可社区作品。

## 📄 许可

[MIT](LICENSE) © 2026 bwdeng1
