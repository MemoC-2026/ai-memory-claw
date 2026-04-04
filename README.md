# AI Memory Claw

OpenClaw 插件 - AI 渐进式记忆系统

## 功能特性

### 核心功能
- **自动召回**：对话前自动搜索并注入相关记忆
- **自动捕获**：对话后自动生成记忆
- **遗忘机制**：自动删除低价值记忆，释放存储空间
- **整合机制**：自动合并相似记忆
- **向量搜索**：基于语义相似度的记忆检索
- **优先级系统**：搜索结果按重要性加权，频繁访问自动提升优先级
- **标签系统**：支持自定义标签搜索和管理
- **多Agent支持**：私有记忆 + 共享记忆

### 层级架构

| 层级 | 功能 | 说明 |
|------|------|------|
| L1 | 工具结果存储 | 大结果(10KB+)写磁盘，上下文只放2KB预览 |
| L2 | 微压缩 | 基于时间/缓存清理，几乎零成本 |
| L3 | 会话记忆 | 结构化笔记，零API成本 |
| L5 | 记忆提取 | 跨会话持久知识 |
| L6 | 做梦整合 | 定期记忆巩固 |

## 安装

### 方式一：直接复制（推荐用于本地）

1. 克隆或下载本项目
2. 进入项目目录并安装依赖
   ```bash
   npm install
   ```
3. 复制整个项目到 OpenClaw 扩展目录
   ```bash
   cp -r . ~/.openclaw/extensions/ai-memory-claw
   ```
4. 配置 OpenClaw：编辑 `~/.openclaw/openclaw.json`
   ```json
   {
     "plugins": {
       "allow": ["ai-memory-claw"],
       "entries": {
         "ai-memory-claw": {
           "enabled": true,
           "config": {
             "autoRecall": true,
             "autoCapture": true
           }
         }
       }
     }
   }
   ```
5. 启动 OpenClaw Gateway

### 方式二：发布到 npm

```bash
npm install ai-memory-claw
```

## 配置说明

### 基础配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `dataDir` | `string` | `~/.ai-memory-claw/data` | 记忆数据存储目录 |
| `autoRecall` | `boolean` | `true` | 对话前自动搜索并注入相关记忆 |
| `autoCapture` | `boolean` | `true` | 对话后自动生成记忆 |
| `captureStrategy` | `"always" \| "selective"` | `"always"` | 捕获策略 |

### 高级配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `sessionMemory.enabled` | `boolean` | `true` | 会话记忆开关 |
| `sessionMemory.storageDir` | `string` | `~/.ai-memory-claw/session-memory` | 会话记忆存储目录 |
| `toolResultStorage.enabled` | `boolean` | `true` | 工具结果存储开关 |
| `toolResultStorage.grepThreshold` | `number` | `10240` | grep 阈值(字节) |
| `toolResultStorage.previewLength` | `number` | `2048` | 预览长度(字节) |
| `microCompaction.enabled` | `boolean` | `true` | 微压缩开关 |
| `dreamConsolidation.enabled` | `boolean` | `true` | 做梦整合开关 |

### 触发关键词

```json
[
  "记得", "之前", "上次", "以前", "查一下", "看看之前的记忆",
  "用一下之前的", "参考之前的", "以前是怎么做的", "你还记得吗",
  "记忆里", "历史上", "之前那次"
]
```

## 数据目录结构

```
~/.ai-memory-claw/
├── agents/                     # 私有记忆
│   └── <agent>/
│       └── <category>/
├── shared/                     # 共享记忆 (多Agent)
├── tool-results/              # L1: 工具结果存储
│   └── <sessionId>/
├── session-memory/            # L3: 会话记忆
│   └── <sessionId>.md.json
└── memory/                    # L5: 跨会话知识
    ├── tasks/
    ├── errors/
    ├── preferences/
    └── knowledge/
```

## 开发

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

### 项目结构

```
ai-memory-claw/
├── src/
│   ├── auto-capture.ts         # 自动捕获
│   ├── auto-recall.ts          # 自动召回
│   ├── category.ts             # 记忆分类
│   ├── config.ts               # 配置管理
│   ├── dream-consolidation.ts  # L6: 做梦整合
│   ├── embedding.ts             # 向量化处理
│   ├── forgetter.ts             # 遗忘机制
│   ├── integrator.ts            # 整合机制
│   ├── memory-system.ts         # 核心记忆系统
│   ├── memory-tags.ts           # 标签系统
│   ├── micro-compaction.ts      # L2: 微压缩
│   ├── session-memory.ts        # L3: 会话记忆
│   ├── tool-result-store.ts     # L1: 工具结果存储
│   ├── triggers.ts              # 触发分析
│   └── types.ts                 # 类型定义
├── tests/                      # 测试文件
│   ├── session-memory.test.ts
│   ├── tool-result-store.test.ts
│   ├── micro-compaction.test.ts
│   ├── auto-capture.test.ts
│   └── auto-recall.test.ts
├── docs/
│   └── UPGRADE_V2.md           # 升级方案
├── index.ts                    # 插件入口
├── package.json
└── README.md
```

## 核心特性说明

### 优先级系统
- 搜索结果按重要性加权（权重30%）
- 频繁访问的记忆自动提升优先级
- 低优先级记忆更容易被遗忘机制清理

### 标签系统
- 支持自定义标签
- 自动提取标签（基于关键词匹配）
- 按标签搜索记忆

### 会话记忆
- 每个会话维护结构化笔记
- 跟踪决策、步骤、待办
- 零API成本的上下文摘要

### 做梦整合
- 积累10个会话后触发
- 4阶段整合流程
- 矛盾记忆检测

## 许可证

Apache License 2.0 - 详见 [LICENSE](LICENSE) 文件。
