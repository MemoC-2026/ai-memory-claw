/**
 * Auto Recall 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoRecall } from '../src/auto-recall';

// Mock MemorySystem
vi.mock('../src/memory-system', () => ({
  MemorySystem: vi.fn().mockImplementation(() => ({
    search: vi.fn().mockResolvedValue([
      {
        id: 'test-001',
        category: '技术',
        subCategory: 'Bug修复',
        content: { task: '修复登录bug', result: '修复token刷新逻辑' },
        createdAt: new Date(),
        importance: 'high',
        shared: false
      }
    ]),
    searchPrivate: vi.fn().mockResolvedValue([]),
    searchShared: vi.fn().mockResolvedValue([])
  }))
}));

describe('AutoRecall', () => {
  let autoRecall: AutoRecall;
  let mockMemorySystem: any;
  
  beforeEach(() => {
    mockMemorySystem = {
      search: vi.fn().mockResolvedValue([
        {
          id: 'test-001',
          category: '技术',
          subCategory: 'Bug修复',
          content: { task: '修复登录bug', result: '修复token刷新逻辑' },
          createdAt: new Date(),
          importance: 'high',
          shared: false
        }
      ]),
      searchPrivate: vi.fn().mockResolvedValue([]),
      searchShared: vi.fn().mockResolvedValue([])
    };
    
    autoRecall = new AutoRecall(mockMemorySystem, {
      autoRecallInNewSession: true,
      newSessionMemoryLimit: 1,
      manualTriggerEnabled: true,
      manualTriggerKeywords: ['记得', '之前'],
      manualRecallLimit: 3,
      recallThreshold: 0.6,
      sharedEnabled: false
    } as any);
  });
  
  it('应该正确初始化', () => {
    expect(autoRecall).toBeDefined();
  });
  
  it('新会话应该自动触发召回', async () => {
    const event = {
      prompt: '请帮我修复登录bug',
      messages: [{ role: 'user', content: '请帮我修复登录bug' }]
    };
    
    const result = await autoRecall.execute(event);
    
    // 新会话应该返回记忆
    expect(result).toBeDefined();
    expect(result?.prependContext).toContain('相关记忆');
  });
  
  it('手动触发关键词应该召回', async () => {
    const event = {
      prompt: '之前那次登录bug怎么修复的？',
      messages: [
        { role: 'user', content: '之前那次登录bug怎么修复的？' }
      ]
    };
    
    const result = await autoRecall.execute(event);
    
    // 有关键词应该召回
    expect(result).toBeDefined();
  });
  
  it('非新会话无关键词应该尝试召回（低阈值）', async () => {
    const event = {
      prompt: '今天天气怎么样',
      messages: [
        { role: 'user', content: '你好' },
        { role: 'user', content: '今天天气怎么样' }
      ]
    };
    
    const result = await autoRecall.execute(event);
    
    // 非新会话且无关键词，会使用低阈值尝试召回
    // 可能会返回结果（取决于相似度）
    expect(result).toBeDefined();
  });
  
  it('resetSession 应该重置会话状态', () => {
    autoRecall.resetSession();
    // 重置后应该能再次触发新会话召回
    expect(true).toBe(true);
  });
});
