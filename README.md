# 心愈 AI心理系统

> 一款基于 Tauri 的跨平台桌面心理服务应用，提供私密、专业、智能的心理健康服务。

[![License](https://img.shields.io/github/license/yourusername/heartheal-ai)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/yourusername/heartheal-ai)](https://github.com/yourusername/heartheal-ai/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/yourusername/heartheal-ai)](https://github.com/yourusername/heartheal-ai/network/members)

## ✨ 功能特性

- **🤖 AI心理倾诉**: 基于 DeepSeek 的智能心理陪伴，流式输出，实时响应
- **📋 心理测评中心**: 内置焦虑自评量表 (SAS) 等专业心理测评，智能评分与等级评估
- **👩‍⚕️ 专家在线问诊**: 认证心理咨询师在线服务，支持预约与实时聊天
- **📊 周期AI分析报告**: 汇总对话与测评数据，生成系统性心理状态分析报告
- **👤 个人中心**: 资料管理、外观设置、数据备份与恢复

## 🛠️ 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 桌面框架 | Tauri | 2.x |
| 前端框架 | Vue | 3.5+ |
| 语言 | TypeScript | 5.6+ |
| 构建工具 | Vite | 6.0+ |
| 后端语言 | Rust | 2021 |
| 数据库 | SQLite | (rusqlite 0.32) |
| 状态管理 | Pinia | 3.0+ |
| 路由 | Vue Router | 4.6+ |
| 实时通信 | Socket.io | 4.8+ |
| HTTP请求 | Axios | 1.16+ |

## 📁 项目结构

```
tauri-frontend/
├── src/                          # 前端源码
│   ├── api/                      # API 请求层
│   ├── components/               # 公共组件
│   ├── views/                    # 页面视图
│   │   ├── dashboard/            # 仪表盘
│   │   ├── tests/                # 测评模块
│   │   ├── expert/               # 专家模块
│   │   └── admin/                # 管理后台
│   ├── router/                   # 路由配置
│   ├── stores/                   # 状态管理
│   └── utils/                    # 工具函数
├── src-tauri/                    # Tauri 后端
│   ├── src/
│   │   ├── main.rs               # 主入口（系统托盘）
│   │   ├── lib.rs                # 库入口
│   │   └── commands/             # IPC 命令
│   │       ├── user.rs           # 用户命令
│   │       ├── system.rs         # 系统命令
│   │       └── test.rs           # 测评命令
│   └── app.db                    # SQLite 数据库（已忽略）
├── .env                          # 开发环境配置
├── .env.production               # 生产环境配置
└── package.json
```

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **Rust**: >= 1.70.0
- **Tauri CLI**: >= 2.0.0

### 安装依赖

```bash
# 安装前端依赖
npm install

# 安装 Tauri CLI（全局）
npm install -g @tauri-apps/cli
```

### 开发模式

```bash
# 启动开发服务器
npm run tauri dev
```

### 构建生产版本

```bash
# 构建生产版本
npm run tauri build

# 产物位置
# Windows: src-tauri/target/release/bundle/msi/
# macOS: src-tauri/target/release/bundle/dmg/
# Linux: src-tauri/target/release/bundle/deb/
```

## ⚙️ 配置说明

### 环境变量

在 `.env` 文件中配置：

```env
# API 基础地址
VITE_API_BASE_URL=http://localhost:3001/api

# Socket.io 地址
VITE_SOCKET_URL=http://localhost:3001

# 应用名称
VITE_APP_NAME=心愈 AI心理系统

# 应用版本
VITE_APP_VERSION=1.1.0
```

### 生产环境配置

在 `.env.production` 文件中配置生产环境地址：

```env
VITE_API_BASE_URL=http://your-server:3001/api
VITE_SOCKET_URL=http://your-server:3001
```

## 👥 角色权限

| 角色 | 功能权限 |
|------|----------|
| **普通用户** | AI倾诉、心理测评、预约专家、查看报告、数据管理 |
| **心理咨询师** | 专家工作台、预约管理、在线聊天、统计数据 |
| **系统管理员** | 用户管理、测评管理、预约管理、全功能访问 |

## 🔒 隐私安全

- 本地数据私密保存，无需上传到第三方服务器
- 敏感信息使用环境变量配置，不硬编码在代码中
- 数据库文件已添加到 `.gitignore`，避免意外泄露
- 使用 JWT Token 进行认证，支持自动过期处理

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 🙏 致谢

- [Tauri](https://tauri.app/) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [DeepSeek](https://www.deepseek.com/) - AI 服务提供商
- [Socket.io](https://socket.io/) - 实时通信库

## 📞 联系方式

如有问题或建议，欢迎提交 Issue 或发送邮件。

---

**心愈 AI心理系统** · Powered by DeepSeek · Built with Tauri + Vue 3 + Rust