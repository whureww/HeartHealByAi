/* ============================================================
 * 心愈（XinYu）工程架构图 SVG 生成器（零第三方依赖）
 * 用法：node docs/diagrams/gen.js
 * 产出：docs/images/*.svg
 * 改架构后重新运行本脚本即可刷新全部图片
 * ============================================================ */
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'images');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const FONT = "'Microsoft YaHei','PingFang SC','Hiragino Sans GB','Segoe UI',Arial,sans-serif";

// ---------- 配色（浅色填充 + 彩色描边，深浅背景都清晰） ----------
const C = {
  client: { fill: '#eff6ff', stroke: '#2563eb', text: '#1e3a8a' },   // 客户端 蓝
  server: { fill: '#ecfdf5', stroke: '#059669', text: '#065f46' },   // 后端 绿
  db:     { fill: '#fffbeb', stroke: '#d97706', text: '#92400e' },   // 数据库 琥珀
  cache:  { fill: '#f5f3ff', stroke: '#7c3aed', text: '#5b21b6' },   // 缓存 紫
  ext:    { fill: '#f3f4f6', stroke: '#6b7280', text: '#374151' },   // 外部 灰
  sec:    { fill: '#fef2f2', stroke: '#dc2626', text: '#991b1b' },   // 安全 红
  io:     { fill: '#f0fdfa', stroke: '#0d9488', text: '#115e59' },   // 通信 青
  white:  { fill: '#ffffff', stroke: '#94a3b8', text: '#0f172a' },
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 文档骨架
function doc(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">
<defs>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L8,3 L0,6 Z" fill="#475569"/>
  </marker>
  <marker id="arrowBlue" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L8,3 L0,6 Z" fill="#2563eb"/>
  </marker>
  <marker id="arrowGreen" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L8,3 L0,6 Z" fill="#059669"/>
  </marker>
  <marker id="arrowRed" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L8,3 L0,6 Z" fill="#dc2626"/>
  </marker>
  <marker id="arrowAmber" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
    <path d="M0,0 L8,3 L0,6 Z" fill="#d97706"/>
  </marker>
</defs>
<rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>
${body}
</svg>`;
}

// 大标题
function title(t, sub) {
  return `<text x="32" y="44" font-size="24" font-weight="700" fill="#0f172a">${esc(t)}</text>` +
    (sub ? `<text x="32" y="70" font-size="13" fill="#64748b">${esc(sub)}</text>` : '');
}

// 分层背景带
function band(x, y, w, h, label, color) {
  const c = C[color] || C.white;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.55"/>
<text x="${x + 14}" y="${y + 24}" font-size="14" font-weight="700" fill="${c.stroke}">${esc(label)}</text>`;
}

// 节点框：title 标题行，lines 为正文行数组
function box(x, y, w, h, t, color, lines = [], opts = {}) {
  const c = C[color] || C.white;
  const fs = opts.fs || 13;
  const titleFs = opts.titleFs || 14;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.6"/>`;
  if (lines.length === 0) {
    // 只有标题，居中
    s += `<text x="${x + w / 2}" y="${y + h / 2 + 5}" font-size="${titleFs}" font-weight="700" fill="${c.text}" text-anchor="middle">${esc(t)}</text>`;
  } else {
    s += `<text x="${x + w / 2}" y="${y + 22}" font-size="${titleFs}" font-weight="700" fill="${c.text}" text-anchor="middle">${esc(t)}</text>`;
    lines.forEach((ln, i) => {
      s += `<text x="${x + 12}" y="${y + 44 + i * (fs + 5)}" font-size="${fs}" fill="#334155">${esc(ln)}</text>`;
    });
  }
  return s;
}

// 直线箭头
function arrow(x1, y1, x2, y2, mk = 'arrow', dashed = false, label = '', lx = 0, ly = 0) {
  const dash = dashed ? 'stroke-dasharray="5 4"' : '';
  let s = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#475569" stroke-width="1.6" ${dash} marker-end="url(#${mk})"/>`;
  if (label) s += `<text x="${(x1 + x2) / 2 + lx}" y="${(y1 + y2) / 2 + ly}" font-size="12" fill="#475569" text-anchor="middle">${esc(label)}</text>`;
  return s;
}

// 折线箭头（points 数组）
function arrowPath(points, mk = 'arrow', dashed = false, label = '', labelAt = 0) {
  const d = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const dash = dashed ? 'stroke-dasharray="5 4"' : '';
  let s = `<path d="${d}" fill="none" stroke="#475569" stroke-width="1.6" ${dash} marker-end="url(#${mk})"/>`;
  if (label) {
    const p = points[labelAt || Math.floor(points.length / 2)];
    s += `<text x="${p[0] + 6}" y="${p[1] - 6}" font-size="12" fill="#475569">${esc(label)}</text>`;
  }
  return s;
}

// 无箭头连线
function link(x1, y1, x2, y2, dashed = true) {
  const dash = dashed ? 'stroke-dasharray="4 4"' : '';
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#94a3b8" stroke-width="1.3" ${dash}/>`;
}

// 图例
function legend(x, y, items) {
  let s = '';
  items.forEach((it, i) => {
    const c = C[it.c] || C.white;
    const yy = y + i * 24;
    s += `<rect x="${x}" y="${yy}" width="16" height="14" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>`;
    s += `<text x="${x + 22}" y="${yy + 12}" font-size="12" fill="#334155">${esc(it.t)}</text>`;
  });
  return s;
}

// 泳道生命线（时序图）
function lifeline(x, top, bottom, name, color) {
  const c = C[color] || C.white;
  const w = 150;
  let s = `<rect x="${x - w / 2}" y="${top - 30}" width="${w}" height="34" rx="7" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.6"/>`;
  s += `<text x="${x}" y="${top - 8}" font-size="13" font-weight="700" fill="${c.text}" text-anchor="middle">${esc(name)}</text>`;
  s += `<line x1="${x}" y1="${top + 4}" x2="${x}" y2="${bottom}" stroke="${c.stroke}" stroke-width="1.4" stroke-dasharray="5 4"/>`;
  return s;
}

// 时序消息（水平箭头 + 文字）
function msg(x1, x2, y, text, mk = 'arrow', dashed = false) {
  const dir = x2 > x1 ? 1 : -1;
  const dash = dashed ? 'stroke-dasharray="5 4"' : '';
  let s = `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#475569" stroke-width="1.6" ${dash} marker-end="url(#${mk})"/>`;
  const mx = (x1 + x2) / 2;
  s += `<rect x="${mx - text.length * 6.5 - 6}" y="${y - 24}" width="${text.length * 13 + 12}" height="20" rx="4" fill="#ffffff" opacity="0.92"/>`;
  s += `<text x="${mx}" y="${y - 9}" font-size="12" fill="#1e293b" text-anchor="middle">${esc(text)}</text>`;
  return s;
}

// 激活条（时序图）
function activation(x, y, h, color) {
  const c = C[color] || C.white;
  return `<rect x="${x - 6}" y="${y}" width="12" height="${h}" fill="${c.stroke}" opacity="0.35" stroke="${c.stroke}"/>`;
}

function save(name, svg) {
  fs.writeFileSync(path.join(OUT_DIR, name + '.svg'), svg, 'utf8');
  console.log('generated', name + '.svg');
}

// ---- 流程/时序图辅助 ----
// 文字像素宽（中文约 12，英文约 6.6，font-size 12）
function wlen(s) {
  let w = 0;
  for (const ch of String(s)) w += /[^\x00-\xff]/.test(ch) ? 12 : 6.6;
  return w;
}
// 时序消息（宽度按中英文字符加权，白底标签）
function msg2(x1, x2, y, text, mk = 'arrow', dashed = false) {
  const w = wlen(text);
  const mx = (x1 + x2) / 2;
  const dash = dashed ? 'stroke-dasharray="5 4"' : '';
  let s = `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#475569" stroke-width="1.6" ${dash} marker-end="url(#${mk})"/>`;
  s += `<rect x="${mx - w / 2 - 7}" y="${y - 25}" width="${w + 14}" height="20" rx="4" fill="#ffffff" stroke="#e2e8f0"/>`;
  s += `<text x="${mx}" y="${y - 10}" font-size="12" fill="#1e293b" text-anchor="middle">${esc(text)}</text>`;
  return s;
}
// 便签
function note(x, y, w, h, t, color = 'white') {
  const c = C[color] || C.white;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
  const lines = Array.isArray(t) ? t : [t];
  lines.forEach((ln, i) => {
    s += `<text x="${x + w / 2}" y="${y + 20 + i * 17}" font-size="11.5" fill="${c.text}" text-anchor="middle">${esc(ln)}</text>`;
  });
  return s;
}
// 时序分段横条
function section(y, text, x = 60, w = 1120) {
  return `<rect x="${x}" y="${y}" width="${w}" height="26" rx="6" fill="#e2e8f0"/>
<text x="${x + 14}" y="${y + 18}" font-size="13" font-weight="700" fill="#334155">${esc(text)}</text>`;
}
// 菱形判断
function diamond(cx, cy, w, h, text, color = 'white') {
  const c = C[color] || C.white;
  const pts = `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
  let s = `<polygon points="${pts}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.6"/>`;
  const lines = Array.isArray(text) ? text : [text];
  lines.forEach((ln, i) => {
    s += `<text x="${cx}" y="${cy - (lines.length - 1) * 7 + i * 15 + 4}" font-size="12" font-weight="700" fill="${c.text}" text-anchor="middle">${esc(ln)}</text>`;
  });
  return s;
}

module.exports = { doc, title, band, box, arrow, arrowPath, link, legend, lifeline, msg, activation, save, C, wlen, msg2, note, section, diamond };
