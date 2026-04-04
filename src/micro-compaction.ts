/**
 * Micro Compaction - 微压缩模块
 * 
 * Claude Code L2: 轻量级上下文清理
 * 
 * 核心思想：几乎不花 API 成本，每轮 API 调用前执行
 * 
 * 三种机制：
 * 1. 基于时间：60分钟清理旧工具结果
 * 2. 缓存微型压缩：服务器端删除，本地消息不变
 * 3. API级上下文管理：让 API 处理部分清理
 */

export interface MicroCompactionConfig {
  enabled: boolean;
  timeThresholdMinutes: number;   // 默认 60 分钟
  keepRecentCount: number;       // 保留最近 N 条
  enableCacheEdits: boolean;    // 启用缓存编辑
  cacheMaxSize: number;         // 缓存最大大小 (50KB)
}

export interface CompactionResult {
  type: 'time' | 'cache' | 'api';
  removedCount: number;
  removedSize: number;
  success: boolean;
  message: string;
}

const DEFAULT_CONFIG: MicroCompactionConfig = {
  enabled: true,
  timeThresholdMinutes: 60,
  keepRecentCount: 3,
  enableCacheEdits: true,
  cacheMaxSize: 50 * 1024
};

export class MicroCompaction {
  private config: MicroCompactionConfig;
  
  // 上次清理时间
  private lastCleanupTime: Date | null = null;
  
  // 工具结果缓存
  private toolResultCache: Map<string, { content: string; timestamp: Date }> = new Map();
  
  constructor(config: Partial<MicroCompactionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 执行微压缩
   * 每轮 API 调用前调用
   */
  async execute(messages: any[]): Promise<CompactionResult | null> {
    if (!this.config.enabled) {
      return null;
    }
    
    // 1. 检查是否需要基于时间的清理
    const timeResult = await this.compactByTime();
    if (timeResult && timeResult.removedCount > 0) {
      return timeResult;
    }
    
    // 2. 检查是否需要缓存清理
    const cacheResult = await this.compactByCache();
    if (cacheResult && cacheResult.removedCount > 0) {
      return cacheResult;
    }
    
    return null;
  }
  
  /**
   * 基于时间的清理
   * 如果距离上次助手消息超过阈值（默认60分钟），清理旧工具结果
   */
  async compactByTime(): Promise<CompactionResult | null> {
    const now = new Date();
    const thresholdMs = this.config.timeThresholdMinutes * 60 * 1000;
    
    // 检查是否需要清理
    if (this.lastCleanupTime) {
      const timeSinceLastCleanup = now.getTime() - this.lastCleanupTime.getTime();
      
      if (timeSinceLastCleanup < thresholdMs) {
        return null;
      }
    }
    
    // 执行清理
    const removedCount = this.toolResultCache.size - this.config.keepRecentCount;
    
    if (removedCount <= 0) {
      this.lastCleanupTime = now;
      return null;
    }
    
    // 删除最旧的条目
    const entries = Array.from(this.toolResultCache.entries());
    entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
    
    const toRemove = entries.slice(0, removedCount);
    let removedSize = 0;
    
    for (const [key, value] of toRemove) {
      removedSize += Buffer.byteLength(value.content, 'utf-8');
      this.toolResultCache.delete(key);
    }
    
    this.lastCleanupTime = now;
    
    console.log(`[MicroCompaction] 基于时间清理: ${removedCount} 条, ${removedSize} bytes`);
    
    return {
      type: 'time',
      removedCount,
      removedSize,
      success: true,
      message: `清理了 ${removedCount} 条旧工具结果`
    };
  }
  
  /**
   * 缓存微型压缩
   * 使用 cache_edits 在服务器端删除旧工具结果，本地消息不变
   * 
   * 关键点：只运行主线，分支代理修改状态会破坏缓存
   */
  async compactByCache(): Promise<CompactionResult | null> {
    if (!this.config.enableCacheEdits) {
      return null;
    }
    
    // 计算当前缓存大小
    let currentSize = 0;
    for (const [, value] of this.toolResultCache) {
      currentSize += Buffer.byteLength(value.content, 'utf-8');
    }
    
    // 检查是否超过阈值
    if (currentSize <= this.config.cacheMaxSize) {
      return null;
    }
    
    // 删除最旧的条目直到低于阈值
    const entries = Array.from(this.toolResultCache.entries());
    entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
    
    let removedCount = 0;
    let removedSize = 0;
    
    for (const [key, value] of entries) {
      if (currentSize - removedSize <= this.config.cacheMaxSize * 0.8) {
        break;
      }
      
      removedSize += Buffer.byteLength(value.content, 'utf-8');
      this.toolResultCache.delete(key);
      removedCount++;
    }
    
    console.log(`[MicroCompaction] 缓存压缩: ${removedCount} 条, ${removedSize} bytes`);
    
    return {
      type: 'cache',
      removedCount,
      removedSize,
      success: true,
      message: `缓存压缩删除了 ${removedCount} 条工具结果`
    };
  }
  
  /**
   * 添加工具结果到缓存
   */
  addToolResult(toolUseId: string, content: string): void {
    this.toolResultCache.set(toolUseId, {
      content,
      timestamp: new Date()
    });
  }
  
  /**
   * 获取工具结果
   */
  getToolResult(toolUseId: string): string | undefined {
    return this.toolResultCache.get(toolUseId)?.content;
  }
  
  /**
   * 检查工具结果是否存在
   */
  hasToolResult(toolUseId: string): boolean {
    return this.toolResultCache.has(toolUseId);
  }
  
  /**
   * 删除工具结果
   */
  deleteToolResult(toolUseId: string): void {
    this.toolResultCache.delete(toolUseId);
  }
  
  /**
   * 清空缓存
   */
  clearCache(): void {
    this.toolResultCache.clear();
    this.lastCleanupTime = null;
  }
  
  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    let size = 0;
    for (const [, value] of this.toolResultCache) {
      size += Buffer.byteLength(value.content, 'utf-8');
    }
    return size;
  }
  
  /**
   * 获取缓存条目数
   */
  getCacheCount(): number {
    return this.toolResultCache.size;
  }
  
  /**
   * 获取配置
   */
  getConfig(): MicroCompactionConfig {
    return this.config;
  }
  
  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * 手动触发清理
   */
  async forceCompact(): Promise<CompactionResult> {
    this.lastCleanupTime = null;
    return await this.compactByCache() || {
      type: 'cache',
      removedCount: 0,
      removedSize: 0,
      success: true,
      message: '无需要清理的内容'
    };
  }
}
