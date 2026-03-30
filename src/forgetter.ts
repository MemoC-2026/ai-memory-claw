/**
 * 遗忘机制模块
 * 
 * 自动删除低价值记忆，保持存储效率
 */

import { MemorySystem } from './memory-system';
import type { Memory } from './types';

export interface ForgetResult {
  id: string;
  action: 'deleted' | 'compressed';
  reason: string;
}

export class Forgrtter {
  private memorySystem: MemorySystem;
  
  constructor(memorySystem: MemorySystem) {
    this.memorySystem = memorySystem;
  }
  
  /**
   * 检查并执行遗忘
   */
  async checkAndForget(): Promise<ForgetResult[]> {
    const results: ForgetResult[] = [];
    const memories = this.memorySystem.getAllMemories();
    const now = Date.now();
    
    const DAY_MS = 24 * 60 * 60 * 1000;
    
    for (const memory of memories) {
      const lastAccess = new Date(memory.lastAccessedAt).getTime();
      const daysSinceAccess = (now - lastAccess) / DAY_MS;
      const importanceScore = this.getImportanceScore(memory.importance);
      
      let shouldForget = false;
      let reason = '';
      
      // 遗忘条件
      if (daysSinceAccess > 30 && importanceScore < 0.3) {
        // 30天未访问 + 低重要性 = 直接删除
        shouldForget = true;
        reason = '30天未访问 + 低重要性';
      } else if (daysSinceAccess > 60 && importanceScore < 0.5) {
        // 60天未访问 + 中低重要性 = 直接删除
        shouldForget = true;
        reason = '60天未访问 + 中低重要性';
      } else if (daysSinceAccess > 90) {
        // 90天未访问 = 直接删除
        shouldForget = true;
        reason = '90天未访问';
      }
      
      if (shouldForget) {
        await this.memorySystem.delete(memory.id);
        results.push({
          id: memory.id,
          action: 'deleted',
          reason
        });
      }
    }
    
    if (results.length > 0) {
      console.log(`[Forgrtter] 已遗忘 ${results.length} 条记忆`);
    }
    
    return results;
  }
  
  /**
   * 获取重要性分数
   */
  private getImportanceScore(importance: string): number {
    switch (importance) {
      case 'critical': return 1.0;
      case 'high': return 0.7;
      case 'medium': return 0.5;
      case 'low': return 0.2;
      default: return 0.5;
    }
  }
  
  /**
   * 获取遗忘候选列表
   */
  getForgetCandidates(): { memory: Memory; score: number; reason: string }[] {
    const candidates: { memory: Memory; score: number; reason: string }[] = [];
    const memories = this.memorySystem.getAllMemories();
    const now = Date.now();
    
    const DAY_MS = 24 * 60 * 60 * 1000;
    
    for (const memory of memories) {
      const lastAccess = new Date(memory.lastAccessedAt).getTime();
      const daysSinceAccess = (now - lastAccess) / DAY_MS;
      const importanceScore = this.getImportanceScore(memory.importance);
      
      // 计算遗忘分数 (越高越应该遗忘)
      let forgetScore = 0;
      let reason = '';
      
      if (daysSinceAccess > 30 && importanceScore < 0.3) {
        forgetScore = 0.9;
        reason = '30天未访问 + 低重要性';
      } else if (daysSinceAccess > 60 && importanceScore < 0.5) {
        forgetScore = 0.7;
        reason = '60天未访问 + 中低重要性';
      } else if (daysSinceAccess > 90) {
        forgetScore = 0.5;
        reason = '90天未访问';
      } else if (daysSinceAccess > 14 && importanceScore < 0.3) {
        forgetScore = 0.3;
        reason = '14天未访问 + 低重要性';
      }
      
      if (forgetScore > 0) {
        candidates.push({ memory, score: forgetScore, reason });
      }
    }
    
    // 按遗忘分数排序
    candidates.sort((a, b) => b.score - a.score);
    
    return candidates;
  }
}
