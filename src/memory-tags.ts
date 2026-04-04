/**
 * Memory Tags - 记忆标签模块
 * 
 * 支持自定义标签搜索和管理
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MemoryTag {
  id: string;
  name: string;
  color: string;
  description?: string;
  count: number;
  createdAt: Date;
}

export interface TagConfig {
  enabled: boolean;
  storageDir: string;
  maxTagsPerMemory: number;  // 每个记忆最多标签数
  autoExtract: boolean;      // 自动提取标签
}

const DEFAULT_CONFIG: TagConfig = {
  enabled: true,
  storageDir: '~/.ai-memory-claw/tags',
  maxTagsPerMemory: 10,
  autoExtract: true
};

export class MemoryTags {
  private config: TagConfig;
  private storageDir: string;
  private tags: Map<string, MemoryTag> = new Map();
  private memoryTags: Map<string, Set<string>> = new Map();  // memoryId -> tags
  
  // 预设标签颜色
  private readonly TAG_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  
  constructor(config: Partial<TagConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageDir = this.config.storageDir;
  }
  
  /**
   * 初始化
   */
  async initialize(storageDir: string): Promise<void> {
    if (!this.config.enabled) return;
    
    this.storageDir = storageDir;
    
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    
    // 加载已有标签
    await this.loadTags();
    
    console.log('[MemoryTags] 已初始化，标签数:', this.tags.size);
  }
  
  /**
   * 添加标签到记忆
   */
  async addTagToMemory(memoryId: string, tagName: string): Promise<void> {
    if (!this.config.enabled) return;
    
    // 创建或获取标签
    const tag = await this.getOrCreateTag(tagName);
    
    // 添加到记忆
    if (!this.memoryTags.has(memoryId)) {
      this.memoryTags.set(memoryId, new Set());
    }
    
    const tags = this.memoryTags.get(memoryId)!;
    
    // 检查数量限制
    if (tags.size >= this.config.maxTagsPerMemory) {
      console.warn(`[MemoryTags] 记忆 ${memoryId} 已达到最大标签数`);
      return;
    }
    
    tags.add(tag.name);
    tag.count++;
    
    // 保存
    await this.saveTag(tag);
    await this.saveMemoryTags(memoryId);
  }
  
  /**
   * 从记忆移除标签
   */
  async removeTagFromMemory(memoryId: string, tagName: string): Promise<void> {
    if (!this.config.enabled) return;
    
    const tags = this.memoryTags.get(memoryId);
    if (!tags || !tags.has(tagName)) return;
    
    tags.delete(tagName);
    
    // 更新计数
    const tag = this.tags.get(tagName.toLowerCase());
    if (tag) {
      tag.count = Math.max(0, tag.count - 1);
      await this.saveTag(tag);
    }
    
    await this.saveMemoryTags(memoryId);
  }
  
  /**
   * 获取记忆的所有标签
   */
  getMemoryTags(memoryId: string): string[] {
    const tags = this.memoryTags.get(memoryId);
    return tags ? Array.from(tags) : [];
  }
  
  /**
   * 搜索带特定标签的记忆
   */
  async searchByTag(tagName: string): Promise<string[]> {
    const results: string[] = [];
    
    for (const [memoryId, tags] of this.memoryTags.entries()) {
      if (tags.has(tagName.toLowerCase())) {
        results.push(memoryId);
      }
    }
    
    return results;
  }
  
  /**
   * 获取所有标签
   */
  getAllTags(): MemoryTag[] {
    return Array.from(this.tags.values()).sort((a, b) => b.count - a.count);
  }
  
  /**
   * 自动提取标签
   */
  async autoExtractTags(text: string): Promise<string[]> {
    if (!this.config.autoExtract) return [];
    
    const extracted: string[] = [];
    
    // 简单的关键词提取
    const keywords = [
      'bug', '修复', '优化', '新增', '删除', '重构',
      'api', '数据库', '前端', '后端', '测试', '部署',
      '登录', '注册', '权限', '配置', '文档'
    ];
    
    for (const keyword of keywords) {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        extracted.push(keyword);
      }
    }
    
    return extracted;
  }
  
  /**
   * 创建或获取标签
   */
  private async getOrCreateTag(name: string): Promise<MemoryTag> {
    const lowerName = name.toLowerCase();
    
    if (this.tags.has(lowerName)) {
      return this.tags.get(lowerName)!;
    }
    
    // 创建新标签
    const tag: MemoryTag = {
      id: `tag-${Date.now()}`,
      name: lowerName,
      color: this.TAG_COLORS[this.tags.size % this.TAG_COLORS.length],
      count: 0,
      createdAt: new Date()
    };
    
    this.tags.set(lowerName, tag);
    await this.saveTag(tag);
    
    return tag;
  }
  
  /**
   * 加载标签
   */
  private async loadTags(): Promise<void> {
    const indexPath = path.join(this.storageDir, 'index.json');
    
    if (!fs.existsSync(indexPath)) return;
    
    try {
      const content = fs.readFileSync(indexPath, 'utf-8');
      const data = JSON.parse(content) as MemoryTag[];
      
      for (const tag of data) {
        tag.createdAt = new Date(tag.createdAt);
        this.tags.set(tag.name, tag);
      }
    } catch (err) {
      console.error('[MemoryTags] 加载标签失败:', err);
    }
  }
  
  /**
   * 保存标签
   */
  private async saveTag(tag: MemoryTag): Promise<void> {
    const indexPath = path.join(this.storageDir, 'index.json');
    
    // 更新内存中的标签
    this.tags.set(tag.name, tag);
    
    // 保存到文件
    const tags = Array.from(this.tags.values());
    await fs.promises.writeFile(indexPath, JSON.stringify(tags, null, 2));
  }
  
  /**
   * 保存记忆标签
   */
  private async saveMemoryTags(memoryId: string): Promise<void> {
    const tags = this.memoryTags.get(memoryId);
    if (!tags) return;
    
    const filePath = path.join(this.storageDir, `${memoryId}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(Array.from(tags)));
  }
  
  /**
   * 加载记忆标签
   */
  async loadMemoryTags(memoryId: string): Promise<string[]> {
    const filePath = path.join(this.storageDir, `${memoryId}.json`);
    
    if (!fs.existsSync(filePath)) return [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const tags = JSON.parse(content) as string[];
      this.memoryTags.set(memoryId, new Set(tags));
      return tags;
    } catch {
      return [];
    }
  }
  
  /**
   * 删除记忆的标签记录
   */
  async deleteMemoryTags(memoryId: string): Promise<void> {
    const tags = this.memoryTags.get(memoryId);
    if (!tags) return;
    
    // 更新计数
    for (const tagName of tags) {
      const tag = this.tags.get(tagName);
      if (tag) {
        tag.count = Math.max(0, tag.count - 1);
        await this.saveTag(tag);
      }
    }
    
    this.memoryTags.delete(memoryId);
    
    const filePath = path.join(this.storageDir, `${memoryId}.json`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }
  
  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * 获取配置
   */
  getConfig(): TagConfig {
    return this.config;
  }
}
