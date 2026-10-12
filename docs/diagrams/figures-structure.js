const L = require('./lib');
const { doc, title, band, box, arrow, arrowPath, link, legend, save } = L;

// ============ 图 1：系统总体架构 ============
function architecture() {
  let b = '';
  b += title('心愈（XinYu）系统总体架构', 'Tauri 2 + Vue 3 桌面端  /  Node.js + Express 服务端  /  MySQL + Redis 存储');

  // 客户端层
  b += band(40, 92, 1160, 200, '客户端层（Tauri 桌面端，同时兼容浏览器）', 'client');
  const cy = 128, ch = 140;
  const clients = [
    ['Vue 3 单页应用', ['Pinia 状态管理', 'Vue Router + 守卫', 'Vite 构建']],
    ['Tauri 2 原生壳', ['Rust (main.rs)', '本地 SQLite', '系统 WebView']],
    ['Axios HTTP 客户端', ['request.ts 封装', 'Bearer Token 注入', '401/429 拦截']],
    ['Socket.IO Client', ['实时聊天', '在线状态', '预约状态推送']],
    ['页面视图', ['用户端 / 专家端', '管理后台', '锁屏 / 对话框']],
  ];
  const cw = 215; const cxs = [60, 291, 522, 753, 984];
  clients.forEach((c, i) => { b += box(cxs[i], cy, cw, ch, c[0], 'client', c[1], { fs: 12.5 }); });

  // 通信层
  const comms = [
    ['HTTPS · REST / JSON', '请求/响应，业务 CRUD', 150],
    ['WebSocket · Socket.IO', '实时聊天 / 状态广播', 505],
    ['SSE · text/event-stream', 'AI 回复逐字流式推送', 880],
  ];
  comms.forEach(([t, d, x]) => {
    b += box(x, 312, 230, 56, t, 'io', [d], { fs: 12, titleFs: 13 });
  });

  // 后端层
  b += band(40, 396, 1160, 236, '服务端层（Node.js + Express，端口 3001）', 'server');
  // 接入三件套
  b += box(60, 422, 340, 80, 'Express HTTP 服务器', 'server', ['CORS · express.json(5mb)', 'morgan 日志 · 路由挂载'], { fs: 12 });
  b += box(430, 422, 340, 80, '认证与错误中间件', 'sec', ['authenticate：JWT 验签/黑名单/单点', 'errorHandler 统一异常处理'], { fs: 12 });
  b += box(800, 422, 369, 80, 'Socket.IO 实时引擎', 'io', ['房间 / 在线连接表', '消息审核 · 强制下线'], { fs: 12 });
  // 7 个路由模块
  const routes = ['users\n用户认证', 'auth\n短信/OAuth', 'tests\n测评', 'ai\nAI 聊天', 'expert\n专家端', 'admin\n管理后台', 'moderation\n内容审核'];
  const rw = 150; const rxs = [60, 222, 384, 546, 708, 870, 1032];
  routes.forEach((r, i) => {
    const [t, d] = r.split('\n');
    b += `<rect x="${rxs[i]}" y="510" width="${rw}" height="96" rx="8" fill="${L.C.server.fill}" stroke="${L.C.server.stroke}" stroke-width="1.6"/>`;
    b += `<text x="${rxs[i] + rw / 2}" y="548" font-size="14" font-weight="700" fill="${L.C.server.text}" text-anchor="middle">${t}</text>`;
    b += `<text x="${rxs[i] + rw / 2}" y="572" font-size="12" fill="#334155" text-anchor="middle">${d}</text>`;
    b += `<text x="${rxs[i] + rw / 2}" y="592" font-size="11" fill="#64748b" text-anchor="middle">/api/${t}</text>`;
  });

  // 数据 / 外部层
  b += band(40, 652, 1160, 184, '数据层与外部服务', 'db');
  const stores = [
    ['MySQL · 库 xinyu', ['InnoDB · utf8mb4', '12 张业务表', 'mysql2 连接池'], 'db'],
    ['Redis', ['验证码 / 限流', 'JWT 会话·单点登录', 'token 黑名单 / 词库'], 'cache'],
    ['外部大模型 API', ['AI 对话 / 报告', 'AI 出题 / 评分', '内容 AI 复核'], 'ext'],
    ['SMTP 邮件服务', ['注册验证码', '找回密码邮件', 'nodemailer'], 'ext'],
    ['微信 / QQ OAuth', ['第三方授权登录', 'openid 绑定', 'user_oauth'], 'ext'],
  ];
  stores.forEach((s, i) => { b += box(cxs[i], 688, cw, 130, s[0], s[2], s[1], { fs: 12.5 }); });

  // 连线：客户端 -> 通信
  b += arrow(265, 268, 265, 310, 'arrowBlue');
  b += arrow(620, 268, 620, 310, 'arrow');
  b += arrow(990, 268, 990, 310, 'arrow');
  // 通信 -> 后端
  b += arrow(265, 368, 230, 420, 'arrowGreen');
  b += arrow(620, 368, 600, 420, 'arrow');
  b += arrow(990, 368, 985, 420, 'arrow');
  // 后端 -> 数据层
  [265, 500, 620, 860, 990].forEach((x, i) => {
    const mks = ['arrowAmber', 'arrow', 'arrow', 'arrow', 'arrow'];
    b += arrow(x, 632, x, 686, mks[i]);
  });

  // 顶部横排图例
  [
    { t: '客户端', c: 'client' }, { t: '服务端', c: 'server' }, { t: '数据库', c: 'db' },
    { t: '缓存', c: 'cache' }, { t: '外部服务', c: 'ext' },
  ].forEach((it, i) => {
    const c = L.C[it.c];
    const x = 720 + i * 102;
    b += `<rect x="${x}" y="30" width="16" height="14" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>`;
    b += `<text x="${x + 22}" y="42" font-size="12.5" fill="#334155">${it.t}</text>`;
  });

  return doc(1240, 860, b);
}

// ============ 图 2：前端工程结构 ============
function frontendStructure() {
  let b = '';
  b += title('前端工程结构（frontend/）', 'Vue 3 + TypeScript + Vite + Tauri 2，状态管理 Pinia，本地壳 Rust');

  // 根
  b += box(470, 86, 300, 50, 'frontend/  （Vite + Vue3 + TS）', 'client', [], { titleFs: 15 });

  // src 与 src-tauri 两大分支
  b += arrowPath([[620, 136], [620, 160], [360, 160], [360, 178]], 'arrowBlue');
  b += arrowPath([[620, 136], [620, 160], [880, 160], [880, 178]], 'arrowBlue');
  b += box(210, 178, 300, 44, 'src/  Web 前端源码', 'client', [], { titleFs: 14 });
  b += box(730, 178, 300, 44, 'src-tauri/  Tauri 原生壳（Rust）', 'client', [], { titleFs: 14 });

  // src 下模块（两列布局）
  const mods = [
    ['main.ts / App.ts', ['应用入口、根组件']],
    ['config.ts', ['API_BASE / SOCKET_URL / token']],
    ['api/  接口层', ['request.ts(axios 封装)', 'user · ai · tests', 'admin · expert · moderation']],
    ['views/  页面', ['用户端 · 专家端', 'admin/ 管理后台', 'auth/ 登录注册']],
    ['components/  组件', ['TitleBar · LockScreen', '各类 Dialog · 图标']],
    ['stores/  Pinia', ['user · settings · loading']],
    ['router/  路由', ['index 路由表', 'guards 登录守卫']],
    ['composables/', ['useTauri 原生桥接']],
    ['utils/  工具', ['secureStore 加密存储', 'updater 自动更新', 'reportRender · validate 等']],
  ];
  // 3 列 x 3 行
  const colX = [70, 400, 730];
  const rowY = [244, 392, 540];
  const mw = 300, mh = 132;
  mods.forEach((m, i) => {
    const cx = colX[i % 3];
    const cy = rowY[Math.floor(i / 3)];
    b += box(cx, cy, mw, mh, m[0], 'client', m[1], { fs: 12.5 });
  });
  // src 到各模块的连接（简化为竖线汇聚）
  b += link(360, 222, 360, 244);
  b += link(220, 222, 220, 244, false);
  b += link(550, 222, 550, 244, false);

  // src-tauri 内容
  const tauriMods = [
    ['Cargo.toml', ['Rust 依赖清单', 'tauri 2.x · serde · rusqlite']],
    ['tauri.conf.json', ['窗口/图标/bundle 配置', 'bundle.targets = all']],
    ['src/main.rs', '#[tauri::command] 本地命令', ['get_tests', 'get_test_questions', 'submit_test_result', 'get_user_test_results', '更新源 URL 常量']],
    ['本地 SQLite', ['离线测评数据', '测评题库 / 结果']],
  ];
  // 右侧栏放不下，改放底部一行
  const ty = 700;
  const tw = 278;
  const txs = [70, 372, 674, 976];
  tauriMods.forEach((m, i) => {
    b += box(txs[i], ty, tw, 150, m[0], 'io', Array.isArray(m[1]) ? m[1] : [m[1], ...m[2]], { fs: 12 });
  });
  // src-tauri 到下方
  b += arrowPath([[880, 222], [880, 680], [1115, 680], [1115, 698]], 'arrow', true);

  // 标注
  b += `<text x="70" y="684" font-size="13" font-weight="700" fill="${L.C.io.stroke}">src-tauri/ 原生能力（invoke 桥接，离线 SQLite）</text>`;

  return doc(1324, 882, b);
}

// ============ 图 3：后端分层架构 ============
function backendStructure() {
  let b = '';
  b += title('后端工程结构与请求流转（backend/src/）', 'Express 分层：入口 → 中间件 → 路由 → 工具/数据，Socket.IO 与 HTTP 共用 HTTP 服务');

  // 入口
  b += box(420, 86, 400, 56, 'index.ts  应用入口', 'server',
    ['创建 Express + httpServer + Socket.IO，挂载路由 / 中间件，维护在线连接表'], { fs: 12 });

  // 请求流入箭头
  b += arrow(620, 142, 620, 168, 'arrowGreen', false, 'HTTP / WS 请求', 90, 0);

  // 中间件层
  b += band(60, 170, 1120, 92, '中间件层（每个请求先经过）', 'sec');
  b += box(90, 204, 340, 46, '', 'sec', ['morgan 日志 · CORS 跨域 · express.json(5mb)'], { fs: 12.5 });
  b += box(470, 204, 320, 46, '', 'sec', ['middleware/auth.ts：JWT 验签'], { fs: 12.5 });
  b += box(830, 204, 320, 46, '', 'sec', ['黑名单 / onlyId 单点登录校验'], { fs: 12.5 });

  b += arrow(620, 262, 620, 288, 'arrowGreen');

  // 路由层
  b += band(60, 290, 1120, 150, '路由层 routes/（按业务拆分，asyncHandler 统一捕获异常）', 'server');
  const rs = [
    ['users.ts', '认证/资料/聊天/预约/报告'],
    ['auth.ts', '图形/短信验证码·OAuth'],
    ['tests.ts', '量表 + AI 智能测评'],
    ['ai.ts', '对话/流式/总结报告'],
    ['expert.ts', '名片/预约/咨询聊天'],
    ['admin.ts', '用户/问卷/审核/词库'],
    ['moderation.ts', '发送前敏感词预检'],
  ];
  const rw = 150; const gap = 9;
  const startX = 78;
  rs.forEach((r, i) => {
    const x = startX + i * (rw + gap);
    b += `<rect x="${x}" y="326" width="${rw}" height="92" rx="8" fill="${L.C.server.fill}" stroke="${L.C.server.stroke}" stroke-width="1.6"/>`;
    b += `<text x="${x + rw / 2}" y="360" font-size="13.5" font-weight="700" fill="${L.C.server.text}" text-anchor="middle">${r[0]}</text>`;
    // 两行描述
    const parts = r[1].split('/');
    b += `<text x="${x + rw / 2}" y="386" font-size="11" fill="#334155" text-anchor="middle">${parts[0]}</text>`;
    b += `<text x="${x + rw / 2}" y="403" font-size="11" fill="#334155" text-anchor="middle">${parts[1] || ''}</text>`;
  });

  b += arrow(620, 440, 620, 466, 'arrowGreen');

  // 工具/数据层
  b += band(60, 468, 1120, 130, '工具层 utils/ 与数据访问层 db/', 'db');
  const utils = [
    ['aiClient.ts', ['callAI / callAIJson', '流式参数适配多家厂商', 'extractDeltaChunk'], 'ext'],
    ['moderation.ts', ['敏感词加载/匹配', 'checkMessageContentAI', 'AI 结合上下文复核'], 'sec'],
    ['tokenManager.ts', ['会话三键 / 黑名单', 'generateOnlyId', '单点登录'], 'cache'],
    ['guards.ts', ['isAppointmentParticipant', '预约归属校验'], 'server'],
    ['db/mysql.ts', ['mysql2 连接池 pool', 'execute / query'], 'db'],
    ['db/redis.ts', ['ioredis 客户端', '验证码/会话/限流'], 'cache'],
  ];
  const uw = 175; const ugap = 10;
  const ustart = 78;
  utils.forEach((u, i) => {
    const x = ustart + i * (uw + ugap);
    b += box(x, 502, uw, 82, u[0], u[2], u[1], { fs: 10.8, titleFs: 12.5 });
  });

  // 底层存储
  b += box(200, 618, 360, 82, 'MySQL · xinyu 库', 'db', ['12 张业务表 · InnoDB · utf8mb4', 'mysql2 连接池 pool'], { fs: 12 });
  b += box(680, 618, 360, 82, 'Redis（db0）', 'cache', ['验证码 · 会话 · 黑名单', '限流 · 敏感词缓存'], { fs: 12 });
  b += arrow(380, 598, 380, 616, 'arrowAmber');
  b += arrow(860, 598, 860, 616, 'arrow');

  // Socket.IO 旁路说明
  b += box(90, 714, 1060, 74, 'Socket.IO 实时通道（与 HTTP 共用 3001 端口）', 'io',
    ['authenticate 鉴权 → join-room 预约房间 → send-message（服务端重算身份/接收方 + 内容审核后入库并广播）→ mark-read',
      '服务端主动推送：new-message / chat-notification / appointment-updated / doctor-list-updated / user-status-change / force-logout'], { fs: 12.5 });

  return doc(1240, 814, b);
}

// ============ 图 4：数据库 ER 关系图 ============
function databaseER() {
  let b = '';
  b += title('数据库 ER 关系图（MySQL · 库 xinyu · 12 张表）', '字段细节见 docs/API.md 附录 A；菱形文字标注基数关系');

  // 中心 users
  b += box(510, 120, 220, 120, 'users 用户', 'client',
    ['id (PK)', 'username / email / phone', 'password_hash', 'role  1用户 2专家 3管理员', 'avatar · created_at'], { fs: 12 });

  // 实体框统一尺寸
  const ew = 250, eh = 96;
  const ent = (x, y, name, color, fields) => box(x, y, ew, eh, name, color, fields, { fs: 11.5, titleFs: 13.5 });

  // 左侧（用户产生的数据）
  b += ent(60, 90, 'user_oauth 第三方绑定', 'ext', ['id (PK) · user_id (FK)', 'provider(wechat/qq)', 'openid · unionid']);
  b += ent(60, 250, 'chat_records AI聊天', 'db', ['id (PK) · user_id (FK)', 'content · type(user/ai)', 'created_at']);
  b += ent(60, 410, 'analysis_reports 报告', 'db', ['id (PK) · user_id (FK)', 'start_date · end_date', 'content(MD)']);
  b += ent(60, 570, 'ai_test_papers AI问卷', 'cache', ['id (PK) · user_id (FK)', 'questions(JSON)', '每次生成即落库']);

  // 右侧
  b += ent(930, 90, 'doctors 专家名片', 'server', ['id (PK) · user_id→users', 'name/title/specialty/intro', 'status 0下架1上架2待审核']);
  b += ent(930, 250, 'appointment_records 预约', 'server', ['id (PK)', 'user_id→users · doctor_id→doctors', 'status · created_at']);
  b += ent(930, 430, 'expert_chat 咨询聊天', 'io', ['id (PK)', 'sender_id/receiver_id→users', 'appointment_id→预约 · is_read']);
  b += ent(930, 610, 'sensitive_words 敏感词', 'sec', ['id (PK) · word (唯一)', 'category · is_short', '全局共享，启动加载内存']);

  // 中下：测评三表
  b += ent(360, 340, 'test_results 测评结果', 'db', ['id (PK) · user_id (FK)', 'test_id→量表 · test_code', 'answers(JSON) · total_score', 'result_level · result_desc']);
  b += ent(660, 340, 'psychological_tests 量表', 'cache', ['id (PK) · code(AI-GEN)', 'name/category/total_questions', 'result_levels(JSON) · status']);
  b += ent(660, 520, 'test_questions 题目', 'cache', ['id (PK) · test_id (FK)', 'question_number · content', 'reverse_scoring · options(JSON)']);

  // 关系连线（users 为中心）
  // users - oauth (1:N)
  b += arrowPath([[510, 160], [310, 138]], 'arrow');
  b += `<text x="330" y="130" font-size="11.5" fill="#475569">1 : N</text>`;
  // users - chat_records
  b += arrowPath([[510, 190], [310, 285]], 'arrow');
  b += `<text x="330" y="250" font-size="11.5" fill="#475569">1 : N</text>`;
  // users - reports
  b += arrowPath([[510, 220], [310, 450]], 'arrow');
  b += `<text x="330" y="400" font-size="11.5" fill="#475569">1 : N</text>`;
  // users - ai papers
  b += arrowPath([[510, 240], [310, 610]], 'arrow');
  b += `<text x="320" y="560" font-size="11.5" fill="#475569">1 : N</text>`;
  // users - doctors (1:1)
  b += arrowPath([[730, 160], [930, 138]], 'arrow');
  b += `<text x="870" y="130" font-size="11.5" fill="#475569">1 : 1</text>`;
  // users - appointments
  b += arrowPath([[730, 190], [930, 285]], 'arrow');
  b += `<text x="858" y="250" font-size="11.5" fill="#475569">1 : N</text>`;
  // users - expert_chat
  b += arrowPath([[730, 230], [930, 470]], 'arrow');
  b += `<text x="855" y="410" font-size="11.5" fill="#475569">1 : N（收/发）</text>`;
  // users - test_results
  b += arrowPath([[560, 240], [485, 340]], 'arrow');
  b += `<text x="470" y="300" font-size="11.5" fill="#475569">1 : N</text>`;
  // doctors - appointments (1:N)
  b += arrowPath([[930, 180], [800, 250], [800, 275], [1055, 275], [1055, 250]], 'arrow');
  b += `<text x="800" y="240" font-size="11.5" fill="#475569">1 : N</text>`;
  // appointments - expert_chat (1:N)
  b += arrowPath([[1055, 346], [1055, 430]], 'arrow');
  b += `<text x="1066" y="395" font-size="11.5" fill="#475569">1 : N</text>`;
  // test_results - psychological_tests (N:1)
  b += arrowPath([[610, 388], [660, 388]], 'arrow');
  b += `<text x="612" y="380" font-size="11.5" fill="#475569">N : 1</text>`;
  // psychological_tests - test_questions (1:N)
  b += arrowPath([[785, 436], [785, 520]], 'arrow');
  b += `<text x="795" y="485" font-size="11.5" fill="#475569">1 : N</text>`;
  // test_results - users 已连；ai 测评也写 test_results
  b += arrowPath([[485, 520], [485, 436]], 'arrow', true);

  // 横排图例
  const lg = [
    { t: '用户/账号', c: 'client' }, { t: '业务核心', c: 'server' }, { t: '测评/数据', c: 'db' },
    { t: '量表配置', c: 'cache' }, { t: '实时通信', c: 'io' }, { t: '安全/外部', c: 'sec' },
  ];
  lg.forEach((it, i) => {
    const c = L.C[it.c] || L.C.white;
    const x = 60 + i * 190;
    b += `<rect x="${x}" y="720" width="16" height="14" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>`;
    b += `<text x="${x + 22}" y="732" font-size="12" fill="#334155">${it.t}</text>`;
  });
  b += `<text x="60" y="762" font-size="12" fill="#64748b">注：schema 未建物理外键约束，关系由应用层维护；管理员删除用户时在代码中级联清理 8 张关联表。</text>`;

  return doc(1240, 792, b);
}

module.exports = { architecture, frontendStructure, backendStructure, databaseER };
