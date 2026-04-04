/**
 * Error Handler - 统一错误处理模块
 * 
 * 提供统一的错误处理、重试、日志记录策略
 */

export class ErrorHandler {
  private logger: Console;
  private maxRetries: number;
  private retryDelay: number;
  
  constructor(options: { maxRetries?: number; retryDelay?: number; logger?: Console } = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.logger = options.logger || console;
  }
  
  /**
   * 带重试的异步执行
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`[${context}] 第 ${attempt} 次尝试失败: ${lastError.message}`);
        
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }
    
    // 所有重试都失败
    this.logger.error(`[${context}] 重试 ${this.maxRetries} 次后仍然失败`);
    throw lastError;
  }
  
  /**
   * 安全执行（不抛出异常）
   */
  async safeExecute<T>(
    fn: () => Promise<T>,
    defaultValue: T,
    context: string
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      this.logger.error(`[${context}] 执行失败: ${(err as Error).message}`);
      return defaultValue;
    }
  }
  
  /**
   * 记录详细错误信息
   */
  logError(context: string, error: Error, additionalInfo?: Record<string, any>): void {
    const info = {
      context,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...additionalInfo
    };
    
    this.logger.error(`[Error] ${context}:`, JSON.stringify(info, null, 2));
  }
  
  /**
   * 判断错误是否可重试
   */
  isRetryable(error: Error): boolean {
    const retryablePatterns = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'network',
      'timeout',
      'socket'
    ];
    
    const message = error.message.toLowerCase();
    return retryablePatterns.some(pattern => message.includes(pattern.toLowerCase()));
  }
  
  /**
   * 延迟辅助函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 创建默认错误处理器
 */
export function createErrorHandler(): ErrorHandler {
  return new ErrorHandler({
    maxRetries: 3,
    retryDelay: 1000
  });
}
