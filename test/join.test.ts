import { describe, it, expect } from 'vitest';
import { joinTabsToSessions, type SessionEntry, type SessionStats } from '../src/shared/claudeData';

const stats = (pct: number): SessionStats => ({
  residentTokens: 1000,
  limit: 1_000_000,
  pct,
  model: 'claude-opus-4-8',
});

const entry = (sessionId: string, aiTitle: string | undefined, pct = 10): SessionEntry => ({
  sessionId,
  jsonlPath: `/fake/${sessionId}.jsonl`,
  aiTitle,
  stats: aiTitle ? stats(pct) : undefined,
});

describe('joinTabsToSessions（label===aiTitle 双键 join）', () => {
  it('唯一命中 → matched，带 stats', () => {
    const r = joinTabsToSessions(['今天天气怎么样？'], [entry('s1', '今天天气怎么样？', 15)]);
    expect(r[0].status).toBe('matched');
    expect(r[0].stats?.pct).toBe(15);
  });

  it('两个会话同 aiTitle（撞名）→ ambiguous', () => {
    const r = joinTabsToSessions(
      ['Claude Code'],
      [entry('s1', 'Claude Code'), entry('s2', 'Claude Code')]
    );
    expect(r[0].status).toBe('ambiguous');
    expect(r[0].stats).toBeUndefined();
  });

  it('通用 "Claude Code" tab、但没有会话叫这个 → unmatched', () => {
    const r = joinTabsToSessions(['Claude Code'], [entry('s1', '别的标题')]);
    expect(r[0].status).toBe('unmatched');
  });

  it('会话还没 aiTitle（新会话）→ 不参与 join → 对应 tab unmatched', () => {
    const r = joinTabsToSessions(['Claude Code'], [entry('s1', undefined)]);
    expect(r[0].status).toBe('unmatched');
  });

  it('多 tab 混合：命中 / 撞名 / 未命中 各自归位、顺序保持', () => {
    const entries = [
      entry('s1', 'A', 20),
      entry('s2', 'B', 88),
      entry('s3', 'dup'),
      entry('s4', 'dup'),
    ];
    const r = joinTabsToSessions(['A', 'dup', 'C', 'B'], entries);
    expect(r.map((x) => x.status)).toEqual(['matched', 'ambiguous', 'unmatched', 'matched']);
    expect(r[0].stats?.pct).toBe(20);
    expect(r[3].stats?.pct).toBe(88);
  });

  it('未命名会话用首句兜底匹配（aiTitle 还没生成）', () => {
    const e: SessionEntry = {
      sessionId: 's1',
      jsonlPath: '/f',
      aiTitle: undefined,
      firstUserMsg: '你好呢',
      stats: stats(5),
    };
    const r = joinTabsToSessions(['你好呢'], [e]);
    expect(r[0].status).toBe('matched');
    expect(r[0].stats?.pct).toBe(5);
  });

  it('aiTitle 优先于首句：有 aiTitle 时首句键不生效', () => {
    const e: SessionEntry = {
      sessionId: 's1',
      jsonlPath: '/f',
      aiTitle: '正式标题',
      firstUserMsg: '原始首句',
      stats: stats(7),
    };
    expect(joinTabsToSessions(['原始首句'], [e])[0].status).toBe('unmatched');
    expect(joinTabsToSessions(['正式标题'], [e])[0].status).toBe('matched');
  });
});
