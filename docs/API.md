# 心愈（XinYu）前后端接口文档

## 0. 请求约定（务必先看）

**基础地址（Base URL）**：`http://<服务器IP>:3001/api`
> 完整 URL = Base URL + 文档中每个接口给出的路径。
> 例：登录接口路径 `/users/login`，完整 URL 为 `http://<服务器IP>:3001/api/users/login`。

**请求方法**：每个接口标题处明确标注 `GET / POST / PUT / DELETE`。

**请求头（Request Headers）**：

| Header | 值 | 是否必填 |
|--------|-----|---------|
| `Content-Type` | `application/json` | 有请求体时必填（POST/PUT） |
| `Authorization` | `Bearer <token>` | 除登录/注册/验证码外都必填 |

**参数传递位置**：

| 类型 | 位置 | 示例 |
|------|------|------|
| 路径参数 | URL 中 `{}` 部分 | `/users/appointments/56/cancel` 中的 `56` |
| 查询参数 | URL `?` 之后 | `/admin/users?page=1&pageSize=20&keyword=张` |
| 请求体 | Body（JSON） | 见各接口「请求体」代码块 |

**通用成功响应**：
```json
{ "success": true, "message": "操作成功", "data": {} }
```
**通用错误响应**（HTTP 状态码非 2xx）：
```json
{ "success": false, "message": "错误描述" }
```

### 三种调用方式示例（以登录接口为例）

**① curl**
```bash
curl -X POST "http://<服务器IP>:3001/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "123456"
  }'
```

**② 前端 fetch（需认证的接口）**
```js
const res = await fetch("http://<服务器IP>:3001/api/users/me", {
  method: "GET",
  headers: {
    "Authorization": "Bearer " + localStorage.getItem("token")
  }
});
const json = await res.json();
```

**③ axios（项目实际封装，见 frontend/src/api/request.ts）**
```js
import request from '@/api/request'
// baseURL 已配为 API_BASE，token 拦截器自动携带
const res = await request.post('/users/login', { email: "test@example.com", password: "123456" })
```

> **角色 role 取值**：
>
> | 值 | 角色 |
> |----|------|
> | 1 | 普通用户 |
> | 2 | 专家 / 咨询师 |
> | 3 | 管理员 |
>
> **预约状态 status 取值**：`pending`（待确认）、`confirmed`（已确认）、`rejected`（已拒绝）、`completed`（已完成）、`cancelled`（已取消）

---

## 目录

- [一、用户认证（/api/users）](#一用户认证apiusers)
- [二、第三方认证（/api/auth）](#二第三方认证apiauth)
- [三、AI 聊天（/api/ai）](#三ai-聊天apia i)
- [四、测评系统（/api/tests）](#四测评系统apitest s)
- [五、专家与预约（/api/users 普通用户侧）](#五专家与预约apiusers-普通用户侧)
- [六、内容审核（/api/moderation）](#六内容审核apimoderation)
- [七、管理后台（/api/admin）](#七管理后台apiadmin)
- [八、专家端（/api/expert）](#八专家端apiexpert)
- [九、Socket.IO 实时事件](#九socketio-实时事件)
- [十、Tauri 本地命令](#十tauri-本地命令)
- [附录 A、数据库与数据表设计](#附录-a数据库与数据表设计)
- [附录 B、接口—数据表映射总表](#附录-b接口数据表映射总表)

---

## 一、用户认证（/api/users）

### 1.1 邮箱注册——发送验证码

`POST /users/register/send-code`

**请求体：**
```json
{
  "email": "test@example.com"
}
```

**成功响应：**
```json
{
  "success": true,
  "message": "验证码已发送至邮箱"
}
```
开发模式（未配 SMTP）：
```json
{
  "success": true,
  "message": "验证码已生成（开发模式，见后端日志）"
}
```

**错误：** 邮箱已注册（400）、请求频繁（429，60 秒一次）

---

### 1.2 注册

`POST /users/register`

**请求体：**
```json
{
  "username": "小明",
  "email": "test@example.com",
  "password": "123456",
  "code": "483920",
  "phone": "13800138000"
}
```
> `phone` 可选。`password` 至少 6 位，`code` 必须 6 位数字。

**成功响应：**
```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "onlyId": "a1b2c3d4e5f6...",
    "userId": 12,
    "role": 1
  }
}
```

---

### 1.3 登录

`POST /users/login`

**请求体：**
```json
{
  "email": "test@example.com",
  "password": "123456"
}
```

**成功响应：**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "onlyId": "a1b2c3d4e5f6...",
    "userId": 12,
    "role": 1,
    "user": {
      "id": 12,
      "username": "小明",
      "email": "test@example.com",
      "phone": "13800138000",
      "avatar": "data:image/png;base64,...",
      "role": 1
    }
  }
}
```

**错误：** `{ "success": false, "message": "邮箱或密码错误" }`（401）

---

### 1.4 管理员万能钥匙解锁

`POST /users/master-login`

锁屏后管理员用自己的账号解锁任意普通用户会话。

**请求体：**
```json
{
  "admin_email": "admin@example.com",
  "admin_password": "admin123",
  "email": "test@example.com"
}
```

**成功响应：** 同 [1.3 登录](#13-登录)，返回被解锁用户的 token。

---

### 1.5 退出登录

`POST /users/logout`（需认证）

**请求体：** 无

**成功响应：**
```json
{ "success": true, "message": "登出成功" }
```
> 服务端会把当前 JWT 加入黑名单，并通过 Socket.IO 强制踢掉该用户所有在线连接。

---

### 1.6 刷新 Token

`POST /users/refresh-token`（需认证）

**成功响应：**
```json
{
  "success": true,
  "message": "Token刷新成功",
  "data": {
    "token": "eyJhbGciOi...新token",
    "onlyId": "新onlyId",
    "userId": 12,
    "role": 1
  }
}
```
> 旧 token 会被加入黑名单。

---

### 1.7 忘记密码——发送验证码

`POST /users/forget-password/send-code`

**请求体：**
```json
{ "email": "test@example.com" }
```

**成功响应：**
```json
{ "success": true, "message": "验证码已发送至邮箱" }
```
> 无论邮箱是否注册都返回成功（防止枚举账号）。

---

### 1.8 重置密码

`POST /users/forget-password/reset`

**请求体：**
```json
{
  "email": "test@example.com",
  "code": "483920",
  "newPassword": "newpass123"
}
```

**成功响应：**
```json
{ "success": true, "message": "密码重置成功，请使用新密码重新登录" }
```

---

### 1.9 获取当前用户信息

`GET /users/me`（需认证）

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 12,
    "username": "小明",
    "email": "test@example.com",
    "phone": "13800138000",
    "role": 1,
    "avatar": "data:image/png;base64,...",
    "created_at": "2026-09-01T10:00:00.000Z"
  }
}
```

---

### 1.10 修改个人信息

`PUT /users/profile`（需认证）

修改昵称：
```json
{ "username": "新昵称" }
```
修改头像（base64，必须以 `data:image/` 开头）：
```json
{ "avatar": "data:image/png;base64,iVBORw0KGgo..." }
```

**成功响应：**
```json
{ "success": true, "message": "个人信息更新成功" }
```

---

### 1.11 获取用户统计数据

`GET /users/stats`（需认证）

**成功响应：**
```json
{
  "success": true,
  "data": {
    "chatCount": 128,
    "testCount": 5,
    "doctorCount": 2,
    "reportCount": 3
  }
}
```

---

### 1.12 清空个人所有数据

`POST /users/clear-all`（需认证）

**请求体：** 无

**成功响应：**
```json
{ "success": true, "message": "所有数据已清空" }
```
> 会删除聊天记录、测评结果、分析报告、预约记录。

---

## 二、第三方认证（/api/auth）

### 2.1 获取图形验证码（SVG）

`GET /auth/captcha`

**响应：** `Content-Type: image/svg+xml`，响应头 `X-Captcha-Id: captcha:1728...`，Body 为 SVG 图片。验证码 5 分钟有效，存 Redis。

---

### 2.2 发送短信验证码

`POST /auth/sms-code`

**请求体：**
```json
{
  "phone": "13800138000",
  "captchaId": "captcha:1728...",
  "captchaCode": "3847"
}
```

**成功响应：**
```json
{ "success": true, "message": "验证码已发送" }
```
> 非生产环境额外返回 `"debugCode": "123456"`。60 秒内不可重复发送。

---

### 2.3 短信登录 / 一键注册

`POST /auth/sms-login`

**请求体：**
```json
{ "phone": "13800138000", "code": "123456" }
```

**成功响应：**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOi...",
    "onlyId": "xxx",
    "userId": 15,
    "role": 1,
    "username": "user_8000",
    "isNewUser": true
  }
}
```
> 手机号不存在时自动注册账号。

---

### 2.4 OAuth 第三方登录跳转

`GET /auth/oauth/:provider`，`:provider` 为 `wechat` 或 `qq`。

**成功响应：**
```json
{
  "success": true,
  "data": { "authUrl": "https://open.weixin.qq.com/connect/qrconnect?..." }
}
```

### 2.5 OAuth 回调

`GET /auth/oauth/callback/:provider?code=xxx`

> 由第三方平台回调，服务端处理完后 302 重定向到前端：
> `/oauth/callback?token=xxx&onlyId=xxx&isNewUser=false`

---

## 三、AI 聊天（/api/ai）

### 3.1 普通 AI 聊天（非流式）

`POST /ai/chat`（需认证）

**请求体：**
```json
{
  "messages": [
    { "role": "user", "content": "我最近压力很大" },
    { "role": "assistant", "content": "能具体说说吗？" },
    { "role": "user", "content": "工作上的事..." }
  ],
  "context": {
    "testResults": [{ "level": "轻度" }]
  }
}
```
> `context` 可选，作为用户背景数据拼入系统提示词。

**成功响应：**
```json
{
  "success": true,
  "content": "我能理解你的感受，工作压力确实会让人喘不过气...😊"
}
```

**错误响应：**
```json
{ "success": false, "error": "AI 服务暂时不可用: ..." }
```

---

### 3.2 流式 AI 聊天（SSE）

`POST /ai/chat-stream`（需认证）

**请求体：** 同 [3.1](#31-普通-ai-聊天非流式)。

**响应：** `Content-Type: text/event-stream`，逐块推送：
```
data: {"content":"我"}

data: {"content":"能"}

data: {"content":"理解"}

data: [DONE]
```
出错时推送：`data: {"error":"流式响应中断"}`

> 前端用 `fetch` + `ReadableStream` 读取（EventSource 不支持 POST）。

---

### 3.3 生成心理分析报告

`POST /ai/summarize-report`（需认证）

**请求体：**
```json
{
  "chatHistory": [
    { "created_at": "2026-10-01", "type": "user", "content": "最近睡不好..." }
  ],
  "testResults": [
    { "test_name": "PHQ-9", "total_score": 12, "result_level": "中度", "result_desc": "..." }
  ],
  "startDate": "2026-10-01",
  "endDate": "2026-10-12"
}
```

**成功响应：**
```json
{
  "success": true,
  "report": "# 心理健康分析报告\n## 一、情绪趋势\n...（Markdown 格式，800-1200 字）"
}
```

---

## 四、测评系统（/api/tests）

### 4.1 获取可做的测评列表

`GET /users/tests`（需认证，实际挂在 users 路由）

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "PHQ9",
      "name": "抑郁症筛查量表（PHQ-9）",
      "description": "用于筛查抑郁症状的自评量表",
      "category": "抑郁",
      "total_questions": 9,
      "estimated_minutes": 5,
      "scoring_method": "sum"
    }
  ]
}
```
> 不返回 AI 智能测评（code 为 `AI-GEN`）和未上架测评。

---

### 4.2 获取测评题目

`GET /tests/questions/{testId}`（需认证）

**成功响应：**
```json
{
  "success": true,
  "data": {
    "test": {
      "id": 1,
      "code": "PHQ9",
      "name": "抑郁症筛查量表（PHQ-9）",
      "description": "...",
      "total_questions": 9,
      "estimated_minutes": 5,
      "scoring_method": "sum"
    },
    "questions": [
      {
        "id": 10,
        "question_number": 1,
        "content": "做事时提不起劲或没有兴趣",
        "dimension": null,
        "reverse_scoring": false,
        "options": [
          { "score": 0, "text": "完全不会" },
          { "score": 1, "text": "几天" },
          { "score": 2, "text": "一半以上天数" },
          { "score": 3, "text": "几乎每天" }
        ]
      }
    ]
  }
}
```

---

### 4.3 提交测评结果

`POST /tests/submit`（需认证）

**请求体：**
```json
{
  "test_id": 1,
  "answers": [
    { "question_id": 10, "score": 1 },
    { "question_id": 11, "score": 2 }
  ]
}
```

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 88,
    "test_code": "PHQ9",
    "test_name": "抑郁症筛查量表（PHQ-9）",
    "total_score": 15,
    "result_level": "中度",
    "result_desc": "您存在中度问题，建议寻求专业帮助。",
    "completed_at": "2026-10-12T09:30:00.000Z"
  }
}
```
> 分级规则：量表配了 `result_levels` 按配置匹配；否则按默认：≤39 正常、≤49 轻度、≤59 中度、≥60 重度。

---

### 4.4 获取测评历史

`GET /tests/history`（需认证）

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 88,
      "code": "PHQ9",
      "name": "抑郁症筛查量表（PHQ-9）",
      "total_score": 15,
      "result_level": "中度",
      "result_desc": "...",
      "completed_at": "2026-10-12T09:30:00.000Z"
    }
  ]
}
```

---

### 4.5 获取单次测评结果详情

`GET /tests/result/{resultId}`（需认证）

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 88,
    "test_code": "PHQ9",
    "name": "抑郁症筛查量表（PHQ-9）",
    "answers": [
      { "question_id": 10, "score": 1 }
    ],
    "total_score": 15,
    "result_level": "中度",
    "result_desc": "...",
    "completed_at": "2026-10-12T09:30:00.000Z"
  }
}
```

---

### 4.6 AI 智能测评——生成个性化问卷

`POST /tests/ai/questions`（需认证）

**请求体：** 无

**成功响应：**
```json
{
  "success": true,
  "data": {
    "paper_id": 42,
    "name": "AI 智能测评",
    "description": "由 AI 根据常见心理健康维度实时生成的个性化自评问卷",
    "questions": [
      {
        "number": 1,
        "content": "最近一周，你是否经常感到情绪低落？",
        "options": [
          { "label": "A", "text": "几乎没有", "score": 0 },
          { "label": "B", "text": "偶尔有", "score": 1 },
          { "label": "C", "text": "经常有", "score": 2 },
          { "label": "D", "text": "几乎每天", "score": 3 }
        ]
      }
    ]
  }
}
```
> 题目 8-20 道，问卷内容会入库（`ai_test_papers` 表），提交时凭 `paper_id` 取回。

---

### 4.7 AI 智能测评——提交并由 AI 评分

`POST /tests/ai/submit`（需认证）

**请求体（推荐，带 paper_id）：**
```json
{
  "paper_id": 42,
  "answers": [
    { "label": "A", "text": "几乎没有", "score": 0 },
    { "label": "C", "text": "经常有", "score": 2 }
  ]
}
```
> `answers` 数量必须与问卷题目数一致。兼容旧客户端直接传 `questions` 数组。

**成功响应：**
```json
{
  "success": true,
  "data": {
    "id": 90,
    "test_code": "AI-GEN",
    "test_name": "AI 智能测评",
    "total_score": 45,
    "result_level": "轻度",
    "result_desc": "整体状态尚可，存在轻度情绪困扰。",
    "analysis": "从作答来看，你在睡眠和社交意愿维度得分偏高...建议：1. ... 2. ...",
    "completed_at": "2026-10-12T09:35:00.000Z"
  }
}
```
> `total_score` 0-100，`result_level` 为「正常 / 轻度 / 中度 / 重度」之一。

---

## 五、专家与预约（/api/users 普通用户侧）

### 5.1 获取专家列表

`GET /users/doctors`（需认证）

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "name": "李医生",
      "title": "国家二级心理咨询师",
      "specialty": "情绪管理、人际关系",
      "intro": "从业 8 年，擅长认知行为疗法...",
      "user_id": 7,
      "avatar": "data:image/png;base64,..."
    }
  ]
}
```
> 只返回 `status=1`（已上架且审核通过）的专家。

---

### 5.2 创建预约

`POST /users/appointments`（需认证）

**请求体：**
```json
{ "doctorId": 3 }
```

**成功响应：**
```json
{
  "success": true,
  "message": "预约成功",
  "data": { "id": 56 }
}
```

**错误：** 专家不存在（404）；已有进行中预约（409）：
```json
{ "success": false, "message": "您已有该专家的进行中预约，请勿重复预约" }
```

---

### 5.3 获取我的预约列表

`GET /users/appointments`（需认证）

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 56,
      "user_id": 12,
      "doctor_id": 3,
      "status": "pending",
      "created_at": "2026-10-12T09:00:00.000Z",
      "doctor_name": "李医生",
      "doctor_title": "国家二级心理咨询师"
    }
  ]
}
```

---

### 5.4 取消预约

`PUT /users/appointments/{id}/cancel`（需认证）

**请求体：** 无

**成功响应：**
```json
{ "success": true, "message": "预约已取消" }
```
> 仅 `pending` / `confirmed` 状态可取消。会通过 Socket.IO 实时通知专家。

---

### 5.5 聊天记录

**获取：** `GET /users/chat-history`（需认证）
```json
{
  "success": true,
  "data": [
    { "id": 1, "content": "你好", "type": "user", "created_at": "2026-10-12T09:00:00.000Z" }
  ]
}
```

**保存：** `POST /users/chat`（需认证）
```json
// 请求体
{ "content": "我最近很难过", "type": "user" }
```
```json
// 响应
{ "success": true, "data": { "id": 200 } }
```
> `type` 取值 `user`（用户发的）或 `ai`（AI 回复）。

---

### 5.6 分析报告

**保存：** `POST /users/analysis-report`（需认证）
```json
// 请求体
{
  "startDate": "2026-10-01",
  "endDate": "2026-10-12",
  "content": "# 报告正文（Markdown）..."
}
```
```json
// 响应
{ "success": true, "data": { "id": 9 } }
```

**列表：** `GET /users/analysis-reports`（需认证）
```json
{
  "success": true,
  "data": [
    {
      "id": 9,
      "start_date": "2026-10-01T00:00:00.000Z",
      "end_date": "2026-10-12T00:00:00.000Z",
      "content": "# 报告正文...",
      "created_at": "2026-10-12T10:00:00.000Z"
    }
  ]
}
```

---

## 六、内容审核（/api/moderation）

### 6.1 发送前敏感词预检

`POST /moderation/precheck`（需认证）

轻量本地词库检查（毫秒级，不调 AI），用于输入框即时提示。

**请求体：**
```json
{ "content": "你好" }
```

**通过：**
```json
{
  "success": true,
  "data": { "ok": true, "hit": null }
}
```

**命中敏感词：**
```json
{
  "success": true,
  "data": { "ok": false, "hit": "违禁词" }
}
```
> 此接口仅做前端体验优化；真正发送消息时服务端还会强制做「词库 + AI 复核」双重审核。

---

## 七、管理后台（/api/admin）

> 所有接口都需要 **role=3 管理员**，否则返回 403。

### 7.1 用户管理

#### 用户列表（分页 + 搜索）

`GET /admin/users?page=1&pageSize=20&keyword=张`

**成功响应：**
```json
{
  "success": true,
  "data": {
    "list": [
      {
        "id": 12,
        "username": "小明",
        "email": "test@example.com",
        "phone": "13800138000",
        "role": 1,
        "avatar": null,
        "created_at": "2026-09-01T10:00:00.000Z"
      }
    ],
    "total": 135,
    "page": 1,
    "pageSize": 20
  }
}
```

#### 创建用户（无需邮箱验证码）

`POST /admin/users`
```json
// 请求体
{
  "username": "李医生",
  "email": "doctor@example.com",
  "password": "123456",
  "role": 2,
  "phone": "13900139000"
}
```
```json
// 响应（创建专家时）
{ "success": true, "message": "专家账号创建成功，名片待本人完善并提交审核后上架" }
```
> 创建 role=2 专家时会自动建一条 `status=0`（下架）的空名片。

#### 修改用户角色

`PUT /admin/users/{id}/role`
```json
{ "role": 2 }
```
```json
{ "success": true, "message": "角色修改成功" }
```

#### 删除用户（连带清理业务数据）

`DELETE /admin/users/{id}`
```json
{ "success": true, "message": "用户及其关联数据已删除" }
```
> 不能删除当前登录账号自己。会级联删除预约、测评、聊天、报告、OAuth、名片。

---

### 7.2 平台统计

`GET /admin/stats`

```json
{
  "success": true,
  "data": {
    "totalUsers": 135,
    "totalExperts": 8,
    "totalAppointments": 42,
    "totalTests": 310
  }
}
```

---

### 7.3 测评（问卷）管理

#### 问卷列表

`GET /admin/tests?status=1`（status 不传返回全部）

**成功响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "PHQ9",
      "name": "抑郁症筛查量表（PHQ-9）",
      "description": "...",
      "category": "抑郁",
      "total_questions": 9,
      "estimated_minutes": 5,
      "scoring_method": "sum",
      "result_levels": "[{\"min\":0,\"max\":4,\"level\":\"正常\",\"desc\":\"...\"}]",
      "status": 1,
      "created_at": "..."
    }
  ]
}
```
> `status`：0 未上架、1 已上架、2 已下架。

#### 创建问卷

`POST /admin/tests`
```json
{
  "code": "GAD7",
  "name": "焦虑自评量表（GAD-7）",
  "description": "筛查广泛性焦虑",
  "category": "焦虑",
  "total_questions": 7,
  "estimated_minutes": 5,
  "scoring_method": "sum",
  "result_levels": [
    { "min": 0, "max": 4, "level": "正常", "desc": "无明显焦虑" },
    { "min": 5, "max": 9, "level": "轻度", "desc": "轻度焦虑" }
  ],
  "questions": [
    {
      "question_number": 1,
      "content": "感到紧张、焦虑或急躁",
      "dimension": null,
      "reverse_scoring": false,
      "options": [
        { "score": 0, "text": "完全不会" },
        { "score": 1, "text": "几天" },
        { "score": 2, "text": "一半以上天数" },
        { "score": 3, "text": "几乎每天" }
      ]
    }
  ]
}
```
```json
{
  "success": true,
  "message": "问卷创建成功，默认未上架",
  "data": { "id": 10 }
}
```

#### 上架 / 下架问卷

`PUT /admin/tests/{id}/status`
```json
{ "status": 1 }
```
```json
{ "success": true, "message": "问卷已已上架" }
```

#### 删除问卷

`DELETE /admin/tests/{id}`
```json
{ "success": true, "message": "问卷已删除" }
```

---

### 7.4 预约管理

#### 全部预约列表

`GET /admin/appointments`
```json
{
  "success": true,
  "data": [
    {
      "id": 56,
      "user_id": 12,
      "doctor_id": 3,
      "status": "pending",
      "created_at": "...",
      "user_name": "小明",
      "user_email": "test@example.com",
      "doctor_name": "李医生",
      "doctor_title": "国家二级心理咨询师"
    }
  ]
}
```

#### 代建预约

`POST /admin/appointments`
```json
{ "user_id": 12, "doctor_id": 3, "status": "pending" }
```
```json
{ "success": true, "message": "预约创建成功", "data": { "id": 57 } }
```

#### 删除预约

`DELETE /admin/appointments/{id}`
```json
{ "success": true, "message": "预约记录已删除" }
```

---

### 7.5 专家名片审核

#### 名片列表（含全部状态）

`GET /admin/doctor-cards`
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "name": "王医生",
      "title": "心理治疗师",
      "specialty": "青少年心理",
      "intro": "...",
      "status": 2,
      "created_at": "...",
      "user_email": "wang@example.com"
    }
  ]
}
```
> `status`：0 下架 / 1 上架 / 2 待审核。列表按「待审核优先」排序。

#### 审核名片

`PUT /admin/doctor-cards/{id}/review`
```json
{ "action": "approve" }
```
> `action`：`approve`（通过并上架，status→1）、`reject`（拒绝，status→0）

```json
{ "success": true, "message": "已通过，名片已上架专家列表" }
```
> 审核结果会通过 Socket.IO 广播 `doctor-list-updated` 事件。

---

### 7.6 敏感词库管理

#### 敏感词列表

`GET /admin/sensitive-words`
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "word": "违禁词",
      "category": "违禁",
      "is_short": 0,
      "created_at": "..."
    }
  ]
}
```
> `category`：侮辱 / 色情 / 违禁 / 自伤 / 缩写 / 其他；`is_short`：1 表示拼音缩写词。

#### 添加敏感词（实时生效）

`POST /admin/sensitive-words`
```json
{ "word": "新违禁词", "category": "侮辱", "is_short": false }
```
```json
{
  "success": true,
  "message": "敏感词已添加并即时生效",
  "data": { "id": 20 }
}
```

#### 删除敏感词（实时生效）

`DELETE /admin/sensitive-words/{id}`
```json
{ "success": true, "message": "敏感词已删除并即时生效" }
```

---

## 八、专家端（/api/expert）

> 除预约详情 / 聊天接口外，均需 **role=2 专家**。

### 8.1 我的名片

#### 读取名片

`GET /expert/my-card`
```json
{
  "success": true,
  "data": {
    "id": 5,
    "name": "李医生",
    "title": "国家二级心理咨询师",
    "specialty": "情绪管理",
    "intro": "...",
    "status": 1
  }
}
```
> 未建名片时 `data` 为 `null`。

#### 保存并提交审核

`PUT /expert/my-card`
```json
{
  "name": "李医生",
  "title": "国家二级心理咨询师",
  "specialty": "情绪管理、人际关系",
  "intro": "从业 8 年..."
}
```
```json
{ "success": true, "message": "名片已提交审核，管理员通过后将显示在专家列表" }
```
> 每次保存后 status 重置为 2（待审核）。

---

### 8.2 预约

#### 我的预约列表

`GET /expert/appointments`
```json
{
  "success": true,
  "data": [
    {
      "id": 56,
      "user_id": 12,
      "doctor_id": 3,
      "status": "pending",
      "created_at": "...",
      "user_name": "小明",
      "user_email": "test@example.com",
      "user_phone": "13800138000"
    }
  ]
}
```

#### 预约详情（含用户最近 5 次测评）

`GET /expert/appointments/{id}`
```json
{
  "success": true,
  "data": {
    "appointment": {
      "id": 56,
      "user_id": 12,
      "doctor_id": 3,
      "status": "pending",
      "user_name": "小明",
      "user_email": "test@example.com",
      "user_phone": "13800138000",
      "user_avatar": null,
      "doctor_avatar": null,
      "doctor_user_id": 7
    },
    "testResults": [
      {
        "id": 88,
        "test_code": "PHQ9",
        "test_name": "抑郁症筛查量表（PHQ-9）",
        "total_score": 15,
        "result_level": "中度",
        "result_desc": "...",
        "test_questions": "[{\"id\":10,\"content\":\"...\",\"options\":[...]}]"
      }
    ]
  }
}
```
> 普通用户只能看自己的预约，专家只能看自己名下的预约。

#### 更新预约状态

`PUT /expert/appointments/{id}/status`
```json
{ "status": "confirmed" }
```
> 允许值：`confirmed` / `rejected` / `cancelled` / `completed`

```json
{ "success": true, "message": "状态更新成功" }
```
> 会通过 Socket.IO 向预约房间和用户实时广播。

---

### 8.3 专家统计

`GET /expert/stats`
```json
{
  "success": true,
  "data": {
    "pendingCount": 3,
    "completedCount": 21,
    "unfinishedCount": 2,
    "totalPatients": 18
  }
}
```

---

### 8.4 专家 - 用户即时聊天（HTTP 兜底）

> 实时收发主要走 Socket.IO（见第九节），以下 HTTP 接口用于历史加载和离线补发。

#### 获取某预约的聊天记录

`GET /expert/chat/{appointmentId}`（用户和专家均可，需是预约参与方）
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sender_id": 12,
      "receiver_id": 7,
      "content": "医生您好",
      "appointment_id": 56,
      "is_read": 1,
      "created_at": "2026-10-12T09:00:00.000Z",
      "sender_name": "小明",
      "receiver_name": "李医生"
    }
  ]
}
```

#### 发送消息（HTTP）

`POST /expert/chat`
```json
{
  "appointmentId": 56,
  "content": "你好，有什么可以帮你？"
}
```
```json
{ "success": true, "message": "发送成功" }
```
> `receiverId` 由服务端按预约关系自动推导，无需传。消息会经过敏感词 + AI 双重审核，违规返回：
> `{ "success": false, "message": "消息包含不文明或违规内容，已被拦截" }`（400）

---

## 九、Socket.IO 实时事件

**连接地址**：`http://<服务器IP>:3001`（与 HTTP 同端口）

### 客户端 → 服务端

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `authenticate` | `{ token }` 或 token 字符串 | 连接后必须先认证，无效则收到 `auth-error` 并被断开 |
| `query-user-status` | `userId: number` | 查询某用户在线状态 |
| `join-room` | `appointmentId: number` | 加入预约房间（需是参与方） |
| `leave-room` | `appointmentId: number` | 离开房间 |
| `send-message` | `{ appointmentId, senderId, receiverId, content }` | 发送消息（senderId 必须与 token 一致，receiverId 服务端重算） |
| `mark-read` | `{ appointmentId, userId }` | 标记消息已读 |
| `user-logout` | `userId` | 主动登出并断开 |

### 服务端 → 客户端

| 事件名 | 数据 | 说明 |
|--------|------|------|
| `online-users` | `{ userIds: number[] }` | 认证后下发当前在线用户快照 |
| `user-status-change` | `{ userId, isOnline }` | 用户上 / 下线广播 |
| `user-joined-room` | `{ appointmentId, userId }` | 有人加入预约房间 |
| `new-message` | 消息对象（见下） | 房间内新消息广播 |
| `chat-notification` | `{ appointmentId, senderName, content }` | 定向发给接收方的通知 |
| `message-blocked` | `{ appointmentId, content, reason }` | 消息被审核拦截 |
| `appointment-updated` | `{ appointmentId, status, updaterId, updateTime }` | 预约状态变更（房间内） |
| `appointment-list-updated` | `{ userId, appointmentId, status, updaterId, updateTime }` | 预约状态变更（全局，前端按 userId 过滤） |
| `doctor-list-updated` | `{ doctorId, status, updateTime }` | 专家名片上下架广播 |
| `force-logout` | `{ message }` | 账号在别处登出，强制踢下线 |
| `auth-error` | `{ message }` | Socket 认证失败 |
| `error` | `{ message }` | 通用错误 |

**`new-message` 数据结构：**
```json
{
  "id": 1728700000000,
  "sender_id": 12,
  "receiver_id": 7,
  "content": "医生您好",
  "appointment_id": 56,
  "sender_name": "小明",
  "created_at": "2026-10-12T09:00:00.000Z"
}
```

---

## 十、Tauri 本地命令

> 以下不是 HTTP 接口，是桌面端通过 `@tauri-apps/api/core` 的 `invoke()` 调用的 Rust 本地命令，数据存本地 SQLite（离线测评用）。

| 命令 | invoke 参数 | 返回 | 说明 |
|------|------------|------|------|
| `get_tests` | 无 | `Test[]` | 本地测评列表 |
| `get_test_questions` | `{ testId }` | `TestQuestion[]` | 本地测评题目 |
| `submit_test_result` | `{ userId, req: { testId, testCode, answers } }` | `TestResult` | 提交结果到本地库 |
| `get_user_test_results` | `{ userId }` | `TestResult[]` | 本地测评历史 |

**Test 结构：**
```json
{
  "id": 1,
  "code": "PHQ9",
  "name": "抑郁症筛查量表（PHQ-9）",
  "description": "...",
  "category": "抑郁",
  "total_questions": 9,
  "estimated_minutes": 5,
  "scoring_method": "sum"
}
```

**TestQuestion 结构：**
```json
{
  "id": 10,
  "question_number": 1,
  "content": "做事时提不起劲或没有兴趣",
  "dimension": null,
  "reverse_scoring": false,
  "options": [
    { "score": 0, "text": "完全不会" },
    { "score": 1, "text": "几天" }
  ]
}
```

**TestResult 结构：**
```json
{
  "id": 88,
  "test_code": "PHQ9",
  "test_name": "抑郁症筛查量表（PHQ-9）",
  "total_score": 15,
  "result_level": "中度",
  "result_desc": "...",
  "completed_at": "2026-10-12 09:30:00"
}
```

---

## 附：HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 400 | 参数错误 / 业务校验失败（验证码错、状态不可改等） |
| 401 | 未登录 / token 过期 / 密码错误 |
| 403 | 权限不足（如普通用户访问管理接口） |
| 404 | 资源不存在 |
| 409 | 冲突（重复预约、邮箱已注册） |
| 429 | 请求过于频繁 |
| 500 / 502 / 503 | 服务器 / AI 服务异常 |

---

# 附录 A、数据库与数据表设计

## A.0 存储总览

| 存储 | 库 / 实例 | 用途 |
|------|-----------|------|
| **MySQL 8.x** | 库名 **`xinyu`**（字符集 `utf8mb4`，排序 `utf8mb4_unicode_ci`，引擎 InnoDB） | 全部业务持久化数据，共 **12 张表** |
| **Redis** | 默认 db0 | 验证码、登录会话 / 单点登录、token 黑名单、接口限流、敏感词内存缓存 |

建表脚本：`backend/db/schema.sql`（`mysql -u root -p < schema.sql`）。

**表关系概览：**
```
users（用户，role 区分 1用户/2专家/3管理员）
 ├─< user_oauth          第三方账号绑定（微信/QQ）
 ├─< doctors             专家名片（role=2 用户 1:1，user_id 关联）
 ├─< appointment_records 预约（user_id → users，doctor_id → doctors）
 │     └─< expert_chat   预约内即时聊天（sender_id/receiver_id → users）
 ├─< chat_records        与 AI 的聊天记录
 ├─< analysis_reports    AI 心理分析报告
 ├─< ai_test_papers      AI 实时生成的问卷
 └─< test_results        测评结果（test_id → psychological_tests）
                                   └─< test_questions 量表题目
psychological_tests（量表主表）
sensitive_words（敏感词库，全局共享，不属于某个用户）
```

---

## A.1 `users` 用户表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 用户 ID |
| `username` | VARCHAR(50) | 非空, 唯一 | 昵称 |
| `email` | VARCHAR(100) | 非空, 唯一 | 邮箱（登录账号） |
| `phone` | VARCHAR(20) | 可空, 唯一 | 手机号 |
| `password_hash` | VARCHAR(100) | 非空 | bcrypt 哈希（rounds=12） |
| `role` | TINYINT | 默认 1 | 1=普通用户 2=专家 3=管理员 |
| `avatar` | LONGTEXT | 可空 | 头像（base64 data URI） |
| `created_at` | DATETIME | 默认当前时间 | 注册时间 |
| `updated_at` | DATETIME | 自动更新 | 更新时间 |

唯一键：`uk_users_email(email)`、`uk_users_username(username)`、`uk_users_phone(phone)`

---

## A.2 `doctors` 专家（名片）表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 专家 ID（业务上的 doctor_id） |
| `name` | VARCHAR(50) | 非空 | 姓名 |
| `title` | VARCHAR(50) | 默认 '' | 职称，如「国家二级心理咨询师」 |
| `specialty` | VARCHAR(200) | 默认 '' | 擅长领域 |
| `intro` | TEXT | — | 名片简介 |
| `user_id` | INT UNSIGNED | 可空 | 关联 `users.id`（role=2 的账号） |
| `status` | TINYINT | 默认 1 | **0=下架 / 1=上架 / 2=待审核** |
| `created_at` | DATETIME | 默认当前时间 | 创建时间 |

---

## A.3 `appointment_records` 预约记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 预约 ID |
| `user_id` | INT UNSIGNED | 非空, 索引 | 预约用户 → `users.id` |
| `doctor_id` | INT UNSIGNED | 非空, 索引 | 被预约专家 → `doctors.id` |
| `status` | VARCHAR(20) | 默认 `pending` | pending/confirmed/rejected/completed/cancelled |
| `created_at` | DATETIME | 默认当前时间 | 创建时间 |

> 注意：schema 注释里只列了 4 种状态，代码实际还使用 `rejected`（专家拒绝）。

---

## A.4 `psychological_tests` 心理测评量表表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 量表 ID |
| `code` | VARCHAR(30) | 非空 | 量表编码，如 `PHQ9`；AI 测评固定为 `AI-GEN` |
| `name` | VARCHAR(100) | 非空 | 量表名称 |
| `description` | TEXT | — | 描述 |
| `category` | VARCHAR(50) | 默认 '' | 分类（抑郁/焦虑/情绪/智能…） |
| `total_questions` | INT | 默认 0 | 题目总数 |
| `estimated_minutes` | INT | 默认 5 | 预计用时（分钟） |
| `scoring_method` | VARCHAR(30) | 默认 `sum` | 计分方式，如 `sum`、`ai` |
| `result_levels` | TEXT | — | JSON 分级规则 `[{min,max,level,desc}]` |
| `status` | TINYINT | 默认 0 | **0=未上架(待审核) / 1=已上架 / 2=已下架** |
| `created_at` | DATETIME | 默认当前时间 | 创建时间 |

`result_levels` JSON 示例：
```json
[
  { "min": 0, "max": 4, "level": "正常", "desc": "状态良好" },
  { "min": 5, "max": 9, "level": "轻度", "desc": "轻度困扰" }
]
```

---

## A.5 `test_questions` 测评题目表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 题目 ID |
| `test_id` | INT UNSIGNED | 非空, 索引 | 所属量表 → `psychological_tests.id` |
| `question_number` | INT | 非空 | 题号（从 1 开始） |
| `content` | TEXT | 非空 | 题干 |
| `dimension` | VARCHAR(50) | 可空 | 测评维度 |
| `reverse_scoring` | TINYINT | 默认 0 | 是否反向计分（1=是） |
| `options` | TEXT | — | JSON 选项数组 `[{score,text}]` |

`options` JSON 示例：
```json
[
  { "score": 0, "text": "完全不会" },
  { "score": 1, "text": "几天" },
  { "score": 2, "text": "一半以上天数" },
  { "score": 3, "text": "几乎每天" }
]
```

---

## A.6 `test_results` 测评结果表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 结果 ID |
| `user_id` | INT UNSIGNED | 非空, 索引 | 作答用户 → `users.id` |
| `test_id` | INT UNSIGNED | 非空 | 量表 → `psychological_tests.id` |
| `test_code` | VARCHAR(30) | 默认 '' | 冗余量表编码 |
| `answers` | TEXT | — | JSON 作答明细 |
| `total_score` | INT | 默认 0 | 总分 |
| `result_level` | VARCHAR(30) | 默认 '' | 分级（正常/轻度/中度/重度） |
| `result_desc` | TEXT | — | 结果描述（AI 测评含分析正文） |
| `completed_at` | DATETIME | 默认当前时间 | 完成时间 |

---

## A.7 `ai_test_papers` AI 生成问卷表

每次调用 AI 智能测评时，把当次完整题目与选项落库，提交评分时凭 `paper_id` 取回，保证评分依据与用户所见一致。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 问卷 ID（即接口返回的 `paper_id`） |
| `user_id` | INT UNSIGNED | 非空, 索引 | 生成用户 → `users.id` |
| `questions` | TEXT | 非空 | JSON `[{number,content,options:[{label,text,score}]}]` |
| `created_at` | DATETIME | 默认当前时间 | 生成时间 |

---

## A.8 `chat_records` AI 聊天记录表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 记录 ID |
| `user_id` | INT UNSIGNED | 非空, 索引 | 用户 → `users.id` |
| `content` | TEXT | 非空 | 消息内容 |
| `type` | VARCHAR(20) | 默认 `user` | `user`=用户发送 / `ai`=AI 回复 |
| `created_at` | DATETIME | 默认当前时间 | 时间 |

---

## A.9 `analysis_reports` AI 分析报告表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 报告 ID |
| `user_id` | INT UNSIGNED | 非空, 索引 | 用户 → `users.id` |
| `start_date` | DATE | 非空 | 分析区间起 |
| `end_date` | DATE | 非空 | 分析区间止 |
| `content` | LONGTEXT | — | 报告正文（Markdown） |
| `created_at` | DATETIME | 默认当前时间 | 生成时间 |

---

## A.10 `expert_chat` 专家咨询聊天表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 消息 ID |
| `sender_id` | INT UNSIGNED | 非空 | 发送方 → `users.id` |
| `receiver_id` | INT UNSIGNED | 非空 | 接收方 → `users.id`（服务端按预约关系推导） |
| `content` | TEXT | 非空 | 消息内容（经过敏感词+AI 审核） |
| `appointment_id` | INT UNSIGNED | 非空, 索引 | 所属预约 → `appointment_records.id` |
| `is_read` | TINYINT | 默认 0 | 是否已读（1=已读） |
| `created_at` | DATETIME | 默认当前时间 | 发送时间 |

---

## A.11 `user_oauth` 第三方 OAuth 绑定表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 绑定 ID |
| `user_id` | INT UNSIGNED | 非空 | 关联用户 → `users.id` |
| `provider` | VARCHAR(20) | 非空 | `wechat` / `qq` |
| `openid` | VARCHAR(100) | 非空 | 第三方 openid |
| `unionid` | VARCHAR(100) | 可空 | 微信 unionid |
| `access_token` | VARCHAR(255) | 默认 '' | 访问令牌（占位） |
| `created_at` | DATETIME | 默认当前时间 | 绑定时间 |

唯一键：`uk_oauth(provider, openid)`

---

## A.12 `sensitive_words` 敏感词库表

服务启动时加载进内存；表为空自动播种内置默认词库；管理员增删后实时重载。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INT UNSIGNED | PK, 自增 | 词 ID |
| `word` | VARCHAR(64) | 非空, 唯一 | 敏感词 |
| `category` | VARCHAR(20) | 默认 `其他` | 侮辱/色情/违禁/自伤/缩写/其他 |
| `is_short` | TINYINT | 默认 0 | 1=缩写短词（独立词边界匹配）/ 0=主词（包含匹配） |
| `created_at` | DATETIME | 默认当前时间 | 添加时间 |

---

## A.13 Redis 键（Key）说明

| Key 模式 | 类型 | TTL | 用途 |
|----------|------|-----|------|
| `captcha:{时间戳}:{随机}` | string | 300s | 图形验证码（值为 4 位数字），ID 通过响应头 `X-Captcha-Id` 返回 |
| `sms:{手机号}` | string | 300s | 短信验证码 |
| `register:{邮箱}` | string | 600s | 注册邮箱验证码 |
| `forget:{邮箱}` | string | 600s | 找回密码验证码 |
| `rate_limit:sms:{手机号}` | string | 60s | 短信发送限流 |
| `rate_limit:register_code:{邮箱}` | string | 60s | 注册验证码限流 |
| `rate_limit:send_code:{邮箱}` | string | 60s | 找回密码验证码限流 |
| `user_onlyid:{userId}` | string | 7 天 | 用户当前会话 onlyId（单点登录，新登录覆盖旧值） |
| `onlyid_token:{onlyId}` | string | 7 天 | onlyId → JWT |
| `token_onlyid:{token}` | string | 7 天 | JWT → onlyId（登出时反查清理） |
| `token_blacklist:{token}` | string | token 剩余有效期 | 已注销 / 被刷新的 JWT 黑名单 |
| `password_changed:{userId}` | string | — | 标记密码已修改 |
| 敏感词缓存 | 内存/Redis | — | 启动加载 `sensitive_words`，增删后调用 `invalidateWords()` 实时失效 |

---

# 附录 B、接口—数据表映射总表

> 标注每个接口实际读写的 MySQL 表（`读`=SELECT，`写`=INSERT/UPDATE/DELETE）与 Redis 操作。

## B.1 用户认证 `/api/users`

| 接口 | 方法 | 操作的数据表 | Redis |
|------|------|-------------|-------|
| `/users/register/send-code` | POST | 读 `users`（邮箱查重） | 写 `register:{email}`、限流键 |
| `/users/register` | POST | 读 `users`（查重）；写 `users` | 读验证码；写 `user_onlyid`/`onlyid_token`/`token_onlyid` |
| `/users/login` | POST | 读 `users` | 写会话三键（单点登录踢旧会话） |
| `/users/master-login` | POST | 读 `users`（管理员+目标账号） | 写会话三键 |
| `/users/logout` | POST | — | 写 `token_blacklist`；删会话键 |
| `/users/refresh-token` | POST | 读 `users` | 旧 token 入黑名单；写新会话三键 |
| `/users/forget-password/send-code` | POST | 读 `users`（判断是否注册） | 写 `forget:{email}`、限流键 |
| `/users/forget-password/reset` | POST | 读 `users`；写 `users.password_hash` | 读/删验证码；删旧会话键 |
| `/users/me`、`/users/info`、`/users/profile`(GET) | GET | 读 `users` | — |
| `/users/profile`(PUT) | PUT | 读 `users`（昵称查重）；写 `users` | — |
| `/users/avatar`(PUT) | PUT | 写 `users.avatar` | — |
| `/users/stats` | GET | 读 `chat_records`、`test_results`、`appointment_records`、`analysis_reports`（各 COUNT） | — |
| `/users/clear-all` | POST | 删 `chat_records`、`test_results`、`analysis_reports`、`appointment_records` | — |

## B.2 第三方认证 `/api/auth`

| 接口 | 方法 | 操作的数据表 | Redis |
|------|------|-------------|-------|
| `/auth/captcha` | GET | — | 写图形验证码键 |
| `/auth/sms-code` | POST | — | 读图形验证码；写 `sms:{phone}`、限流键 |
| `/auth/sms-login` | POST | 读 `users`；新用户写 `users` | 读短信验证码；写会话三键 |
| `/auth/oauth/:provider` | GET | — | —（返回第三方授权 URL） |
| `/auth/oauth/callback/:provider` | GET | 读 `user_oauth`；新用户写 `users`+`user_oauth` | 写会话三键 |

## B.3 AI `/api/ai`

| 接口 | 方法 | 操作的数据表 | 说明 |
|------|------|-------------|------|
| `/ai/chat` | POST | 不读写数据库 | 直接转发大模型 API（不落库） |
| `/ai/chat-stream` | POST | 不读写数据库 | SSE 流式转发大模型 |
| `/ai/summarize-report` | POST | 不读写数据库 | 入参由前端从各表组装，仅调大模型 |

> AI 聊天内容的持久化由前端另行调用 `POST /users/chat` 写入 `chat_records`；报告持久化调用 `POST /users/analysis-report` 写入 `analysis_reports`。

## B.4 测评 `/api/tests` 与 `/users/tests`

| 接口 | 方法 | 操作的数据表 | Redis |
|------|------|-------------|-------|
| `/users/tests`、`/tests/list` | GET | 读 `psychological_tests`（status=1 且 code≠AI-GEN） | — |
| `/tests/questions/{testId}` | GET | 读 `psychological_tests`、`test_questions` | — |
| `/tests/submit` | POST | 读 `psychological_tests`（取分级规则）；写 `test_results` | — |
| `/tests/history` | GET | 读 `test_results` JOIN `psychological_tests` | — |
| `/tests/result/{resultId}` | GET | 读 `test_results` JOIN `psychological_tests` | — |
| `/tests/ai/questions` | POST | 写 `ai_test_papers` | —（调大模型生成） |
| `/tests/ai/submit` | POST | 读 `ai_test_papers`；upsert `psychological_tests`(AI-GEN)；写 `test_results` | —（调大模型评分） |

## B.5 专家与预约（普通用户侧）`/api/users`

| 接口 | 方法 | 操作的数据表 |
|------|------|-------------|
| `/users/doctors` | GET | 读 `doctors` LEFT JOIN `users`（取头像），仅 status=1 |
| `/users/appointments`(POST) | POST | 读 `doctors`、`appointment_records`（去重）；写 `appointment_records` |
| `/users/appointments`(GET) | GET | 读 `appointment_records` JOIN `doctors` |
| `/users/appointments/{id}/cancel`(PUT) | PUT | 读/写 `appointment_records`（Socket 广播） |
| `/users/chat-history` | GET | 读 `chat_records` |
| `/users/chat` | POST | 写 `chat_records` |
| `/users/analysis-report`(POST) | POST | 写 `analysis_reports` |
| `/users/analysis-reports`(GET) | GET | 读 `analysis_reports` |

## B.6 内容审核 `/api/moderation`

| 接口 | 方法 | 操作的数据表 / 缓存 |
|------|------|---------------------|
| `/moderation/precheck` | POST | 读内存敏感词（源自 `sensitive_words` 表，启动加载），不查库 |

## B.7 管理后台 `/api/admin`（均需 role=3）

| 接口 | 方法 | 操作的数据表 |
|------|------|-------------|
| `/admin/users`(GET) | GET | 读 `users`（分页 + keyword 模糊搜索 + COUNT） |
| `/admin/users`(POST) | POST | 读 `users`（邮箱查重）；写 `users`；role=2 时写 `doctors` |
| `/admin/users/{id}/role`(PUT) | PUT | 写 `users.role` |
| `/admin/users/{id}`(DELETE) | DELETE | 删 `appointment_records`、`test_results`、`chat_records`、`analysis_reports`、`expert_chat`、`user_oauth`、`doctors`、`users` |
| `/admin/stats` | GET | 读 `users`、`doctors`、`appointment_records`、`test_results`（各 COUNT） |
| `/admin/tests`(GET) | GET | 读 `psychological_tests` |
| `/admin/tests`(POST) | POST | 写 `psychological_tests` + 批量写 `test_questions` |
| `/admin/tests/{id}/status`(PUT) | PUT | 写 `psychological_tests.status` |
| `/admin/tests/{id}`(DELETE) | DELETE | 删 `test_questions` + `psychological_tests` |
| `/admin/appointments`(GET) | GET | 读 `appointment_records` JOIN `users` JOIN `doctors` |
| `/admin/appointments`(POST) | POST | 读 `users`、`doctors`；写 `appointment_records` |
| `/admin/appointments/{id}`(DELETE) | DELETE | 删 `appointment_records` |
| `/admin/doctor-cards`(GET) | GET | 读 `doctors` LEFT JOIN `users`（取邮箱） |
| `/admin/doctor-cards/{id}/review`(PUT) | PUT | 写 `doctors.status`（approve→1 / reject→0，Socket 广播） |
| `/admin/sensitive-words`(GET) | GET | 读 `sensitive_words` |
| `/admin/sensitive-words`(POST) | POST | 写 `sensitive_words`；调 `invalidateWords()` 刷新内存缓存 |
| `/admin/sensitive-words/{id}`(DELETE) | DELETE | 删 `sensitive_words`；刷新内存缓存 |

## B.8 专家端 `/api/expert`（多需 role=2）

| 接口 | 方法 | 操作的数据表 |
|------|------|-------------|
| `/expert/my-card`(GET) | GET | 读 `doctors`（按 user_id） |
| `/expert/my-card`(PUT) | PUT | 读/写 `doctors`（保存后 status 置 2 待审核） |
| `/expert/appointments`(GET) | GET | 读 `doctors`（取 doctor_id）；读 `appointment_records` JOIN `users` |
| `/expert/appointments/{id}`(GET) | GET | 读 `appointment_records` JOIN `users`、`doctors`；读 `test_results` JOIN `psychological_tests` + `test_questions`（最近 5 次） |
| `/expert/appointments/{id}/status`(PUT) | PUT | 读 `doctors`；写 `appointment_records.status`（Socket 广播） |
| `/expert/stats` | GET | 读 `doctors`、`appointment_records`（多条件 COUNT + COUNT DISTINCT） |
| `/expert/chat/{appointmentId}`(GET) | GET | 读 `expert_chat` JOIN `users`（双方姓名），需预约参与方 |
| `/expert/chat`(POST) | POST | 读 `expert_chat`（取近 6 条作 AI 审核上下文）；写 `expert_chat`；读 `sensitive_words` 词库审核 |

## B.9 Socket.IO 事件对应的数据操作

| 事件 | 数据表操作 |
|------|-----------|
| `authenticate` | 校验 JWT（Redis 会话/黑名单），维护内存在线表 `userSockets` |
| `send-message` | 读 `expert_chat`（审核上下文）；写 `expert_chat`；读 `users`（发送者昵称）；违规不写库 |
| `mark-read` | 写 `expert_chat.is_read=1` |
| `join-room` / 状态广播 | 不查库，仅内存房间 + Redis 会话校验 |

