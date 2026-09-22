# 心愈 (XinYu)

一个桌面端心理健康服务平台：AI 心理咨询（流式对话）、心理测评（量表作答 → 计分 → 分级报告）、周期性 AI 分析报告、专家预约与实时私聊。

定位是把「AI 陪伴 → 测评 → 报告 → 真人专家」做成一条连续的心理关怀闭环，而非孤立的聊天机器人或量表工具。

## 功能特性

- **AI 心理咨询**：基于 DeepSeek 的流式对话，温和、不评判的倾诉空间
- **心理测评**：量表作答、自动计分、分级报告与历史记录
- **AI 周期报告**：基于倾诉与测评数据的周期性心理健康分析
- **专家预约与私聊**：预约心理专家，通过 Socket.IO 实时私聊（支持多设备在线状态、消息已读、离线通知）
- **管理后台**：用户管理、测评管理、预约管理
- **主题系统**：亮 / 暗 / 跟随系统三态主题
- **本地数据安全**：本地会话与配置经 AES-256-GCM 加密落盘（Rust 侧）
- **账号体系**：邮箱验证码注册 / 登录、找回密码，支持微信 / QQ OAuth 登录

## 技术栈

| 端 | 技术 |
| --- | --- |
| 前端 | Vue 3 + TypeScript + Pinia + Vue Router + Vite |
| 桌面端 | Tauri 2（Windows） |
| 后端 | Node.js + Express + TypeScript + Socket.IO |
| 数据库 | MySQL + Redis |
| AI | DeepSeek API |

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
npm run tauri:build  # 打包 Windows 桌面应用
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
