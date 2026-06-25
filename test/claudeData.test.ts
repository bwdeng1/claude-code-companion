import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { readSessionStats, resolveLimit, LIMIT_1M, LIMIT_200K } from '../src/shared/claudeData';

// vitest 的 cwd = 项目根，fixture 在 test/fixtures/（不用 import.meta，避免 CJS 类型检查报错）
const fx = (n: string) => path.join(process.cwd(), 'test', 'fixtures', n);

describe('resolveLimit（磁盘无 1M 信号下的务实推断）', () => {
  it('model 带 [1m] → 1M', () => {
    expect(resolveLimit(5000, 'claude-opus-4-8[1m]', LIMIT_200K)).toBe(LIMIT_1M);
  });
  it('驻留 > 200k → 必判 1M（即使配置默认是 200k，杜绝虚高）', () => {
    expect(resolveLimit(284071, 'claude-opus-4-8', LIMIT_200K)).toBe(LIMIT_1M);
  });
  it('驻留 ≤ 200k 且无 [1m] → 用配置默认', () => {
    expect(resolveLimit(154200, 'claude-opus-4-8', LIMIT_1M)).toBe(LIMIT_1M);
    expect(resolveLimit(50000, 'claude-sonnet-4-6', LIMIT_200K)).toBe(LIMIT_200K);
  });
});

describe('readSessionStats（tail 读真实格式 fixture）', () => {
  it('普通会话：驻留 = input+cache_read+cache_creation；默认 1M → ≈15.42%', () => {
    const s = readSessionStats(fx('normal-session.jsonl'), LIMIT_1M)!;
    expect(s.residentTokens).toBe(1200 + 150000 + 3000);
    expect(s.limit).toBe(LIMIT_1M);
    expect(s.pct).toBeCloseTo(15.42, 2);
    expect(s.model).toBe('claude-opus-4-8');
  });

  it('大会话(>200k)：即使默认给 200k 也判 1M、% < 100（不虚高）', () => {
    const s = readSessionStats(fx('big-session.jsonl'), LIMIT_200K)!;
    expect(s.residentTokens).toBe(2 + 282977 + 1092);
    expect(s.limit).toBe(LIMIT_1M);
    expect(s.pct).toBeLessThan(100);
    expect(s.pct).toBeCloseTo(28.41, 1);
  });

  it('新会话(无标题)也能算 %', () => {
    const s = readSessionStats(fx('fresh-no-title.jsonl'), LIMIT_1M)!;
    expect(s.residentTokens).toBe(900 + 12000 + 500);
    expect(s.pct).toBeCloseTo(1.34, 2);
  });

  it('不存在/空文件 → undefined（不抛错）', () => {
    expect(readSessionStats(fx('does-not-exist.jsonl'), LIMIT_1M)).toBeUndefined();
  });
});
