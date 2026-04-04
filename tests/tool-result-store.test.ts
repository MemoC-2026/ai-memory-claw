/**
 * Tool Result Store 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolResultStore } from '../src/tool-result-store';

describe('ToolResultStore', () => {
  let store: ToolResultStore;
  
  beforeEach(() => {
    store = new ToolResultStore({
      storageDir: '/tmp/test-tool-results',
      grepThreshold: 1024,      // 1KB 便于测试
      readThreshold: 2048,    // 2KB
      previewLength: 256      // 256B
    });
  });
  
  it('应该正确初始化', async () => {
    await store.initialize('/tmp/test-tool-results');
    expect(store.isEnabled()).toBe(true);
  });
  
  it('小结果应该直接返回', async () => {
    await store.initialize('/tmp/test-tool-results');
    const smallContent = '这是一个小结果';
    
    const result = await store.getResult('tool-001', 'session-001', smallContent, 'read');
    
    expect(result.isPreview).toBe(false);
    expect(result.content).toBe(smallContent);
  });
  
  it('大结果应该返回预览', async () => {
    await store.initialize('/tmp/test-tool-results');
    // 生成大于 1KB 的内容
    const largeContent = 'x'.repeat(2000);
    
    const result = await store.getResult('tool-002', 'session-001', largeContent, 'grep');
    
    expect(result.isPreview).toBe(true);
    expect(result.content).toContain('<持久输出>');
    expect(result.content).toContain('内容已截断');
  });
  
  it('状态应该被冻结', async () => {
    await store.initialize('/tmp/test-tool-results');
    const largeContent = 'x'.repeat(2000);
    
    // 第一次调用
    const result1 = await store.getResult('tool-003', 'session-001', largeContent, 'grep');
    expect(result1.isPreview).toBe(true);
    
    // 第二次调用（相同会话）应该返回相同结果
    const result2 = await store.getResult('tool-003', 'session-001', largeContent, 'grep');
    expect(result2.isPreview).toBe(true);
  });
  
  it('不同工具应有不同阈值', async () => {
    await store.initialize('/tmp/test-tool-results');
    const content = 'x'.repeat(1500);
    
    // grep 阈值 1KB
    const grepResult = await store.getResult('tool-004', 'session-001', content, 'grep');
    expect(grepResult.isPreview).toBe(true);
    
    // read 阈值 2KB
    const readResult = await store.getResult('tool-005', 'session-001', content, 'read');
    expect(readResult.isPreview).toBe(false);
  });
});
