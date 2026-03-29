/**
 * 自动捕获模块
 * 
 * 在对话结束后自动生成记忆并存储
 * 强制记忆机制：每次对话 100% 生成记忆
 */

import { MemorySystem } from './memory-system';
import { type MemoryConfig } from './config';
import { TriggerAnalyzer } from './triggers';
import { CategoryAnalyzer } from './category';

export class AutoCapture {
  private memorySystem: MemorySystem;
  private config: MemoryConfig;
  private triggerAnalyzer: TriggerAnalyzer;
  private categoryAnalyzer: CategoryAnalyzer;
  
  constructor(memorySystem: MemorySystem, config: MemoryConfig) {
    this.memorySystem = memorySystem;
    this.config = config;
    this.triggerAnalyzer = new TriggerAnalyzer();
    this.categoryAnalyzer = new CategoryAnalyzer();
  }
  
  /**
   * 执行自动捕获
   * 在 agent_end 钩子中调用
   */
  async execute(event: any): Promise<void> {
    try {
      // 1. 检查存储策略
      if (this.config.captureStrategy === 'selective') {
        // 关键词模式：检查是否需要存储
        const hasKeyword = this.checkShouldCapture(event.messages);
        if (!hasKeyword) {
          return;
        }
      }
      
      // 2. 生成对话摘要
      const summary = this.generateSummary(event.messages);
      if (!summary) {
        return;
      }
      
      // 3. 分析分类
      const { category, subCategory } = this.categoryAnalyzer.analyze(summary.task);
      
      // 4. 判断重要性
      const importance = this.triggerAnalyzer.analyze(summary.task);
      
      // 5. 提取标签
      const tags = this.triggerAnalyzer.extractTags(summary.task);
      
      // 6. 强制存储 (100% 执行)
      await this.memorySystem.store({
        content: summary,
        category,
        subCategory,
        importance,
        tags
      });
      
      console.log(`[AutoCapture] 已存储记忆: ${category}/${subCategory} [${importance}]`);
      
    } catch (error) {
      console.error('[AutoCapture] 执行失败:', error);
    }
  }
  
  /**
   * 检查是否应该捕获 (selective 模式)
   */
  private checkShouldCapture(messages: any[]): boolean {
    const allText = this.extractAllText(messages);
    const importance = this.triggerAnalyzer.analyze(allText);
    // critical/high/medium 都存储，只过滤 low
    return importance !== 'low';
  }
  
  /**
   * 提取所有文本
   */
  private extractAllText(messages: any[]): string {
    const texts: string[] = [];
    
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        texts.push(msg.content);
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            texts.push(block.text);
          }
        }
      }
    }
    
    return texts.join(' ');
  }
  
  /**
   * 生成对话摘要
   */
  private generateSummary(messages: any[]): {
    task: string;
    process: string;
    result: string;
    insights: string[];
  } | null {
    // 提取用户消息和 AI 回复
    const userMessages: string[] = [];
    const assistantMessages: string[] = [];
    
    for (const msg of messages) {
      const content = this.extractMessageContent(msg);
      if (!content) continue;
      
      if (msg.role === 'user') {
        userMessages.push(content);
      } else if (msg.role === 'assistant') {
        assistantMessages.push(content);
      }
    }
    
    if (userMessages.length === 0) {
      return null;
    }
    
    // 取最后一条用户消息作为任务
    let lastUserMsg = userMessages[userMessages.length - 1];
    let lastAssistantMsg = assistantMessages[assistantMessages.length - 1] || '';
    
    // 过滤掉召回的上下文（避免递归嵌套）
    lastUserMsg = this.filterRecallContext(lastUserMsg);
    lastAssistantMsg = this.filterRecallContext(lastAssistantMsg);
    
    // 限制长度
    const maxLen = this.config.captureMaxChars;
    
    return {
      task: this.truncate(lastUserMsg, maxLen),
      process: this.extractProcess(lastAssistantMsg),
      result: this.truncate(lastAssistantMsg, maxLen),
      insights: this.extractInsights(lastAssistantMsg)
    };
  }
  
  /**
   * 提取消息内容
   */
  private extractMessageContent(msg: any): string {
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
    return '';
  }
  
  /**
   * 过滤掉召回的上下文内容
   * 防止递归嵌套
   */
  private filterRecallContext(text: string): string {
    // 移除 <relevant-memories>...</relevant-memories> 标签及内容
    return text.replace(/<relevant-memories>[\s\S]*?<\/relevant-memories>/gi, '').trim();
  }
  
  /**
   * 提取处理过程
   */
  private extractProcess(assistantMsg: string): string {
    // 简单提取：取前100字作为处理过程
    return assistantMsg.slice(0, 100);
  }
  
  /**
   * 提取洞察
   */
  private extractInsights(assistantMsg: string): string[] {
    const insights: string[] = [];
    
    // 简单的洞察提取
    if (/完成|解决|修复/i.test(assistantMsg)) {
      insights.push('任务已完成');
    }
    if (/错误|失败|问题/i.test(assistantMsg)) {
      insights.push('遇到问题');
    }
    if (/建议|可以|推荐/i.test(assistantMsg)) {
      insights.push('提供了建议');
    }
    
    return insights;
  }
  
  /**
   * 截断文本
   */
  private truncate(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '...';
  }
}
