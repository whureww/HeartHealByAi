const L = require('./lib');
const { doc, title, box, arrow, arrowPath, note, diamond, save, C } = L;

// ============ 图 8：测评流程（固定量表 vs AI 智能测评） ============
function testFlow() {
  let b = '';
  b += title('心理测评流程：固定量表计分 vs AI 智能测评', '两条路径最终都写入 test_results；AI 路径额外落 ai_test_papers 并 upsert AI-GEN 量表');

  b += box(470, 86, 300, 48, '进入测评中心', 'client', [], { titleFs: 14 });
  b += arrow(620, 134, 620, 152);
  b += diamond(620, 188, 200, 72, ['选择测评方式'], 'white');
  b += `<text x="470" y="180" font-size="12" font-weight="700" fill="#059669">固定量表</text>`;
  b += `<text x="720" y="180" font-size="12" font-weight="700" fill="#7c3aed">AI 智能测评</text>`;

  const lx = 250;
  const left = [
    ['GET /tests/list 拉取上架量表', 'server', ['仅 status=1 且 code≠AI-GEN']],
    ['GET /tests/questions/:id', 'server', ['量表 + 题目/选项 JSON']],
    ['前端逐题作答', 'client', []],
    ['POST /tests/submit', 'server', ['{testId, answers}']],
    ['服务端规则计分', 'db', ['sum 求和 · 反向计分', '按 result_levels 匹配分级']],
  ];
  left.forEach((n, i) => {
    const y = 250 + i * 92;
    b += box(lx - 150, y, 300, n[2].length ? 64 : 46, n[0], n[1], n[2], { fs: 11.5, titleFs: 12.5 });
    if (i > 0) b += arrow(lx, y - 28, lx, y);
  });
  b += arrowPath([[520, 188], [lx, 188], [lx, 250]], 'arrowGreen');

  const rx = 990;
  const right = [
    ['POST /tests/ai/questions', 'cache', ['{symptoms} 描述症状，AI 出题']],
    ['写 ai_test_papers', 'db', ['题目落库，返回 paper_id']],
    ['前端逐题作答', 'client', []],
    ['POST /tests/ai/submit', 'cache', ['{paperId, answers}']],
    ['取回问卷 + AI 评分', 'ext', ['调大模型打分给结论', 'upsert 量表 code=AI-GEN']],
  ];
  right.forEach((n, i) => {
    const y = 250 + i * 92;
    b += box(rx - 150, y, 300, n[2].length ? 64 : 46, n[0], n[1], n[2], { fs: 11.5, titleFs: 12.5 });
    if (i > 0) b += arrow(rx, y - 28, rx, y);
  });
  b += arrowPath([[720, 188], [rx, 188], [rx, 250]], 'arrow');

  b += arrowPath([[lx, 710], [lx, 740], [620, 740]], 'arrowAmber');
  b += arrowPath([[rx, 710], [rx, 740], [620, 740]], 'arrowAmber');
  b += box(470, 740, 300, 56, '写入 test_results', 'db', ['总分 / 分级 / 结果描述'], { fs: 11.5 });
  b += arrow(620, 796, 620, 814);
  b += box(430, 814, 380, 50, '查看结果与历史', 'client', ['GET /tests/history · /result/:id'], { fs: 11.5 });

  return doc(1240, 884, b);
}

// ============ 图 9：内容审核三级流程 ============
function moderationFlow() {
  let b = '';
  b += title('聊天内容三级审核流程', '前端毫秒预检 → 服务端词库秒级拦截 → AI 结合上下文复核；命中即不入库');

  b += box(470, 86, 300, 46, '用户输入聊天消息', 'client', [], { titleFs: 14 });
  b += arrow(620, 132, 620, 152);

  const stages = [
    ['① 前端预检  POST /moderation/precheck', 'client', 156,
      ['浏览器端内存敏感词库，毫秒级匹配；命中直接标红拦截，请求根本不发出']],
    ['② 服务端词库二次校验（send-message 内）', 'server', 268,
      ['启动时从 sensitive_words 加载内存；主词「包含匹配」+ 缩写短词「独立词边界匹配」，拦截绕过前端的请求']],
    ['③ AI 上下文复核  checkMessageContentAI', 'ext', 380,
      ['取该会话最近 6 条消息作为上下文，交大模型识别隐晦表达、变体、缩写与真实意图']],
  ];
  stages.forEach(([t, c, y, lines]) => {
    b += box(220, y, 800, 84, t, c, lines, { fs: 12.5, titleFs: 14 });
  });
  b += arrow(620, 240, 620, 266);
  b += arrow(620, 352, 620, 378);

  b += arrow(620, 464, 620, 482);
  b += diamond(620, 518, 180, 68, ['是否合规？'], 'white');

  b += arrowPath([[530, 518], [300, 518], [300, 580]], 'arrowGreen', false, '合规', 0);
  b += box(150, 580, 300, 82, '入库并投递', 'server', ['INSERT expert_chat', '广播 new-message', '未读 chat-notification'], { fs: 11.5 });

  b += arrowPath([[710, 518], [940, 518], [940, 580]], 'arrowRed', false, '违规', 0);
  b += box(790, 580, 300, 82, '拦截不入库', 'sec', ['返回警告提示', '严重（自伤/违法）', 'force-logout 强制下线'], { fs: 11.5 });

  b += note(60, 688, 520, 76, [
    '词库维护（管理员）：/admin/sensitive-words 增删词',
    '保存后调用 invalidateWords() 实时失效重载，无需重启服务',
    '表为空时自动播种内置默认词库（侮辱/色情/违禁/自伤/缩写）',
  ], 'db');

  return doc(1240, 786, b);
}

// ============ 图 10：CI/CD 多平台打包与发布 ============
function cicdFlow() {
  let b = '';
  b += title('CI/CD 多平台打包与双端发布流程', '推送 tag 触发 GitHub Actions 矩阵构建，产物汇总到 GitHub Release 后经 Gitee API 同步');

  b += box(40, 150, 180, 80, '推送版本 tag', 'client', ['git push github', '--tags（v*）', '如 v0.3.0_UpDate'], { fs: 11.5 });
  b += arrow(220, 190, 260, 190);

  b += box(260, 130, 200, 120, 'GitHub Actions', 'server', ['release.yml', 'on: push tags v*', 'actions/checkout', 'pnpm/setup-node', 'tauri-apps/tauri-action'], { fs: 11 });
  b += arrow(460, 190, 500, 190);

  b += L.band(500, 96, 420, 210, '构建矩阵（每个目标独立 runner）', 'server');
  b += box(516, 130, 188, 74, 'macos-latest', 'client', ['x86_64-apple-darwin', 'aarch64-apple-darwin', '产物 .app / .dmg'], { fs: 10.8, titleFs: 12.5 });
  b += box(716, 130, 188, 74, 'ubuntu-22.04', 'client', ['x86_64-unknown-linux-gnu', 'aarch64-unknown-linux-gnu', '产物 .AppImage/.deb'], { fs: 10.8, titleFs: 12.5 });
  b += box(516, 216, 388, 72, '每作业：pnpm install → tauri build', 'server',
    ['Rust 按 --target 编译；bundle.targets=all', 'Tauri 不支持跨 OS，macOS 包必须 macOS runner'], { fs: 11 });
  b += arrow(920, 190, 960, 190);

  b += box(960, 140, 240, 100, 'GitHub Release', 'db', ['tauri-action 汇总', '各平台安装包', '创建草稿 Release', '附带 release notes'], { fs: 11.5 });

  b += arrowPath([[1080, 240], [1080, 330], [260, 330], [260, 360]], 'arrowAmber');
  b += box(140, 360, 240, 92, '同步作业（Gitee API）', 'cache', ['下载 GitHub 产物', 'GITEE_TOKEN 鉴权', '创建 Gitee Release', '回传同名附件'], { fs: 11 });
  b += arrow(380, 406, 440, 406);
  b += box(440, 366, 240, 80, 'Gitee Releases', 'db', ['源码 + 多平台安装包', 'tag 与 Release 对齐'], { fs: 11.5 });

  b += note(720, 360, 480, 150, [
    '平台覆盖说明 / 现状',
    '· Windows：本机用 Inno Setup 产出 .exe（也可加 windows-latest 矩阵）',
    '· macOS：.dmg 只能由 macOS runner 构建，无法跨 OS 编译',
    '· Linux x64/arm64：ubuntu runner 构建；arm64 在 x64 上需交叉/模拟',
    '· RISC-V / armv7：官方 runner 无原生支持，需 QEMU + 交叉工具链',
    '· Gitee Go 需在网页开通后才能作为替代构建源',
  ], 'sec');

  b += note(140, 490, 1060, 64, [
    '当前状态：GitHub Actions 免费额度一度耗尽，跨平台产物待额度恢复后由本流水线自动生成；脚本与矩阵已就绪，重跑 tag 即可出包。',
    '密钥：GITEE_TOKEN 存于 GitHub Secrets；workflow 用 shell 判空决定是否同步，未配置时仅发布到 GitHub。',
  ], 'db');

  return doc(1240, 590, b);
}

module.exports = { testFlow, moderationFlow, cicdFlow };
