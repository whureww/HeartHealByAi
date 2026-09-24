# 心愈 (XinYu)

一个桌面端心理健康服务平台：AI 心理咨询（流式对话）、心理测评（量表作答 → 计分 → 分级报告）、周期性 AI 分析报告、专家预约与实时私聊。

定位是把「AI 陪伴 → 测评 → 报告 → 真人专家」做成一条连续的心理关怀闭环，而非孤立的聊天机器人或量表工具。

## 功能特性

- **AI 心理咨询**：基于 DeepSeek 的流式对话，温和、不评判的倾诉空间
- **心理测评**：量表作答、自动计分、分级报告与历史记录
- **AI 周期报告**：基于倾诉与测评数据的周期性心理健康分析
- **专家预约与私聊**：预约心理专家，通过 Socket.IO 实时私聊（支持多设备在线状态、消息已读、离线通知）；同一用户对同一专家不可重复预约，用户与专家均可取消/拒绝预约，状态变更实时同步
- **专家名片审核**：专家在「我的名片」编辑姓名、职称、专长与简介并提交审核，管理员通过后名片才显示在专家列表；已上架名片再次修改会重新进入审核，防止内容被私自篡改
- **管理后台**：用户与预约的增、删、改、查（删除用户连带清理关联数据）、专家名片审核（通过上架 / 拒绝下架）
- **锁屏保护**：一键锁定 / 离开自动锁定，当前账户密码或管理员万能钥匙解锁
- **桌面集成**：系统托盘（后台常驻）、关闭行为设置（询问 / 最小化到托盘 / 直接退出）、全局快捷键 `Ctrl+Alt+H` 一键呼出/隐藏、系统通知；自动屏蔽浏览器式快捷键（鼠标侧键前进/回退、F5 刷新、Ctrl+滚轮缩放、Alt+方向键导航等），防止误触或绕过应用流程
- **主题系统**：亮 / 暗 / 跟随系统三态主题
- **本地数据安全**：本地会话与配置经 AES-256-GCM 加密落盘（Rust 侧）
- **账号体系**：邮箱验证码注册 / 登录、找回密码，支持微信 / QQ OAuth 登录

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Tauri | 2.x |
| 前端框架 | Vue | 3.5+ |
| 语言 | TypeScript | 5.6+ |
| 构建工具 | Vite | 6.0+ |
| 后端框架 | Express | 4.21+ |
| 后端语言 | Node.js + TypeScript | >= 18 |
| 数据库 | MySQL | >= 8 |
| 缓存 | Redis | 4.7+（客户端） |
| 状态管理 | Pinia | 3.0+ |
| 路由 | Vue Router | 4.6+ |
| 实时通信 | Socket.io | 4.8+ |
| HTTP请求 | Axios | 1.16+ |
| 安装包 | Inno Setup | 7.x |

前后端通过 HTTP + Socket.IO 通信。

## 项目结构

```
AIHeartHealProject/
├── frontend/                 # 桌面客户端（Vue 3 + Tauri 2）
│   ├── src/
│   │   ├── api/              # 接口封装（ai / user / tests / expert / admin）
│   │   ├── views/            # 页面（dashboard / tests / expert / admin ...）
│   │   ├── components/       # 通用组件
│   │   ├── stores/           # Pinia 状态管理
│   │   ├── router/           # 路由与守卫
│   │   ├── utils/            # 工具（secureStore 加密存储等）
│   │   └── config.ts         # API_BASE / SOCKET_URL 全局配置
│   └── src-tauri/            # Tauri 壳（Rust），含应用图标与打包配置
└── backend/                  # 服务端（Express + TypeScript）
    ├── src/
    │   ├── index.ts          # 入口：HTTP + Socket.IO 实时聊天
    │   ├── routes/           # auth / users / tests / ai / expert / admin
    │   ├── middleware/       # JWT 鉴权、统一错误处理
    │   ├── db/               # MySQL 连接池、Redis
    │   └── utils/            # token 管理
    └── db/schema.sql         # 数据库建表脚本
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
npm run dev        # 浏览器开发预览（Vite）
npm run tauri:dev  # 桌面端开发模式
npm run tauri:build  # 打包 Windows 桌面应用（产出 target/release/心愈.exe）
```

### 4. 打包安装程序（Inno Setup）

```bash
# 先执行 npm run tauri:build 产出主程序，再运行：
"C:\Program Files\Inno Setup 7\ISCC.exe" frontend\src-tauri\windows\xinyu.iss
# 产物：frontend\src-tauri\target\release\bundle\inno\心愈_<版本>_x64-setup.exe
```

前端通过 `.env.development` / `.env.production` 中的 `VITE_API_BASE`、`VITE_SOCKET_URL` 指向后端地址，修改 `.env` 即可，无需改代码。

## 环境变量（backend/.env）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 服务端口 | `3001` |
| `JWT_SECRET` | JWT 签名密钥（生产必须配置） | 内置开发用密钥 |
| `BCRYPT_ROUNDS` | 密码哈希轮数 | `12` |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379` |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（AI 功能必需） | 无 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | 邮件服务器（验证码邮件） | `smtp.qq.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASS` | 发件邮箱账号与授权码 | 无（未配置时进入开发模式，验证码仅打印日志） |
| `APP_URL` | OAuth 回调使用的服务端地址 | 无 |
| `FRONTEND_URL` | OAuth 登录后重定向的前端地址 | 无 |
| `WECHAT_APPID` / `WECHAT_SECRET` | 微信 OAuth | 无 |
| `QQ_APPID` / `QQ_SECRET` | QQ OAuth | 无 |

## 健康检查

服务启动后可通过以下接口验证：

```bash
curl http://localhost:3001/health
```

## 免责声明

本项目为毕业设计作品。应用内的 AI 对话与测评结果仅用于自我探索与情绪支持，不构成医学诊断或治疗建议。如有心理健康困扰，请及时寻求专业机构或医生的帮助。
