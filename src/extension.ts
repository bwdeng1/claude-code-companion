import * as vscode from 'vscode';
import { registerTabIndicator } from './indicator/tabIndicator';
import { registerDoneNotifier } from './notify/doneNotifier';

// CC Companion — Claude Code 二合一扩展（Claude Code 专用）
//   模块① tab 上下文指示器  → registerTabIndicator
//   模块② 完成通知          → registerDoneNotifier（JSONL-watch，不碰 settings.json）

export function activate(context: vscode.ExtensionContext): void {
  registerTabIndicator(context);
  registerDoneNotifier(context);
}

export function deactivate(): void {
  // watcher / 定时器都注册进 context.subscriptions，由宿主自动 dispose
}
