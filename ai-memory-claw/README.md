# AI Memory Claw

OpenClaw 插件 - AI 渐进式记忆系统（无感运行版）

## 功能特性

- **自动召回**：对话前自动搜索并注入相关记忆
- **自动捕获**：对话后自动生成记忆（100%强制存储）
- **遗忘机制**：自动删除低价值记忆
- **整合机制**：自动合并相似记忆
- **向量搜索**：基于语义相似度的记忆检索
- **分类分析**：自动识别记忆类别

## 安装

### 方式一：直接复制（推荐用于本地）

1. 克隆或下载本项目
2. 进入项目目录并安装依赖
   ```bash
   npm install
   ```
3. 复制整个项目到 OpenClaw 扩展目录
   ```bash
   # 根据你的系统调整路径
   cp -r . ~/.openclaw/extensions/ai-memory-claw
   cd ~/.openclaw/extensions/ai-memory-claw
   npm install  # 再次安装确保本地依赖完整
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

### 方式二：发布到 npm（供开发者使用）

本插件已发布为 npm 包 `ai-memory-claw`。你可以：
```bash
npm install ai-memory-claw
```
然后在 OpenClaw 配置中指定：
```json
{
  "plugins": {
    "entries": {
      "ai-memory-claw": {
        "package": "ai-memory-claw",
        "enabled": true
      }
    }
  }
}
```

## 配置说明

在 OpenClaw 配置中通过 `plugins.entries.ai-memory-claw.config` 设置。所有配置项：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `dataDir` | `string` | `~/.ai-memory-claw/data` | 记忆数据存储目录 |
| `autoRecall` | `boolean` | `true` | 对话前自动搜索并注入相关记忆 |
| `autoCapture` | `boolean` | `true` | 对话后自动生成记忆 |
| `captureStrategy` | `"always" \| "selective"` | `"always"` | 捕获策略：always=全部存储，selective=仅关键词匹配 |
| `autoRecallInNewSession` | `boolean` | `true` | 新会话首次对话时自动注入记忆 |
| `newSessionMemoryLimit` | `number` (1-5) | `1` | 新会话时注入的记忆数量 |
| `manualTriggerEnabled` | `boolean` | `true` | 用户消息包含关键词时触发手动召回 |
| `manualTriggerKeywords` | `string[]` | 见下方 | 手动召回触发关键词列表 |
| `manualRecallLimit` | `number` (1-10) | `3` | 手动触发时注入的记忆数量上限 |
| `recallThreshold` | `number` (0-1) | `0.6` | 相似度阈值，越高越严格 |
| `recallLimit` | `number` (1-10) | `2` | 每次召回的记忆数量上限 |
| `captureMaxChars` | `number` (100-2000) | `500` | 自动捕获的最大字符数 |
| `enableSummary` | `boolean` | `true` | 启用记忆摘要功能 |
| `enableForget` | `boolean` | `true` | 启用遗忘机制（定期清理低价值记忆） |
| `enableIntegration` | `boolean` | `true` | 启用整合机制（合并相似记忆） |
| `forgetIntervalDays` | `number` (1-30) | `7` | 遗忘检查间隔（天） |
| `integrationThreshold` | `number` (0.5-1) | `0.8` | 记忆整合相似度阈值 |

### 默认触发关键词

```json
[
  "记得", "之前", "上次", "以前", "查一下", "看看之前的记忆",
  "用一下之前的", "参考之前的", "以前是怎么做的", "你还记得吗",
  "记忆里", "历史上", "之前那次"
]
```

## 记忆目录结构

```
~/.ai-memory-claw/data/
├── 日常事务/
│   └── 通用/
│       └── 日常-通用-20260328-2315-xxxxx.json
├── 系统运维/
│   └── 通用/
│       └── 系统-通用-20260328-xxxxxx.json
└── ...
```

## 数据格式

每条记忆为 JSON 文件：

```json
{
  "id": "日常-通用-20260328-2315-xxxxx",
  "category": "日常事务",
  "subCategory": "通用",
  "content": {
    "task": "用户询问的问题",
    "process": "处理过程",
    "result": "处理结果"
  },
  "embedding": [0.1, 0.2, ...],
  "importance": "critical",
  "usageCount": 10
}
```

## 开发

### 构建

TypeScript 源码需编译为 JavaScript：

```bash
npm run build
# 或监听模式
npm run dev
```

输出位于 `dist/` 目录。

### 测试

本插件使用 Vitest 进行测试：

```bash
npm test
```

### 项目结构

```
ai-memory-claw/
├── src/
│   ├── auto-capture.ts      # 自动捕获逻辑
│   ├── auto-recall.ts       # 自动召回逻辑
│   ├── category.ts          # 记忆分类分析
│   ├── config.ts            # 配置管理
│   ├── embedding.ts         # 向量化处理
│   ├── forgetter.ts         # 遗忘机制
│   ├── integrator.ts        # 整合机制
│   ├── memory-system.ts     # 核心记忆系统
│   ├── triggers.ts          # 触发器匹配
│   ├── types.ts             # 类型定义
│   └── test.ts              # 测试文件
├── index.ts                 # 插件入口
├── openclaw.plugin.json     # OpenClaw 插件元数据
├── tsconfig.json            # TypeScript 配置
├── package.json             # 项目依赖
└── README.md                # 本文档
```

## 技术说明

- 记忆数据按 `category/subCategory/` 分类存储 JSON 文件
- 使用简化的本地向量搜索（基于 `chroma-js` 的色彩空间算法，实验性质）
- 分类基于关键词匹配 + LLM 分析（可选）
- 支持自动摘要、合并重复记忆、定期遗忘

## 许可证

Apache License 2.0 - 详见 [LICENSE](LICENSE) 文件。

---

## 贡献

欢迎提交 Issue 和 Pull Request。请确保：
- 代码通过 `npm run build` 编译
- 测试通过 `npm test`
- 遵循项目的代码风格
