/**
 * 关键词分析模块
 * 
 * 分析文本内容，判断重要性等级，提取标签
 */

import type { ImportanceLevel } from './types';

export class TriggerAnalyzer {
  // 关键信息 - importance = critical
  private criticalPatterns = [
    // 中文
    /记住|别忘了|提醒我|提醒/i,
    /密码|账号|身份|银行卡|信用卡/i,
    /\+\d{10,}/,                    // 电话
    /[\w.-]+@[\w.-]+\.\w+/,         // 邮箱
    // 英文
    /remember|don't forget|remind me/i,
    /password|account|identity|card/i
  ];
  
  // 重要决策 - importance = high
  private highPatterns = [
    // 中文
    /决定|选择|采用|否决|定下来/i,
    /配置|安装|部署|设置/i,
    /偏好|喜欢|讨厌|想要/i,
    // 英文
    /decide|decided|choose|use|adopt/i,
    /config|install|deploy|setup/i,
    /prefer|like|hate|want/i
  ];
  
  // 一般工作 - importance = medium
  private mediumPatterns = [
    // 中文
    /实现|修复|创建|帮助|完成|解决了/i,
    /写|做|生成|处理|分析/i,
    /实现|添加|新增|重构|优化/i,
    // 英文
    /implement|fix|create|help|complete|build/i,
    /write|make|generate|process|analyze/i,
    /add|new|refactor|optimize/i
  ];
  
  // 低价值 - importance = low
  private lowPatterns = [
    // 中文
    /^你好|^谢谢|^再见|^好的/i,
    /请问|没什么|随便/i,
    // 英文
    /^(hi|hello|thanks|bye|ok|okay)$/i,
    /nothing|just|whatever/i
  ];
  
  /**
   * 分析文本，返回重要性等级
   */
  analyze(content: string): ImportanceLevel {
    const lower = content.toLowerCase();
    
    if (this.criticalPatterns.some(p => p.test(lower))) {
      return 'critical';
    }
    if (this.highPatterns.some(p => p.test(lower))) {
      return 'high';
    }
    if (this.lowPatterns.some(p => p.test(lower))) {
      return 'low';
    }
    if (this.mediumPatterns.some(p => p.test(lower))) {
      return 'medium';
    }
    
    // 默认中等
    return 'medium';
  }
  
  /**
   * 提取标签
   */
  extractTags(content: string): string[] {
    const tags: string[] = [];
    const lower = content.toLowerCase();
    
    // 标签映射
    const tagPatterns: Record<string, RegExp[]> = {
      // 技术相关
      '代码': [/代码|编程|函数|脚本/i, /code|program|script/i],
      '配置': [/配置|设置|安装/i, /config|setup|install/i],
      '数据': [/数据|分析|统计/i, /data|analysis|stat/i],
      '文档': [/文档|报告|文章/i, /doc|report|article/i],
      '决策': [/决定|选择|采用/i, /decide|choose|adopt/i],
      '问题': [/错误|bug|问题|故障/i, /error|bug|issue|problem/i],
      '完成': [/完成|解决了|实现了/i, /done|completed|implemented/i],
      '创建': [/创建|新建/i, /create|new/i],
      // 偏好相关
      '偏好': [/喜欢|偏好|讨厌|想要/i, /prefer|like|hate|want/i],
      // 个人信息
      '记住': [/记住|别忘了/i, /remember|don't forget/i],
      '重要': [/重要|关键|永远|永不/i, /important|critical|always|never/i]
    };
    
    for (const [tag, patterns] of Object.entries(tagPatterns)) {
      if (patterns.some(p => p.test(lower))) {
        tags.push(tag);
      }
    }
    
    return tags;
  }
  
  /**
   * 检测是否包含关键信息
   */
  hasCriticalInfo(content: string): boolean {
    return this.analyze(content) === 'critical';
  }
  
  /**
   * 检测是否低价值内容
   */
  isLowValue(content: string): boolean {
    return this.analyze(content) === 'low';
  }
}
