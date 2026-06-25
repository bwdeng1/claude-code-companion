import * as vscode from 'vscode';
import * as fs from 'fs';
import { spawn } from 'child_process';
import {
  loadVscodeSessionEntries,
  joinTabsToSessions,
  tailReadLines,
  lastTurnStatus,
} from '../shared/claudeData';

// 模块② ——会话跑完时弹通知。JSONL-watch 自检完成（不碰 settings.json、不装 Stop hook）。
// 多窗口去重：每个窗口只监听「自己 tab 里开着的会话」的 JSONL → 天然只有拥有窗口会弹。

const WATCH_INTERVAL_MS = 1000; // fs.watchFile 轮询间隔（不用 fs.watch：Windows 不可靠）
const SYNC_MS = 5000; // 多久重算一次「本窗口在看哪些会话」
const COOLDOWN_MS = 60_000; // 每会话两次通知最小间隔

function cfg() {
  const c = vscode.workspace.getConfiguration('ccCompanion');
  return {
    enabled: c.get<boolean>('notify.enabled', true),
    sound: c.get<boolean>('notify.sound', false),
    onlyWhenUnfocused: c.get<boolean>('notify.onlyWhenUnfocused', false),
    contextLimit: c.get<number>('contextLimit', 1_000_000),
  };
}

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

/** 弹 OS 原生横幅（各平台，可选声音）。全程吞错，绝不阻塞 / 不抛给宿主。 */
function osNotify(title: string, message: string, sound: boolean): void {
  try {
    if (process.platform === 'darwin') {
      const s = sound ? ' sound name "Glass"' : ''; // 无 sound name = 静音
      const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(
        title
      )}${s}`;
      spawn('osascript', ['-e', script], { stdio: 'ignore' }).on('error', () => {});
    } else if (process.platform === 'win32') {
      // best-effort：优先 BurntToast（若装了），否则消息框兜底。Win 上细化留后续。
      const ps =
        `try { New-BurntToastNotification -Text ${JSON.stringify(title)}, ${JSON.stringify(
          message
        )} } ` +
        `catch { Add-Type -AssemblyName PresentationFramework; ` +
        `[System.Windows.MessageBox]::Show(${JSON.stringify(message)}, ${JSON.stringify(title)}) }`;
      spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], {
        stdio: 'ignore',
      }).on('error', () => {});
    } else {
      spawn('notify-send', ['-a', 'Claude Code', title, message], { stdio: 'ignore' }).on(
        'error',
        () => {}
      );
      if (sound) {
        spawn('paplay', ['/usr/share/sounds/freedesktop/stereo/complete.oga'], {
          stdio: 'ignore',
        }).on('error', () => {});
      }
    }
  } catch {
    /* ignore */
  }
}

interface Watched {
  title: string;
  lastSig?: string; // 上次见到的完成签名（去重）
  cooldownUntil: number;
}

export function registerDoneNotifier(context: vscode.ExtensionContext): void {
  const watched = new Map<string, Watched>(); // jsonlPath → 状态

  function fire(title: string): void {
    const c = cfg();
    if (!c.enabled) return;
    // 一律走 OS 原生横幅（不在 app 内弹 showInformationMessage）——
    // 跑完都在「外面」提醒，切到别的 app 也够得到。声音由 notify.sound 开关控制（默认静音）。
    if (c.onlyWhenUnfocused && vscode.window.state.focused) return; // 选了「仅失焦才弹」且正盯着 VS Code → 不打扰
    osNotify('✅ Claude 跑完了', title, c.sound);
  }

  function onFileChange(jsonlPath: string): void {
    const w = watched.get(jsonlPath);
    if (!w) return;
    const status = lastTurnStatus(tailReadLines(jsonlPath));
    if (!status.complete || !status.signature) return;
    if (status.signature === w.lastSig) return; // 这个完成已宣告过
    w.lastSig = status.signature;
    const now = Date.now();
    if (now < w.cooldownUntil) return;
    w.cooldownUntil = now + COOLDOWN_MS;
    fire(w.title);
  }

  function syncWatches(): void {
    const c = cfg();
    const joins = joinTabsToSessions(listClaudeTabLabels(), loadVscodeSessionEntries(c.contextLimit));
    const want = new Map<string, string>(); // jsonlPath → 当前标题
    for (const j of joins) {
      if (j.status === 'matched' && j.jsonlPath) want.set(j.jsonlPath, j.label);
    }
    // 新增：开始监听
    for (const [p, title] of want) {
      const existing = watched.get(p);
      if (existing) {
        existing.title = title;
      } else {
        // 开始监听前，先把「监听前就已完成的回合」设为基线，避免补弹历史完成；
        // 若当前正在回合中（未完成）→ lastSig=undefined，那么接下来这次完成就会弹。
        const cur = lastTurnStatus(tailReadLines(p));
        watched.set(p, {
          title,
          cooldownUntil: 0,
          lastSig: cur.complete ? cur.signature : undefined,
        });
        fs.watchFile(p, { interval: WATCH_INTERVAL_MS }, () => onFileChange(p));
      }
    }
    // 移除：tab 关了就停监听
    for (const p of [...watched.keys()]) {
      if (!want.has(p)) {
        fs.unwatchFile(p);
        watched.delete(p);
      }
    }
  }

  syncWatches();
  const timer = setInterval(syncWatches, SYNC_MS);
  context.subscriptions.push(
    vscode.window.tabGroups.onDidChangeTabs(() => syncWatches()),
    {
      dispose: () => {
        clearInterval(timer);
        for (const p of watched.keys()) fs.unwatchFile(p);
        watched.clear();
      },
    }
  );
}
