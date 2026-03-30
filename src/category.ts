/**
 * 分类分析模块
 * 
 * 分析对话内容，判断主分类和子分类
 */

export class CategoryAnalyzer {
  // 分类关键词映射
  private categoryKeywords: Record<string, string[]> = {
    '代码开发': [
      '代码', '编程', '脚本', 'Python', 'JavaScript', '开发', '函数', 'bug',
      'code', 'program', 'script', 'python', 'javascript', 'coding', 'function', 'bug'
    ],
    '系统运维': [
      '部署', '服务器', '运维', 'Docker', '配置', '安装', '备份',
      'deploy', 'server', 'docker', 'config', 'install', 'backup'
    ],
    '文档撰写': [
      '文档', '报告', '文章', '写作', '撰写', '总结',
      'document', 'report', 'article', 'write', 'summary'
    ],
    '数据分析': [
      '分析', '数据', '统计', '图表', '可视化', 'CSV', 'Excel',
      'analysis', 'data', 'statistics', 'chart', 'visualization', 'csv', 'excel'
    ],
    '创作设定': [
      '角色', '故事', '世界观', '创作', '小说', '设定',
      'character', 'story', 'world', 'creative', 'novel', 'setting'
    ],
    '用户偏好': [
      '喜欢', '偏好', '习惯', '讨厌', '想要', '口味',
      'prefer', 'like', 'hate', 'want', 'habit', 'taste'
    ],
    '日常事务': [
      '日程', '邮件', '安排', '提醒', '天气', '时间',
      'schedule', 'email', 'remind', 'weather', 'time'
    ]
  };
  
  /**
   * 分析内容，返回分类
   */
  analyze(content: string): { category: string; subCategory: string } {
    const lower = content.toLowerCase();
    let bestCategory = '其他';
    let maxScore = 0;
    
    // 1. 查找最佳匹配分类
    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
      }
    }
    
    // 2. 确定子分类
    const subCategory = this.getSubCategory(content, bestCategory);
    
    return {
      category: bestCategory,
      subCategory
    };
  }
  
  /**
   * 获取子分类
   */
  private getSubCategory(content: string, category: string): string {
    const lower = content.toLowerCase();
    
    if (category === '代码开发') {
      if (/python|脚本/.test(lower)) return '脚本';
      if (/web|前端|html|css|react|vue/.test(lower)) return '前端';
      if (/api|后端|server|node/.test(lower)) return '后端';
      if (/bug|debug|错误/.test(lower)) return '调试';
      if (/算法|数据结构/.test(lower)) return '算法';
      return '通用';
    }
    
    if (category === '系统运维') {
      if (/docker|容器/.test(lower)) return '容器';
      if (/部署|发布/.test(lower)) return '部署';
      if (/备份|恢复/.test(lower)) return '备份';
      if (/服务器|server/.test(lower)) return '服务器';
      if (/监控|日志/.test(lower)) return '监控';
      return '通用';
    }
    
    if (category === '文档撰写') {
      if (/需求|规格/.test(lower)) return '需求文档';
      if (/技术|开发/.test(lower)) return '技术文档';
      if (/用户|手册/.test(lower)) return '用户手册';
      return '通用';
    }
    
    if (category === '数据分析') {
      if (/可视化|图表/.test(lower)) return '可视化';
      if (/统计|报表/.test(lower)) return '统计分析';
      if (/机器学习|ai|人工智能/.test(lower)) return '机器学习';
      return '通用';
    }
    
    if (category === '创作设定') {
      if (/角色|人物/.test(lower)) return '角色设定';
      if (/世界观|背景/.test(lower)) return '世界观';
      if (/剧情|情节/.test(lower)) return '剧情';
      return '通用';
    }
    
    if (category === '用户偏好') {
      if (/饮食|口味/.test(lower)) return '饮食偏好';
      if (/工作|学习/.test(lower)) return '工作习惯';
      if (/工具|软件/.test(lower)) return '工具偏好';
      return '通用';
    }
    
    return '通用';
  }
  
  /**
   * 获取所有分类
   */
  getAllCategories(): string[] {
    return Object.keys(this.categoryKeywords);
  }
  
  /**
   * 获取分类的中文名称
   */
  getCategoryDisplayName(category: string): string {
    const displayNames: Record<string, string> = {
      '代码开发': '代码开发',
      '系统运维': '系统运维',
      '文档撰写': '文档撰写',
      '数据分析': '数据分析',
      '创作设定': '创作设定',
      '用户偏好': '用户偏好',
      '日常事务': '日常事务',
      '其他': '其他'
    };
    return displayNames[category] || category;
  }
}
