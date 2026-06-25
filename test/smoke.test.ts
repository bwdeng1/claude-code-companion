import { describe, it, expect } from 'vitest';
import { EXTENSION_ID, CLAUDE_TAB_VIEW_TYPE } from '../src/shared/meta';

// 批次 1 占位用例：证明 vitest + TS 导入链路通。
// 批次 3/4/5 会换成 claudeData / join / 完成检测 的真实断言。
describe('scaffold smoke', () => {
  it('TS 模块导入 + 测试链路工作', () => {
    expect(EXTENSION_ID).toBe('claude-code-companion');
  });

  it('记录住批次 0 实测的 Claude tab viewType', () => {
    expect(CLAUDE_TAB_VIEW_TYPE).toContain('claudeVSCodePanel');
  });
});
