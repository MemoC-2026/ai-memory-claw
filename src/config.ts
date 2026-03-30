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
  integrationThreshold: Type.Optional(Type.Number())
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
  integrationThreshold: 0.8
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
    integrationThreshold: pluginConfig.integrationThreshold ?? defaultMemoryConfig.integrationThreshold
  };
}
