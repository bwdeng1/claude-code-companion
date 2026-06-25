# Unofficial Claude Code Companion（非官方）

[English](README.md) | **中文**

> ⚠️ **非官方社区扩展，与 Anthropic 无隶属、无背书关系。** 本扩展读取 Claude Code
> **未公开**的本地文件（`~/.claude/sessions/*.json`、`~/.claude/projects/*.jsonl`）。
> Claude Code 更新这些格式时，部分功能可能失效，直到本扩展跟进更新——留意新版本。

给在 **VS Code 里用 Claude Code** 的人的两个小功能：

1. **按 tab 显上下文 %** —— 状态栏给每个打开的 Claude Code 会话 tab 一个小段，显示该
   会话真实的上下文占用 `%`。数量和左右顺序跟你开的 tab 对齐，一眼看出哪个对话快满了。
   占用涨上去颜色 🟢 → 🟡 → 🔴 递进。
2. **完成通知** —— 一轮跑完，弹一条系统原生通知，你切到别的 app 也能知道 Claude 干完
   了。默认静音，声音是可选开关。

## 环境要求

- VS Code `1.88.0+`
- 官方 **Claude Code** VS Code 扩展，并在 VS Code 里使用（本扩展靠读它的本地会话数据
  + 识别它的对话 tab 工作）。
- 在 macOS 上针对 Claude Code `2.1.191` 验证过。

## 安装

**用 `.vsix`（当前）：**

```bash
code --install-extension claude-code-companion-0.1.0.vsix
```

或在 VS Code：扩展面板 → `…` 菜单 → *从 VSIX 安装…*

（市场上架计划在更多机器上 dogfood 之后进行。）

## 工作原理

对你的本地 Claude Code 数据**只读**：

- 用 VS Code `window.tabGroups` API 枚举打开的对话 tab。
- 每个 tab 按「会话的 AI 生成标题」join 到对应会话（全新、还没生成标题的会话退而用
  首条用户消息兜底）。
- 上下文 `%` 取会话 JSONL 里最后一条 assistant 消息的 `usage`
  （`input + cache_read + cache_creation` token）÷ 模型上下文上限。
- 完成检测靠监听会话 JSONL 出现「已结束的回合」（`stop_reason` 为 `end_turn` / `stop`），
  **不**往 Claude Code 设置里装 hook——不动你任何配置。
- 多个 VS Code 窗口时，每个窗口只监听自己有 tab 的会话，所以一轮跑完只通知一次。

## 配置

| 设置项 | 默认 | 作用 |
|---|---|---|
| `ccCompanion.contextLimit` | `1000000` | 推断不出模型上限时的兜底上下文上限（token）。 |
| `ccCompanion.warnThreshold` | `30` | 占用 `%` 到多少变黄。 |
| `ccCompanion.dangerThreshold` | `60` | 占用 `%` 到多少变红。 |
| `ccCompanion.notify.enabled` | `true` | 回合跑完弹通知。 |
| `ccCompanion.notify.sound` | `false` | 通知带声音。 |
| `ccCompanion.notify.onlyWhenUnfocused` | `false` | 仅当 VS Code 不在前台时才通知。 |

## 隐私

全程本地。只**读取** `~/.claude` 下的文件 + 弹系统原生通知。**不发任何网络请求**，
不把你的数据送到任何地方。

## 局限（实话实说）

- **只在 macOS 测过。** Windows（PowerShell/BurntToast）和 Linux（`notify-send`）的
  通知路径是 best-effort，那两个平台还没实测。
- 依赖 Claude Code **未公开**的本地格式——Claude Code 一更新就可能失效。检测到 Claude
  Code 版本比验证过的更新时，状态栏 tooltip 会提示 `%` 可能不准（仍照常显示数字，
  而不是把它藏起来）。
- Claude Code 的 100 万上下文 beta 不落盘，所以上限靠推断（驻留 token > 20 万 ⇒ 100
  万）；否则用配置的兜底值。

## 致谢

完成通知的做法是 clean-room 实现，灵感来自 Claude Code 通知相关的 MIT 许可社区作品。

## 许可

[MIT](LICENSE) © 2026 bwdeng1
