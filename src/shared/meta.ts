// 共享层占位 —— 批次 3/4 会在 shared/ 放：
//   claudeData.ts  : tail 读 JSONL、解析 usage、per-session 模型→上限、sessions PID-map
// 现在只放一个常量给脚手架冒烟测试用，证明 TS 模块解析 + 测试链路通。

export const EXTENSION_ID = 'claude-code-companion';

/** Claude Code 会话 webview 的 viewType（批次 0 spike 2026-06-25 实测确认）。 */
export const CLAUDE_TAB_VIEW_TYPE = 'mainThreadWebview-claudeVSCodePanel';
