/**
 * 配置管理模块
 * 
 * 定义插件配置类型和默认配置
 */

import { Type } from "@sinclair/typebox";

export const memoryConfigSchema = Type.Object({
  dataDir: Type.Optional(Type.String()),
  autoRecall: Type.Optional(Type.Boolean()),
  autoCapture: Type.Optional(Type.Boolean()),
  captureStrategy: Type.Optional(Type.Union([
    Type.Literal("always"),
    Type.Literal("selective")
  ])),
  recallThreshold: Type.Optional(Type.Number()),
  recallLimit: Type.Optional(Type.Number()),
  captureMaxChars: Type.Optional(Type.Number()),
  enableSummary: Type.Optional(Type.Boolean()),
  enableForget: Type.Optional(Type.Boolean()),
  enableIntegration: Type.Optional(Type.Boolean()),
  forgetIntervalDays: Type.Optional(Type.Number()),
  integrationThreshold: Type.Optional(Type.Number()),
  // Multi-agent support
  agentName: Type.Optional(Type.String()),
  sharedEnabled: Type.Optional(Type.Boolean()),
  sharedDir: Type.Optional(Type.String()),
  fallbackToDefault: Type.Optional(Type.Boolean())
});

export type MemoryConfig = {
  dataDir: string;
  autoRecall: boolean;
  autoCapture: boolean;
  captureStrategy: "always" | "selective";
  recallThreshold: number;
  recallLimit: number;
  captureMaxChars: number;
  enableSummary: boolean;
  enableForget: boolean;
  enableIntegration: boolean;
  forgetIntervalDays: number;
  integrationThreshold: number;
  // Multi-agent support
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
  recallThreshold: 0.3,
  recallLimit: 3,
  captureMaxChars: 500,
  enableSummary: true,
  enableForget: true,
  enableIntegration: true,
  forgetIntervalDays: 7,
  integrationThreshold: 0.8,
  // Multi-agent support defaults
  agentName: "default",
  sharedEnabled: true,
  sharedDir: "~/.ai-memory-claw/shared",
  fallbackToDefault: true
};

export function mergeWithDefaults(pluginConfig: Partial<MemoryConfig>): MemoryConfig {
  return {
    dataDir: pluginConfig.dataDir || defaultMemoryConfig.dataDir,
    autoRecall: pluginConfig.autoRecall ?? defaultMemoryConfig.autoRecall,
    autoCapture: pluginConfig.autoCapture ?? defaultMemoryConfig.autoCapture,
    captureStrategy: pluginConfig.captureStrategy || defaultMemoryConfig.captureStrategy,
    recallThreshold: pluginConfig.recallThreshold ?? defaultMemoryConfig.recallThreshold,
    recallLimit: pluginConfig.recallLimit ?? defaultMemoryConfig.recallLimit,
    captureMaxChars: pluginConfig.captureMaxChars ?? defaultMemoryConfig.captureMaxChars,
    enableSummary: pluginConfig.enableSummary ?? defaultMemoryConfig.enableSummary,
    enableForget: pluginConfig.enableForget ?? defaultMemoryConfig.enableForget,
    enableIntegration: pluginConfig.enableIntegration ?? defaultMemoryConfig.enableIntegration,
    forgetIntervalDays: pluginConfig.forgetIntervalDays ?? defaultMemoryConfig.forgetIntervalDays,
    integrationThreshold: pluginConfig.integrationThreshold ?? defaultMemoryConfig.integrationThreshold,
    agentName: pluginConfig.agentName || defaultMemoryConfig.agentName,
    sharedEnabled: pluginConfig.sharedEnabled ?? defaultMemoryConfig.sharedEnabled,
    sharedDir: pluginConfig.sharedDir || defaultMemoryConfig.sharedDir,
    fallbackToDefault: pluginConfig.fallbackToDefault ?? defaultMemoryConfig.fallbackToDefault
  };
}

// Default keywords that mark memories as shared across all agents
export const DEFAULT_SHARED_KEYWORDS = [
  "共享",
  "所有分身",
  "共同",
  "大家都要知道",
  "每个分身"
];

/**
 * Resolve data directory based on agent name
 * For multi-agent: ~/.ai-memory-claw/agents/{agentName}/
 * For legacy single-user: ~/.ai-memory-claw/data/
 */
export function resolveDataDir(config: MemoryConfig): string {
  const homeDir = config.dataDir.replace(/^~/, process.env.HOME || process.env.USERPROFILE || "~");
  
  // If agentName is set and fallbackToDefault is true, use agent directory
  if (config.agentName && config.agentName !== "default" && config.fallbackToDefault) {
    return `${homeDir}/agents/${config.agentName}`;
  }
  
  // Legacy path for backward compatibility
  return homeDir;
}

/**
 * Check if text contains shared keyword
 */
export function containsSharedKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  return DEFAULT_SHARED_KEYWORDS.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
}
