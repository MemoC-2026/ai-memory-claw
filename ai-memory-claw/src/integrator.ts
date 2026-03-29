/**
 * 记忆整合模块
 * 
 * 自动将相似记忆整合为记忆簇
 */

import { MemorySystem } from './memory-system';
import { type MemoryConfig } from './config';
import type { Memory } from './types';

export interface IntegrationResult {
  clusterId: string;
  action: 'merged' | 'updated';
  memoryIds: string[];
}

export class Integrator {
  private memorySystem: MemorySystem;
  private config: MemoryConfig;
  
  constructor(memorySystem: MemorySystem, config: MemoryConfig) {
    this.memorySystem = memorySystem;
    this.config = config;
  }
  
  /**
   * 执行记忆整合
   */
  async integrate(): Promise<IntegrationResult[]> {
    const results: IntegrationResult[] = [];
    const memories = this.memorySystem.getAllMemories();
    
    if (memories.length < 2) {
      return results;
    }
    
    // 按分类分组
    const byCategory = new Map<string, Memory[]>();
    
    for (const memory of memories) {
      const key = `${memory.category}/${memory.subCategory}`;
      if (!byCategory.has(key)) {
        byCategory.set(key, []);
      }
      byCategory.get(key)!.push(memory);
    }
    
    // 对每个分类进行检查
    for (const [categoryKey, categoryMemories] of byCategory.entries()) {
      if (categoryMemories.length < 2) continue;
      
      // 查找相似记忆
      const similarPairs = this.findSimilarPairs(categoryMemories);
      
      for (const pair of similarPairs) {
        // 可以选择合并或保留
        const result = await this.processSimilarPair(pair);
        if (result) {
          results.push(result);
        }
      }
    }
    
    if (results.length > 0) {
      console.log(`[Integrator] 已整合 ${results.length} 组记忆`);
    }
    
    return results;
  }
  
  /**
   * 查找相似记忆对
   */
  private findSimilarPairs(memories: Memory[]): { m1: Memory; m2: Memory; score: number }[] {
    const pairs: { m1: Memory; m2: Memory; score: number }[] = [];
    const threshold = this.config.integrationThreshold;
    
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const m1 = memories[i];
        const m2 = memories[j];
        
        // 检查是否已处理过
        if (m1.mergedFrom?.includes(m2.id) || m2.mergedFrom?.includes(m1.id)) {
          continue;
        }
        
        // 简单的文本相似度计算
        const score = this.calculateSimilarity(
          m1.content.task + ' ' + m1.content.result,
          m2.content.task + ' ' + m2.content.result
        );
        
        if (score >= threshold) {
          pairs.push({ m1, m2, score });
        }
      }
    }
    
    return pairs;
  }
  
  /**
   * 计算文本相似度
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.tokenize(text1));
    const words2 = new Set(this.tokenize(text2));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    let intersection = 0;
    for (const word of words1) {
      if (words2.has(word)) intersection++;
    }
    
    const union = words1.size + words2.size - intersection;
    return union > 0 ? intersection / union : 0;
  }
  
  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);
  }
  
  /**
   * 处理相似记忆对
   */
  private async processSimilarPair(pair: { m1: Memory; m2: Memory; score: number }): Promise<IntegrationResult | null> {
    const { m1, m2, score } = pair;
    
    // 简单策略：保留访问次数多的，删除访问次数少的
    const keep = m1.usageCount >= m2.usageCount ? m1 : m2;
    const remove = m1.usageCount >= m2.usageCount ? m2 : m1;
    
    // 更新被保留的记忆
    keep.mergedFrom = keep.mergedFrom || [];
    keep.mergedFrom.push(remove.id);
    keep.version++;
    keep.updatedAt = new Date();
    
    // 添加合并记录到摘要
    if (keep.content.insights) {
      keep.content.insights.push(`[整合] 合并了记忆 ${remove.id.slice(0, 8)}，相似度 ${(score * 100).toFixed(0)}%`);
    }
    
    // 删除被合并的记忆
    await this.memorySystem.delete(remove.id);
    
    return {
      clusterId: keep.id,
      action: 'merged',
      memoryIds: [m1.id, m2.id]
    };
  }
  
  /**
   * 获取整合候选列表
   */
  getIntegrationCandidates(): { m1: Memory; m2: Memory; score: number }[] {
    const candidates: { m1: Memory; m2: Memory; score: number }[] = [];
    const memories = this.memorySystem.getAllMemories();
    const threshold = this.config.integrationThreshold;
    
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const m1 = memories[i];
        const m2 = memories[j];
        
        // 跳过已合并的
        if (m1.mergedFrom?.includes(m2.id) || m2.mergedFrom?.includes(m1.id)) {
          continue;
        }
        
        const score = this.calculateSimilarity(
          m1.content.task + ' ' + m1.content.result,
          m2.content.task + ' ' + m2.content.result
        );
        
        if (score >= threshold) {
          candidates.push({ m1, m2, score });
        }
      }
    }
    
    // 按相似度排序
    candidates.sort((a, b) => b.score - a.score);
    
    return candidates;
  }
}
