/**
 * Dream Consolidation - 做梦整合模块
 * 
 * Claude Code L6: 记忆巩固机制
 * 
 * 核心思想：像人脑一样，定期回顾、组织、整合长期记忆
 * 触发条件：积累 N 个会话后触发
 */

import * as fs from 'fs';
import * as path from 'path';

export interface DreamConfig {
  enabled: boolean;
  minSessionsBeforeDream: number;  // 默认 10 个会话
  dreamIntervalHours: number;     // 默认 24 小时
  lockFileDir: string;
  
  // 阶段配置
  phase1Locate: boolean;  // 标定位置
  phase2Collect: boolean; // 收集
  phase3Merge: boolean;   // 合并
  phase4Organize: boolean; // 整理
}

export interface DreamResult {
  phase: string;
  processedFiles: number;
  mergedCount: number;
  deletedCount: number;
  errors: string[];
  success: boolean;
}

export interface LockFile {
  pid: number;
  timestamp: string;
  phase: number;
}

const DEFAULT_CONFIG: DreamConfig = {
  enabled: true,
  minSessionsBeforeDream: 10,
  dreamIntervalHours: 24,
  lockFileDir: '~/.ai-memory-claw',
  phase1Locate: true,
  phase2Collect: true,
  phase3Merge: true,
  phase4Organize: true
};

export class DreamConsolidation {
  private config: DreamConfig;
  private memoryDir: string;
  private lockFileDir: string;
  private sessionCount: number = 0;
  private lastDreamTime: Date | null = null;
  
  constructor(config: Partial<DreamConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryDir = '~/.ai-memory-claw/memory';
    this.lockFileDir = this.config.lockFileDir;
  }
  
  /**
   * 初始化
   */
  async initialize(memoryDir: string): Promise<void> {
    this.memoryDir = memoryDir;
    
    // 确保目录存在
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
    
    // 检查会话数量
    await this.updateSessionCount();
    
    console.log(`[DreamConsolidation] 已初始化，会话数: ${this.sessionCount}`);
  }
  
  /**
   * 检查是否应该触发做梦（门控序列）
   * 从最便宜的检查开始，大部分情况会早早退出
   */
  async shouldDream(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }
    
    // 1. 检查会话数
    await this.updateSessionCount();
    if (this.sessionCount < this.config.minSessionsBeforeDream) {
      return false;
    }
    
    // 2. 检查时间间隔
    if (this.lastDreamTime) {
      const hoursSinceLastDream = 
        (Date.now() - this.lastDreamTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastDream < this.config.dreamIntervalHours) {
        return false;
      }
    }
    
    // 3. 检查锁文件（防止并发）
    if (await this.isLocked()) {
      return false;
    }
    
    // 4. 检查其他进程
    if (await this.isAnotherProcessRunning()) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 执行做梦整合（四阶段）
   */
  async execute(): Promise<DreamResult> {
    const errors: string[] = [];
    
    try {
      // 获取锁
      await this.acquireLock();
      
      console.log('[DreamConsolidation] 开始整合...');
      
      // 阶段1: 标定位置
      if (this.config.phase1Locate) {
        await this.phase1Locate();
      }
      
      // 阶段2: 收集
      if (this.config.phase2Collect) {
        await this.phase2Collect();
      }
      
      // 阶段3: 合并
      if (this.config.phase3Merge) {
        await this.phase3Merge();
      }
      
      // 阶段4: 整理与索引
      if (this.config.phase4Organize) {
        await this.phase4Organize();
      }
      
      this.lastDreamTime = new Date();
      
      console.log('[DreamConsolidation] 整合完成');
      
      return {
        phase: 'complete',
        processedFiles: this.sessionCount,
        mergedCount: 0,
        deletedCount: 0,
        errors,
        success: true
      };
    } catch (err) {
      errors.push(String(err));
      console.error('[DreamConsolidation] 整合失败:', err);
      
      return {
        phase: 'failed',
        processedFiles: 0,
        mergedCount: 0,
        deletedCount: 0,
        errors,
        success: false
      };
    } finally {
      // 释放锁
      await this.releaseLock();
    }
  }
  
  /**
   * 阶段1: 标定位置
   * 扫描 memory 目录，读取 MEMORY.md，避免重复
   */
  private async phase1Locate(): Promise<void> {
    console.log('[DreamConsolidation] 阶段1: 标定位置');
    
    // 读取 MEMORY.md
    const indexPath = path.join(this.memoryDir, 'MEMORY.md');
    let existingEntries: string[] = [];
    
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf-8');
      existingEntries = content.split('\n').filter(line => line.trim());
    }
    
    // 扫描各类别目录
    const categories = ['tasks', 'errors', 'preferences', 'knowledge'];
    for (const category of categories) {
      const categoryPath = path.join(this.memoryDir, category);
      if (!fs.existsSync(categoryPath)) continue;
      
      const files = fs.readdirSync(categoryPath);
      console.log(`[DreamConsolidation] 发现 ${category}: ${files.length} 个文件`);
    }
  }
  
  /**
   * 阶段2: 收集
   * 只 grep 怀疑重要的片段，检查矛盾记忆
   */
  private async phase2Collect(): Promise<void> {
    console.log('[DreamConsolidation] 阶段2: 收集');
    
    // 收集所有记忆文件
    const allMemories: { path: string; content: string }[] = [];
    const categories = ['tasks', 'errors', 'preferences', 'knowledge'];
    
    for (const category of categories) {
      const categoryPath = path.join(this.memoryDir, category);
      if (!fs.existsSync(categoryPath)) continue;
      
      const files = fs.readdirSync(categoryPath);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        try {
          const filePath = path.join(categoryPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const memory = JSON.parse(content);
          
          // 检查是否重要（高使用频率 或 高重要性）
          if (memory.usageCount > 3 || memory.importance === 'critical') {
            allMemories.push({ path: filePath, content });
          }
        } catch (err) {
          console.error(`[DreamConsolidation] 读取失败: ${file}`, err);
        }
      }
    }
    
    console.log(`[DreamConsolidation] 收集到 ${allMemories.length} 个重要记忆`);
  }
  
  /**
   * 阶段3: 合并
   * 合并新信号到现有文件，删除矛盾事实
   */
  private async phase3Merge(): Promise<void> {
    console.log('[DreamConsolidation] 阶段3: 合并');
    
    // 简单的记忆合并：按类别分组
    const grouped: Record<string, string[]> = {};
    
    // TODO: 实现更复杂的合并逻辑
    // - 检测矛盾记忆
    // - 合并相似记忆
    // - 将相对日期转为绝对日期
    
    console.log('[DreamConsolidation] 合并完成 (简化版)');
  }
  
  /**
   * 阶段4: 整理与索引
   * 更新 MEMORY.md，删除过时条目
   */
  private async phase4Organize(): Promise<void> {
    console.log('[DreamConsolidation] 阶段4: 整理与索引');
    
    // 更新 MEMORY.md 索引
    const indexPath = path.join(this.memoryDir, 'MEMORY.md');
    const lines: string[] = [];
    
    const categories = ['tasks', 'errors', 'preferences', 'knowledge'];
    
    for (const category of categories) {
      const categoryPath = path.join(this.memoryDir, category);
      if (!fs.existsSync(categoryPath)) continue;
      
      const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        try {
          const filePath = path.join(categoryPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const memory = JSON.parse(content);
          
          // 检查是否过时（90天未访问）
          const lastAccess = new Date(memory.lastAccessedAt).getTime();
          const daysSinceAccess = (Date.now() - lastAccess) / (1000 * 60 * 60 * 24);
          
          if (daysSinceAccess > 90 && memory.importance === 'low') {
            // 删除过时记忆
            fs.unlinkSync(filePath);
            console.log(`[DreamConsolidation] 删除过时记忆: ${file}`);
          } else {
            // 添加到索引
            const date = new Date(memory.createdAt).toISOString().slice(0, 10);
            lines.push(`${category}-${memory.id}: ${memory.taskDescription?.slice(0, 50)} | ${date}`);
          }
        } catch (err) {
          console.error(`[DreamConsolidation] 处理失败: ${file}`, err);
        }
      }
    }
    
    // 写入索引文件（限制 200 行或 25KB）
    const indexContent = lines.slice(0, 200).join('\n');
    fs.writeFileSync(indexPath, indexContent);
    
    console.log(`[DreamConsolidation] 索引已更新: ${lines.length} 条`);
  }
  
  /**
   * 更新会话计数
   */
  private async updateSessionCount(): Promise<void> {
    const sessionDir = path.join(this.lockFileDir, 'session-memory');
    if (!fs.existsSync(sessionDir)) {
      this.sessionCount = 0;
      return;
    }
    
    const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.md.json'));
    this.sessionCount = files.length;
  }
  
  /**
   * 检查是否已锁定
   */
  private async isLocked(): Promise<boolean> {
    const lockPath = path.join(this.lockFileDir, '.dream-lock');
    return fs.existsSync(lockPath);
  }
  
  /**
   * 检查是否有其他进程运行
   */
  private async isAnotherProcessRunning(): Promise<boolean> {
    const lockPath = path.join(this.lockFileDir, '.dream-lock');
    
    if (!fs.existsSync(lockPath)) {
      return false;
    }
    
    try {
      const content = fs.readFileSync(lockPath, 'utf-8');
      const lock: LockFile = JSON.parse(content);
      
      // 检查锁是否过期（超过 1 小时）
      const lockTime = new Date(lock.timestamp).getTime();
      const hoursSinceLock = (Date.now() - lockTime) / (1000 * 60 * 60);
      
      if (hoursSinceLock > 1) {
        // 锁已过期，删除它
        fs.unlinkSync(lockPath);
        return false;
      }
      
      // 检查进程是否还在运行
      try {
        process.kill(lock.pid, 0);
        return true; // 进程还在运行
      } catch {
        // 进程已结束，删除锁
        fs.unlinkSync(lockPath);
        return false;
      }
    } catch {
      return false;
    }
  }
  
  /**
   * 获取锁
   */
  private async acquireLock(): Promise<void> {
    const lockPath = path.join(this.lockFileDir, '.dream-lock');
    const lock: LockFile = {
      pid: process.pid,
      timestamp: new Date().toISOString(),
      phase: 0
    };
    
    fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));
  }
  
  /**
   * 释放锁
   */
  private async releaseLock(): Promise<void> {
    const lockPath = path.join(this.lockFileDir, '.dream-lock');
    
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  }
  
  /**
   * 回滚锁（方便下次重试）
   */
  async rollback(): Promise<void> {
    await this.releaseLock();
    console.log('[DreamConsolidation] 锁已回滚');
  }
  
  /**
   * 获取配置
   */
  getConfig(): DreamConfig {
    return this.config;
  }
  
  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * 获取会话数
   */
  getSessionCount(): number {
    return this.sessionCount;
  }
}
