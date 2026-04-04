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
   * 检查并自动升级高价值记忆的优先级
   */
  async checkAndUpgradePriority(): Promise<{ memoryId: string; from: string; to: string }[]> {
    const results: { memoryId: string; from: string; to: string }[] = [];
    const memories = this.memorySystem.getAllMemories();
    const now = Date.now();
    
    const DAY_MS = 24 * 60 * 60 * 1000;
    const upgradeThresholds = {
      // 升级条件：usageCount 或 访问频率
      low: { usageCount: 5, recentAccessDays: 7 },      // low -> medium
      medium: { usageCount: 10, recentAccessDays: 14 }, // medium -> high
      high: { usageCount: 20, recentAccessDays: 21 }    // high -> critical
    };
    
    const levels: ('low' | 'medium' | 'high' | 'critical')[] = 
      ['low', 'medium', 'high', 'critical'];
    
    for (const memory of memories) {
      // critical 已经是最高，不再升级
      if (memory.importance === 'critical') continue;
      
      const idx = levels.indexOf(memory.importance);
      if (idx >= levels.length - 1) continue;
      
      const threshold = upgradeThresholds[memory.importance];
      const lastAccess = new Date(memory.lastAccessedAt).getTime();
      const daysSinceAccess = (now - lastAccess) / DAY_MS;
      
      // 检查是否满足升级条件
      let shouldUpgrade = false;
      
      if (memory.usageCount >= threshold.usageCount) {
        shouldUpgrade = true;
      } else if (memory.usageCount >= threshold.usageCount / 2 && 
                 daysSinceAccess < threshold.recentAccessDays) {
        // 如果使用次数达到一半，且最近有访问，也可以升级
        shouldUpgrade = true;
      }
      
      if (shouldUpgrade) {
        const oldImportance = memory.importance;
        memory.importance = levels[idx + 1];
        
        results.push({
          memoryId: memory.id,
          from: oldImportance,
          to: memory.importance
        });
        
        console.log(`[Forgrtter] 记忆 ${memory.id} 优先级已升级: ${oldImportance} -> ${memory.importance}`);
      }
    }
    
    if (results.length > 0) {
      console.log(`[Forgrtter] 已升级 ${results.length} 条记忆的优先级`);
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
