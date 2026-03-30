/**
 * 自动召回模块
 * 
 * 在 AI 回复前自动搜索相关记忆并注入上下文
 */

import { MemorySystem } from './memory-system';
import { type MemoryConfig } from './config';
import type { Memory } from './types';

export class AutoRecall {
  private memorySystem: MemorySystem;
  private config: MemoryConfig;
  
  constructor(memorySystem: MemorySystem, config: MemoryConfig) {
    this.memorySystem = memorySystem;
    this.config = config;
  }
  
  /**
   * 执行自动召回
   * 在 before_agent_start 钩子中调用
   */
  async execute(event: any): Promise<{ prependContext: string } | void> {
    try {
      // 1. 提取用户输入
      const prompt = this.extractUserPrompt(event.prompt);
      if (!prompt || prompt.length < 3) {
        return;
      }
      
      const searchOptions = {
        limit: this.config.recallLimit,
        threshold: this.config.recallThreshold
      };
      
      // 2. 搜索相关记忆
      let memories = await this.memorySystem.search(prompt, searchOptions);
      
      // 3. 如果启用共享记忆，同时搜索共享记忆
      if (this.config.sharedEnabled) {
        const sharedMemories = await this.memorySystem.searchShared(prompt, searchOptions);
        
        // 合并结果，去重
        const existingIds = new Set(memories.map(m => m.id));
        for (const m of sharedMemories) {
          if (!existingIds.has(m.id)) {
            memories.push(m);
          }
        }
      }
      
      if (memories.length === 0) {
        return;
      }
      
      // 4. 格式化并返回
      const context = this.formatMemories(memories);
      
      return {
        prependContext: context
      };
      
    } catch (error) {
      console.error('[AutoRecall] 执行失败:', error);
    }
  }
  
  /**
   * 从事件中提取用户输入
   */
  private extractUserPrompt(prompt: any): string {
    if (typeof prompt === 'string') {
      return prompt;
    }
    
    if (Array.isArray(prompt)) {
      // 取最后一条用户消息
      for (let i = prompt.length - 1; i >= 0; i--) {
        const msg = prompt[i];
        if (msg.role === 'user') {
          if (typeof msg.content === 'string') {
            return msg.content;
          }
          if (Array.isArray(msg.content)) {
            // 取第一个文本块
            for (const block of msg.content) {
              if (block.type === 'text' && block.text) {
                return block.text;
              }
            }
          }
        }
      }
    }
    
    return '';
  }
  
  /**
   * 格式化记忆为上下文字符串
   */
  private formatMemories(memories: Memory[]): string {
    const lines = memories.map((m, i) => {
      const date = new Date(m.createdAt).toLocaleDateString('zh-CN');
      const importance = this.getImportanceEmoji(m.importance);
      
      return `${i + 1}. ${importance} [${date}] ${m.category}/${m.subCategory}
   任务: ${m.content.task}
   结果: ${m.content.result}`;
    });
    
    return `<relevant-memories>
以下是你之前与用户交流的相关记忆，供参考：
${lines.join('\n\n')}
</relevant-memories>`;
  }
  
  /**
   * 获取重要性emoji
   */
  private getImportanceEmoji(importance: string): string {
    switch (importance) {
      case 'critical': return '⭐';
      case 'high': return '🔥';
      case 'medium': return '📝';
      case 'low': return '💤';
      default: return '📝';
    }
  }
}
