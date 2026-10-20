<div align="center">

# 心愈 · XinYu

**把「AI 陪伴 → 测评 → 报告 → 真人专家」做成一条连续的心理关怀闭环**

[![Release](https://img.shields.io/badge/release-v0.6.0-c0392b?logo=github)](https://github.com/whureww/HeartHealByAi/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS-blue)](#下载安装)
[![Desktop](https://img.shields.io/badge/Tauri-2.x-24C6DC?logo=tauri&logoColor=white)](https://v2.tauri.app/)
[![Vue](https://img.shields.io/badge/Vue-3.5-42B883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![Node](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

一个桌面端心理健康服务平台：AI 心理倾诉（流式对话 + 长期记忆）、心理测评（量表 + AI 智能出题）、
周期性 AI 分析报告（多语种翻译）、专家预约与实时私聊、社区内容治理（审核 / 举报 / 处置）。

[功能特性](#功能特性) · [技术架构](#技术架构) · [快速开始](#快速开始) · [下载安装](#下载安装) · [开发指南](#开发指南)

**[English](#overview-en)** · 简体中文

</div>

---

## 目录

- [功能特性](#功能特性)（[用户端](#用户端) / [专家端](#专家端) / [管理端](#管理端) / [桌面体验](#桌面体验) / [安全设计](#安全设计)）
- [技术架构](#技术架构)
- [快速开始](#快速开始)
- [下载安装](#下载安装)
- [开发指南](#开发指南)（项目结构 / 环境变量 / 数据库 / 健康检查）
- [路线图](#路线图)
- [免责声明](#免责声明)
- [English](#overview-en)

---

## 功能特性

### 用户端

| 功能 | 说明 |
| --- | --- |
| **AI 心理倾诉** | 流式对话（SSE 逐字上屏），温和不评判的倾诉空间；**RAG 长期记忆**跨会话记住你的近况与偏好，记忆可在界面查看与删除，隐私可控 |
| **实时翻译** | AI 回复逐句同步翻译（bilibili Index-Translate，32 种语言），原文 / 译文对照阅读 |
| **AI 智能测评** | 固定置顶入口，题目由 AI 实时生成（每次不同），AI 综合评分（0-100）并输出分级解读；问卷与作答明细完整入库 |
| **量表测评** | 传统量表作答、自动计分、分级报告与历史记录；管理员可维护题库 |
| **周期 AI 报告** | 汇总选定时段的倾诉与测评数据生成结构化分析报告，支持导出 HTML；**32 语种翻译**（保留 Markdown 排版） |
| **专家预约私聊** | 预约心理专家，Socket.IO 实时私聊（在线状态 / 已读回执 / 离线通知）；状态变更实时同步 |
| **聊天举报** | 勾选对方消息提交举报，由管理员核实处置（禁言 / 封禁） |
| **会话管理** | 多会话分组、AI 自动总结标题、会话锁定防误删、分页加载历史 |

### 专家端

| 功能 | 说明 |
| --- | --- |
| **我的名片** | 编辑姓名 / 职称 / 专长 / 简介（**中英双语**），提交管理员审核后上架 |
| **预约管理** | 确认 / 拒绝 / 完成预约，状态实时广播至用户端 |
| **咨询私聊** | 与预约用户一对一实时沟通；用户侧展示专家公开信息卡（不含隐私） |
| **自建测评问卷** | 专家可创建心理量表问卷，提交管理员审核上架后**全平台可见**（0.6.0 新增） |

### 管理端

| 功能 | 说明 |
| --- | --- |
| **用户管理** | 增删改查、角色调整（用户 / 专家 / 管理员）、账号限制状态展示 |
| **举报处置** | 核查举报并实时处置：禁言 / 封禁（24h / 72h / 7d / 永久），封禁立即踢线，到期自动解除；仅最新一条处置记录持有解除按钮 |
| **名片审核** | 专家名片上架 / 下架 |
| **敏感词库** | 可视化维护审核词库（主词 / 短词、分类），增删实时生效无需重启 |
| **量表与问卷审核** | 量表题库维护 + 专家自建问卷审核 |
| **万能钥匙** | 管理员凭密码解锁任意锁屏会话 |

内容安全采用**双层审核**：敏感词库（120+ 条，覆盖谐音 / 拆字 / 缩写变体）毫秒级拦截 + AI 语义复核（结合上下文识别隐晦骚扰，服务异常时 fail-open 降级，仅缓存通过结论防误判毒化）。

### 桌面体验

| 功能 | 说明 |
| --- | --- |
| **QQ 式托盘提醒** | 未读红色数字角标（1-8 数字 / 9+ 封顶）+ 图标交替频闪 + 悬浮消息卡片（DWM 位图绘制，跟随明暗主题，点击直达聊天） |
| **任务栏联动** | 后台消息橙色频闪 + 标题预览 + 悬浮缩略图变消息卡片；回前台自动还原；多链路送达只提醒一次 |
| **三态主题** | 亮色 / 暗色 / 跟随系统，托盘卡片自适应任务栏明暗 |
| **全应用双语** | 界面文案中英文一键切换（897 个语言键全覆盖），托盘 / 通知等系统文案同步跟随 |
| **全局快捷键** | `Ctrl+Alt+H` 任意界面一键呼出 / 隐藏（含锁屏与托盘后台）；自动屏蔽浏览器式快捷键防误触 |
| **双源自动更新** | Gitee + GitHub 并发检查、自动容灾取最高版本；发现新版由用户决定下载，实时进度条可取消 |
| **隐私保护** | 一键锁屏 / 离开自动锁定，锁屏状态跨重启保持；AES-256-GCM 加密本地凭据 |

### 安全设计

- **本地数据加密**：会话与配置经 AES-256-GCM 加密落盘（Rust 侧），密钥编译进二进制
- **会话安全**：JWT + Redis 会话映射，单点登录（新登录顶掉旧会话）；登出 / 锁屏即服务端真注销（token 黑名单）
- **接口权限**：角色三级 RBAC（用户 / 专家 / 管理员）+ 中间件双重校验；聊天读写与房间加入均做预约归属校验
- **参数可信**：消息收发双方由服务端按预约关系推导，不信任客户端身份字段
- **密钥安全**：用户自定义模型 API Key 以 AES-256-GCM 密文落库，接口仅回显末 4 位掩码

---

## 技术架构

```
+----------------------- 桌面客户端（Tauri 2 + Vue 3）-----------------------+
|  Vue 3 SPA · Pinia · Vue Router · vue-i18n（双语）· Socket.IO Client        |
|  Rust 壳：托盘角标/频闪 · DWM 悬浮卡片 · AES 加密存储 · 双源更新 · 快捷键    |
+----------------------------------+----------------------------------------+
                      HTTPS REST/JSON | WebSocket · SSE
+--------------------------------------v--------------------------------------+
|                服务端（Node.js 18+ · Express · TypeScript）                  |
|  中间件：JWT 鉴权 · 角色校验 · 统一错误处理 · zod 入参校验                    |
|  路由：users / auth / tests / ai / expert / admin / moderation / memory      |
|  业务：AI 主备容灾 · RAG 记忆 · 双层内容审核 · 多语种翻译 · 举报处置          |
+------+-------------+-------------+--------------+---------------------------+
       v             v             v              v
   MySQL 8        Redis       大模型 API    Index-Translate
 （15 张表） （会话/限流/词库）（OpenAI 兼容） （32 语种翻译）
```

| 层级 | 技术 | 版本 |
| --- | --- | --- |
| 桌面框架 | Tauri | 2.x |
| 前端 | Vue · Vue Router · Pinia · vue-i18n | 3.5 / 4.5 / 2.2 / 9.14 |
| 语言 | TypeScript（前后端） | 5.6 |
| 构建 | Vite · Inno Setup | 6.0 / 7.x |
| 后端 | Node.js · Express | >=18 / 4.21 |
| 实时通信 | Socket.IO | 4.8 |
| 数据库 / 缓存 | MySQL · Redis | >=8 / 4.7 |
| AI | OpenAI Chat Completions 兼容协议（DeepSeek / Kimi / Qwen / GLM 等）+ bilibili Index-Translate | — |

---

## 快速开始

### 环境要求

Node.js >= 18 · MySQL >= 8 · Redis（本地开发可选，生产必配）

### 1. 初始化数据库

```bash
mysql -u root -p < backend/db/schema.sql
```

> 脚本创建全部数据表并内置一份示例量表（情绪自评，PHQ-9 简化版）。管理员账号注册后在数据库中将 `users.role` 改为 `3` 即可。

### 2. 配置并启动后端

```bash
cd backend
npm install
cp .env.example .env    # 按需修改数据库 / Redis / AI Key 配置
npm run dev             # 开发模式（tsx watch），默认端口 3001
```

生产部署：

```bash
npm run build && npm start   # 运行 dist/index.js
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev          # 浏览器开发预览（Vite）
npm run tauri:dev    # 桌面端开发模式
npm run tauri:build  # 打包桌面应用
```

前端通过 `.env.development` / `.env.production` 的 `VITE_API_BASE`、`VITE_SOCKET_URL` 指向后端，无需改代码。

---

## 下载安装

前往 [Releases](https://github.com/whureww/HeartHealByAi/releases) 下载最新版本：

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows 10/11 x64 | `xin_yu_<版本>_x64-setup.exe` | Inno Setup 安装包，内置 WebView2 运行时检测与引导 |
| macOS 12+ | `XinYu_<版本>_aarch64.dmg` | Apple Silicon（Intel 版见 Release 附件） |

安装包也可在 [Gitee Releases](https://gitee.com/yxpil/aisprithill/releases) 获取（国内网络更快）。已安装用户可在应用内 **设置 → 关于** 一键检查更新。

---

## 开发指南

### 项目结构

```
AIHeartHealProject/
├── frontend/                 # 桌面客户端（Vue 3 + Tauri 2）
│   ├── src/
│   │   ├── api/              # 接口封装（axios 拦截器 / 会话过期机读标记）
│   │   ├── views/            # 页面（dashboard / tests / expert / admin）
│   │   ├── components/       # 公共组件（模型配置 / 锁屏 / 日期选择 / 图标）
│   │   ├── stores/           # Pinia（用户会话 / 设置 / 加载态）
│   │   ├── router/           # 路由与登录守卫（角色分级）
│   │   ├── i18n/             # 中英语言包（六组分片构建期静态合并）
│   │   ├── utils/            # 通知 / 任务栏 / 更新器 / 报告渲染 / 加密存储
│   │   └── config.ts         # API_BASE / SOCKET_URL
│   └── src-tauri/            # Tauri 壳（Rust）
│       ├── src/main.rs       # 托盘角标 / DWM 卡片 / 更新下载 / 加密
│       └── windows/xinyu.iss # Inno Setup 安装包脚本
└── backend/                  # 服务端（Express + TypeScript）
    ├── src/
    │   ├── index.ts          # 入口：HTTP + Socket.IO
    │   ├── routes/           # users / auth / tests / ai / expert / admin / moderation / memory
    │   ├── middleware/       # JWT 鉴权 / 统一错误处理
    │   ├── db/               # MySQL 连接池 / Redis
    │   └── utils/            # AI 客户端容灾 / RAG 记忆 / 翻译 / 审核 / 限制
    └── db/schema.sql         # 建表脚本（含示例量表）
```

### 环境变量（backend/.env）

<details>
<summary><b>点击展开完整配置表</b></summary>

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` | MySQL 连接五件套 | **必填** |
| `REDIS_URL` | Redis 连接地址 | `redis://localhost:6379` |
| `PORT` | 服务端口 | `3001` |
| `JWT_SECRET` | JWT 签名密钥（生产必须配置） | 内置开发密钥 |
| `BCRYPT_ROUNDS` | 密码哈希轮数 | `12` |
| `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` | 主 AI 厂商（OpenAI 兼容协议） | DeepSeek |
| `AI_FALLBACK_BASE_URL` / `AI_FALLBACK_API_KEY` / `AI_FALLBACK_MODEL` | 备用厂商三件套（主厂故障自动切换） | 无 |
| `DEEPSEEK_API_KEY` | DeepSeek 密钥（AI 功能必需，也可由 `AI_API_KEY` 代替） | 无 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | 邮件服务器 | `smtp.qq.com` / `465` / `true` |
| `SMTP_USER` / `SMTP_PASS` | 发件账号与授权码（未配置时验证码打印到日志） | 无 |
| `APP_URL` / `FRONTEND_URL` | OAuth 回调 / 登录后重定向地址 | 无 |
| `WECHAT_APPID` / `WECHAT_SECRET` · `QQ_APPID` / `QQ_SECRET` | 微信 / QQ OAuth | 无 |

</details>

### 数据库设计

15 张表（详见 `backend/db/schema.sql`）：

| 表 | 用途 | 表 | 用途 |
| --- | --- | --- | --- |
| `users` | 账号与角色 | `chat_sessions` | AI 会话分组 |
| `doctors` | 专家名片（双语） | `user_chat_models` | 用户自定义模型 |
| `appointment_records` | 预约单 | `chat_records` | AI 咨询记录（含向量） |
| `expert_chat` | 咨询私聊 | `user_memories` | RAG 长期记忆 |
| `psychological_tests` | 测评量表（含专家自建） | `analysis_reports` | AI 周期报告 |
| `test_questions` | 量表题目 | `user_oauth` | OAuth 绑定 |
| `test_results` | 作答结果 | `sensitive_words` | 审核词库 |
| `chat_reports` | 聊天举报 | | |

> 表结构变更采用**懒迁移**（首次访问自动补列 / 建表），存量部署无需手动执行 SQL。

### 健康检查

```bash
curl http://localhost:3001/health
```

---

## 路线图

- [x] 0.5.0 — RAG 长期记忆与向量检索、AI 记忆管理界面
- [x] 0.6.0 — 聊天实时翻译 + 报告 32 语种翻译、专家自建测评问卷、macOS 适配
- [ ] macOS CI 自动构建（当前 Mac 包由协作者本地构建）
- [ ] 离线模式（LlamaCPP 本地推理）
- [ ] 测评题目双语化、预约时段选择
- [ ] 自动化测试框架（Jest / Playwright）

---

## Overview (EN)

**XinYu** is a desktop mental-health service platform that turns "AI companionship, assessment, report, human expert" into one continuous care loop.

- **AI counseling**: streaming chat with RAG long-term memory (viewable and deletable), real-time sentence-level translation in 32 languages
- **Assessment**: traditional scales and AI-generated questionnaires with holistic scoring; experts can create their own scales pending admin review
- **Periodic AI reports**: structured analysis exportable as HTML, translatable into 32 languages
- **Expert booking and chat**: real-time private chat over Socket.IO with online status, read receipts and offline alerts
- **Community safety**: two-layer content moderation (120+ sensitive-word variants and AI semantic re-check), in-chat reporting with real-time mute/ban handling
- **Desktop polish**: QQ-style tray badge and blinking, DWM hover message cards, taskbar alerts, global shortcut, light/dark themes, full zh/en i18n, dual-source auto update
- **Security**: AES-256-GCM local storage, JWT + Redis single sign-on with token blacklist, role-based access control, server-side identity derivation

See the Chinese sections above for full details.

---

## 贡献

欢迎 Issue 与 PR。提交前请确保 `backend` 通过 `npm run build`、`frontend` 通过 `npm run build`。

## 许可证

[MIT](LICENSE) · 本项目为毕业设计作品

## 免责声明

> 应用内的 AI 对话与测评结果仅用于自我探索与情绪支持，**不构成医学诊断或治疗建议**。如有心理健康困扰，请及时寻求专业机构或医生的帮助。如果你正处于危机之中，请立即联系当地心理援助热线或紧急服务。
