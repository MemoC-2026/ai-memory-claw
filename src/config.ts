/**
 * 配置管理模块
 * 
 * 定义插件配置类型和默认配置
 */

// 默认触发关键词
export const DEFAULT_TRIGGER_KEYWORDS = [
  "记得", "之前", "上次", "以前", "查一下", "看看之前的记忆",
  "用一下之前的", "参考之前的", "以前是怎么做的", "你还记得吗",
  "记忆里", "历史上", "之前那次"
];

// 共享记忆触发关键词
export const DEFAULT_SHARED_KEYWORDS = [
  "共享", "所有分身", "共同", "大家都要知道", "每个分身"
];

export type MemoryConfig = {
  dataDir: string;
  autoRecall: boolean;
  autoCapture: boolean;
  captureStrategy: "always" | "selective";
  autoRecallInNewSession: boolean;
  newSessionMemoryLimit: number;
  manualTriggerEnabled: boolean;
  manualTriggerKeywords: string[];
  manualRecallLimit: number;
  recallThreshold: number;
  recallLimit: number;
  captureMaxChars: number;
  enableSummary: boolean;
  enableForget: boolean;
  enableIntegration: boolean;
  forgetIntervalDays: number;
  integrationThreshold: number;
  // 多Agent支持
  agentName: string;
  sharedEnabled: boolean;
  sharedDir: string;
  fallbackToDefault: boolean;
  
  // === L3: 会话记忆 ===
  sessionMemory: {
    enabled: boolean;
    storageDir: string;
    compactionThreshold: number;
  };
  
  // === L1: 工具结果存储 ===
  toolResultStorage: {
    enabled: boolean;
    storageDir: string;
    grepThreshold: number;
    readThreshold: number;
    previewLength: number;
  };
  
  // === L2: 微压缩 ===
  microCompaction: {
    enabled: boolean;
    timeThresholdMinutes: number;
    keepRecentCount: number;
    enableCacheEdits: boolean;
    cacheMaxSize: number;
  };
  
  // === L4: 全压缩 ===
  fullCompaction: {
    enabled: boolean;
    threshold: number;
    summaryModel: string;
  };
  
  // === L6: 做梦整合 ===
  dreamConsolidation: {
    enabled: boolean;
    minSessionsBeforeDream: number;
    dreamIntervalHours: number;
  };
};

export const defaultMemoryConfig: MemoryConfig = {
  dataDir: "~/.ai-memory-claw/data",
  autoRecall: true,
  autoCapture: true,
  captureStrategy: "always",
  autoRecallInNewSession: true,
  newSessionMemoryLimit: 1,
  manualTriggerEnabled: true,
  manualTriggerKeywords: DEFAULT_TRIGGER_KEYWORDS,
  manualRecallLimit: 3,
  recallThreshold: 0.6,
  recallLimit: 2,
  captureMaxChars: 500,
  enableSummary: true,
  enableForget: true,
  enableIntegration: true,
  forgetIntervalDays: 7,
  integrationThreshold: 0.8,
  // 多Agent默认配置
  agentName: "default",
  sharedEnabled: true,
  sharedDir: "~/.ai-memory-claw/shared",
  fallbackToDefault: true,
  
  // === L3: 会话记忆 ===
  sessionMemory: {
    enabled: true,
    storageDir: "~/.ai-memory-claw/session-memory",
    compactionThreshold: 0.8
  },
  
  // === L1: 工具结果存储 ===
  toolResultStorage: {
    enabled: true,
    storageDir: "~/.ai-memory-claw/tool-results",
    grepThreshold: 10 * 1024,   // 10KB
    readThreshold: 20 * 1024,  // 20KB
    previewLength: 2 * 1024     // 2KB
  },
  
  // === L2: 微压缩 ===
  microCompaction: {
    enabled: true,
    timeThresholdMinutes: 60,
    keepRecentCount: 3,
    enableCacheEdits: true,
    cacheMaxSize: 50 * 1024
  },
  
  // === L4: 全压缩 ===
  fullCompaction: {
    enabled: true,
    threshold: -13000,
    summaryModel: "haiku"
  },
  
  // === L6: 做梦整合 ===
  dreamConsolidation: {
    enabled: true,
    minSessionsBeforeDream: 10,
    dreamIntervalHours: 24
  }
};

/**
 * 解析dataDir，支持变量替换
 */
export function resolveDataDir(baseDir: string, agentName: string): string {
  return baseDir
    .replace(/\{agentName\}/g, agentName)
    .replace(/\{agent\}/g, agentName);
}

/**
 * 检查文本是否包含共享关键词
 */
export function containsSharedKeyword(text: string, keywords: string[] = DEFAULT_SHARED_KEYWORDS): boolean {
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function mergeWithDefaults(pluginConfig: Partial<MemoryConfig>): MemoryConfig {
  return {
    dataDir: pluginConfig.dataDir || defaultMemoryConfig.dataDir,
    autoRecall: pluginConfig.autoRecall ?? defaultMemoryConfig.autoRecall,
    autoCapture: pluginConfig.autoCapture ?? defaultMemoryConfig.autoCapture,
    captureStrategy: pluginConfig.captureStrategy || defaultMemoryConfig.captureStrategy,
    autoRecallInNewSession: pluginConfig.autoRecallInNewSession ?? defaultMemoryConfig.autoRecallInNewSession,
    newSessionMemoryLimit: pluginConfig.newSessionMemoryLimit ?? defaultMemoryConfig.newSessionMemoryLimit,
    manualTriggerEnabled: pluginConfig.manualTriggerEnabled ?? defaultMemoryConfig.manualTriggerEnabled,
    manualTriggerKeywords: pluginConfig.manualTriggerKeywords || defaultMemoryConfig.manualTriggerKeywords,
    manualRecallLimit: pluginConfig.manualRecallLimit ?? defaultMemoryConfig.manualRecallLimit,
    recallThreshold: pluginConfig.recallThreshold ?? defaultMemoryConfig.recallThreshold,
    recallLimit: pluginConfig.recallLimit ?? defaultMemoryConfig.recallLimit,
    captureMaxChars: pluginConfig.captureMaxChars ?? defaultMemoryConfig.captureMaxChars,
    enableSummary: pluginConfig.enableSummary ?? defaultMemoryConfig.enableSummary,
    enableForget: pluginConfig.enableForget ?? defaultMemoryConfig.enableForget,
    enableIntegration: pluginConfig.enableIntegration ?? defaultMemoryConfig.enableIntegration,
    forgetIntervalDays: pluginConfig.forgetIntervalDays ?? defaultMemoryConfig.forgetIntervalDays,
    integrationThreshold: pluginConfig.integrationThreshold ?? defaultMemoryConfig.integrationThreshold,
    // 多Agent配置
    agentName: pluginConfig.agentName || defaultMemoryConfig.agentName,
    sharedEnabled: pluginConfig.sharedEnabled ?? defaultMemoryConfig.sharedEnabled,
    sharedDir: pluginConfig.sharedDir || defaultMemoryConfig.sharedDir,
    fallbackToDefault: pluginConfig.fallbackToDefault ?? defaultMemoryConfig.fallbackToDefault,
    
    // === L3: 会话记忆 ===
    sessionMemory: pluginConfig.sessionMemory || defaultMemoryConfig.sessionMemory,
    
    // === L1: 工具结果存储 ===
    toolResultStorage: pluginConfig.toolResultStorage || defaultMemoryConfig.toolResultStorage,
    
    // === L2: 微压缩 ===
    microCompaction: pluginConfig.microCompaction || defaultMemoryConfig.microCompaction,
    
    // === L4: 全压缩 ===
    fullCompaction: pluginConfig.fullCompaction || defaultMemoryConfig.fullCompaction,
    
    // === L6: 做梦整合 ===
    dreamConsolidation: pluginConfig.dreamConsolidation || defaultMemoryConfig.dreamConsolidation
  };
}
