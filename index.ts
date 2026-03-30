/**
 * AI Memory Claw - OpenClaw 插件入口
 * 
 * AI渐进式记忆系统 - 无感运行版
 * 每次对话自动召回、自动捕获记忆
 * 支持多Agent记忆隔离
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { MemorySystem } from "./src/memory-system";
import { AutoRecall } from "./src/auto-recall";
import { AutoCapture } from "./src/auto-capture";
import { mergeWithDefaults, memoryConfigSchema, defaultMemoryConfig, resolveDataDir } from "./src/config";
import type { MemoryConfig } from "./src/config";

// 插件配置 schema (使用 config 模块)
const configSchema = memoryConfigSchema;

// 全局实例
let memorySystem: MemorySystem | null = null;
let config: MemoryConfig = defaultMemoryConfig;

const plugin = {
  id: "ai-memory-claw",
  name: "AI Memory Claw",
  description: "AI渐进式记忆系统 - 无感运行版 - 支持多Agent记忆隔离",
  configSchema,
  
  register(api: OpenClawPluginApi) {
    // 合并配置
    const pluginConfig = api.pluginConfig as Partial<MemoryConfig> || {};
    config = mergeWithDefaults(pluginConfig);
    
    // Multi-agent: 根据 agentName 解析数据目录
    const dataDir = resolveDataDir(config);
    const sharedDir = api.resolvePath(config.sharedDir);
    
    // 初始化日志欢迎
    api.logger.info("=".repeat(40));
    api.logger.info("✅ AI Memory Claw 插件已加载");
    api.logger.info(`📂 数据目录: ${dataDir}`);
    
    // Multi-agent: 显示 agent 信息
    if (config.agentName && config.agentName !== "default") {
      api.logger.info(`👤 当前Agent: ${config.agentName}`);
    }
    
    if (config.sharedEnabled) {
      api.logger.info(`🔗 共享目录: ${sharedDir}`);
    }
    
    // 初始化记忆系统
    memorySystem = new MemorySystem(dataDir, config);
    
    // 初始化并显示状态
    memorySystem.initialize().then(() => {
      const stats = memorySystem!.getStats();
      api.logger.info(`📚 当前记忆: ${stats.total} 条`);
      
      // Multi-agent: 显示共享记忆数量
      if (config.sharedEnabled) {
        const sharedMemories = memorySystem!.getSharedMemories();
        api.logger.info(`🔗 共享记忆: ${sharedMemories.length} 条`);
      }
      
      api.logger.info(`🎯 自动召回: ${config.autoRecall ? '已开启' : '已关闭'}`);
      api.logger.info(`📝 自动捕获: ${config.autoCapture ? '已开启' : '已关闭'}`);
      api.logger.info(`🗂️  存储策略: ${config.captureStrategy}`);
      api.logger.info("=".repeat(40));
    }).catch((err) => {
      api.logger.error(`❌ 初始化失败: ${err}`);
    });
    
    // 初始化自动召回
    const autoRecall = new AutoRecall(memorySystem, config);
    
    // 初始化自动捕获
    const autoCapture = new AutoCapture(memorySystem, config);
    
    // 注册 before_agent_start 钩子 (自动召回)
    if (config.autoRecall) {
      api.on("before_agent_start", async (event) => {
        try {
          return await autoRecall.execute(event);
        } catch (err) {
          api.logger.error(`自动召回失败: ${err}`);
        }
      });
    }
    
    // 注册 agent_end 钩子 (自动捕获)
    if (config.autoCapture) {
      api.on("agent_end", async (event) => {
        try {
          await autoCapture.execute(event);
        } catch (err) {
          api.logger.error(`自动捕获失败: ${err}`);
        }
      });
    }
    
    api.logger.info("AI Memory Claw 插件初始化完成");
  }
};

export default plugin;
