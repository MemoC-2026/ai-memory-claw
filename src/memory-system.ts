/**
 * 记忆系统核心模块
 * 
 * 提供记忆的存储、搜索，管理功能
 * 支持多Agent隔离和共享记忆
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { type Memory, type MemoryInput, type MemoryStats, type SearchOptions, type SearchResult, generateMemoryId } from './types';
import { type MemoryConfig, resolveDataDir } from './config';
import { EmbeddingGenerator } from './embedding';

export class MemorySystem {
  private config: MemoryConfig;
  private dataDir: string;
  private sharedDir: string;
  private memories: Map<string, Memory> = new Map();
  private sharedMemories: Map<string, Memory> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private embeddingGenerator: EmbeddingGenerator;
  private initialized: boolean = false;
  
  constructor(dataDir: string, config: MemoryConfig) {
    this.dataDir = dataDir;
    this.sharedDir = resolveDataDir(config.sharedDir, config.agentName);
    this.config = config;
    this.embeddingGenerator = new EmbeddingGenerator();
  }
  
  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<void> {
    // 确保目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // 确保共享目录存在
    if (this.config.sharedEnabled && !fs.existsSync(this.sharedDir)) {
      fs.mkdirSync(this.sharedDir, { recursive: true });
    }
    
    // 初始化向量生成器
    await this.embeddingGenerator.initialize();
    
    // 加载已有记忆
    await this.loadMemories();
    
    // 如果启用共享，加载共享记忆
    if (this.config.sharedEnabled) {
      await this.loadSharedMemories();
    }
    
    // 如果启用回退，加载默认目录的记忆
    if (this.config.fallbackToDefault) {
      await this.loadFallbackMemories();
    }
    
    this.initialized = true;
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * 获取数据目录
   */
  getDataDir(): string {
    return this.dataDir;
  }
  
  /**
   * 获取共享目录
   */
  getSharedDir(): string {
    return this.sharedDir;
  }
  
  /**
   * 搜索记忆（包含私有+共享）
   */
  async search(query: string, options: SearchOptions): Promise<Memory[]> {
    // 1. 生成查询向量
    const queryVector = await this.embeddingGenerator.embed(query);
    
    // 2. 计算所有记忆的相似度
    const allMemories = new Map([...this.memories, ...this.sharedMemories]);
    const results: SearchResult[] = [];
    
    for (const memory of allMemories.values()) {
      if (memory.embedding.length === 0) continue;
      
      const score = this.embeddingGenerator.cosineSimilarity(
        queryVector,
        memory.embedding
      );
      
      if (score >= options.threshold) {
        results.push({ memory, score });
      }
    }
    
    // 3. 排序
    results.sort((a, b) => b.score - a.score);
    
    // 4. 强化前N个记忆
    for (const result of results.slice(0, options.limit)) {
      // 只强化私有记忆
      if (this.memories.has(result.memory.id)) {
        await this.enhance(result.memory.id);
      }
    }
    
    // 5. 返回结果
    return results.slice(0, options.limit).map(r => r.memory);
  }
  
  /**
   * 搜索私有记忆（仅Agent私有）
   */
  async searchPrivate(query: string, options: SearchOptions): Promise<Memory[]> {
    const queryVector = await this.embeddingGenerator.embed(query);
    const results: SearchResult[] = [];
    
    for (const memory of this.memories.values()) {
      if (memory.embedding.length === 0) continue;
      
      const score = this.embeddingGenerator.cosineSimilarity(
        queryVector,
        memory.embedding
      );
      
      if (score >= options.threshold) {
        results.push({ memory, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    
    // 强化
    for (const result of results.slice(0, options.limit)) {
      await this.enhance(result.memory.id);
    }
    
    return results.slice(0, options.limit).map(r => r.memory);
  }
  
  /**
   * 搜索共享记忆
   */
  async searchShared(query: string, options: SearchOptions): Promise<Memory[]> {
    if (!this.config.sharedEnabled) return [];
    
    const queryVector = await this.embeddingGenerator.embed(query);
    const results: SearchResult[] = [];
    
    for (const memory of this.sharedMemories.values()) {
      if (memory.embedding.length === 0) continue;
      
      const score = this.embeddingGenerator.cosineSimilarity(
        queryVector,
        memory.embedding
      );
      
      if (score >= options.threshold) {
        results.push({ memory, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, options.limit).map(r => r.memory);
  }
  
  /**
   * 存储记忆（私有）
   */
  async store(input: MemoryInput): Promise<Memory> {
    const id = generateMemoryId(input.category, input.subCategory);
    
    // 生成向量
    const text = `${input.content.task} ${input.content.process}`;
    const embedding = await this.embeddingGenerator.embed(text);
    
    const memory: Memory = {
      id,
      taskDescription: input.content.task,
      category: input.category,
      subCategory: input.subCategory,
      cluster: `${input.subCategory}-cluster`,
      content: input.content,
      embedding,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
      version: 1,
      diffs: [],
      mergedFrom: [],
      confidence: 0.8,
      usageCount: 0,
      importance: input.importance,
      tags: input.tags || [],
      encrypted: false,
      autoCleanup: false
    };
    
    // 保存到内存
    this.memories.set(id, memory);
    this.addToCategoryIndex(memory);
    
    // 保存到文件
    await this.saveMemoryToFile(memory, this.dataDir);
    
    return memory;
  }
  
  /**
   * 存储共享记忆
   */
  async storeShared(input: MemoryInput): Promise<Memory> {
    if (!this.config.sharedEnabled) {
      throw new Error('共享记忆未启用');
    }
    
    const id = generateMemoryId(input.category, input.subCategory);
    
    // 生成向量
    const text = `${input.content.task} ${input.content.process}`;
    const embedding = await this.embeddingGenerator.embed(text);
    
    const memory: Memory = {
      id,
      taskDescription: input.content.task,
      category: input.category,
      subCategory: input.subCategory,
      cluster: `${input.subCategory}-cluster`,
      content: input.content,
      embedding,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
      version: 1,
      diffs: [],
      mergedFrom: [],
      confidence: 0.8,
      usageCount: 0,
      importance: input.importance,
      tags: input.tags || [],
      encrypted: false,
      autoCleanup: false,
      shared: true
    };
    
    // 保存到共享内存
    this.sharedMemories.set(id, memory);
    this.addToCategoryIndex(memory);
    
    // 保存到共享目录
    await this.saveMemoryToFile(memory, this.sharedDir);
    
    return memory;
  }
  
  /**
   * 强化记忆
   */
  async enhance(memoryId: string): Promise<void> {
    const memory = this.memories.get(memoryId);
    if (!memory) return;
    
    memory.usageCount++;
    memory.lastAccessedAt = new Date();
    memory.updatedAt = new Date();
    
    // 提升重要性
    if (memory.importance !== 'critical') {
      const levels: ('low' | 'medium' | 'high' | 'critical')[] = 
        ['low', 'medium', 'high', 'critical'];
      const idx = levels.indexOf(memory.importance);
      if (idx < levels.length - 1 && memory.usageCount > 3) {
        memory.importance = levels[idx + 1];
      }
    }
    
    // 保存
    if (memory.shared) {
      await this.saveMemoryToFile(memory, this.sharedDir);
    } else {
      await this.saveMemoryToFile(memory, this.dataDir);
    }
  }
  
  /**
   * 获取所有记忆
   */
  getAllMemories(): Memory[] {
    return Array.from(this.memories.values());
  }
  
  /**
   * 获取所有记忆（包括共享）
   */
  getAllMemoriesWithShared(): Memory[] {
    return [...Array.from(this.memories.values()), ...Array.from(this.sharedMemories.values())];
  }
  
  /**
   * 获取共享记忆
   */
  getSharedMemories(): Memory[] {
    return Array.from(this.sharedMemories.values());
  }
  
  /**
   * 获取记忆统计
   */
  getStats(): MemoryStats {
    const memories = this.getAllMemoriesWithShared();
    
    const byCategory: Record<string, number> = {};
    const byImportance: Record<string, number> = {};
    let totalUsage = 0;
    
    for (const m of memories) {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
      byImportance[m.importance] = (byImportance[m.importance] || 0) + 1;
      totalUsage += m.usageCount;
    }
    
    return {
      total: memories.length,
      private: this.memories.size,
      shared: this.sharedMemories.size,
      byCategory,
      byImportance,
      averageUsage: memories.length > 0 ? totalUsage / memories.length : 0
    };
  }
  
  /**
   * 按类别获取记忆
   */
  getMemoriesByCategory(category: string): Memory[] {
    const ids = this.categoryIndex.get(category);
    if (!ids) return [];
    return Array.from(ids).map(id => this.memories.get(id) || this.sharedMemories.get(id)).filter(Boolean) as Memory[];
  }
  
  /**
   * 获取记忆
   */
  getMemory(id: string): Memory | undefined {
    return this.memories.get(id) || this.sharedMemories.get(id);
  }
  
  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    const memory = this.memories.get(id) || this.sharedMemories.get(id);
    if (!memory) return false;
    
    // 从内存中删除
    if (this.memories.has(id)) {
      this.memories.delete(id);
    } else {
      this.sharedMemories.delete(id);
    }
    this.removeFromCategoryIndex(memory);
    
    // 从文件中删除
    const dir = memory.shared ? this.sharedDir : this.dataDir;
    const filePath = path.join(dir, memory.category, memory.subCategory, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    return true;
  }
  
  /**
   * 加载记忆到内存
   */
  private async loadMemories(): Promise<void> {
    if (!fs.existsSync(this.dataDir)) return;
    await this.loadFromDirectory(this.dataDir, false);
  }
  
  /**
   * 加载共享记忆
   */
  private async loadSharedMemories(): Promise<void> {
    if (!fs.existsSync(this.sharedDir)) return;
    await this.loadFromDirectory(this.sharedDir, true);
  }
  
  /**
   * 加载回退目录的记忆（旧版本兼容）
   */
  private async loadFallbackMemories(): Promise<void> {
    // 检查旧目录结构 ~/.ai-memory-claw/data/
    const legacyDir = path.join(path.dirname(this.dataDir), 'data');
    if (!fs.existsSync(legacyDir) || legacyDir === this.dataDir) return;
    
    console.log('[MemorySystem] 检测到旧版本记忆目录，尝试加载...');
    await this.loadFromDirectory(legacyDir, false, true);
  }
  
  /**
   * 从目录加载记忆
   */
  private async loadFromDirectory(dir: string, isShared: boolean, isLegacy: boolean = false): Promise<void> {
    try {
      if (!fs.existsSync(dir)) return;
      
      const categories = fs.readdirSync(dir);
      
      for (const category of categories) {
        const categoryPath = path.join(dir, category);
        if (!fs.statSync(categoryPath).isDirectory()) continue;
        
        const subCategories = fs.readdirSync(categoryPath);
        
        for (const subCategory of subCategories) {
          const subCategoryPath = path.join(categoryPath, subCategory);
          if (!fs.statSync(subCategoryPath).isDirectory()) continue;
          
          const files = fs.readdirSync(subCategoryPath);
          
          for (const file of files) {
            if (!file.endsWith('.json') || file === 'index.json') continue;
            
            try {
              const content = fs.readFileSync(
                path.join(subCategoryPath, file),
                'utf-8'
              );
              const memory = JSON.parse(content) as Memory;
              memory.createdAt = new Date(memory.createdAt);
              memory.updatedAt = new Date(memory.updatedAt);
              memory.lastAccessedAt = new Date(memory.lastAccessedAt);
              memory.shared = isShared;
              
              if (isShared) {
                this.sharedMemories.set(memory.id, memory);
              } else {
                this.memories.set(memory.id, memory);
              }
              this.addToCategoryIndex(memory);
            } catch (e) {
              console.error(`加载记忆失败: ${file}`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error(`加载目录失败: ${dir}`, e);
    }
  }
  
  /**
   * 保存记忆到文件
   */
  private async saveMemoryToFile(memory: Memory, baseDir: string): Promise<void> {
    const dir = path.join(baseDir, memory.category, memory.subCategory);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filePath = path.join(dir, `${memory.id}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(memory, null, 2));
  }
  
  /**
   * 获取记忆文件路径
   */
  private getMemoryFilePath(memory: Memory): string {
    const dir = memory.shared ? this.sharedDir : this.dataDir;
    return path.join(dir, memory.category, memory.subCategory, `${memory.id}.json`);
  }
  
  /**
   * 添加到分类索引
   */
  private addToCategoryIndex(memory: Memory): void {
    const map = memory.shared ? this.sharedMemories : this.memories;
    if (!this.categoryIndex.has(memory.category)) {
      this.categoryIndex.set(memory.category, new Set());
    }
    this.categoryIndex.get(memory.category)!.add(memory.id);
  }
  
  /**
   * 从分类索引中移除
   */
  private removeFromCategoryIndex(memory: Memory): void {
    const set = this.categoryIndex.get(memory.category);
    if (set) {
      set.delete(memory.id);
      if (set.size === 0) {
        this.categoryIndex.delete(memory.category);
      }
    }
  }
}
