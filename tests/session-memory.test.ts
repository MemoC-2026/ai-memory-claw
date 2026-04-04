/**
 * Session Memory 测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SessionMemory } from '../src/session-memory';

describe('SessionMemory', () => {
  let sessionMemory: SessionMemory;
  
  beforeEach(() => {
    sessionMemory = new SessionMemory({
      enabled: true,
      storageDir: '/tmp/test-session-memory',
      compactionThreshold: 0.8
    });
  });
  
  it('应该正确初始化', async () => {
    await sessionMemory.initialize('/tmp/test-session-memory');
    expect(sessionMemory.isEnabled()).toBe(true);
  });
  
  it('应该创建新会话', async () => {
    await sessionMemory.initialize('/tmp/test-session-memory');
    const session = await sessionMemory.createSession('test-001', 'test-project', '测试任务');
    
    expect(session.sessionId).toBe('test-001');
    expect(session.projectSlug).toBe('test-project');
    expect(session.initialTask).toBe('测试任务');
    expect(session.currentStatus).toBe('active');
  });
  
  it('应该添加决策', async () => {
    await sessionMemory.initialize('/tmp/test-session-memory');
    await sessionMemory.createSession('test-002', 'test-project', '测试任务');
    await sessionMemory.addDecision('决定使用TypeScript');
    
    const session = sessionMemory.getCurrent();
    expect(session?.decisions).toHaveLength(1);
    expect(session?.decisions[0]).toContain('决定使用TypeScript');
  });
  
  it('应该添加完成步骤', async () => {
    await sessionMemory.initialize('/tmp/test-session-memory');
    await sessionMemory.createSession('test-003', 'test-project', '测试任务');
    await sessionMemory.addCompletedStep('完成第一步');
    await sessionMemory.addCompletedStep('完成第二步');
    
    const session = sessionMemory.getCurrent();
    expect(session?.completedSteps).toHaveLength(2);
  });
  
  it('应该更新摘要', async () => {
    await sessionMemory.initialize('/tmp/test-session-memory');
    await sessionMemory.createSession('test-004', 'test-project', '测试任务');
    await sessionMemory.updateSummary('这是测试摘要');
    
    const session = sessionMemory.getCurrent();
    expect(session?.summary).toBe('这是测试摘要');
  });
  
  it('应该在未启用时返回空摘要', () => {
    const disabled = new SessionMemory({ enabled: false });
    expect(disabled.getSummary()).toBe('');
  });
});
