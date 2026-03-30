/**
 * 类型定义模块
 * 
 * 定义记忆系统的核心数据类型
 */

import { v4 as uuidv4 } from 'uuid';

// 重要性等级
export type ImportanceLevel = 'critical' | 'high' | 'medium' | 'low';

// 记忆差异
export interface MemoryDiff {
  field: string;
  oldValue: string;
  newValue: string;
  description: string;
}

// 记忆内容
export interface MemoryContent {
  task: string;
  process: string;
  result: string;
  insights: string[];
}

// 记忆
export interface Memory {
  id: string;
  taskDescription: string;
  category: string;
  subCategory: string;
  cluster: string;
  content: MemoryContent;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  version: number;
  diffs: MemoryDiff[];
  mergedFrom: string[];
  confidence: number;
  usageCount: number;
  importance: ImportanceLevel;
  tags: string[];
  encrypted: boolean;
  encryptedContent?: string;
  autoCleanup?: boolean;
  cleanupAt?: Date;
  summary?: string;
  originalSize?: number;
  compressedSize?: number;
  // Multi-agent support
  shared?: boolean;
}

// 记忆簇
export interface MemoryCluster {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  memories: string[];
  summary: string;
  createdAt: Date;
  updatedAt: Date;
}

// 记忆分类
export interface MemoryCategory {
  id: string;
  name: string;
  description: string;
  subCategories: string[];
  keywords: string[];
  parentCategory?: string;
}

// 记忆统计
export interface MemoryStats {
  total: number;
  byCategory: Record<string, number>;
  byImportance: Record<string, number>;
  averageUsage: number;
  // Multi-agent support
  private?: number;
  shared?: number;
}

// 记忆输入
export interface MemoryInput {
  content: MemoryContent;
  category: string;
  subCategory: string;
  importance: ImportanceLevel;
  tags?: string[];
}

// 搜索选项
export interface SearchOptions {
  limit: number;
  threshold: number;
}

// 搜索结果
export interface SearchResult {
  memory: Memory;
  score: number;
}

// 记忆存储
export interface MemoryStore {
  memories: Map<string, Memory>;
  clusters: Map<string, MemoryCluster>;
  categories: Map<string, MemoryCategory>;
}

// 生成记忆ID
export function generateMemoryId(category: string, subCategory: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const time = now.toTimeString().slice(0, 5).replace(/:/g, '');
  const shortUuid = uuidv4().slice(0, 6);
  const categoryCode = category.slice(0, 2);
  const subCategoryCode = subCategory.slice(0, 2);
  return `${categoryCode}-${subCategoryCode}-${date}-${time}-${shortUuid}`;
}

// 创建记忆
export function createMemory(
  taskDescription: string,
  category: string,
  subCategory: string,
  cluster: string,
  content: MemoryContent,
  embedding: number[] = [],
  importance: ImportanceLevel = 'medium'
): Memory {
  return {
    id: generateMemoryId(category, subCategory),
    taskDescription,
    category,
    subCategory,
    cluster,
    content,
    embedding,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAccessedAt: new Date(),
    version: 1,
    diffs: [],
    mergedFrom: [],
    confidence: 0.8,
    usageCount: 0,
    importance,
    tags: [],
    encrypted: false,
    autoCleanup: false
  };
}

// 创建分类
export function createCategory(
  name: string,
  description: string,
  keywords: string[],
  parentCategory?: string
): MemoryCategory {
  return {
    id: uuidv4(),
    name,
    description,
    subCategories: [],
    keywords,
    parentCategory
  };
}

// 创建簇
export function createCluster(
  name: string,
  category: string,
  subCategory: string
): MemoryCluster {
  return {
    id: uuidv4(),
    name,
    category,
    subCategory,
    memories: [],
    summary: '',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
