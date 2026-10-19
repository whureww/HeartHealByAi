#!/usr/bin/env node
/**
 * i18n 覆盖度校验脚本
 * 
 * 验证：
 * 1. 所有在代码中使用的 $t('key') 都在语言包中定义
 * 2. 所有语言包中定义的 key 都在代码中被使用（或至少导出）
 * 
 * 用法：node scripts/verify-i18n-coverage.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const I18N_DIR = path.join(ROOT, 'frontend/src/i18n');
const SRC_DIR = path.join(ROOT, 'frontend/src');

// 递归读取所有文件
function walkDir(dir, ext) {
  const results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...walkDir(fullPath, ext));
    } else if (ext.some(e => item.name.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

// 从语言包中提取所有 key
function extractI18nKeys() {
  const keys = new Set();
  const localeFiles = walkDir(path.join(I18N_DIR, 'locales'), ['.ts']);
  
  for (const file of localeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    // 匹配 key: 'value' 或 key: "value" 或 key: `value`
    // 支持嵌套对象中的 key
    const regex = /^\s*([a-zA-Z0-9_]+)\s*:\s*['"`]/gm;
    let match;
    while ((match = regex.exec(content)) !== null) {
      keys.add(match[1]);
    }
  }
  
  return keys;
}

// 从源代码中提取所有 $t('key') 使用
function extractUsedKeys() {
  const keys = new Set();
  const srcFiles = walkDir(SRC_DIR, ['.vue', '.ts']);
  
  // 排除 i18n 目录本身
  const filteredFiles = srcFiles.filter(f => !f.includes('/i18n/'));
  
  for (const file of filteredFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    // 匹配 $t('key') 或 $t("key") 或 t('key') 或 t("key")
    const regex = /\$?t\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      keys.add(match[1]);
    }
  }
  
  return keys;
}

// 主逻辑
function main() {
  console.log('🔍 正在扫描 i18n 语言包...\n');
  const definedKeys = extractI18nKeys();
  console.log(`✅ 语言包中定义了 ${definedKeys.size} 个 key\n`);
  
  console.log('🔍 正在扫描源代码中的 $t() 使用...\n');
  const usedKeys = extractUsedKeys();
  console.log(`✅ 代码中使用了 ${usedKeys.size} 个 key\n`);
  
  // 检查：使用的 key 是否都定义了
  const undefinedKeys = [];
  for (const key of usedKeys) {
    if (!definedKeys.has(key)) {
      undefinedKeys.push(key);
    }
  }
  
  // 检查：定义的 key 是否都使用了（可选，有些 key 可能预留）
  const unusedKeys = [];
  for (const key of definedKeys) {
    if (!usedKeys.has(key)) {
      unusedKeys.push(key);
    }
  }
  
  console.log('='.repeat(60));
  console.log('📊 覆盖度报告');
  console.log('='.repeat(60));
  
  if (undefinedKeys.length > 0) {
    console.log(`\n❌ 未定义的 key（${undefinedKeys.length} 个）：`);
    console.log('   这些 key 在代码中被使用，但语言包中没有定义：\n');
    undefinedKeys.sort().forEach(k => console.log(`   - ${k}`));
  } else {
    console.log('\n✅ 所有使用的 key 都已定义（零缺失）');
  }
  
  if (unusedKeys.length > 0) {
    console.log(`\n⚠️  未使用的 key（${unusedKeys.length} 个）：`);
    console.log('   这些 key 在语言包中定义，但代码中未使用（可能是预留）：\n');
    unusedKeys.sort().slice(0, 20).forEach(k => console.log(`   - ${k}`));
    if (unusedKeys.length > 20) {
      console.log(`   ... 还有 ${unusedKeys.length - 20} 个`);
    }
  } else {
    console.log('\n✅ 所有定义的 key 都被使用（零冗余）');
  }
  
  console.log('\n' + '='.repeat(60));
  
  // 退出码
  if (undefinedKeys.length > 0) {
    console.log('❌ 校验失败：存在未定义的 key');
    process.exit(1);
  } else {
    console.log('✅ 校验通过');
    process.exit(0);
  }
}

main();
