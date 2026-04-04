/**
 * Auto Capture 测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AutoCapture } from '../src/auto-capture';
import { MemorySystem } from '../src/memory-system';

// Mock MemorySystem
vi.mock('../src/memory-system', () => ({
  MemorySystem: vi.fn().mockImplementation(() => ({
    store: vi.fn().mockResolvedValue({ id: 'test-001' }),
    storeShared: vi.fn().mockResolvedValue({ id: 'test-002' }),
    getAllMemories: vi.fn().mockReturnValue([]),
    getAllMemoriesWithShared: vi.fn().mockReturnValue([])
  }))
}));

describe('AutoCapture', () => {
  let autoCapture: AutoCapture;
  let mockMemorySystem: any;
  
  beforeEach(() => {
    mockMemorySystem = {
      store: vi.fn().mockResolvedValue({ id: 'test-001' }),
      storeShared: vi.fn().mockResolvedValue({ id: 'test-002' })
    };
    
    autoCapture = new AutoCapture(mockMemorySystem, {
      captureStrategy: 'always',
      sharedEnabled: true,
      captureMaxChars: 500
    } as any);
  });
  
  it('应该正确初始化', () => {
    expect(autoCapture).toBeDefined();
  });
  
  it('应该生成对话摘要', async () => {
    const messages = [
      { role: 'user', content: '请帮我修复登录bug' },
      { role: 'assistant', content: '好的，我来帮你分析登录流程。发现token过期未刷新。修复完成。' }
    ];
    
    // 创建一个简单的测试事件
    const event = { messages };
    
    // 执行捕获（由于 mock，无法完全测试，但可以验证不报错）
    await autoCapture.execute(event);
  });
  
  it('应该过滤召回的上下文', async () => {
    const messages = [
      { role: 'user', content: '之前那次登录bug怎么修复的？' },
      { role: 'assistant', content: '根据之前的记忆，修复了token刷新逻辑。<relevant-memories>之前的记忆</relevant-memories>' }
    ];
    
    const event = { messages };
    await autoCapture.execute(event);
  });
  
  it('selective 模式应该过滤低重要性', async () => {
    const selectiveCapture = new AutoCapture(mockMemorySystem, {
      captureStrategy: 'selective',
      sharedEnabled: false,
      captureMaxChars: 500
    } as any);
    
    // 测试普通消息
    const event = { messages: [{ role: 'user', content: 'hello' }] };
    await selectiveCapture.execute(event);
  });
});
