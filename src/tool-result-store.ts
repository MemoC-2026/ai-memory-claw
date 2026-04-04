/**
 * Tool Result Store - 工具结果存储模块
 * 
 * Claude Code L1: 工具结果存储
 * 
 * 核心思想：大结果（10KB+）写磁盘，上下文只放前2KB预览
 * 状态冻结机制：一旦决定用预览，后续所有API调用都用同样预览
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ToolResultConfig {
  storageDir: string;
  grepThreshold: number;      // 默认 10KB
  readThreshold: number;    // 默认 20KB
  previewLength: number;    // 默认 2KB
}

export interface ToolResultMetadata {
  toolUseId: string;
  sessionId: string;
  toolName: string;
  fullContentLength: number;
  previewLength: number;
  createdAt: Date;
  isFullContent: boolean;
}

const DEFAULT_CONFIG: ToolResultConfig = {
  storageDir: '~/.ai-memory-claw/tool-results',
  grepThreshold: 10 * 1024,   // 10KB
  readThreshold: 20 * 1024,  // 20KB
  previewLength: 2 * 1024    // 2KB
};

export class ToolResultStore {
  private config: ToolResultConfig;
  private storageDir: string;
  private initialized: boolean = false;
  
  // 状态冻结缓存：确保同一会话中预览一致性
  private frozenStates: Map<string, boolean> = new Map();
  
  constructor(config: Partial<ToolResultConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageDir = this.config.storageDir;
  }
  
  /**
   * 初始化
   */
  async initialize(storageDir: string): Promise<void> {
    this.storageDir = storageDir;
    
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    
    this.initialized = true;
    console.log('[ToolResultStore] 已初始化，存储目录:', this.storageDir);
  }
  
  /**
   * 获取工具结果（根据大小自动处理）
   * 返回: { content: string, isPreview: boolean }
   */
  async getResult(
    toolUseId: string,
    sessionId: string,
    content: string,
    toolName: string
  ): Promise<{ content: string; isPreview: boolean }> {
    const contentLength = Buffer.byteLength(content, 'utf-8');
    
    // 判断是否需要存储完整结果
    const threshold = this.getThreshold(toolName);
    
    if (contentLength <= threshold) {
      // 小结果：直接返回
      return { content, isPreview: false };
    }
    
    // 大结果：检查是否已冻结
    const cacheKey = `${sessionId}:${toolUseId}`;
    const isFrozen = this.frozenStates.get(cacheKey);
    
    if (isFrozen === true) {
      // 已冻结：返回预览
      return {
        content: this.getPreviewContent(toolName, content),
        isPreview: true
      };
    }
    
    // 第一次遇到大结果：存储并冻结
    await this.saveFullResult(toolUseId, sessionId, content, toolName);
    this.frozenStates.set(cacheKey, true);
    
    // 返回预览
    return {
      content: this.getPreviewContent(toolName, content),
      isPreview: true
    };
  }
  
  /**
   * 获取完整结果（当模型需要时）
   */
  async getFullResult(toolUseId: string, sessionId: string): Promise<string | null> {
    const filePath = this.getFullResultPath(sessionId, toolUseId);
    
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  }
  
  /**
   * 检查是否为完整内容
   */
  isFullContent(sessionId: string, toolUseId: string): boolean {
    const cacheKey = `${sessionId}:${toolUseId}`;
    // 如果状态已冻结且为true，说明用的是预览
    // 如果状态不存在或为false，说明返回的是完整内容
    return !this.frozenStates.get(cacheKey);
  }
  
  /**
   * 获取预览内容
   */
  private getPreviewContent(toolName: string, content: string): string {
    const previewLength = this.getPreviewLength(toolName);
    const truncated = content.slice(0, previewLength);
    
    return `<持久输出>
${truncated}
...[内容已截断，完整结果已保存，如需查看请使用读取工具]
</持久输出>`;
  }
  
  /**
   * 保存完整结果到磁盘
   */
  private async saveFullResult(
    toolUseId: string,
    sessionId: string,
    content: string,
    toolName: string
  ): Promise<void> {
    const sessionDir = path.join(this.storageDir, sessionId);
    
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    
    const filePath = this.getFullResultPath(sessionId, toolUseId);
    await fs.promises.writeFile(filePath, content);
    
    // 保存元数据
    const metadata: ToolResultMetadata = {
      toolUseId,
      sessionId,
      toolName,
      fullContentLength: Buffer.byteLength(content, 'utf-8'),
      previewLength: this.getPreviewLength(toolName),
      createdAt: new Date(),
      isFullContent: false
    };
    
    const metadataPath = filePath + '.meta.json';
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`[ToolResultStore] 已保存大结果: ${toolName} (${metadata.fullContentLength} bytes) → 预览: ${metadata.previewLength} bytes`);
  }
  
  /**
   * 获取完整结果文件路径
   */
  private getFullResultPath(sessionId: string, toolUseId: string): string {
    return path.join(this.storageDir, sessionId, `${toolUseId}.txt`);
  }
  
  /**
   * 获取工具的阈值
   */
  private getThreshold(toolName: string): number {
    if (toolName === 'grep' || toolName === 'glob') {
      return this.config.grepThreshold;
    }
    if (toolName === 'read' || toolName === 'document') {
      return this.config.readThreshold;
    }
    return this.config.grepThreshold;
  }
  
  /**
   * 获取工具的预览长度
   */
  private getPreviewLength(toolName: string): number {
    return this.config.previewLength;
  }
  
  /**
   * 清理会话的工具结果
   */
  async cleanupSession(sessionId: string): Promise<number> {
    const sessionDir = path.join(this.storageDir, sessionId);
    
    if (!fs.existsSync(sessionDir)) {
      return 0;
    }
    
    let deletedCount = 0;
    const files = fs.readdirSync(sessionDir);
    
    for (const file of files) {
      if (file.endsWith('.txt') || file.endsWith('.meta.json')) {
        await fs.promises.unlink(path.join(sessionDir, file));
        deletedCount++;
      }
    }
    
    // 删除空目录
    if (fs.readdirSync(sessionDir).length === 0) {
      fs.rmdirSync(sessionDir);
    }
    
    // 清理冻结状态
    for (const key of this.frozenStates.keys()) {
      if (key.startsWith(sessionId + ':')) {
        this.frozenStates.delete(key);
      }
    }
    
    console.log(`[ToolResultStore] 已清理会话 ${sessionId}，删除 ${deletedCount} 个文件`);
    return deletedCount;
  }
  
  /**
   * 获取会话的工具结果统计
   */
  async getSessionStats(sessionId: string): Promise<{ count: number; totalSize: number }> {
    const sessionDir = path.join(this.storageDir, sessionId);
    
    if (!fs.existsSync(sessionDir)) {
      return { count: 0, totalSize: 0 };
    }
    
    let count = 0;
    let totalSize = 0;
    const files = fs.readdirSync(sessionDir);
    
    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        const metaPath = path.join(sessionDir, file);
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        count++;
        totalSize += meta.fullContentLength || 0;
      }
    }
    
    return { count, totalSize };
  }
  
  /**
   * 冻结状态（用于会话恢复）
   */
  freezeState(sessionId: string, toolUseId: string): void {
    const cacheKey = `${sessionId}:${toolUseId}`;
    this.frozenStates.set(cacheKey, true);
  }
  
  /**
   * 恢复冻结状态
   */
  unfreezeState(sessionId: string, toolUseId: string): void {
    const cacheKey = `${sessionId}:${toolUseId}`;
    this.frozenStates.delete(cacheKey);
  }
  
  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.initialized;
  }
  
  /**
   * 获取配置
   */
  getConfig(): ToolResultConfig {
    return this.config;
  }
}
