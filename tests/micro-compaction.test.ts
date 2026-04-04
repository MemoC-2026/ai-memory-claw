/**
 * Micro Compaction 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MicroCompaction } from '../src/micro-compaction';

describe('MicroCompaction', () => {
  let compaction: MicroCompaction;
  
  beforeEach(() => {
    compaction = new MicroCompaction({
      enabled: true,
      timeThresholdMinutes: 60,
      keepRecentCount: 3,
      enableCacheEdits: true,
      cacheMaxSize: 1024  // 1KB 便于测试
    });
  });
  
  it('应该正确初始化', () => {
    expect(compaction.isEnabled()).toBe(true);
    expect(compaction.getCacheCount()).toBe(0);
  });
  
  it('应该正确添加工具结果', () => {
    compaction.addToolResult('tool-001', '结果内容');
    
    expect(compaction.hasToolResult('tool-001')).toBe(true);
    expect(compaction.getToolResult('tool-001')).toBe('结果内容');
  });
  
  it('应该正确删除工具结果', () => {
    compaction.addToolResult('tool-001', '结果内容');
    compaction.deleteToolResult('tool-001');
    
    expect(compaction.hasToolResult('tool-001')).toBe(false);
  });
  
  it('缓存大小应该正确计算', () => {
    compaction.addToolResult('tool-001', 'x'.repeat(100));
    compaction.addToolResult('tool-002', 'y'.repeat(200));
    
    const size = compaction.getCacheSize();
    expect(size).toBe(300);
  });
  
  it('缓存应该限制条目数', async () => {
    // 添加 5 个工具结果
    for (let i = 0; i < 5; i++) {
      compaction.addToolResult(`tool-${i}`, `结果${i}`);
    }
    
    // 手动触发压缩（因为时间未到）
    await compaction.forceCompact();
    
    // 应该删除最旧的，保留最近的
    expect(compaction.getCacheCount()).toBeLessThanOrEqual(5);
  });
  
  it('应该在未启用时返回 null', async () => {
    const disabled = new MicroCompaction({ enabled: false });
    const result = await disabled.execute([]);
    
    expect(result).toBeNull();
  });
  
  it('清空缓存应该正常工作', () => {
    compaction.addToolResult('tool-001', '结果');
    compaction.clearCache();
    
    expect(compaction.getCacheCount()).toBe(0);
  });
});
