import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { lastTurnStatus } from '../src/shared/claudeData';

const lines = (n: string) =>
  fs
    .readFileSync(path.join(process.cwd(), 'test', 'fixtures', n), 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0);

describe('lastTurnStatus（完成检测）', () => {
  it('末条 assistant 是 end_turn → 完成，带签名', () => {
    const s = lastTurnStatus(lines('normal-session.jsonl'));
    expect(s.complete).toBe(true);
    expect(s.signature).toBe('u-normal-1');
  });

  it('末条 assistant 是 tool_use（等工具结果）→ 未完成', () => {
    const s = lastTurnStatus(lines('big-session.jsonl'));
    expect(s.complete).toBe(false);
  });

  it('末尾是 user 消息（用户已开新回合）→ 未完成', () => {
    const ls = [
      '{"type":"assistant","uuid":"a1","message":{"role":"assistant","stop_reason":"end_turn"}}',
      '{"type":"user","message":{"role":"user","content":"下一个问题"}}',
    ];
    expect(lastTurnStatus(ls).complete).toBe(false);
  });

  it('签名随新回合变化（用于去重）', () => {
    const t1 = lastTurnStatus([
      '{"type":"assistant","uuid":"turn-1","message":{"role":"assistant","stop_reason":"end_turn"}}',
    ]);
    const t2 = lastTurnStatus([
      '{"type":"assistant","uuid":"turn-2","message":{"role":"assistant","stop_reason":"end_turn"}}',
    ]);
    expect(t1.signature).not.toBe(t2.signature);
  });

  it('空 / 无 assistant → 未完成', () => {
    expect(lastTurnStatus([]).complete).toBe(false);
    expect(lastTurnStatus(['{"type":"queue-operation"}']).complete).toBe(false);
  });
});
