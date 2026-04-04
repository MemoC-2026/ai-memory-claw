/**
 * Session Memory - 会话记忆模块
 * 
 * Claude Code L3: 实时维护结构化笔记，零API成本压缩
 * 
 * 核心思想：不是等上下文满了再慌张总结，而是实时维护结构化笔记
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface SessionMemoryData {
  sessionId: string;
  createdAt: Date;
  projectSlug: string;
  initialTask: string;
  currentStatus: 'active' | 'completed' | 'failed';
  decisions: string[];
  completedSteps: string[];
  todo: string[];
  importantContext: string[];
  summary: string;
  lastSummarizedMessageId?: string;
  updatedAt: Date;
}

export interface SessionMemoryConfig {
  enabled: boolean;
  storageDir: string;
  compactionThreshold: number;
}

export interface CompactionResult {
  summary: string;
  keptMessageCount: number;
  removedCount: number;
  success: boolean;
}

const DEFAULT_CONFIG: SessionMemoryConfig = {
  enabled: true,
  storageDir: '~/.ai-memory-claw/session-memory',
  compactionThreshold: 0.8
};

export class SessionMemory {
  private config: SessionMemoryConfig;
  private storageDir: string;
  private currentSession: SessionMemoryData | null = null;
  private currentSessionId: string | null = null;
  private initialized: boolean = false;
  
  // 内存缓存：避免每次都读文件
  private sessionCache: Map<string, SessionMemoryData> = new Map();
  
  constructor(config: Partial<SessionMemoryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageDir = this.config.storageDir;
  }
  
  /**
   * 初始化
   */
  async initialize(storageDir: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    this.storageDir = storageDir;
    
    // 确保目录存在
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    
    this.initialized = true;
    console.log('[SessionMemory] 已初始化，存储目录:', this.storageDir);
  }
  
  /**
   * 创建新会话
   */
  async createSession(sessionId: string, projectSlug: string = 'default', initialTask: string = ''): Promise<SessionMemoryData> {
    if (!this.config.enabled) {
      throw new Error('SessionMemory 未启用');
    }
    
    const sessionData: SessionMemoryData = {
      sessionId,
      createdAt: new Date(),
      projectSlug,
      initialTask,
      currentStatus: 'active',
      decisions: [],
      completedSteps: [],
      todo: [],
      importantContext: [],
      summary: '',
      updatedAt: new Date()
    };
    
    // 保存到内存
    this.currentSession = sessionData;
    this.currentSessionId = sessionId;
    this.sessionCache.set(sessionId, sessionData);
    
    // 保存到文件
    await this.saveToFile(sessionData);
    
    console.log('[SessionMemory] 新会话已创建:', sessionId);
    return sessionData;
  }
  
  /**
   * 加载会话
   */
  async loadSession(sessionId: string): Promise<SessionMemoryData | null> {
    if (!this.config.enabled) {
      return null;
    }
    
    // 检查内存缓存
    if (this.sessionCache.has(sessionId)) {
      this.currentSession = this.sessionCache.get(sessionId)!;
      this.currentSessionId = sessionId;
      return this.currentSession;
    }
    
    // 从文件加载
    const filePath = this.getFilePath(sessionId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const sessionData = JSON.parse(content) as SessionMemoryData;
      sessionData.createdAt = new Date(sessionData.createdAt);
      sessionData.updatedAt = new Date(sessionData.updatedAt);
      
      this.currentSession = sessionData;
      this.currentSessionId = sessionId;
      this.sessionCache.set(sessionId, sessionData);
      
      return sessionData;
    } catch (err) {
      console.error('[SessionMemory] 加载会话失败:', err);
      return null;
    }
  }
  
  /**
   * 获取当前会话
   */
  getCurrent(): SessionMemoryData | null {
    return this.currentSession;
  }
  
  /**
   * 获取会话摘要（用于注入上下文）
   */
  getSummary(): string {
    if (!this.currentSession) {
      return '';
    }
    
    const s = this.currentSession;
    const parts: string[] = [];
    
    if (s.initialTask) {
      parts.push(`📋 初始任务: ${s.initialTask}`);
    }
    
    if (s.decisions.length > 0) {
      parts.push(`💡 关键决策:\n${s.decisions.map(d => `- ${d}`).join('\n')}`);
    }
    
    if (s.completedSteps.length > 0) {
      parts.push(`✅ 已完成:\n${s.completedSteps.map(step => `- ${step}`).join('\n')}`);
    }
    
    if (s.todo.length > 0) {
      parts.push(`📝 待办:\n${s.todo.map(t => `- ${t}`).join('\n')}`);
    }
    
    if (s.importantContext.length > 0) {
      parts.push(`🎯 重要上下文:\n${s.importantContext.map(c => `- ${c}`).join('\n')}`);
    }
    
    if (s.summary) {
      parts.push(`📄 摘要: ${s.summary}`);
    }
    
    if (parts.length === 0) {
      return '';
    }
    
    return `<session-memory>\n${parts.join('\n\n')}\n</session-memory>`;
  }
  
  /**
   * 获取压缩后的提示（零API成本）
   */
  async getCompressedPrompt(): Promise<string> {
    return this.getSummary();
  }
  
  /**
   * 更新会话信息
   */
  async update(updates: Partial<SessionMemoryData>): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    Object.assign(this.currentSession, updates, { updatedAt: new Date() });
    this.sessionCache.set(this.currentSessionId!, this.currentSession);
    await this.saveToFile(this.currentSession);
  }
  
  /**
   * 添加决策
   */
  async addDecision(decision: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    this.currentSession.decisions.push(`[${new Date().toLocaleTimeString()}] ${decision}`);
    this.currentSession.updatedAt = new Date();
    this.sessionCache.set(this.currentSessionId!, this.currentSession);
    await this.saveToFile(this.currentSession);
  }
  
  /**
   * 添加完成步骤
   */
  async addCompletedStep(step: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    this.currentSession.completedSteps.push(step);
    this.currentSession.updatedAt = new Date();
    this.sessionCache.set(this.currentSessionId!, this.currentSession);
    await this.saveToFile(this.currentSession);
  }
  
  /**
   * 添加待办
   */
  async addTodo(todo: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    this.currentSession.todo.push(todo);
    this.currentSession.updatedAt = new Date();
    this.sessionCache.set(this.currentSessionId!, this.currentSession);
    await this.saveToFile(this.currentSession);
  }
  
  /**
   * 标记待办完成
   */
  async completeTodo(todo: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    const idx = this.currentSession.todo.indexOf(todo);
    if (idx > -1) {
      this.currentSession.todo.splice(idx, 1);
      this.currentSession.completedSteps.push(todo);
    }
    
    this.currentSession.updatedAt = new Date();
    this.sessionCache.set(this.currentSessionId!, this.currentSession);
    await this.saveToFile(this.currentSession);
  }
  
  /**
   * 添加重要上下文
   */
  async addContext(context: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    if (!this.currentSession.importantContext.includes(context)) {
      this.currentSession.importantContext.push(context);
    }
    
    this.currentSession.updatedAt = new Date();
    this.sessionCache.set(this.currentSessionId!, this.currentSession);
    await this.saveToFile(this.currentSession);
  }
  
  /**
   * 更新摘要（由 L4 全压缩调用）
   */
  async updateSummary(summary: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    this.currentSession.summary = summary;
    this.currentSession.updatedAt = new Date();
    this.sessionCache.set(this.currentSessionId!, this.currentSession);
    await this.saveToFile(this.currentSession);
  }
  
  /**
   * 更新任务状态
   */
  async updateStatus(status: 'active' | 'completed' | 'failed'): Promise<void> {
    if (!this.currentSession) {
      return;
    }
    
    this.currentSession.currentStatus = status;
    this.currentSession.updatedAt = new Date();
    this.sessionCache.set(this.currentSessionId!, this.currentSession);
    await this.saveToFile(this.currentSession);
  }
  
  /**
   * 尝试会话级压缩（零API成本）
   * 
   * 这是 SessionMemory 的核心价值：无需调用 API，直接用现成摘要
   */
  async trySessionMemoryCompaction(
    messages: any[],
    keepRecentCount: number = 5
  ): Promise<CompactionResult | null> {
    if (!this.currentSession) {
      return null;
    }
    
    const totalMessages = messages.length;
    
    // 只保留最近 N 条消息，其余用摘要替代
    const keptMessages = messages.slice(-keepRecentCount);
    const removedCount = Math.max(0, totalMessages - keepRecentCount);
    
    if (removedCount === 0) {
      return null;
    }
    
    // 生成压缩摘要
    const summary = this.generateCompactionSummary(messages, keptMessages);
    
    // 更新会话摘要
    await this.updateSummary(summary);
    
    console.log(`[SessionMemory] 会话压缩: ${totalMessages} → ${keepRecentCount} 条，摘要长度: ${summary.length}`);
    
    return {
      summary,
      keptMessageCount: keptMessages.length,
      removedCount,
      success: true
    };
  }
  
  /**
   * 生成压缩摘要
   */
  private generateCompactionSummary(messages: any[], keptMessages: any[]): string {
    const parts: string[] = [];
    
    // 提取用户请求
    const userMessages = messages.filter((m: any) => m.role === 'user');
    if (userMessages.length > 0) {
      const lastUserMsg = userMessages[userMessages.length - 1];
      const content = typeof lastUserMsg.content === 'string' 
        ? lastUserMsg.content 
        : lastUserMsg.content?.[0]?.text || '';
      parts.push(`用户请求: ${content.slice(0, 200)}`);
    }
    
    // 统计信息
    parts.push(`对话轮数: ${messages.length}`);
    parts.push(`决策数: ${this.currentSession?.decisions.length || 0}`);
    parts.push(`完成步骤: ${this.currentSession?.completedSteps.length || 0}`);
    
    // 当前状态
    if (this.currentSession?.currentStatus === 'active') {
      parts.push('状态: 进行中');
    }
    
    return parts.join(' | ');
  }
  
  /**
   * 获取文件路径
   */
  private getFilePath(sessionId: string): string {
    return path.join(this.storageDir, `${sessionId}.md.json`);
  }
  
  /**
   * 保存到文件
   */
  private async saveToFile(sessionData: SessionMemoryData): Promise<void> {
    const filePath = this.getFilePath(sessionData.sessionId);
    await fs.promises.writeFile(filePath, JSON.stringify(sessionData, null, 2));
  }
  
  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<void> {
    const filePath = this.getFilePath(sessionId);
    
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
    
    this.sessionCache.delete(sessionId);
    
    if (this.currentSessionId === sessionId) {
      this.currentSession = null;
      this.currentSessionId = null;
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
  getConfig(): SessionMemoryConfig {
    return this.config;
  }
}
