#!/usr/bin/env node
/**
 * i18n 覆盖度校验脚本
 *
 * 校验 vue-i18n 语言包与代码中 $t() 调用的 key 是否对齐：
 *   1. 代码中使用的 key 是否都在语言包中定义（缺失 = 运行时回退成 key 字面量）
 *   2. 语言包中定义的 key 是否有被使用（冗余 = 可清理的死文案）
 *
 * 用法：node scripts/verify-i18n-coverage.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const I18N_DIR = path.join(ROOT, 'frontend/src/i18n');
const SRC_DIR = path.join(ROOT, 'frontend/src');

function walkDir(dir, exts) {
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...walkDir(full, exts));
    else if (exts.some(e => item.name.endsWith(e))) out.push(full);
  }
  return out;
}

// 去掉注释，避免注释里的示例文案被当成 key
function stripComments(src) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') { out += next || ''; i += 2; continue; }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; out += ch; i++; continue; }
    if (ch === '/' && next === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

// 解析一个对象字面量，返回 { obj, end }（pos 指向 '{'）
function parseObject(src, pos) {
  const obj = {};
  let i = pos + 1;
  const skip = () => { while (i < src.length && /[\s,]/.test(src[i])) i++; };

  while (i < src.length) {
    skip();
    if (src[i] === '}') { i++; break; }

    let key = '';
    if (src[i] === "'" || src[i] === '"') {
      const q = src[i++];
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; key += src[i++]; }
      i++;
    } else {
      while (i < src.length && /[\w$\-.]/.test(src[i])) key += src[i++];
    }
    if (!key) { i++; continue; }

    skip();
    if (src[i] !== ':') { continue; }
    i++;
    skip();

    if (src[i] === '{') {
      const nested = parseObject(src, i);
      obj[key] = nested;
      i = nested.__pos;
      continue;
    }

    let value = '';
    if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
      const q = src[i++];
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') { value += src[i]; i++; } value += src[i++]; }
      i++;
    } else {
      while (i < src.length && src[i] !== ',' && src[i] !== '}') value += src[i++];
    }
    obj[key] = value.trim();
  }
  return Object.assign(obj, { __pos: i });
}

// 展开成 vue-i18n 的点号路径（core.dialog.info 这种）
function flatten(obj, prefix, acc) {
  for (const key of Object.keys(obj)) {
    if (key === '__pos') continue;
    const full = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object') flatten(value, full, acc);
    else acc.add(full);
  }
  return acc;
}

// 读取语言包：每个分片文件 export default { ... }，构建期静态合并
// 同时按 .zh / .en 归组，供双语对齐校验
function extractDefinedKeys() {
  const keys = new Set();
  const byLang = { zh: new Set(), en: new Set() };
  const files = walkDir(path.join(I18N_DIR, 'locales'), ['.ts']);

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const src = stripComments(raw);
    const marker = src.indexOf('export default');
    if (marker < 0) continue;
    const brace = src.indexOf('{', marker);
    if (brace < 0) continue;

    const flat = flatten(parseObject(src, brace), '', new Set());
    for (const k of flat) keys.add(k);

    const name = path.basename(file);
    // zh-CN.ts / *.zh.ts → zh；en.ts / *.en.ts → en
    if (/(\.zh|zh-CN)\.ts$/.test(name)) for (const k of flat) byLang.zh.add(k);
    else if (/(\.en|^en)\.ts$/.test(name)) for (const k of flat) byLang.en.add(k);
  }
  return { keys, byLang, files };
}

// 提取翻译调用：仅 $t('key') / i18n.global.t('key') / t('key')
// 必须排除 import( / mount( / emit( / setTimeout( 等以 t( 结尾的普通函数调用，
// 否则会把模块路径和选择器当成翻译 key
const CALL_RE = /(?:\$t|i18n\.global\.t|(?<![\w$.])t)\(\s*['"]([^'"]+)['"]/g;
// 传参不是字面量的动态 key，无法静态判定，单独列出供人工确认
const DYNAMIC_RE = /(?:\$t|i18n\.global\.t|(?<![\w$.])t)\(\s*(?!['"])([^)]{1,60})\)/g;

function extractUsedKeys() {
  const keys = new Set();
  const dynamic = new Map();
  const srcFiles = walkDir(SRC_DIR, ['.vue', '.ts']).filter(f => !f.includes('/i18n/'));

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    let match;
    while ((match = CALL_RE.exec(content)) !== null) keys.add(match[1]);
    while ((match = DYNAMIC_RE.exec(content)) !== null) {
      const expr = match[1].trim();
      // 过滤掉多行/跨语句造成的噪声
      if (/[\n;]/.test(expr) || /^(async|\{|\[|\d)/.test(expr)) continue;
      if (!dynamic.has(expr)) dynamic.set(expr, []);
      dynamic.get(expr).push(path.relative(ROOT, file));
    }
  }
  return { keys, dynamic };
}

function main() {
  console.log('🔍 正在解析 i18n 语言包（嵌套路径展开）...\n');
  const { keys: definedKeys, byLang, files } = extractDefinedKeys();
  console.log(`✅ 扫描 ${files.length} 个语言包文件，展开后共 ${definedKeys.size} 个完整 key`);
  console.log(`   中文侧 ${byLang.zh.size} 个 / 英文侧 ${byLang.en.size} 个\n`);

  console.log('🔍 正在扫描源代码中的翻译调用...\n');
  const { keys: usedKeys, dynamic } = extractUsedKeys();
  console.log(`✅ 静态调用共 ${usedKeys.size} 个 key，动态调用 ${dynamic.size} 处\n`);

  const undefinedKeys = [...usedKeys].filter(k => !definedKeys.has(k));
  const unusedKeys = [...definedKeys].filter(k => !usedKeys.has(k));

  console.log('='.repeat(60));
  console.log('📊 覆盖度报告');
  console.log('='.repeat(60));

  if (undefinedKeys.length) {
    console.log(`\n❌ 语言包中缺失的 key（${undefinedKeys.length} 个）：\n`);
    undefinedKeys.sort().forEach(k => console.log(`   - ${k}`));
  } else {
    console.log('\n✅ 所有使用的 key 都已定义（零缺失）');
  }

  if (unusedKeys.length) {
    console.log(`\n⚠️  已定义但代码未使用（${unusedKeys.length} 个，前 20）：\n`);
    unusedKeys.sort().slice(0, 20).forEach(k => console.log(`   - ${k}`));
    if (unusedKeys.length > 20) console.log(`   ... 还有 ${unusedKeys.length - 20} 个`);
  } else {
    console.log('\n✅ 所有定义的 key 都被使用（零冗余）');
  }

  // 双语对齐：zh 有 en 无 → 切到英文界面时该 key 静默回退成中文
  const missingInEn = [...byLang.zh].filter(k => !byLang.en.has(k)).sort();
  const missingInZh = [...byLang.en].filter(k => !byLang.zh.has(k)).sort();

  if (missingInEn.length || missingInZh.length) {
    console.log(`\n🌐 双语对齐差异：\n`);
    if (missingInEn.length) {
      console.log(`   英文侧缺失 ${missingInEn.length} 个（英文界面会显示中文）：`);
      missingInEn.slice(0, 15).forEach(k => console.log(`     - ${k}`));
      if (missingInEn.length > 15) console.log(`     ... 还有 ${missingInEn.length - 15} 个`);
    }
    if (missingInZh.length) {
      console.log(`   中文侧缺失 ${missingInZh.length} 个（fallbackLocale 兜不住，会显示 key）：`);
      missingInZh.slice(0, 15).forEach(k => console.log(`     - ${k}`));
      if (missingInZh.length > 15) console.log(`     ... 还有 ${missingInZh.length - 15} 个`);
    }
  } else {
    console.log('\n✅ 中英双语 key 完全对齐');
  }

  if (dynamic.size) {
    console.log(`\n🔎 动态拼接的 key（${dynamic.size} 处，静态无法判定，需人工确认）：\n`);
    for (const [expr, files] of dynamic) {
      console.log(`   - ${expr}   ${[...new Set(files)].join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  process.exit(undefinedKeys.length ? 1 : 0);
}

main();
