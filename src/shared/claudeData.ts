import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// 共享层：读 ~/.claude 的会话数据。
// 批次 2 先放 sessions PID-map（供 viewType 兜底用）；
// 批次 3/4 会在此追加 tail 读 JSONL、usage 解析、per-session 模型→上限、aiTitle join。

export function claudeHome(): string {
  return path.join(os.homedir(), '.claude');
}

export interface VscodeSession {
  sessionId: string;
  cwd?: string;
  version?: string;
}

/**
 * 读 ~/.claude/sessions/*.json，挑 entrypoint==claude-vscode 的会话。
 * 这是确定性的 process→session 索引（批次 0 实测：本机会话全是该 entrypoint）。
 * 任何读/解析失败都吞掉返回已得部分——这是只读的旁路信号，绝不抛给 UI。
 */
export function listVscodeSessions(): VscodeSession[] {
  const dir = path.join(claudeHome(), 'sessions');
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const out: VscodeSession[] = [];
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as {
        entrypoint?: string;
        sessionId?: string;
        cwd?: string;
        version?: string;
      };
      if (d.entrypoint === 'claude-vscode' && d.sessionId) {
        out.push({ sessionId: d.sessionId, cwd: d.cwd, version: d.version });
      }
    } catch {
      // 跳过坏/半写文件
    }
  }
  return out;
}

// ── version 闸门（批次 6）：本扩展依赖 Claude Code 未公开的磁盘格式 ──
// （sessions/*.json + projects/*.jsonl）。这是「已验证到」的最高 Claude Code 版本。
// 检测到更高版本 → 给软提示（tooltip），但仍照常显示 %。
// 不做硬降级：硬降级会在每次 Claude Code 发版时误伤（格式没变也变 `--`），对公开用户体验差。
export const TESTED_THROUGH_CC_VERSION = '2.1.191';

/** 比较点分版本号（如 2.1.191）。a>b→1，a<b→-1，相等→0；非数字段按 0。 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

/** 任一 claude-vscode 会话的版本高于「已验证到」→ 返回最高的那个（用于软提示）；否则 undefined。 */
export function untestedClaudeVersion(): string | undefined {
  let beyond: string | undefined;
  for (const s of listVscodeSessions()) {
    if (s.version && compareVersions(s.version, TESTED_THROUGH_CC_VERSION) > 0) {
      if (!beyond || compareVersions(s.version, beyond) > 0) beyond = s.version;
    }
  }
  return beyond;
}

// ── 批次 3：tail 读 JSONL + 上下文 % ──────────────────────────────

export const LIMIT_200K = 200_000;
export const LIMIT_1M = 1_000_000;

/** 从文件尾倒读最多 maxBytes，返回完整 JSONL 行（丢弃头部可能被截断的半行）。 */
export function tailReadLines(filePath: string, maxBytes = 256 * 1024): string[] {
  let fd: number | undefined;
  try {
    fd = fs.openSync(filePath, 'r');
    const size = fs.fstatSync(fd).size;
    const readLen = Math.min(maxBytes, size);
    const buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, size - readLen);
    let text = buf.toString('utf8');
    if (size - readLen > 0) {
      // 没从文件头读起，丢掉第一行（可能是半行）
      const nl = text.indexOf('\n');
      text = nl >= 0 ? text.slice(nl + 1) : '';
    }
    return text.split('\n').filter((l) => l.trim().length > 0);
  } catch {
    return [];
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

interface Usage {
  tokens: number;
  model?: string;
}

/** 取最后一条 assistant 消息的 usage（驻留 = input + cache_read + cache_creation）。 */
function lastAssistantUsage(lines: string[]): Usage | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    let o: { type?: string; message?: { role?: string; model?: string; usage?: Record<string, number> } };
    try {
      o = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const msg = o.message;
    const u = msg?.usage;
    if (u && (o.type === 'assistant' || msg?.role === 'assistant')) {
      const tokens =
        (u.input_tokens || 0) +
        (u.cache_read_input_tokens || 0) +
        (u.cache_creation_input_tokens || 0);
      return { tokens, model: msg?.model };
    }
  }
  return undefined;
}

/**
 * 解析上下文上限。磁盘上没有可靠的「这条会话是 1M 还是 200k」信号——
 * 1M 是客户端 beta，JSONL 只记裸 model id（实测 = `claude-opus-4-8`，无 `[1m]`）。
 * 故采用务实三档：
 *  ① model 带 `[1m]` → 1M（少见但权威）
 *  ② 驻留 > 200k → 必是 1M（200k 窗口装不下 >200k，杜绝 ezoosk 式虚高）
 *  ③ 否则用配置默认（本用户默认 1M）
 */
export function resolveLimit(
  residentTokens: number,
  modelId: string | undefined,
  configDefault: number
): number {
  if (modelId && modelId.includes('[1m]')) return LIMIT_1M;
  if (residentTokens > LIMIT_200K) return LIMIT_1M;
  return configDefault;
}

export interface SessionStats {
  residentTokens: number;
  limit: number;
  pct: number;
  model?: string;
}

/** tail 读 JSONL → 末条 assistant usage → 上限 → %。无可用 usage 返回 undefined。 */
export function readSessionStats(jsonlPath: string, configDefault: number): SessionStats | undefined {
  const usage = lastAssistantUsage(tailReadLines(jsonlPath));
  if (!usage) return undefined;
  const limit = resolveLimit(usage.tokens, usage.model, configDefault);
  return {
    residentTokens: usage.tokens,
    limit,
    pct: (usage.tokens / limit) * 100,
    model: usage.model,
  };
}

// ── 批次 4：双键 join（tab 标题 → 会话）+ 状态 ─────────────────────

/** 取最后一条 ai-title 行的标题（标题可被重新生成，取最新那条）。 */
function lastAiTitle(lines: string[]): string | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    let o: { type?: string; aiTitle?: string };
    try {
      o = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (o.type === 'ai-title' && typeof o.aiTitle === 'string') return o.aiTitle;
  }
  return undefined;
}

/** 取首条用户消息文本——未命名会话的 tab 标题就是它，作 join 兜底键。 */
function firstUserText(lines: string[]): string | undefined {
  for (const ln of lines) {
    let o: { type?: string; message?: { role?: string; content?: unknown } };
    try {
      o = JSON.parse(ln);
    } catch {
      continue;
    }
    if (o.type === 'user' || o.message?.role === 'user') {
      const c = o.message?.content;
      if (typeof c === 'string') return c.trim() || undefined;
      if (Array.isArray(c)) {
        for (const p of c) {
          if (p && typeof p === 'object' && (p as { type?: string }).type === 'text') {
            const t = (((p as { text?: string }).text) || '').trim();
            if (t) return t;
          }
        }
      }
      return undefined;
    }
  }
  return undefined;
}

export interface SessionEntry {
  sessionId: string;
  jsonlPath: string;
  aiTitle?: string;
  firstUserMsg?: string;
  stats?: SessionStats;
}

// aiTitle 可能在文件很靠前处（早设、之后不变）→ 必须读整份才拿得到「最新标题」。
// 按 mtime 缓存：大文件只在新增消息时重读一次，避免每次刷新全读。
interface SessionMeta {
  aiTitle?: string;
  firstUserMsg?: string;
  stats?: SessionStats;
}

const metaCache = new Map<string, { mtimeMs: number } & SessionMeta>();

/** 读整份 JSONL（mtime 缓存），同时取 aiTitle + 首句 + stats。 */
export function readSessionMeta(jsonlPath: string, configDefault: number): SessionMeta {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(jsonlPath).mtimeMs;
  } catch {
    return {};
  }
  const cached = metaCache.get(jsonlPath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return { aiTitle: cached.aiTitle, firstUserMsg: cached.firstUserMsg, stats: cached.stats };
  }
  let lines: string[];
  try {
    lines = fs
      .readFileSync(jsonlPath, 'utf8')
      .split('\n')
      .filter((l) => l.trim().length > 0);
  } catch {
    return {};
  }
  const aiTitle = lastAiTitle(lines);
  const firstUserMsg = firstUserText(lines);
  const usage = lastAssistantUsage(lines);
  let stats: SessionStats | undefined;
  if (usage) {
    const limit = resolveLimit(usage.tokens, usage.model, configDefault);
    stats = {
      residentTokens: usage.tokens,
      limit,
      pct: (usage.tokens / limit) * 100,
      model: usage.model,
    };
  }
  metaCache.set(jsonlPath, { mtimeMs, aiTitle, firstUserMsg, stats });
  return { aiTitle, firstUserMsg, stats };
}

/** 列出所有 claude-vscode 会话，配齐 jsonlPath / aiTitle / stats（按 sessionId 在 projects 下定位 JSONL，免去 cwd 编码）。 */
export function loadVscodeSessionEntries(configDefault: number): SessionEntry[] {
  const sessions = listVscodeSessions();
  if (sessions.length === 0) return [];
  const wanted = new Set(sessions.map((s) => s.sessionId));
  const projRoot = path.join(claudeHome(), 'projects');
  let dirs: string[];
  try {
    dirs = fs.readdirSync(projRoot);
  } catch {
    return [];
  }
  const out: SessionEntry[] = [];
  for (const dir of dirs) {
    const full = path.join(projRoot, dir);
    let files: string[];
    try {
      files = fs.readdirSync(full);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const sid = f.slice(0, -'.jsonl'.length);
      if (!wanted.has(sid)) continue;
      const jsonlPath = path.join(full, f);
      const meta = readSessionMeta(jsonlPath, configDefault);
      out.push({
        sessionId: sid,
        jsonlPath,
        aiTitle: meta.aiTitle,
        firstUserMsg: meta.firstUserMsg,
        stats: meta.stats,
      });
    }
  }
  return out;
}

export type JoinStatus = 'matched' | 'ambiguous' | 'unmatched';
export interface TabJoin {
  label: string;
  status: JoinStatus;
  stats?: SessionStats;
  sessionId?: string; // matched 时带上，供②的通知监听用
  jsonlPath?: string;
}

/**
 * 纯函数：把 tab 标题 join 到会话。tab 标题 = AI 生成标题（有则用），否则 = 首句用户消息。
 * 故每个会话以「aiTitle 优先、否则 firstUserMsg」为键索引：
 *  - 唯一命中 → matched（带 stats）
 *  - 同键多会话（撞名，如多个 "hello" 新会话） → ambiguous
 *  - 无命中（首句被截断 / 还没首条消息） → unmatched
 */
export function joinTabsToSessions(tabLabels: string[], entries: SessionEntry[]): TabJoin[] {
  const byKey = new Map<string, SessionEntry[]>();
  for (const e of entries) {
    const key = e.aiTitle || e.firstUserMsg;
    if (!key) continue;
    const arr = byKey.get(key);
    if (arr) {
      arr.push(e);
    } else {
      byKey.set(key, [e]);
    }
  }
  return tabLabels.map((label) => {
    const m = byKey.get(label);
    if (m && m.length === 1) {
      return {
        label,
        status: 'matched' as const,
        stats: m[0].stats,
        sessionId: m[0].sessionId,
        jsonlPath: m[0].jsonlPath,
      };
    }
    if (m && m.length > 1) return { label, status: 'ambiguous' as const };
    return { label, status: 'unmatched' as const };
  });
}

// ── 批次 5：完成检测（给②的通知用） ─────────────────────────────

const TERMINAL_STOP = new Set(['end_turn', 'stop', 'stop_sequence']);

export interface TurnStatus {
  complete: boolean;
  signature?: string; // 标识「这一次完成」，用于去重（同一完成不重复弹）
}

/**
 * 判断会话最后一个回合是否「已完成、在等用户输入」。
 *  - 从末尾找第一条 assistant 消息：stop_reason ∈ {end_turn,stop} → 完成（不是 tool_use 那种等工具结果的）
 *  - 若末尾先遇到 user 消息（用户已开新回合）→ 未完成
 *  signature 取该 assistant 行的 uuid / requestId / timestamp，用于去重。
 */
export function lastTurnStatus(lines: string[]): TurnStatus {
  for (let i = lines.length - 1; i >= 0; i--) {
    let o: {
      type?: string;
      uuid?: string;
      requestId?: string;
      timestamp?: string;
      message?: { role?: string; stop_reason?: string };
    };
    try {
      o = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const msg = o.message;
    if (o.type === 'assistant' || msg?.role === 'assistant') {
      const complete = !!msg?.stop_reason && TERMINAL_STOP.has(msg.stop_reason);
      return { complete, signature: o.uuid || o.requestId || o.timestamp };
    }
    if (o.type === 'user' || msg?.role === 'user') {
      return { complete: false }; // 用户已开新回合，还没完成
    }
  }
  return { complete: false };
}
