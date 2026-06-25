import { describe, it, expect } from 'vitest';
import { compareVersions, TESTED_THROUGH_CC_VERSION } from '../src/shared/claudeData';

describe('compareVersions（version 闸门）', () => {
  it('相等 → 0', () => {
    expect(compareVersions('2.1.191', '2.1.191')).toBe(0);
  });

  it('补丁号更高 → 1', () => {
    expect(compareVersions('2.1.192', '2.1.191')).toBe(1);
  });

  it('补丁号更低 → -1', () => {
    expect(compareVersions('2.1.190', '2.1.191')).toBe(-1);
  });

  it('次版本号优先于补丁号', () => {
    expect(compareVersions('2.2.0', '2.1.999')).toBe(1);
  });

  it('主版本号优先', () => {
    expect(compareVersions('3.0.0', '2.9.9')).toBe(1);
  });

  it('段数不齐按 0 补（2.1 == 2.1.0）', () => {
    expect(compareVersions('2.1', '2.1.0')).toBe(0);
    expect(compareVersions('2.1.1', '2.1')).toBe(1);
  });

  it('已验证版本常量存在且是点分格式', () => {
    expect(TESTED_THROUGH_CC_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
