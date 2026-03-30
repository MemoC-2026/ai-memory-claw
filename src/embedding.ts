/**
 * 向量嵌入模块
 * 
 * 将文本转换为向量表示，用于相似度搜索
 * 支持多种嵌入模型
 */

export class EmbeddingGenerator {
  private cache: Map<string, number[]> = new Map();
  private vectorDim: number = 384;
  private initialized: boolean = false;
  
  constructor() {
    // 使用简单的384维向量
  }
  
  async initialize(): Promise<void> {
    this.initialized = true;
  }
  
  isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * 生成文本向量
   */
  async embed(text: string): Promise<number[]> {
    // 1. 检查缓存
    const cacheKey = text.slice(0, 100);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // 2. 生成向量 (关键词向量化)
    const vector = this.keywordEmbedding(text);
    
    // 3. 缓存结果
    this.cache.set(cacheKey, vector);
    
    return vector;
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
  }
  
  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
