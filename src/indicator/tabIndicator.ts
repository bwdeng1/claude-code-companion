import * as vscode from 'vscode';
import {
  loadVscodeSessionEntries,
  joinTabsToSessions,
  untestedClaudeVersion,
  TESTED_THROUGH_CC_VERSION,
} from '../shared/claudeData';

// 模块① ——把当前窗口开着的每个 Claude 会话 tab，在状态栏排成一排 segment，各显真实上下文 %。
// 批次 2：枚举 + 状态栏。批次 3：% 逻辑。批次 4：双键 join（aiTitle / 首句兜底）→ 显 %/降级。

const BASE_PRIORITY = 1000; // 左对齐时 priority 越高越靠左
const REFRESH_MS = 5000; // 周期刷新，让 % 随对话增长更新（mtime 缓存，重读极少）

function shorten(label: string): string {
  return label.length > 12 ? label.slice(0, 11) + '…' : label;
}

function cfg() {
  const c = vscode.workspace.getConfiguration('ccCompanion');
  return {
    contextLimit: c.get<number>('contextLimit', 1_000_000),
    warn: c.get<number>('warnThreshold', 30),
    danger: c.get<number>('dangerThreshold', 60),
  };
}

/** 按 viewColumn 顺序、组内左右顺序，枚举当前窗口所有 Claude 会话 tab 的标题。 */
function listClaudeTabLabels(): string[] {
  const labels: string[] = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (
        tab.input instanceof vscode.TabInputWebview &&
        tab.input.viewType.includes('claudeVSCodePanel')
      ) {
        labels.push(tab.label);
      }
    }
  }
  return labels;
}

export function registerTabIndicator(context: vscode.ExtensionContext): void {
  let items: vscode.StatusBarItem[] = [];

  function clearItems(): void {
    for (const it of items) {
      it.dispose();
    }
    items = [];
  }

  function render(): void {
    clearItems();
    const labels = listClaudeTabLabels();
    if (labels.length === 0) {
      return; // 本窗口没开 Claude tab → 啥也不显示（不再误报 viewType 告警）
    }

    const { contextLimit, warn, danger } = cfg();
    const entries = loadVscodeSessionEntries(contextLimit);
    const joins = joinTabsToSessions(labels, entries);
    // version 闸门：Claude Code 升到未验证版本时，给已匹配 tab 的 tooltip 加一句软提示（仍照常显 %）
    const untested = untestedClaudeVersion();
    const versionNote = untested
      ? `\n⚠ Claude Code 已更新到 ${untested}（扩展验证到 ${TESTED_THROUGH_CC_VERSION}）——% 可能不准，留意更新扩展`
      : '';

    joins.forEach((j, i) => {
      const item = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        BASE_PRIORITY - i
      );
      const short = shorten(j.label);

      if (j.status === 'matched' && j.stats) {
        const pct = Math.round(j.stats.pct);
        item.text = `$(comment-discussion) ${short} ${pct}%`;
        if (pct >= danger) {
          item.color = new vscode.ThemeColor('charts.red');
        } else if (pct >= warn) {
          item.color = new vscode.ThemeColor('charts.yellow');
        } else {
          item.color = new vscode.ThemeColor('charts.green');
        }
        item.tooltip =
          `Claude 会话：${j.label}\n` +
          `${j.stats.residentTokens.toLocaleString()} / ${j.stats.limit.toLocaleString()} tok（${pct}%）\n` +
          `模型 ${j.stats.model ?? '?'}` +
          versionNote;
      } else if (j.status === 'ambiguous') {
        item.text = `$(comment-discussion) ${short} ?`;
        item.color = new vscode.ThemeColor('disabledForeground');
        item.tooltip = `Claude 会话：${j.label}\n有多个会话同名，无法确定 % 属于哪个`;
      } else {
        item.text = `$(comment-discussion) ${short} --`;
        item.color = new vscode.ThemeColor('disabledForeground');
        item.tooltip = `Claude 会话：${j.label}\n暂未匹配到会话（标题/首句还在变）`;
      }

      item.show();
      items.push(item);
    });
  }

  render();
  const timer = setInterval(render, REFRESH_MS);
  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs(() => render()),
    vscode.window.tabGroups.onDidChangeTabGroups(() => render()),
    {
      dispose: () => {
        clearInterval(timer);
        clearItems();
      },
    }
  );
}
