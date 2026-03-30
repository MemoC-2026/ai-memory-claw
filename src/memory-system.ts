/**
 * 记忆系统核心模块
 * 
 * 提供记忆的存储、搜索、管理功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { type Memory, type MemoryInput, type MemoryStats, type SearchOptions, type SearchResult, generateMemoryId } from './types';
import { type MemoryConfig } from './config';
import { EmbeddingGenerator } from './embedding';

export class MemorySystem {
  private config: MemoryConfig;
  private dataDir: string;
  private memories: Map<string, Memory> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private embeddingGenerator: EmbeddingGenerator;
  private initialized: boolean = false;
  
  // Multi-agent support
  private sharedMemories: Map<string, Memory> = new Map();
  private sharedDir: string;
  
  constructor(dataDir: string, config: MemoryConfig) {
    this.dataDir = dataDir;
    this.config = config;
    this.embeddingGenerator = new EmbeddingGenerator();
    // Resolve shared directory
    const homeDir = config.sharedDir.replace(/^~/, process.env.HOME || process.env.USERPROFILE || "~");
    this.sharedDir = homeDir;
  }
  
  /**
   * 初始化记忆系统
   */
  async initialize(): Promise<void> {
    // 确保目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    // Multi-agent: 确保共享目录存在
    if (this.config.sharedEnabled && !fs.existsSync(this.sharedDir)) {
      fs.mkdirSync(this.sharedDir, { recursive: true });
    }
    
    // 初始化向量生成器
    await this.embeddingGenerator.initialize();
    
    // 加载已有记忆
    await this.loadMemories();
    
    // Multi-agent: 加载共享记忆
    if (this.config.sharedEnabled) {
      await this.loadSharedMemories();
    }
    
    this.initialized = true;
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * 搜索记忆
   */
  async search(query: string, options: SearchOptions): Promise<Memory[]> {
    // 1. 生成查询向量
    const queryVector = await this.embeddingGenerator.embed(query);
    
    // 2. 计算相似度
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
    
    // 3. 排序
    results.sort((a, b) => b.score - a.score);
    
    // 4. 强化前N个记忆
    for (const result of results.slice(0, options.limit)) {
      await this.enhance(result.memory.id);
    }
    
    // 5. 返回结果
    return results.slice(0, options.limit).map(r => r.memory);
  }
  
  /**
   * 存储记忆
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
    await this.saveMemoryToFile(memory);
    
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
    
    await this.saveMemoryToFile(memory);
  }
  
  /**
   * 获取所有记忆
   */
  getAllMemories(): Memory[] {
    return Array.from(this.memories.values());
  }
  
  /**
   * 获取记忆统计
   */
  getStats(): MemoryStats {
    const memories = this.getAllMemories();
    
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
    return Array.from(ids).map(id => this.memories.get(id)).filter(Boolean) as Memory[];
  }
  
  /**
   * 获取记忆
   */
  getMemory(id: string): Memory | undefined {
    return this.memories.get(id);
  }
  
  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    const memory = this.memories.get(id);
    if (!memory) return false;
    
    // 从内存中删除
    this.memories.delete(id);
    this.removeFromCategoryIndex(memory);
    
    // 从文件中删除
    const filePath = this.getMemoryFilePath(memory);
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
    
    const categories = fs.readdirSync(this.dataDir);
    
    for (const category of categories) {
      const categoryPath = path.join(this.dataDir, category);
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
            
            this.memories.set(memory.id, memory);
            this.addToCategoryIndex(memory);
          } catch (e) {
            console.error(`加载记忆失败: ${file}`, e);
          }
        }
      }
    }
  }
  
  /**
   * 保存记忆到文件
   */
  private async saveMemoryToFile(memory: Memory): Promise<void> {
    const dir = path.join(this.dataDir, memory.category, memory.subCategory);
    
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
    return path.join(this.dataDir, memory.category, memory.subCategory, `${memory.id}.json`);
  }
  
  /**
   * 添加到分类索引
   */
  private addToCategoryIndex(memory: Memory): void {
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
  
  // ========== Multi-agent Shared Memory Methods ==========
  
  /**
   * 搜索私有记忆（仅当前agent）
   */
  async searchPrivate(query: string, options: SearchOptions): Promise<Memory[]> {
    const queryVector = await this.embeddingGenerator.embed(query);
    const results: SearchResult[] = [];
    
    for (const memory of this.memories.values()) {
      if (memory.embedding.length === 0) continue;
      if (memory.shared) continue; // Skip shared memories
      
      const score = this.embeddingGenerator.cosineSimilarity(
        queryVector,
        memory.embedding
      );
      
      if (score >= options.threshold) {
        results.push({ memory, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    
    for (const result of results.slice(0, options.limit)) {
      await this.enhance(result.memory.id);
    }
    
    return results.slice(0, options.limit).map(r => r.memory);
  }
  
  /**
   * 搜索共享记忆（所有agent可见）
   */
  async searchShared(query: string, options: SearchOptions): Promise<Memory[]> {
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
   * 存储共享记忆
   */
  async storeShared(input: MemoryInput): Promise<Memory> {
    const id = generateMemoryId(input.category, input.subCategory);
    
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
    
    this.sharedMemories.set(id, memory);
    await this.saveSharedMemoryToFile(memory);
    
    return memory;
  }
  
  /**
   * 加载共享记忆
   */
  private async loadSharedMemories(): Promise<void> {
    if (!fs.existsSync(this.sharedDir)) return;
    
    const categories = fs.readdirSync(this.sharedDir);
    
    for (const category of categories) {
      const categoryPath = path.join(this.sharedDir, category);
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
            memory.shared = true;
            
            this.sharedMemories.set(memory.id, memory);
          } catch (e) {
            console.error(`加载共享记忆失败: ${file}`, e);
          }
        }
      }
    }
  }
  
  /**
   * 保存共享记忆到文件
   */
  private async saveSharedMemoryToFile(memory: Memory): Promise<void> {
    const dir = path.join(this.sharedDir, memory.category, memory.subCategory);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filePath = path.join(dir, `${memory.id}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(memory, null, 2));
  }
  
  /**
   * 获取所有共享记忆
   */
  getSharedMemories(): Memory[] {
    return Array.from(this.sharedMemories.values());
  }
  
  /**
   * 获取所有记忆（包括私有和共享）
   */
  getAllMemoriesWithShared(): Memory[] {
    return [
      ...Array.from(this.memories.values()),
      ...Array.from(this.sharedMemories.values())
    ];
  }
}
