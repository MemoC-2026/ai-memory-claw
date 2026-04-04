/**
 * AI Memory Claw - OpenClaw 插件入口
 * 
 * AI渐进式记忆系统 - 无感运行版 v2.0
 * 基于 Claude Code 7层记忆架构
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { MemorySystem } from "./src/memory-system";
import { AutoRecall } from "./src/auto-recall";
import { AutoCapture } from "./src/auto-capture";
import { SessionMemory } from "./src/session-memory";
import { ToolResultStore } from "./src/tool-result-store";
import { MicroCompaction } from "./src/micro-compaction";
import { DreamConsolidation } from "./src/dream-consolidation";
import { ErrorHandler } from "./src/error-handler";
import { ConfigValidator } from "./src/config-validator";
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
let sessionMemory: SessionMemory | null = null;
let toolResultStore: ToolResultStore | null = null;
let microCompaction: MicroCompaction | null = null;
let dreamConsolidation: DreamConsolidation | null = null;
let errorHandler: ErrorHandler | null = null;
let config: MemoryConfig = defaultMemoryConfig;

const plugin = {
  id: "ai-memory-claw",
  name: "AI Memory Claw",
  description: "AI渐进式记忆系统 - 无感运行版 (多Agent支持)",
  configSchema,
  
  async register(api: OpenClawPluginApi) {
    // 合并配置
    const pluginConfig = api.pluginConfig as Partial<MemoryConfig> || {};
    config = mergeWithDefaults(pluginConfig);
    
    // === 配置校验 ===
    try {
      config = ConfigValidator.validateAndMerge(pluginConfig);
    } catch (err) {
      api.logger.error(`❌ 配置校验失败: ${(err as Error).message}`);
      return;
    }
    
    // 初始化错误处理器
    errorHandler = new ErrorHandler({
      maxRetries: 3,
      logger: api.logger
    });
    
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
    
    // === L3: 初始化会话记忆 ===
    sessionMemory = new SessionMemory(config.sessionMemory);
    const sessionMemoryDir = api.resolvePath(config.sessionMemory.storageDir);
    await sessionMemory.initialize(sessionMemoryDir);
    api.logger.info(`📝 会话记忆: ${config.sessionMemory.enabled ? '已开启' : '已关闭'}`);
    
    // === L1: 初始化工具结果存储 ===
    toolResultStore = new ToolResultStore(config.toolResultStorage);
    const toolResultDir = api.resolvePath(config.toolResultStorage.storageDir);
    await toolResultStore.initialize(toolResultDir);
    api.logger.info(`💾 工具结果存储: ${config.toolResultStorage.enabled ? '已开启' : '已关闭'}`);
    
    // === L2: 初始化微压缩 ===
    microCompaction = new MicroCompaction(config.microCompaction);
    api.logger.info(`🔧 微压缩: ${config.microCompaction.enabled ? '已开启' : '已关闭'}`);
    
    // === L6: 初始化做梦整合 ===
    dreamConsolidation = new DreamConsolidation(config.dreamConsolidation);
    const memoryDir = api.resolvePath('~/.ai-memory-claw/memory');
    await dreamConsolidation.initialize(memoryDir);
    api.logger.info(`🌙 做梦整合: ${config.dreamConsolidation.enabled ? '已开启' : '已关闭'} (会话阈值: ${config.dreamConsolidation.minSessionsBeforeDream})`);
    
    // 初始化自动捕获
    const autoCapture = new AutoCapture(memorySystem, config);
    
    // 注册 before_agent_start 钩子 (自动召回 + L2/L3)
    if (config.autoRecall) {
      api.on("before_agent_start", async (event: any) => {
        try {
          // === L2: 微压缩 (每轮执行)
          if (microCompaction && microCompaction.isEnabled()) {
            await microCompaction.execute(event.messages || []);
          }
          
          // === L3: 获取会话记忆摘要
          let sessionContext = '';
          if (sessionMemory && sessionMemory.isEnabled()) {
            sessionContext = sessionMemory.getSummary();
          }
          
          // 执行原有自动召回
          const recallResult = await autoRecallInstance!.execute(event);
          
          // 合并会话记忆到召回结果
          if (sessionContext && recallResult) {
            return {
              prependContext: sessionContext + '\n\n' + recallResult.prependContext
            };
          } else if (sessionContext) {
            return { prependContext: sessionContext };
          }
          
          return recallResult;
        } catch (err) {
          api.logger.error(`自动召回失败: ${err}`);
        }
      });
    }
    
    // 注册 agent_end 钩子 (自动捕获 + L6检查)
    if (config.autoCapture) {
      api.on("agent_end", async (event: any) => {
        try {
          await autoCapture.execute(event);
          
          // === L6: 检查是否触发做梦
          if (dreamConsolidation && dreamConsolidation.isEnabled()) {
            if (await dreamConsolidation.shouldDream()) {
              api.logger.info('[DreamConsolidation] 开始整合...');
              const result = await dreamConsolidation.execute();
              if (result.success) {
                api.logger.info('[DreamConsolidation] 整合完成');
              } else {
                api.logger.error('[DreamConsolidation] 整合失败:', result.errors);
              }
            }
          }
        } catch (err) {
          api.logger.error(`自动捕获失败: ${err}`);
        }
      });
    }
    
    // 注册 session_start 钩子（重置召回状态 + 创建会话记忆）
    api.on("session_start", async (event: any) => {
      if (autoRecallInstance) {
        autoRecallInstance.resetSession();
      }
      
      // === L3: 创建新会话记忆 ===
      if (sessionMemory && sessionMemory.isEnabled()) {
        const sessionId = event.sessionId || `session-${Date.now()}`;
        const projectSlug = event.projectSlug || 'default';
        const initialTask = event.messages?.[0]?.content || '';
        
        await sessionMemory.createSession(sessionId, projectSlug, initialTask);
        api.logger.info(`[SessionMemory] 新会话已创建: ${sessionId}`);
      }
      
      api.logger.info("[Memory] 新会话开始");
    });
    
    // === L3: 注册 after_agent_response 钩子（更新会话记忆）
    if (sessionMemory && sessionMemory.isEnabled()) {
      api.on("after_agent_response", async (event: any) => {
        try {
          // 更新会话记忆：提取决策和步骤
          const lastMessage = event.messages?.[event.messages?.length - 1];
          if (lastMessage?.role === 'assistant') {
            const content = typeof lastMessage.content === 'string' 
              ? lastMessage.content 
              : lastMessage.content?.[0]?.text || '';
            
            // 简单提取：检测关键词
            if (content.includes('决定') || content.includes('选择')) {
              await sessionMemory!.addDecision(content.slice(0, 100));
            }
            
            if (content.includes('完成') || content.includes('修复') || content.includes('添加')) {
              await sessionMemory!.addCompletedStep(content.slice(0, 100));
            }
          }
        } catch (err) {
          api.logger.error(`更新会话记忆失败: ${err}`);
        }
      });
    }
    
    // === L1: 注册 tool_result 钩子（处理大结果）
    if (toolResultStore && toolResultStore.isEnabled()) {
      api.on("tool_result", async (event: any) => {
        try {
          const { toolUseId, toolName, content, sessionId } = event;
          if (!toolUseId || !content) return;
          
          // 自动处理：大结果存磁盘，小结果直接返回
          const result = await toolResultStore!.getResult(
            toolUseId,
            sessionId || 'default',
            content,
            toolName
          );
          
          // 如果是预览，返回处理后的内容
          if (result.isPreview) {
            return { content: result.content, isPreview: true };
          }
        } catch (err) {
          api.logger.error(`处理工具结果失败: ${err}`);
        }
      });
    }
    
    // 注册 session_end 钩子（清理会话资源）
    api.on("session_end", async (event: any) => {
      const sessionId = event.sessionId || 'default';
      
      // === L1: 清理工具结果
      if (toolResultStore && toolResultStore.isEnabled()) {
        await toolResultStore.cleanupSession(sessionId);
      }
      
      // === L3: 标记会话结束
      if (sessionMemory && sessionMemory.isEnabled()) {
        await sessionMemory.updateStatus('completed');
      }
      
      api.logger.info(`[Memory] 会话 ${sessionId} 已结束，资源已清理`);
    });
    
    api.logger.info("AI Memory Claw v2.0 插件初始化完成");
  }
};

export default plugin;
