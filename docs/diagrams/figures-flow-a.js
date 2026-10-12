const L = require('./lib');
const { doc, title, box, arrow, arrowPath, lifeline, note, section, save, C } = L;

// ============ 图 5：认证 / JWT / 单点登录 时序 ============
function authFlow() {
  let b = '';
  b += title('认证与会话时序：登录 · 请求鉴权 · 登出', 'JWT + Redis 实现无状态鉴权与单点登录（新登录踢掉旧会话）');
  const X = { user: 120, fe: 360, be: 620, redis: 880, db: 1120 };
  const top = 120, bottom = 918;
  b += lifeline(X.user, top, bottom, '用户 / 客户端', 'client');
  b += lifeline(X.fe, top, bottom, '前端 Vue', 'client');
  b += lifeline(X.be, top, bottom, '后端 Express', 'server');
  b += lifeline(X.redis, top, bottom, 'Redis', 'cache');
  b += lifeline(X.db, top, bottom, 'MySQL', 'db');

  b += section(128, '① 登录（POST /api/users/login）');
  b += L.msg2(X.user, X.fe, 178, '输入邮箱 + 密码');
  b += L.msg2(X.fe, X.be, 216, 'POST /users/login {email,password}');
  b += L.msg2(X.be, X.db, 254, 'SELECT * FROM users WHERE email=?');
  b += L.msg2(X.db, X.be, 292, '返回用户与 password_hash', 'arrow', true);
  b += note(X.be - 80, 308, 160, 40, ['bcrypt.compare 校验', '失败返回 401'], 'sec');
  b += L.msg2(X.be, X.redis, 372, '删旧 user_onlyid / onlyid_token（踢旧登录）', 'arrowRed');
  b += L.msg2(X.be, X.redis, 410, '写会话三键（TTL 7 天）+ 签发 JWT');
  b += L.msg2(X.be, X.fe, 448, '200 { token, user }', 'arrowGreen', true);
  b += note(X.fe - 80, 464, 160, 40, ['内存/加密存储 token', '后续请求放入请求头'], 'client');

  b += section(520, '② 已登录请求（auth 中间件）');
  b += L.msg2(X.fe, X.be, 572, 'Authorization: Bearer <token>');
  b += L.msg2(X.be, X.redis, 610, '查 token_blacklist + 比对 onlyid');
  b += L.msg2(X.redis, X.be, 648, '校验通过', 'arrow', true);
  b += note(X.be - 80, 664, 160, 36, ['黑名单/单点不符 → 401'], 'sec');
  b += L.msg2(X.be, X.db, 720, '执行业务查询');
  b += L.msg2(X.be, X.fe, 758, '200 + 业务数据', 'arrowGreen', true);

  b += section(790, '③ 登出（POST /api/users/logout）');
  b += L.msg2(X.fe, X.be, 838, 'POST /users/logout（带 token）');
  b += L.msg2(X.be, X.redis, 876, 'token 入黑名单 + 删除会话三键', 'arrowRed');
  b += L.msg2(X.be, X.fe, 912, 'Socket force-logout 踢下线 · 200', 'arrowGreen', true);

  return doc(1240, 958, b);
}

// ============ 图 6：AI 聊天（普通 + SSE 流式 + 落库）时序 ============
function aiChatSequence() {
  let b = '';
  b += title('AI 对话时序：普通请求 / SSE 流式 / 聊天落库', '/ai/chat 与 /ai/chat-stream 本身不写库，内容由前端另调 /users/chat 持久化');
  const X = { user: 120, fe: 350, be: 620, ai: 900, db: 1120 };
  const top = 120, bottom = 788;
  b += lifeline(X.user, top, bottom, '用户', 'client');
  b += lifeline(X.fe, top, bottom, '前端 Vue', 'client');
  b += lifeline(X.be, top, bottom, '后端 /ai', 'server');
  b += lifeline(X.ai, top, bottom, '外部大模型 API', 'ext');
  b += lifeline(X.db, top, bottom, 'MySQL', 'db');

  b += section(128, '① 普通问答：POST /api/ai/chat（一次性返回）');
  b += L.msg2(X.fe, X.be, 176, 'POST /ai/chat {message,history}');
  b += L.msg2(X.be, X.ai, 214, 'POST /chat/completions（非流式）');
  b += L.msg2(X.ai, X.be, 252, '完整 choices[0].message（JSON）', 'arrow', true);
  b += L.msg2(X.be, X.fe, 290, '200 { reply }', 'arrowGreen', true);

  b += section(320, '② 流式问答：POST /api/ai/chat-stream（SSE 逐字推送）');
  b += L.msg2(X.fe, X.be, 368, 'POST /ai/chat-stream');
  b += L.msg2(X.be, X.ai, 406, 'POST /chat/completions stream:true');
  b += L.msg2(X.ai, X.be, 444, '多个 data: {choices:[{delta}]} 数据块', 'arrow', true);
  b += L.msg2(X.be, X.fe, 482, 'res.write SSE data 逐块', 'arrowGreen');
  b += L.msg2(X.be, X.fe, 520, '持续推送直到 [DONE]', 'arrowGreen');
  b += note(X.fe - 80, 536, 160, 36, ['onmessage 累加 delta', '界面逐字渲染'], 'client');

  b += section(586, '③ 聊天记录落库（前端主动持久化）');
  b += L.msg2(X.fe, X.be, 634, 'POST /users/chat（用户消息 + AI 回复）');
  b += L.msg2(X.be, X.db, 672, 'INSERT chat_records（type=user / ai）', 'arrowAmber');
  b += L.msg2(X.be, X.fe, 710, '200 { success }', 'arrowGreen', true);
  b += note(X.be - 90, 726, 180, 44, ['AI 接口不落库；', '报告走 /users/analysis-report', '写入 analysis_reports'], 'db');

  return doc(1240, 800, b);
}

// ============ 图 7：预约 + Socket 实时聊天流程（三泳道） ============
function appointmentFlow() {
  let b = '';
  b += title('预约与专家实时聊天流程', '预约状态机 + Socket.IO 房间消息；消息经三级审核后入库并广播');

  const cols = [
    { x: 60, cx: 200, name: '普通用户', color: 'client' },
    { x: 440, cx: 620, name: '服务端（Express + Socket.IO）', color: 'server' },
    { x: 900, cx: 1040, name: '专家', color: 'server' },
  ];
  cols.forEach(c => {
    b += `<rect x="${c.x}" y="86" width="280" height="800" rx="12" fill="${C[c.color].fill}" stroke="${C[c.color].stroke}" stroke-width="1.4" stroke-dasharray="6 4" opacity="0.5"/>`;
    b += `<text x="${c.cx}" y="110" font-size="14" font-weight="700" fill="${C[c.color].stroke}" text-anchor="middle">${c.name}</text>`;
  });

  const W = 280;
  const node = (cx, y, t, color, lines) => box(cx - W / 2, y, W, lines ? 64 : 46, t, color, lines || [], { fs: 11.5, titleFs: 13 });

  b += node(200, 128, '选择专家 · 提交预约', 'client', ['POST /users/appointments']);
  b += node(620, 128, '校验 + 去重，创建预约', 'server', ['INSERT appointment_records', 'status = pending']);
  b += node(1040, 128, '收到预约通知', 'server', ['appointment-updated 推送']);
  b += node(1040, 224, '确认 / 拒绝预约', 'server', ['PUT /expert/appointments/:id/status', 'confirmed / rejected']);
  b += node(620, 224, '更新状态并广播', 'server', ['UPDATE status', '拒绝→流程结束']);
  b += node(340, 320, '双方加入预约房间', 'io', ['Socket join-room']);
  b += node(200, 400, '发送消息', 'client', ['send-message 事件']);
  b += node(620, 400, '三级审核 + 重算身份', 'sec', ['词库匹配 → AI 上下文复核', '服务端推导 receiver_id']);
  b += node(620, 496, '入库并广播', 'server', ['INSERT expert_chat', 'emit new-message']);
  b += node(1040, 496, '收到新消息 / 未读提醒', 'io', ['chat-notification']);
  b += node(1040, 592, '打开会话 · 标记已读', 'io', ['mark-read 事件']);
  b += node(620, 592, '更新已读并广播', 'server', ['UPDATE is_read=1']);
  b += node(1040, 688, '完成咨询', 'server', ['status = completed']);
  b += node(620, 688, '归档预约', 'db', ['UPDATE status 广播']);
  b += node(200, 688, '查看历史 / 档案', 'client', ['GET /expert/appointments/:id']);

  b += arrowPath([[340, 160], [480, 160]], 'arrow');
  b += arrowPath([[760, 160], [900, 160]], 'arrow');
  b += arrowPath([[1040, 192], [1040, 224]], 'arrow');
  b += arrowPath([[900, 256], [760, 256]], 'arrowGreen');
  b += arrowPath([[480, 256], [400, 256], [400, 320], [200, 320], [200, 352]], 'arrowGreen', false, 'confirmed', 2);
  b += arrowPath([[200, 384], [200, 400]], 'arrow');
  b += arrowPath([[340, 432], [480, 432]], 'arrowRed');
  b += arrowPath([[760, 528], [900, 528]], 'arrowGreen');
  b += arrowPath([[900, 624], [760, 624]], 'arrow');
  b += arrowPath([[1040, 672], [1040, 688]], 'arrow');
  b += arrowPath([[900, 720], [760, 720]], 'arrow');
  b += arrowPath([[480, 720], [340, 720]], 'arrow', true);

  b += note(60, 800, 1040, 70, [
    '预约状态机：pending（待确认）→ confirmed（已确认）→ completed（已完成）；任意阶段可 rejected（已拒绝）/ cancelled（用户取消）',
    '强制规则：接收方由服务端按预约参与方推导，禁止前端伪造；非 confirmed 不能进入咨询；非参与方不能收发消息',
  ], 'sec');

  return doc(1240, 900, b);
}

module.exports = { authFlow, aiChatSequence, appointmentFlow };
