# 心愈（XinYu）前后端接口文档

> 基础地址：`http://your-server-ip:3001/api`
> 认证方式：Bearer Token（登录后返回，存在 localStorage，请求头 `Authorization: Bearer <token>`）
> 通用响应格式：
> ```json
> { "success": true, "data": {}, "message": "" }
> ```
> 错误时 `success: false`，`code` 可能为 `SESSION_EXPIRED`。

---

## 目录

- [用户认证](#用户认证)
- [用户信息](#用户信息)
- [AI 聊天](#ai-聊天)
- [测评系统](#测评系统)
- [专家 / 预约](#专家--预约)
- [聊天记录与分析报告](#聊天记录与分析报告)
- [数据管理](#数据管理)
- [内容审核](#内容审核)
- [管理后台](#管理后台)
- [专家端接口](#专家端接口)
- [Tauri 本地命令](#tauri-本地命令)

---

## 用户认证

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/users/login` | 登录 | `{ email, password }` |
| POST | `/users/register` | 注册 | `{ username, email, password, code }` |
| POST | `/users/logout` | 退出登录 | — |
| POST | `/users/register/send-code` | 发送注册验证码 | `{ email }` |
| POST | `/users/forget-password/send-code` | 发送重置密码验证码 | `{ email }` |
| POST | `/users/forget-password/reset` | 重置密码 | `{ email, code, newPassword }` |

---

## 用户信息

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/me` | 获取当前用户信息 |
| PUT | `/users/profile` | 修改昵称 / 头像（`{ username }` 或 `{ avatar }`，avatar 为 base64） |
| GET | `/users/stats` | 用户统计数据 |

---

## AI 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/ai/chat` | 普通 AI 聊天，非流式。请求体 `{ messages: [{role, content}], context? }` |
| POST | `/ai/chat-stream` | 流式 AI 聊天，SSE 格式，每行 `data: { content }` |
| POST | `/ai/summarize-report` | 生成心理分析报告。请求体 `{ chatHistory, testResults, startDate, endDate }` |

---

## 测评系统

### HTTP 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/tests` | 获取可做的测评列表 |
| GET | `/tests/questions/{testId}` | 获取某测评的题目列表 |
| POST | `/tests/submit` | 提交测评答案。`{ test_id, answers: [{ question_id, score }] }` |
| GET | `/tests/history` | 测评历史记录 |
| GET | `/tests/result/{resultId}` | 单次测评结果详情 |
| POST | `/tests/ai/questions` | AI 智能测评：生成个性化问卷 |
| POST | `/tests/ai/submit` | AI 智能测评：提交回答，AI 评分。`{ paper_id?, questions?, answers: [{ label, text, score }] }` |

---

## 专家 / 预约

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/doctors` | 获取专家列表 |
| POST | `/users/appointments` | 创建预约。`{ doctorId }` |
| GET | `/users/appointments` | 获取我的预约列表 |
| PUT | `/users/appointments/{id}/cancel` | 取消预约 |

---

## 聊天记录与分析报告

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/users/chat-history` | 获取聊天历史 |
| POST | `/users/chat` | 保存聊天记录。`{ content, type }` |
| POST | `/users/analysis-report` | 保存分析报告。`{ startDate, endDate, content }` |
| GET | `/users/analysis-reports` | 获取分析报告列表 |

---

## 数据管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/users/clear-all` | 清空当前用户所有数据 |

---

## 内容审核

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/moderation/precheck` | 发送前预检敏感词。`{ content }` |

---

## 管理后台

### 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/users` | 用户列表（分页参数） |
| POST | `/admin/users` | 创建用户。`{ username, email, password, role, phone? }` |
| PUT | `/admin/users/{id}/role` | 修改用户角色。`{ role }` |
| DELETE | `/admin/users/{id}` | 删除用户 |
| GET | `/admin/stats` | 后台统计数据 |

### 测评管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/tests` | 测评列表 |
| POST | `/admin/tests` | 创建测评 |
| PUT | `/admin/tests/{id}/status` | 修改测评状态。`{ status }` |
| DELETE | `/admin/tests/{id}` | 删除测评 |

### 预约管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/appointments` | 全部预约列表 |
| POST | `/admin/appointments` | 创建预约。`{ user_id, doctor_id, status? }` |
| DELETE | `/admin/appointments/{id}` | 删除预约 |

### 专家名片审核

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/doctor-cards` | 待审核名片列表 |
| PUT | `/admin/doctor-cards/{id}/review` | 审核名片。`{ action: "approve" \| "reject" }` |

### 敏感词库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/sensitive-words` | 敏感词列表 |
| POST | `/admin/sensitive-words` | 添加敏感词。`{ word, category, is_short? }` |
| DELETE | `/admin/sensitive-words/{id}` | 删除敏感词 |

---

## 专家端接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/expert/appointments` | 我的预约列表 |
| GET | `/expert/appointments/{id}` | 预约详情 |
| PUT | `/expert/appointments/{id}/status` | 更新预约状态。`{ status }` |
| GET | `/expert/chat/{appointmentId}` | 预约聊天记录 |
| POST | `/expert/chat` | 发送聊天消息。`{ appointmentId, receiverId, content }` |
| GET | `/expert/stats` | 专家统计数据 |
| GET | `/expert/my-card` | 读取我的专家名片 |
| PUT | `/expert/my-card` | 保存并提交名片审核。`{ name, title, specialty, intro }` |

---

## Tauri 本地命令

> 以下不是 HTTP 接口，是 Tauri 前端通过 `invoke()` 调用的 Rust 本地命令，数据存储在本地 SQLite。

| 命令 | 参数 | 说明 |
|------|------|------|
| `get_tests` | — | 获取测评列表（本地） |
| `get_test_questions` | `{ testId }` | 获取测评题目（本地） |
| `submit_test_result` | `{ userId, req: { testId, testCode, answers } }` | 提交测评结果（本地） |
| `get_user_test_results` | `{ userId }` | 获取用户测评历史（本地） |

---

## 状态码说明

| code | 含义 |
|------|------|
| 200 | 成功 |
| 401 | 未登录 / token 过期 |
| 429 | 请求过于频繁 |
| 500 | 服务器错误 |

## 角色说明

| role 值 | 角色 |
|---------|------|
| 0 | 普通用户 |
| 1 | 专家 / 咨询师 |
| 2 | 管理员 |
