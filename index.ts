/**
 * AI Memory Claw - OpenClaw 插件入口
 * 
 * AI渐进式记忆系统 - 无感运行版
 * 每次对话自动召回、自动捕获记忆
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { MemorySystem } from "./src/memory-system";
import { AutoRecall } from "./src/auto-recall";
import { AutoCapture } from "./src/auto-capture";
import { MemoryConfig, defaultMemoryConfig, resolveDataDir, mergeWithDefaults } from "./src/config";

// 插件配置 schema (扩展支持多Agent)
const configSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    dataDir: { type: "string" as const, default: "~/.ai-memory-claw/data" },
    autoRecall: { type: "boolean" as const, default: true },
    autoCapture: { type: "boolean" as const, default: true },
    captureStrategy: { type: "string" as const, enum: ["always", "selective"], default: "always" },
    autoRecallInNewSession: { type: "boolean" as const, default: true },
    newSessionMemoryLimit: { type: "number" as const, minimum: 1, maximum: 5, default: 1 },
    manualTriggerEnabled: { type: "boolean" as const, default: true },
    manualTriggerKeywords: { type: "array" as const, items: { type: "string" as const }, default: defaultMemoryConfig.manualTriggerKeywords },
    manualRecallLimit: { type: "number" as const, minimum: 1, maximum: 10, default: 3 },
    recallThreshold: { type: "number" as const, minimum: 0, maximum: 1, default: 0.6 },
    recallLimit: { type: "number" as const, minimum: 1, maximum: 10, default: 2 },
    captureMaxChars: { type: "number" as const, minimum: 100, maximum: 2000, default: 500 },
    enableSummary: { type: "boolean" as const, default: true },
    enableForget: { type: "boolean" as const, default: true },
    enableIntegration: { type: "boolean" as const, default: true },
    forgetIntervalDays: { type: "number" as const, minimum: 1, maximum: 30, default: 7 },
    integrationThreshold: { type: "number" as const, minimum: 0.5, maximum: 1, default: 0.8 },
    // 多Agent支持
    agentName: { type: "string" as const, default: "default" },
    sharedEnabled: { type: "boolean" as const, default: true },
    sharedDir: { type: "string" as const, default: "~/.ai-memory-claw/shared" },
    fallbackToDefault: { type: "boolean" as const, default: true }
  }
};

// 全局实例
let memorySystem: MemorySystem | null = null;
let autoRecallInstance: AutoRecall | null = null;
let config: MemoryConfig = defaultMemoryConfig;

const plugin = {
  id: "ai-memory-claw",
  name: "AI Memory Claw",
  description: "AI渐进式记忆系统 - 无感运行版 (多Agent支持)",
  configSchema,
  
  register(api: OpenClawPluginApi) {
    // 合并配置
    const pluginConfig = api.pluginConfig as Partial<MemoryConfig> || {};
    config = mergeWithDefaults(pluginConfig);
    
    // 解析数据目录（支持 {agentName} 变量）
    const agentDataDir = resolveDataDir(config.dataDir, config.agentName);
    const dataDir = api.resolvePath(agentDataDir);
    const sharedDir = api.resolvePath(resolveDataDir(config.sharedDir, config.agentName));
    
    // 初始化日志欢迎
    api.logger.info("=".repeat(40));
    api.logger.info("✅ AI Memory Claw 插件已加载");
    api.logger.info(`📂 Agent: ${config.agentName}`);
    api.logger.info(`📂 数据目录: ${dataDir}`);
    if (config.sharedEnabled) {
      api.logger.info(`📂 共享目录: ${sharedDir}`);
    }
    
    // 初始化记忆系统
    memorySystem = new MemorySystem(dataDir, config);
    
    // 初始化并显示状态
    memorySystem.initialize().then(() => {
      const stats = memorySystem!.getStats();
      api.logger.info(`📚 当前记忆: ${stats.total} 条 (私有: ${stats.private || 0}, 共享: ${stats.shared || 0})`);
      api.logger.info(`🎯 自动召回: ${config.autoRecall ? '已开启' : '已关闭'}`);
      api.logger.info(`📝 自动捕获: ${config.autoCapture ? '已开启' : '已关闭'}`);
      api.logger.info(`🗂️  存储策略: ${config.captureStrategy}`);
      api.logger.info(`🔄 新会话召回: ${config.autoRecallInNewSession ? '已开启' : '已关闭'}`);
      api.logger.info(`🔍 手动触发: ${config.manualTriggerEnabled ? '已开启' : '已关闭'}`);
      api.logger.info(`🔗 共享记忆: ${config.sharedEnabled ? '已开启' : '已关闭'}`);
      api.logger.info(`🔄 回退兼容: ${config.fallbackToDefault ? '已开启' : '已关闭'}`);
      api.logger.info("=".repeat(40));
    }).catch((err) => {
      api.logger.error(`❌ 初始化失败: ${err}`);
    });
    
    // 初始化自动召回
    autoRecallInstance = new AutoRecall(memorySystem, config);
    
    // 初始化自动捕获
    const autoCapture = new AutoCapture(memorySystem, config);
    
    // 注册 before_agent_start 钩子 (自动召回)
    if (config.autoRecall) {
      api.on("before_agent_start", async (event: any) => {
        try {
          return await autoRecallInstance!.execute(event);
        } catch (err) {
          api.logger.error(`自动召回失败: ${err}`);
        }
      });
    }
    
    // 注册 agent_end 钩子 (自动捕获)
    if (config.autoCapture) {
      api.on("agent_end", async (event: any) => {
        try {
          await autoCapture.execute(event);
        } catch (err) {
          api.logger.error(`自动捕获失败: ${err}`);
        }
      });
    }
    
    // 注册 session_start 钩子（重置召回状态）
    api.on("session_start", () => {
      if (autoRecallInstance) {
        autoRecallInstance.resetSession();
      }
      api.logger.info("[Memory] 新会话开始");
    });
    
    api.logger.info("AI Memory Claw 插件初始化完成");
  }
};

export default plugin;
