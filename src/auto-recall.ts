/**
 * 自动召回模块
 * 
 * 在 AI 回复前自动搜索相关记忆并注入上下文
 * 触发逻辑：
 * 1. 新会话（第一条消息）自动召回1条
 * 2. 手动触发（关键词）
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
   * @param event 钩子事件
   */
  async execute(event: any): Promise<{ prependContext: string } | void> {
    try {
      // 1. 提取用户输入
      const prompt = this.extractUserPrompt(event.prompt);
      if (!prompt || prompt.length < 3) {
        return;
      }
      
      // 2. 检查是否为新会话（第一条用户消息）
      const isFirstMessage = this.isFirstUserMessage(event);
      
      // 3. 检查是否包含触发关键词
      const hasKeyword = this.hasTriggerKeyword(prompt);
      
      let memories: Memory[] = [];
      
      if (hasKeyword) {
        // 手动触发模式：有关键词
        console.log('[AutoRecall] 检测到触发关键词，搜索相关记忆...');
        memories = await this.memorySystem.search(prompt, {
          limit: this.config.manualRecallLimit,
          threshold: this.config.recallThreshold
        });
        console.log(`[AutoRecall] 手动触发召回 ${memories.length} 条`);
        
      } else if (isFirstMessage && this.config.autoRecallInNewSession) {
        // 新会话自动触发
        console.log('[AutoRecall] 新会话，自动搜索相关记忆...');
        memories = await this.memorySystem.search(prompt, {
          limit: this.config.newSessionMemoryLimit,
          threshold: this.config.recallThreshold
        });
        console.log(`[AutoRecall] 新会话召回 ${memories.length} 条`);
      } else {
        // 非新会话但仍尝试召回（使用较低阈值）
        console.log('[AutoRecall] 尝试召回相关记忆...');
        memories = await this.memorySystem.search(prompt, {
          limit: 1,
          threshold: 0.3  // 较低阈值，扩大召回范围
        });
        console.log(`[AutoRecall] 召回 ${memories.length} 条`);
      }
      
      if (memories.length === 0) {
        return;
      }
      
      // 4. 格式化并返回
      const context = this.formatMemories(memories);
      return { prependContext: context };
      
    } catch (error) {
      console.error('[AutoRecall] 执行失败:', error);
    }
  }
  
  /**
   * 判断是否为第一条用户消息（新会话）
   */
  private isFirstUserMessage(event: any): boolean {
    // 从 event.messages 中计算用户消息数量
    const messages = event.messages || [];
    
    // 过滤出用户消息
    const userMessages = messages.filter((m: any) => m.role === 'user');
    
    // 如果没有用户消息或只有1条，返回 true（新会话）
    return userMessages.length <= 1;
  }
  
  /**
   * 重置会话状态（新会话开始时调用）
   */
  public resetSession(): void {
    console.log('[AutoRecall] 会话状态已重置');
  }

  /**
   * 检查是否包含触发关键词
   */
  private hasTriggerKeyword(prompt: string): boolean {
    const keywords = this.config.manualTriggerKeywords || [];
    const lowerPrompt = prompt.toLowerCase();
    
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        return true;
      }
    }
    return false;
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
