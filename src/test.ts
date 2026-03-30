/**
 * 简单测试脚本
 * 用于验证核心功能
 */

import { MemorySystem } from './memory-system';
import { defaultMemoryConfig } from './config';
import { TriggerAnalyzer } from './triggers';
import { CategoryAnalyzer } from './category';
import { AutoRecall } from './auto-recall';
import { AutoCapture } from './auto-capture';

async function runTests() {
  console.log('🧪 开始测试...\n');
  
  // 测试1: 关键词分析
  console.log('📝 测试1: 关键词分析');
  const trigger = new TriggerAnalyzer();
  
  const testCases = [
    { text: '记住我的密码是123456', expected: 'critical' },
    { text: '我决定使用Docker', expected: 'high' },
    { text: '帮我写个Python脚本', expected: 'medium' },
    { text: '谢谢你的帮助', expected: 'low' },
  ];
  
  for (const tc of testCases) {
    const result = trigger.analyze(tc.text);
    const pass = result === tc.expected ? '✅' : '❌';
    console.log(`  ${pass} "${tc.text}" => ${result} (期望: ${tc.expected})`);
  }
  
  // 测试2: 分类分析
  console.log('\n📝 测试2: 分类分析');
  const category = new CategoryAnalyzer();
  
  const categoryTests = [
    { text: '帮我写个Python脚本', expected: '代码开发' },
    { text: '配置Docker环境', expected: '系统运维' },
    { text: '帮我写份报告', expected: '文档撰写' },
    { text: '分析销售数据', expected: '数据分析' },
  ];
  
  for (const tc of categoryTests) {
    const result = category.analyze(tc.text);
    const pass = result.category === tc.expected ? '✅' : '❌';
    console.log(`  ${pass} "${tc.text}" => ${result.category} (期望: ${tc.expected})`);
  }
  
  // 测试3: 记忆系统
  console.log('\n📝 测试3: 记忆系统');
  const memorySystem = new MemorySystem('./test-data', defaultMemoryConfig);
  await memorySystem.initialize();
  
  // 存储测试
  const memory1 = await memorySystem.store({
    content: {
      task: '帮我写个Python脚本',
      process: '创建了script.py',
      result: '完成',
      insights: []
    },
    category: '代码开发',
    subCategory: '脚本',
    importance: 'medium'
  });
  console.log(`  ✅ 存储记忆: ${memory1.id}`);
  
  // 搜索测试
  const searchResults = await memorySystem.search('Python脚本', {
    limit: 3,
    threshold: 0.1
  });
  console.log(`  ✅ 搜索结果: 找到 ${searchResults.length} 条`);
  
  // 统计测试
  const stats = memorySystem.getStats();
  console.log(`  ✅ 统计: ${stats.total} 条记忆`);
  
  // 测试4: 自动召回
  console.log('\n📝 测试4: 自动召回');
  const autoRecall = new AutoRecall(memorySystem, defaultMemoryConfig);
  const recallResult = await autoRecall.execute({
    prompt: '之前让我写的脚本在哪？'
  });
  if (recallResult) {
    console.log(`  ✅ 自动召回成功`);
    console.log(`     ${recallResult.prependContext.slice(0, 100)}...`);
  } else {
    console.log(`  ⚠️  无相关记忆返回`);
  }
  
  // 测试5: 自动捕获
  console.log('\n📝 测试5: 自动捕获');
  const autoCapture = new AutoCapture(memorySystem, defaultMemoryConfig);
  await autoCapture.execute({
    messages: [
      { role: 'user', content: '帮我创建一个备份脚本' },
      { role: 'assistant', content: '已创建backup.ps1' }
    ]
  });
  
  const stats2 = memorySystem.getStats();
  console.log(`  ✅ 自动捕获后: ${stats2.total} 条记忆`);
  
  console.log('\n🎉 测试完成！');
  
  // 清理测试数据
  const fs = await import('fs');
  if (fs.existsSync('./test-data')) {
    fs.rmSync('./test-data', { recursive: true });
    console.log('🧹 已清理测试数据');
  }
}

runTests().catch(console.error);
