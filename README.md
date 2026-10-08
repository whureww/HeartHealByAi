# 心愈 (XinYu)

![Platform](https://img.shields.io/badge/platform-Windows%2010%2B-blue) ![Desktop](https://img.shields.io/badge/desktop-Tauri%202-orange) ![Frontend](https://img.shields.io/badge/frontend-Vue%203-brightgreen) ![Backend](https://img.shields.io/badge/backend-Node.js%20%2B%20Express-green) ![DB](https://img.shields.io/badge/database-MySQL%208%20%2B%20Redis-red)

一个桌面端心理健康服务平台：AI 心理咨询（流式对话）、心理测评（量表作答 → 自动计分 → 分级报告）、周期性 AI 分析报告、专家预约与实时私聊。

定位是把「AI 陪伴 → 测评 → 报告 → 真人专家」做成一条连续的心理关怀闭环，而非孤立的聊天机器人或量表工具。

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  AI 倾诉陪伴 │ --> │  心理测评     │ --> │ 周期分析报告 │ --> │  专家预约私聊 │
│  DeepSeek   │     │  计分+分级    │     │  趋势洞察    │     │  Socket.IO   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

## 功能特性

### 用户端

- **AI 心理咨询**：基于 DeepSeek 的流式对话，温和、不评判的倾诉空间
- **AI 智能测评**：固定置顶的个性化测评入口，题目由 AI 实时生成（每次内容不同），作答后由 AI 综合评分（0-100）并输出分级解读与建议；生成的问卷与作答明细完整入库，专家端可查看完整的「问题 + 选项 + 用户选择」
- **心理测评**：量表作答、自动计分、分级报告与历史记录；管理员可在后台维护量表题库
- **AI 周期报告**：基于倾诉与测评数据的周期性心理健康分析，可导出纯文本
- **专家预约与私聊**：预约心理专家，Socket.IO 实时私聊（多设备在线状态、消息已读、离线通知、双方头像展示）；用户与专家均可取消/拒绝预约，状态变更实时同步；同一用户对同一专家不可重复预约
- **专家列表实时同步**：管理员上/下架专家名片后，所有在线用户的专家列表即时自动刷新

### 专家端

- **专家名片审核**：在「我的名片」编辑姓名、职称、专长与简介并提交审核，管理员通过后名片才显示在专家列表
- **预约管理**：查看来自用户的预约，确认或拒绝，拒绝后用户可重新预约
- **咨询私聊**：与预约用户一对一实时沟通，双方头像展示；内置内容审核，不文明/违规内容自动拦截

### 管理端

- **管理后台**：用户与预约的增、删、改、查（删除用户连带清理关联数据）
- **名片审核**：专家名片通过上架 / 拒绝下架
- **量表管理**：心理测评的题库维护
- **万能钥匙**：管理员凭密码可解锁任意锁屏会话（服务端验证后为原账户换发凭据）

### 桌面体验

- **桌面集成**：系统托盘（后台常驻）、关闭行为设置（询问 / 最小化到托盘 / 直接退出）、全局快捷键 `Ctrl+Alt+H` 一键呼出/隐藏、系统通知
- **快捷键屏蔽**：自动屏蔽浏览器式快捷键（鼠标侧键前进/回退、F5 刷新、Ctrl+滚轮缩放、Alt+方向键导航等），防止误触或绕过应用流程
- **主题系统**：亮 / 暗 / 跟随系统三态主题
- **自动检查更新**：启动静默检查 + 设置页手动检查，自动比对 Gitee Releases 版本号；发现新版由用户决定是否下载，下载过程显示实时进度条并支持随时取消，完成后一键安装（退出程序并唤起安装向导）

### 安全设计

- **本地数据加密**：会话与配置经 AES-256-GCM 加密落盘（Rust 侧），密钥编译进二进制
- **会话安全**：JWT + Redis 会话映射，支持单点登录（新登录顶掉旧会话）；登出 / 锁屏即服务端真注销（token 黑名单），被截获的旧凭据无法复用
- **锁屏保护**：一键锁定 / 离开自动锁定（仅登录后生效）；锁屏状态跨重启保持；解锁须凭账户密码或管理员万能钥匙
- **接口权限**：角色分级（用户 / 专家 / 管理员），管理与专家接口双重校验；聊天记录读取、发送与实时房间加入均做预约归属校验，无关账号无法越权访问他人会话
- **参数可信**：消息收发双方由服务端按预约关系推导，不信任客户端传入的身份字段

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Tauri | 2.x |
| 前端框架 | Vue | 3.5+ |
| 语言 | TypeScript | 5.6+ |
| 构建工具 | Vite | 6.0+ |
| 状态管理 | Pinia | 3.0+ |
| 路由 | Vue Router | 4.6+ |
| 实时通信 | Socket.io | 4.8+ |
| HTTP请求 | Axios | 1.16+ |
| 后端框架 | Express | 4.21+ |
| 后端语言 | Node.js + TypeScript | >= 18 |
| 数据库 | MySQL | >= 8 |
| 缓存 | Redis | 4.7+（客户端） |
| AI | DeepSeek API | - |
| 安装包 | Inno Setup | 7.x |

前后端通过 HTTP + Socket.IO 通信。

## 项目结构

```
AIHeartHealProject/
├── frontend/                 # 桌面客户端（Vue 3 + Tauri 2）
│   ├── src/
│   │   ├── api/              # 接口封装（ai / user / tests / expert / admin）
│   │   ├── views/            # 页面（dashboard / tests / expert / admin ...）
│   │   ├── components/       # 通用组件（锁屏、图标、对话框等）
│   │   ├── stores/           # Pinia 状态管理（用户会话等）
│   │   ├── router/           # 路由与守卫（登录态、角色分级）
│   │   ├── utils/            # 工具（secureStore 加密存储、通知、对话框等）
│   │   └── config.ts         # API_BASE / SOCKET_URL 全局配置
│   └── src-tauri/            # Tauri 壳（Rust）
│       ├── src/main.rs       # 加密存储、托盘、快捷键、检查更新
│       └── windows/xinyu.iss # Inno Setup 安装包脚本
└── backend/                  # 服务端（Express + TypeScript）
    ├── src/
    │   ├── index.ts          # 入口：HTTP + Socket.IO 实时聊天
    │   ├── routes/           # auth / users / tests / ai / expert / admin
    │   ├── middleware/       # JWT 鉴权、统一错误处理
    │   ├── db/               # MySQL 连接池、Redis
    │   └── utils/            # token 管理、预约归属校验
    └── db/schema.sql         # 数据库建表脚本（含示例量表）
```

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 8
- Redis
- Rust + WebView2（仅 Tauri 桌面端构建需要）

### 1. 初始化数据库

```bash
mysql -u root -p < backend/db/schema.sql
```

脚本会创建全部数据表并内置一个示例量表（情绪自评，PHQ-9 简化版），管理员账号需手动插入（`role = 3`）。

### 2. 配置并启动后端

在 `backend/` 下创建 `.env`（参考下方环境变量），然后：

```bash
cd backend
npm install
npm run dev        # 开发模式（tsx watch），默认端口 3001
```

生产部署：

```bash
npm run build
npm start          # 运行 dist/index.js
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev          # 浏览器开发预览（Vite）
npm run tauri:dev    # 桌面端开发模式
npm run tauri:build  # 打包 Windows 桌面应用（产出 target/release/心愈.exe）
```

前端通过 `.env.development` / `.env.production` 中的 `VITE_API_BASE`、`VITE_SOCKET_URL` 指向后端地址，修改即可，无需改代码。

### 4. 打包安装程序（Inno Setup）

```bash
# 先执行 npm run tauri:build 产出主程序，再运行：
"C:\Program Files\Inno Setup 7\ISCC.exe" frontend\src-tauri\windows\xinyu.iss
# 产物：frontend\src-tauri\target\release\bundle\inno\心愈_<版本>_x64-setup.exe
```

## 环境变量（backend/.env）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `MYSQL_HOST` | MySQL 地址 | **必填** |
| `MYSQL_PORT` | MySQL 端口 | **必填** |
| `MYSQL_USER` | MySQL 用户名 | **必填** |
| `MYSQL_PASSWORD` | MySQL 密码 | **必填** |
| `MYSQL_DATABASE` | 数据库名 | **必填** |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379` |
| `PORT` | 服务端口 | `3001` |
| `JWT_SECRET` | JWT 签名密钥（生产必须配置） | 内置开发用密钥 |
| `BCRYPT_ROUNDS` | 密码哈希轮数 | `12` |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（AI 功能必需） | 无 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | 邮件服务器（验证码邮件） | `smtp.qq.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASS` | 发件邮箱账号与授权码 | 无（未配置时进入开发模式，验证码仅打印日志） |
| `APP_URL` | OAuth 回调使用的服务端地址 | 无 |
| `FRONTEND_URL` | OAuth 登录后重定向的前端地址 | 无 |
| `WECHAT_APPID` / `WECHAT_SECRET` | 微信 OAuth | 无 |
| `QQ_APPID` / `QQ_SECRET` | QQ OAuth | 无 |

## 数据库设计

共 10 张表（详见 `backend/db/schema.sql`）：

| 表 | 用途 |
| --- | --- |
| `users` | 账户（role：1 用户 / 2 专家 / 3 管理员） |
| `doctors` | 专家名片（审核状态：0 下架 / 1 上架 / 2 待审核） |
| `appointment_records` | 预约单（pending / confirmed / rejected / cancelled） |
| `expert_chat` | 咨询私聊消息 |
| `psychological_tests` | 测评量表 |
| `test_questions` | 量表题目（支持反向计分） |
| `test_results` | 作答结果与分级报告 |
| `chat_records` | AI 咨询记录 |
| `analysis_reports` | AI 周期分析报告 |
| `user_oauth` | 微信 / QQ OAuth 绑定 |

## 健康检查

服务启动后可通过以下接口验证：

```bash
curl http://localhost:3001/health
```

## 免责声明

本项目为毕业设计作品。应用内的 AI 对话与测评结果仅用于自我探索与情绪支持，不构成医学诊断或治疗建议。如有心理健康困扰，请及时寻求专业机构或医生的帮助。
