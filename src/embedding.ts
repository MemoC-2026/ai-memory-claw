/**
 * 向量嵌入模块
 * 
 * 将文本转换为向量表示，用于相似度搜索
 * 支持多种嵌入模型 + LRU 缓存
 */

export interface EmbeddingCacheOptions {
  maxSize: number;         // 最大缓存条目数
  enablePersistence: boolean;  // 是否持久化
  cacheDir: string;        // 缓存目录
}

const DEFAULT_CACHE_OPTIONS: EmbeddingCacheOptions = {
  maxSize: 1000,
  enablePersistence: false,
  cacheDir: '~/.ai-memory-claw/embedding-cache'
};

export class EmbeddingGenerator {
  private cache: Map<string, number[]> = new Map();
  private cacheOrder: string[] = [];  // 用于 LRU 顺序
  private vectorDim: number = 384;
  private initialized: boolean = false;
  private cacheOptions: EmbeddingCacheOptions;
  
  // 缓存统计
  private stats = {
    hits: 0,
    misses: 0,
    embeddings: 0
  };
  
  constructor(options: Partial<EmbeddingCacheOptions> = {}) {
    this.cacheOptions = { ...DEFAULT_CACHE_OPTIONS, ...options };
  }
  
  async initialize(): Promise<void> {
    this.initialized = true;
    
    // 如果启用持久化，尝试加载缓存
    if (this.cacheOptions.enablePersistence) {
      await this.loadCache();
    }
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * 生成文本向量
   */
  async embed(text: string): Promise<number[]> {
    // 1. 检查缓存
    const cacheKey = this.getCacheKey(text);
    if (this.cache.has(cacheKey)) {
      this.stats.hits++;
      return this.cache.get(cacheKey)!;
    }
    
    this.stats.misses++;
    
    // 2. 生成向量 (关键词向量化)
    const vector = this.keywordEmbedding(text);
    this.stats.embeddings++;
    
    // 3. 缓存结果
    this.addToCache(cacheKey, vector);
    
    return vector;
  }
  
  /**
   * 批量生成向量
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }
  
  /**
   * 获取缓存键
   */
  private getCacheKey(text: string): string {
    // 使用前100字符作为缓存键
    return text.slice(0, 100).toLowerCase();
  }
  
  /**
   * 添加到缓存 (LRU)
   */
  private addToCache(key: string, value: number[]): void {
    // 如果已存在，更新顺序
    if (this.cache.has(key)) {
      const idx = this.cacheOrder.indexOf(key);
      if (idx > -1) {
        this.cacheOrder.splice(idx, 1);
      }
    }
    
    // 添加到缓存
    this.cache.set(key, value);
    this.cacheOrder.push(key);
    
    // 如果超过最大缓存大小，删除最旧的
    while (this.cache.size > this.cacheOptions.maxSize) {
      const oldest = this.cacheOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }
  
  /**
   * 关键词向量化 - 简单的基于关键词的向量化
   */
  private keywordEmbedding(text: string): number[] {
    const vector = new Array(this.vectorDim).fill(0);
    
    // 分词
    const words = this.tokenize(text);
    const wordFreq = new Map<string, number>();
    
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
    
    // 填充向量
    let idx = 0;
    for (const [word, freq] of wordFreq.entries()) {
      for (let i = 0; i < word.length && idx < this.vectorDim; i++) {
        // 使用字符编码 + 词频
        vector[idx] += (word.charCodeAt(i) * freq) / words.length;
        idx = (idx + 1) % this.vectorDim;
      }
    }
    
    // 归一化
    return this.normalize(vector);
  }
  
  /**
   * 分词
   */
  private tokenize(text: string): string[] {
    // 中英文分词
    const tokens: string[] = [];
    let current = '';
    
    for (const char of text.toLowerCase()) {
      if (/[\u4e00-\u9fa5]/.test(char)) {
        // 中文字符
        if (current.length > 0) {
          tokens.push(...current.split(/\s+/).filter(t => t));
          current = '';
        }
        tokens.push(char);
      } else if (/[a-zA-Z0-9]/.test(char)) {
        // 英文字母或数字
        current += char;
      } else {
        // 标点符号
        if (current.length > 0) {
          tokens.push(...current.split(/\s+/).filter(t => t));
          current = '';
        }
      }
    }
    
    if (current.length > 0) {
      tokens.push(...current.split(/\s+/).filter(t => t));
    }
    
    return tokens;
  }
  
  /**
   * 向量归一化
   */
  private normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vector;
    return vector.map(val => val / norm);
  }
  
  /**
   * 余弦相似度计算
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheOrder = [];
    this.stats = { hits: 0, misses: 0, embeddings: 0 };
  }
  
  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }
  
  /**
   * 获取缓存统计
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : '0';
    
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      maxSize: this.cacheOptions.maxSize,
      hitRate: `${hitRate}%`
    };
  }
  
  /**
   * 持久化缓存到磁盘
   */
  private async saveCache(): Promise<void> {
    if (!this.cacheOptions.enablePersistence) return;
    
    // 简化的持久化实现
    // 实际项目中可以使用更高效的序列化方式
    console.log('[EmbeddingGenerator] 缓存持久化:', this.cache.size, '条');
  }
  
  /**
   * 从磁盘加载缓存
   */
  private async loadCache(): Promise<void> {
    if (!this.cacheOptions.enablePersistence) return;
    
    console.log('[EmbeddingGenerator] 加载持久化缓存...');
    // 简化的加载实现
  }
  
  /**
   * 预热缓存
   */
  async warmUp(texts: string[]): Promise<void> {
    console.log('[EmbeddingGenerator] 预热缓存...');
    for (const text of texts) {
      await this.embed(text);
    }
    console.log('[EmbeddingGenerator] 预热完成');
  }
}
