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
  fallbackToDefault: true
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
    fallbackToDefault: pluginConfig.fallbackToDefault ?? defaultMemoryConfig.fallbackToDefault
  };
}
