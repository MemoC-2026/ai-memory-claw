/**
 * Config Validator - 配置校验模块
 * 
 * 启动时校验配置，防止无效配置导致运行时错误
 */

import { MemoryConfig, defaultMemoryConfig } from './config';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ConfigValidator {
  /**
   * 校验完整配置
   */
  static validate(config: Partial<MemoryConfig>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 校验基础配置
    if (config.dataDir !== undefined) {
      if (typeof config.dataDir !== 'string' || config.dataDir.length === 0) {
        errors.push('dataDir 必须是非空字符串');
      }
    }
    
    // 校验数值范围
    if (config.recallThreshold !== undefined) {
      if (config.recallThreshold < 0 || config.recallThreshold > 1) {
        errors.push('recallThreshold 必须在 0-1 之间');
      }
    }
    
    if (config.captureMaxChars !== undefined) {
      if (config.captureMaxChars < 100 || config.captureMaxChars > 10000) {
        errors.push('captureMaxChars 必须在 100-10000 之间');
      }
    }
    
    if (config.forgetIntervalDays !== undefined) {
      if (config.forgetIntervalDays < 1 || config.forgetIntervalDays > 90) {
        errors.push('forgetIntervalDays 必须在 1-90 之间');
      }
    }
    
    // 校验 L1 配置
    if (config.toolResultStorage) {
      if (config.toolResultStorage.grepThreshold !== undefined) {
        if (config.toolResultStorage.grepThreshold < 1024) {
          warnings.push('toolResultStorage.grepThreshold 建议不小于 1KB');
        }
      }
      if (config.toolResultStorage.previewLength !== undefined) {
        if (config.toolResultStorage.previewLength > 4096) {
          warnings.push('toolResultStorage.previewLength 建议不大于 4KB');
        }
      }
    }
    
    // 校验 L2 配置
    if (config.microCompaction) {
      if (config.microCompaction.timeThresholdMinutes !== undefined) {
        if (config.microCompaction.timeThresholdMinutes < 1) {
          errors.push('microCompaction.timeThresholdMinutes 必须大于 0');
        }
      }
      if (config.microCompaction.keepRecentCount !== undefined) {
        if (config.microCompaction.keepRecentCount < 1) {
          errors.push('microCompaction.keepRecentCount 必须大于 0');
        }
      }
    }
    
    // 校验 L3 配置
    if (config.sessionMemory) {
      if (config.sessionMemory.compactionThreshold !== undefined) {
        if (config.sessionMemory.compactionThreshold < 0 || config.sessionMemory.compactionThreshold > 1) {
          errors.push('sessionMemory.compactionThreshold 必须在 0-1 之间');
        }
      }
    }
    
    // 校验 L6 配置
    if (config.dreamConsolidation) {
      if (config.dreamConsolidation.minSessionsBeforeDream !== undefined) {
        if (config.dreamConsolidation.minSessionsBeforeDream < 1) {
          errors.push('dreamConsolidation.minSessionsBeforeDream 必须大于 0');
        }
      }
      if (config.dreamConsolidation.dreamIntervalHours !== undefined) {
        if (config.dreamConsolidation.dreamIntervalHours < 1) {
          errors.push('dreamConsolidation.dreamIntervalHours 必须大于 0');
        }
      }
    }
    
    // 校验多Agent配置
    if (config.sharedEnabled) {
      if (!config.sharedDir) {
        warnings.push('sharedEnabled 为 true 时，建议设置 sharedDir');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * 校验并返回有效配置
   */
  static validateAndMerge(config: Partial<MemoryConfig>): MemoryConfig {
    const result = this.validate(config);
    
    if (!result.valid) {
      throw new Error(`配置校验失败: ${result.errors.join(', ')}`);
    }
    
    if (result.warnings.length > 0) {
      console.warn('配置警告:', result.warnings);
    }
    
    // 合并默认配置
    return {
      ...defaultMemoryConfig,
      ...config,
      // 深度合并嵌套对象
      toolResultStorage: {
        ...defaultMemoryConfig.toolResultStorage,
        ...config.toolResultStorage
      },
      microCompaction: {
        ...defaultMemoryConfig.microCompaction,
        ...config.microCompaction
      },
      sessionMemory: {
        ...defaultMemoryConfig.sessionMemory,
        ...config.sessionMemory
      },
      fullCompaction: {
        ...defaultMemoryConfig.fullCompaction,
        ...config.fullCompaction
      },
      dreamConsolidation: {
        ...defaultMemoryConfig.dreamConsolidation,
        ...config.dreamConsolidation
      }
    };
  }
}
